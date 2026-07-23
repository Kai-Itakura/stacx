import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("projects", "routes/projects.tsx"),
  route("projects/new", "routes/projects.new.tsx"),
  route("projects/:id", "routes/projects.$id.tsx"),
] satisfies RouteConfig;
