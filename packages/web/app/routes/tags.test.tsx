import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "~/lib/api.server";
import { action } from "~/routes/tags";

vi.mock("~/lib/auth.server", () => ({ requireUser: vi.fn() }));
vi.mock("~/lib/api.server", () => ({ apiClient: vi.fn() }));

/** apiClient().api.tags[":id"] の $put / $delete を差し替える。 */
function mockApi(res: { ok: boolean; status?: number } = { ok: true }) {
  const $put = vi.fn().mockResolvedValue(res);
  const $delete = vi.fn().mockResolvedValue(res);
  vi.mocked(apiClient).mockReturnValue({
    api: { tags: { ":id": { $put, $delete } } },
  } as unknown as ReturnType<typeof apiClient>);
  return { $put, $delete };
}

const call = (fields: [string, string][]) =>
  action({
    request: new Request("http://localhost/tags", {
      method: "post",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    }),
    params: {},
  } as Parameters<typeof action>[0]);

const RENAME: [string, string][] = [
  ["intent", "rename"],
  ["id", "t1"],
  ["name", "障害対応"],
];

describe("タグ管理画面の action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("intent=rename なら更新する", async () => {
    const { $put, $delete } = mockApi();

    const result = await call(RENAME);

    expect($put).toHaveBeenCalledWith({ param: { id: "t1" }, json: { name: "障害対応" } });
    expect($delete).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "success" });
  });

  it("intent=delete なら削除する", async () => {
    const { $put, $delete } = mockApi();

    const result = await call([
      ["intent", "delete"],
      ["id", "t1"],
    ]);

    expect($delete).toHaveBeenCalledWith({ param: { id: "t1" } });
    expect($put).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "success" });
  });

  it("検証に失敗したら API を叩かずエラーを返す", async () => {
    const { $put } = mockApi();

    const result = await call([
      ["intent", "rename"],
      ["id", "t1"],
      ["name", "   "],
    ]);

    expect($put).not.toHaveBeenCalled();
    expect(result).toMatchObject({ error: { name: ["タグ名を入力してください"] } });
  });

  it("判別子が無ければ API を叩かない", async () => {
    const { $put, $delete } = mockApi();

    await call([
      ["id", "t1"],
      ["name", "障害対応"],
    ]);

    expect($put).not.toHaveBeenCalled();
    expect($delete).not.toHaveBeenCalled();
  });

  // 名前の重複だけは原因が利用者に分かるため、汎用の失敗文言と区別する。
  it("409 は重複として伝える", async () => {
    mockApi({ ok: false, status: 409 });

    const result = await call(RENAME);

    expect(result).toMatchObject({ error: { "": ["同名のタグが既にあります"] } });
  });

  it("更新 API が失敗したらフォーム全体のエラーを返す", async () => {
    mockApi({ ok: false, status: 500 });

    const result = await call(RENAME);

    expect(result).toMatchObject({ error: { "": ["タグの更新に失敗しました"] } });
  });

  it("削除 API が失敗したらフォーム全体のエラーを返す", async () => {
    mockApi({ ok: false, status: 500 });

    const result = await call([
      ["intent", "delete"],
      ["id", "t1"],
    ]);

    expect(result).toMatchObject({ error: { "": ["タグの削除に失敗しました"] } });
  });
});
