# 08. デプロイ手順（最小・workers.dev）

StacX を Cloudflare Workers に最小構成でデプロイする手順。まずは workers.dev サブドメインで動かすことを目標にする。カスタムドメインは後から差し替え可能。

構成: **web worker（`stacx`）** がブラウザからのリクエストを受け、`/api/*` を **service binding** 経由で **api worker（`stacx-api`）** に中継する。認証（Google OIDC）は api worker が担う。

---

## 0. 前提

- Cloudflare アカウント（`wrangler login` 済み）
- Google Cloud で OAuth 2.0 クライアント（ウェブアプリケーション）を作成し、`client_id` / `client_secret` を取得済み
- リモート D1 `stacx-db` は作成済み（`packages/api/wrangler.toml` の `database_id` が正）。未作成なら `pnpm dlx wrangler d1 create stacx-db` で作成し ID を反映する

---

## 1. 公開 URL（APP_BASE_URL）

web worker（`stacx`）の公開 URL は、アカウント固定の workers.dev サブドメイン `itakai199969-e42` から決まる（サブドメインは変更不可）。

```
https://stacx.itakai199969-e42.workers.dev
```

これが `APP_BASE_URL`（Cookie とリダイレクトの基点）。`packages/api/wrangler.toml` の `[env.production.vars]` に設定済みなので、通常は編集不要。

```toml
[env.production.vars]
APP_BASE_URL = "https://stacx.itakai199969-e42.workers.dev"
```

> 独自ドメインへ移行する場合のみ、この値と Google 設定（手順2）・`packages/web/wrangler.jsonc` を新ドメインに更新する。

---

## 2. Google コンソールにリダイレクト URI を登録

作成した OAuth クライアントに以下を登録する（api のコールバックは `packages/api/src/auth/providers/google.ts` が `${APP_BASE_URL}/api/auth/callback/google` を組み立てる）。

- **承認済みのリダイレクト URI**: `https://stacx.itakai199969-e42.workers.dev/api/auth/callback/google`
- **承認済みの JavaScript 生成元**: `https://stacx.itakai199969-e42.workers.dev`

---

## 3. api の secret を投入し、リモート D1 をマイグレーション

```sh
cd packages/api

# 本番 worker（stacx-api）へ secret を登録
pnpm dlx wrangler secret put GOOGLE_CLIENT_ID --env production
pnpm dlx wrangler secret put GOOGLE_CLIENT_SECRET --env production

# リモート D1 にスキーマを適用（D1 は同一インスタンスなので --env は不要）
pnpm db:migrate:remote
```

---

## 4. api → web の順で本番デプロイ

web の service binding が `stacx-api` を名前参照するため、**api を先に**デプロイして worker を存在させる。

```sh
# api（stacx-api）
cd packages/api
pnpm deploy:production      # = wrangler deploy --env production

# web（stacx）
cd ../web
pnpm deploy
```

> 補足: `deploy:production` は `wrangler deploy --env production`。`wrangler.toml` の `[env.production]` で `name = "stacx-api"` を明示しているため、worker 名は `stacx-api` のまま（未指定だと `stacx-api-production` になり web の binding が壊れる）。

---

## 5. 動作確認

1. `https://stacx.itakai199969-e42.workers.dev` を開く
2. Google でログイン
3. メモを作成（`/`）
4. `/memos` で作成したメモが表示される

---

## カスタムドメインへ移行する場合

- web に custom domain（route）を割り当てる
- `APP_BASE_URL` をそのドメインに更新して api を再デプロイ
- Google コンソールのリダイレクト URI / JS 生成元を新ドメインに追加

---

## トラブルシュート

- **ログイン後に 400 / redirect_uri_mismatch**: Google のリダイレクト URI と `APP_BASE_URL` の不一致。手順1・2を再確認。
- **Cookie が付かない / ログイン状態が保持されない**: `APP_BASE_URL` が実 URL と一致しているか（Cookie 名を URL から導出しているため）。https であること。
- **web が API に到達しない**: `stacx-api` が先にデプロイ済みか、`packages/web/wrangler.jsonc` の `services` binding が `stacx-api` を指しているか確認。
