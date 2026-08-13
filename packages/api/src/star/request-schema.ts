import { z } from "zod";

// STAR ログの upsert 検証スキーマ。`.brand()` で出力型を branded にし、
// safeParse / parse を通した値しかドメイン層へ渡せないことを型で保証する。

const optionalText = z.string().optional();
const nonEmpty = (s: string | undefined): boolean => (s?.trim().length ?? 0) > 0;

/**
 * PUT /memos/:id/star 用。status で保存モードを切り替える。
 * - draft: 書きかけ。S/T/A/R は最低 1 項目に非空文字（空 STAR の保存は無意味）。
 * - complete: 経歴書に使える完成状態。S/T/A/R を全項目必須にする。
 */
export const upsertStarSchema = z
  .object({
    situation: optionalText,
    task: optionalText,
    action: optionalText,
    result: optionalText,
    status: z.enum(["draft", "complete"]).default("draft"),
  })
  .refine(
    (v) => {
      const fields = [v.situation, v.task, v.action, v.result];
      return v.status === "complete" ? fields.every(nonEmpty) : fields.some(nonEmpty);
    },
    {
      message: "at least one field is required",
    },
  )
  .brand<"UpsertStarInput">();

/** 検証済みの STAR upsert 入力。upsertStarSchema.parse の出力としてのみ得られる。 */
export type UpsertStarInput = z.infer<typeof upsertStarSchema>;
