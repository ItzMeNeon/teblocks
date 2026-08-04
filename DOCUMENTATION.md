# TE-Blocks Tetris Server — Full Documentation

## 1. Project Overview

**te-blocks** is a server-authoritative multiplayer Tetris backend written in **Go 1.22**. It serves a Godot client over a binary WebSocket protocol and exposes REST endpoints for authentication, profiles, and matchmaking.

### Key Features
- Server-authoritative game logic (SRS rotation + wall kicks, 7-bag randomizer)
- 1v1 matchmaking (FIFO pairing, extensible to Glicko-2 rated)
- Line clears, garbage/attacks, T-spin detection (3-corner rule)
- B2B/Combo scaling with integer arithmetic
- Hold piece, hard drop, soft drop
- Speed hack detection (client rate limiting)
- Full auth system (register, login, session tokens, email verification via Resend)
- Profile system (bio, avatar, banner uploads with image processing)
- Ranked rating (Elo-lite, K=32, placeholder for Glicko-2)
- Match history with cursor-based pagination
- Admin ban/kick system via stdin console
- IP flagging for multi-account detection
- Media storage (local filesystem, hot-swappable to R2/S3)

### Tech Stack
| Component | Technology |
|-----------|-----------|
| Language | Go 1.22 |
| Database | PostgreSQL (Supabase or self-hosted) |
| WebSocket | gorilla/websocket |
| Image processing | golang.org/x/image |
| Password hashing | bcrypt (golang.org/x/crypto) |
| Email | Resend API |
| UUID | google/uuid |
| Postgres driver | lib/pq |

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Godot Client                         │
│  (sends binary WebSocket frames, HTTP JSON for auth)         │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│                    Go HTTP Server (:8080)                    │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐  │
│  │  REST APIs  │  │   /ws       │  │   Admin Console    │  │
│  │  /register  │  │  (binary)   │  │   (stdin)          │  │
│  │  /login     │  │             │  │   /ban, /kick...   │  │
│  │  /me        │  │             │  │                    │  │
│  │  /profile   │  │             │  │                    │  │
│  │  /verify    │  │             │  │                    │  │
│  └─────┬───────┘  └─────┬───────┘  └────────────────────┘  │
│        │                │                                    │
│  ┌─────▼───────┐  ┌─────▼────────────────────────────────┐  │
│  │   auth/     │  │         server/                       │  │
│  │  handlers   │  │  ┌──────────┐  ┌──────────────────┐  │  │
│  │  DB         │  │  │ Player   │  │  Matchmaker      │  │  │
│  │  media      │  │  │ (state)  │  │  (FIFO pairing)  │  │  │
│  │  profile    │  │  └────┬─────┘  └────────┬─────────┘  │  │
│  │  rank       │  │       │                │             │  │
│  │  ratelimit  │  │  ┌────▼─────┐  ┌──────▼──────────┐  │  │
│  │             │  │  │   Room   │  │  LobbyManager   │  │  │
│  │             │  │  │ (1v1)    │  │  (idle lobby)   │  │  │
│  │             │  │  └────┬─────┘  └─────────────────┘  │  │
│  │             │  │       │                                │  │
│  └─────────────┘  │  ┌────▼────────────────────────────┐  │  │
│                   │  │        game/                     │  │
│                   │  │  Board, Pieces, SRS Kicks,       │  │  │
│                   │  │  7-bag randomizer, T-spin        │  │  │
│                   │  └─────────────────────────────────┘  │  │
│                   └────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
               │
       ┌───────▼────────┐
       │   PostgreSQL   │
       │   (Supabase)   │
       │                │
       │  Tables:       │
       │  users,        │
       │  sessions,     │
       │  profiles,     │
       │  ranked_ratings│
       │  player_stats, │
       │  matches,      │
       │  bans,         │
       │  player_conns  │
       │  flagged_ips,  │
       │  player_media  │
       └────────────────┘
