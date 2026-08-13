import { describe, expect, it } from "vitest";
import { upsertStarSchema } from "./request-schema";

describe("upsertStarSchema", () => {
  it("1 項目でも非空なら成功", () => {
    expect(upsertStarSchema.safeParse({ situation: "本番障害が発生" }).success).toBe(true);
    expect(upsertStarSchema.safeParse({ result: "p99 を 280ms に改善" }).success).toBe(true);
  });

  it("全項目が未指定・空・空白のみは失敗", () => {
    expect(upsertStarSchema.safeParse({}).success).toBe(false);
    expect(
      upsertStarSchema.safeParse({ situation: "", task: "", action: "", result: "" }).success,
    ).toBe(false);
    expect(upsertStarSchema.safeParse({ situation: "   " }).success).toBe(false);
  });

  it("文字列以外は失敗", () => {
    expect(upsertStarSchema.safeParse({ situation: 1 }).success).toBe(false);
  });
});
