import { MemoList, type MemoListItem } from "~/features/memos/memo-list";
import { apiClient } from "~/lib/api.server";
import type { Route } from "./+types/memos";

export function meta(_: Route.MetaArgs) {
  return [{ title: "メモ一覧 | StacX" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const client = apiClient(request);
  const [memosRes, projectsRes, tagsRes] = await Promise.all([
    client.api.memos.$get(),
    client.api.projects.$get(),
    client.api.tags.$get(),
  ]);
  const memos = memosRes.ok ? (await memosRes.json()).memos : [];
  const projects = projectsRes.ok ? (await projectsRes.json()).projects : [];
  const tags = tagsRes.ok ? (await tagsRes.json()).tags : [];

  // projectId → 名前 / tagId → 名前 を引くマップを作り、表示用に整形する。
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const items: MemoListItem[] = memos.map((m) => ({
    id: m.id,
    title: m.title,
    body: m.body,
    createdAt: m.createdAt,
    projectName: projectName.get(m.projectId) ?? "（不明なプロジェクト）",
    tagNames: m.tagIds.map((id) => tagName.get(id)).filter((n): n is string => n != null),
  }));

  return { memos: items };
}

export default function Memos({ loaderData }: Route.ComponentProps) {
  const { memos } = loaderData;
  return (
    <main className="container mx-auto max-w-2xl p-6">
      <MemoList memos={memos} />
    </main>
  );
}
