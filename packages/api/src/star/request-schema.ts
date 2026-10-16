import { z } from "zod";
import { hasAnyField } from "./state";

// STAR のリクエスト検証スキーマ。`.brand()` で出力型を branded にし、
// safeParse / parse を通した値しかドメイン層へ渡せないことを型で保証する。

const starFields = {
  situation: z.string().optional(),
  task: z.string().optional(),
  action: z.string().optional(),
  result: z.string().optional(),
  notes: z.string().optional(),
};

const invariant = { message: "at least one of situation/task/action/result is required" };

/** POST /stars 用。tagIds 未指定は空配列に正規化。 */
export const createStarSchema = z
  .object({
    projectId: z.string().min(1),
    ...starFields,
    tagIds: z.array(z.string().min(1)).default([]),
  })
  .refine(hasAnyField, invariant)
  .brand<"CreateStarInput">();

/** 検証済みの STAR 作成入力。createStarSchema.parse の出力としてのみ得られる。 */
export type CreateStarInput = z.infer<typeof createStarSchema>;

/**
 * PUT /stars/:id 用。S/T/A/R は毎回 4 項目を置き換える（未指定は空になる）。
 * notes / tagIds は present なら置き換え、absent なら変更しない。Project は変えられない。
 */
export const updateStarSchema = z
  .object({
    ...starFields,
    tagIds: z.array(z.string().min(1)).optional(),
  })
  .refine(hasAnyField, invariant)
  .brand<"UpdateStarInput">();

/** 検証済みの STAR 更新入力。updateStarSchema.parse の出力としてのみ得られる。 */
export type UpdateStarInput = z.infer<typeof updateStarSchema>;
