import { zValidator } from "@hono/zod-validator";
import type { z } from "zod";

/** ZodError を API 共通の `{ error }` 400 ボディに整形する（先頭 issue を可読化）。 */
export function badRequestFromZod(error: {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
}): { error: string } {
  const issue = error.issues[0];
  const path = issue?.path.map((p) => p.toString()).join(".");
  return { error: path ? `${path}: ${issue?.message}` : (issue?.message ?? "invalid body") };
}

/**
 * JSON ボディを schema で検証する zValidator を作る。検証 NG は API 共通の `{ error }` 400 で返す。
 * 各ルートで同じ hook を書く代わりにこれ 1 つを使い、エラー応答の形を 1 箇所に集約する。
 */
export const jsonValidator = <T extends z.ZodType>(schema: T) =>
  zValidator("json", schema, (result, c) => {
    if (!result.success) return c.json(badRequestFromZod(result.error), 400);
  });
