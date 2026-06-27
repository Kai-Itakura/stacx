import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "StacX" }, { name: "description", content: "1 分メモから職務経歴書へ" }];
}

export default function Home() {
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-2xl font-bold">StacX</h1>
      <p className="mt-2">フロントエンドの足場を構築しました。これから各画面を実装していきます。</p>
    </main>
  );
}
