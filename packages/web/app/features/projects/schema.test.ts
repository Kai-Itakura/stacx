import { describe, expect, it } from "vitest";
import { projectFormSchema, toDateInputValue, toProjectPayload } from "./schema";

describe("toDateInputValue", () => {
  it("ISO 文字列を YYYY-MM-DD に切り出す", () => {
    expect(toDateInputValue("2024-01-01T00:00:00.000Z")).toBe("2024-01-01");
  });

  it("null / undefined は空文字", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue(undefined)).toBe("");
  });
});

describe("projectFormSchema", () => {
  const valid = { name: "案件A", startDate: "2024-01-01" };

  it("name と startDate があれば成功（任意項目は省略可）", () => {
    expect(projectFormSchema.safeParse(valid).success).toBe(true);
  });

  it("name 空白のみ・startDate 空は失敗", () => {
    expect(projectFormSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...valid, startDate: "" }).success).toBe(false);
  });

  it("teamSize は正の整数のみ許容する", () => {
    expect(projectFormSchema.safeParse({ ...valid, teamSize: 5 }).success).toBe(true);
    expect(projectFormSchema.safeParse({ ...valid, teamSize: 0 }).success).toBe(false);
    expect(projectFormSchema.safeParse({ ...valid, teamSize: 1.5 }).success).toBe(false);
  });
});

describe("toProjectPayload", () => {
  it("空の任意項目を null に、未指定 techStack を [] に正規化する", () => {
    const payload = toProjectPayload({ name: "A", startDate: "2024-01-01" });
    expect(payload).toEqual({
      name: "A",
      startDate: "2024-01-01",
      endDate: null,
      summary: null,
      teamSize: null,
      role: null,
      techStack: [],
    });
  });

  it("入力された値をそのまま渡す", () => {
    const payload = toProjectPayload({
      name: "A",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      summary: "概要",
      teamSize: 5,
      role: "リード",
      techStack: ["Go", "React"],
    });
    expect(payload).toMatchObject({
      endDate: "2024-12-31",
      summary: "概要",
      teamSize: 5,
      role: "リード",
      techStack: ["Go", "React"],
    });
  });
});
