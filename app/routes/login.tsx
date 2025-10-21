/**
 * Login page - MSN Messenger style
 */

import { useState } from "react";
import type { Route } from "./+types/login";
import { redirect } from "react-router";
import { getUserFromSession } from "~/lib/auth.server";
import "~/styles/msn.css";

export async function loader({ request, context }: Route.LoaderArgs) {
  const { DB, SESSIONS } = context.cloudflare.env;

  // Check if already logged in
  const cookieHeader = request.headers.get("Cookie");
  const cookies = Object.fromEntries(
    cookieHeader?.split("; ").map((c) => c.split("=")) || []
  );
  const sessionToken = cookies.session;

  if (sessionToken) {
    const userId = await getUserFromSession(sessionToken, SESSIONS, DB);
    if (userId) {
      return redirect("/app");
    }
  }

  return {};
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sign in - MSN Messenger" },
    { name: "description", content: "Sign in to MSN Messenger" },
  ];
}

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";

      const body =
        mode === "login"
          ? { email, password }
          : { email, username, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to main app
        window.location.href = "/app";
      } else {
        setError(data.error || "An error occurred");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="msn-window">
      <div className="msn-title-bar">
        <div className="msn-title">
          <div className="msn-logo"></div>
          <span>MSN Messenger</span>
        </div>
        <div className="msn-controls">
          <div className="msn-control-btn">_</div>
          <div className="msn-control-btn">□</div>
        </div>
      </div>

      <div className="msn-content">
        <div className="msn-header">
          <div className="msn-header-logo">M</div>
          <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
          <p>
            {mode === "login"
              ? "Welcome back to MSN Messenger"
              : "Join MSN Messenger today"}
          </p>
        </div>

        {error && <div className="msn-error">{error}</div>}

        <form className="msn-form" onSubmit={handleSubmit}>
          <div className="msn-form-group">
            <label htmlFor="email" className="msn-label">
              E-mail address:
            </label>
            <input
              type="email"
              id="email"
              className="msn-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@hotmail.com"
              required
              autoFocus
            />
          </div>

          {mode === "register" && (
            <div className="msn-form-group">
              <label htmlFor="username" className="msn-label">
                Display name:
              </label>
              <input
                type="text"
                id="username"
                className="msn-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="YourName"
                required
                minLength={3}
                maxLength={100}
              />
            </div>
          )}

          <div className="msn-form-group">
            <label htmlFor="password" className="msn-label">
              Password:
            </label>
            <input
              type="password"
              id="password"
              className="msn-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {mode === "login" && (
            <div className="msn-checkbox-group">
              <input type="checkbox" id="remember" className="msn-checkbox" />
              <label htmlFor="remember" className="msn-checkbox-label">
                Sign me in automatically
              </label>
            </div>
          )}

          <button type="submit" className="msn-button" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        <hr className="msn-divider" />

        <div className="msn-footer">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <a
                className="msn-link"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Sign up
              </a>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <a
                className="msn-link"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Sign in
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
