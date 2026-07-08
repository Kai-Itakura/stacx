import { parseWithZod } from "@conform-to/zod/v4";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { EmptyProjectState } from "~/features/intake/empty-project-state";
import { QuickIntake } from "~/features/intake/quick-intake";
import {
  deriveTitle,
  memoFormSchema,
  projectFormSchema,
  tagFormSchema,
} from "~/features/intake/schema";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "StacX" }, { name: "description", content: "1 分メモから職務経歴書へ" }];
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
    return createTag(formData, client);
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

async function createTag(formData: FormData, client: ReturnType<typeof apiClient>) {
  const parsed = tagFormSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success)
    return {
      ok: false as const,
      intent: "createTag" as const,
      error: parsed.error.issues[0]?.message ?? "タグ名を入力してください",
    };
  const res = await client.api.tags.$post({ json: { name: parsed.data.name } });
  if (!res.ok) {
    const error = res.status === 409 ? "同名のタグが既にあります" : "タグの作成に失敗しました";
    return { ok: false as const, intent: "createTag" as const, error };
  }
  const { id } = await res.json();
  return { ok: true as const, intent: "createTag" as const, tagId: id };
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
        {projects.length === 0 ? (
          <EmptyProjectState />
        ) : (
          <QuickIntake projects={projects} tags={tags} />
        )}
      </div>
    </main>
  );
}
