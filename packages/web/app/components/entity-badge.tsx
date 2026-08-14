import { Code, FolderCheck, FolderOpen, Tag } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { tagToneClass, techToneClass } from "~/lib/tag-color";

/**
 * 種別ごとのバッジ。プロジェクト / タグ / 技術スタックは同じ行に並ぶため、
 * 色だけでなく**アイコンと形**でも区別する（色覚に依存させない）。
 * 見た目の差をここ 1 箇所に集約し、画面間でズレないようにする。
 */

/**
 * プロジェクト。バッジにせず下線付きのテキストで出し、色付き pill のタグと明確に分ける。
 * 進行中は黄・終了は緑のフォルダアイコンで状態を示す。id を渡すと詳細へのリンクになる。
 */
/**
 * プロジェクトの状態アイコン。進行中は黄、完了は緑。
 * メモ側とプロジェクト一覧で同じ意味・同じ色にするため、ここ 1 箇所に定義する。
 */
export function ProjectStatusIcon({ active }: { active?: boolean }) {
  return active ? (
    <FolderOpen aria-label="進行中" className="text-warning size-4 shrink-0" />
  ) : (
    <FolderCheck aria-label="完了" className="text-success size-4 shrink-0" />
  );
}

export function ProjectBadge({
  id,
  name,
  active,
}: {
  id?: string;
  name: string;
  /** 進行中（終了日が未設定）か。 */
  active?: boolean;
}) {
  const content = (
    <>
      <ProjectStatusIcon active={active} />
      {name}
    </>
  );
  const className = "inline-flex items-center gap-1 text-sm";
  if (!id) return <span className={className}>{content}</span>;
  return (
    <Link
      to={`/projects/${id}`}
      className={`${className} underline underline-offset-4 hover:opacity-80`}
    >
      {content}
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
