/**
 * POST /api/friends/accept
 * Accept a friend request
 */

import type { Route } from "./+types/accept";
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

    const body = (await request.json()) as { requestId: string };
    const { requestId } = body;

    if (!requestId) {
      return Response.json(
        { success: false, error: "Request ID is required" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Check if request exists and is for this user
    const friendRequest = await DB.prepare(
      "SELECT id, user_id, friend_id, status FROM friendships WHERE id = ?"
    )
      .bind(requestId)
      .first<{ id: string; user_id: string; friend_id: string; status: string }>();

    if (!friendRequest) {
      return Response.json(
        { success: false, error: "Friend request not found" } satisfies ApiResponse,
        { status: 404 }
      );
    }

    // Verify the request is for the current user
    if (friendRequest.friend_id !== userId) {
      return Response.json(
        { success: false, error: "Not authorized to accept this request" } satisfies ApiResponse,
        { status: 403 }
      );
    }

    // Check if already accepted
    if (friendRequest.status === "accepted") {
      return Response.json(
        { success: false, error: "Friend request already accepted" } satisfies ApiResponse,
        { status: 409 }
      );
    }

    // Accept the request
    const now = Date.now();
    await DB.prepare(
      "UPDATE friendships SET status = 'accepted', accepted_at = ? WHERE id = ?"
    )
      .bind(now, requestId)
      .run();

    return Response.json(
      {
        success: true,
      } satisfies ApiResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error("Accept friend request error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
