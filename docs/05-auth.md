# 05. 認証設計（OIDC）

## 概要

StacX は **Google OIDC** を用いた認証を採用し、セッションは **自前管理（D1 保存）** とします。Phase 2 では複数 IdP 対応に拡張可能な設計です。

---

## 採用ライブラリ

- **arctic**: OAuth2 / OIDC クライアントライブラリ
  - 軽量、エッジ対応、多数のプロバイダ対応
- **oslo**: セッショントークン生成・ハッシュ等のユーティリティ

---

## 認証フロー詳細

### 1. ログイン開始

エンドポイント: `GET /auth/login/google`

- `arctic` で `state` と `codeVerifier` を生成
- それらを httpOnly Cookie に一時保存（10 分有効）
- Google の認可エンドポイントへ 302 リダイレクト

### 2. コールバック

エンドポイント: `GET /auth/callback/google?code=...&state=...`

- Cookie の `state` と一致確認（CSRF 対策）
- `arctic` で `code` を ID Token / Access Token に交換
- ID Token を検証し、`sub`（Google ユーザー ID）と `email` を取得
- `users` テーブルに upsert
  - 既存ユーザー: `last_login_at` を更新
  - 新規ユーザー: レコード作成
- `sessions` テーブルにセッションレコードを作成
  - `id`: ランダム文字列（oslo で生成）
  - `user_id`
  - `expires_at`（例: 30 日後）
- セッション ID を httpOnly Cookie で発行
- `/` へリダイレクト

### 3. リクエスト時の認証

- 全保護ルートに認証ミドルウェアを適用
- Cookie からセッション ID を取得
- D1 で `sessions` を引いて有効性を確認
- ユーザー情報を `c.var.user` に注入

### 4. ログアウト

エンドポイント: `POST /auth/logout`

- セッションを D1 から削除
- Cookie を即時失効

---

## セキュリティ対策

| 対策 | 実装 |
|---|---|
| CSRF | `state` パラメータ検証、Cookie の SameSite=Lax |
| セッションハイジャック | httpOnly + Secure Cookie、HTTPS 必須 |
| トークン保護 | ID Token はサーバー側で検証後破棄、フロントに渡さない |
| セッション固定 | ログイン時に必ず新規セッション ID 発行 |
| 有効期限 | セッション 30 日、コールバック state 10 分 |

---

## DB スキーマ

### users テーブル

- `id`: string (cuid/ulid)
- `google_sub`: string (unique)
- `email`: string
- `name`: string | null
- `picture_url`: string | null
- `created_at`: Date
- `last_login_at`: Date

### sessions テーブル

- `id`: string (random 32 bytes hex)
- `user_id`: string (FK)
- `expires_at`: Date
- `created_at`: Date
- `user_agent`: string | null
- `ip_address`: string | null

---

## Phase 2 への拡張ポイント

- `users` テーブルに `provider` カラムを追加し、`google_sub` を `provider_sub` に汎用化
- 1 ユーザーが複数 IdP を紐づけられるよう、別テーブル `user_identities` に分離する設計も可能
- OIDC 以外の認証方式（Magic Link 等）も追加可能な抽象化

---

## 環境変数

    GOOGLE_CLIENT_ID=...
    GOOGLE_CLIENT_SECRET=...
    SESSION_SECRET=...               # セッション ID 生成のシード
    APP_BASE_URL=https://stacx.dev   # コールバック URL の基点

ローカルは `.dev.vars`、本番は `wrangler secret put` で管理。
