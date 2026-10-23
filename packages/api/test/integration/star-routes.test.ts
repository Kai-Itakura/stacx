import { env, SELF } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { ulid } from "ulid";
import { beforeEach, describe, expect, it } from "vitest";
import { loginWithIdentity } from "../../src/auth/account";
import { sessionCookieName } from "../../src/auth/cookie";
import type { IdentityProfile } from "../../src/auth/providers/types";
import * as schema from "../../src/db/schema";
import {
  projects,
  sessions,
  stars,
  starTags,
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

/** ログインして Cookie と userId を返す。 */
async function loginAs(sub: string): Promise<{ cookie: string; userId: string }> {
  const issued = await loginWithIdentity(db, profile(sub), meta);
  const [identity] = await db
    .select({ userId: userIdentities.userId })
    .from(userIdentities)
    .where(eq(userIdentities.providerSub, sub));
  return { cookie: `${cookieName}=${issued.id}`, userId: identity?.userId ?? "" };
}

async function seedProject(userId: string): Promise<string> {
  const id = ulid();
  const now = new Date();
  await db
    .insert(projects)
    .values({ id, userId, name: "案件", startDate: now, createdAt: now, updatedAt: now });
  return id;
}

async function seedTag(userId: string, name: string): Promise<string> {
  const id = ulid();
  await db.insert(tags).values({ id, userId, name, createdAt: new Date() });
  return id;
}

/** fixture 用の STAR を直接生成して id を返す（検証対象のルートを経由しない）。 */
async function seedStar(
  userId: string,
  opts: { projectId?: string; situation?: string; tagIds?: string[] } = {},
): Promise<string> {
  const id = ulid();
  const now = new Date();
  await db.insert(stars).values({
    id,
    userId,
    projectId: opts.projectId ?? (await seedProject(userId)),
    situation: opts.situation ?? "障害",
    createdAt: now,
    updatedAt: now,
  });
  if (opts.tagIds?.length) {
    await db.insert(starTags).values(opts.tagIds.map((tagId) => ({ starId: id, tagId })));
  }
  return id;
}

const send = (method: string, path: string, cookie: string, body?: unknown) =>
  SELF.fetch(`${BASE}/api/stars${path}`, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("star routes", () => {
  beforeEach(async () => {
    await db.delete(starTags);
    await db.delete(stars);
    await db.delete(tags);
    await db.delete(projects);
    await db.delete(sessions);
    await db.delete(userIdentities);
    await db.delete(users);
  });

  it("未認証は 401", async () => {
    expect((await SELF.fetch(`${BASE}/api/stars`)).status).toBe(401);
  });

  it("POST 有効 → 201 で id を返し、STAR とタグが永続化される", async () => {
    const { cookie, userId } = await loginAs("alice");
    const projectId = await seedProject(userId);
    const tagId = await seedTag(userId, "トラブル");

    const res = await send("POST", "", cookie, { projectId, situation: "障害", tagIds: [tagId] });

    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const [star] = await db.select().from(stars).where(eq(stars.id, id));
    expect(star?.situation).toBe("障害");
    const links = await db.select().from(starTags).where(eq(starTags.starId, id));
    expect(links.map((l) => l.tagId)).toEqual([tagId]);
  });

  it("POST で 4 項目がすべて空 → 400", async () => {
    const { cookie, userId } = await loginAs("alice");
    const projectId = await seedProject(userId);

    expect((await send("POST", "", cookie, { projectId, situation: "  " })).status).toBe(400);
  });

  it("POST 他人の projectId → 400 project_not_found", async () => {
    const alice = await loginAs("alice");
    const bob = await loginAs("bob");

    const res = await send("POST", "", alice.cookie, {
      projectId: await seedProject(bob.userId),
      situation: "S",
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toStrictEqual({ error: "project_not_found" });
  });

  it("GET は自分の STAR だけを state 付きで返し、?projectId= で絞り込める", async () => {
    const { cookie, userId } = await loginAs("alice");
    const bob = await loginAs("bob");
    const pa = await seedProject(userId);
    await seedStar(userId, { projectId: pa, situation: "a1" });
    await seedStar(userId, { situation: "b1" });
    await seedStar(bob.userId, { situation: "他人" });

    const all = (await (await send("GET", "", cookie)).json()) as {
      stars: { situation: string; state: string }[];
    };
    expect(all.stars.map((s) => s.situation).sort()).toEqual(["a1", "b1"]);
    expect(all.stars.every((s) => s.state === "unresolved")).toBe(true);

    const filtered = (await (await send("GET", `?projectId=${pa}`, cookie)).json()) as {
      stars: { situation: string }[];
    };
    expect(filtered.stars.map((s) => s.situation)).toEqual(["a1"]);
  });

  it("GET /:id 自分の STAR は 200、他人のは 404", async () => {
    const alice = await loginAs("alice");
    const bob = await loginAs("bob");
    const t = await seedTag(alice.userId, "トラブル");
    const id = await seedStar(alice.userId, { tagIds: [t] });

    const res = await send("GET", `/${id}`, alice.cookie);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { star: { id: string; tagIds: string[]; state: string } };
    expect(json.star).toMatchObject({ id, tagIds: [t], state: "unresolved" });

    const denied = await send("GET", `/${id}`, bob.cookie);
    expect(denied.status).toBe(404);
    expect(await denied.json()).toStrictEqual({ error: "not_found" });
  });

  it("PUT /:id で S/T/A/R と tagIds を置き換え → 200 で id を返す", async () => {
    const { cookie, userId } = await loginAs("alice");
    const id = await seedStar(userId, { tagIds: [await seedTag(userId, "旧")] });
    const newTag = await seedTag(userId, "新");

    const res = await send("PUT", `/${id}`, cookie, {
      situation: "S",
      task: "T",
      action: "A",
      result: "R",
      tagIds: [newTag],
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toStrictEqual({ id });
    const [star] = await db.select().from(stars).where(eq(stars.id, id));
    expect(star).toMatchObject({ situation: "S", task: "T", action: "A", result: "R" });
    const links = await db.select().from(starTags).where(eq(starTags.starId, id));
    expect(links.map((l) => l.tagId)).toEqual([newTag]);
  });

  it("PUT /:id で 4 項目がすべて空 → 400", async () => {
    const { cookie, userId } = await loginAs("alice");
    const id = await seedStar(userId);

    expect((await send("PUT", `/${id}`, cookie, { notes: "ログだけ" })).status).toBe(400);
  });

  it("PUT /:id は他人の STAR だと 404、他人の tagId だと 400 tag_not_found", async () => {
    const alice = await loginAs("alice");
    const bob = await loginAs("bob");
    const id = await seedStar(alice.userId);

    const notFound = await send("PUT", `/${id}`, bob.cookie, { situation: "乗っ取り" });
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toStrictEqual({ error: "not_found" });

    const foreignTag = await seedTag(bob.userId, "他人のタグ");
    const badTag = await send("PUT", `/${id}`, alice.cookie, {
      situation: "S",
      tagIds: [foreignTag],
    });
    expect(badTag.status).toBe(400);
    expect(await badTag.json()).toStrictEqual({ error: "tag_not_found" });
  });

  it("DELETE /:id 自分の STAR は 204、他人のは 404 で消えない", async () => {
    const alice = await loginAs("alice");
    const bob = await loginAs("bob");
    const mine = await seedStar(alice.userId);
    const theirs = await seedStar(bob.userId);

    expect((await send("DELETE", `/${mine}`, alice.cookie)).status).toBe(204);
    expect((await send("DELETE", `/${theirs}`, alice.cookie)).status).toBe(404);
    expect((await db.select().from(stars)).map((s) => s.id)).toEqual([theirs]);
  });
});
