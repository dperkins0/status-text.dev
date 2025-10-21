/**
 * GET /api/auth/me
 * Get the current authenticated user
 */

import type { Route } from "./+types/me";
import { getUserFromSession } from "~/lib/auth.server";
import type { ApiResponse, PublicUser, User } from "~/lib/types";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { DB, SESSIONS } = context.cloudflare.env;

  try {
    // Get session cookie
    const cookieHeader = request.headers.get("Cookie");
    const cookies = Object.fromEntries(
      cookieHeader?.split("; ").map((c) => c.split("=")) || []
    );
    const sessionToken = cookies.session;

    if (!sessionToken) {
      return Response.json(
        {
          success: false,
          error: "Not authenticated",
        } satisfies ApiResponse,
        { status: 401 }
      );
    }

    // Get user from session
    const userId = await getUserFromSession(sessionToken, SESSIONS, DB);

    if (!userId) {
      return Response.json(
        {
          success: false,
          error: "Invalid or expired session",
        } satisfies ApiResponse,
        { status: 401 }
      );
    }

    // Get user data
    const user = await DB.prepare(
      "SELECT id, username, email, avatar_url FROM users WHERE id = ?"
    )
      .bind(userId)
      .first<User>();

    if (!user) {
      return Response.json(
        {
          success: false,
          error: "User not found",
        } satisfies ApiResponse,
        { status: 404 }
      );
    }

    // Get current status
    const status = await DB.prepare(
      "SELECT status_type, status_text FROM status_updates WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
    )
      .bind(userId)
      .first<{ status_type: string; status_text: string }>();

    const userData: PublicUser & {
      email: string;
      status_type: string;
      status_text: string;
    } = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar_url: user.avatar_url,
      status_type: status?.status_type || "offline",
      status_text: status?.status_text || "",
    };

    return Response.json(
      {
        success: true,
        data: { user: userData },
      } satisfies ApiResponse<{ user: typeof userData }>,
      { status: 200 }
    );
  } catch (error) {
    console.error("Get user error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
