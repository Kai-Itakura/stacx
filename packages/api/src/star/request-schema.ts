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

export const createStarSchema = z
  .object({
    projectId: z.string().min(1),
    ...starFields,
    tagIds: z.array(z.string().min(1)).default([]),
  })
  .refine(hasAnyField, invariant)
  .brand<"CreateStarInput">();

export type CreateStarInput = z.infer<typeof createStarSchema>;

export const updateStarSchema = z
  .object({
    ...starFields,
    tagIds: z.array(z.string().min(1)).optional(),
  })
  .refine(hasAnyField, invariant)
  .brand<"UpdateStarInput">();

export type UpdateStarInput = z.infer<typeof updateStarSchema>;
