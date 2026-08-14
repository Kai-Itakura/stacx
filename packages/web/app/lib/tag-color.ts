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
 * 同じ名前が常に同じ色になるよう FNV-1a の決定的ハッシュを使う（色は保存しない）。
 */
export function tagTone(name: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    // FNV prime の乗算。32bit に丸めるため Math.imul を使う。
    hash = Math.imul(hash, 0x01000193);
  }
  return (Math.abs(hash) % TAG_TONE_COUNT) + 1;
}

/** タグ名に対応する Badge 用のクラス（subtle 背景 + 同系の前景）。 */
export function tagToneClass(name: string): string {
  return TONE_CLASSES[tagTone(name) - 1] as string;
}

const UNSELECTED_TONE_CLASSES = [
  "border-tag-1/50 text-tag-1",
  "border-tag-2/50 text-tag-2",
  "border-tag-3/50 text-tag-3",
  "border-tag-4/50 text-tag-4",
  "border-tag-5/50 text-tag-5",
  "border-tag-6/50 text-tag-6",
] as const;

/** 未選択のタグ用クラス。薄い塗りだと選択済みに見えるため、空の器として枠線だけで描く。 */
export function tagToneOutlineClass(name: string): string {
  return UNSELECTED_TONE_CLASSES[tagTone(name) - 1] as string;
}

const SELECTED_TONE_CLASSES = [
  "bg-tag-1 text-background",
  "bg-tag-2 text-background",
  "bg-tag-3 text-background",
  "bg-tag-4 text-background",
  "bg-tag-5 text-background",
  "bg-tag-6 text-background",
] as const;

/** 選択中のタグ用クラス。前景に --background を使うことで両テーマとも地の色で文字が抜ける。 */
export function tagToneSelectedClass(name: string): string {
  return SELECTED_TONE_CLASSES[tagTone(name) - 1] as string;
}

const OUTLINE_TONE_CLASSES = [
  "border-tag-1/40 text-tag-1",
  "border-tag-2/40 text-tag-2",
  "border-tag-3/40 text-tag-3",
  "border-tag-4/40 text-tag-4",
  "border-tag-5/40 text-tag-5",
  "border-tag-6/40 text-tag-6",
] as const;

/** 技術スタック用のクラス。配色はタグと共通だが、軸の違いが分かるよう塗りでなく枠線で描く。 */
export function techToneClass(name: string): string {
  return OUTLINE_TONE_CLASSES[tagTone(name) - 1] as string;
}