```

---

## 3. Directory Structure

```
tetris-server/
├── main.go                    # Entry point: wires routes, env, admin console
├── cors.go                    # CORS middleware for JSON endpoints
├── env.go                     # .env file loader (joho/godotenv)
├── go.mod / go.sum            # Dependencies
├── protocol/
│   └── protocol.go            # Binary wire format: MsgType enum, board constants
├── game/
│   ├── board.go               # Board state, collision, line clear, garbage, T-spin
│   ├── pieces.go              # SRS shapes, 7-bag randomizer
│   ├── kicks.go               # SRS wall kick tables (JLSTZ + I-piece)
│   └── board_test.go          # Unit tests for board logic
├── server/
│   ├── player.go              # Player state wrapper (board, bag, hold, lock delay)
│   ├── room.go                # 1v1 game loop, gravity, lock delay, hold, attacks
│   ├── matchmaking.go         # WebSocket upgrade, FIFO matchmaker, lobby placement
│   ├── lobby.go               # Lobby tracking (idle + future persistent lobbies)
│   ├── registry.go            # Connected player tracking, admin kick/ban
│   └── room_test.go           # Room integration tests
├── auth/
│   ├── db.go                  # Postgres connection, schema auto-creation
│   ├── auth.go                # Register, login, session validation, ban operations
│   ├── handlers.go            # HTTP handlers for /register, /login, /session/validate
│   ├── email.go               # Resend email verification (code-based)
│   ├── password.go            # Password hashing, validation
│   ├── profile.go             # Profile data layer (get, update bio, matches)
│   ├── profile_handlers.go    # HTTP handlers for profile endpoints
│   ├── rank.go                # Elo-lite rating system (placeholder for Glicko-2)
│   ├── media.go               # Image processing pipeline
│   ├── media_storage.go       # MediaStorage interface
│   ├── media_storage_local.go # Local disk implementation
│   ├── media_db.go            # Media URL/key tracking in DB
│   ├── media_handlers.go      # Avatar/banner upload handlers
│   ├── context.go             # Token extraction, auth guard
│   ├── ratelimit.go           # In-memory rate limiter
│   └── *_test.go              # Tests for auth, rank, profile, media
├── media/                     # Local uploaded media storage (avatars, banners)
├── .env / .env.example        # Environment variables
├── README.md                  # Project overview
├── API.md                     # REST API reference
├── AUTH.md                    # Auth system docs
├── GAME_PROTOCOL.md           # Binary protocol + game mechanics
├── PROFILE_IMPLEMENTATION.md  # Profile system implementation notes
└── DOCUMENTATION.md           # This file — full codebase reference for Claude
```

---

## 4. Protocol Reference

### Binary Wire Format

Every packet is `[msgType byte, ...payload bytes]`. No JSON, no delimiters.

### Client → Server

| Byte | Name | Payload | Description |
|------|------|---------|-------------|
| `0x00` | `MsgMove` | `int8 dx` | Move piece left (-1) or right (+1) |
| `0x01` | `MsgRotate` | `uint8 rot` | 0=CCW, 1=CW, 2=180° |
| `0x02` | `MsgSoftDrop` | `uint8 hold` | 1 = holding soft drop |
| `0x03` | `MsgHardDrop` | *(none)* | Instant drop to floor |
| `0x04` | `MsgHold` | *(none)* | Swap active piece with held piece |
| `0x05` | `MsgJoinQueue` | `uint8 mode` | 0=ranked, 1=quickplay, 2=royale100 |
| `0x06` | `MsgPing` | `uint32 timestamp_ms` | Keepalive ping |
| `0x07` | `MsgDisconnect` | `uint8 reason` | Graceful disconnect |

### Server → Client

| Byte | Name | Payload | Description |
|------|------|---------|-------------|
| `0x07` | `MsgMatchFound` | `uint16 roomId`, `uint8 playerCount` | Match start |
| `0x08` | `MsgBoardState` | `uint16 playerId`, `200 bytes` | Full board (10×20, 1 byte/cell) |
| `0x09` | `MsgPieceSpawn` | `uint16 playerId`, `uint8 pieceType`, `uint8 rotState`, `int8 x`, `int8 y` | New piece |
| `0x0A` | `MsgPieceMove` | `uint16 playerId`, `int8 x`, `int8 y`, `uint8 rotState` | Piece update |
| `0x0B` | `MsgLineClear` | `uint16 playerId`, `uint8 lineCount`, `uint8 attackLines` | Lines cleared + attack |
| `0x0C` | `MsgGarbageRecv` | `uint16 playerId`, `uint8 lineCount` | Garbage received |
| `0x0D` | `MsgPlayerTopOut` | `uint16 playerId` | Player topped out |
| `0x0E` | `MsgMatchEnd` | `uint16 winnerId`, `uint8 reason` | Match result |
| `0x0F` | `MsgPong` | `uint32 echoedTimestamp` | Ping response |
| `0x10` | `MsgError` | `uint8 errorCode` | Server error |

### Disconnect Reason Codes

| Value | Name | Description |
|-------|------|-------------|
| `0` | Unknown | Default/unspecified |
| `1` | ClientQuit | Player left voluntarily |
| `2` | ClientCrash | Client crashed or killed |
| `3` | ClientTimeout | No keepalive response |
| `4` | ServerKick | Ban, speed hack, etc. |

### Cell Values

| Value | Meaning |
|-------|---------|
| `0` | Empty |
| `1-7` | Locked piece color ID |
| `8` | Garbage |

### Board Dimensions

- Width: 10 columns (0–9)
- Visible rows: 20 (rows 4–23)
- Buffer rows: 4 (rows 0–3, above visible field for spawning/SRS kicks)
- Total rows: 24 (0–23)
- Y increases downward (row 0 = top)

---

## 5. Game Mechanics

### Gravity & Lock Delay

**Gravity**: A `time.Ticker` fires every **500ms**. On each tick, every active piece attempts to move down one row (`Board.TryMove(piece, 0, 1)`). If the move succeeds, the new position is broadcast via `MsgPieceMove`. If it fails, the piece is **grounded**.

**Lock Delay**: When a grounded piece cannot move down, a **500ms lock delay timer** starts. If the player moves or rotates the piece while grounded, the timer resets (up to **15 resets**). When the timer expires, the piece locks.

**Hard drop** bypasses lock delay entirely — the piece locks immediately.

### Piece System

**SRS Shapes**: All 7 tetrominoes follow the Super Rotation System (SRS) with 4 rotation states each. Shapes are defined as cell offsets within a 4×4 bounding box in `game/pieces.go`.

**7-Bag Randomizer**: Each bag contains exactly one of each piece type, shuffled randomly. When the bag empties, a new shuffled bag is generated. Both players in a match receive the **same seed**, ensuring identical piece sequences (standard for competitive Tetris).

**Piece Types**:
| PieceType | Value |
|-----------|-------|
| PieceI | 0 |
| PieceO | 1 |
| PieceT | 2 |
| PieceS | 3 |
| PieceZ | 4 |
| PieceJ | 5 |
| PieceL | 6 |

**Rotation States**: RotSpawn(0) → RotR(1) → Rot2(2) → RotL(3) → cycle

### SRS Wall Kicks

When a rotation would collide, the server tries each kick offset in order and applies the first valid one. Two kick tables:
- **JLSTZ** (J, L, S, T, Z): 5 offsets per transition
- **I-piece**: 5 larger offsets per transition (different from JLSTZ)

O-piece has no kicks (returns `(0,0)`).

### Hold Piece

- Each player has a `Held *PieceType` slot (nil if empty) and a `canHold` flag.
- On `MsgHold`: `canHold` is set to `false` (once-per-piece rule), active piece swaps with held slot.
- `canHold` resets to `true` when a new piece spawns after a lock.
- Holding a piece that collides on spawn = immediate top-out.

### T-Spin Detection (3-Corner Rule)

When a piece locks:
1. Must be a **T-piece**
2. Last action must have been a **rotation**
3. Count occupied corners of the 4×4 bounding box (walls/out-of-bounds count as occupied)
4. If **3 or more corners** are occupied → it's a T-spin

### Attack Calculation

```
base = 0
switch lines_cleared:
    1 → 0
    2 → 1
    3 → 2
    4 → 4 (Tetris)

