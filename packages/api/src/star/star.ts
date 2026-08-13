import { and, eq } from "drizzle-orm";
import type { DB } from "../auth/session";
import { memos, type StarLog, starLogs } from "../db/schema";
import { ulid } from "../id";
import type { UpsertStarInput } from "./request-schema";

export type GetStarResult =
  | { ok: true; star: StarLog | null }
  | { ok: false; reason: "memo_not_found" };

export type UpsertStarResult =
  | { ok: true; star: StarLog }
  | { ok: false; reason: "memo_not_found" };

/** 空文字・空白のみは null（未入力）に正規化する。 */
const norm = (s: string | undefined): string | null => (s && s.trim().length > 0 ? s : null);

/** 呼び出し User が当該 Memo を所有しているか。 */
async function ownsMemo(db: DB, userId: string, memoId: string): Promise<boolean> {
  const rows = await db
    .select({ id: memos.id })
    .from(memos)
    .where(and(eq(memos.id, memoId), eq(memos.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

/** Memo 所有を確認し、その STAR ログを返す。未 STAR 化なら star=null、非所有は memo_not_found。 */
export async function getStarLog(db: DB, userId: string, memoId: string): Promise<GetStarResult> {
  if (!(await ownsMemo(db, userId, memoId))) return { ok: false, reason: "memo_not_found" };
  const row = await db.query.starLogs.findFirst({ where: (s, { eq: e }) => e(s.memoId, memoId) });
  return { ok: true, star: row ?? null };
}

/**
 * Memo 所有を確認し、STAR ログを upsert する（memo_id UNIQUE で 1:1）。
 * S/T/A/R は毎回全項目を置換する（エディタが常に 4 項目を送るため）。非所有は memo_not_found。
 */
export async function upsertStarLog(
  db: DB,
  userId: string,
  memoId: string,
  input: UpsertStarInput,
): Promise<UpsertStarResult> {
  if (!(await ownsMemo(db, userId, memoId))) return { ok: false, reason: "memo_not_found" };

  const now = new Date();
  const fields = {
    situation: norm(input.situation),
    task: norm(input.task),
    action: norm(input.action),
    result: norm(input.result),
    status: input.status,
  };

  const existing = await db
    .select({ id: starLogs.id })
    .from(starLogs)
    .where(eq(starLogs.memoId, memoId))
    .limit(1);

  // insert/update ... returning は 1 行を返す。型の都合で配列なので先頭を取る。
  if (existing[0]) {
    const rows = await db
      .update(starLogs)
      .set({ ...fields, updatedAt: now })
      .where(eq(starLogs.id, existing[0].id))
      .returning();
    return { ok: true, star: rows[0] as StarLog };
  }

  const rows = await db
    .insert(starLogs)
    .values({ id: ulid(), userId, memoId, ...fields, createdAt: now, updatedAt: now })
    .returning();
  return { ok: true, star: rows[0] as StarLog };
}
