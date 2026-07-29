import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "~/components/ui/button";
import { THEME_ICON_LABEL, useTheme } from "~/lib/use-theme";

export const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const;

/** System → Light → Dark を循環で切り替えるボタン（デスクトップのヘッダー用）。 */
export function ThemeToggle() {
  const { theme, cycle } = useTheme();
  const Icon = THEME_ICON[theme];

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={cycle}
      title={`テーマ: ${THEME_ICON_LABEL[theme]}`}
      aria-label={`テーマを切り替える（現在: ${THEME_ICON_LABEL[theme]}）`}
    >
      <Icon />
    </Button>
  );
}