if isTSpin:
    switch lines_cleared:
        1 → 1 (T-spin single)
        2 → 2 (T-spin double)
        3 → 4 (T-spin triple)
        4 → 6 (T-spin tetris)

if isB2B and base > 0:
    base = floor(base * 1.5)

if combo > 0:
    base += combo

attack = base
```

- **Combo**: Increments on consecutive pieces that clear ≥1 line. Resets to -1 when a piece clears 0 lines. Each combo level adds +1 garbage.
- **B2B**: Set when a T-spin clear follows another T-spin clear. Applies 1.5× multiplier. Resets on non-T-spin clears.

### Garbage System

- Garbage rows are inserted at the bottom of the board.
- Each garbage row has **one random gap column** (the rest are filled).
- Rows shifted above the top are lost (may cause top-out).
- Garbage is sent via `MsgGarbageRecv` to the receiving player.

---

## 6. REST API Reference

**Base URL**: `http://localhost:8080` (or your deployed domain)

### Authentication

Most endpoints accept the session token in either:
1. `Authorization: Bearer <token>` header (preferred)
2. `?token=<token>` query parameter (legacy)

Tokens expire **30 days** after creation.

### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/register` | Create account | None |
| `POST` | `/login` | Login, get token | None |
| `GET` | `/session/validate` | Check token validity | Token |
| `GET` | `/me` | Get current user info | Token |
| `GET` | `/profile/me` | Get full profile + stats + rank | Bearer |
| `PATCH` | `/profile/me` | Update bio (max 120 chars) | Bearer |
| `GET` | `/profile/me/matches` | Match history with cursor pagination | Bearer |
| `POST` | `/profile/me/avatar` | Upload avatar (multipart, `file` field) | Bearer |
| `POST` | `/profile/me/banner` | Upload banner (multipart, `file` field) | Bearer |
| `POST` | `/verify` | Submit email verification code | None |
| `POST` | `/verify/resend` | Resend verification email | None |
| `GET` | `/media/<object-name>` | Serve uploaded media | None |

