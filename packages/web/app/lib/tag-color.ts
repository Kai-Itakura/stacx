/** タグ用パレットの色数（app.css の --tag-1..6 と対応）。 */
export const TAG_TONE_COUNT = 6;

const TONE_CLASSES = [
  "bg-tag-1-subtle text-tag-1",
  "bg-tag-2-subtle text-tag-2",
  "bg-tag-3-subtle text-tag-3",
  "bg-tag-4-subtle text-tag-4",
  "bg-tag-5-subtle text-tag-5",
  "bg-tag-6-subtle text-tag-6",
] as const;

/**
 * タグ名から配色（1..TAG_TONE_COUNT）を決める。
 * 同じ名前が常に同じ色になるよう FNV-1a の決定的ハッシュを使う（保存はしない）。
 */
export function tagTone(name: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    // FNV prime 16777619 の乗算。32bit に丸めるため Math.imul を使う。
    hash = Math.imul(hash, 0x01000193);
  }
  return (Math.abs(hash) % TAG_TONE_COUNT) + 1;
}

/** タグ名に対応する Badge 用のクラス（subtle 背景 + 同系の前景）。 */
export function tagToneClass(name: string): string {
  return TONE_CLASSES[tagTone(name) - 1] as string;
}

const OUTLINE_TONE_CLASSES = [
  "border-tag-1/40 text-tag-1",
  "border-tag-2/40 text-tag-2",
  "border-tag-3/40 text-tag-3",
  "border-tag-4/40 text-tag-4",
  "border-tag-5/40 text-tag-5",
  "border-tag-6/40 text-tag-6",
] as const;

/**
 * 技術スタック用のクラス（枠線 + 同系の前景）。
 * 配色ロジックはタグと共通だが、種類軸のタグ（塗り）と軸を見分けられるよう形を変える。
 */
export function techToneClass(name: string): string {
  return OUTLINE_TONE_CLASSES[tagTone(name) - 1] as string;
}
