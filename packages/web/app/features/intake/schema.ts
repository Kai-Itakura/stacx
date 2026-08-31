import { z } from "zod";

/** メモ作成フォームの検証スキーマ（client/server 共用）。title は本文から導出するため項目に無い。 */
export const memoFormSchema = z.object({
  // zod v4 では未入力(undefined)の型エラーも error で文言を揃える。
  body: z.string({ error: "本文を入力してください" }).trim().min(1, "本文を入力してください"),
  projectId: z
    .string({ error: "プロジェクトを選択してください" })
    .min(1, "プロジェクトを選択してください"),
  // 未選択だと hidden input が 1 つも出ず tagIds が届かない。API は absent を
  // 「タグを変更しない」と解釈するため、全解除を伝えられるよう空配列に倒す。
  tagIds: z.array(z.string()).default([]),
});

/** 空状態のプロジェクト簡易作成フォームの検証スキーマ。 */
export const projectFormSchema = z.object({
  name: z
    .string({ error: "プロジェクト名を入力してください" })
    .trim()
    .min(1, "プロジェクト名を入力してください"),
});

/** タグのインライン作成の検証スキーマ（client/server 共用）。 */
export const tagFormSchema = z.object({
  name: z.string({ error: "タグ名を入力してください" }).trim().min(1, "タグ名を入力してください"),
});

/** クイック・インテーク画面が必要とする Project / Tag の最小形（loader の結果から渡す）。 */
export type IntakeProject = { id: string; name: string; endDate: string | null };
export type IntakeTag = { id: string; name: string };
