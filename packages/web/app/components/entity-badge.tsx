import { Code, FolderKanban, Tag } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { tagToneClass, techToneClass } from "~/lib/tag-color";

/**
 * 種別ごとのバッジ。プロジェクト / タグ / 技術スタックは同じ行に並ぶため、
 * 色だけでなく**アイコンと形**でも区別する（色覚に依存させない）。
 * 見た目の差をここ 1 箇所に集約し、画面間でズレないようにする。
 */

/**
 * プロジェクト。角丸四角＋フォルダアイコンで、pill のタグと形から区別する。
 * 色は 1 色に固定する（プロジェクトごとに色を振ると一覧が煩雑になるため）。
 * id を渡すとプロジェクト詳細へのリンクになる。
 */
export function ProjectBadge({ id, name }: { id?: string; name: string }) {
  const badge = (
    <Badge variant="info" className="rounded-md">
      <FolderKanban />
      {name}
    </Badge>
  );
  if (!id) return badge;
  return (
    <Link to={`/projects/${id}`} className="rounded-md hover:opacity-80">
      {badge}
    </Link>
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

/** 技術スタック。タグ（塗り）と別軸なので枠線＋コードアイコンで描く。 */
export function TechBadge({ name }: { name: string }) {
  return (
    <Badge variant="outline" className={techToneClass(name)}>
      <Code />
      {name}
    </Badge>
  );
}
