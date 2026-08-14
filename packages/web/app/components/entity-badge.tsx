import { FolderKanban, Tag } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { tagToneClass, techToneClass } from "~/lib/tag-color";

/**
 * 種別ごとのバッジ。プロジェクト / タグ / 技術スタックは同じ行に並ぶため、
 * 色だけでなく**アイコンと形**でも区別する（色覚に依存させない）。
 * 見た目の差をここ 1 箇所に集約し、画面間でズレないようにする。
 */

/** プロジェクト。角丸四角＋フォルダアイコンで、pill のタグと形から区別する。 */
export function ProjectBadge({ name }: { name: string }) {
  return (
    <Badge variant="info" className="rounded-md">
      <FolderKanban />
      {name}
    </Badge>
  );
}

/** タグ（種類軸）。pill＋タグアイコン。色はタグ名から決まる。 */
export function TagBadge({ name }: { name: string }) {
  return (
    <Badge variant="tag" className={tagToneClass(name)}>
      <Tag />
      {name}
    </Badge>
  );
}

/** 技術スタック。タグ（塗り）と別軸なので枠線で描く。 */
export function TechBadge({ name }: { name: string }) {
  return (
    <Badge variant="outline" className={techToneClass(name)}>
      {name}
    </Badge>
  );
}
