import type { Location } from "react-router";

/** URL 単位でスクロール位置を覚えるパス。 */
const RESTORE_BY_PATHNAME = new Set(["/memos"]);

/**
 * `<ScrollRestoration getKey>` に渡すキー。
 * 既定のキーは履歴エントリごとに変わるため、キャンセルの `<Link>` や保存後の redirect で
 * 一覧へ戻ると新しいエントリ扱いになり先頭に戻ってしまう。一覧は URL をキーにして位置を引き継ぐ。
 */
export function scrollRestorationKey(location: Pick<Location, "pathname" | "key">): string {
  return RESTORE_BY_PATHNAME.has(location.pathname) ? location.pathname : location.key;
}
