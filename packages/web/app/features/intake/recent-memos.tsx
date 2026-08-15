import { Link } from "react-router";
import { toLocalDay } from "~/lib/format-date";
import { memoExcerpt } from "~/lib/memo-excerpt";

export type RecentMemo = { id: string; body: string; createdAt: string };

/** 入力欄の上に積む直近メモ。渡された順にそのまま並べる。 */
export function RecentMemos({ memos }: { memos: RecentMemo[] }) {
  if (memos.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        まだメモがありません。下の欄から書き始められます。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-xs">直近のメモ</span>
        <Link to="/memos" className="text-primary text-xs underline-offset-4 hover:underline">
          すべて見る
        </Link>
      </div>
      <ul className="flex flex-col gap-1">
        {memos.map((memo) => (
          <li key={memo.id}>
            <Link
              to={`/memos/${memo.id}/edit`}
              className="hover:bg-muted flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 transition-colors"
            >
              <span className="truncate text-sm">{memoExcerpt(memo.body)}</span>
              <time className="text-muted-foreground shrink-0 text-xs">
                {formatTime(memo.createdAt)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 当日は時刻、それ以前は日付を返す。 */
function formatTime(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay
    ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    : toLocalDay(iso);
}
