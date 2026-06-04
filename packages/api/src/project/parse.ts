import type { CreateProjectInput, UpdateProjectInput } from "./project";

/** バリデーション結果。成功なら value、失敗なら人間可読な error を持つ。 */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** epoch ミリ秒（number）または日付文字列を Date に変換する。不正なら null。 */
function toDate(v: unknown): Date | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** 任意の文字列フィールド。未指定・null は null、文字列はそのまま、それ以外は error。 */
function optionalString(v: unknown): ParseResult<string | null> {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false, error: "must be a string" };
  return { ok: true, value: v };
}

/** POST /projects のボディを CreateProjectInput に検証変換する。 */
export function parseCreateInput(body: unknown): ParseResult<CreateProjectInput> {
  if (!isRecord(body)) return { ok: false, error: "invalid body" };

  if (!isNonEmptyString(body.name)) return { ok: false, error: "name is required" };

  const startDate = toDate(body.startDate);
  if (!startDate) return { ok: false, error: "startDate is required and must be a valid date" };

  let endDate: Date | null = null;
  if (body.endDate !== undefined && body.endDate !== null) {
    const d = toDate(body.endDate);
    if (!d) return { ok: false, error: "endDate is invalid" };
    endDate = d;
  }

  if (body.teamSize !== undefined && body.teamSize !== null) {
    if (typeof body.teamSize !== "number" || !Number.isFinite(body.teamSize)) {
      return { ok: false, error: "teamSize must be a number" };
    }
  }

  const summary = optionalString(body.summary);
  if (!summary.ok) return { ok: false, error: `summary ${summary.error}` };
  const role = optionalString(body.role);
  if (!role.ok) return { ok: false, error: `role ${role.error}` };
  const workStyle = optionalString(body.workStyle);
  if (!workStyle.ok) return { ok: false, error: `workStyle ${workStyle.error}` };

  return {
    ok: true,
    value: {
      name: body.name,
      startDate,
      endDate,
      summary: summary.value,
      role: role.value,
      workStyle: workStyle.value,
      teamSize: (body.teamSize as number | null | undefined) ?? null,
    },
  };
}

/** PUT /projects/:id のボディを UpdateProjectInput に検証変換する（部分更新）。 */
export function parseUpdateInput(body: unknown): ParseResult<UpdateProjectInput> {
  if (!isRecord(body)) return { ok: false, error: "invalid body" };

  const out: UpdateProjectInput = {};

  if ("name" in body) {
    if (!isNonEmptyString(body.name))
      return { ok: false, error: "name must be a non-empty string" };
    out.name = body.name;
  }
  if ("startDate" in body) {
    const d = toDate(body.startDate);
    if (!d) return { ok: false, error: "startDate is invalid" };
    out.startDate = d;
  }
  if ("endDate" in body) {
    if (body.endDate === null) {
      out.endDate = null;
    } else {
      const d = toDate(body.endDate);
      if (!d) return { ok: false, error: "endDate is invalid" };
      out.endDate = d;
    }
  }
  if ("teamSize" in body) {
    if (body.teamSize === null) {
      out.teamSize = null;
    } else if (typeof body.teamSize !== "number" || !Number.isFinite(body.teamSize)) {
      return { ok: false, error: "teamSize must be a number" };
    } else {
      out.teamSize = body.teamSize;
    }
  }
  for (const key of ["summary", "role", "workStyle"] as const) {
    if (key in body) {
      const r = optionalString(body[key]);
      if (!r.ok) return { ok: false, error: `${key} ${r.error}` };
      out[key] = r.value;
    }
  }

  return { ok: true, value: out };
}
