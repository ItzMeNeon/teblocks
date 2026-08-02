# TeBlocks Server -- Networking & Protocol Guide

This explains how the Go server actually sends and receives data, end to
end, so you can extend it without re-deriving the pattern. It assumes
you're looking at the `tetris-server/` project (packages: `protocol/`,
`game/`, `server/`, `auth/`).

## The big picture

Two completely separate transports are in play, and it's important not to
mix them up:

1. **HTTP (JSON)** -- for auth: register, login, session validation, email
   verification, `/me`. Request/response, one-shot, stateless.
2. **WebSocket (custom binary protocol)** -- for actual gameplay: moving
   pieces, rotating, board state, line clears, garbage, match results.
   Persistent connection, both sides push messages at any time.

The binary protocol is the part most people haven't seen before, so most
of this doc is about that.

## Why binary instead of JSON for gameplay

JSON parsing has real CPU cost per message, and a Tetris-like sends a lot
of small messages fast (movement, rotation, soft drop can all fire many
times per second per player). A JSON message like
`{"type":"rotate","clockwise":true}` is ~35 bytes of mostly punctuation
for what's really 2 bits of information. The binary protocol here uses:

```
Byte 0:      message type (a single byte, 0-255 possible types)
Bytes 1+:    payload, exact layout depends on the type
```

No JSON, no field names sent over the wire at all -- both sides just agree
in advance what byte N means, via the shared enum.

## The message type enum -- the single most important file to keep in sync

Defined in `protocol/protocol.go`:

```go
type MsgType byte

const (
    // Client -> Server
    MsgMove      MsgType = iota // payload: int8 direction (-1 left, 1 right)
    MsgRotate                   // payload: uint8 (0=CCW, 1=CW, 2=180)
    MsgSoftDrop                 // payload: uint8 (0=release, 1=hold)
    MsgHardDrop                 // payload: none
    MsgHold                     // payload: none
    MsgJoinQueue                // payload: uint8 mode
    MsgPing                     // payload: uint32 client timestamp ms

    // Server -> Client
    MsgMatchFound   // payload: uint16 roomId, uint8 playerCount
    MsgBoardState   // payload: uint16 playerId, 200 bytes board
    MsgPieceSpawn   // payload: uint16 playerId, uint8 pieceType, uint8 rotState, int8 x, int8 y
    MsgPieceMove    // payload: uint16 playerId, int8 x, int8 y, uint8 rotState
    MsgLineClear    // payload: uint16 playerId, uint8 lineCount, uint8 attackLines
    MsgGarbageRecv  // payload: uint16 playerId, uint8 lineCount
    MsgPlayerTopOut // payload: uint16 playerId
    MsgMatchEnd     // payload: uint16 winnerId, uint8 reason
    MsgPong         // payload: uint32 echoed client timestamp ms
    MsgError        // payload: uint8 errorCode
)
```

