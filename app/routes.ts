import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("app", "routes/app.tsx"),

  // API routes - Auth
  route("api/auth/register", "routes/api/auth/register.ts"),
  route("api/auth/login", "routes/api/auth/login.ts"),
  route("api/auth/logout", "routes/api/auth/logout.ts"),
  route("api/auth/me", "routes/api/auth/me.ts"),

  // API routes - Friends
  route("api/friends", "routes/api/friends/index.ts"),
  route("api/friends/requests", "routes/api/friends/requests.ts"),
  route("api/friends/request", "routes/api/friends/request.ts"),
  route("api/friends/accept", "routes/api/friends/accept.ts"),
  route("api/friends/remove", "routes/api/friends/remove.ts"),
  route("api/friends/search", "routes/api/friends/search.ts"),

  // API routes - Status
  route("api/status/update", "routes/api/status/update.ts"),
] satisfies RouteConfig;
