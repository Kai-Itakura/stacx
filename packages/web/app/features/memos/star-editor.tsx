import { getFormProps, getTextareaProps, type SubmissionResult, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import type { ReactNode } from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { type StarEditorMemo, type StarValues, starFormSchema } from "./star-schema";

type StarEditorProps = {
  memo: StarEditorMemo;
  /** 既存の STAR 値（未 STAR 化なら空文字で埋めた値）。 */
  values: StarValues;
};

const STAR_FIELDS = [
  { key: "situation", label: "Situation（状況）", hint: "どんな状況・背景でしたか？" },
  { key: "task", label: "Task（課題）", hint: "何を求められていましたか？" },
  { key: "action", label: "Action（行動）", hint: "具体的に何をしましたか？" },
  { key: "result", label: "Result（結果）", hint: "数値で表せる成果はありますか？" },
] as const;

/** メモを STAR 形式に昇華するエディタ。左に元メモ、右に S/T/A/R フォーム。 */
export function StarEditor({ memo, values }: StarEditorProps) {
  const lastResult = useActionData<SubmissionResult | undefined>();
  const navigation = useNavigation();

  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(starFormSchema),
    defaultValue: values,
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate: ({ formData }) => parseWithZod(formData, { schema: starFormSchema }),
  });

  const submitting = navigation.state === "submitting";

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

        <div className="flex items-center justify-end gap-3">
          {form.errors && <p className="text-destructive mr-auto text-sm">{form.errors[0]}</p>}
          <Button asChild variant="ghost" type="button">
            <Link to="/memos">キャンセル</Link>
          </Button>
          <Button type="submit" disabled={submitting}>
            保存
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
