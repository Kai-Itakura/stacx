import { describe, expect, it } from "vitest";
import { starFormSchema, toStarPayload } from "./star-schema";

describe("starFormSchema", () => {
  it("1 項目でも非空なら成功", () => {
    expect(starFormSchema.safeParse({ situation: "本番障害" }).success).toBe(true);
  });

  it("全項目が空・空白のみ・未指定は失敗", () => {
    expect(starFormSchema.safeParse({}).success).toBe(false);
    expect(
      starFormSchema.safeParse({ situation: "", task: "", action: "", result: "" }).success,
    ).toBe(false);
    expect(starFormSchema.safeParse({ result: "   " }).success).toBe(false);
  });
});

describe("toStarPayload", () => {
  it("未指定項目を空文字に正規化する", () => {
    expect(toStarPayload({ situation: "S" })).toEqual({
      situation: "S",
      task: "",
      action: "",
      result: "",
    });
  });
});
