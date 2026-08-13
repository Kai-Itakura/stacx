import { getFormProps, getTextareaProps, type SubmissionResult, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import type { ReactNode } from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
  type StarEditorMemo,
  type StarSaveMode,
  type StarStatus,
  type StarValues,
  starFormSchema,
} from "./star-schema";

type StarEditorProps = {
  memo: StarEditorMemo;
  /** 既存の STAR 値（未 STAR 化なら空文字で埋めた値）。 */
  values: StarValues;
  /** 保存済みの状態。バッジ表示＝保存フィードバックを兼ねる。 */
  status: StarStatus;
};

const STATUS_BADGE: Record<StarStatus, { label: string; className: string }> = {
  none: { label: "未保存", className: "bg-muted text-muted-foreground" },
  draft: { label: "下書き", className: "bg-muted text-muted-foreground" },
  complete: { label: "完成", className: "bg-primary/10 text-primary" },
};

const STAR_FIELDS = [
  { key: "situation", label: "Situation（状況）", hint: "どんな状況・背景でしたか？" },
  { key: "task", label: "Task（課題）", hint: "何を求められていましたか？" },
  { key: "action", label: "Action（行動）", hint: "具体的に何をしましたか？" },
  { key: "result", label: "Result（結果）", hint: "数値で表せる成果はありますか？" },
] as const;

/** クリックされたボタンの mode を読む（下書き保存 / 完成にする）。 */
const readMode = (formData: FormData): StarSaveMode =>
  formData.get("mode") === "complete" ? "complete" : "draft";

/** メモを STAR 形式に昇華するエディタ。左にメモ、右に S/T/A/R フォーム。 */
export function StarEditor({ memo, values, status }: StarEditorProps) {
  const lastResult = useActionData<SubmissionResult | undefined>();
  const navigation = useNavigation();

  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(starFormSchema("draft")),
    defaultValue: values,
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    // mode（下書き/完成）で検証ルールが変わる。complete は全項目必須。
    onValidate: ({ formData }) =>
      parseWithZod(formData, { schema: starFormSchema(readMode(formData)) }),
  });

  const submitting = navigation.state === "submitting";
  const badge = STATUS_BADGE[status];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* 左: メモ */}
      <section className="border-border h-fit rounded-lg border p-4">
        <span className="text-muted-foreground text-xs">メモ</span>
        <p className="mt-2 text-sm whitespace-pre-wrap">{memo.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
            {memo.projectName}
          </span>
          {memo.tagNames.map((name) => (
            <span key={name} className="bg-muted rounded-full px-2 py-0.5 text-xs">
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* 右: STAR フォーム */}
      <Form method="post" {...getFormProps(form)} className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs ${badge.className}`}>
            {badge.label}
          </span>
          <span className="text-muted-foreground text-xs">完成にすると経歴書の対象になります</span>
        </div>

        {STAR_FIELDS.map(({ key, label, hint }) => (
          <Field key={key} htmlFor={fields[key].id} label={label} errors={fields[key].errors}>
            <Textarea
              {...getTextareaProps(fields[key])}
              rows={3}
              placeholder={hint}
              className="resize-y"
            />
          </Field>
        ))}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {form.errors && (
            <p className="text-destructive mr-auto w-full text-sm sm:w-auto">{form.errors[0]}</p>
          )}
          <Button asChild variant="ghost" type="button">
            <Link to="/memos">キャンセル</Link>
          </Button>
          <Button type="submit" name="mode" value="draft" variant="outline" disabled={submitting}>
            下書き保存
          </Button>
          <Button type="submit" name="mode" value="complete" disabled={submitting}>
            完成にする
          </Button>
        </div>
      </Form>
    </div>
  );
}

function Field({
  htmlFor,
  label,
  errors,
  children,
}: {
  htmlFor: string;
  label: string;
  errors?: string[];
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {errors && <p className="text-destructive text-sm">{errors[0]}</p>}
    </div>
  );
}
