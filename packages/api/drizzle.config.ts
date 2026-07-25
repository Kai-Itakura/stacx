import { readdirSync } from "node:fs";
import type { Config } from "drizzle-kit";

// ローカル D1（Miniflare）の SQLite 実体を探す。
// ファイル名は D1 の内部 ID（64 桁 hex）で、`.wrangler/state` を作り直すと変わるため、
// 固定値ではなく実行時に検出する。同ディレクトリの metadata.sqlite は D1 本体ではないので除外。
// 見つからなくても throw しない（`db:generate` は dbCredentials を使わないため、
// 未 dev / 未 migrate の状態でも設定ロードを壊さない）。studio 実行時に開けなければ
// drizzle-kit 側が明示エラーを出す。
const LOCAL_D1_DIR = "./.wrangler/state/v3/d1/miniflare-D1DatabaseObject";

function findLocalD1Url(): string {
  try {
    const file = readdirSync(LOCAL_D1_DIR).find((f) => /^[0-9a-f]{64}\.sqlite$/.test(f));
    if (file) return `${LOCAL_D1_DIR}/${file}`;
  } catch {
    // .wrangler 未生成。generate は続行できるよう握りつぶす。
  }
  // 未検出時のフォールバック（存在しないパス）。studio 実行時のみ問題になる。
  return `${LOCAL_D1_DIR}/local.sqlite`;
}

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    // ローカル D1 を Drizzle Studio で閲覧するための接続先。
    // 事前に `pnpm dev` か `pnpm db:migrate:local` でローカル D1 を生成しておくこと。
    url: findLocalD1Url(),
  },
} satisfies Config;
