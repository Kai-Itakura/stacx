import { describe, expect, it } from "vitest";
import { createStarSchema, updateStarSchema } from "./request-schema";

describe("createStarSchema", () => {
  const valid = { projectId: "p1", situation: "本番障害が発生" };

  it("projectId と 1 項目で成功。tagIds 未指定は空配列に正規化", () => {
    const r = createStarSchema.safeParse(valid);
    expect(r.success && r.data.tagIds).toEqual([]);
  });

  it("4 項目がすべて空なら失敗（notes だけでは作れない）", () => {
    expect(createStarSchema.safeParse({ projectId: "p1" }).success).toBe(false);
    expect(
      createStarSchema.safeParse({ projectId: "p1", situation: "  ", notes: "調査中" }).success,
    ).toBe(false);
  });

  it("projectId の欠落・空文字は失敗", () => {
    expect(createStarSchema.safeParse({ situation: "S" }).success).toBe(false);
    expect(createStarSchema.safeParse({ ...valid, projectId: "" }).success).toBe(false);
  });

  it("tagIds に空文字が混じると失敗", () => {
    expect(createStarSchema.safeParse({ ...valid, tagIds: [""] }).success).toBe(false);
  });
});

describe("updateStarSchema", () => {
  it("1 項目で成功。tagIds / notes は未指定のまま（変更しない）", () => {
    const r = updateStarSchema.safeParse({ result: "p99 を 280ms に改善" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tagIds).toBeUndefined();
      expect(r.data.notes).toBeUndefined();
    }
  });

  it("4 項目がすべて空なら失敗", () => {
    expect(updateStarSchema.safeParse({}).success).toBe(false);
    expect(updateStarSchema.safeParse({ tagIds: [], notes: "ログ" }).success).toBe(false);
  });

  it("tagIds は空配列で全外しを表せる", () => {
    const r = updateStarSchema.safeParse({ situation: "S", tagIds: [] });
    expect(r.success && r.data.tagIds).toEqual([]);
  });

  it("projectId は受け付けず落とす（STAR は Project を移らない）", () => {
    const r = updateStarSchema.safeParse({ situation: "S", projectId: "p2" });
    expect(r.success && "projectId" in r.data).toBe(false);
  });
});
