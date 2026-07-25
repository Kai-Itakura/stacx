import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoList, type MemoListItem } from "./memo-list";

const base: MemoListItem = {
  id: "m1",
  title: "LCP を改善",
  body: "クエリ最適化と Redis 導入で p99 を 280ms に",
  createdAt: "2026-07-20T09:00:00.000Z",
  projectName: "進行中PJ",
  tagNames: ["技術チャレンジ"],
};

describe("MemoList", () => {
  it("空なら作成導線を出す", () => {
    render(<MemoList memos={[]} />);
    expect(screen.getByText("まだメモがありません。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "最初のメモを書く" })).toHaveAttribute("href", "/");
  });

  it("タイトル・本文・プロジェクト名・タグ・作成日を表示する", () => {
    render(<MemoList memos={[base]} />);
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
    render(<MemoList memos={memos} />);
    const titles = screen
      .getAllByRole("listitem")
      .map((li) => li.querySelector("span")?.textContent);
    expect(titles).toEqual(["新しいメモ", "古いメモ"]);
  });

  it("タグが無ければタグ chip は出さず、プロジェクト名だけ出す", () => {
    render(<MemoList memos={[{ ...base, tagNames: [] }]} />);
    expect(screen.getByText("進行中PJ")).toBeInTheDocument();
    expect(screen.queryByText("技術チャレンジ")).not.toBeInTheDocument();
  });
});
