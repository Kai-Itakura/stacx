import { describe, expect, it } from "vitest";
import { memoExcerpt } from "./memo-excerpt";

describe("memoExcerpt", () => {
  it("最初の非空行を返す", () => {
    expect(memoExcerpt("本番障害の対応\nクエリ最適化と Redis 導入")).toBe("本番障害の対応");
  });

  it("先頭の空行や空白は飛ばす", () => {
    expect(memoExcerpt("\n  \n  学びメモ  \n続き")).toBe("学びメモ");
  });

  it("空本文は空文字", () => {
    expect(memoExcerpt("")).toBe("");
    expect(memoExcerpt("   \n  ")).toBe("");
  });

  it("長い行は 100 文字で切って省略記号を付ける", () => {
    const excerpt = memoExcerpt("あ".repeat(150));
    expect(excerpt).toHaveLength(101);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});
