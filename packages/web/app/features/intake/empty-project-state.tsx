import { getFormProps, getInputProps, type SubmissionResult, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { Form, useActionData } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { projectFormSchema } from "./schema";

/** プロジェクトが 0 件のときの空状態。名前だけの簡易作成を出す（開始日は今日）。 */
export function EmptyProjectState() {
  const lastResult = useActionData() as SubmissionResult | undefined;
  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(projectFormSchema),
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    onValidate: ({ formData }) => parseWithZod(formData, { schema: projectFormSchema }),
  });

  return (
    <div className="mx-auto max-w-md text-center">
      <h2 className="text-lg font-semibold">まずはプロジェクトを作成</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        メモはプロジェクトに紐づきます。最初の 1 つを作りましょう。
      </p>
      <Form
        method="post"
        encType="application/x-www-form-urlencoded"
        {...getFormProps(form)}
        className="mt-6 flex flex-col gap-2"
      >
        <input type="hidden" name="intent" value="createProject" />
        <div className="flex gap-2">
          <Input
            {...getInputProps(fields.name, { type: "text" })}
            placeholder="プロジェクト名"
            autoFocus
          />
          <Button type="submit">作成</Button>
        </div>
        {fields.name.errors && <p className="text-destructive text-sm">{fields.name.errors[0]}</p>}
        {form.errors && <p className="text-destructive text-sm">{form.errors[0]}</p>}
      </Form>
    </div>
  );
}
