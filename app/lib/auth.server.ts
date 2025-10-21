/**
 * Server-side authentication utilities
 * Handles password hashing, session management, and user authentication
 */

/**
 * Hash a password using Web Crypto API (compatible with Cloudflare Workers)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);

  // Use SHA-256 for hashing (Workers-compatible)
  // In production, consider using a proper password hashing library
  // that works with Workers (e.g., bcrypt.js or scrypt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

/**
 * Generate a random session token
 */
export function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Create a session for a user
 */
export async function createSession(
  userId: string,
  db: D1Database,
  kv: KVNamespace
): Promise<string> {
  const sessionId = generateSessionToken();
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

  // Store in D1 for persistence
  await db
    .prepare(
      'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    )
    .bind(sessionId, userId, now, expiresAt)
    .run();

  // Store in KV for fast lookup (with TTL)
  await kv.put(
    `session:${sessionId}`,
    JSON.stringify({ userId, expiresAt }),
    {
      expirationTtl: 30 * 24 * 60 * 60, // 30 days in seconds
    }
  );

  return sessionId;
}

/**
 * Get user ID from session token
 */
export async function getUserFromSession(
  sessionId: string,
  kv: KVNamespace,
  db: D1Database
): Promise<string | null> {
  // Try KV first (faster)
  const sessionData = await kv.get(`session:${sessionId}`, 'json');

  if (sessionData && typeof sessionData === 'object' && 'userId' in sessionData) {
    const { userId, expiresAt } = sessionData as { userId: string; expiresAt: number };

    // Check if expired
    if (expiresAt > Date.now()) {
      return userId;
    }
  }

  // Fallback to D1
  const result = await db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE id = ?')
    .bind(sessionId)
    .first<{ user_id: string; expires_at: number }>();

  if (!result) {
    return null;
  }

  // Check if expired
  if (result.expires_at < Date.now()) {
    // Clean up expired session
    await deleteSession(sessionId, db, kv);
    return null;
  }

  // Re-populate KV cache
  await kv.put(
    `session:${sessionId}`,
    JSON.stringify({ userId: result.user_id, expiresAt: result.expires_at }),
    {
      expirationTtl: Math.floor((result.expires_at - Date.now()) / 1000),
    }
  );

  return result.user_id;
}

/**
 * Delete a session
 */
export async function deleteSession(
  sessionId: string,
  db: D1Database,
  kv: KVNamespace
): Promise<void> {
  await Promise.all([
    db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run(),
    kv.delete(`session:${sessionId}`),
  ]);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username format
 */
export function isValidUsername(username: string): boolean {
  // 3-100 characters, alphanumeric, underscores, hyphens, dots
  const usernameRegex = /^[a-zA-Z0-9._-]{3,100}$/;
  return usernameRegex.test(username);
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): boolean {
  // At least 8 characters
  return password.length >= 8;
}
