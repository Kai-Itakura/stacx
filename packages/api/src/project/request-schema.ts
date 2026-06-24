import { z } from "zod";

// JSON 由来のボディを検証する zod スキーマ。HTTP 経由なので number は常に有限
// （JSON に Infinity/NaN は無い）。日付は epoch ミリ秒（number）または日付文字列を
// coerce で Date 化し、不正値は弾く。ルートでは @hono/zod-validator が消費する。

// 日付入力。string/number/Date のみ受けてから Date 化する。
// 素の z.coerce.date() は new Date() の挙動上 null→1970(epoch)・boolean→epoch を黙って通すため、
// 入力型を union で絞ってそれらを弾く（null 許容は各フィールドで .nullable()/.nullish() を付ける）。
const dateFromInput = z.union([z.string(), z.number(), z.date()]).pipe(z.coerce.date());

/** POST /projects 用。未指定の任意項目は null に正規化する。 */
export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1),
    startDate: dateFromInput,
    endDate: dateFromInput.nullish().transform((v) => v ?? null),
    summary: z
      .string()
      .nullish()
      .transform((v) => v ?? null),
    teamSize: z
      .number()
      .nullish()
      .transform((v) => v ?? null),
    role: z
      .string()
      .nullish()
      .transform((v) => v ?? null),
    workStyle: z
      .string()
      .nullish()
      .transform((v) => v ?? null),
  })
  .brand<"CreateProjectInput">();

/** PUT /projects/:id 用。部分更新なので全項目任意。指定キーのみ出力に残る。 */
export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1),
    startDate: dateFromInput,
    endDate: dateFromInput.nullable(),
    summary: z.string().nullable(),
    teamSize: z.number().nullable(),
    role: z.string().nullable(),
    workStyle: z.string().nullable(),
  })
  .partial()
  // 空ボディ {} は updatedAt だけ進む no-op になるため、最低 1 フィールドを必須にする。
  .refine((v) => Object.keys(v).length > 0, { message: "at least one field is required" })
  .brand<"UpdateProjectInput">();

/** 検証済みの作成入力。createProjectSchema.parse の出力としてのみ得られる（branded）。 */
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
/** 検証済みの更新入力。updateProjectSchema.parse の出力としてのみ得られる（branded）。 */
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
