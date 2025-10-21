/**
 * POST /api/auth/register
 * Register a new user account
 */

import type { Route } from "./+types/register";
import {
  generateId,
  hashPassword,
  createSession,
  isValidEmail,
  isValidUsername,
  isValidPassword,
} from "~/lib/auth.server";
import type { ApiResponse, RegisterRequest, PublicUser } from "~/lib/types";

export async function action({ request, context }: Route.ActionArgs) {
  const { DB, SESSIONS } = context.cloudflare.env;

  try {
    const body = (await request.json()) as RegisterRequest;
    const { email, username, password } = body;

    // Validate input
    if (!email || !username || !password) {
      return Response.json(
        {
          success: false,
          error: "Email, username, and password are required",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return Response.json(
        {
          success: false,
          error: "Invalid email format",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (!isValidUsername(username)) {
      return Response.json(
        {
          success: false,
          error:
            "Username must be 3-100 characters and contain only letters, numbers, dots, underscores, and hyphens",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    if (!isValidPassword(password)) {
      return Response.json(
        {
          success: false,
          error: "Password must be at least 8 characters",
        } satisfies ApiResponse,
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingEmail = await DB.prepare(
      "SELECT id FROM users WHERE email = ?"
    )
      .bind(email)
      .first();

    if (existingEmail) {
      return Response.json(
        {
          success: false,
          error: "Email already registered",
        } satisfies ApiResponse,
        { status: 409 }
      );
    }

    // Check if username already exists
    const existingUsername = await DB.prepare(
      "SELECT id FROM users WHERE username = ?"
    )
      .bind(username)
      .first();

    if (existingUsername) {
      return Response.json(
        {
          success: false,
          error: "Username already taken",
        } satisfies ApiResponse,
        { status: 409 }
      );
    }

    // Create user
    const userId = generateId();
    const passwordHash = await hashPassword(password);
    const now = Date.now();

    await DB.prepare(
      "INSERT INTO users (id, email, username, password_hash, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(userId, email, username, passwordHash, now)
      .run();

    // Create initial status
    const statusId = generateId();
    await DB.prepare(
      "INSERT INTO status_updates (id, user_id, status_text, status_type, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(statusId, userId, "", "offline", now)
      .run();

    // Create session
    const sessionToken = await createSession(userId, DB, SESSIONS);

    // Return user data
    const userData: PublicUser = {
      id: userId,
      username,
      avatar_url: null,
    };

    const response = Response.json(
      {
        success: true,
        data: { user: userData },
      } satisfies ApiResponse<{ user: PublicUser }>,
      { status: 201 }
    );

    // Set session cookie
    response.headers.set(
      "Set-Cookie",
      `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`
    );

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
