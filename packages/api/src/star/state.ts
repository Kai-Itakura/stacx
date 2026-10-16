type StarFields = {
  situation?: string | null;
  task?: string | null;
  action?: string | null;
  result?: string | null;
};

/** 空白だけの値は書かれていないものとして扱う。 */
const isFilled = (s: string | null | undefined): boolean => (s?.trim().length ?? 0) > 0;

/** S/T/A/R のうち少なくとも 1 項目が書かれているか（STAR の不変条件）。 */
export function hasAnyField(f: StarFields): boolean {
  return [f.situation, f.task, f.action, f.result].some(isFilled);
}

/**
 * 4 項目から STAR の状態を導出する。定義は CONTEXT.md の 完成 / 未解決の問題 / 解決中 / 背景未記入。
 * 不変条件を満たす STAR は必ずこのどれか 1 つに当たる。
 */
export function starState(
  f: StarFields,
): "complete" | "unresolved" | "in_progress" | "missing_context" {
  const problem = isFilled(f.situation) || isFilled(f.task);
  const solution = isFilled(f.action) || isFilled(f.result);
  if (!problem) return "missing_context";
  if (!solution) return "unresolved";
  return [f.situation, f.task, f.action, f.result].every(isFilled) ? "complete" : "in_progress";
}
