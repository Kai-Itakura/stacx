import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { ulid } from "ulid";
import { assert, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../src/db/schema";
import { memos, memoTags, projects, tags, users } from "../../src/db/schema";
import { createMemo } from "../../src/memo/memo";
import { createMemoSchema } from "../../src/memo/request-schema";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "../../src/project/project";
import { createProjectSchema, updateProjectSchema } from "../../src/project/request-schema";

const db = drizzle(env.DB, { schema });

/** テスト用に User 行を 1 つ作って id を返す。 */
async function seedUser(): Promise<string> {
  const id = ulid();
  const now = new Date();
  await db.insert(users).values({ id, createdAt: now, updatedAt: now, lastLoginAt: now });
  return id;
}

/** テスト用に Tag を 1 つ作って id を返す。 */
async function seedTag(userId: string, name: string): Promise<string> {
  const id = ulid();
  await db.insert(tags).values({ id, userId, name, createdAt: new Date() });
  return id;
}

const base = {
  name: "決済基盤リプレイス",
  startDate: new Date("2024-01-01"),
  summary: "レガシー決済の刷新",
  teamSize: 5,
  role: "バックエンドリード",
  workStyle: "受託",
};

/** branded な入力。ドメインは検証を通した値しか受け取らないので schema 経由で作る。 */
const createInput = (o: Record<string, unknown> = {}) =>
  createProjectSchema.parse({ ...base, ...o });
const updateInput = (o: Record<string, unknown>) => updateProjectSchema.parse(o);

describe("createProject", () => {
  beforeEach(async () => {
    await db.delete(projects);
    await db.delete(users);
  });

  it("id・タイムスタンプ・userId を採番して永続化し、end_date 未指定は進行中(null)", async () => {
    const userId = await seedUser();

    const created = await createProject(db, userId, createInput());

    expect(created.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID
    expect(created.userId).toBe(userId);
    expect(created.name).toBe("決済基盤リプレイス");
    expect(created.endDate).toBeNull();
    expect(created.createdAt).toBeInstanceOf(Date);

    const rows = await db.select().from(projects);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(created.id);
  });
});

describe("listProjects", () => {
  beforeEach(async () => {
    await db.delete(projects);
    await db.delete(users);
  });

  it("呼び出し User 自身の Project だけを返す", async () => {
    const me = await seedUser();
    const other = await seedUser();
    await createProject(db, me, createInput({ name: "自分のA" }));
    await createProject(db, other, createInput({ name: "他人のB" }));

    const list = await listProjects(db, me);

    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe("自分のA");
  });

  it("開始日の新しい順で返す", async () => {
    const me = await seedUser();
    await createProject(db, me, createInput({ name: "古い", startDate: new Date("2022-01-01") }));
    await createProject(db, me, createInput({ name: "新しい", startDate: new Date("2024-06-01") }));

    const list = await listProjects(db, me);

    expect(list.map((p) => p.name)).toEqual(["新しい", "古い"]);
  });
});

describe("getProject", () => {
  beforeEach(async () => {
    await db.delete(projects);
    await db.delete(users);
  });

  it("自分の Project は取得できる", async () => {
    const me = await seedUser();
    const created = await createProject(db, me, createInput());

    expect((await getProject(db, me, created.id))?.id).toBe(created.id);
  });

  it("他人の Project は null（所有境界）", async () => {
    const me = await seedUser();
    const other = await seedUser();
    const created = await createProject(db, other, createInput());

    expect(await getProject(db, me, created.id)).toBeNull();
  });
});

describe("updateProject", () => {
  beforeEach(async () => {
    await db.delete(projects);
    await db.delete(users);
  });

  it("自分の Project を更新し updatedAt を進める", async () => {
    const me = await seedUser();
    const created = await createProject(db, me, createInput());

    const updated = await updateProject(
      db,
      me,
      created.id,
      updateInput({ name: "改名後", endDate: new Date("2024-12-31") }),
    );

    expect(updated?.name).toBe("改名後");
    expect(updated?.endDate).toEqual(new Date("2024-12-31"));
    expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it("他人の Project は更新せず null を返す", async () => {
    const me = await seedUser();
    const other = await seedUser();
    const created = await createProject(db, other, createInput());

    expect(await updateProject(db, me, created.id, updateInput({ name: "乗っ取り" }))).toBeNull();
    expect((await db.select().from(projects))[0]?.name).toBe(base.name); // 不変
  });

  it("部分更新で他の項目は消えない", async () => {
    const me = await seedUser();
    const created = await createProject(db, me, createInput());

    const updated = await updateProject(db, me, created.id, updateInput({ name: "部分更新" }));

    expect(updated).toEqual({ ...created, name: "部分更新", updatedAt: updated?.updatedAt });
  });
});

describe("deleteProject", () => {
  beforeEach(async () => {
    // 子テーブルから順に掃除する（カスケード検証で memo / memo_tags / tag も使うため）。
    await db.delete(memoTags);
    await db.delete(memos);
    await db.delete(tags);
    await db.delete(projects);
    await db.delete(users);
  });

  it("自分の Project を削除して true", async () => {
    const me = await seedUser();
    const created = await createProject(db, me, createInput());

    expect(await deleteProject(db, me, created.id)).toBe(true);
    expect(await db.select().from(projects)).toHaveLength(0);
  });

  it("他人の Project は削除せず false", async () => {
    const me = await seedUser();
    const other = await seedUser();
    const created = await createProject(db, other, createInput());

    expect(await deleteProject(db, me, created.id)).toBe(false);
    expect(await db.select().from(projects)).toHaveLength(1);
  });

  it("Project 削除で配下の Memo と memo_tags が連鎖削除される（ADR 0005）", async () => {
    const me = await seedUser();
    const target = (await createProject(db, me, createInput())).id;
    const survivor = (await createProject(db, me, createInput({ name: "残る案件" }))).id;
    const tagId = await seedTag(me, "トラブル");

    // 削除対象 Project 配下に tag 付き Memo、別 Project にも Memo を 1 件ずつ。
    const doomed = await createMemo(
      db,
      me,
      createMemoSchema.parse({ projectId: target, title: "消える", body: "本文", tagIds: [tagId] }),
    );
    const kept = await createMemo(
      db,
      me,
      createMemoSchema.parse({ projectId: survivor, title: "残る", body: "本文" }),
    );
    assert(doomed.ok && kept.ok, "Memo のシード作成失敗");

    await deleteProject(db, me, target);

    // 配下 Memo は消え、別 Project の Memo は残る（無差別削除でないこと）。
    expect((await db.select().from(memos)).map((m) => m.id)).toEqual([kept.memo.id]);
    // 配下 Memo に紐づく memo_tags も連鎖で消える。
    expect(await db.select().from(memoTags)).toHaveLength(0);
    // Tag 自体は User 所有で、Project 削除では連鎖しない（連鎖範囲の境界）。
    expect(await db.select().from(tags)).toHaveLength(1);
  });
});
