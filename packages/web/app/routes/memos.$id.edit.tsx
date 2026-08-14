import { parseWithZod } from "@conform-to/zod/v4";
import { redirect } from "react-router";
import { memoFormSchema } from "~/features/intake/schema";
import { MemoForm } from "~/features/memos/memo-form";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/memos.$id.edit";

export function meta(_: Route.MetaArgs) {
  return [{ title: "メモを編集 | StacX" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const client = apiClient(request);
  const [memoRes, projectsRes, tagsRes] = await Promise.all([
    client.api.memos[":id"].$get({ param: { id: params.id } }),
    client.api.projects.$get(),
    client.api.tags.$get(),
  ]);
  if (!memoRes.ok) throw new Response("Not Found", { status: 404 });

  const { memo } = await memoRes.json();
  const projects = projectsRes.ok ? (await projectsRes.json()).projects : [];
  const tags = tagsRes.ok ? (await tagsRes.json()).tags : [];

  return {
    memo: { body: memo.body, projectId: memo.projectId, tagIds: memo.tagIds },
    projects,
    tags,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const client = apiClient(request);
  const submission = parseWithZod(await request.formData(), { schema: memoFormSchema });
  if (submission.status !== "success") return submission.reply();

  const { body, projectId, tagIds } = submission.value;
  const res = await client.api.memos[":id"].$put({
    param: { id: params.id },
    json: { body, projectId, tagIds: tagIds ?? [] },
  });
  if (!res.ok) return submission.reply({ formErrors: ["メモの更新に失敗しました"] });
  return redirect("/memos");
}

export default function EditMemo({ loaderData }: Route.ComponentProps) {
  const { memo, projects, tags } = loaderData;
  return (
    <main className="container mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">メモを編集</h1>
      <div className="mt-6">
        <MemoForm memo={memo} projects={projects} tags={tags} />
      </div>
    </main>
  );
}
