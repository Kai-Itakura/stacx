import { z } from "zod";

// STAR ログの upsert 検証スキーマ。`.brand()` で出力型を branded にし、
// safeParse / parse を通した値しかドメイン層へ渡せないことを型で保証する。

const optionalText = z.string().optional();

/**
 * PUT /memos/:id/star 用。S/T/A/R は全て任意（下書き可）だが、
 * 空 STAR の保存は無意味なので「最低 1 項目に非空文字」を必須にする。
 */
export const upsertStarSchema = z
  .object({
    situation: optionalText,
    task: optionalText,
    action: optionalText,
    result: optionalText,
  })
  .refine(
    (v) => [v.situation, v.task, v.action, v.result].some((s) => (s?.trim().length ?? 0) > 0),
    {
      message: "at least one field is required",
    },
  )
  .brand<"UpsertStarInput">();

/** 検証済みの STAR upsert 入力。upsertStarSchema.parse の出力としてのみ得られる。 */
export type UpsertStarInput = z.infer<typeof upsertStarSchema>;
