import { tagFormSchema } from "~/features/intake/schema";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/create-tag";

/** action 専用ルート。URL 直打ち（GET）には 404 を返す。 */
export function loader() {
  throw new Response("Not Found", { status: 404 });
}

/** タグのインライン作成（fetcher）の戻り値。 */
export type TagFetcherResult = { ok: true; tagId: string } | { ok: false; error: string };

export async function action({ request }: Route.ActionArgs): Promise<TagFetcherResult> {
  await requireUser(request);
  const data = await request.json();
  const parsedResult = tagFormSchema.safeParse(data);
  if (!parsedResult.success) {
    return { ok: false, error: parsedResult.error.issues[0].message };
  }

  const res = await apiClient(request).api.tags.$post({ json: parsedResult.data });
  if (!res.ok) {
    return {
      ok: false,
      error: res.status === 409 ? "同名のタグが既にあります" : "タグの作成に失敗しました",
    };
  }

  const result = await res.json();
  return { ok: true, tagId: result.id };
}
