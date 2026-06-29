export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "theme";

/** "system" は OS 設定(prefers-color-scheme)に追従し、それ以外は指定をそのまま使う。 */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

/** 実効テーマを <html> の .dark クラスに反映する。 */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");
}

/**
 * 描画前(ハイドレーション前)に <head> で実行し、チラつきを防ぐインラインスクリプト。
 * localStorage の保存値と OS 設定から .dark を先に確定させる。theme.ts のロジックと等価。
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
