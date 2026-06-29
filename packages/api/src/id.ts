import { detectPrng, factory } from "ulid";

// ulid の既定の乱数源検出は window か node:crypto しか見ない。
// Cloudflare Workers には window が無く、node:crypto も(nodejs_compat 無しでは)
// randomBytes を持たないためフォールバックに失敗する。
// Workers で標準的に使える Web Crypto(globalThis.crypto)を root として渡し、
// crypto.getRandomValues ベースの PRNG を明示的に作る。
export const ulid = factory(detectPrng(false, globalThis));
