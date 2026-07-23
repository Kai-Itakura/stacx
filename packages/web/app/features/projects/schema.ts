import { z } from "zod";

/**
 * プロジェクト作成/編集フォームの検証スキーマ（client/server 共用、#43 決定のパターン）。
 * 日付は <input type="date"> 由来の "YYYY-MM-DD"。必須は非空のみ検証し、
 * 日付の妥当性・型変換は API 側の createProjectSchema に委ねる。
 */
export const projectFormSchema = z.object({
  name: z
    .string({ error: "プロジェクト名を入力してください" })
    .trim()
    .min(1, "プロジェクト名を入力してください"),
  startDate: z.string({ error: "開始日を入力してください" }).min(1, "開始日を入力してください"),
  // 空なら「進行中」。
  endDate: z.string().optional(),
  summary: z.string().optional(),
  // 任意の人数。Conform が空文字→undefined・文字列→number に coerce する。
  teamSize: z
    .number({ error: "数値で入力してください" })
    .int("整数で入力してください")
    .positive("1 以上で入力してください")
    .optional(),
  role: z.string().optional(),
  // 使用技術スタック。チップ入力を hidden input 複数で載せて配列にする。任意。
  techStack: z.array(z.string()).optional(),
});

/**
 * 一覧・編集で扱う Project の形（loader が RPC レスポンスから渡す）。
 * 日付は JSON 化で ISO 文字列になる。
 */
export type ProjectSummary = {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  summary: string | null;
  teamSize: number | null;
  role: string | null;
  techStack: string[];
};

/** ISO 日時文字列を <input type="date"> の value（YYYY-MM-DD）へ。空値は ""。 */
export function toDateInputValue(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

/**
 * 検証済みフォーム値を API（create/update projects）の json ボディへ整形する。
 * 空文字の任意項目は null に、未指定 techStack は [] に正規化する。
 */
export function toProjectPayload(value: z.infer<typeof projectFormSchema>) {
  return {
    name: value.name,
    startDate: value.startDate,
    endDate: value.endDate ? value.endDate : null,
    summary: value.summary ? value.summary : null,
    teamSize: value.teamSize ?? null,
    role: value.role ? value.role : null,
    techStack: value.techStack ?? [],
  };
}
