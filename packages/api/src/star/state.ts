type StarFields = {
  situation?: string | null;
  task?: string | null;
  action?: string | null;
  result?: string | null;
};

const isFilled = (s: string | null | undefined): boolean => (s?.trim().length ?? 0) > 0;

export function hasAnyField(f: StarFields): boolean {
  return [f.situation, f.task, f.action, f.result].some(isFilled);
}

export function starState(
  f: StarFields,
): "complete" | "unresolved" | "in_progress" | "missing_context" {
  const problem = isFilled(f.situation) || isFilled(f.task);
  const solution = isFilled(f.action) || isFilled(f.result);
  if (!problem) return "missing_context";
  if (!solution) return "unresolved";
  return [f.situation, f.task, f.action, f.result].every(isFilled) ? "complete" : "in_progress";
}
