import { redirect } from "react-router";
import { apiClient } from "./api.server";

/** 現在のユーザーを返す。未認証(401)なら null。 */
export async function getUser(request: Request) {
  const res = await apiClient(request).api.me.$get();
  if (!res.ok) return null;
  const { user } = await res.json();
  return user;
}

/** 認証必須。未認証なら /login へリダイレクト。 */
export async function requireUser(request: Request) {
  const user = await getUser(request);
  if (!user) throw redirect("/login");
  return user;
}
