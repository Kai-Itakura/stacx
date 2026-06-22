import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { ulid } from "ulid";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../src/db/schema";
import { tags, users } from "../../src/db/schema";
import { createTagSchema } from "../../src/tag/request-schema";
import { createTag, deleteTag, listTags } from "../../src/tag/tag";

const db = drizzle(env.DB, { schema });

/** テスト用に User 行を 1 つ作って id を返す。 */
async function seedUser(): Promise<string> {
  const id = ulid();
  const now = new Date();
  await db.insert(users).values({ id, createdAt: now, updatedAt: now, lastLoginAt: now });
  return id;
}

/** branded な作成入力。ドメインは検証を通した値しか受け取らないので schema 経由で作る。 */
const tagInput = (name: string) => createTagSchema.parse({ name });

describe("createTag", () => {
  beforeEach(async () => {
    await db.delete(tags);
    await db.delete(users);
  });

  it("id・userId・name・createdAt を採番して作成する", async () => {
    const userId = await seedUser();

    const result = await createTag(db, userId, tagInput("トラブル"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tag.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/); // ULID
      expect(result.tag.userId).toBe(userId);
      expect(result.tag.name).toBe("トラブル");
      expect(result.tag.createdAt).toBeInstanceOf(Date);
    }

    const rows = await db.select().from(tags);
    expect(rows).toHaveLength(1);
  });

  it("同一 User 内で同名は重複として弾く（duplicate）", async () => {
    const userId = await seedUser();
    await createTag(db, userId, tagInput("トラブル"));

    const dup = await createTag(db, userId, tagInput("トラブル"));

    expect(dup).toEqual({ ok: false, reason: "duplicate" });
    expect(await db.select().from(tags)).toHaveLength(1); // 増えない
  });

  it("別 User なら同名でも作成できる（User スコープの一意）", async () => {
    const alice = await seedUser();
    const bob = await seedUser();
    await createTag(db, alice, tagInput("トラブル"));

    const result = await createTag(db, bob, tagInput("トラブル"));

    expect(result.ok).toBe(true);
    expect(await db.select().from(tags)).toHaveLength(2);
  });

  it("事前 SELECT をすり抜けた同時作成は UNIQUE 制約で duplicate に倒す（500 にしない）", async () => {
    const userId = await seedUser();

    // 同名を同時に作成すると、両者の事前 SELECT が空を見てから片方の INSERT が
    // UNIQUE 制約に当たる。捕捉して duplicate に変換できていれば 1 件だけ成功する。
    const results = await Promise.all([
      createTag(db, userId, tagInput("競合")),
      createTag(db, userId, tagInput("競合")),
    ]);

    const reasons = results.map((r) => (r.ok ? "ok" : r.reason)).sort();
    expect(reasons).toEqual(["duplicate", "ok"]);
    expect(await db.select().from(tags)).toHaveLength(1);
  });

  it("UNIQUE 以外の DB エラーは握りつぶさず再 throw する（500 に委ねる）", async () => {
    const boom = new Error("D1_ERROR: something else");
    const stubDb = {
      select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
      insert: () => ({ values: () => ({ returning: () => Promise.reject(boom) }) }),
    } as unknown as Parameters<typeof createTag>[0];

    await expect(createTag(stubDb, "u", tagInput("x"))).rejects.toThrow("something else");
  });
});

describe("listTags", () => {
  beforeEach(async () => {
    await db.delete(tags);
    await db.delete(users);
  });

  it("呼び出し User 自身のタグだけを name 昇順で返す", async () => {
    const me = await seedUser();
    const other = await seedUser();
    await createTag(db, me, tagInput("パフォーマンス"));
    await createTag(db, me, tagInput("トラブル"));
    await createTag(db, other, tagInput("他人のタグ"));

    const list = await listTags(db, me);

    expect(list.map((t) => t.name)).toEqual(["トラブル", "パフォーマンス"]);
  });
});

describe("deleteTag", () => {
  beforeEach(async () => {
    await db.delete(tags);
    await db.delete(users);
  });

  it("自分のタグを削除して true", async () => {
    const me = await seedUser();
    const created = await createTag(db, me, tagInput("トラブル"));
    const id = created.ok ? created.tag.id : "";

    expect(await deleteTag(db, me, id)).toBe(true);
    expect(await db.select().from(tags)).toHaveLength(0);
  });

  it("他人のタグは削除せず false（所有境界）", async () => {
    const me = await seedUser();
    const other = await seedUser();
    const created = await createTag(db, other, tagInput("トラブル"));
    const id = created.ok ? created.tag.id : "";

    expect(await deleteTag(db, me, id)).toBe(false);
    expect(await db.select().from(tags)).toHaveLength(1);
  });
});
