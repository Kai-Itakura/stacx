# web も Workers に載せ、path 分割ではなく Service Binding で同一オリジンを実現する

Supersedes [ADR 0001](./0001-pages-and-workers-split-deployment.md)。

web（React Router v7 SSR）を Cloudflare Pages ではなく **Workers** にデプロイし、web worker（`stacx`）が受けた `/api/*` を **Service Binding** 経由で api worker（`stacx-api`）へ中継する構成にする。ブラウザから見ると単一オリジン（web worker の URL）で完結し、api worker は公開ルートを持たない。

ADR 0001 は「web は Pages、api は Workers、カスタムドメインの path 分割で同一オリジン」としていたが、実装はこの構成に変更された。0001 の目的（同一オリジンで Cookie / CORS の煩雑さを回避しつつ、web と api を独立してデプロイする）は維持している。**変わったのは同一オリジンの実現手段**で、DNS/ルーティング層の path 分割から、web worker 内での中継に移した。

## Considered Options

- **Pages + Workers の path 分割（ADR 0001 の当初案）**: 同一オリジンは実現できるが、**カスタムドメインの取得と Workers Routes 設定が本番デプロイの前提条件**になる。workers.dev サブドメインだけで動かし始められない。またビルド設定が Pages 側の GUI 設定と `wrangler.toml` の 2 系統に分かれ、リポジトリから構成が読み取れない。
- **Workers + Workers を Service Binding で接続（採用）**: web/api とも `wrangler.toml` / `wrangler.jsonc` で構成が完結し、リポジトリだけを見れば分かる。api への呼び出しが**公開網を経由しない worker 間の直接呼び出し**になるためレイテンシと露出面で有利。カスタムドメインなしで workers.dev のまま動かせるので、個人利用フェーズを最短で始められる。
- **シングル Worker（RR v7 SSR + Hono 同居）**: デプロイ単位が 1 つで最もシンプルだが、web/api を独立にロールバックできない。ADR 0001 の判断（分離）を踏襲して採らない。

## Consequences

- **デプロイ順序が api → web に固定される。** web の Service Binding は worker 名（`stacx-api` / `stacx-api-staging`）を**名前で参照**するため、api worker が存在しない状態で web を出すとバインディングが壊れる。CI/CD もこの順序を守る。
- **SSR の loader/action は `env.API.fetch` で api を叩く**（`packages/web/app/lib/api.server.ts`）。Hono RPC クライアントの `baseUrl` は Service Binding では無視されるためダミー値を渡している。受信リクエストの Cookie を明示的に転送してセッション認証を引き継ぐ。
- **api worker は公開ルートを持たない前提**。ブラウザからの `/api/*` は web worker（`packages/web/workers/app.ts`）が中継する。
- **環境ごとに worker が 1 セットずつ必要**になる（`stacx` / `stacx-api`、`stacx-staging` / `stacx-api-staging`）。Pages のプレビューデプロイに相当する仕組みは使えないため、検証は staging 環境で行う。
- **web の環境はビルド時に確定する。** `react-router build`（`@cloudflare/vite-plugin`）が `wrangler.jsonc` を解決して `build/server/wrangler.json` を生成し、`wrangler deploy` はそれを使う。そのためデプロイ時の `--env` では切り替わらず、ビルド時に `CLOUDFLARE_ENV` を渡す必要がある。api（`wrangler deploy --env`）と挙動が異なる点に注意（詳細は `docs/08-deploy.md`）。
- カスタムドメインへ移行する場合は web worker にドメインを割り当て、`APP_BASE_URL` と Google OIDC のリダイレクト URI を更新する。**path 分割ルーティングは不要**になった。
