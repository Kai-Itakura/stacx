import { env, SELF } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it } from "vitest";
import { loginWithIdentity } from "../../src/auth/account";
import { sessionCookieName } from "../../src/auth/cookie";
import type { IdentityProfile } from "../../src/auth/providers/types";
import * as schema from "../../src/db/schema";
import { projects, sessions, userIdentities, users } from "../../src/db/schema";

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

const body = { name: "案件A", startDate: "2024-01-01" };

describe("project routes", () => {
  beforeEach(async () => {
    await db.delete(projects);
    await db.delete(sessions);
    await db.delete(userIdentities);
    await db.delete(users);
  });

  it("POST /api/projects 未認証 → 401", async () => {
    const res = await SELF.fetch(`${BASE}/api/projects`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(401);
  });

  it("POST 有効 → 201 で作成した Project を返す", async () => {
    const cookie = await loginAs("alice");
    const res = await SELF.fetch(`${BASE}/api/projects`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { project: { id: string; name: string; endDate: null } };
    expect(json.project.name).toBe("案件A");
    expect(json.project.endDate).toBeNull();
  });

  it("POST name 欠落 → 400", async () => {
    const cookie = await loginAs("alice");
    const res = await SELF.fetch(`${BASE}/api/projects`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ startDate: "2024-01-01" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/projects は自分の Project だけを返す", async () => {
    const alice = await loginAs("alice");
    const bob = await loginAs("bob");
    await SELF.fetch(`${BASE}/api/projects`, {
      method: "POST",
      headers: { cookie: alice, "content-type": "application/json" },
      body: JSON.stringify({ name: "aliceの", startDate: "2024-01-01" }),
    });
    await SELF.fetch(`${BASE}/api/projects`, {
      method: "POST",
      headers: { cookie: bob, "content-type": "application/json" },
      body: JSON.stringify({ name: "bobの", startDate: "2024-01-01" }),
    });

    const res = await SELF.fetch(`${BASE}/api/projects`, { headers: { cookie: alice } });
    const json = (await res.json()) as { projects: { name: string }[] };
    expect(json.projects).toHaveLength(1);
    expect(json.projects[0]?.name).toBe("aliceの");
  });

  it("GET/PUT/DELETE /:id は他人の Project だと 404", async () => {
    const alice = await loginAs("alice");
    const bob = await loginAs("bob");
    const created = (await (
      await SELF.fetch(`${BASE}/api/projects`, {
        method: "POST",
        headers: { cookie: alice, "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    ).json()) as { project: { id: string } };
    const id = created.project.id;

    // 所有者本人は取得・更新・削除できる
    expect(
      (await SELF.fetch(`${BASE}/api/projects/${id}`, { headers: { cookie: alice } })).status,
    ).toBe(200);

    // 他人(bob)からは全操作 404
    const url = `${BASE}/api/projects/${id}`;
    expect((await SELF.fetch(url, { headers: { cookie: bob } })).status).toBe(404);
    expect(
      (
        await SELF.fetch(url, {
          method: "PUT",
          headers: { cookie: bob, "content-type": "application/json" },
          body: JSON.stringify({ name: "乗っ取り" }),
        })
      ).status,
    ).toBe(404);
    expect((await SELF.fetch(url, { method: "DELETE", headers: { cookie: bob } })).status).toBe(
      404,
    );
  });

  it("PUT で更新、DELETE で 204、その後 GET は 404", async () => {
    const cookie = await loginAs("alice");
    const created = (await (
      await SELF.fetch(`${BASE}/api/projects`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    ).json()) as { project: { id: string } };
    const url = `${BASE}/api/projects/${created.project.id}`;

    const put = await SELF.fetch(url, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "改名後" }),
    });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { project: { name: string } }).project.name).toBe("改名後");

    expect((await SELF.fetch(url, { method: "DELETE", headers: { cookie } })).status).toBe(204);
    expect((await SELF.fetch(url, { headers: { cookie } })).status).toBe(404);
  });
});
