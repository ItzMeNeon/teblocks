# TeBlocks Server -- HTTP API Reference

Base URL: `http://localhost:8080` in dev, your deployed server's origin in
production (currently `https://backend.teblocks.my.id`). Not the same origin
as the Astro site.

All endpoints are JSON in, JSON out, `Content-Type: application/json`.
Error responses are always `{"error": "message"}` with a non-2xx status.

## Authentication

Endpoints marked **authenticated** require the session token from `/login`.
Send it as either:

```text
Authorization: Bearer <session_id>
```

or, for legacy compatibility:

```text
?token=<session_id>
```

Prefer the `Authorization` header for new endpoints. Invalid or expired
tokens return `401` with `{"error": "invalid or expired session"}`.

All timestamps are ISO 8601 UTC strings, e.g. `2026-08-02T10:24:31Z`.
IDs are UUID strings.

## CORS

The server enforces CORS via an allowlist, set with the `CORS_ALLOWED_ORIGINS`
env var (comma-separated). Example:

```
CORS_ALLOWED_ORIGINS=https://teblocks.my.id,http://localhost:4321
```

If unset, it defaults to `http://localhost:4321` only (Astro's local dev
server) -- **you must set this explicitly for the deployed site's origin**
before the production account form will work, or the browser will block
the request with a CORS error even though the server itself is reachable.

This only applies to the JSON endpoints below, not `/ws` (the WebSocket
upgrade has a separate origin check in `server/matchmaking.go`'s
`upgrader.CheckOrigin`, currently wide open for dev -- lock that down
separately before going public).

---

## Auth endpoints

### POST /register

**Request body:**
```json
{
  "username": "ItzNeon",
  "email": "you@example.com",
  "password": "Str0ng!Pass"
}
```

All three fields required. Password must pass strength validation (8+
chars, upper, lower, digit, special char) or you get a 400 back.

**Success -- 200:**
```json
{ "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479" }
```

On success, a 6-digit email verification code is also generated and
emailed automatically (15 min expiry). Registration still returns 200
even if the email fails to send server-side (logged, not fatal) -- don't
treat email delivery as part of this response's success/failure.

**Errors:**

| Status | Body | Meaning |
|---|---|---|
| 400 | `{"error": "malformed request"}` | Invalid JSON |
| 400 | `{"error": "username and email are required"}` | Missing field |
| 400 | `{"error": "<password rule that failed>"}` | e.g. `"password needs at least one uppercase letter"` |
| 409 | `{"error": "username or email already registered"}` | Duplicate |
| 500 | `{"error": "registration failed"}` | Server/DB error |

---

### POST /login

**Request body:**
```json
{ "username": "ItzNeon", "password": "Str0ng!Pass" }
```

**Success -- 200:**
```json
{ "token": "a1b2c3d4-e5f6-...-uuid" }
```

This `token` is the session token. Store it -- you need it for `/me`,
`/session/validate`, `/verify`, and as the `?token=` query param on the
WebSocket connection.

**Errors:**

| Status | Body | Meaning |
|---|---|---|
| 400 | `{"error": "malformed request"}` | Invalid JSON |
| 401 | `{"error": "invalid username or password"}` | Wrong credentials |
| 403 | `{"error": "account is banned"}` | Banned account |
| 500 | `{"error": "login failed"}` | Server/DB error |

---

### GET /me?token=\<session_id\>

Resolves a session token to account info. Use after login to display
"logged in as X", check verification status, etc. Accepts `Authorization:
Bearer <token>` as well.

**Success -- 200:**
```json
{
  "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "username": "ItzNeon",
  "email": "you@example.com",
  "email_verified": true
}
```

**Errors:**

| Status | Body |
|---|---|
| 400 | `{"error": "missing token"}` |
| 401 | `{"error": "invalid or expired session"}` |
| 500 | `{"error": "failed to load account"}` |

---

### GET /session/validate?token=\<session_id\>

Lightweight liveness check -- no JSON body, just the status code. Intended
to be polled periodically so a banned/kicked account's client notices and
disconnects without needing a push mechanism.

**Success:** `200`, empty body
**Invalid/expired:** `401`, empty body
**Missing token:** `400`, empty body

---

### POST /verify

Submit the 6-digit email verification code.

**Request body:**
```json
{ "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "code": "482913" }
```

**Success -- 200:**
```json
{ "status": "verified" }
```

**Errors:**

| Status | Body |
|---|---|
| 400 | `{"error": "malformed request"}` |
| 400 | `{"error": "user_id and code required"}` |
| 400 | `{"error": "code is invalid or expired"}` |

---

### POST /verify/resend

Generates a fresh code (invalidating the previous one) and re-sends it.

