import { useEffect, useState } from "react";
import { applyTheme, THEME_STORAGE_KEY, THEMES, type Theme } from "~/lib/theme";

/**
 * テーマの現在値と循環切り替えを提供する。
 *
 * デスクトップのヘッダーボタン（ThemeToggle）とモバイルのユーザーメニュー項目の
 * 両方から使うため、状態と副作用をここへ集約している。
 * theme.ts を React 非依存に保ちたいので、フックだけ別ファイルに置く。
 */
export function useTheme() {
  // SSR/初回ハイドレーションは server と一致させるため "system" 固定。
  // 実際の保存値はマウント後に読み込む（インラインスクリプトが先に .dark を適用済み）。
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && (THEMES as readonly string[]).includes(stored)) setTheme(stored as Theme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    // System 選択中は OS 設定の変更にも追従する。
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const cycle = () => {
    const next = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  };

  return { theme, cycle };
}

export const THEME_ICON_LABEL = {
  system: "システム",
  light: "ライト",
  dark: "ダーク",
} as const satisfies Record<Theme, string>;
