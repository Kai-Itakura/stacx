import { describe, expect, it } from "vitest";
import { hasAnyField, starState } from "./state";

const cases: Array<[boolean, boolean, boolean, boolean, ReturnType<typeof starState>]> = [
  [true, true, true, true, "complete"],
  [true, false, false, false, "unresolved"],
  [false, true, false, false, "unresolved"],
  [true, true, false, false, "unresolved"],
  [true, false, true, false, "in_progress"],
  [true, false, false, true, "in_progress"],
  [false, true, true, false, "in_progress"],
  [false, true, false, true, "in_progress"],
  [true, true, true, false, "in_progress"],
  [true, true, false, true, "in_progress"],
  [true, false, true, true, "in_progress"],
  [false, true, true, true, "in_progress"],
  [false, false, true, false, "missing_context"],
  [false, false, false, true, "missing_context"],
  [false, false, true, true, "missing_context"],
];

const fill = (on: boolean) => (on ? "書いた" : null);

describe("starState", () => {
  it.each(cases)("S=%s T=%s A=%s R=%s → %s", (s, t, a, r, expected) => {
    expect(starState({ situation: fill(s), task: fill(t), action: fill(a), result: fill(r) })).toBe(
      expected,
    );
  });

  it("空白だけの項目は空として扱う", () => {
    expect(starState({ situation: "S", task: "  ", action: "\n", result: null })).toBe(
      "unresolved",
    );
  });
});

describe("hasAnyField", () => {
  it("1 項目でも書かれていれば true", () => {
    expect(hasAnyField({ result: "R" })).toBe(true);
  });

  it("全項目が未指定・空・空白のみなら false", () => {
    expect(hasAnyField({})).toBe(false);
    expect(hasAnyField({ situation: "", task: " ", action: null, result: undefined })).toBe(false);
  });
});
