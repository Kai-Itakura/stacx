import { useEffect, useRef, useState } from "react";
import { Form, useActionData, useFetcher, useNavigation } from "react-router";
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
  const form = await request.formData();
  const intent = form.get("intent");
  const client = apiClient(request);

  if (intent === "createProject") {
    const name = String(form.get("name") ?? "").trim();
    if (!name)
      return {
        ok: false as const,
        intent: "createProject" as const,
        error: "プロジェクト名を入力してください",
      };
    // 開始日は今日を自動設定（詳細は M3 のプロジェクト管理画面で編集する）。
    const res = await client.api.projects.$post({ json: { name, startDate: Date.now() } });
    if (!res.ok)
      return {
        ok: false as const,
        intent: "createProject" as const,
        error: "プロジェクトの作成に失敗しました",
      };
    return { ok: true as const, intent: "createProject" as const };
  }

  if (intent === "createTag") {
    const name = String(form.get("name") ?? "").trim();
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

  // 既定: メモ作成。
  const body = String(form.get("body") ?? "").trim();
  const projectId = String(form.get("projectId") ?? "");
  const tagIds = form.getAll("tagIds").map(String);
  if (!body)
    return { ok: false as const, intent: "createMemo" as const, error: "本文を入力してください" };
  if (!projectId)
    return {
      ok: false as const,
      intent: "createMemo" as const,
      error: "プロジェクトを選択してください",
    };
  const res = await client.api.memos.$post({
    json: { projectId, title: deriveTitle(body), body, tagIds },
  });
  if (!res.ok)
    return { ok: false as const, intent: "createMemo" as const, error: "メモの保存に失敗しました" };
  return { ok: true as const, intent: "createMemo" as const };
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
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const error = actionData?.intent === "createProject" && !actionData.ok ? actionData.error : null;
  const isSubmitting = navigation.state !== "idle";

  return (
    <div className="mx-auto max-w-md text-center">
      <h2 className="text-lg font-semibold">まずはプロジェクトを作成</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        メモはプロジェクトに紐づきます。最初の 1 つを作りましょう。
      </p>
      <Form method="post" className="mt-6 flex gap-2">
        <input type="hidden" name="intent" value="createProject" />
        <Input name="name" placeholder="プロジェクト名" autoFocus required />
        <Button type="submit" disabled={isSubmitting}>
          作成
        </Button>
      </Form>
      {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
    </div>
  );
}

type QuickIntakeProps = {
  projects: Route.ComponentProps["loaderData"]["projects"];
  tags: Route.ComponentProps["loaderData"]["tags"];
};

function QuickIntake({ projects, tags }: QuickIntakeProps) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const tagFetcher = useFetcher<typeof action>();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [newTag, setNewTag] = useState("");

  // 進行中（endDate が null）のプロジェクトを既定選択。無ければ先頭。
  const defaultProjectId = (projects.find((p) => p.endDate === null) ?? projects[0]).id;

  const isSavingMemo =
    navigation.state !== "idle" && navigation.formData?.get("intent") !== "createTag";
  const memoError = actionData?.intent === "createMemo" && !actionData.ok ? actionData.error : null;

  // メモ保存成功でフォームをリセットして再フォーカス。
  useEffect(() => {
    if (actionData?.ok && actionData.intent === "createMemo") {
      formRef.current?.reset();
      setSelectedTags(new Set());
      textareaRef.current?.focus();
    }
  }, [actionData]);

  // インライン作成したタグは自動選択し、入力欄をクリア。
  useEffect(() => {
    const data = tagFetcher.data;
    if (data?.ok && data.intent === "createTag" && data.tagId) {
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
    <Form ref={formRef} method="post" className="flex flex-col gap-4">
      <div>
        <Textarea
          ref={textareaRef}
          name="body"
          rows={8}
          autoFocus
          required
          placeholder="いま学んだこと・成果を 1 分でメモ…"
          onKeyDown={onTextareaKeyDown}
          className="resize-y text-base"
        />
        <ul className="text-muted-foreground mt-2 space-y-0.5 text-xs">
          {HINTS.map((hint) => (
            <li key={hint}>・{hint}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">プロジェクト</span>
        <select
          name="projectId"
          defaultValue={defaultProjectId}
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
        {tagFetcher.data?.intent === "createTag" && !tagFetcher.data.ok && (
          <p className="text-destructive text-sm">{tagFetcher.data.error}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        {memoError && <p className="text-destructive mr-auto text-sm">{memoError}</p>}
        <span className="text-muted-foreground text-xs">⌘/Ctrl + Enter で保存</span>
        <Button type="submit" disabled={isSavingMemo}>
          保存
        </Button>
      </div>
    </Form>
  );
}
