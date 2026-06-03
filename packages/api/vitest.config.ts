import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  // Node 型に依存しないよう、標準の import.meta.url から migrations パスを導出する。
  const migrationsPath = new URL("./src/db/migrations", import.meta.url).pathname;
  const migrations = await readD1Migrations(migrationsPath);

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
