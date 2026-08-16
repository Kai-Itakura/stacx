import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import EditMemo from "~/routes/memos.$id.edit";

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
