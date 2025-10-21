/**
 * GET /api/friends/requests
 * Get pending friend requests (both sent and received)
 */

import type { Route } from "./+types/requests";
import { getUserFromSession } from "~/lib/auth.server";
import type { ApiResponse, PublicUser } from "~/lib/types";

interface FriendRequest extends PublicUser {
  request_id: string;
  created_at: number;
  type: "received" | "sent";
}

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

    // Get received requests
    const receivedRequests = await DB.prepare(`
      SELECT
        f.id as request_id,
        f.created_at,
        u.id,
        u.username,
        u.avatar_url
      FROM friendships f
      JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `)
      .bind(userId)
      .all<Omit<FriendRequest, "type">>();

    // Get sent requests
    const sentRequests = await DB.prepare(`
      SELECT
        f.id as request_id,
        f.created_at,
        u.id,
        u.username,
        u.avatar_url
      FROM friendships f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `)
      .bind(userId)
      .all<Omit<FriendRequest, "type">>();

    const received = (receivedRequests.results || []).map((r) => ({
      ...r,
      type: "received" as const,
    }));

    const sent = (sentRequests.results || []).map((r) => ({
      ...r,
      type: "sent" as const,
    }));

    return Response.json(
      {
        success: true,
        data: { received, sent },
      } satisfies ApiResponse<{ received: FriendRequest[]; sent: FriendRequest[] }>,
      { status: 200 }
    );
  } catch (error) {
    console.error("Get requests error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
