import path from "node:path";
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  // Drizzle のマイグレーションを読み、テスト用 D1 へ適用する（setup ファイルで実行）。
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "src/db/migrations"));

  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            bindings: {
              // setup でマイグレーション適用に使う。
              TEST_MIGRATIONS: migrations,
              // ルート / Provider テスト用のダミー認証情報（実通信はしない）。
              GOOGLE_CLIENT_ID: "test-client-id",
              GOOGLE_CLIENT_SECRET: "test-client-secret",
            },
          },
        },
      },
    },
  };
});
