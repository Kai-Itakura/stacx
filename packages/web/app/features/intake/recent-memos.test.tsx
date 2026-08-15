import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { type RecentMemo, RecentMemos } from "./recent-memos";

function renderRecent(memos: RecentMemo[]) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <RecentMemos memos={memos} /> }]);
  render(<Stub initialEntries={["/"]} />);
}

const memo = (over: Partial<RecentMemo> = {}): RecentMemo => ({
  id: "m1",
  body: "本番障害の対応\nクエリ最適化と Redis 導入",
  createdAt: "2026-07-20T09:00:00.000Z",
  ...over,
});

describe("RecentMemos", () => {
  it("0 件なら書き始めを促す（枠は崩さない）", async () => {
    renderRecent([]);
    expect(await screen.findByText(/まだメモがありません/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("本文の先頭行を抜粋し、編集画面へリンクする", async () => {
    renderRecent([memo()]);
    const link = await screen.findByRole("link", { name: /本番障害の対応/ });
    expect(link).toHaveAttribute("href", "/memos/m1/edit");
    expect(screen.queryByText(/Redis 導入/)).not.toBeInTheDocument();
  });

  it("渡された順（新しい順）でそのまま並べる", async () => {
    renderRecent([memo({ id: "m2", body: "新しい" }), memo({ id: "m1", body: "古い" })]);
    const items = await screen.findAllByRole("listitem");
    expect(items.map((li) => li.textContent?.includes("新しい"))).toEqual([true, false]);
  });

  it("すべて見るで一覧へ移動できる", async () => {
    renderRecent([memo()]);
    expect(await screen.findByRole("link", { name: "すべて見る" })).toHaveAttribute(
      "href",
      "/memos",
    );
  });

  it("当日は時刻、それ以前は日付を出す", async () => {
    const now = new Date();
    const todayIso = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      14,
      5,
    ).toISOString();
    renderRecent([memo({ id: "today", createdAt: todayIso }), memo({ id: "old" })]);

    expect(await screen.findByText("14:05")).toBeInTheDocument();
    expect(screen.getByText("2026-07-20")).toBeInTheDocument();
  });

  // UTC の日付を切り出すと、JST では日付境界をまたぐメモが 1 日前に見える。
  it("日付はローカルタイムゾーンで判定する", async () => {
    renderRecent([memo({ createdAt: "2026-07-20T22:00:00.000Z" })]);

    expect(await screen.findByText("2026-07-21")).toBeInTheDocument();
  });
});
