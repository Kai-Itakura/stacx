---
name: design-review
description: StacX の実際の画面を Playwright で起動・撮影し、PC / SP 両方のレイアウト崩れとアクセシビリティを実測値付きでレビューする。「デザインレビューして」「スマホで崩れてる」「横スクロールが出る」「UI 見て」「レスポンシブ確認」「PC と SP でチェック」「画面のスクショ撮って」「visual review」「design review」などと言われたら必ずこのスキルを使う。実機スクショを見せられて原因を聞かれた場合、UI を変更した後に見た目を確認したい場合、#58 / #59 のようなレイアウト崩れ issue を調査・修正する場合も対象。推測でCSSを語らず、必ず実測してから結論を出すためのスキル。
---

# StacX デザインレビュー（PC / SP 実測）

## このスキルの目的

レイアウト崩れの原因は**推測すると外す**。このスキルは実際にアプリを起動して測るための手順で、以下を自動化する。

- Google OIDC を経由せずに認証済み画面へ入る（ローカル D1 にセッションを直接投入）
- PC / SP の複数ビューポートで撮影
- 「見た目でなんとなく崩れてる」を**数値**に変える（溢れ px、折り返し行数、タップ領域 px、固有幅との差）

計測を経ずに「たぶん `min-w-0` が無いからです」と書くと外す。実際にこのリポジトリで、`min-w-0` は既に付いていた（原因は逆に「付いているから潰れる」だった）。数値を出してから結論を書く。

## 前提: このリポジトリの構成

- **2 ワーカー構成**: `stacx-api`（Hono, :8787）と `stacx`（React Router SSR, :5173）。web は**サービスバインディング** `API` 経由で api を呼ぶため、**必ず両方起動**する（ルートの `pnpm dev` が並列起動し、wrangler の dev registry がバインディングを繋ぐ）。
- **全画面が認証必須**: `requireUser`（`packages/web/app/lib/auth.server.ts`）が未認証を `/login` へ 302 する。ログイン済みで `/login` を開くと `/` に戻されるので、`/login` の撮影結果がホーム画面になっていたら想定どおり。
- **セッション Cookie 名は環境で変わる**: `packages/api/src/auth/cookie.ts` の `sessionCookieName()` が `APP_BASE_URL` を見て切り替える。ローカルは `http://localhost:5173` なので **`stacx_session`**（本番 https では `__Host-stacx_session`）。名前を間違えると 302 のままなので、下の疎通確認で必ず検証する。

## 手順

### 1. 準備（依存・マイグレーション・セッション投入）

```bash
bash .claude/skills/design-review/scripts/prepare.sh
```

このスクリプトは冪等で、以下をやって最後に **`SESSION_ID`** を出力する。

1. `node_modules` が無ければ `pnpm install`
2. `pnpm --filter @stacx/api db:migrate:local`（ローカル D1 にマイグレーション適用）
3. `users` / `user_identities` / `sessions` を直接 INSERT（**これが OAuth バイパスの本体**）＋ レビュー用のデモデータ（プロジェクト 1・タグ 2・メモ 2）

デモデータを入れるのは、**空状態だけ見ても崩れが出ない**から。日本語の長いプロジェクト名・複数のタグ chip・技術スタック 4 件のような「実際に詰まった状態」で初めて破綻が見える。

### 2. 両ワーカーを起動

バックグラウンドで起動し、web が ready になるまで待つ。

```bash
pnpm dev            # ルートで実行（api:8787 + web:5173 を並列起動）
```

ログに `Local: http://localhost:5173/` が出れば ready。`Unable to fetch the 'Request.cf' object` や `Request was cancelled` はプロキシ環境由来の警告で無害。

### 3. 疎通確認（ここを飛ばさない）

Cookie 名やセッションが効いていないと、以降のスクショが**全部ログイン画面**になって時間を無駄にする。先に 2 行で確かめる。

