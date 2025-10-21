# MSN Messenger Clone - Architecture & Implementation Plan

## Project Overview

An MSN Messenger-style application with authentic look and feel, but focused solely on presence and social features:
- User authentication and profiles
- Friend list management (add/remove friends)
- Status text updates
- Real-time presence indicators (online/away/busy/offline)
- Friend status text visibility
- Classic MSN Messenger UI/UX

**No chat/messaging functionality** - purely a social presence platform.

---

## Technology Stack

### Cloudflare Infrastructure

#### 1. **Cloudflare D1** (Primary Database)
- Serverless SQLite database
- Stores: users, friendships, status history
- Perfect for relational data (users ↔ friends relationships)
- ACID compliance for critical operations
- Global replication via Read Replicas

#### 2. **Cloudflare Durable Objects** (Real-time Presence)
- Manages real-time presence state
- Each user has a Durable Object instance when online
- Handles WebSocket connections for live updates
- Coordinates friend list presence broadcasts
- Maintains "last seen" timestamps

#### 3. **Cloudflare Workers** (API & SSR)
- React Router v7 SSR (already configured)
- RESTful API endpoints
- Authentication middleware
- Rate limiting

#### 4. **Cloudflare KV** (Session Storage)
- Session tokens
- Rate limiting counters
- Cached user presence state (reduce D1 reads)

#### 5. **Cloudflare R2** (Optional - Avatar Storage)
- Profile pictures
- Custom emoticons (classic MSN feature)

### Frontend Libraries

#### 1. **React Router v7** (Already integrated)
- File-based routing
- SSR for initial page load
- Client-side navigation

#### 2. **UI Framework - Custom CSS (MSN Messenger Theme)**
- Recreate classic MSN Messenger aesthetic
- Windows XP-era styling
- Custom window chrome, buttons, scrollbars
- Libraries to consider:
  - **98.css** or **XP.css** - For retro Windows UI components
  - Or fully custom CSS to match MSN Messenger exactly

#### 3. **WebSocket Management**
- Native WebSocket API (Cloudflare Workers supports WebSockets)
- Durable Objects for connection handling
- Reconnection logic with exponential backoff

#### 4. **State Management**
- **React Context** + **useReducer** for global state
- Zustand (lightweight alternative) if needed
- State: current user, friends list, presence map, own status

#### 5. **Form Handling & Validation**
- **React Hook Form** - Performant form handling
- **Zod** - Schema validation (TypeScript-first)

#### 6. **Icons & Assets**
- Custom MSN Messenger icons (status indicators, emotions)
- May need to recreate/source original icon assets

### Authentication

#### **Cloudflare Access or Custom Auth**

**Option A: Custom Auth (Recommended)**
- Email/password authentication
- Hashed passwords (bcrypt/scrypt)
- Session tokens stored in KV
- httpOnly cookies for security

**Option B: Cloudflare Access**
- Simpler setup but less "MSN" feel
- May not fit the nostalgic UX

**Recommendation**: Custom auth for authentic MSN login experience

### Testing & Development Tools

- **Vitest** - Unit testing (Vite-native)
- **Playwright** - E2E testing
- **Miniflare** - Local Cloudflare Workers development
- **Wrangler** - Deployment and local dev

---

## Database Schema (Cloudflare D1)

### Tables

#### **users**
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- UUID
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,    -- Display name (e.g., "john_doe@hotmail.com")
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,      -- Unix timestamp
  avatar_url TEXT,                  -- R2 object URL
  INDEX idx_email (email),
  INDEX idx_username (username)
);
```

#### **friendships**
```sql
CREATE TABLE friendships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  status TEXT NOT NULL,             -- 'pending', 'accepted', 'blocked'
  created_at INTEGER NOT NULL,
  accepted_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, friend_id),
  INDEX idx_user_friendships (user_id, status),
  INDEX idx_pending_requests (friend_id, status)
);
```

#### **status_updates**
```sql
CREATE TABLE status_updates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status_text TEXT NOT NULL,        -- The custom status message
  status_type TEXT NOT NULL,        -- 'online', 'away', 'busy', 'brb', 'phone', 'lunch', 'offline'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_status (user_id, created_at DESC)
);
```

#### **sessions**
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,              -- Session token
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_sessions (user_id),
  INDEX idx_expiry (expires_at)
);
```

---

## Real-time Architecture (Durable Objects)

### **UserPresence Durable Object**

Each online user gets a Durable Object instance:

```typescript
// Responsibilities:
class UserPresence extends DurableObject {
  userId: string;
  connections: WebSocket[];        // Multiple browser tabs
  friendsList: Set<string>;        // Friend user IDs
  currentStatus: {
    type: 'online' | 'away' | 'busy' | 'offline';
    text: string;
  };

  // Methods:
  - handleWebSocketConnect()
  - handleWebSocketMessage()
  - broadcastStatusToFriends()
  - receiveFriendStatusUpdate()
  - updatePresence()
}
```

