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

export const THEME_COLORS = { light: "#ebebeb", dark: "#070707" } as const;

/** 実効テーマを <html> の .dark クラスと theme-color の meta に反映する。 */
export function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLORS[resolved];
}

/**
 * 描画前(ハイドレーション前)に <head> で実行し、チラつきを防ぐインラインスクリプト。
 * localStorage の保存値と OS 設定から .dark と theme-color を先に確定させる。applyTheme と等価。
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m);}m.content=d?'${THEME_COLORS.dark}':'${THEME_COLORS.light}';}catch(e){}})();`;