**Request body:**
```json
{ "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "email": "you@example.com" }
```

**Success -- 200:**
```json
{ "status": "sent" }
```

**Errors:**

| Status | Body |
|---|---|
| 400 | `{"error": "malformed request"}` |
| 400 | `{"error": "user_id and email required"}` |
| 500 | `{"error": "failed to generate code"}` / `{"error": "failed to send email"}` |

⚠️ Known gap: this endpoint currently trusts whatever `email` is passed in
the body rather than looking up the user's actual stored email by `user_id`.
Before shipping publicly, it should look the email up server-side so this
can't be used to spam arbitrary addresses.

---

### POST /logout

Clears the session. No request body. Returns `200` with
`{"status": "signed_out"}`. The Astro frontend handles this by deleting the
session cookie; no backend state change is required.

---

## Player profile endpoints

All profile endpoints are authenticated unless marked **public**.

---

### GET /profile/me (authenticated)

Returns all profile data for the signed-in user.

**Success -- 200:**
```json
{
  "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "username": "ItzNeon",
  "email": "you@example.com",
  "email_verified": true,
  "bio": "Stacking clean since 2026.",
  "avatar_url": "https://cdn.teblocks.my.id/profile/f47ac10b/avatar.webp",
  "banner_url": "https://cdn.teblocks.my.id/profile/f47ac10b/banner.webp",
  "created_at": "2026-07-11T08:00:00Z",
  "ranked": {
    "rating": 1248,
    "rank": "Silver",
    "rank_division": 2,
    "placement_matches_played": 5,
    "placement_matches_required": 5,
    "is_placed": true
  },
  "stats": {
    "matches_played": 42,
    "wins": 25,
    "losses": 17,
    "win_rate": 59.52,
    "best_win_streak": 6,
    "current_win_streak": 2,
    "lines_cleared": 1812,
    "play_time_seconds": 15270
  }
}
```

For a new player, return zeroes and `null` where a value does not exist:

```json
{
  "bio": null,
  "ranked": {
    "rating": null,
    "rank": "Unranked",
    "rank_division": null,
    "placement_matches_played": 0,
    "placement_matches_required": 5,
    "is_placed": false
  },
  "stats": {
    "matches_played": 0,
    "wins": 0,
    "losses": 0,
    "win_rate": null,
    "best_win_streak": 0,
    "current_win_streak": 0,
    "lines_cleared": 0,
    "play_time_seconds": 0
  }
}
```

Do not calculate `win_rate` with integer division. Return `null` if no
matches have been played; otherwise return `wins / matches_played * 100`
rounded to two decimal places.

**Errors:** `401` if not authenticated, `500` on server error.

---

### PATCH /profile/me (authenticated)

Updates the player's editable profile fields.

**Request:**
```json
{ "bio": "Stacking clean since 2026." }
```

Rules:
- `bio` may be `null` or a trimmed string from 1 to 120 characters.
- Reject HTML. Plain text only.
- Do not accept username, rating, rank, or statistics in this endpoint.

**Success -- 200:**
```json
{ "bio": "Stacking clean since 2026." }
```

**Validation failure -- 400:**
```json
{ "error": "bio must be 120 characters or fewer" }
```

---

### GET /profile/me/matches?limit=20&cursor=\<cursor\> (authenticated)

Returns the signed-in player's recent completed matches, newest first.
Does not include live/in-progress matches.

`limit` is optional, defaults to `20`, capped at `50`. `cursor` is an opaque
server-generated pagination cursor.

**Success -- 200:**
```json
{
  "matches": [
    {
      "match_id": "e052a86d-777e-4cb8-a6fd-cd3e67f246d4",
      "completed_at": "2026-08-02T10:24:31Z",
      "mode": "ranked_1v1",
      "result": "win",
      "placement": 1,
      "opponent": {
        "user_id": "d674879e-7a6f-4cbe-b3a7-f8da6916b741",
        "username": "BlockPilot"
      },
      "rating_before": 1224,
      "rating_after": 1248,
      "rating_change": 24,
      "lines_cleared": 48,
      "duration_seconds": 183
    }
  ],
  "next_cursor": null
}
```

Valid `result` values are `win`, `loss`, `draw`, and `abandoned`. Use `null`
for `rating_before`, `rating_after`, and `rating_change` in unranked modes.
Never expose an opponent email address or session data.

**Errors:** `401` if not authenticated, `500` on server error.

---

### POST /profile/me/avatar (authenticated)

Upload a player's avatar. Uses `multipart/form-data` with exactly one file
field named `file`.

Rules:
- Accept only PNG, JPEG, and WebP after verifying the actual file signature,
  not just the request MIME type.
