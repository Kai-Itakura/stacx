import { parseWithZod } from "@conform-to/zod/v4";
import { redirect } from "react-router";
import { ProjectForm } from "~/features/projects/project-form";
import { projectFormSchema, toProjectPayload } from "~/features/projects/schema";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/projects.new";

export function meta(_: Route.MetaArgs) {
  return [{ title: "新規プロジェクト | StacX" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const submission = parseWithZod(await request.formData(), { schema: projectFormSchema });
  if (submission.status !== "success") return submission.reply();

  const client = apiClient(request);
  const res = await client.api.projects.$post({ json: toProjectPayload(submission.value) });
  if (!res.ok) return submission.reply({ formErrors: ["プロジェクトの作成に失敗しました"] });

  return redirect(`/projects`);
}

export default function NewProject() {
  return (
    <main className="container mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">新規プロジェクト</h1>
      <div className="mt-6">
        <ProjectForm submitLabel="作成" />
      </div>
    </main>
  );
}
