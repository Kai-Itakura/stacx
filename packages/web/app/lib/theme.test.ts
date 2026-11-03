import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, THEME_COLORS, themeInitScript } from "./theme";

const themeColorMeta = () => document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

afterEach(() => {
  document.head.innerHTML = "";
  document.documentElement.classList.remove("dark");
  localStorage.clear();
});

describe("applyTheme", () => {
  it("ダークを選ぶと theme-color もダークの背景色になる", () => {
    applyTheme("dark");
    expect(themeColorMeta()?.content).toBe(THEME_COLORS.dark);
  });

  it("切り替えても theme-color の meta は 1 つのまま値だけ変わる", () => {
    applyTheme("dark");
    applyTheme("light");
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(themeColorMeta()?.content).toBe(THEME_COLORS.light);
  });
});

describe("themeInitScript", () => {
  it("保存値がダークなら描画前に theme-color をダークにする", () => {
    localStorage.setItem("theme", "dark");
    new Function(themeInitScript)();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(themeColorMeta()?.content).toBe(THEME_COLORS.dark);
  });
});
