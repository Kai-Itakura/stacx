import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

/**
 * 未捕捉例外を API 共通の `{ error }` JSON 契約に揃えるハンドラ（app.onError に登録する）。
 * - HTTPException は意図的に投げられた HTTP エラーなので、その status/レスポンスを尊重する。
 * - それ以外（想定外の例外）は 500 + `{ error: "internal" }` で返し、
 *   スタックや例外メッセージはボディに出さない（情報漏洩を避ける）。詳細は console.error でログに残す。
 */
export const onError: ErrorHandler = (err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  return c.json({ error: "internal" }, 500);
};