- Reject files over 5 MB and images with unreasonable pixel dimensions.
- Strip EXIF data and re-encode uploaded images before storage.
- Crop avatars to a square.
- Generate safe, server-owned object names. Never use the provided filename
  as the storage path.
- Replace the previous image only after the new image is stored successfully.
- Serve image assets through a dedicated public media origin with a cacheable,
  immutable URL. Do not return local filesystem paths.

**Success -- 200:**
```json
{ "avatar_url": "https://cdn.teblocks.my.id/profile/f47ac10b/avatar.webp" }
```

**Errors:** `400` for invalid file, `413` for file too large, `401` if not
authenticated, `500` on storage failure.

---

### POST /profile/me/banner (authenticated)

Same as avatar upload, but for the profile banner. Return `banner_url` in the
response. The returned URL must also be reflected in later `GET /profile/me`
responses.

---

## Public profile endpoints

These endpoints do not require authentication.

---

### GET /users/:id

Returns public profile data for any user by their `user_id`.

**Success -- 200:**
```json
{
  "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "username": "ItzNeon",
  "email_verified": true,
  "bio": "Stacking clean since 2026.",
  "avatar_url": "https://cdn.teblocks.my.id/profile/f47ac10b/avatar.webp",
  "banner_url": "https://cdn.teblocks.my.id/profile/f47ac10b/banner.webp",
  "created_at": "2026-07-11T08:00:00Z",
  "ranked": {
    "rating": 1248,
    "rank": "Silver",
    "rank_division": 2,
    "placement_matches_played": 5,
    "placement_matches_required": 5,
    "is_placed": true
  },
  "stats": {
    "matches_played": 42,
    "wins": 25,
    "losses": 17,
    "win_rate": 59.52,
    "best_win_streak": 6,
    "current_win_streak": 2,
    "lines_cleared": 1812,
    "play_time_seconds": 15270
  }
}
```

**Errors:** `404` if user not found, `500` on server error.

---

### GET /users/:id/matches

Returns the specified player's recent completed matches, newest first.
Does not include live/in-progress matches. Supports the same `limit` and
`cursor` query params as `/profile/me/matches`.

**Success -- 200:**
```json
{
  "matches": [
    {
      "match_id": "e052a86d-777e-4cb8-a6fd-cd3e67f246d4",
      "completed_at": "2026-08-02T10:24:31Z",
      "mode": "ranked_1v1",
      "result": "win",
      "placement": 1,
      "opponent": {
        "user_id": "d674879e-7a6f-4cbe-b3a7-f8da6916b741",
        "username": "BlockPilot"
      },
      "rating_before": 1224,
      "rating_after": 1248,
      "rating_change": 24,
      "lines_cleared": 48,
      "duration_seconds": 183
    }
  ],
  "next_cursor": null
}
```

**Errors:** `404` if user not found, `500` on server error.

---

### GET /users?q=\<query\>&limit=\<n\>

Search for players by username. `q` is the search query (required, minimum 2
characters). `limit` is optional, defaults to `10`, capped at `20`.

**Success -- 200:**
```json
{
  "entries": [
    {
      "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "username": "ItzNeon",
      "rank": "Silver",
      "rank_division": 2,
      "rating": 1248,
      "avatar_url": "https://cdn.teblocks.my.id/profile/f47ac10b/avatar.webp"
    }
  ]
}
```

**Errors:**

| Status | Body | Meaning |
|---|---|---|
| 400 | `{"error": "search query is required"}` | Missing `q` param |
| 500 | `{"error": "search failed"}` | Server error |

---

## Leaderboard endpoints

---

### GET /leaderboards?mode=\<mode\>&limit=\<n\>

Returns top players for the given game mode. `mode` is required; supported
values are `ranked_1v1`, `quick_play`, and `battle_royale`. `limit` is
optional, defaults to `20`, capped at `50`.

**Success -- 200:**
```json
{
  "entries": [
    {
      "user_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "username": "ItzNeon",
      "rank": "Silver",
      "rank_division": 2,
      "rating": 1248,
      "matches_played": 42,
      "win_rate": 59.52,
      "avatar_url": "https://cdn.teblocks.my.id/profile/f47ac10b/avatar.webp"
    }
  ]
}
```

**Errors:** `400` for missing/invalid mode, `500` on server error.

---

## WebSocket connection (after login)

```
wss://<server-host>/ws?token=<session_id>
```

Same session token from `/login`. If invalid/expired, the server rejects
the upgrade with `401` before the WebSocket handshake completes. Gameplay
after this point uses the binary protocol, not JSON -- see `NETWORKING.md`
for that.
