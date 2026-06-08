import { describe, expect, it } from "vitest";
import { createProjectSchema, updateProjectSchema } from "./request-schema";

describe("createProjectSchema", () => {
  const valid = { name: "案件A", startDate: "2024-01-01" };

  it("name と startDate が揃えば成功（Date に変換される）", () => {
    const r = createProjectSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.name).toBe("案件A");
      expect(r.data.startDate).toEqual(new Date("2024-01-01"));
      expect(r.data.endDate).toBeNull();
    }
  });

  it("body がオブジェクトでなければ失敗", () => {
    expect(createProjectSchema.safeParse(null).success).toBe(false);
    expect(createProjectSchema.safeParse("x").success).toBe(false);
  });

  it("name 欠落・空白のみは失敗", () => {
    expect(createProjectSchema.safeParse({ startDate: "2024-01-01" }).success).toBe(false);
    expect(createProjectSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
  });

  it("startDate 欠落・不正日付は失敗", () => {
    expect(createProjectSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: "A", startDate: "not-a-date" }).success).toBe(
      false,
    );
  });

  it("endDate 指定時は Date に変換、不正なら失敗", () => {
    const r = createProjectSchema.safeParse({ ...valid, endDate: "2024-12-31" });
    expect(r.success && r.data.endDate).toEqual(new Date("2024-12-31"));
    expect(createProjectSchema.safeParse({ ...valid, endDate: "bad" }).success).toBe(false);
  });

  it("teamSize は数値以外なら失敗", () => {
    expect(createProjectSchema.safeParse({ ...valid, teamSize: "5" }).success).toBe(false);
    expect(createProjectSchema.safeParse({ ...valid, teamSize: 5 }).success).toBe(true);
  });
});

describe("updateProjectSchema", () => {
  it("指定したフィールドだけを含む（部分更新）", () => {
    const r = updateProjectSchema.safeParse({ name: "改名" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({ name: "改名" });
      expect("startDate" in r.data).toBe(false);
    }
  });

  it("空オブジェクトは成功（変更なし）", () => {
    const r = updateProjectSchema.safeParse({});
    expect(r.success && Object.keys(r.data)).toEqual([]);
  });

  it("present な name が空・date が不正なら失敗", () => {
    expect(updateProjectSchema.safeParse({ name: "" }).success).toBe(false);
    expect(updateProjectSchema.safeParse({ startDate: "bad" }).success).toBe(false);
  });

  it("endDate は null で進行中に戻せ、不正値は失敗", () => {
    const r = updateProjectSchema.safeParse({ endDate: null });
    expect(r.success && "endDate" in r.data && r.data.endDate).toBeNull();
    expect(
      (updateProjectSchema.safeParse({ endDate: "2024-12-31" }) as { data: { endDate: Date } }).data
        .endDate,
    ).toEqual(new Date("2024-12-31"));
    expect(updateProjectSchema.safeParse({ endDate: "bad" }).success).toBe(false);
  });

  it("teamSize は null 可・数値以外は失敗", () => {
    const r = updateProjectSchema.safeParse({ teamSize: null });
    expect(r.success && r.data.teamSize).toBeNull();
    expect(updateProjectSchema.safeParse({ teamSize: 3 }).success).toBe(true);
    expect(updateProjectSchema.safeParse({ teamSize: "3" }).success).toBe(false);
  });

  it("summary/role/workStyle は文字列を通し、型違いは失敗", () => {
    const r = updateProjectSchema.safeParse({ summary: "概要", role: "リード", workStyle: "受託" });
    expect(r.success && r.data).toEqual({ summary: "概要", role: "リード", workStyle: "受託" });
    expect(updateProjectSchema.safeParse({ role: 123 }).success).toBe(false);
  });
});
