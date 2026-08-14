const MAX_LENGTH = 100;

/**
 * 本文の最初の非空行を見出しとして取り出す（長い場合は短縮）。
 * メモはタイトルを持たないため、一覧やリンク文言では表示のたびにここから導出する。
 */
export function memoExcerpt(body: string): string {
  const firstLine =
    body
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  return firstLine.length > MAX_LENGTH ? `${firstLine.slice(0, MAX_LENGTH)}…` : firstLine;
}
