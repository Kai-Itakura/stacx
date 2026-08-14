import { z } from "zod";

const optionalText = z.string().optional();
const nonEmpty = (s: string | undefined): boolean => (s?.trim().length ?? 0) > 0;
const STAR_KEYS = ["situation", "task", "action", "result"] as const;

const baseObject = z.object({
  situation: optionalText,
  task: optionalText,
  action: optionalText,
  result: optionalText,
});

export type StarFormValue = z.infer<typeof baseObject>;
/** 保存モード。draft=書きかけ / complete=経歴書に使える完成状態。 */
export type StarSaveMode = "draft" | "complete";
/** タイムライン・エディタで表示する STAR 状態。none は未着手。 */
export type StarStatus = "none" | StarSaveMode;

/**
 * STAR エディタの検証スキーマ（client/server 共用、mode で切り替え）。
 * - draft: S/T/A/R の最低 1 項目に非空文字。
 * - complete: 経歴書に使える完成状態のため S/T/A/R を全項目必須。
 */
export function starFormSchema(mode: StarSaveMode) {
  return baseObject.refine(
    (v) =>
      mode === "complete"
        ? STAR_KEYS.every((k) => nonEmpty(v[k]))
        : STAR_KEYS.some((k) => nonEmpty(v[k])),
    {
      message:
        mode === "complete"
          ? "完成にするには S/T/A/R をすべて入力してください"
          : "S/T/A/R のいずれか 1 つは入力してください",
    },
  );
}

/** STAR エディタ左ペインに表示するメモ（loader が RPC レスポンスから整形して渡す）。 */
export type StarEditorMemo = {
  id: string;
  body: string;
  projectId: string;
  projectName: string;
  tagNames: string[];
};

/** STAR エディタの既存値（未 STAR 化なら空文字で埋めた値）。<textarea> 初期値に使う。 */
export type StarValues = {
  situation: string;
  task: string;
  action: string;
  result: string;
};

/** 検証済みフォーム値を API（PUT /memos/:id/star）の json ボディへ整形する。 */
export function toStarPayload(value: StarFormValue, status: StarSaveMode) {
  return {
    situation: value.situation ?? "",
    task: value.task ?? "",
    action: value.action ?? "",
    result: value.result ?? "",
    status,
  };
}
