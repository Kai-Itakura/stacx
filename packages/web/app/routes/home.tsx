import {
  getFormProps,
  getInputProps,
  getSelectProps,
  getTextareaProps,
  type SubmissionResult,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod/v4";
import { useEffect, useRef, useState } from "react";
import { Form, useActionData, useFetcher } from "react-router";
import { z } from "zod";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "StacX" }, { name: "description", content: "1 分メモから職務経歴書へ" }];
}

const HINTS = [
  "数値で表せる成果はある？（例: LCP 2.5s → 1.2s）",
  "なぜその技術を選んだ？",
  "チームへの貢献はあった？",
];

/** メモ作成フォームの検証スキーマ（client/server 共用）。title は本文から導出するため項目に無い。 */
export const memoFormSchema = z.object({
  // zod v4 では未入力(undefined)の型エラーも error で文言を揃える。
  body: z.string({ error: "本文を入力してください" }).trim().min(1, "本文を入力してください"),
  projectId: z
    .string({ error: "プロジェクトを選択してください" })
    .min(1, "プロジェクトを選択してください"),
  tagIds: z.array(z.string()).optional(),
});

/** 空状態のプロジェクト簡易作成フォームの検証スキーマ。 */
export const projectFormSchema = z.object({
  name: z
    .string({ error: "プロジェクト名を入力してください" })
    .trim()
    .min(1, "プロジェクト名を入力してください"),
});

/** 本文の最初の非空行をタイトルにする（長い場合は短縮）。 */
export function deriveTitle(body: string): string {
  const firstLine =
    body
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  return firstLine.length > 100 ? `${firstLine.slice(0, 100)}…` : firstLine;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const client = apiClient(request);
  const [projectsRes, tagsRes] = await Promise.all([
    client.api.projects.$get(),
    client.api.tags.$get(),
  ]);
  const projects = projectsRes.ok ? (await projectsRes.json()).projects : [];
  const tags = tagsRes.ok ? (await tagsRes.json()).tags : [];
  return { user, projects, tags };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const client = apiClient(request);

  // タグのインライン作成（fetcher 経由）。結果は fetcher.data で受け取る。
  if (intent === "createTag") {
    const name = String(formData.get("name") ?? "").trim();
    if (!name)
      return {
        ok: false as const,
        intent: "createTag" as const,
        error: "タグ名を入力してください",
      };
    const res = await client.api.tags.$post({ json: { name } });
    if (!res.ok) {
      const error = res.status === 409 ? "同名のタグが既にあります" : "タグの作成に失敗しました";
      return { ok: false as const, intent: "createTag" as const, error };
    }
    const { id } = await res.json();
    return { ok: true as const, intent: "createTag" as const, tagId: id };
  }

  if (intent === "createProject") {
    const submission = parseWithZod(formData, { schema: projectFormSchema });
    if (submission.status !== "success") return submission.reply();
    const res = await client.api.projects.$post({
      json: { name: submission.value.name, startDate: Date.now() },
    });
    if (!res.ok) return submission.reply({ formErrors: ["プロジェクトの作成に失敗しました"] });
    return submission.reply({ resetForm: true });
  }

  // 既定: メモ作成。
  const submission = parseWithZod(formData, { schema: memoFormSchema });
  if (submission.status !== "success") return submission.reply();
  const { body, projectId, tagIds } = submission.value;
  const res = await client.api.memos.$post({
    json: { projectId, title: deriveTitle(body), body, tagIds: tagIds ?? [] },
  });
  if (!res.ok) return submission.reply({ formErrors: ["メモの保存に失敗しました"] });
  return submission.reply({ resetForm: true });
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user, projects, tags } = loaderData;
  return (
    <main className="container mx-auto max-w-2xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">StacX</h1>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground hidden text-sm sm:inline">
            {user.name ?? user.email ?? "ゲスト"}
          </span>
          <ThemeToggle />
          {/* logout は api を直接叩く form（web worker が中継）。状態変更なので POST。 */}
          <form method="post" action="/api/auth/logout">
            <Button type="submit" variant="outline">
              ログアウト
            </Button>
          </form>
        </div>
      </header>

      <div className="mt-10">
        {projects.length === 0 ? <EmptyState /> : <QuickIntake projects={projects} tags={tags} />}
      </div>
    </main>
  );
}

/** プロジェクトが 0 件のときの空状態。名前だけの簡易作成を出す（開始日は今日）。 */
function EmptyState() {
  const lastResult = useActionData<typeof action>() as SubmissionResult | undefined;
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

type QuickIntakeProps = {
  projects: Route.ComponentProps["loaderData"]["projects"];
  tags: Route.ComponentProps["loaderData"]["tags"];
};

function QuickIntake({ projects, tags }: QuickIntakeProps) {
  const lastResult = useActionData<typeof action>() as SubmissionResult | undefined;
  const tagFetcher = useFetcher<typeof action>();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [newTag, setNewTag] = useState("");

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
    if (data && "ok" in data && data.ok && data.intent === "createTag" && data.tagId) {
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
    const name = newTag.trim();
    if (!name) return;
    tagFetcher.submit({ intent: "createTag", name }, { method: "post" });
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
            onChange={(e) => setNewTag(e.target.value)}
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
        {tagFetcher.data && "ok" in tagFetcher.data && !tagFetcher.data.ok && (
          <p className="text-destructive text-sm">{tagFetcher.data.error}</p>
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
