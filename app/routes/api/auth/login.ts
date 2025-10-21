/**
 * POST /api/auth/login
 * Authenticate a user and create a session
 */

import type { Route } from "./+types/login";
import {
  verifyPassword,
  createSession,
  isValidEmail,
} from "~/lib/auth.server";
import type { ApiResponse, LoginRequest, PublicUser, User } from "~/lib/types";

export async function action({ request, context }: Route.ActionArgs) {
  const { DB, SESSIONS } = context.cloudflare.env;

  try {
    const body = (await request.json()) as LoginRequest;
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return Response.json(
        {
          success: false,
          error: "Email and password are required",
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

    // Find user by email
    const user = await DB.prepare(
      "SELECT id, email, username, password_hash, avatar_url FROM users WHERE email = ?"
    )
      .bind(email)
      .first<User>();

    if (!user) {
      return Response.json(
        {
          success: false,
          error: "Invalid email or password",
        } satisfies ApiResponse,
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return Response.json(
        {
          success: false,
          error: "Invalid email or password",
        } satisfies ApiResponse,
        { status: 401 }
      );
    }

    // Create session
    const sessionToken = await createSession(user.id, DB, SESSIONS);

    // Return user data (without password hash)
    const userData: PublicUser = {
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
    };

    const response = Response.json(
      {
        success: true,
        data: { user: userData },
      } satisfies ApiResponse<{ user: PublicUser }>,
      { status: 200 }
    );

    // Set session cookie
    response.headers.set(
      "Set-Cookie",
      `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}`
    );

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return Response.json(
      {
        success: false,
        error: "Internal server error",
      } satisfies ApiResponse,
      { status: 500 }
    );
  }
}
