import { describe, expect, it } from "vitest";
import { createMemoSchema, updateMemoSchema } from "./request-schema";

describe("createMemoSchema", () => {
  const valid = { projectId: "p1", body: "本文" };

  it("projectId/body が揃えば成功。tagIds 未指定は空配列に正規化", () => {
    const r = createMemoSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.body).toBe("本文");
      expect(r.data.tagIds).toEqual([]);
    }
  });

  it("tagIds 指定はそのまま通す", () => {
    const r = createMemoSchema.safeParse({ ...valid, tagIds: ["t1", "t2"] });
    expect(r.success && r.data.tagIds).toEqual(["t1", "t2"]);
  });

  it("projectId / body の欠落・空白は失敗", () => {
    expect(createMemoSchema.safeParse({ body: "b" }).success).toBe(false);
    expect(createMemoSchema.safeParse({ ...valid, body: "   " }).success).toBe(false);
    expect(createMemoSchema.safeParse({ ...valid, body: "" }).success).toBe(false);
  });

  it("tagIds に空文字や非文字列が混じると失敗", () => {
    expect(createMemoSchema.safeParse({ ...valid, tagIds: [""] }).success).toBe(false);
    expect(createMemoSchema.safeParse({ ...valid, tagIds: [123] }).success).toBe(false);
  });

  it("body がオブジェクトでなければ失敗", () => {
    expect(createMemoSchema.safeParse(null).success).toBe(false);
  });
});

describe("updateMemoSchema", () => {
  it("指定したフィールドだけを含む（部分更新）。projectId も更新できる", () => {
    const r = updateMemoSchema.safeParse({ body: "改稿", projectId: "p2" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({ body: "改稿", projectId: "p2" });
    }
  });

  it("空オブジェクトは失敗（最低 1 フィールド必須）", () => {
    expect(updateMemoSchema.safeParse({}).success).toBe(false);
  });

  it("tagIds は空配列で全外しを表せる", () => {
    const r = updateMemoSchema.safeParse({ tagIds: [] });
    expect(r.success && r.data.tagIds).toEqual([]);
  });

  it("present な body が空・tagIds や projectId に空文字なら失敗", () => {
    expect(updateMemoSchema.safeParse({ body: "" }).success).toBe(false);
    expect(updateMemoSchema.safeParse({ tagIds: [""] }).success).toBe(false);
    expect(updateMemoSchema.safeParse({ projectId: "" }).success).toBe(false);
  });
});
