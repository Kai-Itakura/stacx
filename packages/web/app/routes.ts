import { index, prefix, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("projects", "routes/projects.tsx"),
  route("projects/new", "routes/projects.new.tsx"),
  route("projects/:id", "routes/projects.$id.tsx"),
  // actions専用ルート
  ...prefix("resources", [
    route("tags/create", "resources/create-tag.ts"),
    route("projects/create", "resources/create-project.ts"),
    route("memos/create", "resources/create-memo.ts"),
  ]),
] satisfies RouteConfig;
