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

  it("status 未指定は draft に既定化される", () => {
    const r = upsertStarSchema.safeParse({ situation: "S" });
    expect(r.success && r.data.status).toBe("draft");
  });

  it("complete は S/T/A/R 全項目が非空でなければ失敗", () => {
    const full = { situation: "S", task: "T", action: "A", result: "R" };
    expect(upsertStarSchema.safeParse({ ...full, status: "complete" }).success).toBe(true);
    // task が欠けると complete では失敗するが、draft なら通る
    const partial = { situation: "S", action: "A", result: "R" };
    expect(upsertStarSchema.safeParse({ ...partial, status: "complete" }).success).toBe(false);
    expect(upsertStarSchema.safeParse({ ...partial, status: "draft" }).success).toBe(true);
  });
});
