import { tagActionSchema } from "~/features/tags/schema";
import { TagList, type TagListItem } from "~/features/tags/tag-list";
import { handleAction, unexpectedErrorSubmissionReply } from "~/lib/action-dispatcher.server";
import { apiClient } from "~/lib/api.server";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/tags";

export function meta(_: Route.MetaArgs) {
  return [{ title: "タグ管理 | StacX" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const client = apiClient(request);
  const [tagsRes, memosRes] = await Promise.all([client.api.tags.$get(), client.api.memos.$get()]);
  const tags = tagsRes.ok ? (await tagsRes.json()).tags : [];
  const memos = memosRes.ok ? (await memosRes.json()).memos : [];

  // tagId → 使用しているメモ。専用 API を足さず、一覧レスポンスの tagIds から引く。
  const byTag = new Map<string, { id: string; body: string }[]>();
  for (const memo of memos) {
    for (const tagId of memo.tagIds) {
      const list = byTag.get(tagId) ?? [];
      list.push({ id: memo.id, body: memo.body });
      byTag.set(tagId, list);
    }
  }

  const items: TagListItem[] = tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    memos: byTag.get(tag.id) ?? [],
  }));

  return { tags: items };
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const client = apiClient(request);

  return handleAction(request, tagActionSchema, {
    rename: async ({ id, name }, submissionReply) => {
      try {
        const res = await client.api.tags[":id"].$put({ param: { id }, json: { name } });

        if (!res.ok) {
          return submissionReply({
            formErrors: [
              res.status === 409 ? "同名のタグが既にあります" : "タグの更新に失敗しました",
            ],
          });
        }

        return submissionReply();
      } catch (error) {
        console.error(error);
        return unexpectedErrorSubmissionReply(submissionReply);
      }
    },
    delete: async ({ id }, submissionReply) => {
      try {
        const res = await client.api.tags[":id"].$delete({ param: { id } });

        if (!res.ok) {
          return submissionReply({ formErrors: ["タグの削除に失敗しました"] });
        }

        return submissionReply();
      } catch (error) {
        console.error(error);
        return unexpectedErrorSubmissionReply(submissionReply);
      }
    },
  });
}

export default function Tags({ loaderData }: Route.ComponentProps) {
  return (
    <main className="container mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-bold">タグ管理</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        タグはメモの種類を表す分類軸です。名前の変更ではメモとの紐付けは保持されます。
      </p>
      <div className="mt-6">
        <TagList tags={loaderData.tags} />
      </div>
    </main>
  );
}
