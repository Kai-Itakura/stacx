import { apiClient } from "~/lib/api.server";
import type { Route } from "./+types/logout";

/** action 専用ルート。URL 直打ち（GET）には 404 を返す。 */
export function loader() {
  throw new Response("Not Found", { status: 404 });
}

/** POST /resources/logout — セッションを失効させ /login へリダイレクトする。 */
export async function action({ request }: Route.ActionArgs) {
  const res = await apiClient(request).api.auth.logout.$post();

  // Set-Cookie を転送しないとセッション Cookie が残り続けログアウトが成立しない。
  const headers = new Headers({ location: "/login" });
  const cookie = res.headers.get("set-cookie");
  if (cookie) headers.set("set-cookie", cookie);

  return new Response(null, { status: 302, headers });
}
