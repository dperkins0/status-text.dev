/**
 * Main application page - MSN Messenger contact list interface
 */

import { useState, useEffect } from "react";
import type { Route } from "./+types/app";
import { redirect } from "react-router";
import { getUserFromSession } from "~/lib/auth.server";
import type { FriendWithStatus } from "~/lib/types";
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
  const [friends, setFriends] = useState<FriendWithStatus[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Load friends and requests
  useEffect(() => {
    loadFriends();
    loadRequests();
  }, []);

  const loadFriends = async () => {
    const response = await fetch("/api/friends");
    const data = await response.json();
    if (data.success) {
      setFriends(data.data.friends);
    }
  };

  const loadRequests = async () => {
    const response = await fetch("/api/friends/requests");
    const data = await response.json();
    if (data.success) {
      setPendingRequests(data.data.received);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const response = await fetch(`/api/friends/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    if (data.success) {
      setSearchResults(data.data.users);
    }
  };

  const handleAddFriend = async (friendId: string) => {
    setLoading(true);
    const response = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId }),
    });
    const data = await response.json();
    if (data.success) {
      alert("Friend request sent!");
      setShowAddContact(false);
      setSearchQuery("");
      setSearchResults([]);
    } else {
      alert(data.error);
    }
    setLoading(false);
  };

  const handleAcceptRequest = async (requestId: string) => {
    const response = await fetch("/api/friends/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const data = await response.json();
    if (data.success) {
      loadFriends();
      loadRequests();
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const response = await fetch("/api/friends/remove", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const data = await response.json();
    if (data.success) {
      loadRequests();
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "#7fba00";
      case "away": return "#ffb900";
      case "busy": return "#e81123";
      case "brb": return "#ffb900";
      case "phone": return "#ffb900";
      case "lunch": return "#ffb900";
      default: return "#999";
    }
  };

  // Group friends by status
  const onlineFriends = friends.filter(f => f.status_type === "online");
  const awayFriends = friends.filter(f => ["away", "brb", "phone", "lunch"].includes(f.status_type));
  const offlineFriends = friends.filter(f => ["offline", "appear_offline"].includes(f.status_type));

  return (
    <div className="msn-window" style={{ width: "280px", maxHeight: "600px" }}>
      <div className="msn-title-bar">
        <div className="msn-title">
          <div className="msn-logo"></div>
          <span>MSN Messenger</span>
        </div>
        <div className="msn-controls">
          <div className="msn-control-btn">_</div>
          <div className="msn-control-btn" onClick={handleLogout}>×</div>
        </div>
      </div>

      <div className="msn-content" style={{ padding: "12px" }}>
        {/* User info */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #e5e5e5" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "linear-gradient(135deg, #667eea, #764ba2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "bold", fontSize: "14px" }}>
            {loaderData.user.username[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ fontWeight: "bold", fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {loaderData.user.username}
            </div>
            <div style={{ fontSize: "10px", color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {loaderData.status.status_text || "No status"}
            </div>
          </div>
        </div>

        {/* Pending requests */}
        {pendingRequests.length > 0 && (
          <div style={{ marginBottom: "12px", padding: "8px", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "3px" }}>
            <div style={{ fontWeight: "bold", fontSize: "11px", marginBottom: "6px" }}>
              Friend Requests ({pendingRequests.length})
            </div>
            {pendingRequests.map((req) => (
              <div key={req.request_id} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <span style={{ flex: 1, fontSize: "10px" }}>{req.username}</span>
                <button onClick={() => handleAcceptRequest(req.request_id)} style={{ padding: "2px 6px", fontSize: "9px", background: "#7fba00", color: "#fff", border: "none", borderRadius: "2px", cursor: "pointer" }}>✓</button>
                <button onClick={() => handleRejectRequest(req.request_id)} style={{ padding: "2px 6px", fontSize: "9px", background: "#e81123", color: "#fff", border: "none", borderRadius: "2px", cursor: "pointer" }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Add contact button */}
        <button
          onClick={() => setShowAddContact(!showAddContact)}
          className="msn-button"
          style={{ width: "100%", marginBottom: "12px", fontSize: "10px" }}
        >
          {showAddContact ? "Cancel" : "+ Add Contact"}
        </button>

        {/* Add contact search */}
        {showAddContact && (
          <div style={{ marginBottom: "12px", padding: "8px", background: "#f5f5f5", borderRadius: "3px" }}>
            <input
              type="text"
              className="msn-input"
              placeholder="Search by email or username..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ fontSize: "10px", marginBottom: "8px" }}
            />
            <div style={{ maxHeight: "120px", overflow: "auto" }}>
              {searchResults.map((user) => (
                <div key={user.id} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px", background: "#fff", borderRadius: "2px", marginBottom: "4px" }}>
                  <span style={{ flex: 1, fontSize: "10px" }}>{user.username}</span>
                  <button
                    onClick={() => handleAddFriend(user.id)}
                    disabled={loading}
                    style={{ padding: "2px 8px", fontSize: "9px", background: "#0078d7", color: "#fff", border: "none", borderRadius: "2px", cursor: "pointer" }}
                  >
                    Add
                  </button>
                </div>
              ))}
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <div style={{ fontSize: "10px", color: "#666", textAlign: "center", padding: "8px" }}>
                  No users found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Friends list */}
        <div style={{ maxHeight: "350px", overflow: "auto" }}>
          {onlineFriends.length > 0 && (
            <>
              <div style={{ fontWeight: "bold", fontSize: "10px", color: "#666", marginBottom: "6px", marginTop: "8px" }}>
                Online ({onlineFriends.length})
              </div>
              {onlineFriends.map((friend) => (
                <div key={friend.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px", marginBottom: "2px", cursor: "pointer", borderRadius: "2px" }} className="friend-item">
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: getStatusColor(friend.status_type) }}></div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: "11px", fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {friend.username}
                    </div>
                    {friend.status_text && (
                      <div style={{ fontSize: "9px", color: "#666", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {friend.status_text}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {awayFriends.length > 0 && (
            <>
              <div style={{ fontWeight: "bold", fontSize: "10px", color: "#666", marginBottom: "6px", marginTop: "12px" }}>
                Away ({awayFriends.length})
              </div>
              {awayFriends.map((friend) => (
                <div key={friend.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px", marginBottom: "2px", cursor: "pointer", borderRadius: "2px" }} className="friend-item">
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: getStatusColor(friend.status_type) }}></div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {friend.username}
                    </div>
                    {friend.status_text && (
                      <div style={{ fontSize: "9px", color: "#666", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {friend.status_text}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {offlineFriends.length > 0 && (
            <>
              <div style={{ fontWeight: "bold", fontSize: "10px", color: "#666", marginBottom: "6px", marginTop: "12px" }}>
                Offline ({offlineFriends.length})
              </div>
              {offlineFriends.map((friend) => (
                <div key={friend.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px", marginBottom: "2px", opacity: 0.6 }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: getStatusColor(friend.status_type) }}></div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {friend.username}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {friends.length === 0 && !showAddContact && (
            <div style={{ textAlign: "center", padding: "24px", color: "#999", fontSize: "11px" }}>
              <p>No contacts yet</p>
              <p style={{ marginTop: "8px", fontSize: "10px" }}>
                Click "Add Contact" to find friends
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
