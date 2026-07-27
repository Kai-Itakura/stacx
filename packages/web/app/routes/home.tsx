import { EmptyProjectState } from "~/features/intake/empty-project-state";
import { QuickIntake } from "~/features/intake/quick-intake";
import { apiClient } from "~/lib/api.server";
import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "StacX" }, { name: "description", content: "1 分メモから職務経歴書へ" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const client = apiClient(request);
  const [projectsRes, tagsRes] = await Promise.all([
    client.api.projects.$get(),
    client.api.tags.$get(),
  ]);
  const projects = projectsRes.ok ? (await projectsRes.json()).projects : [];
  const tags = tagsRes.ok ? (await tagsRes.json()).tags : [];
  return { projects, tags };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { projects, tags } = loaderData;
  return (
    <main className="container mx-auto max-w-2xl p-6">
      {projects.length === 0 ? (
        <EmptyProjectState />
      ) : (
        <QuickIntake projects={projects} tags={tags} />
      )}
    </main>
  );
}
