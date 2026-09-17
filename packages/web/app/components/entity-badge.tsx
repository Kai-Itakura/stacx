import { Code, FolderCheck, FolderOpen, Tag } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";

/*
 * プロジェクト / タグ / 技術スタックは同じ行に並ぶ。色を持つのは STAR の状態だけなので、
 * ここはアイコンと形（塗り / 枠線）だけで区別する。
 */

/** プロジェクトの状態アイコン。進行中は黄、完了は緑。 */
export function ProjectStatusIcon({ active }: { active?: boolean }) {
  return active ? (
    <FolderOpen aria-label="進行中" className="text-muted-foreground size-4 shrink-0" />
  ) : (
    <FolderCheck aria-label="完了" className="text-subtle-foreground size-4 shrink-0" />
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

/** タグ（種類軸）。pill＋タグアイコン。塗りで技術スタックと分ける。 */
export function TagBadge({ name }: { name: string }) {
  return (
    <Badge variant="secondary">
      <Tag />
      {name}
    </Badge>
  );
}

/** 技術スタック。タグ（塗り）と別軸なので枠線＋コードアイコンで描く。 */
export function TechBadge({ name }: { name: string }) {
  return (
    <Badge variant="outline">
      <Code />
      {name}
    </Badge>
  );
}
