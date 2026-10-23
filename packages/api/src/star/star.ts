import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "../auth/session";
import { projects, type Star, stars, starTags, tags } from "../db/schema";
import { ulid } from "../id";
import type { CreateStarInput, UpdateStarInput } from "./request-schema";
import { starState } from "./state";

/**
 * state の union は named type にすると RPC の推論型が内部パスを参照して TS2742（非可搬）に
 * なるため、ここでインラインで持つ。
 */
export type StarView = Star & {
  tagIds: string[];
  state: "complete" | "unresolved" | "in_progress" | "missing_context";
};

export type CreateStarResult =
  | { ok: true; star: StarView }
  | { ok: false; reason: "project_not_found" | "tag_not_found" };

export type UpdateStarResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" | "tag_not_found" };

const norm = (s: string | undefined): string | null => (s && s.trim().length > 0 ? s : null);

const toView = (star: Star, tagIds: string[]): StarView => ({
  ...star,
  tagIds,
  state: starState(star),
});

async function ownsProject(db: DB, userId: string, projectId: string): Promise<boolean> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

/** tagIds がすべて呼び出し User 所有のタグか（重複は除いてから渡す）。 */
async function ownsAllTags(db: DB, userId: string, tagIds: string[]): Promise<boolean> {
  if (tagIds.length === 0) return true;
  const owned = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(tags.id, tagIds)));
  return owned.length === tagIds.length;
}

export async function createStar(
  db: DB,
  userId: string,
  input: CreateStarInput,
): Promise<CreateStarResult> {
  if (!(await ownsProject(db, userId, input.projectId))) {
    return { ok: false, reason: "project_not_found" };
  }
  const tagIds = [...new Set(input.tagIds)];
  if (!(await ownsAllTags(db, userId, tagIds))) {
    return { ok: false, reason: "tag_not_found" };
  }

  const now = new Date();
  const row: Star = {
    id: ulid(),
    userId,
    projectId: input.projectId,
    situation: norm(input.situation),
    task: norm(input.task),
    action: norm(input.action),
    result: norm(input.result),
    notes: norm(input.notes),
    createdAt: now,
    updatedAt: now,
  };

  if (tagIds.length === 0) {
    await db.insert(stars).values(row);
  } else {
    await db.batch([
      db.insert(stars).values(row),
      db.insert(starTags).values(tagIds.map((tagId) => ({ starId: row.id, tagId }))),
    ]);
  }
  return { ok: true, star: toView(row, tagIds) };
}

export async function listStars(
  db: DB,
  userId: string,
  filter?: { projectId?: string },
): Promise<StarView[]> {
  const rows = await db.query.stars.findMany({
    where: (s, { and: a, eq: e }) =>
      filter?.projectId
        ? a(e(s.userId, userId), e(s.projectId, filter.projectId))
        : e(s.userId, userId),
    orderBy: (s, { desc: d }) => [d(s.createdAt)],
    with: { starTags: { columns: { tagId: true } } },
  });
  return rows.map(({ starTags: st, ...star }) =>
    toView(
      star,
      st.map((x) => x.tagId),
    ),
  );
}

/** 呼び出し User の STAR を 1 件取得する。所有していなければ null。 */
export async function getStar(db: DB, userId: string, id: string): Promise<StarView | null> {
  const row = await db.query.stars.findFirst({
    where: (s, { and: a, eq: e }) => a(e(s.id, id), e(s.userId, userId)),
    with: { starTags: { columns: { tagId: true } } },
  });
  if (!row) return null;
  const { starTags: st, ...star } = row;
  return toView(
    star,
    st.map((x) => x.tagId),
  );
}

/**
 * S/T/A/R は 4 項目とも置き換える。notes / tagIds は present なら置き換え、absent なら変更しない。
 */
export async function updateStar(
  db: DB,
  userId: string,
  id: string,
  input: UpdateStarInput,
): Promise<UpdateStarResult> {
  const set: Partial<Star> = {
    situation: norm(input.situation),
    task: norm(input.task),
    action: norm(input.action),
    result: norm(input.result),
    updatedAt: new Date(),
  };
  if (input.notes !== undefined) set.notes = norm(input.notes);

  const own = and(eq(stars.id, id), eq(stars.userId, userId));

  // タグを触らない場合は UPDATE ... RETURNING で「更新」と「所有確認(=not_found)」を 1 クエリに畳む。
  if (input.tagIds === undefined) {
    const updated = await db.update(stars).set(set).where(own).returning({ id: stars.id });
    return updated[0] ? { ok: true, id } : { ok: false, reason: "not_found" };
  }

  // タグ置換時は batch を使うが、batch は途中で分岐できない。破壊的な star_tags の
  // delete/insert を走らせる前に所有をゲートで確認し、他人の STAR に触れないようにする。
  const existing = await db.select({ id: stars.id }).from(stars).where(own).limit(1);
  if (!existing[0]) return { ok: false, reason: "not_found" };

  const tagIds = [...new Set(input.tagIds)];
  if (!(await ownsAllTags(db, userId, tagIds))) {
    return { ok: false, reason: "tag_not_found" };
  }

  const results =
    tagIds.length === 0
      ? await db.batch([
          db.update(stars).set(set).where(own).returning({ id: stars.id }),
          db.delete(starTags).where(eq(starTags.starId, id)),
        ])
      : await db.batch([
          db.update(stars).set(set).where(own).returning({ id: stars.id }),
          db.delete(starTags).where(eq(starTags.starId, id)),
          db.insert(starTags).values(tagIds.map((tagId) => ({ starId: id, tagId }))),
        ]);

  // 先頭ゲートは「非所有者を破壊的 batch に到達させない」セキュリティ用。
  // こちらの returning 判定は「ゲート通過後に STAR が消えた(TOCTOU の 0 行更新)」を拾う正しさ用。
  const updatedId = results[0][0]?.id;
  return updatedId ? { ok: true, id: updatedId } : { ok: false, reason: "not_found" };
}

export async function deleteStar(db: DB, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(stars)
    .where(and(eq(stars.id, id), eq(stars.userId, userId)))
    .returning({ id: stars.id });
  return rows.length > 0;
}
