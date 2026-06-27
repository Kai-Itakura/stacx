import { requireUser } from "../lib/auth.server";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "StacX" }, { name: "description", content: "1 分メモから職務経歴書へ" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return { user };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  return (
    <main className="container mx-auto p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">StacX</h1>
        {/* logout は api を直接叩く form（web worker が中継）。状態変更なので POST。 */}
        <form method="post" action="/api/auth/logout">
          <button type="submit" className="text-sm underline">
            ログアウト
          </button>
        </form>
      </div>
      <p className="mt-2">ようこそ、{user.name ?? user.email ?? "ゲスト"} さん。</p>
      <p className="mt-1 text-sm">フロントの基盤＋認証ができました。次は各画面を実装します。</p>
    </main>
  );
}
