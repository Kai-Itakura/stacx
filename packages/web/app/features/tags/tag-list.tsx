import { useState } from "react";
import { Form, Link } from "react-router";
import { TagBadge } from "~/components/entity-badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

/** タグ管理画面の表示用アイテム（route loader が整形して渡す）。 */
export type TagListItem = {
  id: string;
  name: string;
  /** このタグが付いているメモ。タイトルは本文の先頭行から導出済み。 */
  memos: { id: string; title: string }[];
};

export function TagList({ tags, error }: { tags: TagListItem[]; error?: string | null }) {
  if (tags.length === 0) {
    return (
      <p className="text-muted-foreground text-center">
        まだタグがありません。メモ作成画面から追加できます。
      </p>
    );
  }

  return (
    <>
      {error && <p className="text-destructive mb-4 text-sm">{error}</p>}
      <ul className="flex flex-col gap-3">
        {/*
         * key に name を含めることで、リネーム成功後（loader 再検証で name が変わる）に
         * 行が再マウントされ、開いたままの編集フォームが閉じる。
         * 失敗時は name が変わらないため、入力内容を保ったままエラーを出せる。
         */}
        {tags.map((tag) => (
          <TagRow key={`${tag.id}:${tag.name}`} tag={tag} />
        ))}
      </ul>
    </>
  );
}

function TagRow({ tag }: { tag: TagListItem }) {
  const [renaming, setRenaming] = useState(false);
  const count = tag.memos.length;

  return (
    <li className="border-border rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {renaming ? (
          <Form method="post" className="flex flex-1 items-center gap-2">
            <input type="hidden" name="intent" value="rename" />
            <input type="hidden" name="id" value={tag.id} />
            <Input
              name="name"
              defaultValue={tag.name}
              aria-label={`${tag.name} の新しい名前`}
              className="h-8 max-w-48"
              autoFocus
            />
            <Button type="submit" size="sm">
              保存
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRenaming(false)}>
              キャンセル
            </Button>
          </Form>
        ) : (
          <>
            <TagBadge name={tag.name} />
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setRenaming(true)}>
                名前を変更
              </Button>
              <Form
                method="post"
                onSubmit={(e) => {
                  const warning =
                    count > 0
                      ? `「${tag.name}」を削除すると ${count} 件のメモからタグが外れます。削除しますか？`
                      : `「${tag.name}」を削除しますか？`;
                  if (!confirm(warning)) e.preventDefault();
                }}
              >
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={tag.id} />
                <Button type="submit" variant="destructive" size="sm">
                  削除
                </Button>
              </Form>
            </div>
          </>
        )}
      </div>

      <p className="text-muted-foreground mt-3 text-sm">
        {count === 0 ? "使用中のメモはありません" : `${count} 件のメモで使用中`}
      </p>
      {count > 0 && (
        <ul className="mt-1 flex flex-col gap-1">
          {tag.memos.map((memo) => (
            <li key={memo.id}>
              <Link
                to={`/memos/${memo.id}/star`}
                className="text-primary text-sm underline-offset-4 hover:underline"
              >
                {memo.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
