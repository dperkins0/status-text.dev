/**
 * GET /api/friends/search?q=query
 * Search for users by email or username
 */

import type { Route } from "./+types/search";
import { getUserFromSession } from "~/lib/auth.server";
import type { ApiResponse, PublicUser } from "~/lib/types";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { DB, SESSIONS } = context.cloudflare.env;

  try {
    // Authenticate
    const cookieHeader = request.headers.get("Cookie");
    const cookies = Object.fromEntries(
      cookieHeader?.split("; ").map((c) => c.split("=")) || []
    );
    const sessionToken = cookies.session;

    if (!sessionToken) {
      return Response.json(
        { success: false, error: "Not authenticated" } satisfies ApiResponse,
        { status: 401 }
      );
    }

    const userId = await getUserFromSession(sessionToken, SESSIONS, DB);
    if (!userId) {
      return Response.json(
        { success: false, error: "Invalid session" } satisfies ApiResponse,
        { status: 401 }
      );
    }

    // Get search query
    const url = new URL(request.url);
    const query = url.searchParams.get("q");

    if (!query || query.length < 2) {
      return Response.json(
        { success: false, error: "Search query must be at least 2 characters" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Search users by email or username (exclude self)
    const users = await DB.prepare(`
      SELECT id, username, avatar_url
      FROM users
      WHERE (email LIKE ? OR username LIKE ?)
        AND id != ?
      LIMIT 20
    `)
      .bind(`%${query}%`, `%${query}%`, userId)
      .all<PublicUser>();

    return Response.json(
      {
        success: true,
        data: { users: users.results || [] },
      } satisfies ApiResponse<{ users: PublicUser[] }>,
      { status: 200 }
    );
  } catch (error) {
    console.error("Search users error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
