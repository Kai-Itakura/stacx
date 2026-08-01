import { FolderKanban, LogOut, NotebookText, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { Form, Link, NavLink } from "react-router";
import { THEME_ICON, ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { THEME_ICON_LABEL, useTheme } from "~/lib/use-theme";

type User = { name: string | null; email: string | null };

const NAV_ITEMS = [
  { to: "/", label: "メモ作成", tabLabel: "メモ作成", icon: PenLine, end: true },
  { to: "/memos", label: "メモ一覧", tabLabel: "一覧", icon: NotebookText, end: false },
  { to: "/projects", label: "プロジェクト", tabLabel: "PJ", icon: FolderKanban, end: false },
] as const;

/**
 * モバイルのユーザーメニュー。トリガー（ヘッダー右上のアバター）の直下に開く。
 *
 * 以前は bottom sheet だったが、画面最上部のトリガーに対して画面下部から出るため
 * 視線と指の移動が最大化されていた。項目もテーマとログアウトの 2 つだけで、
 * sheet を使うほどの分量ではない。
 */
function UserMenu({
  displayName,
  email,
  initial,
}: {
  displayName: string;
  email: string | null;
  initial: string;
}) {
  const { theme, cycle } = useTheme();
  const ThemeIcon = THEME_ICON[theme];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold md:hidden"
          aria-label="ユーザーメニューを開く"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="md:hidden">
        <DropdownMenuLabel>
          <p className="truncate font-medium">{displayName}</p>
          {email && email !== displayName && (
            <p className="text-muted-foreground truncate text-xs">{email}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            cycle();
          }}
        >
          <ThemeIcon />
          <span>テーマ</span>
          <span className="text-muted-foreground ml-auto text-xs">{THEME_ICON_LABEL[theme]}</span>
        </DropdownMenuItem>
        <Form method="post" action="/api/auth/logout">
          <DropdownMenuItem asChild className="text-destructive focus:text-destructive">
            <button type="submit" className="w-full">
              <LogOut />
              ログアウト
            </button>
          </DropdownMenuItem>
        </Form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppLayout({ user, children }: { user: User; children: ReactNode }) {
  const displayName = user.name ?? user.email ?? "ゲスト";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-svh flex-col">
      {/* ─── Top header ─── */}
      <header className="bg-background/80 border-b sticky top-0 z-30 flex h-14 items-center px-4 backdrop-blur-sm">
        <Link to="/" className="flex items-center gap-2">
          <img src="/favicon.svg" alt="StacX" className="h-7 w-7 rounded-md" />
          <span className="font-semibold tracking-tight">StacX</span>
        </Link>

        {/* Desktop nav (md+) */}
        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Desktop: theme toggle + username + logout */}
          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <span className="text-muted-foreground text-sm">{displayName}</span>
            <Form method="post" action="/api/auth/logout">
              <Button type="submit" variant="outline" size="sm">
                ログアウト
              </Button>
            </Form>
          </div>

          {/* Mobile: user avatar → DropdownMenu（トリガーの直下に開く） */}
          <UserMenu displayName={displayName} email={user.email} initial={initial} />
        </div>
      </header>

      {/* ─── Page content ─── */}
      {/* pb-28 on mobile clears the floating bottom tab bar */}
      <div className="flex-1 pb-28 md:pb-0">{children}</div>

      {/* ─── Bottom tab bar (mobile only, floating glass pill) ─── */}
      {/* inset-x-4: 左右に 16px のマージンを取って浮かせる。bottom は safe area の上に 12px 追加 */}
      <nav
        className="fixed inset-x-4 z-30 md:hidden"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="bg-background/50 border-border/40 flex h-14 items-center justify-around rounded-full border px-2 shadow-xl shadow-black/10 backdrop-blur-xl">
          {NAV_ITEMS.map(({ to, tabLabel, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="flex items-center justify-center">
              {({ isActive }) => (
                <span
                  className={`flex flex-col items-center gap-0.5 rounded-full px-5 py-1.5 transition-colors ${
                    isActive ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Icon strokeWidth={isActive ? 2.5 : 2} className="h-5 w-5" />
                  <span className="text-[10px] leading-none">{tabLabel}</span>
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
