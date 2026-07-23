import { Link } from "react-router";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { ProjectList } from "~/features/projects/project-list";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/projects";

export function meta(_: Route.MetaArgs) {
  return [{ title: "プロジェクト | StacX" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  const client = apiClient(request);
  const res = await client.api.projects.$get();
  const projects = res.ok ? (await res.json()).projects : [];
  return { projects };
}

export default function Projects({ loaderData }: Route.ComponentProps) {
  const { projects } = loaderData;
  return (
    <main className="container mx-auto max-w-2xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">プロジェクト</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="outline">
            <Link to="/">メモ</Link>
          </Button>
          <Button asChild>
            <Link to="/projects/new">新規作成</Link>
          </Button>
        </div>
      </header>

      <div className="mt-8">
        <ProjectList projects={projects} />
      </div>
    </main>
  );
}
