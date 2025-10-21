/**
 * POST /api/auth/logout
 * Log out the current user and destroy their session
 */

import type { Route } from "./+types/logout";
import { deleteSession } from "~/lib/auth.server";
import type { ApiResponse } from "~/lib/types";

export async function action({ request, context }: Route.ActionArgs) {
  const { DB, SESSIONS } = context.cloudflare.env;

  try {
    // Get session cookie
    const cookieHeader = request.headers.get("Cookie");
    const cookies = Object.fromEntries(
      cookieHeader?.split("; ").map((c) => c.split("=")) || []
    );
    const sessionToken = cookies.session;

    if (sessionToken) {
      // Delete session
      await deleteSession(sessionToken, DB, SESSIONS);
    }

    const response = Response.json(
      {
        success: true,
      } satisfies ApiResponse,
      { status: 200 }
    );

    // Clear session cookie
    response.headers.set(
      "Set-Cookie",
      "session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"
    );

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
