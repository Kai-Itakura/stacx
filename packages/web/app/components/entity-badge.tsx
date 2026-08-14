import { Code, FolderCheck, FolderOpen, Tag } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { tagToneClass, techToneClass } from "~/lib/tag-color";

/*
 * プロジェクト / タグ / 技術スタックは同じ行に並ぶため、色だけでなくアイコンと形でも
 * 区別する（色覚に依存させない）。
 */

/** プロジェクトの状態アイコン。進行中は黄、完了は緑。 */
export function ProjectStatusIcon({ active }: { active?: boolean }) {
  return active ? (
    <FolderOpen aria-label="進行中" className="text-warning size-4 shrink-0" />
  ) : (
    <FolderCheck aria-label="完了" className="text-success size-4 shrink-0" />
  );
}

/** プロジェクト。タグの pill と分けるため下線付きテキストで出す。id があれば詳細へのリンク。 */
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
