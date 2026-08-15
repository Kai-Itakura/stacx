import { getFormProps, getTextareaProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import type { action } from "~/resources/create-memo";
import { IntakeChips } from "./intake-chips";
import { type IntakeProject, type IntakeTag, memoFormSchema } from "./schema";

type QuickIntakeProps = {
  projects: IntakeProject[];
  tags: IntakeTag[];
};

/** 画面1: クイック・インテーク（メモ作成）フォーム。 */
export function QuickIntake({ projects, tags }: QuickIntakeProps) {
  const memoFetcher = useFetcher<typeof action>();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const defaultProjectId = (projects.find((p) => p.endDate === null) ?? projects[0]).id;
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(() => new Set());

  const [form, fields] = useForm({
    lastResult: memoFetcher.data,
    constraint: getZodConstraint(memoFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate: ({ formData }) => parseWithZod(formData, { schema: memoFormSchema }),
  });

  const toggleTag = useCallback((id: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  /**
   * 選択済みなら同じ Set を返す。effect から呼ぶため、再実行されても状態が動かない
   * 必要がある（新しい Set を返すと再レンダーが連鎖して止まらなくなる）。
   */
  const selectTag = useCallback((id: string) => {
    setSelectedTagIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  /**
   * 入力量に合わせて高さを伸ばす。auto を挟まないと行を減らしても scrollHeight が縮まない。
   * 基底 Textarea の field-sizing-content は Firefox が未対応のため、JS 側でも持つ。
   */
  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // submission.reply({ resetForm: true }) は status を持たず { initialValue: null } を返す。
  useEffect(() => {
    if (memoFetcher.data?.initialValue === null) {
      setSelectedTagIds(new Set());
      // Conform のフォームリセットはこの後に走る。ここで採寸すると保存前の本文を測って
      // 高さを付け直してしまうので、指定を外して CSS に戻す。
      if (textareaRef.current) textareaRef.current.style.height = "";
      textareaRef.current?.focus();
    }
  }, [memoFetcher.data]);

  return (
    <memoFetcher.Form
      ref={formRef}
      method="post"
      action="/resources/memos/create"
      encType="application/x-www-form-urlencoded"
      {...getFormProps(form)}
      className="flex flex-col gap-2"
    >
      <IntakeChips
        projects={projects}
        tags={tags}
        projectId={projectId}
        onProjectChange={setProjectId}
        selectedTagIds={selectedTagIds}
        onToggleTag={toggleTag}
        onSelectTag={selectTag}
      />

      <Textarea
        {...getTextareaProps(fields.body)}
        ref={textareaRef}
        autoFocus
        placeholder="いま学んだこと・成果を 1 分でメモ…"
        onKeyDown={onTextareaKeyDown}
        onInput={autoGrow}
        className="max-h-40 min-h-0 resize-none text-base"
      />

      {(fields.body.errors || form.errors) && (
        <p className="text-destructive text-sm">{fields.body.errors?.[0] ?? form.errors?.[0]}</p>
      )}

      <div className="flex items-center justify-end gap-3">
        <span className="text-muted-foreground text-xs">⌘/Ctrl + Enter で保存</span>
        <Button type="submit">保存</Button>
      </div>
    </memoFetcher.Form>
  );
}
