/**
 * POST /api/friends/request
 * Send a friend request to another user
 */

import type { Route } from "./+types/request";
import { getUserFromSession, generateId } from "~/lib/auth.server";
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

    const body = (await request.json()) as { friendId: string };
    const { friendId } = body;

    if (!friendId) {
      return Response.json(
        { success: false, error: "Friend ID is required" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Can't add yourself
    if (friendId === userId) {
      return Response.json(
        { success: false, error: "Cannot add yourself as a friend" } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Check if friend exists
    const friend = await DB.prepare("SELECT id FROM users WHERE id = ?")
      .bind(friendId)
      .first();

    if (!friend) {
      return Response.json(
        { success: false, error: "User not found" } satisfies ApiResponse,
        { status: 404 }
      );
    }

    // Check if friendship already exists (in either direction)
    const existingFriendship = await DB.prepare(`
      SELECT id, status FROM friendships
      WHERE (user_id = ? AND friend_id = ?)
         OR (user_id = ? AND friend_id = ?)
    `)
      .bind(userId, friendId, friendId, userId)
      .first<{ id: string; status: string }>();

    if (existingFriendship) {
      if (existingFriendship.status === "accepted") {
        return Response.json(
          { success: false, error: "Already friends" } satisfies ApiResponse,
          { status: 409 }
        );
      } else if (existingFriendship.status === "pending") {
        return Response.json(
          { success: false, error: "Friend request already pending" } satisfies ApiResponse,
          { status: 409 }
        );
      } else if (existingFriendship.status === "blocked") {
        return Response.json(
          { success: false, error: "Cannot send friend request" } satisfies ApiResponse,
          { status: 403 }
        );
      }
    }

    // Create friend request
    const requestId = generateId();
    const now = Date.now();

    await DB.prepare(
      "INSERT INTO friendships (id, user_id, friend_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)"
    )
      .bind(requestId, userId, friendId, now)
      .run();

    return Response.json(
      {
        success: true,
        data: { requestId },
      } satisfies ApiResponse<{ requestId: string }>,
      { status: 201 }
    );
  } catch (error) {
    console.error("Send friend request error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
