# @stacx/web

StacX のフロントエンド（React Router v7 フレームワークモード、Cloudflare Workers 上で SSR）。

開発・テスト・デプロイの手順はリポジトリルートの `docs/06-development.md` と `docs/08-deploy.md` を参照。
`pnpm --filter @stacx/web run deploy` のように、スクリプトを呼ぶときは **`run` を挟む**（`deploy` は pnpm の組み込みコマンドと衝突する）。
