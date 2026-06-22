import { Hono } from "hono";
import { authMiddleware } from "../auth/index";
import type { AppEnv } from "../types";
import { jsonValidator } from "../validation";
import { createTagSchema } from "./request-schema";
import { createTag, deleteTag, listTags } from "./tag";

/**
 * タグの作成 / 一覧 / 削除ルート。/api/tags 配下にマウントする。
 * 全ルートで認証必須・操作は c.var.user.id 所有のものに限定される。
 */
export const tagApp = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .post("/", jsonValidator(createTagSchema), async (c) => {
    const result = await createTag(c.var.db, c.var.user.id, c.req.valid("json"));
    if (!result.ok) return c.json({ error: "duplicate" }, 409);
    return c.json({ id: result.tag.id }, 201);
  })
  .get("/", async (c) => {
    const list = await listTags(c.var.db, c.var.user.id);
    return c.json({ tags: list });
  })
  .delete("/:id", async (c) => {
    const deleted = await deleteTag(c.var.db, c.var.user.id, c.req.param("id"));
    if (!deleted) return c.json({ error: "not_found" }, 404);
    return c.body(null, 204);
  });
