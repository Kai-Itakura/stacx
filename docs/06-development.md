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

    # staging / production の D1 に適用（対象を取り違えないよう環境を名前に含めている）
    pnpm --filter @stacx/api db:migrate:staging
    pnpm --filter @stacx/api db:migrate:production

    # DB を直接クエリ（デバッグ用）
    cd packages/api && npx wrangler d1 execute stacx-db --local --command="SELECT * FROM users"

---

## デプロイ

api / web とも **Cloudflare Workers**（web も Pages ではなく Workers。`packages/web/workers/app.ts` がエントリ）。

### 環境

| 環境 | api worker | web worker | D1 | URL |
|---|---|---|---|---|
| staging | `stacx-api-staging` | `stacx-staging` | `stacx-db-staging` | https://stacx-staging.itakai199969-e42.workers.dev |
| production | `stacx-api` | `stacx` | `stacx-db` | https://stacx.itakai199969-e42.workers.dev |

D1 は**環境ごとに別データベース**。ここを共有すると staging の意味が消える。

### 自動デプロイ（既定）

`.github/workflows/deploy.yml` が CI（Biome / typecheck / test）の成功に相乗りして動く。
**デプロイ先はブランチで決まる**。

| ブランチ | デプロイ先 |
|---|---|
| `stg` | staging のみ |
| `main` | production のみ |

