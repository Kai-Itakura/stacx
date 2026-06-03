import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const BASE = "https://example.com";

describe("routes", () => {
  it("GET /api/health → 200", async () => {
    const res = await SELF.fetch(`${BASE}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("GET /api/me 未認証 → 401", async () => {
    const res = await SELF.fetch(`${BASE}/api/me`);
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/login/google → 302 で Google へ、一時 Cookie を発行", async () => {
    const res = await SELF.fetch(`${BASE}/api/auth/login/google`, { redirect: "manual" });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("accounts.google.com");

    // getSetCookie は実行時に存在するが workers-types の Headers 型に未定義のためキャスト。
    const cookies = (res.headers as Headers & { getSetCookie(): string[] }).getSetCookie();
    expect(cookies.some((c) => c.startsWith("oauth_state="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("oauth_code_verifier="))).toBe(true);
    // oauth_provider は持たない（provider はパス由来）。
    expect(cookies.some((c) => c.startsWith("oauth_provider="))).toBe(false);
  });

  it("GET /api/auth/login/unknown → 404", async () => {
    const res = await SELF.fetch(`${BASE}/api/auth/login/unknown`, { redirect: "manual" });
    expect(res.status).toBe(404);
  });
});
