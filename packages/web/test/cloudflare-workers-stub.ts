// `import { env } from "cloudflare:workers"` の import 解決用スタブ。
// テストでは loader/action を createRoutesStub で差し替えるため、env は参照されない。
export const env = {} as Record<string, unknown>;
