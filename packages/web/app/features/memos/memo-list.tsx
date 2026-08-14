import { ProjectBadge, TagBadge } from "~/components/entity-badge";
import { Badge } from "~/components/ui/badge";
import { memoExcerpt } from "~/lib/memo-excerpt";
import type { StarStatus } from "./star-schema";

/** メモ一覧の表示用アイテム（route loader が RPC レスポンスから整形して渡す）。 */
export type MemoListItem = {
  id: string;
  body: string;
  createdAt: string;
  projectId: string;
  projectName: string;
  /** 所属プロジェクトが進行中か（終了日が未設定）。 */
  projectActive: boolean;
  tagNames: string[];
  /** STAR の状態。バッジと導線ラベルの出し分けに使う。 */
  starStatus: StarStatus;
};

const STAR_LINK_LABEL: Record<StarStatus, string> = {
  none: "STAR化する",
  draft: "下書きを続ける",
  complete: "STARを編集",
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
          {/* 上段はメモの文脈（どのプロジェクトか・いつか）。本文とタグは下に置く。 */}
          <div className="flex items-center justify-between gap-2">
            <ProjectBadge id={m.projectId} name={m.projectName} active={m.projectActive} />
            <time className="text-muted-foreground shrink-0 text-xs">
              {m.createdAt.slice(0, 10)}
            </time>
          </div>
          {/* メモはタイトルを持たないため、本文の先頭行を見出しとして導出する。 */}
          <p className="mt-2 font-medium">{memoExcerpt(m.body)}</p>
          <p className="text-muted-foreground mt-1 line-clamp-3 text-sm whitespace-pre-wrap">
            {m.body}
          </p>
          {m.tagNames.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {m.tagNames.map((name) => (
                <TagBadge key={name} name={name} />
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
            {m.starStatus === "complete" && <Badge variant="success">完成</Badge>}
            {m.starStatus === "draft" && <Badge variant="warning">下書き</Badge>}
            <a
              href={`/memos/${m.id}/edit`}
              className="text-primary text-sm underline-offset-4 hover:underline"
            >
              編集
            </a>
            <a
              href={`/memos/${m.id}/star`}
              className="text-primary text-sm underline-offset-4 hover:underline"
            >
              {STAR_LINK_LABEL[m.starStatus]}
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}
