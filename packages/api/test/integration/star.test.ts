import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { ulid } from "ulid";
import { assert, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../src/db/schema";
import { projects, stars, starTags, tags, users } from "../../src/db/schema";
import {
  type CreateStarInput,
  createStarSchema,
  updateStarSchema,
} from "../../src/star/request-schema";
import { createStar, deleteStar, getStar, listStars, updateStar } from "../../src/star/star";

const db = drizzle(env.DB, { schema });

async function seedUser(): Promise<string> {
  const id = ulid();
  const now = new Date();
  await db.insert(users).values({ id, createdAt: now, updatedAt: now, lastLoginAt: now });
  return id;
}

async function seedProject(userId: string, name = "案件"): Promise<string> {
  const id = ulid();
  const now = new Date();
  await db
    .insert(projects)
    .values({ id, userId, name, startDate: now, createdAt: now, updatedAt: now });
  return id;
}

async function seedTag(userId: string, name: string): Promise<string> {
  const id = ulid();
  await db.insert(tags).values({ id, userId, name, createdAt: new Date() });
  return id;
}

type CreateFields = Partial<Omit<CreateStarInput, "projectId">> & { projectId: string };
const createInput = (o: CreateFields) => createStarSchema.parse({ situation: "障害", ...o });

const updateInput = (o: Record<string, unknown>) => updateStarSchema.parse(o);

/** 自分の STAR を 1 件作って id を返す。 */
async function seedStar(userId: string, o: Partial<CreateFields> = {}): Promise<string> {
  const projectId = o.projectId ?? (await seedProject(userId));
  const created = await createStar(db, userId, createInput({ ...o, projectId }));
  assert(created.ok, "STAR のシード作成失敗");
  return created.star.id;
}

async function resetAll() {
  await db.delete(starTags);
  await db.delete(stars);
  await db.delete(tags);
  await db.delete(projects);
  await db.delete(users);
}

describe("createStar", () => {
  beforeEach(resetAll);

  it("S/T/A/R・notes を保存し、tagIds で star_tags を張る", async () => {
    const me = await seedUser();
    const projectId = await seedProject(me);
    const t1 = await seedTag(me, "トラブル");
    const t2 = await seedTag(me, "改善");

    const result = await createStar(
      db,
      me,
      createInput({ projectId, task: "復旧", notes: "ログ", tagIds: [t1, t2] }),
    );

    assert(result.ok);
    expect(result.star).toMatchObject({
      userId: me,
      projectId,
      situation: "障害",
      task: "復旧",
      action: null,
      result: null,
      notes: "ログ",
      state: "unresolved",
    });
    expect(result.star.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(result.star.tagIds.sort()).toEqual([t1, t2].sort());
    expect(await db.select().from(starTags)).toHaveLength(2);
  });

  it("空・空白だけの項目は null で保存する", async () => {
    const me = await seedUser();
    const id = await seedStar(me, { task: "  ", notes: "" });

    expect(await getStar(db, me, id)).toMatchObject({ task: null, notes: null });
  });

  it("他人の Project には作れない → project_not_found", async () => {
    const me = await seedUser();
    const othersProject = await seedProject(await seedUser());

    const result = await createStar(db, me, createInput({ projectId: othersProject }));

    expect(result).toEqual({ ok: false, reason: "project_not_found" });
    expect(await db.select().from(stars)).toHaveLength(0);
  });

  it("自分の所有でない tagId が混じると → tag_not_found（何も作らない）", async () => {
    const me = await seedUser();
    const projectId = await seedProject(me);
    const mine = await seedTag(me, "自分");
    const foreign = await seedTag(await seedUser(), "他人");

    const result = await createStar(db, me, createInput({ projectId, tagIds: [mine, foreign] }));

    expect(result).toEqual({ ok: false, reason: "tag_not_found" });
    expect(await db.select().from(stars)).toHaveLength(0);
    expect(await db.select().from(starTags)).toHaveLength(0);
  });

  it("tagId の重複は 1 つにまとめる", async () => {
    const me = await seedUser();
    const projectId = await seedProject(me);
    const tagId = await seedTag(me, "重複");

    const result = await createStar(db, me, createInput({ projectId, tagIds: [tagId, tagId] }));

    assert(result.ok);
    expect(result.star.tagIds).toEqual([tagId]);
  });
});

describe("listStars / getStar", () => {
  beforeEach(resetAll);

  it("自分の STAR だけを作成日の新しい順で返す", async () => {
    const me = await seedUser();
    const older = await seedStar(me, { situation: "古い" });
    const newer = await seedStar(me, { situation: "新しい" });
    await seedStar(await seedUser(), { situation: "他人" });
    // createdAt を明示的にずらして順序を決定的にする
    await db
      .update(stars)
      .set({ createdAt: new Date(1000) })
      .where(eq(stars.id, older));
    await db
      .update(stars)
      .set({ createdAt: new Date(2000) })
      .where(eq(stars.id, newer));

    const list = await listStars(db, me);

    expect(list.map((s) => s.situation)).toEqual(["新しい", "古い"]);
  });

  it("projectId で絞り込める", async () => {
    const me = await seedUser();
    const pa = await seedProject(me, "A");
    const pb = await seedProject(me, "B");
    await seedStar(me, { projectId: pa, situation: "a1" });
    await seedStar(me, { projectId: pb, situation: "b1" });

    const list = await listStars(db, me, { projectId: pa });

    expect(list.map((s) => s.situation)).toEqual(["a1"]);
  });

  it("4 項目から導出した state と tagIds を返す", async () => {
    const me = await seedUser();
    const t = await seedTag(me, "トラブル");
    await seedStar(me, { situation: "S", task: "T", action: "A", result: "R", tagIds: [t] });
    await seedStar(me, { situation: undefined, result: "R" });

    const list = await listStars(db, me);

    expect(list.map((s) => [s.state, s.tagIds]).sort()).toEqual(
      [
        ["complete", [t]],
        ["missing_context", []],
      ].sort(),
    );
  });

  it("getStar は自分の STAR を返し、他人のは null", async () => {
    const me = await seedUser();
    const id = await seedStar(me);

    expect((await getStar(db, me, id))?.id).toBe(id);
    expect(await getStar(db, await seedUser(), id)).toBeNull();
  });
});

describe("updateStar", () => {
  beforeEach(resetAll);

  it("S/T/A/R を 4 項目とも置き換える（未指定の項目は空になる）", async () => {
    const me = await seedUser();
    const id = await seedStar(me, { situation: "S", task: "T" });

    const result = await updateStar(db, me, id, updateInput({ action: "A", result: "R" }));

    expect(result).toEqual({ ok: true, id });
    expect(await getStar(db, me, id)).toMatchObject({
      situation: null,
      task: null,
      action: "A",
      result: "R",
      state: "missing_context",
    });
  });

  it("notes は指定すれば置き換え、未指定なら変えない", async () => {
    const me = await seedUser();
    const id = await seedStar(me, { notes: "最初" });

    await updateStar(db, me, id, updateInput({ situation: "S" }));
    expect((await getStar(db, me, id))?.notes).toBe("最初");

    await updateStar(db, me, id, updateInput({ situation: "S", notes: "最初\n追記" }));
    expect((await getStar(db, me, id))?.notes).toBe("最初\n追記");
  });

  it("tagIds は指定すれば置き換え、未指定なら変えない、空配列なら全部外す", async () => {
    const me = await seedUser();
    const t1 = await seedTag(me, "旧");
    const t2 = await seedTag(me, "新");
    const id = await seedStar(me, { tagIds: [t1] });

    await updateStar(db, me, id, updateInput({ situation: "S" }));
    expect((await getStar(db, me, id))?.tagIds).toEqual([t1]);

    await updateStar(db, me, id, updateInput({ situation: "S", tagIds: [t2, t2] }));
    expect((await getStar(db, me, id))?.tagIds).toEqual([t2]);

    await updateStar(db, me, id, updateInput({ situation: "S", tagIds: [] }));
    expect((await getStar(db, me, id))?.tagIds).toEqual([]);
  });

  it("自分の所有でない tagId が混じると tag_not_found（変更しない）", async () => {
    const me = await seedUser();
    const mine = await seedTag(me, "自分");
    const foreign = await seedTag(await seedUser(), "他人");
    const id = await seedStar(me, { situation: "元", tagIds: [mine] });

    const result = await updateStar(
      db,
      me,
      id,
      updateInput({ situation: "変更", tagIds: [mine, foreign] }),
    );

    expect(result).toEqual({ ok: false, reason: "tag_not_found" });
    expect(await getStar(db, me, id)).toMatchObject({ situation: "元", tagIds: [mine] });
  });

  it("他人の STAR は not_found", async () => {
    const other = await seedUser();
    const id = await seedStar(other, { situation: "元" });

    const result = await updateStar(
      db,
      await seedUser(),
      id,
      updateInput({ situation: "乗っ取り" }),
    );

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect((await getStar(db, other, id))?.situation).toBe("元");
  });

  it("他人の STAR はタグ付き更新でも not_found で、タグは変更されない", async () => {
    const me = await seedUser();
    const other = await seedUser();
    const myTag = await seedTag(me, "自分のタグ");
    const otherTag = await seedTag(other, "他人のタグ");
    const id = await seedStar(other, { tagIds: [otherTag] });

    const result = await updateStar(db, me, id, updateInput({ situation: "S", tagIds: [myTag] }));

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect((await getStar(db, other, id))?.tagIds).toEqual([otherTag]);
  });
});

describe("deleteStar", () => {
  beforeEach(resetAll);

  it("自分の STAR を削除して true、star_tags も消える", async () => {
    const me = await seedUser();
    const id = await seedStar(me, { tagIds: [await seedTag(me, "トラブル")] });

    expect(await deleteStar(db, me, id)).toBe(true);
    expect(await db.select().from(stars)).toHaveLength(0);
    expect(await db.select().from(starTags)).toHaveLength(0);
  });

  it("他人の STAR は削除せず false", async () => {
    const id = await seedStar(await seedUser());

    expect(await deleteStar(db, await seedUser(), id)).toBe(false);
    expect(await db.select().from(stars)).toHaveLength(1);
  });
});
