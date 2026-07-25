import type { FormMetadata } from "@conform-to/react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { action } from "~/resources/create-tag";
import { type IntakeTag, tagFormSchema } from "./schema";

type TagFieldProps = {
  tags: IntakeTag[];
  formStatus: FormMetadata["status"];
};

const TagField = ({ tags, formStatus }: TagFieldProps) => {
  const tagFetcher = useFetcher<typeof action>();
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [newTag, setNewTag] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);

  const toggleTag = (id: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addTag = () => {
    // メモ/プロジェクトと同じく zod スキーマで検証する。
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

  useEffect(() => {
    if (formStatus === "success") {
      setSelectedTags(new Set());
    }
  }, [formStatus]);

  // インライン作成したタグは自動選択し、入力欄をクリア。
  useEffect(() => {
    const data = tagFetcher.data;
    if (data?.ok && data.tagId) {
      const id = data.tagId;
      setSelectedTags((prev) => new Set(prev).add(id));
      setNewTag("");
    }
  }, [tagFetcher.data]);

  // クライアント検証エラーを優先し、無ければサーバ（重複等）のエラーを出す。
  const serverError = tagFetcher.data && !tagFetcher.data.ok ? tagFetcher.data.error : null;
  const displayError = tagError ?? serverError;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">タグ</span>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => {
          const selected = selectedTags.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              aria-pressed={selected}
              className={
                selected
                  ? "bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm"
                  : "border-input hover:bg-muted rounded-full border px-3 py-1 text-sm"
              }
            >
              {tag.name}
            </button>
          );
        })}
        {/* 選択中タグを form に載せる隠しフィールド。 */}
        {[...selectedTags].map((id) => (
          <input key={id} type="hidden" name="tagIds" value={id} />
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        <Input
          value={newTag}
          onChange={(e) => {
            setNewTag(e.target.value);
            setTagError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder="新規タグを追加"
          className="h-8 max-w-48"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTag}
          disabled={tagFetcher.state !== "idle"}
        >
          追加
        </Button>
      </div>
      {displayError && <p className="text-destructive text-sm">{displayError}</p>}
    </div>
  );
};

export default TagField;
