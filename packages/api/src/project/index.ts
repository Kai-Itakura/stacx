import { Hono } from "hono";
import { authMiddleware } from "../auth/index";
import type { AppEnv } from "../types";
import { jsonValidator } from "../validation";
import { createProject, deleteProject, getProject, listProjects, updateProject } from "./project";
import { createProjectSchema, updateProjectSchema } from "./request-schema";

/**
 * Project の CRUD ルート。/api/projects 配下にマウントする。
 * 全ルートで認証必須・操作は c.var.user.id 所有のものに限定される。
 */
export const projectApp = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .post("/", jsonValidator(createProjectSchema), async (c) => {
    const project = await createProject(c.var.db, c.var.user.id, c.req.valid("json"));
    return c.json({ id: project.id }, 201);
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
  .put("/:id", jsonValidator(updateProjectSchema), async (c) => {
    const project = await updateProject(
      c.var.db,
      c.var.user.id,
      c.req.param("id"),
      c.req.valid("json"),
    );
    if (!project) return c.json({ error: "not_found" }, 404);
    return c.json({ id: project.id });
  })
  .delete("/:id", async (c) => {
    const deleted = await deleteProject(c.var.db, c.var.user.id, c.req.param("id"));
    if (!deleted) return c.json({ error: "not_found" }, 404);
    return c.body(null, 204);
  });
