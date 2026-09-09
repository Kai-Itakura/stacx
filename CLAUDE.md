# CLAUDE.md - StacX

守るルール・コードから読めない判断・どこを見るか、だけを書く。説明は `docs/` に置く。

**StacX**: 業務の学びを「1 分メモ」として蓄積し、職務経歴書として出力する個人向けアプリ。用語（User / Identity / Memo / Tag / 技術スタック）の正典は **`CONTEXT.md`**。

pnpm workspace。`packages/web`（React Router v7 + shadcn/ui + Conform）と `packages/api`（Hono on Workers + Drizzle + D1）。web は `/api/*` を Service Binding で api に中継する同一オリジン構成。認証は **Google OIDC のみ**（Phase 1）。

**Phase 1（MVP）**。画面 1〜3（インテーク `/`、プロジェクト `/projects`、STAR `/memos`）とタグ管理 `/tags` は実装済み、画面 4（レジュメ `/resume`）は未着手。マルチテナントを意識しつつ過剰実装はしない。

## 作業ガイドライン

1. **不明な点があれば必ず質問する**。推測でコードを書かない
2. **設計判断が必要な変更は事前にユーザーに確認**
3. **既存のコーディング規約・ディレクトリ構成を尊重**
4. **大きな変更は小さなコミット単位に分割**
5. **新しいライブラリ導入は提案ベース**、勝手に追加しない
6. **TDD で進める**（Red → Green → Refactor）。ドメインロジック・分岐・境界にテストを集中させ、型で保証される部分や単純な通過コードは追わない（過剰実装は避ける）。詳細は `docs/07-testing.md`
7. **コメントはコードから読み取れないことの説明に限る**。JSDoc のような機能の説明か、コードを見ても分からない理由・制約の説明にとどめる。過去の経緯やバグ修正の背景など、コードから読み取れる内容の言い換えは書かない

## ブランチ運用

`feat/*` / `fix/*` → PR → `stg`（staging に自動デプロイ）→ PR → `main`（production）。**`main` への PR は `stg` からのみ**。D1 マイグレーションは不可逆なので、スキーマ変更は必ず `stg` で確認してから。コミットは Conventional Commits。詳細は `docs/06-development.md`「ブランチ戦略」。

## 実装の決めごと

- **`handleAction`（`app/lib/action-dispatcher.server.ts`）は同一 action 内の intent 分岐にのみ使う。** URL が分かれている resource route を 1 つの intent 付き action にまとめない。まとめると戻り値の union が全分岐の和になり、`useFetcher<typeof action>()` で自分が送った intent の結果に絞れなくなる。責務が 1 つの action は素の `parseWithZod` で書く
- web からの API 呼び出しは相対パス `/api/...` のみ。`VITE_API_BASE_URL` は導入しない（`docs/06-development.md`）
- `packages/shared` は作らない。型は Hono RPC で配布される（`docs/03-architecture.md`）
- api はドメイン単位のディレクトリ。`routes/` / `middleware/` は置かない（`docs/03-architecture.md`）
- テストは対象ソースの隣に置く。api のカバレッジしきい値はラチェット（`docs/07-testing.md`）

## 作業前に読むもの

| これをするとき | 読む |
|---|---|
| web のテストを書く | `docs/07-testing.md`「packages/web のコンポーネントテスト」— `createRoutesStub` に resource route も登録、`encType` 明示、など落とし穴がある |
| api のテストを書く | `docs/07-testing.md`「実行環境の理解」— すべて workerd 内で動き、Node API は使えない |
| スキーマを変える | `docs/db-schema.md` → `docs/06-development.md`「D1 マイグレーション」 |
| CI / デプロイを触る | `docs/06-development.md`「自動デプロイ」— `deploy.yml` は `workflow_run` なので `main` にマージされるまで新しいファイルで動かない |
| 手動デプロイ・環境構築 | `docs/08-deploy.md` — web の環境はビルド時に `CLOUDFLARE_ENV` で決まる |
| 認証を触る | `docs/05-auth.md`、ADR 0002 / 0003 / 0004 |
| なぜこの設計か | `docs/adr/` |
| 画面の見た目を確認する | `.claude/skills/design-review` |

その他: `01-product-vision`（スコープ）、`02-tech-stack`（選定理由）、`03-architecture`（構成図）、`04-screens`（画面仕様）。
