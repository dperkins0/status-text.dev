/**
 * Main application page (placeholder)
 * This will become the MSN Messenger contact list interface
 */

import type { Route } from "./+types/app";
import { redirect } from "react-router";
import { getUserFromSession } from "~/lib/auth.server";
import "~/styles/msn.css";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { DB, SESSIONS } = context.cloudflare.env;

  // Check if logged in
  const cookieHeader = request.headers.get("Cookie");
  const cookies = Object.fromEntries(
    cookieHeader?.split("; ").map((c) => c.split("=")) || []
  );
  const sessionToken = cookies.session;

  if (!sessionToken) {
    return redirect("/login");
  }

  const userId = await getUserFromSession(sessionToken, SESSIONS, DB);

  if (!userId) {
    return redirect("/login");
  }

  // Get user data
  const user = await DB.prepare(
    "SELECT id, username, email, avatar_url FROM users WHERE id = ?"
  )
    .bind(userId)
    .first<{ id: string; username: string; email: string; avatar_url: string | null }>();

  if (!user) {
    return redirect("/login");
  }

  // Get current status
  const status = await DB.prepare(
    "SELECT status_type, status_text FROM status_updates WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
  )
    .bind(userId)
    .first<{ status_type: string; status_text: string }>();

  return {
    user,
    status: status || { status_type: "offline", status_text: "" },
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "MSN Messenger" },
    { name: "description", content: "Your contact list" },
  ];
}

export default function App({ loaderData }: Route.ComponentProps) {
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="msn-window" style={{ width: "240px" }}>
      <div className="msn-title-bar">
        <div className="msn-title">
          <div className="msn-logo"></div>
          <span>MSN Messenger</span>
        </div>
        <div className="msn-controls">
          <div className="msn-control-btn">_</div>
          <div className="msn-control-btn">□</div>
          <div className="msn-control-btn" onClick={handleLogout}>
            ×
          </div>
        </div>
      </div>

      <div className="msn-content">
        <div className="msn-header">
          <div className="msn-header-logo">
            {loaderData.user.username[0].toUpperCase()}
          </div>
          <h1>{loaderData.user.username}</h1>
          <p style={{ fontSize: "10px", color: "#999" }}>
            {loaderData.status.status_type}
          </p>
        </div>

        <div style={{ marginTop: "16px", fontSize: "11px", color: "#666" }}>
          <p>Welcome to MSN Messenger!</p>
          <p style={{ marginTop: "8px" }}>
            Main interface coming soon...
          </p>
          <p style={{ marginTop: "8px" }}>
            Status: {loaderData.status.status_type}
          </p>
          {loaderData.status.status_text && (
            <p style={{ marginTop: "4px", fontStyle: "italic" }}>
              "{loaderData.status.status_text}"
            </p>
          )}
        </div>

        <hr className="msn-divider" />

        <button
          onClick={handleLogout}
          className="msn-button msn-button-secondary"
          style={{ width: "100%" }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
