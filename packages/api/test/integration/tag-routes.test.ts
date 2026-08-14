import { env, SELF } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it } from "vitest";
import { loginWithIdentity } from "../../src/auth/account";
import { sessionCookieName } from "../../src/auth/cookie";
import type { IdentityProfile } from "../../src/auth/providers/types";
import * as schema from "../../src/db/schema";
import {
  memos,
  memoTags,
  projects,
  sessions,
  tags,
  userIdentities,
  users,
} from "../../src/db/schema";

const BASE = "https://example.com";
const db = drizzle(env.DB, { schema });
const cookieName = sessionCookieName(env.APP_BASE_URL);
const meta = { userAgent: null, ipAddress: null };

function profile(sub: string): IdentityProfile {
  return {
    provider: "google",
    providerSub: sub,
    email: `${sub}@example.com`,
    emailVerified: true,
    name: sub,
    pictureUrl: null,
  };
}

/** sub ごとにログイン済み状態を作り、その Cookie ヘッダを返す。 */
async function loginAs(sub: string): Promise<string> {
  const issued = await loginWithIdentity(db, profile(sub), meta);
  return `${cookieName}=${issued.id}`;
}

async function postTag(cookie: string, body: unknown) {
  return SELF.fetch(`${BASE}/api/tags`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function putTag(cookie: string, id: string, body: unknown) {
  return SELF.fetch(`${BASE}/api/tags/${id}`, {
    method: "PUT",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** 指定タグを付けたメモを API 経由で作り、memo_id を返す。 */
async function seedMemoWithTag(cookie: string, tagId: string): Promise<string> {
  const project = await SELF.fetch(`${BASE}/api/projects`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ name: "案件", startDate: "2024-01-01" }),
  });
  const { id: projectId } = (await project.json()) as { id: string };
  const memo = await SELF.fetch(`${BASE}/api/memos`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ projectId, title: "t", body: "b", tagIds: [tagId] }),
  });
  const { id } = (await memo.json()) as { id: string };
  return id;
}

describe("tag routes", () => {
  beforeEach(async () => {
    await db.delete(memoTags);
    await db.delete(memos);
    await db.delete(projects);
    await db.delete(tags);
    await db.delete(sessions);
    await db.delete(userIdentities);
    await db.delete(users);
  });

  it("POST /api/tags 未認証 → 401", async () => {
    const res = await SELF.fetch(`${BASE}/api/tags`, {
      method: "POST",
      body: JSON.stringify({ name: "トラブル" }),
    });
    expect(res.status).toBe(401);
  });

  it("POST 有効 → 201 で id を返し、タグが作成される", async () => {
    const cookie = await loginAs("alice");
    const res = await postTag(cookie, { name: "トラブル" });

    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const [tag] = await db.select().from(tags).where(eq(tags.id, id));
    expect(tag?.name).toBe("トラブル");
  });

  it("POST name 空 → 400", async () => {
    const cookie = await loginAs("alice");
    expect((await postTag(cookie, { name: "   " })).status).toBe(400);
    expect((await postTag(cookie, {})).status).toBe(400);
  });

  it("POST 同名重複 → 409", async () => {
    const cookie = await loginAs("alice");
    await postTag(cookie, { name: "トラブル" });

    expect((await postTag(cookie, { name: "トラブル" })).status).toBe(409);
  });

  it("GET /api/tags は自分のタグだけを返す", async () => {
    const alice = await loginAs("alice");
    const bob = await loginAs("bob");
    await postTag(alice, { name: "aliceの" });
    await postTag(bob, { name: "bobの" });

    const res = await SELF.fetch(`${BASE}/api/tags`, { headers: { cookie: alice } });
    const json = (await res.json()) as { tags: { name: string }[] };
    expect(json.tags).toHaveLength(1);
    expect(json.tags[0]?.name).toBe("aliceの");
  });

  it("PUT 自分のタグをリネームできる", async () => {
    const cookie = await loginAs("alice");
    const { id } = (await (await postTag(cookie, { name: "トラブル" })).json()) as { id: string };

    const res = await putTag(cookie, id, { name: "障害対応" });

    expect(res.status).toBe(200);
    const [tag] = await db.select().from(tags).where(eq(tags.id, id));
    expect(tag?.name).toBe("障害対応");
  });

  it("PUT 同名重複 → 409、name 空 → 400", async () => {
    const cookie = await loginAs("alice");
    await postTag(cookie, { name: "既存" });
    const { id } = (await (await postTag(cookie, { name: "リネーム元" })).json()) as { id: string };

    expect((await putTag(cookie, id, { name: "既存" })).status).toBe(409);
    expect((await putTag(cookie, id, { name: "   " })).status).toBe(400);
  });

  it("PUT 他人のタグ → 404", async () => {
    const alice = await loginAs("alice");
    const bob = await loginAs("bob");
    const { id } = (await (await postTag(alice, { name: "aliceの" })).json()) as { id: string };

    expect((await putTag(bob, id, { name: "乗っ取り" })).status).toBe(404);
  });

  it("リネームしてもメモとの紐付けは維持される（削除と異なる）", async () => {
    const cookie = await loginAs("alice");
    const { id: tagId } = (await (await postTag(cookie, { name: "トラブル" })).json()) as {
      id: string;
    };
    const memoId = await seedMemoWithTag(cookie, tagId);

    await putTag(cookie, tagId, { name: "障害対応" });
    expect(await db.select().from(memoTags).where(eq(memoTags.memoId, memoId))).toHaveLength(1);

    // 対比: 削除すると memo_tags は cascade で消える
    await SELF.fetch(`${BASE}/api/tags/${tagId}`, { method: "DELETE", headers: { cookie } });
    expect(await db.select().from(memoTags).where(eq(memoTags.memoId, memoId))).toHaveLength(0);
  });

  it("DELETE 自分のタグ → 204、他人のタグ → 404", async () => {
    const alice = await loginAs("alice");
    const bob = await loginAs("bob");
    const created = (await (await postTag(alice, { name: "トラブル" })).json()) as {
      id: string;
    };
    const url = `${BASE}/api/tags/${created.id}`;

    expect((await SELF.fetch(url, { method: "DELETE", headers: { cookie: bob } })).status).toBe(
      404,
    );
    expect((await SELF.fetch(url, { method: "DELETE", headers: { cookie: alice } })).status).toBe(
      204,
    );
  });
});
