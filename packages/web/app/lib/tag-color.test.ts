import { describe, expect, it } from "vitest";
import { TAG_TONE_COUNT, tagTone, tagToneClass, techToneClass } from "./tag-color";

describe("tagTone", () => {
  it("同じ名前は常に同じ色になる", () => {
    expect(tagTone("トラブル")).toBe(tagTone("トラブル"));
  });

  it("常に 1..TAG_TONE_COUNT の範囲に収まる", () => {
    const names = ["トラブル", "学び", "技術判断", "チーム改善", "a", "", "🎉", "x".repeat(200)];
    for (const name of names) {
      const tone = tagTone(name);
      expect(tone).toBeGreaterThanOrEqual(1);
      expect(tone).toBeLessThanOrEqual(TAG_TONE_COUNT);
    }
  });

  it("異なる名前はパレット全体に散る（代表的なタグ名で 3 色以上使う）", () => {
    const tones = new Set(["トラブル", "学び", "技術判断", "チーム改善"].map(tagTone));
    expect(tones.size).toBeGreaterThanOrEqual(3);
  });
});

describe("tagToneClass", () => {
  it("名前に対応する subtle 背景と前景のクラスを返す", () => {
    expect(tagToneClass("トラブル")).toBe(
      `bg-tag-${tagTone("トラブル")}-subtle text-tag-${tagTone("トラブル")}`,
    );
  });
});

describe("techToneClass", () => {
  it("同じ配色を枠線で返す（タグとは形で区別する）", () => {
    const tone = tagTone("React");
    expect(techToneClass("React")).toBe(`border-tag-${tone}/40 text-tag-${tone}`);
  });
});
