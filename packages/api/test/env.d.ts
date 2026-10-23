import type { D1Migration } from "@cloudflare/vitest-pool-workers/config";
import type { Bindings } from "../src/types";

declare module "cloudflare:test" {
  // env / SELF が参照するバインディングの型。worker の Bindings にテスト専用の 2 つを加える。
  interface ProvidedEnv extends Bindings {
    /** src/db/migrations の全マイグレーション。vitest.config.ts が読み込んで渡す。 */
    TEST_MIGRATIONS: D1Migration[];
    /** マイグレーションのテスト専用の空の D1。途中のバージョンまで当ててからデータを入れるために使う。 */
    MIGRATION_DB: D1Database;
  }
}
