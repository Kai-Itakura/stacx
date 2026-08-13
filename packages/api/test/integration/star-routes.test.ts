import { env, SELF } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it } from "vitest";
import { loginWithIdentity } from "../../src/auth/account";
import { sessionCookieName } from "../../src/auth/cookie";
import type { IdentityProfile } from "../../src/auth/providers/types";
import * as schema from "../../src/db/schema";
import { memos, projects, sessions, starLogs, userIdentities, users } from "../../src/db/schema";
import { ulid } from "../../src/id";

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

/** ログイン済み状態を作り、user_id と Cookie ヘッダを返す。 */
async function loginAs(sub: string): Promise<{ userId: string; cookie: string }> {
  const issued = await loginWithIdentity(db, profile(sub), meta);
  const [session] = await db.select().from(sessions).where(eq(sessions.id, issued.id));
  if (!session) throw new Error("session seed failed");
  return { userId: session.userId, cookie: `${cookieName}=${issued.id}` };
}

/** 指定 User 所有のプロジェクト + メモを作り、memo_id を返す。 */
async function seedMemo(userId: string): Promise<string> {
  const now = new Date();
  const projectId = ulid();
  const memoId = ulid();
  await db.insert(projects).values({
    id: projectId,
    userId,
    name: "案件",
    startDate: now,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(memos).values({
    id: memoId,
    userId,
    projectId,
    title: "t",
    body: "b",
    createdAt: now,
    updatedAt: now,
  });
  return memoId;
}

const getStar = (cookie: string, memoId: string) =>
  SELF.fetch(`${BASE}/api/memos/${memoId}/star`, { headers: { cookie } });

const putStar = (cookie: string, memoId: string, body: unknown) =>
  SELF.fetch(`${BASE}/api/memos/${memoId}/star`, {
    method: "PUT",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("star routes", () => {
  beforeEach(async () => {
    await db.delete(starLogs);
    await db.delete(memos);
    await db.delete(projects);
    await db.delete(sessions);
    await db.delete(userIdentities);
    await db.delete(users);
  });

  it("未認証は 401", async () => {
    const res = await SELF.fetch(`${BASE}/api/memos/x/star`);
    expect(res.status).toBe(401);
  });

  it("未 STAR 化のメモは GET で star=null", async () => {
    const { userId, cookie } = await loginAs("alice");
    const memoId = await seedMemo(userId);
    const res = await getStar(cookie, memoId);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { star: unknown }).star).toBeNull();
  });

  it("PUT で作成 → GET で取得でき、再 PUT で 1 行のまま更新される", async () => {
    const { userId, cookie } = await loginAs("alice");
    const memoId = await seedMemo(userId);

    const created = await putStar(cookie, memoId, { situation: "障害", result: "改善" });
    expect(created.status).toBe(200);

    const fetched = await getStar(cookie, memoId);
    const { star } = (await fetched.json()) as { star: { situation: string; task: string | null } };
    expect(star.situation).toBe("障害");
    expect(star.task).toBeNull();

    await putStar(cookie, memoId, { situation: "障害2", task: "対応" });
    const rows = await db.select().from(starLogs).where(eq(starLogs.memoId, memoId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.situation).toBe("障害2");
    expect(rows[0]?.task).toBe("対応");
    expect(rows[0]?.result).toBeNull();
  });

  it("全項目が空の PUT は 400", async () => {
    const { userId, cookie } = await loginAs("alice");
    const memoId = await seedMemo(userId);
    expect((await putStar(cookie, memoId, { situation: "  " })).status).toBe(400);
    expect((await putStar(cookie, memoId, {})).status).toBe(400);
  });

  it("status 既定は draft、complete は全項目必須", async () => {
    const { userId, cookie } = await loginAs("alice");
    const memoId = await seedMemo(userId);

    // 既定は draft
    await putStar(cookie, memoId, { situation: "S" });
    const [drafted] = await db.select().from(starLogs).where(eq(starLogs.memoId, memoId));
    expect(drafted?.status).toBe("draft");

    // complete で一部欠けは 400、全部揃えば 200 で status=complete
    expect((await putStar(cookie, memoId, { situation: "S", status: "complete" })).status).toBe(
      400,
    );
    const full = { situation: "S", task: "T", action: "A", result: "R", status: "complete" };
    expect((await putStar(cookie, memoId, full)).status).toBe(200);
    const [done] = await db.select().from(starLogs).where(eq(starLogs.memoId, memoId));
    expect(done?.status).toBe("complete");
  });

  it("他人のメモは GET/PUT とも 404", async () => {
    const alice = await loginAs("alice");
    const bob = await loginAs("bob");
    const memoId = await seedMemo(alice.userId);

    expect((await getStar(bob.cookie, memoId)).status).toBe(404);
    expect((await putStar(bob.cookie, memoId, { situation: "x" })).status).toBe(404);
    // bob の PUT で star_logs が作られていないこと。
    expect(await db.select().from(starLogs)).toHaveLength(0);
  });
});
