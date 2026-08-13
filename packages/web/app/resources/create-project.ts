import { parseWithZod } from "@conform-to/zod/v4";
import { projectFormSchema } from "~/features/intake/schema";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/create-project";

/** action 専用ルート。URL 直打ち（GET）には 404 を返す。 */
export function loader() {
  throw new Response("Not Found", { status: 404 });
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const formData = await request.formData();
  const client = apiClient(request);

  const submission = parseWithZod(formData, { schema: projectFormSchema });
  if (submission.status !== "success") return submission.reply();
  const res = await client.api.projects.$post({
    json: { name: submission.value.name, startDate: Date.now() },
  });
  if (!res.ok) return submission.reply({ formErrors: ["プロジェクトの作成に失敗しました"] });
  return submission.reply({ resetForm: true });
}