**This enum must be mirrored exactly on the Godot client** (see
`NetClient.gd`'s `MsgType` enum). Since Go's `iota` auto-numbers starting
at 0 in declaration order, **the order here IS the wire value** -- adding,
removing, or reordering a constant shifts every value after it. If you add
a new message type, always add it at the *end* of the appropriate block
(client->server or server->client), never in the middle, or you'll
silently break every existing message type after your insertion point.

## How a message actually gets sent -- server side

Every outbound message is built as a raw `[]byte` by hand, then handed to
a `Player`'s send queue. Example from `server/room.go`:

```go
func (r *Room) broadcastPieceMove(p *Player) {
    msg := make([]byte, 0, 7)
    msg = append(msg, byte(protocol.MsgPieceMove))      // byte 0: type
    msg = append(msg, byte(p.ID), byte(p.ID>>8))          // bytes 1-2: playerId (little-endian uint16)
    msg = append(msg, byte(p.Active.X), byte(p.Active.Y), byte(p.Active.Rot)) // bytes 3-5
    r.broadcastRaw(msg)
}

func (r *Room) broadcastRaw(msg []byte) {
    for _, p := range r.Players {
        p.Queue(msg) // non-blocking push into that player's send channel
    }
}
```

`Player.Queue()` (in `server/player.go`) pushes onto a buffered channel
rather than writing directly to the socket:

```go
func (p *Player) Queue(msg []byte) {
    select {
    case p.Send <- msg:
    default:
        log.Printf("player %d send buffer full, dropping message", p.ID)
    }
}
```

A **separate goroutine per player** (`Player.WritePump`) drains that
channel and does the actual `conn.WriteMessage()`:

```go
func (p *Player) WritePump() {
    for {
        select {
        case msg, ok := <-p.Send:
            if !ok { return }
            p.Conn.WriteMessage(websocket.BinaryMessage, msg)
        case <-p.Done:
            return
        }
    }
}
```

**Why this indirection matters:** gorilla/websocket connections are not
safe for concurrent writes from multiple goroutines. Funneling every
outbound message through one channel -> one dedicated writer goroutine per
connection is what makes it safe to call `Queue()` from anywhere (the room
loop, a ban handler, wherever) without worrying about write races.

If you add a new outbound message type, follow this exact pattern: build
the `[]byte` by hand (type byte first, then payload fields in the order
documented in `protocol.go`), then call `.Queue()` on the relevant
player(s) -- never call `conn.WriteMessage` directly from outside
`WritePump`.

## How a message actually gets received -- server side

`Player.ReadLoop` (in `server/player.go`) blocks on `conn.ReadMessage()`
and dispatches:

```go
func (p *Player) ReadLoop(handle func(p *Player, msgType protocol.MsgType, payload []byte)) {
    defer close(p.Done)
    for {
        _, data, err := p.Conn.ReadMessage()
        if err != nil { return } // connection closed/errored
        if len(data) < 1 { continue }
        handle(p, protocol.MsgType(data[0]), data[1:]) // byte 0 = type, rest = payload
    }
}
```

The actual game logic lives in `Room.handleMessage` (`server/room.go`),
which switches on the message type and reads the payload bytes it expects:

```go
func (r *Room) handleMessage(p *Player, mt protocol.MsgType, payload []byte) {
    switch mt {
    case protocol.MsgMove:
        dx := int8(payload[0])
        if p.Board.TryMove(p.Active, dx, 0) {
            r.broadcastPieceMove(p)
        }
    case protocol.MsgRotate:
        // payload[0] is 0/1/2 for CCW/CW/180
        ...
    }
}
```

**Every handler here is server-authoritative** -- the client sends intent
("I want to rotate"), the server validates against the actual board state
(`game.Board.TryRotate`, which runs full SRS wall-kick logic) and only
broadcasts the result if it's actually legal. The client never gets to
just assert a new position; it always goes through the same validation
path a legitimate move would.

## Connection lifecycle, start to finish

1. **HTTP auth first** -- client calls `POST /login`, gets back an opaque
   session token (UUID stored in the `sessions` Postgres table).
2. **WebSocket connect** -- client connects to
   `wss://host/ws?token=<session_id>`. `server.HandleWS` (in
   `server/matchmaking.go`) validates the token against the DB *before*
   upgrading the connection -- an invalid token gets an HTTP 401, no
   WebSocket handshake happens at all.
3. **Player object created** -- wraps the raw `*websocket.Conn`, an empty
   `game.Board`, a `game.Bag` (piece randomizer, re-seeded once matched),
   and the send/done channels described above.
4. **Registered for kicks** -- added to `server.Registry` (maps
   `userID -> *Player`), so an admin `/ban` can force-close this exact
   connection later via `Registry.Kick`.
5. **Handed to the matchmaker** -- `Matchmaker.Enqueue` currently does
   simple FIFO pairing: first two connected players become opponents.
   Once paired, both players' `Bag` gets re-seeded with the *same* random
   seed, so both sides see an identical piece sequence -- this is
   important for a fair competitive match and easy to accidentally break
   if you touch the seeding logic.
6. **Room starts** -- `Room.Run` spins up `WritePump` and `ReadLoop` as
   goroutines for both players, sends `MsgMatchFound`, and spawns each
   player's first piece.
7. **Gameplay loop** -- client sends `MsgMove`/`MsgRotate`/etc, server
   validates + broadcasts results, repeat until someone tops out or
   disconnects.
8. **Match end** -- `Room.endMatch` broadcasts `MsgMatchEnd`, closes both
   players' `Send` channels (which ends their `WritePump` goroutines).

## What's deliberately not built yet (relevant if you're extending this)

- **No gravity/lock delay** -- pieces only move in response to explicit
  client messages right now. A real implementation needs a `time.Ticker`
  inside `Room.Run` that periodically calls the equivalent of
  `MsgSoftDrop` automatically, plus a lock-delay timer once a piece can't
  fall further.
- **No hold piece** -- `MsgHold` is received (`handleMessage` has the
  case) but does nothing yet.
- **No T-spin/combo/B2B detection** -- `attackForClear()` in `room.go`
  only counts raw line count, flat table, no bonus logic.
- **Matchmaking is FIFO, not rating-based** -- fine for testing the
  pipe, not real Ranked matchmaking.
- **Only 1v1 rooms exist** -- Quick Play (persistent climbing lobby) and
  Battle Royale (100-player elimination) need their own room types with
  different state machines; they're structurally different from the 1v1
  `Room` (no fixed "match end," dynamic player count, altitude/placement
  scoring instead of win/loss). The `game/` package (board, pieces, kicks)
  is already mode-agnostic and reusable for both.

## Client side (Godot) -- mirrors this exactly

`NetClient.gd` (autoload singleton) holds a `WebSocketPeer`, has the same
`MsgType` enum (must match `protocol.go` byte-for-byte), and:

- **Sending**: builds a `StreamPeerBuffer`, writes the type byte + payload
  fields in the same order the server expects, calls `socket.send()`.
- **Receiving**: polls the socket in `_process()`, reads the type byte,
  parses the rest of the payload according to that type, and emits a
  Godot signal (`piece_moved`, `board_state_received`, etc.) that the rest
  of the game listens to.

If you add a new message type, you need to touch **both** sides in the
same PR: the Go enum + handler + any new `Board`/`Room` logic, and the
Godot enum + a case in `_handle_packet()` + (usually) a new signal.

## Quick reference: adding a new message type end to end

1. Add the constant to `protocol.MsgType` in `protocol/protocol.go`, at
   the end of the appropriate block. Document the payload layout in a
   comment, same style as the existing ones.
2. Mirror the same constant, same position, in `NetClient.gd`'s
   `MsgType` enum.
3. **Server -> client message**: write a `broadcastX(...)` helper in
   `server/room.go` following the byte-building pattern above, call it
   from wherever the event happens, and add a case + new signal in
   `NetClient.gd`'s `_handle_packet()`.
4. **Client -> server message**: add a `send_x(...)` function in
   `NetClient.gd`, and a case in `Room.handleMessage` in `server/room.go`
   that validates the request against `game.Board`/`ActivePiece` before
   broadcasting any result.
5. Run `go build ./... && go test ./...` in `tetris-server/` before
   committing -- the `game/` package has real unit tests
   (`game/board_test.go`) worth extending if your change touches board
   logic.
