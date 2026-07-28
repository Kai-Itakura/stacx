#!/usr/bin/env bash
# デザインレビュー用の下準備。冪等（何度実行してもよい）。
#   1. 依存インストール（未インストールのときだけ）
#   2. ローカル D1 にマイグレーション適用
#   3. セッション + デモデータを D1 に直接投入（Google OIDC をバイパス）
# 最後に SESSION_ID を出力する。
set -euo pipefail

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
cd "$ROOT"

# 固定のセッション ID。毎回変えると疎通確認の手順が煩雑になるため固定値を使う。
# 実データではなくローカル開発 D1 専用の値（本番には存在しない）。
SESSION_ID="11112222333344445555666677778888999900001111222233334444555566ab"
USER_ID="u_review"
PROJECT_ID="p_review"

echo "▶ 1/3 依存の確認"
if [ ! -d node_modules ]; then
  pnpm install
else
  echo "  node_modules あり → スキップ"
fi

echo "▶ 2/3 ローカル D1 マイグレーション"
pnpm --filter @stacx/api db:migrate:local >/dev/null 2>&1 || pnpm --filter @stacx/api db:migrate:local
echo "  適用済み"

echo "▶ 3/3 セッション + デモデータ投入"
NOW="$(date +%s)000"
EXPIRES="$(( $(date +%s) + 2592000 ))000"   # 30 日後（sessions.expires_at は epoch ms）
START_DATE="$(date -d 2026-02-02 +%s)000"

SEED="$(mktemp -t stacx-design-review-seed-XXXXXX.sql)"
trap 'rm -f "$SEED"' EXIT

# 注意: tags テーブルに updated_at は無い（schema.ts を参照）。
# 依存順に消す: memo_tags → memos → tags/projects → user_identities/sessions → users
cat > "$SEED" <<SQL
DELETE FROM memo_tags;
DELETE FROM memos;
DELETE FROM tags;
DELETE FROM projects;
DELETE FROM sessions;
DELETE FROM user_identities;
DELETE FROM users;

INSERT INTO users (id, created_at, updated_at, last_login_at)
VALUES ('$USER_ID', $NOW, $NOW, $NOW);

INSERT INTO user_identities (id, user_id, provider, provider_sub, email, email_verified, name, picture_url, created_at, updated_at)
VALUES ('ui_review', '$USER_ID', 'google', 'sub_review', 'review@example.com', 1, 'レビュー ユーザー', NULL, $NOW, $NOW);

INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent, ip_address)
VALUES ('$SESSION_ID', '$USER_ID', $EXPIRES, $NOW, 'design-review', NULL);

-- 長い日本語名・技術スタック 4 件など「実際に詰まった状態」を再現する。
-- 空状態では横幅の破綻が出ないため、意図的に埋めている。
INSERT INTO projects (id, user_id, name, start_date, end_date, summary, team_size, role, work_style, tech_stack, created_at, updated_at)
VALUES ('$PROJECT_ID', '$USER_ID', '工場生産管理システム', $START_DATE, NULL,
        '旧システムのモダナイズやレガシーな運用を行っていた部分をシステムで置き換えることが主な目的。',
        30, 'メンバー', NULL, '["Go","React","Kubernetes","PostgreSQL"]', $NOW, $NOW);

INSERT INTO tags (id, user_id, name, created_at)
VALUES ('t_eff', '$USER_ID', '効率化', $NOW), ('t_tech', '$USER_ID', '技術選定', $NOW);

INSERT INTO memos (id, user_id, project_id, title, body, created_at, updated_at) VALUES
 ('m_review_1', '$USER_ID', '$PROJECT_ID', 'D1 のバッチ書き込みで整合性を担保した',
  'memo_tags の delete/insert を db.batch で 1 原子操作にまとめ、途中失敗でタグだけ消える状態を防いだ。', $NOW, $NOW),
 ('m_review_2', '$USER_ID', '$PROJECT_ID', 'LCP を 2.5s から 1.2s に改善',
  '画像の遅延読み込みとフォントの preload で初期描画を短縮。計測は Lighthouse。', $NOW, $NOW);

INSERT INTO memo_tags (memo_id, tag_id) VALUES ('m_review_1', 't_tech'), ('m_review_2', 't_eff');
SQL

cd packages/api
if ! npx wrangler d1 execute stacx-db --local --file="$SEED" 2>&1 | grep -q "commands executed successfully"; then
  echo "✘ 投入に失敗した。スキーマが変わった可能性がある（例: tags に updated_at が追加された）。" >&2
  echo "  packages/api/src/db/schema.ts と上の INSERT 文を突き合わせて修正すること。" >&2
  npx wrangler d1 execute stacx-db --local --file="$SEED" 2>&1 | grep -E "ERROR" >&2 || true
  exit 1
fi
cd "$ROOT"

echo ""
echo "✅ 準備完了"
echo ""
echo "SESSION_ID=$SESSION_ID"
echo ""
echo "次の手順:"
echo "  1) ルートで両ワーカーを起動:  pnpm dev"
echo "     （ログに 'Local: http://localhost:5173/' が出れば ready）"
echo "  2) 疎通確認（認証あり=200 / 認証なし=302 を確認）:"
echo "     curl -s -o /dev/null -w '認証あり=%{http_code}\\n' -H \"Cookie: stacx_session=$SESSION_ID\" http://localhost:5173/ --noproxy '*'"
echo "  3) 撮影と計測:"
echo "     node .claude/skills/design-review/scripts/review.mjs --session $SESSION_ID"
