/**
 * GET /api/friends
 * Get user's friends list with their current status
 */

import type { Route } from "./+types/index";
import { getUserFromSession } from "~/lib/auth.server";
import type { ApiResponse, FriendWithStatus } from "~/lib/types";

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

    // Get accepted friends with their latest status
    const friends = await DB.prepare(`
      SELECT
        u.id,
        u.username,
        u.avatar_url,
        COALESCE(s.status_type, 'offline') as status_type,
        COALESCE(s.status_text, '') as status_text,
        COALESCE(s.created_at, 0) as last_updated
      FROM friendships f
      JOIN users u ON (
        CASE
          WHEN f.user_id = ? THEN f.friend_id = u.id
          ELSE f.user_id = u.id
        END
      )
      LEFT JOIN (
        SELECT user_id, status_type, status_text, created_at
        FROM status_updates
        WHERE (user_id, created_at) IN (
          SELECT user_id, MAX(created_at)
          FROM status_updates
          GROUP BY user_id
        )
      ) s ON u.id = s.user_id
      WHERE (f.user_id = ? OR f.friend_id = ?)
        AND f.status = 'accepted'
      ORDER BY u.username ASC
    `)
      .bind(userId, userId, userId)
      .all<FriendWithStatus>();

    return Response.json(
      {
        success: true,
        data: { friends: friends.results || [] },
      } satisfies ApiResponse<{ friends: FriendWithStatus[] }>,
      { status: 200 }
    );
  } catch (error) {
    console.error("Get friends error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