2 つのジョブは**独立**していて、staging の成否は production をブロックしない。
そのため「staging を経ずに production へ出せてしまう」ことに注意（→ 運用は
[ブランチ戦略](#ブランチ戦略stg--main)を参照）。

各環境の中では次の順序を守る。この順序は固定で、崩してはいけない。

1. D1 マイグレーション適用
2. api デプロイ
3. web デプロイ

- **マイグレーションが先**なのは、新しいカラムを読むコードを先に出すと、適用までの間だけ壊れた状態が生まれるため。
- **api が web より先**なのは、web の service binding が worker 名（`stacx-api` / `stacx-api-staging`）を
  参照するため、api が存在しないとバインディングが壊れるため。

必要な GitHub Secrets:

| 名前 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Workers / D1 の編集権限を持つ API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | 対象アカウント ID |

production ジョブは `environment: production` を指定しているので、GitHub の
Settings → Environments で承認者を設定すれば、ワークフローを変更せず手動承認ゲートにできる。

### 手動デプロイ

    # staging
    pnpm --filter @stacx/api run deploy:staging
    pnpm --filter @stacx/web run deploy:staging

    # production
    pnpm --filter @stacx/api run deploy:production
    pnpm --filter @stacx/web run deploy

`pnpm --filter <pkg> deploy` は pnpm 組み込みの `deploy` コマンドとして解釈されるため、
スクリプトを呼ぶときは **`run` を挟む**こと。

#### web の環境はビルド時に決まる（要注意）

api は `wrangler deploy --env staging` で環境が切り替わるが、**web は切り替わらない**。
`react-router build`（`@cloudflare/vite-plugin`）が `wrangler.jsonc` を解決して
`build/server/wrangler.json` を生成し、`wrangler deploy` はそちらを使うため、
デプロイ時に `--env` を付けても **top-level（＝本番）の設定のまま出てしまう**。

環境はビルド時に `CLOUDFLARE_ENV` で指定する。

    CLOUDFLARE_ENV=staging pnpm --filter @stacx/web run build

`deploy:staging` スクリプトはこれを含んでいる。手でビルドしてから deploy する場合も忘れないこと。
忘れると `stacx-staging` ではなく **本番の `stacx` を上書きデプロイする**ので影響が大きい。
確認は生成物を見るのが確実。

    node -e "const c=require('./packages/web/build/server/wrangler.json'); console.log(c.name, JSON.stringify(c.services))"
    # staging なら → stacx-staging [{"binding":"API","service":"stacx-api-staging"}]

---

## D1 マイグレーション

CD がデプロイ先の環境に対して自動適用する（`stg` → staging / `main` → production）。
**ワークフロー側に「staging を先に通す」強制は無い**ため、`stg` → `main` の順で流すこと自体が
リハーサルを保証している。手で流す場合も同じ順序で行う。

    # 未適用の一覧を確認
    pnpm --filter @stacx/api exec wrangler d1 migrations list stacx-db-staging --remote --env staging

    # staging へ適用してから production
    pnpm --filter @stacx/api run db:migrate:staging
    pnpm --filter @stacx/api run db:migrate:production

ローカルは `pnpm --filter @stacx/api run db:migrate:local`（`.wrangler/state` の SQLite）。

なお **D1 の中身はロールバックできない**。破壊的な変更（カラム削除・型変更など）を含む場合は、
staging で通ったことをもって安全とみなさず、本番データのバックアップ方針を先に決めること。

---

## Secret 管理

secret は**環境ごとに独立**している。`--env` を付けないと既定環境に登録され、
staging / production のどちらからも参照できない。

    cd packages/api

    # staging
    npx wrangler secret put GOOGLE_CLIENT_ID --env staging
    npx wrangler secret put GOOGLE_CLIENT_SECRET --env staging

    # production
    npx wrangler secret put GOOGLE_CLIENT_ID --env production
    npx wrangler secret put GOOGLE_CLIENT_SECRET --env production

ローカルは `packages/api/.dev.vars` に記述（Git 管理外）。

### Google OIDC のリダイレクト URI

redirect_uri は `${APP_BASE_URL}/api/auth/callback/google` として組み立てられる
（`packages/api/src/auth/providers/google.ts`）。`APP_BASE_URL` は環境ごとに違うため、
**Google Cloud Console の「承認済みのリダイレクト URI」に環境の数だけ登録が必要**。

| 環境 | 登録する URI |
|---|---|
| ローカル | `http://localhost:5173/api/auth/callback/google` |
| staging | `https://stacx-staging.itakai199969-e42.workers.dev/api/auth/callback/google` |
| production | `https://stacx.itakai199969-e42.workers.dev/api/auth/callback/google` |

登録を忘れると、その環境だけログインが `redirect_uri_mismatch` で失敗する。
デプロイ自体は成功するので気づきにくい。

なお `APP_BASE_URL` はセッション Cookie 名の切り替えにも使われる
（http なら `stacx_session` / https なら `__Host-stacx_session`。`auth/cookie.ts`）。

---

## ブランチ戦略（stg → main）

| ブランチ | 役割 | デプロイ先 |
|---|---|---|
| `main` | 安定版 | **production** |
| `stg` | リリース前の検証 | **staging** |
| `feat/*` | 機能開発 | なし |
| `fix/*` | バグ修正 | なし |

### リリースの流れ

```
feat/* または fix/*
      │  PR
      ▼
    stg  ──▶ CI 成功 ──▶ staging へ自動デプロイ
      │                    │
      │                    ▼
      │              staging で動作確認（特に D1 マイグレーション）
      │  PR
      ▼
    main ──▶ CI 成功 ──▶ production へ自動デプロイ
```

1. `feat/*` / `fix/*` で作業し、**`stg` へ PR を出してマージする**
2. CI 成功で staging へ自動デプロイされる（マイグレーション → api → web）
3. staging で動作確認する。**特にスキーマ変更を含む場合は必ずここで確認する**
4. 問題なければ **`stg` から `main` へ PR を出してマージする**
5. CI 成功で production へ自動デプロイされる

### なぜ `main` へ直接入れてはいけないか

CD の staging ジョブと production ジョブは**独立**していて、`needs` の依存関係が無い。
つまり **`main` に直接入った変更は staging を経ずに本番 D1 へマイグレーションが当たる**。

D1 のマイグレーションは**不可逆**（ロールバックできない）。破壊的な SQL を本番で初めて実行することに
なるため、`stg` を飛ばさないことが唯一の防波堤になっている。

現状これを止めているのは**この運用の約束のみで、仕組みでは担保されていない**。
ブランチ保護や承認ゲートによる担保は #67 で検討中。

### 仕組みでの担保

`main` への PR は `stg` からのみ許可される（`.github/workflows/restrict-pr-source.yml`）。
それ以外の head ブランチから `main` へ PR を出すと `check-source-branch` が落ちる。

> **このチェックは required status check に指定して初めて強制力を持つ。**
> Settings → Branches → `main` のブランチ保護ルールで、`check-source-branch` を
> 必須チェックに追加すること。指定しないと「赤くなるがマージはできる」状態にしかならない。
> あわせて `main` への直接 push も禁止する。

### 例外を通す場合（hotfix ラベル）

`stg` に未完了の変更が乗っていて hotfix を出せない、といった状況のための逃げ道として、
PR に **`hotfix` ラベル**を付けるとチェックを通過できる。

ただしこれは **staging での動作確認を飛ばす**という意味であり、警告がログに出る。
D1 マイグレーションを含む変更では使わないこと。スキーマ変更は不可逆で、staging を経ないと
本番で初めてその SQL を実行することになる。

ドキュメントや CI の修正など Worker の挙動に影響しない変更でも、迷ったら `stg` を通す。
**判断コストより事故のコストの方が高い。**

PR を切らず直接 push でも技術的には動くが、後で経歴書に書く時に PR 履歴があると説明しやすい。

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
