import { parseWithZod } from "@conform-to/zod/v4";
import { StarEditor } from "~/features/memos/star-editor";
import { type StarEditorMemo, starFormSchema, toStarPayload } from "~/features/memos/star-schema";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/memos.$id.star";

export function meta(_: Route.MetaArgs) {
  return [{ title: "STAR エディタ | StacX" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const client = apiClient(request);
  const [memoRes, starRes, projectsRes, tagsRes] = await Promise.all([
    client.api.memos[":id"].$get({ param: { id: params.id } }),
    client.api.memos[":id"].star.$get({ param: { id: params.id } }),
    client.api.projects.$get(),
    client.api.tags.$get(),
  ]);
  if (!memoRes.ok) throw new Response("Not Found", { status: 404 });

  const { memo } = await memoRes.json();
  const star = starRes.ok ? (await starRes.json()).star : null;
  const projects = projectsRes.ok ? (await projectsRes.json()).projects : [];
  const tags = tagsRes.ok ? (await tagsRes.json()).tags : [];

  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const editorMemo: StarEditorMemo = {
    id: memo.id,
    title: memo.title,
    body: memo.body,
    projectName: projectName.get(memo.projectId) ?? "（不明なプロジェクト）",
    tagNames: memo.tagIds.map((id) => tagName.get(id)).filter((n): n is string => n != null),
  };
  const values = {
    situation: star?.situation ?? "",
    task: star?.task ?? "",
    action: star?.action ?? "",
    result: star?.result ?? "",
  };

  return { memo: editorMemo, values };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const client = apiClient(request);
  const submission = parseWithZod(await request.formData(), { schema: starFormSchema });
  if (submission.status !== "success") return submission.reply();

  const res = await client.api.memos[":id"].star.$put({
    param: { id: params.id },
    json: toStarPayload(submission.value),
  });
  if (!res.ok) return submission.reply({ formErrors: ["STAR の保存に失敗しました"] });
  return submission.reply();
}

export default function StarEditorRoute({ loaderData }: Route.ComponentProps) {
  const { memo, values } = loaderData;
  return (
    <main className="container mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-bold">STAR エディタ</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        メモを Situation / Task / Action / Result に整理して、経歴書で使える形にします。
      </p>
      <div className="mt-6">
        <StarEditor memo={memo} values={values} />
      </div>
    </main>
  );
}
