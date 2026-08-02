# TeBlocks Player Profile: Server Requirements

This document is the implementation brief for the game-server provider. It
describes the API needed to make the website's competitive player profile
fully data-backed.

## Scope

The current website can already obtain an authenticated user's identity from
`GET /me`. It does **not** yet receive bio, rank, rating, match totals, or
match history. Implement the endpoints below on the Go server at
`https://backend.teblocks.my.id`.

The Astro website will proxy authenticated calls server-side. Keep the
existing session-token model: the token is never made available to browser
JavaScript.

## Authentication

For endpoints marked **authenticated**, accept the existing session token in
one of these forms:

```text
Authorization: Bearer <session_id>
```

or, for consistency with the existing API:

```text
?token=<session_id>
```

Prefer the `Authorization` header for all new endpoints. Invalid or expired
tokens return `401` with:

```json
{ "error": "invalid or expired session" }
```

All timestamps must be ISO 8601 UTC strings, for example
`2026-08-02T10:24:31Z`. IDs remain UUID strings.

## Required endpoints

### `GET /profile/me` (authenticated)

Returns all profile data required by the signed-in user's profile page.

**Success: `200`**

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

### `PATCH /profile/me` (authenticated)

Updates the player's editable profile fields. Start with the bio only; it
must be safe to expand this schema later.

**Request:**

```json
{ "bio": "Stacking clean since 2026." }
```

Rules:

- `bio` may be `null` or a trimmed string from 1 to 120 characters.
- Reject HTML. The simplest safe policy is plain text only.
- Do not accept username, rating, rank, or statistics in this endpoint.
- The authenticated account is the only account that may be updated.

**Success: `200`**

```json
{ "bio": "Stacking clean since 2026." }
```

**Validation failure: `400`**

```json
{ "error": "bio must be 120 characters or fewer" }
```

### `GET /profile/me/matches?limit=20&cursor=<cursor>` (authenticated)

Returns the signed-in player's recent completed matches, newest first. Do not
include live/in-progress matches in this endpoint.

`limit` is optional, defaults to `20`, and is capped at `50`. `cursor` is an
opaque server-generated pagination cursor, not a client-generated offset.

**Success: `200`**

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

### `POST /profile/me/avatar` and `POST /profile/me/banner` (authenticated)

Upload a player's avatar or profile banner. The request uses
`multipart/form-data` with exactly one file field named `file`.

Rules:

- Accept only PNG, JPEG, and WebP after verifying the actual file signature,
  not just the request MIME type.
- Reject files over 5 MB and images with unreasonable pixel dimensions.
- Strip EXIF data and re-encode uploaded images before storage.
- Crop avatars to a square and banners to a wide 3:1 presentation ratio.
- Generate safe, server-owned object names. Never use the provided filename
  as a storage path.
- Replace the previous image only after the new image is stored successfully.
- Serve image assets through a dedicated public media origin with a cacheable,
  immutable URL. Do not return local filesystem paths.

**Success: `200`**

```json
{ "avatar_url": "https://cdn.teblocks.my.id/profile/f47ac10b/avatar.webp" }
```

For banner uploads, return `banner_url` instead. The response URL must also
be returned by later `GET /profile/me` calls.

## Database model

The exact Go and SQL structure is implementation-specific. The server needs
the following durable concepts:

| Concept | Required fields |
| --- | --- |
| Player profile | `user_id` (unique FK), `bio`, `created_at`, `updated_at` |
| Player media | `user_id` (unique FK), `avatar_url`, `banner_url`, updated timestamps |
| Ranked rating | `user_id` (unique FK), `rating`, `rank`, `rank_division`, placement count |
| Aggregate stats | `user_id` (unique FK), matches/wins/losses/streaks/lines/play time |
| Match record | `match_id`, mode, start/end times, terminal state |
| Match participant | `match_id`, `user_id`, result, placement, lines, rating before/after |

Maintain stats transactionally when a match ends. Update the match record,
both participant records, player rating, and aggregate stats in one database
transaction so retries cannot create a partial profile state.

## Rating and ranks

The website displays the strings returned by the API; rank thresholds are a
server rule. Keep rank calculation in the server, not in the web client.

Suggested initial tiers are `Bronze`, `Silver`, `Gold`, `Platinum`,
`Diamond`, and `Master`, with divisions `1` through `3` where applicable.
Placement requires five completed ranked matches. A disconnect can count as a
loss if that is the game rule, but it must still create a completed match
record so the player's history and statistics agree.

## Security and operational requirements

- Derive the profile owner from the validated session; never trust a body
  `user_id` for the `/me` endpoints.
- Apply a modest rate limit to `PATCH /profile/me`, such as 10 requests per
  minute per account.
- Validate and bound `limit` before using it in a database query.
- Use parameterized database queries exclusively.
- Log match finalization failures with the `match_id` and retry safely.
- Add tests for authorization, an unranked player, a placed player, cursor
  pagination, and idempotent match finalization.

## Integration order

1. Add profile storage and `GET /profile/me`.
2. Persist match outcomes and return aggregate statistics.
3. Add `GET /profile/me/matches` with cursor pagination.
4. Add `PATCH /profile/me` for the bio.
5. Replace the Astro profile placeholders with these returned fields.
