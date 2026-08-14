import { Check, FolderOpen, Plus, Tag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { tagToneSelectedClass } from "~/lib/tag-color";
import type { action } from "~/resources/create-tag";
import { type IntakeProject, type IntakeTag, tagFormSchema } from "./schema";

const CHIP = "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs";

type IntakeChipsProps = {
  projects: IntakeProject[];
  tags: IntakeTag[];
  projectId: string;
  onProjectChange: (id: string) => void;
  selectedTagIds: string[];
  onToggleTag: (id: string) => void;
};

/**
 * 入力欄の上に置く選択チップ列。プロジェクトとタグを小さく畳んでおき、
 * 本文の入力領域を圧迫しないようにする（選択はドロップダウンで行う）。
 * 実際の送信値は hidden input で form に載せる。
 */
export function IntakeChips({
  projects,
  tags,
  projectId,
  onProjectChange,
  selectedTagIds,
  onToggleTag,
}: IntakeChipsProps) {
  const tagFetcher = useFetcher<typeof action>();
  const [newTag, setNewTag] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);

  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  const selected = tags.filter((t) => selectedTagIds.includes(t.id));

  const addTag = () => {
    if (tagFetcher.state !== "idle") return;
    const result = tagFormSchema.safeParse({ name: newTag });
    if (!result.success) {
      setTagError(result.error.issues[0]?.message ?? "タグ名を入力してください");
      return;
    }
    setTagError(null);
    tagFetcher.submit(result.data, {
      method: "post",
      action: "/resources/tags/create",
      encType: "application/json",
    });
  };

  // 作成したタグは自動選択し、入力欄をクリアする。
  useEffect(() => {
    const data = tagFetcher.data;
    if (data?.ok && data.tagId) {
      onToggleTag(data.tagId);
      setNewTag("");
    }
  }, [tagFetcher.data, onToggleTag]);

  const serverError = tagFetcher.data && !tagFetcher.data.ok ? tagFetcher.data.error : null;
  const displayError = tagError ?? serverError;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* 送信値は hidden で載せる（チップは見た目の操作に徹する）。 */}
      <input type="hidden" name="projectId" value={project?.id ?? ""} />
      {selectedTagIds.map((id) => (
        <input key={id} type="hidden" name="tagIds" value={id} />
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={`${CHIP} border-input hover:bg-muted max-w-[12rem]`}>
            <FolderOpen className="size-3.5 shrink-0" />
            <span className="truncate">{project?.name ?? "プロジェクト"}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>プロジェクト</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {projects.map((p) => (
            <DropdownMenuItem key={p.id} onSelect={() => onProjectChange(p.id)}>
              {p.id === project?.id ? <Check /> : <span className="size-4" />}
              {p.name}
              {p.endDate === null && (
                <span className="text-muted-foreground ml-auto text-xs">進行中</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {selected.map((tag) => (
        <span
          key={tag.id}
          className={`${CHIP} border-transparent ${tagToneSelectedClass(tag.name)}`}
        >
          <Tag className="size-3.5 shrink-0" />
          <span className="max-w-[8rem] truncate">{tag.name}</span>
          <button
            type="button"
            aria-label={`${tag.name} を外す`}
            onClick={() => onToggleTag(tag.id)}
            className="opacity-70 hover:opacity-100"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}

      {/* 複数選びながらチップの増減を確認できるよう、開いていてもページを触れるようにする。 */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="タグを追加"
            className={`${CHIP} border-input hover:bg-muted`}
          >
            <Plus className="size-3.5" />
            {selected.length === 0 && <span>タグ</span>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>タグ</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {tags.map((tag) => (
            <DropdownMenuItem
              key={tag.id}
              // 続けて複数選びたいので、選択してもメニューを閉じない。
              onSelect={(e) => {
                e.preventDefault();
                onToggleTag(tag.id);
              }}
            >
              {selectedTagIds.includes(tag.id) ? <Check /> : <span className="size-4" />}
              {tag.name}
            </DropdownMenuItem>
          ))}
          {tags.length > 0 && <DropdownMenuSeparator />}
          <div className="p-1">
            <Input
              value={newTag}
              onChange={(e) => {
                setNewTag(e.target.value);
                setTagError(null);
              }}
              onKeyDown={(e) => {
                // メニュー内なので Enter が親へ伝播しないようにする。
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  addTag();
                }
              }}
              placeholder="新規タグを追加"
              className="h-8"
            />
            {displayError && <p className="text-destructive mt-1 text-xs">{displayError}</p>}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
