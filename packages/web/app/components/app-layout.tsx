import { FolderKanban, LogOut, MoreHorizontal, NotebookText, PenLine } from "lucide-react";
import type { ReactNode } from "react";
import { Form, NavLink } from "react-router";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";

type User = { name: string | null; email: string | null };

const NAV_ITEMS = [
  { to: "/", label: "メモ作成", tabLabel: "メモ作成", icon: PenLine, end: true },
  { to: "/memos", label: "メモ一覧", tabLabel: "一覧", icon: NotebookText, end: false },
  { to: "/projects", label: "プロジェクト", tabLabel: "PJ", icon: FolderKanban, end: false },
] as const;

export function AppLayout({ user, children }: { user: User; children: ReactNode }) {
  const displayName = user.name ?? user.email ?? "ゲスト";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-svh flex-col">
      {/* ─── Top header ─── */}
      <header className="bg-background/80 border-b sticky top-0 z-30 flex h-14 items-center px-4 backdrop-blur-sm">
        <span className="font-semibold tracking-tight">StacX</span>

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
          <ThemeToggle />
          <span className="text-muted-foreground hidden text-sm md:inline">{displayName}</span>
          <Form method="post" action="/api/auth/logout" className="hidden md:block">
            <Button type="submit" variant="outline" size="sm">
              ログアウト
            </Button>
          </Form>
        </div>
      </header>

      {/* ─── Page content ─── */}
      {/* pb-20 on mobile clears the fixed bottom tab bar */}
      <div className="flex-1 pb-20 md:pb-0">{children}</div>

      {/* ─── Bottom tab bar (mobile only) ─── */}
      <nav
        className="bg-background/90 border-t fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch backdrop-blur-sm md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV_ITEMS.map(({ to, tabLabel, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon strokeWidth={isActive ? 2.5 : 2} className="h-5 w-5" />
                <span className="text-[10px] leading-none">{tabLabel}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* "その他" → Sheet */}
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-1"
            >
              <MoreHorizontal strokeWidth={2} className="h-5 w-5" />
              <span className="text-[10px] leading-none">その他</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-10">
            <SheetHeader className="mb-4 border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary text-primary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {initial}
                </div>
                <div className="min-w-0 text-left">
                  <SheetTitle className="truncate text-sm font-medium">{displayName}</SheetTitle>
                  {user.name && user.email && (
                    <p className="text-muted-foreground truncate text-xs">{user.email}</p>
                  )}
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1 py-2">
                <span className="text-sm">テーマ</span>
                <ThemeToggle />
              </div>
              <Form method="post" action="/api/auth/logout">
                <Button
                  type="submit"
                  variant="ghost"
                  className="text-destructive hover:text-destructive w-full justify-start gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  ログアウト
                </Button>
              </Form>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </div>
  );
}
