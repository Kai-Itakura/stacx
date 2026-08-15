const pad = (n: number) => String(n).padStart(2, "0");

/**
 * ISO 日時をローカルタイムゾーンの YYYY-MM-DD に変換する。
 * ISO 文字列の先頭 10 文字は UTC の日付なので、日付境界をまたぐと 1 日ずれる。
 */
export function toLocalDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
