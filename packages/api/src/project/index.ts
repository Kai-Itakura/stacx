import { Hono } from "hono";
import { authMiddleware } from "../auth/index";
import type { AppEnv } from "../types";
import { parseCreateInput, parseUpdateInput } from "./parse";
import { createProject, deleteProject, getProject, listProjects, updateProject } from "./project";

/** JSON ボディを安全に読む。壊れた JSON は undefined（→ パーサが invalid body 扱い）。 */
async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

/**
 * Project の CRUD ルート。/api/projects 配下にマウントする。
 * 全ルートで認証必須・操作は c.var.user.id 所有のものに限定される。
 */
export const projectApp = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .post("/", async (c) => {
    const parsed = parseCreateInput(await readJson(c));
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const project = await createProject(c.var.db, c.var.user.id, parsed.value);
    return c.json({ project }, 201);
  })
  .get("/", async (c) => {
    const projects = await listProjects(c.var.db, c.var.user.id);
    return c.json({ projects });
  })
  .get("/:id", async (c) => {
    const project = await getProject(c.var.db, c.var.user.id, c.req.param("id"));
    if (!project) return c.json({ error: "not_found" }, 404);
    return c.json({ project });
  })
  .put("/:id", async (c) => {
    const parsed = parseUpdateInput(await readJson(c));
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const project = await updateProject(c.var.db, c.var.user.id, c.req.param("id"), parsed.value);
    if (!project) return c.json({ error: "not_found" }, 404);
    return c.json({ project });
  })
  .delete("/:id", async (c) => {
    const deleted = await deleteProject(c.var.db, c.var.user.id, c.req.param("id"));
    if (!deleted) return c.json({ error: "not_found" }, 404);
    return c.body(null, 204);
  });
