import { parseWithZod } from "@conform-to/zod/v4";
import { memoFormSchema } from "~/features/intake/schema";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/create-memo";

/** action 専用ルート。URL 直打ち（GET）には 404 を返す。 */
export function loader() {
  throw new Response("Not Found", { status: 404 });
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const formData = await request.formData();
  const client = apiClient(request);

  const submission = parseWithZod(formData, { schema: memoFormSchema });
  if (submission.status !== "success") return submission.reply();
  const { body, projectId, tagIds } = submission.value;
  const res = await client.api.memos.$post({
    json: { projectId, body, tagIds },
  });
  if (!res.ok) return submission.reply({ formErrors: ["メモの保存に失敗しました"] });
  return submission.reply({ resetForm: true });
}
