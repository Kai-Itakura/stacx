import { createRequestHandler } from "react-router";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env) {
    // /api/* は API worker(stacx-api) にサービスバインディング経由でそのまま中継する。
    // これでブラウザ直叩きの認証リダイレクト(/api/auth/*)も SSR からの呼び出しも同一オリジンになる。
    if (new URL(request.url).pathname.startsWith("/api/")) {
      return env.API.fetch(request);
    }
    return requestHandler(request);
  },
} satisfies ExportedHandler<Env>;
