import { getFormProps, getInputProps, type SubmissionResult, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useState } from "react";
import { Form, Link, useActionData } from "react-router";
import { TagBadge } from "~/components/entity-badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { tagActionSchema } from "~/features/tags/schema";
import { memoExcerpt } from "~/lib/memo-excerpt";

/** タグ管理画面の表示用アイテム（route loader が整形して渡す）。 */
export type TagListItem = {
  id: string;
  name: string;
  /** このタグが付いているメモ。見出しは本文から導出する。 */
  memos: { id: string; body: string }[];
};

export function TagList({ tags }: { tags: TagListItem[] }) {
  if (tags.length === 0) {
    return (
      <p className="text-muted-foreground text-center">
        まだタグがありません。メモ作成画面から追加できます。
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {/* key に name を含め、リネーム成功時だけ再マウントさせて編集フォームを閉じる。 */}
      {tags.map((tag) => (
        <TagRow key={`${tag.id}:${tag.name}`} tag={tag} />
      ))}
    </ul>
  );
}

function TagRow({ tag }: { tag: TagListItem }) {
  const [renaming, setRenaming] = useState(false);
  const count = tag.memos.length;
  const lastResult = useActionData<SubmissionResult | undefined>();

  // 行ごとにフォームがあるため id を分ける。共有すると Conform が別の行のエラーを拾う。
  const [renameForm, renameFields] = useForm({
    id: `rename-${tag.id}`,
    lastResult: resultFor(lastResult, tag.id, "rename"),
    constraint: getZodConstraint(tagActionSchema),
    defaultValue: { intent: "rename", id: tag.id, name: tag.name },
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate: ({ formData }) => parseWithZod(formData, { schema: tagActionSchema }),
  });

  const [deleteForm] = useForm({
    id: `delete-${tag.id}`,
    lastResult: resultFor(lastResult, tag.id, "delete"),
    defaultValue: { intent: "delete", id: tag.id },
  });

  return (
    <li className="border-border rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {renaming ? (
          <Form
            method="post"
            {...getFormProps(renameForm)}
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <input type="hidden" name="intent" value="rename" />
            <input type="hidden" name="id" value={tag.id} />
            <Input
              {...getInputProps(renameFields.name, { type: "text" })}
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
            {(renameFields.name.errors || renameForm.errors) && (
              <p className="text-destructive w-full text-sm">
                {renameFields.name.errors?.[0] ?? renameForm.errors?.[0]}
              </p>
            )}
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
                {...getFormProps(deleteForm)}
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

      {!renaming && deleteForm.errors && (
        <p className="text-destructive mt-2 text-sm">{deleteForm.errors[0]}</p>
      )}

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
                {memoExcerpt(memo.body)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * 送信元の行・intent と一致する結果だけを返す。
 * action の結果は画面で 1 つしか無いため、全フォームに渡すと 1 行の失敗が他の行にも出る。
 */
function resultFor(
  lastResult: SubmissionResult | undefined,
  tagId: string,
  intent: "rename" | "delete",
) {
  const initialValue = lastResult?.initialValue;
  if (!initialValue) return undefined;
  return initialValue.id === tagId && initialValue.intent === intent ? lastResult : undefined;
}
