import { getFormProps, getSelectProps, getTextareaProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import type { action } from "~/resources/create-memo";
import { type IntakeProject, type IntakeTag, memoFormSchema } from "./schema";
import TagField from "./tag-field";

const HINTS = [
  "数値で表せる成果はある？（例: LCP 2.5s → 1.2s）",
  "なぜその技術を選んだ？",
  "チームへの貢献はあった？",
];

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

  const [form, fields] = useForm({
    lastResult: memoFetcher.data,
    constraint: getZodConstraint(memoFormSchema),
    defaultValue: { projectId: defaultProjectId },
    // 初回は送信時まで検証しない。触って離れただけでエラーを出すと、書き始めた直後に
    // 赤字が出て体験が悪い（#83）。一度エラーが出た後は onInput で即座に消えるので、
    // 修正中のフィードバックは最速のまま保てる。
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate: ({ formData }) => parseWithZod(formData, { schema: memoFormSchema }),
  });

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter は改行、Cmd/Ctrl+Enter で保存。
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  useEffect(() => {
    if (form.status === "success") {
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
      className="flex flex-col gap-4"
    >
      <div>
        <Textarea
          {...getTextareaProps(fields.body)}
          ref={textareaRef}
          rows={8}
          autoFocus
          placeholder="いま学んだこと・成果を 1 分でメモ…"
          onKeyDown={onTextareaKeyDown}
          className="resize-y text-base"
        />
        {fields.body.errors ? (
          <p className="text-destructive mt-1 text-sm">{fields.body.errors[0]}</p>
        ) : (
          <ul className="text-muted-foreground mt-2 space-y-0.5 text-xs">
            {HINTS.map((hint) => (
              <li key={hint}>・{hint}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">プロジェクト</span>
        <select
          {...getSelectProps(fields.projectId)}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-3"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.endDate === null ? "（進行中）" : ""}
            </option>
          ))}
        </select>
      </div>

      <TagField tags={tags} formStatus={form.status} />

      <div className="flex items-center justify-end gap-3">
        {form.errors && <p className="text-destructive mr-auto text-sm">{form.errors[0]}</p>}
        <span className="text-muted-foreground text-xs">⌘/Ctrl + Enter で保存</span>
        <Button type="submit">保存</Button>
      </div>
    </memoFetcher.Form>
  );
}
