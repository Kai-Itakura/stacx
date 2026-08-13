import { describe, expect, it } from "vitest";
import { starFormSchema, toStarPayload } from "./star-schema";

describe("starFormSchema(draft)", () => {
  const schema = starFormSchema("draft");

  it("1 項目でも非空なら成功", () => {
    expect(schema.safeParse({ situation: "本番障害" }).success).toBe(true);
  });

  it("全項目が空・空白のみ・未指定は失敗", () => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ situation: "", task: "", action: "", result: "" }).success).toBe(
      false,
    );
    expect(schema.safeParse({ result: "   " }).success).toBe(false);
  });
});

describe("starFormSchema(complete)", () => {
  const schema = starFormSchema("complete");

  it("S/T/A/R 全項目が非空なら成功", () => {
    expect(schema.safeParse({ situation: "S", task: "T", action: "A", result: "R" }).success).toBe(
      true,
    );
  });

  it("1 項目でも欠ければ失敗", () => {
    expect(schema.safeParse({ situation: "S", task: "T", action: "A" }).success).toBe(false);
  });
});

describe("toStarPayload", () => {
  it("未指定項目を空文字に正規化し status を載せる", () => {
    expect(toStarPayload({ situation: "S" }, "draft")).toEqual({
      situation: "S",
      task: "",
      action: "",
      result: "",
      status: "draft",
    });
  });
});
