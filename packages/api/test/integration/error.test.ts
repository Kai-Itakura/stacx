import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it, vi } from "vitest";
import { onError } from "../../src/error";

/** onError を登録し、/boom で渡した値を throw するだけの最小アプリ。 */
const appThatThrows = (thrown: unknown) =>
  new Hono().onError(onError).get("/boom", () => {
    throw thrown;
  });

describe("onError", () => {
  it("未捕捉例外は 500 + { error: 'internal' } JSON を返し、詳細はボディに漏らさない", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = appThatThrows(new Error("DB が爆発した秘密の詳細"));

    const res = await app.request("/boom");

    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: "internal" });
    // 例外の詳細はログには残す（観測のため）
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("HTTPException はその status を尊重する", async () => {
    const app = appThatThrows(new HTTPException(409, { message: "conflict" }));

    const res = await app.request("/boom");

    expect(res.status).toBe(409);
  });
});
