import { describe, expect, it } from "vitest";
import { scrollRestorationKey } from "./scroll-restoration";

describe("scrollRestorationKey", () => {
  it("メモ一覧は URL で覚え、詳細から戻る新しい履歴でも位置を戻す", () => {
    expect(scrollRestorationKey({ pathname: "/memos", key: "a1" })).toBe("/memos");
    expect(scrollRestorationKey({ pathname: "/memos", key: "b2" })).toBe("/memos");
  });

  it("それ以外は履歴ごとに覚える（ブラウザ既定と同じ）", () => {
    expect(scrollRestorationKey({ pathname: "/memos/m1/star", key: "a1" })).toBe("a1");
    expect(scrollRestorationKey({ pathname: "/projects", key: "b2" })).toBe("b2");
  });
});
