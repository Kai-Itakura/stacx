import {
  getFormProps,
  getSelectProps,
  getTextareaProps,
  type SubmissionResult,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useEffect, useRef, useState } from "react";
import { Form, useActionData, useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  type IntakeProject,
  type IntakeTag,
  memoFormSchema,
  type TagFetcherResult,
  tagFormSchema,
} from "./schema";

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
  const lastResult = useActionData<SubmissionResult | undefined>();
  const tagFetcher = useFetcher<TagFetcherResult>();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [newTag, setNewTag] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);

  // 進行中（endDate が null）のプロジェクトを既定選択。無ければ先頭。
  const defaultProjectId = (projects.find((p) => p.endDate === null) ?? projects[0]).id;

  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(memoFormSchema),
    defaultValue: { projectId: defaultProjectId },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    onValidate: ({ formData }) => parseWithZod(formData, { schema: memoFormSchema }),
  });

  // メモ保存成功でタグ選択をクリアし、本文へ再フォーカス（本文は resetForm で空に戻る）。
  useEffect(() => {
    if (form.status === "success") {
      setSelectedTags(new Set());
      textareaRef.current?.focus();
    }
  }, [form.status]);

  // インライン作成したタグは自動選択し、入力欄をクリア。
  useEffect(() => {
    const data = tagFetcher.data;
    if (data?.ok && data.tagId) {
      const id = data.tagId;
      setSelectedTags((prev) => new Set(prev).add(id));
      setNewTag("");
    }
  }, [tagFetcher.data]);

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addTag = () => {
    // メモ/プロジェクトと同じく zod スキーマで検証する。
    const result = tagFormSchema.safeParse({ name: newTag });
    if (!result.success) {
      setTagError(result.error.issues[0]?.message ?? "タグ名を入力してください");
      return;
    }
    setTagError(null);
    tagFetcher.submit({ intent: "createTag", name: result.data.name }, { method: "post" });
  };

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter は改行、Cmd/Ctrl+Enter で保存。
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <Form
      ref={formRef}
      method="post"
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

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">タグ</span>
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => {
            const selected = selectedTags.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                aria-pressed={selected}
                className={
                  selected
                    ? "bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm"
                    : "border-input hover:bg-muted rounded-full border px-3 py-1 text-sm"
                }
              >
                {tag.name}
              </button>
            );
          })}
          {/* 選択中タグを form に載せる隠しフィールド。 */}
          {[...selectedTags].map((id) => (
            <input key={id} type="hidden" name="tagIds" value={id} />
          ))}
        </div>
        <div className="mt-1 flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => {
              setNewTag(e.target.value);
              setTagError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="新規タグを追加"
            className="h-8 max-w-48"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTag}
            disabled={tagFetcher.state !== "idle"}
          >
            追加
          </Button>
        </div>
        {/* クライアント検証エラーを優先し、無ければサーバ（重複等）のエラーを出す。 */}
        {(tagError || (tagFetcher.data && !tagFetcher.data.ok)) && (
          <p className="text-destructive text-sm">
            {tagError ?? (tagFetcher.data && !tagFetcher.data.ok ? tagFetcher.data.error : null)}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        {form.errors && <p className="text-destructive mr-auto text-sm">{form.errors[0]}</p>}
        <span className="text-muted-foreground text-xs">⌘/Ctrl + Enter で保存</span>
        <Button type="submit">保存</Button>
      </div>
    </Form>
  );
}
