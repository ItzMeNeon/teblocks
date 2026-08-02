# TeBlocks Server -- Auth HTTP API Reference

Base URL: `http://localhost:8080` in dev, your deployed server's origin in
production (e.g. `https://api.teblocks.my.id` -- adjust to whatever you
actually deploy the Go server as). Not the same origin as the Astro site.

All endpoints are JSON in, JSON out, `Content-Type: application/json`.
Error responses are always `{"error": "message"}` with a non-2xx status.

## CORS

The server now enforces CORS via an allowlist, set with the
`CORS_ALLOWED_ORIGINS` env var (comma-separated). Example:

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

## POST /register

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

## POST /login

**Request body:**
```json
{ "username": "ItzNeon", "password": "Str0ng!Pass" }
```

**Success -- 200:**
```json
{ "token": "a1b2c3d4-e5f6-...-uuid" }
```
This `token` is the session token. Store it (e.g. in memory / a Godot
autoload) -- you need it for `/me`, `/session/validate`, `/verify`, and as
the `?token=` query param on the WebSocket connection.

**Errors:**
| Status | Body | Meaning |
|---|---|---|
| 400 | `{"error": "malformed request"}` | Invalid JSON |
| 401 | `{"error": "invalid username or password"}` | Wrong credentials |
| 403 | `{"error": "account is banned"}` | Banned account |
| 500 | `{"error": "login failed"}` | Server/DB error |

---

## GET /me?token=\<session_id\>

Resolves a session token to account info. Use after login to display
"logged in as X", check verification status, etc.

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

## GET /session/validate?token=\<session_id\>

Lightweight liveness check -- no JSON body, just the status code. Intended
to be polled periodically (every 5s in the original design) so a banned/
kicked account's client notices and disconnects without needing a push
mechanism.

**Success:** `200`, empty body
**Invalid/expired:** `401`, empty body
**Missing token:** `400`, empty body

---

## POST /verify

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

## POST /verify/resend

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

⚠️ Known gap, not yet fixed server-side: this endpoint currently trusts
whatever `email` is passed in the body rather than looking up the user's
actual stored email by `user_id`. Fine for now; before shipping publicly
it should look the email up server-side instead so this can't be used to
spam arbitrary addresses.

---

## WebSocket connection (after login)

```
wss://<server-host>/ws?token=<session_id>
```

Same session token from `/login`. If invalid/expired, the server rejects
the upgrade with `401` before the WebSocket handshake completes (you'll
see this as a failed connection attempt client-side, not an open-then-
immediately-closed socket). Gameplay after this point uses the binary
protocol, not JSON -- see `NETWORKING.md` for that.
