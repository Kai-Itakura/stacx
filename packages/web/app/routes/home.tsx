import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { EmptyProjectState } from "~/features/intake/empty-project-state";
import { QuickIntake } from "~/features/intake/quick-intake";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/home";

export function meta() {
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
