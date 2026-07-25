/** メモ一覧の表示用アイテム（route loader が RPC レスポンスから整形して渡す）。 */
export type MemoListItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  projectName: string;
  tagNames: string[];
};

/** メモ一覧（タイムライン・作成日降順）。純表示コンポーネント。 */
export function MemoList({ memos }: { memos: MemoListItem[] }) {
  if (memos.length === 0) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground">まだメモがありません。</p>
        <a href="/" className="text-primary mt-2 inline-block underline-offset-4 hover:underline">
          最初のメモを書く
        </a>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {memos.map((m) => (
        <li key={m.id} className="border-border rounded-lg border p-4">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{m.title}</span>
            <time className="text-muted-foreground shrink-0 text-xs">
              {m.createdAt.slice(0, 10)}
            </time>
          </div>
          <p className="text-muted-foreground mt-1 line-clamp-3 text-sm whitespace-pre-wrap">
            {m.body}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
              {m.projectName}
            </span>
            {m.tagNames.map((name) => (
              <span key={name} className="bg-muted rounded-full px-2 py-0.5 text-xs">
                {name}
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
