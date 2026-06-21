import { and, eq, inArray } from "drizzle-orm";
import { ulid } from "ulid";
import type { DB } from "../auth/session";
import { type Memo, memos, memoTags, projects, tags } from "../db/schema";
import type { CreateMemoInput, UpdateMemoInput } from "./request-schema";

/** メモ + 紐づくタグ ID（API のレスポンス形）。 */
export type MemoView = Memo & { tagIds: string[] };

export type CreateMemoResult =
  | { ok: true; memo: MemoView }
  | { ok: false; reason: "project_not_found" | "tag_not_found" };

export type UpdateMemoResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" | "tag_not_found" };

/** 呼び出し User が当該 Project を所有しているか。 */
async function ownsProject(db: DB, userId: string, projectId: string): Promise<boolean> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

/** tagIds がすべて呼び出し User 所有のタグか（重複は除いて判定）。 */
async function ownsAllTags(db: DB, userId: string, tagIds: string[]): Promise<boolean> {
  if (tagIds.length === 0) return true;
  const owned = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(tags.id, tagIds)));
  return owned.length === tagIds.length;
}

/**
 * メモを作成する。Project は所有必須、tagIds も所有必須（暗黙作成しない）。
 * memo + memo_tags は db.batch で原子化する（ADR 0004）。入力は branded type。
 */
export async function createMemo(
  db: DB,
  userId: string,
  input: CreateMemoInput,
): Promise<CreateMemoResult> {
  if (!(await ownsProject(db, userId, input.projectId))) {
    return { ok: false, reason: "project_not_found" };
  }
  const tagIds = [...new Set(input.tagIds)];
  if (!(await ownsAllTags(db, userId, tagIds))) {
    return { ok: false, reason: "tag_not_found" };
  }

  const now = new Date();
  const id = ulid();
  const row = {
    id,
    userId,
    projectId: input.projectId,
    title: input.title,
    body: input.body,
    createdAt: now,
    updatedAt: now,
  };

  if (tagIds.length === 0) {
    await db.insert(memos).values(row);
  } else {
    await db.batch([
      db.insert(memos).values(row),
      db.insert(memoTags).values(tagIds.map((tagId) => ({ memoId: id, tagId }))),
    ]);
  }
  return { ok: true, memo: { ...row, tagIds } };
}

/** 呼び出し User のメモを作成日の新しい順で返す。projectId 指定で絞り込み。 */
export async function listMemos(
  db: DB,
  userId: string,
  filter?: { projectId?: string },
): Promise<MemoView[]> {
  const rows = await db.query.memos.findMany({
    where: (m, { and: a, eq: e }) =>
      filter?.projectId
        ? a(e(m.userId, userId), e(m.projectId, filter.projectId))
        : e(m.userId, userId),
    orderBy: (m, { desc: d }) => [d(m.createdAt)],
    with: { memoTags: { columns: { tagId: true } } },
  });
  return rows.map(({ memoTags: mt, ...memo }) => ({ ...memo, tagIds: mt.map((x) => x.tagId) }));
}

/** 呼び出し User のメモを 1 件、tagIds 込みで取得する。所有していなければ null。 */
export async function getMemo(db: DB, userId: string, id: string): Promise<MemoView | null> {
  const row = await db.query.memos.findFirst({
    where: (m, { and: a, eq: e }) => a(e(m.id, id), e(m.userId, userId)),
    with: { memoTags: { columns: { tagId: true } } },
  });
  if (!row) return null;
  const { memoTags: mt, ...memo } = row;
  return { ...memo, tagIds: mt.map((x) => x.tagId) };
}

/**
 * 呼び出し User のメモを更新する。所有していなければ not_found。
 * tagIds が present ならタグ集合を完全置換（全 tagId は所有必須）、absent なら変更しない。
 * 成功時は id のみ返す（レスポンスに必要なのは id だけなので更新後の再読込はしない）。
 */
export async function updateMemo(
  db: DB,
  userId: string,
  id: string,
  input: UpdateMemoInput,
): Promise<UpdateMemoResult> {
  const set: Partial<Pick<Memo, "title" | "body">> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.title !== undefined) set.title = input.title;
  if (input.body !== undefined) set.body = input.body;

  const own = and(eq(memos.id, id), eq(memos.userId, userId));

  // タグを触らない場合は UPDATE ... RETURNING で「更新」と「所有確認(=not_found)」を 1 クエリに畳む。
  if (input.tagIds === undefined) {
    const updated = await db.update(memos).set(set).where(own).returning({ id: memos.id });
    return updated[0] ? { ok: true, id } : { ok: false, reason: "not_found" };
  }

  // タグ置換時は batch を使うが、batch は途中で分岐できない。破壊的な memo_tags の
  // delete/insert を走らせる前に所有をゲートで確認し、他人のメモに触れないようにする。
  const existing = await db.select({ id: memos.id }).from(memos).where(own).limit(1);
  if (!existing[0]) return { ok: false, reason: "not_found" };

  const tagIds = [...new Set(input.tagIds)];
  if (!(await ownsAllTags(db, userId, tagIds))) {
    return { ok: false, reason: "tag_not_found" };
  }

  // 更新・タグ全削除・タグ再挿入を 1 batch で原子化する（ADR 0004）。
  const results =
    tagIds.length === 0
      ? await db.batch([
          db.update(memos).set(set).where(own).returning({ id: memos.id }),
          db.delete(memoTags).where(eq(memoTags.memoId, id)),
        ])
      : await db.batch([
          db.update(memos).set(set).where(own).returning({ id: memos.id }),
          db.delete(memoTags).where(eq(memoTags.memoId, id)),
          db.insert(memoTags).values(tagIds.map((tagId) => ({ memoId: id, tagId }))),
        ]);

  // 先頭ゲートは「非所有者を破壊的 batch に到達させない」セキュリティ用。
  // こちらの returning 判定は「ゲート通過後にメモが消えた(TOCTOU の 0 行更新)」を拾う正しさ用。
  const updatedMemoId = results[0][0]?.id;
  return updatedMemoId ? { ok: true, id: updatedMemoId } : { ok: false, reason: "not_found" };
}

/** 呼び出し User のメモを削除する。memo_tags は FK cascade で掃除される。 */
export async function deleteMemo(db: DB, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(memos)
    .where(and(eq(memos.id, id), eq(memos.userId, userId)))
    .returning({ id: memos.id });
  return rows.length > 0;
}
