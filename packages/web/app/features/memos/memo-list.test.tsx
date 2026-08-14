import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { MemoList, type MemoListItem } from "./memo-list";

/** プロジェクトバッジが Link を含むため、router 内で描画する。 */
function renderList(memos: MemoListItem[]) {
  const Stub = createRoutesStub([{ path: "/memos", Component: () => <MemoList memos={memos} /> }]);
  render(<Stub initialEntries={["/memos"]} />);
}

const base: MemoListItem = {
  id: "m1",
  title: "LCP を改善",
  body: "クエリ最適化と Redis 導入で p99 を 280ms に",
  createdAt: "2026-07-20T09:00:00.000Z",
  projectId: "p1",
  projectName: "進行中PJ",
  tagNames: ["技術チャレンジ"],
  starStatus: "none",
};

describe("MemoList", () => {
  it("空なら作成導線を出す", () => {
    renderList([]);
    expect(screen.getByText("まだメモがありません。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "最初のメモを書く" })).toHaveAttribute("href", "/");
  });

  it("タイトル・本文・プロジェクト名・タグ・作成日を表示する", () => {
    renderList([base]);
    expect(screen.getByText("LCP を改善")).toBeInTheDocument();
    expect(screen.getByText(/クエリ最適化/)).toBeInTheDocument();
    expect(screen.getByText("進行中PJ")).toBeInTheDocument();
    expect(screen.getByText("技術チャレンジ")).toBeInTheDocument();
    expect(screen.getByText("2026-07-20")).toBeInTheDocument();
  });

  it("渡された順（=loader が降順整形）でそのまま並べる", () => {
    const memos: MemoListItem[] = [
      { ...base, id: "m2", title: "新しいメモ" },
      { ...base, id: "m1", title: "古いメモ" },
    ];
    renderList(memos);
    // タグ名で引くとカード内の要素構成に依存して壊れるため、本文から順序だけを見る
    const order = screen
      .getAllByRole("listitem")
      .map((li) => (li.textContent?.includes("新しいメモ") ? "新しいメモ" : "古いメモ"));
    expect(order).toEqual(["新しいメモ", "古いメモ"]);
  });

  it("タグが無ければタグ chip は出さず、プロジェクト名だけ出す", () => {
    renderList([{ ...base, tagNames: [] }]);
    expect(screen.getByText("進行中PJ")).toBeInTheDocument();
    expect(screen.queryByText("技術チャレンジ")).not.toBeInTheDocument();
  });

  it("未着手なら「STAR化する」リンクのみ（バッジ無し）", () => {
    renderList([{ ...base, starStatus: "none" }]);
    expect(screen.getByRole("link", { name: "STAR化する" })).toHaveAttribute(
      "href",
      "/memos/m1/star",
    );
    expect(screen.queryByText("下書き")).not.toBeInTheDocument();
    expect(screen.queryByText("完成")).not.toBeInTheDocument();
  });

  it("下書きなら「下書き」バッジと「下書きを続ける」リンク", () => {
    renderList([{ ...base, starStatus: "draft" }]);
    expect(screen.getByText("下書き")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下書きを続ける" })).toHaveAttribute(
      "href",
      "/memos/m1/star",
    );
  });

  it("完成なら「完成」バッジと「STARを編集」リンク", () => {
    renderList([{ ...base, starStatus: "complete" }]);
    expect(screen.getByText("完成")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "STARを編集" })).toHaveAttribute(
      "href",
      "/memos/m1/star",
    );
  });
});
