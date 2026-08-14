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

  useEffect(() => {
    if (form.status === "success") {
      setSelectedTagIds([]);
      textareaRef.current?.focus();
    }
  }, [form.status]);

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

      <div className="border-input focus-within:border-ring focus-within:ring-ring/50 flex items-end gap-2 rounded-lg border p-2 shadow-xs focus-within:ring-3">
        <Textarea
          {...getTextareaProps(fields.body)}
          ref={textareaRef}
          rows={2}
          autoFocus
          placeholder="いま学んだこと・成果を 1 分でメモ…"
          onKeyDown={onTextareaKeyDown}
          // 枠は外側の div が持つので、textarea 自身の枠と影は消す。
          className="max-h-40 min-h-9 resize-none border-0 p-0 text-base shadow-none focus-visible:ring-0"
        />
        <Button type="submit" size="icon" aria-label="保存" className="shrink-0">
          <CornerDownLeft />
        </Button>
      </div>

      {(fields.body.errors || form.errors) && (
        <p className="text-destructive text-sm">{fields.body.errors?.[0] ?? form.errors?.[0]}</p>
      )}
    </memoFetcher.Form>
  );
}
