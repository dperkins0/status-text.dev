import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("app", "routes/app.tsx"),

  // API routes
  route("api/auth/register", "routes/api/auth/register.ts"),
  route("api/auth/login", "routes/api/auth/login.ts"),
  route("api/auth/logout", "routes/api/auth/logout.ts"),
  route("api/auth/me", "routes/api/auth/me.ts"),
] satisfies RouteConfig;
