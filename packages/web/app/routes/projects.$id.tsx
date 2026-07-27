import { parseWithZod } from "@conform-to/zod/v4";
import { Form, redirect } from "react-router";
import { Button } from "~/components/ui/button";
import { ProjectForm } from "~/features/projects/project-form";
import { projectFormSchema, toProjectPayload } from "~/features/projects/schema";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/projects.$id";

export function meta(_: Route.MetaArgs) {
  return [{ title: "プロジェクト編集 | StacX" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const client = apiClient(request);
  const res = await client.api.projects[":id"].$get({ param: { id: params.id } });
  if (!res.ok) throw new Response("Not Found", { status: 404 });
  const { project } = await res.json();
  return { project };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const client = apiClient(request);
  const formData = await request.formData();
  const id = params.id;

  // 削除は非フォームの副作用。確認は UI 側で行い、成功後に一覧へ戻す。
  if (formData.get("intent") === "delete") {
    const res = await client.api.projects[":id"].$delete({ param: { id } });
    if (!res.ok) throw new Response("削除に失敗しました", { status: 500 });
    return redirect("/projects");
  }

  const submission = parseWithZod(formData, { schema: projectFormSchema });
  if (submission.status !== "success") return submission.reply();
  const res = await client.api.projects[":id"].$put({
    param: { id },
    json: toProjectPayload(submission.value),
  });
  if (!res.ok) return submission.reply({ formErrors: ["プロジェクトの更新に失敗しました"] });
  return redirect("/projects");
}

export default function EditProject({ loaderData }: Route.ComponentProps) {
  const { project } = loaderData;
  return (
    <main className="container mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">プロジェクト編集</h1>
      <div className="mt-6">
        <ProjectForm project={project} submitLabel="更新" />
      </div>

      <div className="mt-8 border-t pt-6">
        <Form
          method="post"
          onSubmit={(e) => {
            if (!confirm("このプロジェクトを削除しますか？関連するメモも削除されます。")) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <Button type="submit" variant="destructive">
            プロジェクトを削除
          </Button>
        </Form>
      </div>
    </main>
  );
}
