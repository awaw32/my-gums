# 🏜️ Desert Kingdom - إمبراطورية الصحراء

Multiplayer desert-themed RTS game with WebSocket real-time combat, economy, village building, PvP, and Battle Royale.

## Requirements

- **Node.js** >= 18.17 < 23 (LTS recommended)
- **npm** (included with Node)
- **MongoDB** (optional — runs with in-memory fallback)

## Quick Start

```bash
# Copy environment file
cp .env.example .env

# Install dependencies
npm ci

# Start development server
npm run dev
```

Open `http://localhost:3000` in your browser.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Production start |
| `npm run dev` | Development mode |
| `npm run lint` | Run ESLint on all files |
| `npm test` | Run Vitest test suite |
| `npm run audit` | Security audit (high severity) |
| `npm run build` | Build placeholder (static front-end) |

## Health Check

```bash
curl http://localhost:3000/health
# {"status":"ok","mongo":"connected|unavailable","rooms":0,"players":0,"uptime":...,"tickRate":20}
```

## Docker

```bash
# Build
docker build -t my-gums .

# Run
docker run -p 3000:3000 my-gums
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP/WS port |
| `MONGO_URL` / `MONGO_URI` | — | MongoDB connection string |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |
| `RATE_LIMIT_MAX` | `120` | Max requests per minute per IP |
| `HTTPS` | `false` | Enable HTTPS |
| `CERT_DIR` | `/etc/letsencrypt/live` | SSL certificate directory |
| `DATA_DIR` | `./data` | Data directory |

## Project Structure

```
├── .github/workflows/   CI pipeline
├── assets/              Game assets (images, icons, monsters)
├── css/                 Stylesheets
├── docs/                Documentation
├── js/                  Client-side game logic
├── logs/                Server logs
├── server/              Server-side logic (DB, combat, formulas)
│   ├── network/         Online core (protocol, state, rooms, rate limiter, combat, network server)
│   ├── systems/         Game systems (movement, progression)
├── tests/               Test suites (Vitest)
├── Dockerfile           Container image
├── server.js            Entry point
└── package.json         Dependencies & scripts
```

## Player ID System

Pass `?playerId=your_unique_id` in the URL to persist progress via MongoDB:

```
https://yourdomain.com/?playerId=player123
```

## Docs

Additional documentation in the [docs/](docs/) directory.

---

**Version**: 1.0.0 — July 2026
