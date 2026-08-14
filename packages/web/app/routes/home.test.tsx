import "@testing-library/jest-dom/vitest";
import { parseWithZod } from "@conform-to/zod/v4";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { memoFormSchema, projectFormSchema } from "~/features/intake/schema";
import Home from "~/routes/home";

const TEXTAREA = /1 分でメモ/;

type LoaderData = {
  user: { name: string | null; email: string | null };
  projects: { id: string; name: string; endDate: string | null }[];
  tags: { id: string; name: string }[];
  recent: { id: string; body: string; createdAt: string }[];
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
  recent: [],
};

/** action に届いた FormData を記録するスタブ。実 schema で検証し SubmissionResult を返す。 */
function captureAction(schema: typeof memoFormSchema | typeof projectFormSchema) {
  const calls: Record<string, unknown>[] = [];
  const fn = async ({ request }: { request: Request }) => {
    const fd = await request.formData();
    const submission = parseWithZod(fd, { schema });
    if (submission.status !== "success") return submission.reply();
    calls.push({ ...Object.fromEntries(fd), tagIds: fd.getAll("tagIds") });
    return submission.reply({ resetForm: true });
  };
  return { fn, calls };
}

/** タグ作成 action のスタブ。届いた JSON を記録し、新規タグ id を返す。 */
function captureTagAction() {
  const calls: unknown[] = [];
  const fn = async ({ request }: { request: Request }) => {
    calls.push(await request.json());
    return { ok: true, tagId: "t-new" };
  };
  return { fn, calls };
}

type StubAction = Parameters<typeof createRoutesStub>[0][number]["action"];

/** 画面ルート（/）に加え、各フォームの送信先となる resource route 3 つを stub する。 */
function renderHome(opts?: {
  loaderData?: Partial<LoaderData>;
  memoAction?: StubAction;
  projectAction?: StubAction;
  tagAction?: StubAction;
}) {
  const Stub = createRoutesStub([
    {
      path: "/",
      // biome-ignore lint/suspicious/noExplicitAny: stub の Component 型はゆるく、実 route の型と差異がある
      Component: Home as any,
      loader: () => ({ ...baseLoader, ...opts?.loaderData }),
      HydrateFallback: () => null,
    },
    {
      path: "/resources/memos/create",
      action: opts?.memoAction ?? (() => ({ ok: true })),
    },
    {
      path: "/resources/projects/create",
      action: opts?.projectAction ?? (() => ({ ok: true })),
    },
    {
      path: "/resources/tags/create",
      action: opts?.tagAction ?? (() => ({ ok: true, tagId: "t-new" })),
    },
  ]);
  render(<Stub initialEntries={["/"]} />);
}

