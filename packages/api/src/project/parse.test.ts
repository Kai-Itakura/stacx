import { describe, expect, it } from "vitest";
import { parseCreateInput, parseUpdateInput } from "./parse";

describe("parseCreateInput", () => {
  const valid = { name: "案件A", startDate: "2024-01-01" };

  it("name と startDate が揃えば ok（Date に変換される）", () => {
    const r = parseCreateInput(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("案件A");
      expect(r.value.startDate).toEqual(new Date("2024-01-01"));
      expect(r.value.endDate).toBeNull();
    }
  });

  it("body がオブジェクトでなければ error", () => {
    expect(parseCreateInput(null).ok).toBe(false);
    expect(parseCreateInput("x").ok).toBe(false);
  });

  it("name 欠落・空白のみは error", () => {
    expect(parseCreateInput({ startDate: "2024-01-01" }).ok).toBe(false);
    expect(parseCreateInput({ ...valid, name: "   " }).ok).toBe(false);
  });

  it("startDate 欠落・不正日付は error", () => {
    expect(parseCreateInput({ name: "A" }).ok).toBe(false);
    expect(parseCreateInput({ name: "A", startDate: "not-a-date" }).ok).toBe(false);
  });

  it("endDate 指定時は Date に変換、不正なら error", () => {
    const r = parseCreateInput({ ...valid, endDate: "2024-12-31" });
    expect(r.ok && r.value.endDate).toEqual(new Date("2024-12-31"));
    expect(parseCreateInput({ ...valid, endDate: "bad" }).ok).toBe(false);
  });

  it("teamSize は数値以外なら error", () => {
    expect(parseCreateInput({ ...valid, teamSize: "5" }).ok).toBe(false);
    expect(parseCreateInput({ ...valid, teamSize: 5 }).ok).toBe(true);
  });
});

describe("parseUpdateInput", () => {
  it("指定したフィールドだけを含む（部分更新）", () => {
    const r = parseUpdateInput({ name: "改名" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ name: "改名" });
      expect("startDate" in r.value).toBe(false);
    }
  });

  it("空オブジェクトは ok（変更なし）", () => {
    const r = parseUpdateInput({});
    expect(r.ok && Object.keys(r.value)).toEqual([]);
  });

  it("present な name が空・date が不正なら error", () => {
    expect(parseUpdateInput({ name: "" }).ok).toBe(false);
    expect(parseUpdateInput({ startDate: "bad" }).ok).toBe(false);
  });

  it("endDate は null で進行中に戻せ、不正値は error", () => {
    const r = parseUpdateInput({ endDate: null });
    expect(r.ok && "endDate" in r.value && r.value.endDate).toBeNull();
    expect(
      (parseUpdateInput({ endDate: "2024-12-31" }) as { value: { endDate: Date } }).value.endDate,
    ).toEqual(new Date("2024-12-31"));
    expect(parseUpdateInput({ endDate: "bad" }).ok).toBe(false);
  });

  it("teamSize は null 可・数値以外は error", () => {
    const r = parseUpdateInput({ teamSize: null });
    expect(r.ok && r.value.teamSize).toBeNull();
    expect(parseUpdateInput({ teamSize: 3 }).ok).toBe(true);
    expect(parseUpdateInput({ teamSize: "3" }).ok).toBe(false);
  });

  it("summary/role/workStyle は文字列を通し、型違いは error", () => {
    const r = parseUpdateInput({ summary: "概要", role: "リード", workStyle: "受託" });
    expect(r.ok && r.value).toEqual({ summary: "概要", role: "リード", workStyle: "受託" });
    expect(parseUpdateInput({ role: 123 }).ok).toBe(false);
  });
});
