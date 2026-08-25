import { Form, redirect } from "react-router";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { memoFormSchema } from "~/features/intake/schema";
import { MemoForm } from "~/features/memos/memo-form";
import { handleAction, unexpectedErrorSubmissionReply } from "~/lib/action-dispatcher.server";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/memos.$id.edit";

const actionSchema = z.discriminatedUnion("intent", [
  memoFormSchema.extend({ intent: z.literal("edit") }),
  z.object({ intent: z.literal("delete") }),
]);

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

  return handleAction(request, actionSchema, {
    edit: async ({ projectId, body, tagIds }, submissionReply) => {
      try {
        const res = await client.api.memos[":id"].$put({
          param: {
            id: params.id,
          },
          json: {
            projectId,
            body,
            tagIds,
          },
        });

        if (!res.ok) {
          return submissionReply({ formErrors: ["メモの更新に失敗しました。"] });
        }

        return redirect("/memos");
      } catch (error) {
        console.error(error);
        return unexpectedErrorSubmissionReply(submissionReply);
      }
    },
    delete: async (_, submissionReply) => {
      try {
        const res = await client.api.memos[":id"].$delete({ param: { id: params.id } });

        if (!res.ok) {
          return submissionReply({ formErrors: ["削除に失敗しました。"] });
        }

        return redirect("/memos");
      } catch (error) {
        console.error(error);
        return unexpectedErrorSubmissionReply(submissionReply);
      }
    },
  });
}

export default function EditMemo({ loaderData }: Route.ComponentProps) {
  const { memo, projects, tags } = loaderData;
  return (
    <main className="container mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">メモを編集</h1>
      <div className="mt-6">
        <MemoForm memo={memo} projects={projects} tags={tags} />
      </div>

      <div className="mt-8 border-t pt-6">
        <Form
          method="post"
          onSubmit={(e) => {
            // star_logs は memo_id の FK が cascade なので、STAR 化した内容も一緒に消える。
            if (!confirm("このメモを削除しますか？STAR 化した内容も一緒に削除されます。")) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <Button type="submit" variant="destructive">
            メモを削除
          </Button>
        </Form>
      </div>
    </main>
  );
}