See `API.md` for full request/response schemas and error codes.

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `PATCH /profile/me` | 10 requests/min | Per user |
| `POST /profile/me/avatar` | 5 requests/min | Per user |
| `POST /profile/me/banner` | 5 requests/min | Per user |

Rate limiting is **in-memory** and does not persist across restarts.

---

## 7. WebSocket Connection Flow

```
1. Client authenticates via HTTP (POST /login)
   → Server returns session token

2. Client opens WebSocket: ws://host:8080/ws?token=<session_id>

3. Server validates token, checks ban status, checks IP flags
   → Assigns playerID (uint16)
   → Creates Player wrapper
   → Adds to Registry + IdleLobby
   → Starts ReadLoop

4. Client sends MsgJoinQueue (mode byte)
   → Server removes from idle lobby
   → Enqueues to Matchmaker

5. Matchmaker pairs with opponent
   → Creates Room with shared random seed
   → Both players receive MsgMatchFound
   → Game starts

6. During match:
   → Clients send input (move, rotate, drop, hold)
   → Server validates, applies, broadcasts state updates
   → Gravity ticks every 500ms

7. Match ends (top-out or disconnect)
   → Server sends MsgMatchEnd to both players
   → Results persisted asynchronously to DB
   → Players return to idle lobby
```

---

## 8. Database Schema

All tables are auto-created by `auth/db.go`'s `EnsureSchema()` on server boot. For production, replace with proper migrations (e.g. golang-migrate).

### Core Tables

**`users`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | gen_random_uuid() |
| `username` | TEXT UNIQUE | Not null |
| `email` | TEXT UNIQUE | Not null |
| `password_hash` | TEXT | bcrypt |
| `is_banned` | BOOLEAN | Default FALSE |
| `created_at` | TIMESTAMPTZ | Default now() |

**`sessions`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | gen_random_uuid() |
| `user_id` | UUID FK | References users(id) ON DELETE CASCADE |
| `created_at` | TIMESTAMPTZ | Default now() |
| `expires_at` | TIMESTAMPTZ | Default now() + 30 days |

**`profiles`**
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID PK FK | References users(id) ON DELETE CASCADE |
| `bio` | TEXT | Max 120 chars |
| `created_at` | TIMESTAMPTZ | Default now() |
| `updated_at` | TIMESTAMPTZ | Default now() |