```bash
SID=<prepare.sh が出力した SESSION_ID>
curl -s -o /dev/null -w "認証あり=%{http_code}\n" -H "Cookie: stacx_session=$SID" http://localhost:5173/ --noproxy '*'
curl -s -o /dev/null -w "認証なし=%{http_code}\n" http://localhost:5173/ --noproxy '*'
```

期待値は **認証あり=200 / 認証なし=302**。`--noproxy '*'` はこの環境の HTTPS プロキシを迂回するために必要。

### 4. 撮影と計測

```bash
node .claude/skills/design-review/scripts/review.mjs --session "$SID"
```

主なオプション（既定値で足りることが多い）:

| オプション | 既定 | 用途 |
|---|---|---|
| `--session <id>` | 必須 | セッション ID |
| `--pages a,b,c` | `/`,`/memos`,`/projects`,`/projects/p_review`,`/projects/new` | 対象パス |
| `--viewports 390x844,1440x900` | SP 390×844 / PC 1440×900 / 375 / 320 | `WxH` のカンマ区切り |
| `--out <dir>` | scratchpad 配下 | 出力先 |
| `--base <url>` | `http://localhost:5173` | 接続先 |

出力は `<out>/shots/*.png` と `<out>/report.json`、それに標準出力の要約。狭い幅（375 / 320）も既定で回すのは、**390px で無事でも 320px で崩れる**ことがあるため。

Chromium はこの環境にプリインストール済み（`/opt/pw-browsers/chromium-*`）で、スクリプトが自動検出する。**`playwright install` は実行しない**（環境で禁止されている）。`playwright` npm パッケージが無い場合はスクリプトが scratchpad 側に入れる（リポジトリの `package.json` は汚さない）。

### 5. 結果を読んでレビューを書く

`references/checklist.md` に、このリポジトリで実際にバグを見つけた観点と既知の罠をまとめてある。**結果を解釈する前に必ず読む**（特に `input[type="date"]` と WebKit の項）。スクショだけ眺めても、下の 2 つのような「数値でしか見えない不具合」を見落とす。

## Playwright MCP がある場合

MCP のブラウザツールが接続されていればページ操作（クリック、入力、フォーム送信後の状態）に使ってよい。ただし**溢れ px・折り返し行数・固有幅の比較は `review.mjs` の計測に任せる**。目視やスナップショットでは px が出ず、「崩れている気がする」で終わってしまう。MCP は無くてもこのスキルは完結する。

## レポートの形式

実測値を必ず添えて、この構成で報告する。

```markdown
## 計測条件
起動方法 / ビューポート / エンジン（Chromium のみか）

## 🔴 高: レイアウト破綻
| 症状 | 実測 | 該当ファイル |
（例: 画面1 の横スクロール / 390px:+30px 375px:+44px 320px:+99px / routes/home.tsx）
根本原因（なぜそうなるかの機序まで）

## 🟡 中: 仕様との乖離
docs/04-screens.md の要件と実装の差分

## 🟢 低: アクセシビリティ・細部
タップ領域、コントラスト、重複表示など

## エンジン差の注意
Chromium で再現しない症状があれば明記する
```

## 重要な作法

- **再現しなかったことも報告する。** 実機で崩れているのに Chromium で再現しない場合、「問題なし」ではなく「**WebKit 固有の可能性が高い**」が正しい結論。黙って省くと、修正が検証されないまま閉じられる。
- **`scrollWidth == clientWidth` を合格の証にしない。** 日本語タイトルは任意の位置で折り返せるため、`h1` が潰れて縦積みになると**ページは溢れないまま表示が壊れる**。折り返し行数も併せて見る。
- **推定と実測を書き分ける。** 「実測 174px」と「機序の推定」を混ぜない。issue に書くときも同じ。
- 既存 issue（#58 / #59 など）に計測結果を追記するときは、**過去の分析が誤っていたら訂正を明記する**。誤った修正方針が残っていると、その通りに直して直らない。
