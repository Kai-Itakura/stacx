import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "~/lib/api.server";
import EditMemo, { action } from "~/routes/memos.$id.edit";

vi.mock("~/lib/auth.server", () => ({ requireUser: vi.fn() }));
vi.mock("~/lib/api.server", () => ({ apiClient: vi.fn() }));

const baseLoader = {
  memo: { body: "本番障害の対応", projectId: "p1", tagIds: [] as string[] },
  projects: [{ id: "p1", name: "工場生産管理システム", endDate: null }],
  tags: [{ id: "t1", name: "技術チャレンジ" }],
};

/** action に届いた intent を記録するスタブ。 */
function captureAction() {
  const intents: (string | null)[] = [];
  const fn = async ({ request }: { request: Request }) => {
    const fd = await request.formData();
    intents.push(fd.get("intent") as string | null);
    return null;
  };
  return { fn, intents };
}

type StubAction = Parameters<typeof createRoutesStub>[0][number]["action"];

function renderEdit(action?: StubAction) {
  const Stub = createRoutesStub([
    {
      path: "/memos/:id/edit",
      // biome-ignore lint/suspicious/noExplicitAny: stub の Component 型は実 route と差異がある
      Component: EditMemo as any,
      loader: () => baseLoader,
      action: action ?? (() => null),
      HydrateFallback: () => null,
    },
  ]);
  render(<Stub initialEntries={["/memos/m1/edit"]} />);
}

afterEach(() => vi.unstubAllGlobals());

describe("メモ編集画面の削除", () => {
  it("確認に同意すると intent=delete を送る", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    const user = userEvent.setup();
    const { fn, intents } = captureAction();
    renderEdit(fn);

    await user.click(await screen.findByRole("button", { name: "メモを削除" }));

    await waitFor(() => expect(intents).toEqual(["delete"]));
  });

  it("確認を取り消すと送信しない", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    const user = userEvent.setup();
    const { fn, intents } = captureAction();
    renderEdit(fn);

    await user.click(await screen.findByRole("button", { name: "メモを削除" }));

    expect(intents).toEqual([]);
  });

  it("確認文で STAR も消えることを伝える", async () => {
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal("confirm", confirmSpy);
    const user = userEvent.setup();
    renderEdit();

    await user.click(await screen.findByRole("button", { name: "メモを削除" }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("STAR"));
  });
});

/** apiClient().api.memos[":id"] の $put / $delete を差し替える。 */
function mockApi(res: { ok: boolean } = { ok: true }) {
  const $put = vi.fn().mockResolvedValue(res);
  const $delete = vi.fn().mockResolvedValue(res);
  vi.mocked(apiClient).mockReturnValue({
    api: { memos: { ":id": { $put, $delete } } },
  } as unknown as ReturnType<typeof apiClient>);
  return { $put, $delete };
}

const call = (fields: [string, string][]) =>
  action({
    request: new Request("http://localhost/memos/m1/edit", {
      method: "post",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    }),
    params: { id: "m1" },
  } as Parameters<typeof action>[0]);

const EDIT: [string, string][] = [
  ["intent", "edit"],
  ["body", "本番障害の対応"],
  ["projectId", "p1"],
];

describe("メモ編集画面の action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("intent=edit なら更新して一覧へ戻る", async () => {
    const { $put, $delete } = mockApi();

    const result = await call([...EDIT, ["tagIds", "t1"], ["tagIds", "t2"]]);

    expect($put).toHaveBeenCalledWith({
      param: { id: "m1" },
      json: { projectId: "p1", body: "本番障害の対応", tagIds: ["t1", "t2"] },
    });
    expect($delete).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("location")).toBe("/memos");
  });

  // tagIds は選択タグ 1 件につき hidden input 1 つで送るため、全解除だとキーごと届かない。
  // API は tagIds が absent だとタグを変更しないので、空配列にしないと最後の 1 件を外せない。
  it("タグを全解除したら空配列を送る", async () => {
    const { $put } = mockApi();

    await call(EDIT);

    expect($put.mock.calls[0]?.[0].json.tagIds).toEqual([]);
  });

  it("intent=delete なら削除して一覧へ戻る", async () => {
    const { $put, $delete } = mockApi();

    const result = await call([["intent", "delete"]]);

    expect($delete).toHaveBeenCalledWith({ param: { id: "m1" } });
    expect($put).not.toHaveBeenCalled();
    expect((result as Response).headers.get("location")).toBe("/memos");
  });

  it("検証に失敗したら API を叩かずエラーを返す", async () => {
    const { $put } = mockApi();

    const result = await call([
      ["intent", "edit"],
      ["body", "   "],
      ["projectId", "p1"],
    ]);

    expect($put).not.toHaveBeenCalled();
    expect(result).toMatchObject({ error: { body: ["本文を入力してください"] } });
  });

  it("判別子が無ければ API を叩かない", async () => {
    const { $put, $delete } = mockApi();

    await call([
      ["body", "本番障害の対応"],
      ["projectId", "p1"],
    ]);

    expect($put).not.toHaveBeenCalled();
    expect($delete).not.toHaveBeenCalled();
  });

  it("更新 API が失敗したらフォーム全体のエラーを返す", async () => {
    mockApi({ ok: false });

    const result = await call(EDIT);

    expect(result).toMatchObject({ error: { "": ["メモの更新に失敗しました。"] } });
  });

  it("削除 API が失敗したらフォーム全体のエラーを返す", async () => {
    mockApi({ ok: false });

    const result = await call([["intent", "delete"]]);

    expect(result).toMatchObject({ error: { "": ["削除に失敗しました。"] } });
  });
});
