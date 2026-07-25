# 08. デプロイ手順（最小・workers.dev）

StacX を Cloudflare Workers に最小構成でデプロイする手順。まずは workers.dev サブドメインで動かすことを目標にする。カスタムドメインは後から差し替え可能。

構成: **web worker（`stacx-web`）** がブラウザからのリクエストを受け、`/api/*` を **service binding** 経由で **api worker（`stacx-api`）** に中継する。認証（Google OIDC）は api worker が担う。

---

## 0. 前提

- Cloudflare アカウント（`wrangler login` 済み）
- Google Cloud で OAuth 2.0 クライアント（ウェブアプリケーション）を作成し、`client_id` / `client_secret` を取得済み
- リモート D1 `stacx-db` は作成済み（`packages/api/wrangler.toml` の `database_id` が正）。未作成なら `pnpm dlx wrangler d1 create stacx-db` で作成し ID を反映する

---

## 1. web を先に一度デプロイして公開 URL を確定する

`APP_BASE_URL`（Cookie とリダイレクトの基点）に web の公開 URL が必要だが、URL は初回デプロイで確定する。まず web を出す。

```sh
# api の service binding 先が未作成だと web デプロイ時に警告が出るが、URL 確認が目的なので先に web を出してよい
# （本番稼働は 3〜5 の順で行う）
cd packages/web
pnpm deploy
```

出力される `https://stacx-web.<YOUR_SUBDOMAIN>.workers.dev` を控える。以降この URL を `APP_BASE_URL` とする。

---

## 2. 設定に本番 URL を反映

- `packages/api/wrangler.toml` の `[env.production.vars]` の `APP_BASE_URL` を、手順1で確定した URL に更新する（`YOUR_SUBDOMAIN` を置換）。

```toml
[env.production.vars]
APP_BASE_URL = "https://stacx-web.<YOUR_SUBDOMAIN>.workers.dev"
```

---

## 3. Google コンソールにリダイレクト URI を登録

作成した OAuth クライアントに以下を登録する（api のコールバックは `packages/api/src/auth/providers/google.ts` が `${APP_BASE_URL}/api/auth/callback/google` を組み立てる）。

- **承認済みのリダイレクト URI**: `https://stacx-web.<YOUR_SUBDOMAIN>.workers.dev/api/auth/callback/google`
- **承認済みの JavaScript 生成元**: `https://stacx-web.<YOUR_SUBDOMAIN>.workers.dev`

---

## 4. api の secret を投入し、リモート D1 をマイグレーション

```sh
cd packages/api

# 本番 worker（stacx-api）へ secret を登録
pnpm dlx wrangler secret put GOOGLE_CLIENT_ID --env production
pnpm dlx wrangler secret put GOOGLE_CLIENT_SECRET --env production

# リモート D1 にスキーマを適用（D1 は同一インスタンスなので --env は不要）
pnpm db:migrate:remote
```

---

## 5. api → web の順で本番デプロイ

web の service binding が `stacx-api` を名前参照するため、**api を先に**デプロイして worker を存在させる。

```sh
# api（stacx-api）
cd packages/api
pnpm deploy:production      # = wrangler deploy --env production

# web（stacx-web）
cd ../web
pnpm deploy
```

> 補足: `deploy:production` は `wrangler deploy --env production`。`wrangler.toml` の `[env.production]` で `name = "stacx-api"` を明示しているため、worker 名は `stacx-api` のまま（未指定だと `stacx-api-production` になり web の binding が壊れる）。

---

## 6. 動作確認

1. `https://stacx-web.<YOUR_SUBDOMAIN>.workers.dev` を開く
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

- **ログイン後に 400 / redirect_uri_mismatch**: Google のリダイレクト URI と `APP_BASE_URL` の不一致。手順2・3を再確認。
- **Cookie が付かない / ログイン状態が保持されない**: `APP_BASE_URL` が実 URL と一致しているか（Cookie 名を URL から導出しているため）。https であること。
- **web が API に到達しない**: `stacx-api` が先にデプロイ済みか、`packages/web/wrangler.jsonc` の `services` binding が `stacx-api` を指しているか確認。
