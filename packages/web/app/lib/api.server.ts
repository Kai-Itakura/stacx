import { env } from "cloudflare:workers";
import type { AppType } from "@stacx/api";
import { hc } from "hono/client";

/**
 * SSR の loader/action から stacx-api を型付きで叩くクライアント。
 * - サービスバインディング(env.API)経由なので同一オリジン扱いで公開網を経由しない。
 * - 受信リクエストの Cookie を転送し、ブラウザのセッション認証を引き継ぐ。
 * baseUrl はサービスバインディングでは無視されるためダミー。
 */
export function apiClient(request: Request) {
  return hc<AppType>("https://stacx-api", {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      env.API.fetch(input as Parameters<typeof env.API.fetch>[0], init),
    headers: { cookie: request.headers.get("cookie") ?? "" },
  });
}