**`ranked_ratings`**
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID PK FK | References users(id) ON DELETE CASCADE |
| `rating` | INTEGER | Default null |
| `rank` | TEXT | Default 'Unranked' |
| `rank_division` | INTEGER | Default null |
| `placement_matches_played` | INTEGER | Default 0 |
| `is_placed` | BOOLEAN | Default FALSE |
| `updated_at` | TIMESTAMPTZ | Default now() |

**`player_stats`**
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID PK FK | References users(id) ON DELETE CASCADE |
| `matches_played` | INTEGER | Default 0 |
| `wins` | INTEGER | Default 0 |
| `losses` | INTEGER | Default 0 |
| `best_win_streak` | INTEGER | Default 0 |
| `current_win_streak` | INTEGER | Default 0 |
| `lines_cleared` | INTEGER | Default 0 |
| `play_time_seconds` | INTEGER | Default 0 |
| `updated_at` | TIMESTAMPTZ | Default now() |

**`matches`**
| Column | Type | Notes |
|--------|------|-------|
| `match_id` | UUID PK | |
| `mode` | TEXT | e.g. 'ranked_1v1' |
| `started_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | Default now() |
| `duration_seconds` | INTEGER | Default 0 |

**`match_participants`**
| Column | Type | Notes |
|--------|------|-------|
| `match_id` | UUID FK | References matches(match_id) ON DELETE CASCADE |
| `user_id` | UUID FK | References users(id) ON DELETE CASCADE |
| `result` | TEXT | 'win', 'loss', 'draw', 'abandoned' |
| `placement` | INTEGER | For Battle Royale |
| `lines_cleared` | INTEGER | Default 0 |
| `rating_before` | INTEGER | |
| `rating_after` | INTEGER | |
| `rating_change` | INTEGER | |
| PK | (match_id, user_id) | Composite primary key |

**`player_media`**
| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID PK FK | References users(id) ON DELETE CASCADE |
| `avatar_url` | TEXT | Public URL |
| `avatar_key` | TEXT | Internal storage key |
| `banner_url` | TEXT | Public URL |
| `banner_key` | TEXT | Internal storage key |
| `updated_at` | TIMESTAMPTZ | Default now() |

**`bans`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | gen_random_uuid() |
| `user_id` | UUID FK | References users(id) ON DELETE CASCADE |
| `reason` | TEXT | Default 'cheating' |
| `banned_by` | TEXT | Default 'system' |
| `created_at` | TIMESTAMPTZ | Default now() |
| `lifted` | BOOLEAN | Default FALSE |
| `lifted_at` | TIMESTAMPTZ | |
| `lifted_by` | TEXT | |

**`player_connections`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | gen_random_uuid() |
| `user_id` | UUID FK | References users(id) ON DELETE CASCADE |
| `ip` | INET | |
| `user_agent` | TEXT | |
| `connected_at` | TIMESTAMPTZ | Default now() |
| `disconnected_at` | TIMESTAMPTZ | |

**`flagged_ips`**
| Column | Type | Notes |
|--------|------|-------|
| `ip` | INET PK | |
| `reason` | TEXT | |
| `flagged_by` | TEXT | Default 'system' |
| `created_at` | TIMESTAMPTZ | Default now() |
| `lifted` | BOOLEAN | Default FALSE |
| `lifted_at` | TIMESTAMPTZ | |
| `lifted_by` | TEXT | |

### Indexes

- `idx_sessions_user_id` ON sessions(user_id)
- `idx_email_verifications_user_id` ON email_verifications(user_id)
- `idx_match_participants_user_completed` ON match_participants(user_id, match_id)
- `idx_matches_completed_at` ON matches(completed_at DESC)
- `idx_player_connections_user_id` ON player_connections(user_id)
- `idx_player_connections_ip` ON player_connections(ip)
- `idx_player_connections_connected_at` ON player_connections(connected_at DESC)

---

## 9. Key Implementation Details

### Rate Limiting
- In-memory fixed-window limiter (`auth/ratelimit.go`)
- Per-user keyed by session token
- **Caveat**: In-memory only — does not coordinate across multiple server instances. Use Redis if scaling horizontally.

### Media Storage
- Currently uses local filesystem (`auth/media_storage_local.go`)
- Object names are random and unique per upload (`auth/media.go:GenerateObjectName`)
- Swappable to R2/S3 by replacing the `MediaStorage` implementation
- Immutable cache headers (`Cache-Control: public, max-age=31536000, immutable`)
- EXIF stripping is implicit (decode to `image.Image` never carries metadata)

### Image Processing Pipeline
1. **Magic bytes sniffing**: Accepts PNG, JPEG, WebP regardless of claimed Content-Type
2. **Size check**: Raw bytes checked before decode (cheap oversized rejection)
3. **Dimension bounds**: 16px–8000px after decode
4. **Aspect crop**: Center-crops to 1:1 (avatar) or 3:1 (banner)
5. **Resize**: CatmullRom resampling (512×512 avatars, 1500×500 banners)
6. **Output**: Always PNG (no WebP encoder dependency)
7. **Replace ordering**: New file stored → DB updated → old file deleted (best-effort)

### Speed Hack Detection
- Minimum interval between client moves: **50ms**
- After **10 violations** in a row, the player is disconnected (`DisconnectReasonServerKick`)
- Resets on clean intervals

### Match Finalization
- Fire-and-forget goroutine after match end
- Checks `match_id` existence first for idempotency (safe to retry)
- Updates match + both participants + ratings + aggregate stats atomically
- Only `ranked_1v1` mode currently calls `FinalizeMatch` (Quick Play and Battle Royale need room implementations)

### Admin Console (stdin)
Commands available on the running server process:
- `/ban <username> [reason]` — Ban user, kick if connected
- `/unban <username>` — Lift ban
- `/kick <username>` — Disconnect without banning
- `/flag-ip <ip> <reason>` — Flag IP as suspicious
- `/unflag-ip <ip>` — Lift IP flag
- `/suspicious-ips` — List flagged IPs
- `/list-players` — List connected players

**Caveat**: Only as safe as shell access. For remote admin, build an authenticated HTTP endpoint.

---

## 10. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Postgres connection string (Supabase or self-hosted) |
| `RESEND_API_KEY` | No | — | Resend API key for email verification |
| `EMAIL_FROM` | No | `onboarding@resend.dev` | Sender address |
| `APP_BASE_URL` | No | `http://localhost:8080` | Base URL for app links |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:4321` | Comma-separated allowed origins |
| `MEDIA_STORAGE_DIR` | No | `./media` | Local media storage path |
| `MEDIA_PUBLIC_BASE_URL` | No | `http://localhost:8080/media` | Public media base URL (must be set in production) |

