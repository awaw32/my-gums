# Networking — Protocol Reference

## Transport

- **WebSocket** (`ws://host/ws/world`) — real-time multiplayer (position updates, PvP, chat, monsters, BR)
- **WebSocket** (`ws://host/ws/online`) — room-based online core (lobbies, player sync, combat, progression)
- **HTTP REST** (`/api/*`) — persistence, leaderboard, upgrades, equipment

---

## WebSocket Messages

### Client → Server

| Type | Description | Key Fields |
|------|-------------|------------|
| `join` | Join world map | `username`, `x_position`, `y_position`, `army_power`, `hp`, `maxHp`, `kills`, `coinsEarned`, `unitLevel`, `armyAlive`, `weapons[]`, `buildings{}`, `research{}` |
| `update` | Position/stats sync (100ms) | `x_position`, `y_position`, `army_power`, `kills`, `coinsEarned`, `hp`, `maxHp`, `level`, `equippedWeapon` |
| `chat` | Send chat message | `message` (max 200 chars) |
| `monster_killed` | Report monster kill | `id` (monster ID) |
| `pvp_attack` | Initiate PvP | `target` (username), `myPower` |
| `pvp_result` | Report PvP outcome | `target`, `won`, `loot`, `winnerReward`, `myPower` |
| `equip_weapon` | Equip/change weapon | `weaponId` |
| `upgrade_army_yard` | Upgrade army yard | (sent with cost data) |
| `upgrade_weapon_star` | Upgrade weapon star | `weaponId` |
| `upgrade_weapon_gem` | Upgrade weapon gem | `weaponId` |
| `upgrade_building` | Upgrade village building | `buildingId` |
| `upgrade_research` | Upgrade research skill | `categoryId`, `skillId` |
| `br_match_start` | Start BR match | `mapSize`, `matchDuration` |
| `br_zone_shrink` | Shrink BR zone | `radius`, `centerX`, `centerY` |
| `br_bandit_spawn` | Spawn BR bandit | `bandit{}` |
| `br_player_eliminated` | Player eliminated in BR | `playerId`, `by` |
| `br_match_end` | End BR match | `winner`, `kills` |

### Server → Client

| Type | Description | Key Fields |
|------|-------------|------------|
| `world_players` | Full player list (broadcast 100ms) | `list[]` — each with `username`, `x_position`, `y_position`, `army_power`, `hp`, `color`, `equippedWeapon`, ... |
| `world_monsters` | Monster positions | `list[]` — each with `id`, `x`, `y`, `hp`, `maxHp`, `type` |
| `player_joined` | New player entered | `username` |
| `player_despawn` | Player defeated/left | `username` |
| `monster_killed` | Monster defeated | `id`, `killedBy` |
| `pvp_notify` | Incoming PvP attack | `attacker`, `power` |
| `pvp_result` | PvP outcome | `attacker`, `won`, `loot`, `reward`, `myPower` |
| `broadcast_chat` | Chat message (broadcast) | `username`, `message` |
| `equip_weapon_ack` | Weapon equip result | `weaponId` |
| `upgrade_army_yard_ack` | Army yard upgrade result | `ok`, `reason?` |
| `br_match_start` | BR match started | `mapSize`, `matchDuration` |
| `br_zone_shrink` | BR zone shrank | `radius`, `centerX`, `centerY` |
| `br_bandit_spawn` | BR bandit spawned | `bandit{}` |
| `br_player_eliminated` | Player eliminated | `playerId`, `by` |
| `br_match_end` | BR match ended | `winner`, `kills` |

---

## Online Core Protocol (`/ws/online`)

### Client → Server

| Type | Description | Key Fields |
|------|-------------|------------|
| `join` | Join a game room | `playerId`, `roomId`, `loadout` (`weapon`, `runes[]`) |
| `input` | Movement + action input | `seq`, `axes` (`x`, `y`), `actions` (`dash?`, `attack?`, `mount?`), `ts` |
| `attack` | Attack a specific player | `targetId` |
| `leave` | Leave the current room | — |

### Server → Client

| Type | Description | Key Fields |
|------|-------------|------------|
| `state` | Full room state snapshot (20Hz) | `tick`, `players[]` (`id`, `x`, `y`, `dir`, `anim?`) |
| `player_joined` | New player entered room | `id` |
| `player_left` | Player left room | `id` |
| `hit` | Attack resolved | `attackerId`, `targetId`, `damage`, `crit?`, `targetHp` |
| `eliminated` | Player eliminated | `playerId`, `killedBy` |
| `error` | Error message | `code`, `msg` |

---

## HTTP REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health (JSON: `status`, `mongo`, `rooms`, `uptime`) |
| GET | `/version` | Build ID (`buildId`) |
| GET | `/api/players` | All players (query `?all=true` for raw) |
| GET | `/api/players/:username` | Single player data |
| POST | `/api/players/:username` | Save player data |
| GET | `/api/leaderboard?sort=power` | Leaderboard |
| POST | `/api/upgrades/:username` | Process upgrade |
| GET | `/api/rewards/status/:username` | Claimable reward status |
| POST | `/api/rewards/claim/:username` | Claim reward |
| GET | `/api/buildings` | Building definitions |
| GET | `/api/research` | Research definitions |
| GET | `/api/weapons/defs` | Weapon definitions |

---

## Rate & Size Limits

- **WebSocket**: ~20–30 messages/sec per client (throttled by game tick)
- **HTTP Rate Limit**: 120 requests/minute per IP (configurable via `RATE_LIMIT_MAX`)
- **POST body limit**: 1 MB (player save), 64 KB (upgrades)
- **Chat message**: max 200 characters
- **CORS**: configurable via `CORS_ORIGIN` env variable

## Security

- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
- Rate limiting on all HTTP endpoints (in-memory, per-IP sliding window)
- WebSocket connections validated on join; server-authoritative monster/PvP logic
