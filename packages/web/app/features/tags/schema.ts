import { z } from "zod";
import { tagFormSchema } from "~/features/intake/schema";

/**
 * タグ管理画面の action スキーマ。リネームと削除が同じ action を通るため判別子で分ける。
 * 名前の検証はインライン作成と同じ tagFormSchema を使う。
 */
export const tagActionSchema = z.discriminatedUnion("intent", [
  tagFormSchema.extend({
    intent: z.literal("rename"),
    id: z.string().min(1),
  }),
  z.object({
    intent: z.literal("delete"),
    id: z.string().min(1),
  }),
]);