---

## 11. Game Loop (Room)

The `Room` type (`server/room.go`) manages a single 1v1 match:

1. **On start**: Both players receive `MsgMatchFound`, then `spawnNextPiece` is called for each.
2. **Gravity tick** (every 500ms): Each active piece tries to move down. If grounded, lock delay begins.
3. **Client input**: `MsgMove`, `MsgRotate`, `MsgSoftDrop`, `MsgHardDrop`, `MsgHold` are handled in `handleMessage`.
4. **Lock**: When lock delay expires, `lockAndAdvance` is called:
   - Piece locks to board
   - Lines are cleared
   - Attack is calculated (T-spin, B2B, combo)
   - Garbage sent to opponent
   - Next piece spawns
5. **Top-out**: If a piece spawns in collision, `topOut` is called and the opponent wins.
6. **Disconnect**: Either player disconnecting ends the match, opponent wins.
7. **Match end**: `MsgMatchEnd` is broadcast, results persisted asynchronously.

### Speed Hack Detection
- Applied after every successful move/rotate/hard drop
- Resets on clean interval
- Triggers immediate disconnect after 10 violations

---

## 12. Known Limitations & TODOs

| Area | Status | Notes |
|------|--------|-------|
| Rating system | **Elo-lite** | Placeholder for Glicko-2. `RankForRating()` signature is stable. |
| Matchmaking | **FIFO** | No rating-range matching yet. Pairing is order-based. |
| Royale-100 mode | **Not implemented** | Needs its own Room type with dynamic lobby, altitude scoring, N-way garbage targeting. |
| Quick Play climb | **Not implemented** | Needs Room implementation. |
| Draws | **No logic** | `FinalizeMatch` accepts `"draw"` but no game logic produces it. |
| Disconnect result | **All "loss"** | Disconnects are recorded as `"loss"`, not `"abandoned"`. |
| Rate limiting | **In-memory** | Does not coordinate across instances. Use Redis for horizontal scaling. |
| Migrations | **Auto-schema** | `EnsureSchema()` runs on every boot. Replace with golang-migrate for production. |
| /verify/resend trust | **Trusts client email** | Should look up stored email by user_id. |
| Waiting-player kick | **Edge case** | Players waiting in queue don't get properly deregistered until matched. |
| Session cleanup | **No purging** | Expired rows aren't deleted, just excluded. Add periodic cleanup job. |
| /verify enforcement | **Not gated** | `email_verified` is tracked but not enforced (login/matchmaking not blocked). |
| Media storage | **Local disk** | Working stand-in for R2/S3. Swap `NewLocalFSStorage` to `NewR2Storage` when ready. |
| Open CORS on WS | **Wide open** | `CheckOrigin` returns true for all. Lock down in production. |
| Gravity | **500ms tick** | Fixed interval, no level-based speed curves yet. |