### WebSocket Message Protocol

```typescript
// Client → Server
type ClientMessage =
  | { type: 'authenticate', token: string }
  | { type: 'update_status', status: StatusUpdate }
  | { type: 'ping' };

// Server → Client
type ServerMessage =
  | { type: 'friend_status', userId: string, status: StatusUpdate }
  | { type: 'friend_online', userId: string }
  | { type: 'friend_offline', userId: string }
  | { type: 'pong' };
```

### Presence Flow

1. User logs in → Create session → Open WebSocket
2. Worker routes WebSocket to UserPresence Durable Object
3. Durable Object:
   - Loads friend list from D1
   - Notifies friends' Durable Objects of online status
   - Subscribes to friends' status updates
4. Status change → Broadcast to all connected friends
5. User logs out → Notify friends of offline status

---

## UI/UX Design

### Core UI Components

#### **1. Login Window**
- Classic MSN Messenger login screen
- Email/password fields
- "Sign me in automatically" checkbox
- "Remember me" option
- MSN Messenger logo and branding

#### **2. Main Contact List Window**
- User's display name and status at top
- Status selector dropdown (Online, Away, Busy, BRB, etc.)
- Custom status text input
- Friends list organized by:
  - Online (green)
  - Away (orange)
  - Busy (red)
  - Offline (gray)
- Each friend shows:
  - Avatar (or default icon)
  - Display name
  - Status text (if set)
  - Status icon

#### **3. Add Contact Dialog**
- Search by email/username
- Friend request message
- Modal overlay

#### **4. Window Chrome**
- Windows XP-style window borders
- Minimize/maximize/close buttons
- Classic MSN purple/orange gradient theme
- Menu bar: File, Contacts, Actions, Tools, Help

### Status Types (Classic MSN)
- 🟢 Online / Available
- 🟡 Away
- 🔴 Busy
- 🟡 Be Right Back
- 📞 On the Phone
- 🍽️ Out to Lunch
- ⚫ Appear Offline
- ⚪ Offline (actual offline)

### UI Library Approach

**Option A: Pure Custom CSS**
- Full control over MSN aesthetic
- More work but authentic feel

**Option B: XP.css + Customization**
- Use XP.css as base for Windows XP chrome
- Customize with MSN Messenger colors/styling
- Faster initial development

**Recommendation**: Option B (XP.css base) for faster MVP, refine later

---

## API Design

### REST Endpoints

#### Authentication
```
POST   /api/auth/register          - Create account
POST   /api/auth/login             - Login (returns session token)
POST   /api/auth/logout            - Logout
GET    /api/auth/me                - Get current user
```

#### Friends
```
GET    /api/friends                - Get friends list
POST   /api/friends/request        - Send friend request
PUT    /api/friends/:id/accept     - Accept friend request
DELETE /api/friends/:id            - Remove friend / reject request
GET    /api/friends/requests       - Get pending requests
POST   /api/friends/search         - Search users by email/username
```

#### Status
```
PUT    /api/status                 - Update own status
GET    /api/status/:userId         - Get user's current status
GET    /api/status/:userId/history - Get status history (optional feature)
```

#### User Profile
```
GET    /api/users/:id              - Get user profile
PUT    /api/users/me               - Update own profile
POST   /api/users/me/avatar        - Upload avatar (R2)
```

### WebSocket Endpoint
```
GET    /api/ws                     - WebSocket connection
                                    (upgraded to Durable Object)
```

---

## Implementation Phases

### **Phase 1: Foundation** (Week 1-2)
- [ ] Set up D1 database with schema
- [ ] Implement authentication (register/login/logout)
- [ ] Create session management (KV)
- [ ] Basic user profile CRUD
- [ ] Build login page UI

### **Phase 2: Friends System** (Week 2-3)
- [ ] Friend request/accept/remove logic
- [ ] Friend list API endpoints
- [ ] User search functionality
- [ ] Friend list UI component
- [ ] Add contact dialog

### **Phase 3: Status & Presence** (Week 3-4)
- [ ] Status update API
- [ ] Store status in D1
- [ ] Status selector UI
- [ ] Display friend statuses (polling-based initially)

### **Phase 4: Real-time (Durable Objects)** (Week 4-5)
- [ ] Create UserPresence Durable Object
- [ ] WebSocket connection handling
- [ ] Real-time status broadcasting
- [ ] Online/offline presence detection
- [ ] Replace polling with WebSocket updates

### **Phase 5: UI Polish** (Week 5-6)
- [ ] Implement full MSN Messenger theme
- [ ] Window chrome and controls
- [ ] Status icons and animations
- [ ] Avatar support (R2)
- [ ] Responsive design (desktop-first)

