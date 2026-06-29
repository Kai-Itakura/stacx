import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { applyTheme, THEME_STORAGE_KEY, THEMES, type Theme } from "~/lib/theme";

const ICON = { system: Monitor, light: Sun, dark: Moon } as const;
const LABEL = { system: "システム", light: "ライト", dark: "ダーク" } as const;

/** System → Light → Dark を循環で切り替えるボタン。System は OS 設定に追従する。 */
export function ThemeToggle() {
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

  const Icon = ICON[theme];
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={cycle}
      title={`テーマ: ${LABEL[theme]}`}
      aria-label={`テーマを切り替える（現在: ${LABEL[theme]}）`}
    >
      <Icon />
    </Button>
  );
}
