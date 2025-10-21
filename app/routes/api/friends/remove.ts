/**
 * DELETE /api/friends/remove
 * Remove a friend or reject/cancel a friend request
 */

import type { Route } from "./+types/remove";
import { getUserFromSession } from "~/lib/auth.server";
import type { ApiResponse } from "~/lib/types";

export async function action({ request, context }: Route.ActionArgs) {
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

    const body = (await request.json()) as { friendId?: string; requestId?: string };
    const { friendId, requestId } = body;

    if (!friendId && !requestId) {
      return Response.json(
        { success: false, error: "Friend ID or Request ID is required" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (requestId) {
      // Remove by request ID
      const result = await DB.prepare(
        "DELETE FROM friendships WHERE id = ? AND (user_id = ? OR friend_id = ?)"
      )
        .bind(requestId, userId, userId)
        .run();

      if (result.meta.changes === 0) {
        return Response.json(
          { success: false, error: "Friend request not found" } satisfies ApiResponse,
          { status: 404 }
        );
      }
    } else if (friendId) {
      // Remove by friend ID (works for both directions)
      const result = await DB.prepare(
        "DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)"
      )
        .bind(userId, friendId, friendId, userId)
        .run();

      if (result.meta.changes === 0) {
        return Response.json(
          { success: false, error: "Friendship not found" } satisfies ApiResponse,
          { status: 404 }
        );
      }
    }

    return Response.json(
      {
        success: true,
      } satisfies ApiResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error("Remove friend error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