### **Phase 6: Features & Polish** (Week 6-7)
- [ ] "Last seen" timestamps
- [ ] Status history (optional)
- [ ] Bulk friend management
- [ ] Keyboard shortcuts
- [ ] Sound effects (optional - classic MSN sounds)
- [ ] Custom emoticons in status text

### **Phase 7: Testing & Deployment** (Week 7-8)
- [ ] Unit tests (Vitest)
- [ ] E2E tests (Playwright)
- [ ] Performance optimization
- [ ] Security audit
- [ ] Production deployment
- [ ] Monitoring setup

---

## Key Technical Challenges & Solutions

### 1. **Real-time at Scale**
**Challenge**: Broadcasting presence to all friends efficiently
**Solution**:
- Durable Objects maintain active connections
- Only online users have active Durable Objects
- Use Cloudflare's global network for low latency
- Implement connection pooling per user

### 2. **Friendship Graph Queries**
**Challenge**: Efficiently querying mutual friendships
**Solution**:
- Index friendships by user_id and status
- Cache friend lists in Durable Object memory
- Use D1 Read Replicas for read-heavy operations

### 3. **Session Management**
**Challenge**: Secure, scalable session handling
**Solution**:
- JWT tokens stored in httpOnly cookies
- Session metadata in KV with TTL
- Refresh token mechanism for long sessions

### 4. **Offline Detection**
**Challenge**: Detecting when users go offline
**Solution**:
- WebSocket ping/pong heartbeat (30s interval)
- Timeout after missed pings
- "Last seen" timestamp on disconnect
- Graceful degradation for network issues

### 5. **Multiple Device Support**
**Challenge**: Same user logged in on multiple devices
**Solution**:
- Multiple WebSocket connections per Durable Object
- Synchronize status across all user's devices
- Show "active on multiple devices" indicator

---

## Security Considerations

1. **Authentication**
   - bcrypt password hashing (cost factor 10+)
   - Rate limiting on login attempts
   - CSRF tokens for state-changing requests

2. **Authorization**
   - Verify friendship before showing status
   - Can't add yourself as friend
   - Prevent friendship enumeration attacks

3. **Input Validation**
   - Sanitize status text (prevent XSS)
   - Limit status text length (128 chars)
   - Validate email format
   - Username restrictions (alphanumeric + limited special chars)

4. **Rate Limiting**
   - Friend requests: 10/hour per user
   - Status updates: 20/minute per user
   - API calls: 100/minute per user
   - Store counters in KV with TTL

5. **WebSocket Security**
   - Authenticate on connection (token verification)
   - Validate all incoming messages
   - Disconnect on invalid messages
   - Prevent message flooding

---

## Future Enhancements (Post-MVP)

- **Nudge Feature** - Send attention-grabbing notifications to friends
- **Personal Messages** - The text under username (in addition to status)
- **Display Pictures** - Animated avatar support
- **Winks & Emoticons** - Classic MSN animated emoticons
- **Custom Status Shortcuts** - Quick-select favorite statuses
- **Groups** - Organize friends into groups
- **Block List** - Block users from seeing your status
- **Mobile App** - React Native version
- **Sound Themes** - Classic MSN sounds on events
- **Status Scheduler** - Auto-change status based on time/calendar

---

## Development Environment Setup

```bash
# Install dependencies
npm install

# Add Cloudflare bindings to wrangler.jsonc:
# - D1 database binding
# - Durable Object binding
# - KV namespace binding
# - R2 bucket binding (optional)

# Create D1 database
npx wrangler d1 create status-text-db

# Run migrations
npx wrangler d1 execute status-text-db --file=./migrations/0001_init.sql

# Start local development
npm run dev

# Access local D1 (Miniflare)
npx wrangler d1 execute status-text-db --local --command="SELECT * FROM users"
```

---

## Estimated Timeline

- **MVP (Phases 1-4)**: 4-5 weeks
- **Polished Product (Phases 1-7)**: 7-8 weeks
- **Solo developer, part-time**: 10-12 weeks
- **Team of 2-3**: 5-6 weeks

## Success Metrics

- User registration and retention
- Average friends per user
- Status update frequency
- Daily active users
- Real-time message latency (<100ms p95)
- WebSocket connection stability (>99% uptime)

---

## Conclusion

This architecture leverages Cloudflare's edge infrastructure for a globally distributed, real-time presence system. The combination of D1 (relational data), Durable Objects (real-time state), and Workers (API/SSR) provides a scalable foundation that matches MSN Messenger's nostalgic UX with modern serverless technology.

**Next Steps**: Begin Phase 1 by setting up D1 database and implementing authentication system.
