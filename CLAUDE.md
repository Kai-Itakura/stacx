# CLAUDE.md - StacX

AI エージェント向けの入口。ここには **守るルール・コードから読めない判断・どこを見るか** だけを書く。説明は `docs/` に置く。

---

## プロジェクト概要

**StacX** は、業務での学び・成果・技術的判断を「1 分メモ」として蓄積し、転職活動時に職務経歴書として出力する個人向けアプリ。詳細は `docs/01-product-vision.md`。

用語（User / Identity / Memo / Tag / 技術スタック など）の定義は **`CONTEXT.md`** が正典。Memo は Project に固定的に属し、Tag は「メモの種類」、技術スタックは Project 側の属性で Memo には紐づかない。

---

## 技術スタック

pnpm workspace のモノレポ。`packages/web`（React Router v7 フレームワークモード + shadcn/ui + Tailwind + Conform）と `packages/api`（Hono on Cloudflare Workers + Drizzle + D1）。web は `/api/*` を Service Binding で api に中継する同一オリジン構成（ADR 0006）。

認証は **Google OIDC のみ**（Phase 1）。arctic + 自前セッション（D1 保存）。設計と Phase 2 の拡張計画は `docs/05-auth.md`。

選定理由は `docs/02-tech-stack.md`、構成図とディレクトリは `docs/03-architecture.md`。

---

## 開発フェーズと実装状況

現在は **Phase 1（MVP・個人利用）**。マルチテナント前提の設計を意識しつつ、過剰実装は避ける。

| 画面 | 状態 |
|---|---|
| 1. クイック・インテーク `/` | 実装済み |
| 2. プロジェクト管理 `/projects` | 実装済み |
| 3. STAR ログ `/memos`, `/memos/:id/star` | 実装済み |
| 4. レジュメ生成 `/resume` | **未着手** |
| 補助: タグ管理 `/tags` | 実装済み |

Phase 2（SaaS 化）はマルチテナント・複数 IdP・課金。仕様は `docs/04-screens.md`。

---

## エージェント向け作業ガイドライン

1. **不明な点があれば必ず質問する**。推測でコードを書かない
2. **設計判断が必要な変更は事前にユーザーに確認**
3. **既存のコーディング規約・ディレクトリ構成を尊重**
4. **大きな変更は小さなコミット単位に分割**
5. **新しいライブラリ導入は提案ベース**、勝手に追加しない
6. **TDD で進める**（Red → Green → Refactor）。ドメインロジック・分岐・境界にテストを集中させ、型で保証される部分や単純な通過コードは追わない（過剰実装は避ける）。詳細は `docs/07-testing.md`
7. **コメントはコードから読み取れないことの説明に限る**。JSDoc のような機能の説明か、コードを見ても分からない理由・制約の説明にとどめる。過去の経緯やバグ修正の背景など、コードから読み取れる内容の言い換えは書かない

---

## ブランチ運用

`feat/*` / `fix/*` → PR → **`stg`** → PR → **`main`**。`stg` への push で staging、`main` への push で production に自動デプロイされる。

- **`main` への PR は `stg` からのみ**（`restrict-pr-source.yml` が検査する）。`main` に直接入れると staging を経ずに本番 D1 へマイグレーションが当たる
- D1 のマイグレーションは不可逆。スキーマ変更を含むものは必ず `stg` で確認してから `main` へ
- コミットは Conventional Commits（`feat:` / `fix:` / `docs:` / `refactor:` / `chore:`）

詳細と例外（hotfix ラベル）は `docs/06-development.md` の「ブランチ戦略」。

---

## 実装の決めごと

コードを読んでも意図が分からない、明示的に下した判断を書く。

### `handleAction` は同一 action 内の intent 分岐にのみ使う

`app/lib/action-dispatcher.server.ts` の `handleAction` は、1 つの action に責務の違う処理が同居している場合（例: 編集と削除が同じ画面から飛ぶ）の分岐に使う。**URL が分かれている resource route を 1 つの intent 付き action にまとめない**。

まとめると戻り値の union がその action の全分岐の和になり、`useFetcher<typeof action>()` の消費側で自分が送った intent の結果に絞れなくなる。実行時には起きない分岐を型のために書く羽目になる。

責務が 1 つの action は `handleAction` を使わず素の `parseWithZod` で書く。

### web からの API 呼び出しは相対パス `/api/...` のみ

`VITE_API_BASE_URL` のような環境変数は導入しない。本番は Service Binding、ローカルは Vite proxy で同一オリジンにしているため（`docs/06-development.md`「ローカル開発の同一オリジン化」）。

### `packages/shared` は作らない（Phase 1）

API の型は Hono RPC で配布される。web ↔ api 双方が依存する純粋な共通モジュールが必要になった時点で切り出す（YAGNI）。

### api はドメイン単位でディレクトリを切る

`routes/` や `middleware/` は置かない。各ドメインは `index.ts`（Hono サブアプリ）/ `<domain>.ts`（ロジック）/ `request-schema.ts`（Zod）。`star` だけは `/memos/:id/star` として `memo/index.ts` に載るため `index.ts` を持たない。

### テストは対象ソースの隣に置く

`*.test.ts(x)` はコロケーション。複数モジュール横断・worker 全体（`SELF.fetch`）とテスト用インフラだけ `test/` に集約する。api のカバレッジしきい値は「現状値の少し下」のラチェットで、テストを増やしたら床も上げる。

---

## 作業前に読むもの

作業内容に応じて、該当するものを先に開く。

| これをするとき | 読む |
|---|---|
| web のテストを書く | `docs/07-testing.md` の「packages/web のコンポーネントテスト」— `createRoutesStub` に resource route も登録する、`encType` を明示する等の落とし穴がある |
| api のテストを書く | `docs/07-testing.md` の「実行環境の理解」— すべて workerd 内で動く。Node API は使えない |
| スキーマを変える | `docs/db-schema.md`（ER 図と設計意図）→ `docs/06-development.md`「D1 マイグレーション」 |
| CI / デプロイを触る | `docs/06-development.md`「ブランチ戦略」「自動デプロイ」。`deploy.yml` は `workflow_run` なので **`main` にマージされるまで新しいファイルで動かない** |
| 手動デプロイ・環境を作り直す | `docs/08-deploy.md`。web の環境は**ビルド時**に決まる（`CLOUDFLARE_ENV`） |
| 認証を触る | `docs/05-auth.md`、ADR 0002 / 0003 / 0004 |
| 「なぜこの設計か」を知りたい | `docs/adr/`（採用理由・不採用理由・結果） |
| 画面の見た目を確認する | `.claude/skills/design-review`（Playwright で実測する） |

その他: `docs/01-product-vision.md`（ユーザーストーリー・スコープ外）、`docs/02-tech-stack.md`（選定理由）、`docs/03-architecture.md`（構成図・データフロー）、`docs/04-screens.md`（画面仕様）。