---

## 13. Testing

### Unit Tests (no DB required)
- `game/board_test.go` — Board logic (collision, line clear, garbage, T-spin)
- `auth/rank_test.go` — Rating tier boundaries, Elo symmetry
- `auth/profile_test.go` — Cursor pagination, bio validation
- `auth/media_test.go` — Image processing pipeline (real PNG/JPEG generation)
- `auth/media_storage_test.go` — LocalFSStorage round-trips
- `server/room_test.go` — Room integration tests

### Integration Tests (requires live Postgres)
- Auth flows (register, login, session validation)
- Profile CRUD with real DB rows
- Match finalization (idempotency, rating updates)
- Cursor pagination against real data

**Recommendation**: Spin up a throwaway Postgres (Docker `postgres:16`) for CI integration tests, or test manually against your dev Supabase instance.

---

## 14. Deployment Notes

### Required env vars for production
```bash
DATABASE_URL="postgresql://user:pass@your-supabase-host:5432/postgres"
MEDIA_PUBLIC_BASE_URL="https://backend.yourdomain.com/media"
CORS_ALLOWED_ORIGINS="https://yourgame.com,https://www.yourgame.com"
```

### WebSocket origin check
Lock down the WebSocket upgrader's `CheckOrigin` in `server/matchmaking.go:22` before going public. Currently returns `true` for all origins.

### Media storage migration
When ready to move from local disk to R2/S3:
1. Implement `MediaStorage` interface (`Save`, `Delete`)
2. Change `auth.NewLocalFSStorage(...)` in `main.go` to your new implementation
3. Nothing in handlers or DB layer needs to change

### Session cleanup
Add a periodic job:
```sql
DELETE FROM sessions WHERE expires_at < now();
```

---

## 15. Client Integration Guide

### Step 1: Authenticate
```http
POST /register
Content-Type: application/json

{
  "username": "player1",
  "email": "player@example.com",
  "password": "SecurePass123"
}

→ 200 OK: { "user_id": "uuid" }
```

```http
POST /login
Content-Type: application/json

{
  "username": "player1",
  "password": "SecurePass123"
}

→ 200 OK: { "token": "session-uuid" }
```

### Step 2: Connect WebSocket
```
ws://host:8080/ws?token=<session_uuid>
```

### Step 3: Enter Matchmaking
```
[0x05, 0x00]  // MsgJoinQueue, mode=ranked
```

### Step 4: Receive Match Found
```
[0x07, roomId_lo, roomId_hi, playerCount]
```

### Step 5: Game Loop
- Listen for `MsgPieceSpawn`, `MsgPieceMove`, `MsgBoardState`, `MsgLineClear`, `MsgGarbageRecv`
- Send `MsgMove`, `MsgRotate`, `MsgSoftDrop`, `MsgHardDrop`, `MsgHold` on input

