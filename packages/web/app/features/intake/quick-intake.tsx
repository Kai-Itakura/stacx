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
  // resource route へ非遷移で送るため fetcher を使う。結果（SubmissionResult）は data で受け取る。
  const memoFetcher = useFetcher<typeof action>();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 進行中（endDate が null）のプロジェクトを既定選択。無ければ先頭。
  const defaultProjectId = (projects.find((p) => p.endDate === null) ?? projects[0]).id;
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [form, fields] = useForm({
    lastResult: memoFetcher.data,
    constraint: getZodConstraint(memoFormSchema),
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate: ({ formData }) => parseWithZod(formData, { schema: memoFormSchema }),
  });

  const toggleTag = useCallback((id: string) => {
    setSelectedTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }, []);

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter は改行、Cmd/Ctrl+Enter で保存。
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  /**
   * 入力量に合わせて高さを伸ばす（上限は max-h でクランプされ、以降はスクロール）。
   * 一度 auto に戻さないと、行を減らしたときに scrollHeight が縮まない。
   */
  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  /*
   * 保存が成功するたびに入力状態を初期化する。
   * form.status は 2 回目以降も "success" のままで値が変わらず発火しないため、
   * 応答オブジェクトそのものを見る。action の submission.reply({ resetForm: true })
   * は { initialValue: null } を返すので、これを成功の合図として扱う。
   */
  useEffect(() => {
    if (memoFetcher.data?.initialValue === null) {
      setSelectedTagIds([]);
      autoGrow(); // リセット後は 1 行分に戻す
      textareaRef.current?.focus();
    }
  }, [memoFetcher.data, autoGrow]);

  return (
    <memoFetcher.Form
      ref={formRef}
      method="post"
      action="/resources/memos/create"
      encType="application/x-www-form-urlencoded"
      {...getFormProps(form)}
      className="flex flex-col gap-2"
    >
      {/* 選択肢は入力欄の上に小さく畳んで置き、本文の領域を圧迫しない。 */}
      <IntakeChips
        projects={projects}
        tags={tags}
        projectId={projectId}
        onProjectChange={setProjectId}
        selectedTagIds={selectedTagIds}
        onToggleTag={toggleTag}
      />

      <Textarea
        {...getTextareaProps(fields.body)}
        ref={textareaRef}
        autoFocus
        placeholder="いま学んだこと・成果を 1 分でメモ…"
        onKeyDown={onTextareaKeyDown}
        onInput={autoGrow}
        className="max-h-40 resize-none text-base"
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
