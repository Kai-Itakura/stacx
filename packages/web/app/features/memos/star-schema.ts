import { z } from "zod";

/**
 * STAR エディタの検証スキーマ（client/server 共用）。S/T/A/R は下書き可のため全て任意だが、
 * 全空の保存は無意味なので「最低 1 項目に非空文字」を form レベルのエラーで要求する。
 */
export const starFormSchema = z
  .object({
    situation: z.string().optional(),
    task: z.string().optional(),
    action: z.string().optional(),
    result: z.string().optional(),
  })
  .refine(
    (v) => [v.situation, v.task, v.action, v.result].some((s) => (s?.trim().length ?? 0) > 0),
    { message: "S/T/A/R のいずれか 1 つは入力してください" },
  );

/** STAR エディタ左ペインに表示するメモ（loader が RPC レスポンスから整形して渡す）。 */
export type StarEditorMemo = {
  id: string;
  body: string;
  projectName: string;
  tagNames: string[];
};

/** STAR エディタの既存値（未 STAR 化なら null）。<textarea> 初期値に使う。 */
export type StarValues = {
  situation: string;
  task: string;
  action: string;
  result: string;
};

/** 検証済みフォーム値を API（PUT /memos/:id/star）の json ボディへ整形する。 */
export function toStarPayload(value: z.infer<typeof starFormSchema>) {
  return {
    situation: value.situation ?? "",
    task: value.task ?? "",
    action: value.action ?? "",
    result: value.result ?? "",
  };
}
