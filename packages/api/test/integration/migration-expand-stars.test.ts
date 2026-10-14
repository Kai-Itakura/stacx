import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

// Expand（0006）を、移行前のデータが入った D1 に当てて検証する。
// setup が全マイグレーションを当てる env.DB とは別の MIGRATION_DB を使い、0005 まで当てた状態から始める。
const EXPAND_PREFIX = "0006_";

const db = env.MIGRATION_DB;

type StarRow = {
  id: string;
  user_id: string;
  project_id: string;
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
};

async function seedBeforeExpand() {
  await db.batch([
    db.prepare(
      "INSERT INTO users (id, created_at, updated_at, last_login_at) VALUES ('u1', 0, 0, 0)",
    ),
    db.prepare(
      "INSERT INTO projects (id, user_id, name, start_date, created_at, updated_at) VALUES ('p1', 'u1', '案件', 0, 0, 0)",
    ),
    db.prepare(
      "INSERT INTO tags (id, user_id, name, created_at) VALUES ('t1', 'u1', 'トラブル', 0)",
    ),
    db.prepare(
      "INSERT INTO tags (id, user_id, name, created_at) VALUES ('t2', 'u1', '技術選定', 0)",
    ),

    // STAR 化済み（4 項目すべて）。star_logs の方が新しい。
    db.prepare(
      "INSERT INTO memos (id, user_id, project_id, body, created_at, updated_at) VALUES ('m_full', 'u1', 'p1', '本文A', 100, 1000)",
    ),
    db.prepare(
      "INSERT INTO star_logs (id, user_id, memo_id, situation, task, action, result, status, created_at, updated_at) VALUES ('s_full', 'u1', 'm_full', 'S1', 'T1', 'A1', 'R1', 'complete', 200, 3000)",
    ),
    // STAR 化済み（S だけの下書き）。memos の方が新しい。
    db.prepare(
      "INSERT INTO memos (id, user_id, project_id, body, created_at, updated_at) VALUES ('m_partial', 'u1', 'p1', '本文B', 100, 5000)",
    ),
    db.prepare(
      "INSERT INTO star_logs (id, user_id, memo_id, situation, status, created_at, updated_at) VALUES ('s_partial', 'u1', 'm_partial', 'S2', 'draft', 200, 2000)",
    ),
    // 未 STAR 化。
    db.prepare(
      "INSERT INTO memos (id, user_id, project_id, body, created_at, updated_at) VALUES ('m_plain', 'u1', 'p1', '学びC', 100, 1000)",
    ),
    // star_logs はあるが 4 項目とも空（API の検証より前に入った行を想定）。
    db.prepare(
      "INSERT INTO memos (id, user_id, project_id, body, created_at, updated_at) VALUES ('m_empty_log', 'u1', 'p1', '本文D', 100, 1000)",
    ),
    db.prepare(
      "INSERT INTO star_logs (id, user_id, memo_id, situation, status, created_at, updated_at) VALUES ('s_empty', 'u1', 'm_empty_log', '  ', 'draft', 200, 2000)",
    ),

    db.prepare("INSERT INTO memo_tags (memo_id, tag_id) VALUES ('m_full', 't1')"),
    db.prepare("INSERT INTO memo_tags (memo_id, tag_id) VALUES ('m_full', 't2')"),
    db.prepare("INSERT INTO memo_tags (memo_id, tag_id) VALUES ('m_plain', 't1')"),
  ]);
}

async function findStar(id: string): Promise<StarRow | null> {
  return db.prepare("SELECT * FROM stars WHERE id = ?").bind(id).first<StarRow>();
}

async function countRows(table: string): Promise<number> {
  const row = await db.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}

describe("0006: memos / star_logs / memo_tags を stars / star_tags へ写す", () => {
  beforeAll(async () => {
    const expand = env.TEST_MIGRATIONS.find((m) => m.name.startsWith(EXPAND_PREFIX));
    if (!expand) throw new Error(`${EXPAND_PREFIX} のマイグレーションが無い`);
    const before = env.TEST_MIGRATIONS.filter((m) => m.name < expand.name);

    await applyD1Migrations(db, before);
    await seedBeforeExpand();
    await applyD1Migrations(db, [...before, expand]);
  });

  it("Memo 1 件につき、同じ id の STAR が 1 件できる", async () => {
    const ids = await db.prepare("SELECT id FROM stars ORDER BY id").all<{ id: string }>();
    expect(ids.results.map((r) => r.id)).toEqual(["m_empty_log", "m_full", "m_partial", "m_plain"]);
  });

  it("STAR 化済みの Memo は S/T/A/R を star_logs から、本文を作業ログへ写す", async () => {
    expect(await findStar("m_full")).toEqual({
      id: "m_full",
      user_id: "u1",
      project_id: "p1",
      situation: "S1",
      task: "T1",
      action: "A1",
      result: "R1",
      notes: "本文A",
      created_at: 100,
      updated_at: 3000,
    });
  });

  it("下書きの STAR は埋まっている項目だけを写し、更新日時は新しい方を取る", async () => {
    expect(await findStar("m_partial")).toMatchObject({
      situation: "S2",
      task: null,
      action: null,
      result: null,
      notes: "本文B",
      updated_at: 5000,
    });
  });

  it("未 STAR 化の Memo は本文を Result へ写す（未解決の問題として並ばないように）", async () => {
    expect(await findStar("m_plain")).toMatchObject({
      situation: null,
      task: null,
      action: null,
      result: "学びC",
      notes: null,
      updated_at: 1000,
    });
  });

  it("4 項目とも空の star_logs は未 STAR 化と同じに扱う", async () => {
    expect(await findStar("m_empty_log")).toMatchObject({
      situation: null,
      task: null,
      action: null,
      result: "本文D",
      notes: null,
    });
  });

  it("すべての STAR が 4 項目のうち少なくとも 1 つを持つ", async () => {
    const empty = await db
      .prepare(
        `SELECT count(*) AS n FROM stars
         WHERE coalesce(trim(situation), '') = '' AND coalesce(trim(task), '') = ''
           AND coalesce(trim(action), '') = '' AND coalesce(trim(result), '') = ''`,
      )
      .first<{ n: number }>();
    expect(empty?.n).toBe(0);
  });

  it("タグの紐づけを star_tags へ写す", async () => {
    const rows = await db
      .prepare("SELECT star_id, tag_id FROM star_tags ORDER BY star_id, tag_id")
      .all<{ star_id: string; tag_id: string }>();
    expect(rows.results).toEqual([
      { star_id: "m_full", tag_id: "t1" },
      { star_id: "m_full", tag_id: "t2" },
      { star_id: "m_plain", tag_id: "t1" },
    ]);
  });

  it("古いテーブルは消さずに残す（Contract は別のマイグレーション）", async () => {
    expect(await countRows("memos")).toBe(4);
    expect(await countRows("star_logs")).toBe(3);
    expect(await countRows("memo_tags")).toBe(3);
  });
});
