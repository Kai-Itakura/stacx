import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import Home, { deriveTitle } from "~/routes/home";

const TEXTAREA = /1 分でメモ/;

type LoaderData = {
  user: { name: string | null; email: string | null };
  projects: { id: string; name: string; endDate: string | null }[];
  tags: { id: string; name: string }[];
};

const baseLoader: LoaderData = {
  user: { name: "Kai", email: "k@example.com" },
  projects: [
    { id: "p1", name: "終わったやつ", endDate: "2024-01-01T00:00:00.000Z" },
    { id: "p2", name: "進行中プロジェクト", endDate: null },
  ],
  tags: [
    { id: "t1", name: "技術チャレンジ" },
    { id: "t2", name: "チーム改善" },
  ],
};

/** action に届いた FormData を記録するスタブ。tagIds は複数値なので getAll で拾う。 */
function captureAction() {
  const calls: Record<string, unknown>[] = [];
  const fn = async ({ request }: { request: Request }) => {
    const fd = await request.formData();
    const intent = (fd.get("intent") as string | null) ?? "createMemo";
    if (intent === "createTag") return { ok: true, intent: "createTag", tagId: "t-new" };
    const entry: Record<string, unknown> = Object.fromEntries(fd);
    entry.intent = intent;
    entry.tagIds = fd.getAll("tagIds");
    calls.push(entry);
    return { ok: true, intent };
  };
  return { fn, calls };
}

type StubAction = Parameters<typeof createRoutesStub>[0][number]["action"];

function renderHome(opts?: { loaderData?: Partial<LoaderData>; action?: StubAction }) {
  const Stub = createRoutesStub([
    {
      path: "/",
      // biome-ignore lint/suspicious/noExplicitAny: stub の Component 型はゆるく、実 route の型と差異がある
      Component: Home as any,
      loader: () => ({ ...baseLoader, ...opts?.loaderData }),
      action: opts?.action ?? (() => ({ ok: true, intent: "createMemo" })),
    },
  ]);
  render(<Stub initialEntries={["/"]} />);
}

describe("deriveTitle", () => {
  it("本文の最初の非空行を返す", () => {
    expect(deriveTitle("  \n\n  LCP を改善\n詳細...")).toBe("LCP を改善");
  });

  it("100 文字超は末尾を … で短縮する", () => {
    const title = deriveTitle("あ".repeat(150));
    expect(title.endsWith("…")).toBe(true);
    expect([...title]).toHaveLength(101);
  });

  it("非空行が無ければ空文字", () => {
    expect(deriveTitle("   \n  ")).toBe("");
  });
});

describe("クイック・インテーク画面", () => {
  it("本文テキストエリアにオートフォーカスする", async () => {
    renderHome();
    expect(await screen.findByPlaceholderText(TEXTAREA)).toHaveFocus();
  });

  it("進行中（endDate=null）のプロジェクトを既定選択する", async () => {
    renderHome();
    expect(await screen.findByRole("combobox")).toHaveValue("p2");
  });

  it("Cmd+Enter で本文と選択中プロジェクトを送信する", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureAction();
    renderHome({ action: fn });

    const textarea = await screen.findByPlaceholderText(TEXTAREA);
    await user.type(textarea, "1行目\n2行目");
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ body: "1行目\n2行目", projectId: "p2" });
  });

  it("タグ chip を選ぶと tagIds に含めて送信する", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureAction();
    renderHome({ action: fn });

    const textarea = await screen.findByPlaceholderText(TEXTAREA);
    await user.type(textarea, "本文");
    await user.click(screen.getByRole("button", { name: "技術チャレンジ" }));
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].tagIds).toEqual(["t1"]);
  });

  it("新規タグを作成すると自動選択され、送信に含まれる", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureAction();
    renderHome({ action: fn });

    const textarea = await screen.findByPlaceholderText(TEXTAREA);
    await user.type(textarea, "本文");
    await user.type(screen.getByPlaceholderText("新規タグを追加"), "新タグ");
    await user.click(screen.getByRole("button", { name: "追加" }));

    // 作成成功で入力欄がクリアされる。
    await waitFor(() => expect(screen.getByPlaceholderText("新規タグを追加")).toHaveValue(""));

    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].tagIds).toContain("t-new");
  });

  it("メモ保存失敗時にエラーを表示する", async () => {
    const user = userEvent.setup();
    renderHome({
      action: () => ({ ok: false, intent: "createMemo", error: "メモの保存に失敗しました" }),
    });

    const textarea = await screen.findByPlaceholderText(TEXTAREA);
    await user.type(textarea, "本文");
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    expect(await screen.findByText("メモの保存に失敗しました")).toBeInTheDocument();
  });

  it("プロジェクト 0 件なら作成フォームを出し、createProject を送る", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureAction();
    renderHome({ loaderData: { projects: [] }, action: fn });

    expect(await screen.findByText("まずはプロジェクトを作成")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("プロジェクト名"), "新規PJ");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ intent: "createProject", name: "新規PJ" });
  });
});
