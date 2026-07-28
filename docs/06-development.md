# 06. 開発フロー・コマンド一覧

## 初期セットアップ

    # リポジトリクローン後
    pnpm install

    # Cloudflare 認証
    npx wrangler login

    # D1 データベース作成
    cd packages/api
    npx wrangler d1 create stacx-db
    # 表示された database_id を wrangler.toml に記録

    # マイグレーション生成・適用
    pnpm drizzle-kit generate
    npx wrangler d1 migrations apply stacx-db --local

---

## 日常の開発コマンド

    # 全パッケージ並列起動
    pnpm dev          # ルートから pnpm -r --parallel dev のエイリアス

    # フロントのみ起動
    pnpm dev:web      # = pnpm --filter @stacx/web dev

    # API のみ起動
    pnpm dev:api      # = pnpm --filter @stacx/api dev

    # 型チェック
    pnpm typecheck    # = pnpm -r typecheck

    # Lint
    pnpm lint         # = pnpm -r lint

    # ビルド
    pnpm build        # = pnpm -r build

---

## DB マイグレーション

    # スキーマ変更後、マイグレーションファイル生成
    pnpm --filter @stacx/api db:generate

    # ローカル D1 に適用
    pnpm --filter @stacx/api db:migrate:local

    # 本番 D1 に適用
    pnpm --filter @stacx/api db:migrate:remote

    # DB を直接クエリ（デバッグ用）
    cd packages/api && npx wrangler d1 execute stacx-db --local --command="SELECT * FROM users"

---

## デプロイ

api / web とも **Cloudflare Workers**（web も Pages ではなく Workers。`packages/web/workers/app.ts` がエントリ）。

### 自動デプロイ（既定）

`main` への push で CI（Biome / typecheck / test）が通ると、`.github/workflows/deploy.yml` が
**api → web の順**に本番へデプロイする。この順序は固定で、崩してはいけない。
web の service binding が worker 名 `stacx-api` を参照するため、api が先に存在しないと
バインディングが壊れる。

必要な GitHub Secrets:

| 名前 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Workers / D1 の編集権限を持つ API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | 対象アカウント ID |

### 手動デプロイ

    pnpm --filter @stacx/api run deploy:production   # wrangler deploy --env production
    pnpm --filter @stacx/web run deploy              # build して wrangler deploy

`pnpm --filter <pkg> deploy` は pnpm 組み込みの `deploy` コマンドとして解釈されるため、
スクリプトを呼ぶときは **`run` を挟む**こと。

### PR プレビュー

PR を開くと `.github/workflows/preview.yml` が `wrangler versions upload` でバージョンを
アップロードし、プレビュー URL を PR にコメントする。**本番の配信は現行バージョンのまま**変わらない。
URL は `<branch>-<worker-name>.<subdomain>.workers.dev` で、同じブランチに commit を足しても変わらない。

**プレビューは本番 D1 に接続する。** バージョンが保持するのはコード・設定・バインディングまでで、
D1 の中身はバージョン管理されない。破壊的な書き込みを含む変更をプレビュー URL で試すと本番データに影響する。
また web のプレビューが呼ぶ api は **本番にデプロイ済みのバージョン**（service binding が名前参照のため）。

---

## D1 マイグレーション（本番）

**CD では自動適用しない。** ステージング用の D1 が存在せず、リモートの D1 は本番の 1 個だけなので、
リハーサルできないまま CI から不可逆な変更が走るのを避けている。

スキーマ変更を含むリリースでは、デプロイとは別に手動で実行する。

    # 適用前に必ず内容を確認する
    pnpm --filter @stacx/api exec wrangler d1 migrations list stacx-db --remote
    pnpm --filter @stacx/api exec wrangler d1 migrations apply stacx-db --remote

順序は「マイグレーション適用 → デプロイ」。新しいカラムを読むコードを先に出すと、
適用までの間だけ本番が壊れる。

---

## Secret 管理

    # 本番 secret 登録 (packages/api 配下で実行)
    cd packages/api
    npx wrangler secret put GOOGLE_CLIENT_ID --env production
    npx wrangler secret put GOOGLE_CLIENT_SECRET --env production

`--env production` を付けるのは、本番の worker が `[env.production]` 側の設定で動くため。
省くと既定環境に登録され、本番からは参照できない。

ローカルは `packages/api/.dev.vars` に記述（Git 管理外）。

---

## ブランチ戦略（個人開発）

- `main`: 安定版、本番デプロイ対象
- `feat/*`: 機能開発
- `fix/*`: バグ修正

PR を切らず直接 push でも問題ないが、後で経歴書に書く時に PR 履歴があると説明しやすい。

---

## コミットメッセージ規約

Conventional Commits を採用:

- `feat: クイックメモ画面を追加`
- `fix: STAR エディタで保存が効かない問題を修正`
- `docs: CLAUDE.md に開発フローを追記`
- `refactor: 認証ミドルウェアを共通化`
- `chore: drizzle-kit を更新`

---

## ローカル開発の同一オリジン化（Vite dev proxy）

web と api は別ポートで起動するが、ブラウザから見て同一オリジンになるよう Vite proxy で `/api/*` を api ワーカーに転送する。これにより本番 (path 分割同一オリジン、ADR 0001) と挙動が一致し、CORS / cross-origin Cookie の設定が不要になる。

    // packages/web/vite.config.ts
    export default defineConfig({
      server: {
        proxy: {
          '/api': 'http://localhost:8787',
        },
      },
    });

web からの API 呼び出しは常に相対パス `/api/...` を使う。`VITE_API_BASE_URL` のような環境変数は導入しない。

---

## トラブルシューティング

### `wrangler dev` でローカル D1 にデータが入らない
- `--local` フラグを忘れていないか確認
- ローカル D1 は `.wrangler/state` 配下に保存される

### `/api/...` を叩いて 404 になる
- Vite proxy が設定されているか (`vite.config.ts` の `server.proxy`)
- wrangler dev が `localhost:8787` で起動しているか

### Hono RPC の型が反映されない
- API 側で `app.routes` を export しているか
- フロント側で型インポートのパスが合っているか
