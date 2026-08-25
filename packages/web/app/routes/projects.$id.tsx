import { Form, redirect } from "react-router";
import { z } from "zod";
import { Button } from "~/components/ui/button";
import { ProjectForm } from "~/features/projects/project-form";
import { projectFormSchema, toProjectPayload } from "~/features/projects/schema";
import { handleAction, unexpectedErrorSubmissionReply } from "~/lib/action-dispatcher.server";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/projects.$id";

const actionSchema = z.discriminatedUnion("intent", [
  projectFormSchema.extend({ intent: z.literal("edit") }),
  z.object({ intent: z.literal("delete") }),
]);

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
  const id = params.id;

  return handleAction(request, actionSchema, {
    edit: async (payload, submissionReply) => {
      try {
        const res = await client.api.projects[":id"].$put({
          param: { id },
          json: toProjectPayload(payload),
        });
        if (!res.ok) {
          return submissionReply({ formErrors: ["プロジェクトの更新に失敗しました"] });
        }
        return redirect("/projects");
      } catch (error) {
        console.error(error);
        return unexpectedErrorSubmissionReply(submissionReply);
      }
    },
    delete: async (_, submissionReply) => {
      try {
        const res = await client.api.projects[":id"].$delete({ param: { id } });
        if (!res.ok) {
          return submissionReply({ formErrors: ["プロジェクトの削除に失敗しました"] });
        }
        return redirect("/projects");
      } catch (error) {
        console.error(error);
        return unexpectedErrorSubmissionReply(submissionReply);
      }
    },
  });
}

export default function EditProject({ loaderData }: Route.ComponentProps) {
  const { project } = loaderData;
  return (
    <main className="container mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">プロジェクト編集</h1>
      <div className="mt-6">
        <ProjectForm project={project} submitLabel="更新" intent="edit" />
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
