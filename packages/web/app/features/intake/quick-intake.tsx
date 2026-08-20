import { getFormProps, getTextareaProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { CornerDownLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import type { action } from "~/resources/create-memo";
import { IntakeChips } from "./intake-chips";
import { type IntakeProject, type IntakeTag, memoFormSchema } from "./schema";

/** 入力時のヒント（US-03）。後で経歴書に使える形で書くための視点を思い出させる。 */
const HINTS = [
  "数値で表せる成果はある？（例: LCP 2.5s → 1.2s）",
  "なぜその技術を選んだ？",
  "チームへの貢献はあった？",
] as const;

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

  /** 新しい Set を返すと effect の再実行と再レンダーが連鎖するため、選択済みなら prev を返す。 */
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
      // Conform のリセットは 1 レンダー後なので、ここで採寸すると保存前の本文を測ってしまう。
      if (textareaRef.current) textareaRef.current.style.height = "";
      textareaRef.current?.focus();
    }
  }, [memoFetcher.data]);

  const invalid = Boolean(fields.body.errors || form.errors);

  return (
    <memoFetcher.Form
      ref={formRef}
      method="post"
      action="/resources/memos/create"
      encType="application/x-www-form-urlencoded"
      {...getFormProps(form)}
      className="flex flex-col gap-2"
    >
      <ul className="text-muted-foreground list-inside list-disc space-y-0.5 px-1 text-xs">
        {HINTS.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>

      <IntakeChips
        projects={projects}
        tags={tags}
        projectId={projectId}
        onProjectChange={setProjectId}
        selectedTagIds={selectedTagIds}
        onToggleTag={toggleTag}
        onSelectTag={selectTag}
      />

      {/* 枠が二重にならないよう、枠線・リング・エラー表示は外側だけが持つ。 */}
      <div
        className={`bg-background flex items-end gap-2 rounded-2xl border py-1.5 pr-1.5 pl-3 transition-colors focus-within:ring-3 ${
          invalid
            ? "border-destructive focus-within:border-destructive focus-within:ring-destructive/20"
            : "border-input focus-within:border-ring focus-within:ring-ring/50"
        }`}
      >
        <Textarea
          {...getTextareaProps(fields.body)}
          ref={textareaRef}
          autoFocus
          placeholder="いま学んだこと・成果を 1 分でメモ…"
          onKeyDown={onTextareaKeyDown}
          onInput={autoGrow}
          className="max-h-40 min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-0 py-1.5 text-base shadow-none focus-visible:border-0 focus-visible:ring-0 aria-invalid:border-0 aria-invalid:ring-0 dark:bg-transparent"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="保存"
          title="⌘/Ctrl + Enter で保存"
          className="size-9 shrink-0 rounded-xl"
        >
          <CornerDownLeft />
        </Button>
      </div>

      {(fields.body.errors || form.errors) && (
        <p className="text-destructive px-3 text-sm">
          {fields.body.errors?.[0] ?? form.errors?.[0]}
        </p>
      )}
    </memoFetcher.Form>
  );
}