### Step 6: Disconnect Gracefully
```
[0x07, 0x01]  // MsgDisconnect, reason=ClientQuit
→ close WebSocket
```

---

## 16. Important Gotchas

1. **Protocol sync**: The `protocol/protocol.go` MsgType enum must stay in sync with the Godot client's enum by hand. A mismatch is a silent bug — no automatic enforcement.
2. **Board rows**: Y increases downward. Row 0 is the top. Rows 0-3 are buffer rows (invisible), rows 4-23 are the visible playfield.
3. **Piece positions**: `ActivePiece.X/Y` is the top-left of the 4×4 bounding box, not the piece's visual top-left.
4. **Media URL**: `MEDIA_PUBLIC_BASE_URL` must be set correctly in production or avatar/banner URLs will be wrong.
5. **Rate limiting is in-memory**: Does not work across multiple server instances.
6. **Match finalization is async**: A slow DB write won't block the match-end message, but failures are only logged.
7. **Token extraction**: `Authorization: Bearer` header takes priority over `?token=` query param.
8. **Board serialization**: `Board.Serialize()` returns `Width * Height = 240` bytes (10 columns × 24 rows), sent as `MsgBoardState`.
9. **Piece color IDs**: `colorID = byte(ap.Type) + 1` when locking. 0 is reserved for empty, 8 is garbage.
10. **Speed hack threshold**: 10 violations at < 50ms intervals = disconnect. Resets on clean intervals.

---

## 17. Suggested Improvements for Claude

When handing this to Claude, here are the high-priority areas:

1. **Implement Glicko-2 rating system** — Replace the Elo-lite placeholder in `auth/rank.go` with proper Glicko-2. The `RankForRating(int) -> (string, int)` signature is stable.
2. **Rating-based matchmaking** — Replace FIFO `Matchmaker.Enqueue` with rating-range pairing. Add rating lookups to `Matchmaker`.
3. **Battle Royale Room** — Implement a `RoyaleRoom` with dynamic lobby size, altitude scoring, rejoin-on-topout, N-way garbage targeting.
4. **Quick Play Room** — Implement unranked 1v1 with `isRanked=false`, passing `null` for rating fields in `FinalizeMatch`.
5. **Draw logic** — Add a draw condition (e.g., both top-out simultaneously, or timeout).
6. **Disconnect result distinction** — Distinguish `"abandoned"` vs `"loss"` in `FinalizeMatch` calls.
7. **Redis rate limiter** — Replace in-memory `ratelimit.go` with Redis for horizontal scaling.
8. **Periodic session cleanup** — Add a ticker that runs `DELETE FROM sessions WHERE expires_at < now()`.
9. **Enforce email verification** — Block login or matchmaking for unverified accounts.
10. **Fix /verify/resend trust gap** — Look up stored email by `user_id` instead of trusting the request body.
11. **Lock down WebSocket CORS** — Replace `CheckOrigin: func(r *http.Request) bool { return true }` with proper origin validation.
12. **Golag-migrate migrations** — Replace `EnsureSchema()` with proper versioned migrations.
13. **Level-based gravity** — Add speed curves that increase with lines cleared / level.
14. **Next queue preview** — Extend `Bag.Peek(n)` to send next pieces to client for preview.
15. **Ghost piece** — Server-side ghost piece calculation and broadcast.
16. **Replay system** — Record all inputs during a match for replay verification.
17. **Anti-cheat** — Validate move sequences server-side, detect impossible states.

---

## 18. Code Conventions

- **No comments unless necessary** — The codebase prefers self-documenting names.
- **Error handling** — Errors are wrapped with context (`fmt.Errorf("...: %w", err)`)
- **Concurrency** — `sync.Mutex` guards shared state. Room holds a lock during message handling.
- **Gorilla WebSocket** — All writes happen on a single `WritePump` goroutine per connection.
- **Binary protocol** — Little-endian for multi-byte integers (`binary.LittleEndian`).
- **UUIDs** — `google/uuid` for all IDs.
- **Database** — `database/sql` with `lib/pq` driver. No ORM.
- **Testing** — `go test ./...` runs all tests. Integration tests require `DATABASE_URL`.
