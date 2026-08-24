import {
  getFormProps,
  getSelectProps,
  getTextareaProps,
  type SubmissionResult,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { type IntakeProject, type IntakeTag, memoFormSchema } from "~/features/intake/schema";
import TagField from "~/features/intake/tag-field";

export type MemoFormValues = {
  body: string;
  projectId: string;
  tagIds: string[];
};

type MemoFormProps = {
  memo: MemoFormValues;
  projects: IntakeProject[];
  tags: IntakeTag[];
};

/** メモ編集フォーム。作成（QuickIntake）と違い遷移を伴うため Form で送る。 */
export function MemoForm({ memo, projects, tags }: MemoFormProps) {
  const lastResult = useActionData<SubmissionResult | undefined>();
  const navigation = useNavigation();

  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(memoFormSchema),
    defaultValue: { body: memo.body, projectId: memo.projectId },
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate: ({ formData }) => parseWithZod(formData, { schema: memoFormSchema }),
  });

  const submitting = navigation.state === "submitting";

  return (
    <Form method="post" {...getFormProps(form)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fields.body.id} className="text-sm font-medium">
          本文
        </label>
        <Textarea {...getTextareaProps(fields.body)} rows={8} className="resize-y text-base" />
        {fields.body.errors && <p className="text-destructive text-sm">{fields.body.errors[0]}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={fields.projectId.id} className="text-sm font-medium">
          プロジェクト
        </label>
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

      <TagField tags={tags} formStatus={form.status} initialSelected={memo.tagIds} />

      <div className="flex items-center justify-end gap-3">
        {form.errors && <p className="text-destructive mr-auto text-sm">{form.errors[0]}</p>}
        <Button asChild variant="ghost" type="button">
          <Link to="/memos">キャンセル</Link>
        </Button>
        <input type="hidden" name="intent" value="edit" />
        <Button type="submit" disabled={submitting}>
          保存
        </Button>
      </div>
    </Form>
  );
}
