import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const resolvePath = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// コンポーネント/インタラクションテスト用の設定。アプリ本体の vite.config.ts
// （cloudflare / reactRouter プラグイン）は使わず、jsdom + React で完結させる。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^~\//, replacement: resolvePath("./app/") },
      // loader/action 経由でしか使わない server 専用モジュール。
      // テストでは createRoutesStub で差し替えるため、import 解決用のスタブに向ける。
      { find: "cloudflare:workers", replacement: resolvePath("./test/cloudflare-workers-stub.ts") },
    ],
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./test/setup.ts"],
    include: ["app/**/*.test.{ts,tsx}"],
  },
});
