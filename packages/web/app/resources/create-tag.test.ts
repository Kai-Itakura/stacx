import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "~/lib/api.server";
import { action } from "./create-tag";

vi.mock("~/lib/auth.server", () => ({ requireUser: vi.fn() }));
vi.mock("~/lib/api.server", () => ({ apiClient: vi.fn() }));

const req = (body: unknown) =>
  new Request("http://localhost/resources/tags/create", {
    method: "post",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/** apiClient().api.tags.$post が返す Response を差し替える。 */
function mockPost(res: { ok: boolean; status: number; json?: () => Promise<unknown> }) {
  const $post = vi.fn().mockResolvedValue(res);
  vi.mocked(apiClient).mockReturnValue({ api: { tags: { $post } } } as unknown as ReturnType<
    typeof apiClient
  >);
  return $post;
}

const call = (body: unknown) => action({ request: req(body) } as Parameters<typeof action>[0]);

describe("create-tag action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("zod 検証に失敗したら API を叩かずエラーを返す", async () => {
    const $post = mockPost({ ok: true, status: 201 });
    const result = await call({ name: "" });
    expect(result.ok).toBe(false);
    expect($post).not.toHaveBeenCalled();
  });

  it("API が 409 なら重複エラーの文言を返す", async () => {
    mockPost({ ok: false, status: 409 });
    const result = await call({ name: "重複タグ" });
    expect(result).toEqual({ ok: false, error: "同名のタグが既にあります" });
  });

  it("API がその他の失敗なら汎用エラーの文言を返す", async () => {
    mockPost({ ok: false, status: 500 });
    const result = await call({ name: "タグ" });
    expect(result).toEqual({ ok: false, error: "タグの作成に失敗しました" });
  });

  it("成功したら作成したタグ id を返す", async () => {
    mockPost({ ok: true, status: 201, json: async () => ({ id: "t-new" }) });
    const result = await call({ name: "新規タグ" });
    expect(result).toEqual({ ok: true, tagId: "t-new" });
  });
});
