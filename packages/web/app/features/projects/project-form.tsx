import {
  getFormProps,
  getInputProps,
  getTextareaProps,
  type SubmissionResult,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import type * as React from "react";
import { useState } from "react";
import { Form, Link, useActionData, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { type ProjectSummary, projectFormSchema, toDateInputValue } from "./schema";

type ProjectFormProps = {
  /** 編集時の初期値。未指定なら新規作成。 */
  project?: ProjectSummary;
  submitLabel: string;
};

/** プロジェクトの作成/編集で共用するフォーム（Conform + zod）。 */
export function ProjectForm({ project, submitLabel }: ProjectFormProps) {
  const lastResult = useActionData<SubmissionResult | undefined>();
  const navigation = useNavigation();
  // techStack は自由入力チップ。client state で持ち、hidden input で form に載せる。
  const [techStack, setTechStack] = useState<string[]>(project?.techStack ?? []);
  const [techInput, setTechInput] = useState("");

  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(projectFormSchema),
    defaultValue: project
      ? {
          name: project.name,
          startDate: toDateInputValue(project.startDate),
          endDate: toDateInputValue(project.endDate),
          summary: project.summary ?? "",
          teamSize: project.teamSize ?? undefined,
          role: project.role ?? "",
        }
      : undefined,
    // 検証タイミングは画面間で揃える（#83）。詳細は quick-intake.tsx のコメント参照。
    shouldValidate: "onSubmit",
    shouldRevalidate: "onInput",
    onValidate: ({ formData }) => parseWithZod(formData, { schema: projectFormSchema }),
  });

  const submitting = navigation.state === "submitting";

  const addTech = () => {
    const value = techInput.trim();
    // 空・重複は追加しない（入力欄はクリア）。
    if (value && !techStack.includes(value)) setTechStack((prev) => [...prev, value]);
    setTechInput("");
  };
  const removeTech = (value: string) => setTechStack((prev) => prev.filter((t) => t !== value));

  return (
    <Form
      method="post"
      encType="application/x-www-form-urlencoded"
      {...getFormProps(form)}
      className="flex flex-col gap-4"
    >
      <Field htmlFor={fields.name.id} label="プロジェクト名" errors={fields.name.errors}>
        <Input {...getInputProps(fields.name, { type: "text" })} autoFocus />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field htmlFor={fields.startDate.id} label="開始日" errors={fields.startDate.errors}>
          <Input {...getInputProps(fields.startDate, { type: "date" })} />
        </Field>
        <Field
          htmlFor={fields.endDate.id}
          label="終了日（空で進行中）"
          errors={fields.endDate.errors}
        >
          <Input {...getInputProps(fields.endDate, { type: "date" })} />
        </Field>
      </div>

      <Field htmlFor={fields.summary.id} label="概要" errors={fields.summary.errors}>
        <Textarea
          {...getTextareaProps(fields.summary)}
          rows={3}
          placeholder="プロジェクトの背景・目的など"
          className="resize-y"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field htmlFor={fields.teamSize.id} label="チーム規模" errors={fields.teamSize.errors}>
          <Input {...getInputProps(fields.teamSize, { type: "number" })} min={1} />
        </Field>
        <Field htmlFor={fields.role.id} label="役割" errors={fields.role.errors}>
          <Input
            {...getInputProps(fields.role, { type: "text" })}
            placeholder="リード / メンバー 等"
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">使用技術スタック</span>
        <div className="flex flex-wrap items-center gap-2">
          {techStack.length === 0 ? (
            <span className="text-muted-foreground text-sm">未登録</span>
          ) : (
            techStack.map((t) => (
              <span
                key={t}
                className="bg-primary text-primary-foreground inline-flex items-center gap-1 rounded-full py-1 pr-1.5 pl-3 text-sm"
              >
                {t}
                <button
                  type="button"
                  aria-label={`${t} を削除`}
                  onClick={() => removeTech(t)}
                  className="opacity-80 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        {/* 選択中の techStack を form に載せる隠しフィールド。 */}
        {techStack.map((t) => (
          <input key={t} type="hidden" name="techStack" value={t} />
        ))}
        <div className="mt-1 flex gap-2">
          <Input
            value={techInput}
            onChange={(e) => setTechInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTech();
              }
            }}
            placeholder="例: Go, React"
            className="max-w-48"
          />
          <Button type="button" variant="outline" size="sm" onClick={addTech}>
            追加
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {form.errors && <p className="text-destructive mr-auto text-sm">{form.errors[0]}</p>}
        <Button asChild variant="ghost" type="button">
          <Link to="/projects">キャンセル</Link>
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitLabel}
        </Button>
      </div>
    </Form>
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
  children: React.ReactNode;
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
