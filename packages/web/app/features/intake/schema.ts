import { z } from "zod";

/** メモ作成フォームの検証スキーマ（client/server 共用）。title は本文から導出するため項目に無い。 */
export const memoFormSchema = z.object({
  // zod v4 では未入力(undefined)の型エラーも error で文言を揃える。
  body: z.string({ error: "本文を入力してください" }).trim().min(1, "本文を入力してください"),
  projectId: z
    .string({ error: "プロジェクトを選択してください" })
    .min(1, "プロジェクトを選択してください"),
  tagIds: z.array(z.string()).optional(),
});

/** 空状態のプロジェクト簡易作成フォームの検証スキーマ。 */
export const projectFormSchema = z.object({
  name: z
    .string({ error: "プロジェクト名を入力してください" })
    .trim()
    .min(1, "プロジェクト名を入力してください"),
});

/** 本文の最初の非空行をタイトルにする（長い場合は短縮）。 */
export function deriveTitle(body: string): string {
  const firstLine =
    body
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  return firstLine.length > 100 ? `${firstLine.slice(0, 100)}…` : firstLine;
}

/** クイック・インテーク画面が必要とする Project / Tag の最小形（loader の結果から渡す）。 */
export type IntakeProject = { id: string; name: string; endDate: string | null };
export type IntakeTag = { id: string; name: string };

/** タグのインライン作成（fetcher）の戻り値。 */
export type TagFetcherResult =
  | { ok: true; intent: "createTag"; tagId: string }
  | { ok: false; intent: "createTag"; error: string };
