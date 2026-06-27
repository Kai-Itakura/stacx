import { redirect } from "react-router";
import { getUser } from "../lib/auth.server";
import type { Route } from "./+types/login";

export function meta(_: Route.MetaArgs) {
  return [{ title: "ログイン - StacX" }];
}

/** 既にログイン済みならホームへ。 */
export async function loader({ request }: Route.LoaderArgs) {
  if (await getUser(request)) throw redirect("/");
  return null;
}

export default function Login() {
  return (
    <main className="container mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">StacX</h1>
        <p className="mt-1 text-sm">1 分メモから職務経歴書へ</p>
      </div>
      {/* api worker への直接遷移（web worker が /api/* を中継）。RR の Link ではなく素の遷移にする。 */}
      <a
        href="/api/auth/login/google"
        className="rounded-md border px-4 py-2 text-center font-medium hover:bg-gray-50"
      >
        Google でログイン
      </a>
    </main>
  );
}
