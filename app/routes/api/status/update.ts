/**
 * PUT /api/status/update
 * Update the current user's status
 */

import type { Route } from "./+types/update";
import { getUserFromSession, generateId } from "~/lib/auth.server";
import type { ApiResponse, UpdateStatusRequest, StatusType } from "~/lib/types";

const VALID_STATUS_TYPES: StatusType[] = [
  "online",
  "away",
  "busy",
  "brb",
  "phone",
  "lunch",
  "offline",
  "appear_offline",
];

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

    const body = (await request.json()) as UpdateStatusRequest;
    const { status_type, status_text } = body;

    // Validate status type
    if (!status_type || !VALID_STATUS_TYPES.includes(status_type)) {
      return Response.json(
        {
          success: false,
          error: "Invalid status type",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Validate status text length
    if (status_text && status_text.length > 128) {
      return Response.json(
        {
          success: false,
          error: "Status text must be 128 characters or less",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Create new status update
    const statusId = generateId();
    const now = Date.now();

    await DB.prepare(
      "INSERT INTO status_updates (id, user_id, status_text, status_type, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(statusId, userId, status_text || "", status_type, now)
      .run();

    return Response.json(
      {
        success: true,
        data: {
          id: statusId,
          status_type,
          status_text: status_text || "",
          created_at: now,
        },
      } satisfies ApiResponse<{
        id: string;
        status_type: StatusType;
        status_text: string;
        created_at: number;
      }>,
      { status: 200 }
    );
  } catch (error) {
    console.error("Update status error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