describe("クイック・インテーク画面", () => {
  it("本文テキストエリアにオートフォーカスする", async () => {
    renderHome();
    expect(await screen.findByPlaceholderText(TEXTAREA)).toHaveFocus();
  });

  it("進行中（endDate=null）のプロジェクトを既定選択する", async () => {
    renderHome();
    expect(await screen.findByText("進行中プロジェクト")).toBeInTheDocument();
  });

  it("プロジェクトチップから別のプロジェクトへ切り替えられる", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureAction(memoFormSchema);
    renderHome({ memoAction: fn });

    await user.click(await screen.findByRole("button", { name: /進行中プロジェクト/ }));
    await user.click(await screen.findByRole("menuitem", { name: /終わったやつ/ }));

    const textarea = screen.getByPlaceholderText(TEXTAREA);
    await user.type(textarea, "本文");
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].projectId).toBe("p1");
  });

  it("Cmd+Enter で本文と選択中プロジェクトを送信する", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureAction(memoFormSchema);
    renderHome({ memoAction: fn });

    const textarea = await screen.findByPlaceholderText(TEXTAREA);
    await user.type(textarea, "1行目\n2行目");
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ body: "1行目\n2行目", projectId: "p2" });
  });

  it("本文が空なら検証エラーを出して送信しない", async () => {
    const { fn, calls } = captureAction(memoFormSchema);
    renderHome({ memoAction: fn });

    const textarea = await screen.findByPlaceholderText(TEXTAREA);
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    expect(await screen.findByText("本文を入力してください")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("タグを選ぶとチップに出て tagIds に含めて送信する", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureAction(memoFormSchema);
    renderHome({ memoAction: fn });

    await user.click(await screen.findByRole("button", { name: "タグを追加" }));
    await user.click(await screen.findByRole("menuitem", { name: "技術チャレンジ" }));
    expect(screen.getByRole("button", { name: "技術チャレンジ を外す" })).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(TEXTAREA);
    await user.type(textarea, "本文");
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].tagIds).toEqual(["t1"]);
  });

  it("保存のたびにタグ選択がリセットされる（2 回目以降も）", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureAction(memoFormSchema);
    renderHome({ memoAction: fn });

    const selectTagAndSave = async (body: string) => {
      await user.click(await screen.findByRole("button", { name: "タグを追加" }));
      await user.click(await screen.findByRole("menuitem", { name: "技術チャレンジ" }));
      const textarea = screen.getByPlaceholderText(TEXTAREA);
      await user.type(textarea, body);
      fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    };

    await selectTagAndSave("1 本目");
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "技術チャレンジ を外す" }),
      ).not.toBeInTheDocument(),
    );

    await selectTagAndSave("2 本目");
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "技術チャレンジ を外す" }),
      ).not.toBeInTheDocument(),
    );

    expect(calls).toHaveLength(2);
    expect(calls[1].tagIds).toEqual(["t1"]);
  });

  it("チップの × でタグを外せる", async () => {
    const user = userEvent.setup();
    renderHome({});

    await user.click(await screen.findByRole("button", { name: "タグを追加" }));
    await user.click(await screen.findByRole("menuitem", { name: "技術チャレンジ" }));
    await user.click(screen.getByRole("button", { name: "技術チャレンジ を外す" }));

    expect(screen.queryByRole("button", { name: "技術チャレンジ を外す" })).not.toBeInTheDocument();
  });

  it("保存すると直近メモに積まれる（保存できた合図になる）", async () => {
    const user = userEvent.setup();
    // loader 再検証で新しいメモが降ってくる状況を再現する。
    const stored: { id: string; body: string; createdAt: string }[] = [];
    const Stub = createRoutesStub([
      {
        path: "/",
        // biome-ignore lint/suspicious/noExplicitAny: stub の Component 型は実 route と差異がある
        Component: Home as any,
        loader: () => ({ ...baseLoader, recent: [...stored] }),
        HydrateFallback: () => null,
      },
      {
        path: "/resources/memos/create",
        action: async ({ request }: { request: Request }) => {
          const fd = await request.formData();
          stored.unshift({
            id: `m${stored.length + 1}`,
            body: String(fd.get("body")),
            createdAt: new Date().toISOString(),
          });
          return { status: "success" };
        },
      },
      { path: "/resources/tags/create", action: () => ({ ok: true, tagId: "t-new" }) },
    ]);
    render(<Stub initialEntries={["/"]} />);

    expect(await screen.findByText(/まだメモがありません/)).toBeInTheDocument();

    const textarea = await screen.findByPlaceholderText(TEXTAREA);
    await user.type(textarea, "保存したメモ");
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    expect(await screen.findByRole("link", { name: /保存したメモ/ })).toBeInTheDocument();
  });

  it("選択中のタグはタグ色で塗って表示する", async () => {
    const user = userEvent.setup();
    renderHome({});

    await user.click(await screen.findByRole("button", { name: "タグを追加" }));
    await user.click(await screen.findByRole("menuitem", { name: "技術チャレンジ" }));

    const chip = screen.getByRole("button", { name: "技術チャレンジ を外す" }).parentElement;
    expect(chip?.className).toMatch(/bg-tag-\d/);
    expect(chip?.className).toContain("text-background");
  });

  it("新規タグを作成すると自動選択され、送信に含まれる", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureAction(memoFormSchema);
    renderHome({ memoAction: fn });

    const textarea = await screen.findByPlaceholderText(TEXTAREA);
    await user.type(textarea, "本文");
    await user.click(screen.getByRole("button", { name: "タグを追加" }));
    await user.type(await screen.findByPlaceholderText("新規タグを追加"), "新タグ{Enter}");

    await waitFor(() => expect(screen.getByPlaceholderText("新規タグを追加")).toHaveValue(""));

    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].tagIds).toContain("t-new");
  });

  it("タグ名が空で追加すると検証エラーを出し、作成リクエストを送らない", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureTagAction();
    renderHome({ tagAction: fn });

    await user.click(await screen.findByRole("button", { name: "タグを追加" }));
    await user.type(await screen.findByPlaceholderText("新規タグを追加"), "{Enter}");

    expect(await screen.findByText("タグ名を入力してください")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it("メモ保存失敗時にフォームエラーを表示する", async () => {
    const user = userEvent.setup();
    renderHome({
      memoAction: async ({ request }) => {
        const submission = parseWithZod(await request.formData(), { schema: memoFormSchema });
        if (submission.status !== "success") return submission.reply();
        return submission.reply({ formErrors: ["メモの保存に失敗しました"] });
      },
    });

    const textarea = await screen.findByPlaceholderText(TEXTAREA);
    await user.type(textarea, "本文");
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    expect(await screen.findByText("メモの保存に失敗しました")).toBeInTheDocument();
  });

  it("プロジェクト 0 件なら作成フォームを出し、プロジェクト作成を送る", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureAction(projectFormSchema);
    renderHome({ loaderData: { projects: [] }, projectAction: fn });

    expect(await screen.findByText("まずはプロジェクトを作成")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("プロジェクト名"), "新規PJ");
    await user.click(screen.getByRole("button", { name: "作成" }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ name: "新規PJ" });
  });

  it("プロジェクト名が空なら検証エラーを出して送信しない", async () => {
    const user = userEvent.setup();
    const { fn, calls } = captureAction(projectFormSchema);
    renderHome({ loaderData: { projects: [] }, projectAction: fn });

    await user.click(await screen.findByRole("button", { name: "作成" }));

    expect(await screen.findByText("プロジェクト名を入力してください")).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
