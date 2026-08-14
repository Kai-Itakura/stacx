import { EmptyProjectState } from "~/features/intake/empty-project-state";
import { QuickIntake } from "~/features/intake/quick-intake";
import { type RecentMemo, RecentMemos } from "~/features/intake/recent-memos";
import { apiClient } from "~/lib/api.server";
import type { Route } from "./+types/home";

const RECENT_LIMIT = 5;

export function meta() {
  return [{ title: "StacX" }, { name: "description", content: "1 分メモから職務経歴書へ" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const client = apiClient(request);
  const [projectsRes, tagsRes, memosRes] = await Promise.all([
    client.api.projects.$get(),
    client.api.tags.$get(),
    client.api.memos.$get(),
  ]);
  const projects = projectsRes.ok ? (await projectsRes.json()).projects : [];
  const tags = tagsRes.ok ? (await tagsRes.json()).tags : [];
  const memos = memosRes.ok ? (await memosRes.json()).memos : [];

  // listMemos が作成日の降順で返すため、並べ替えずに先頭を取る。
  const recent: RecentMemo[] = memos
    .slice(0, RECENT_LIMIT)
    .map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt }));

  return { projects, tags, recent };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { projects, tags, recent } = loaderData;

  if (projects.length === 0) {
    return (
      <main className="container mx-auto max-w-2xl p-6">
        <EmptyProjectState />
      </main>
    );
  }

  return (
    <main className="container mx-auto flex min-h-0 flex-1 flex-col gap-3 p-4 md:max-w-2xl md:p-6">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <RecentMemos memos={recent} />
      </div>
      <QuickIntake projects={projects} tags={tags} />
    </main>
  );
}
