import { Hono } from "hono";
import { authMiddleware } from "../auth/index";
import type { AppEnv } from "../types";
import { jsonValidator } from "../validation";
import { createStarSchema, updateStarSchema } from "./request-schema";
import { createStar, deleteStar, getStar, listStars, updateStar } from "./star";

export const starApp = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .post("/", jsonValidator(createStarSchema), async (c) => {
    const result = await createStar(c.var.db, c.var.user.id, c.req.valid("json"));
    if (!result.ok) return c.json({ error: result.reason }, 400);
    return c.json({ id: result.star.id }, 201);
  })
  .get("/", async (c) => {
    const projectId = c.req.query("projectId");
    const list = await listStars(c.var.db, c.var.user.id, projectId ? { projectId } : undefined);
    return c.json({ stars: list });
  })
  .get("/:id", async (c) => {
    const star = await getStar(c.var.db, c.var.user.id, c.req.param("id"));
    if (!star) return c.json({ error: "not_found" }, 404);
    return c.json({ star });
  })
  .put("/:id", jsonValidator(updateStarSchema), async (c) => {
    const result = await updateStar(
      c.var.db,
      c.var.user.id,
      c.req.param("id"),
      c.req.valid("json"),
    );
    if (!result.ok) {
      return c.json({ error: result.reason }, result.reason === "not_found" ? 404 : 400);
    }
    return c.json({ id: result.id });
  })
  .delete("/:id", async (c) => {
    const deleted = await deleteStar(c.var.db, c.var.user.id, c.req.param("id"));
    if (!deleted) return c.json({ error: "not_found" }, 404);
    return c.body(null, 204);
  });
