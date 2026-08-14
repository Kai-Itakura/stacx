import type { FormMetadata } from "@conform-to/react";
import { Check, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { tagToneOutlineClass, tagToneSelectedClass } from "~/lib/tag-color";
import type { action } from "~/resources/create-tag";
import { type IntakeTag, tagFormSchema } from "./schema";

type TagFieldProps = {
  tags: IntakeTag[];
  formStatus: FormMetadata["status"];
  /** 編集時の初期選択。作成時は空。 */
  initialSelected?: string[];
};

const TagField = ({ tags, formStatus, initialSelected }: TagFieldProps) => {
  const tagFetcher = useFetcher<typeof action>();
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    () => new Set(initialSelected ?? []),
  );
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
    // Enter キーは Button の disabled を経由しないため、ここでも送信中を弾く。
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

  useEffect(() => {
    if (formStatus === "success") {
      setSelectedTags(new Set());
    }
  }, [formStatus]);

  useEffect(() => {
    const data = tagFetcher.data;
    if (data?.ok && data.tagId) {
      const id = data.tagId;
      setSelectedTags((prev) => new Set(prev).add(id));
      setNewTag("");
    }
  }, [tagFetcher.data]);

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
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition-colors ${
                selected
                  ? `${tagToneSelectedClass(tag.name)} border-transparent`
                  : `${tagToneOutlineClass(tag.name)} hover:bg-muted`
              }`}
            >
              {selected ? <Check className="h-3.5 w-3.5" /> : <Tag className="h-3.5 w-3.5" />}
              {tag.name}
            </button>
          );
        })}
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
