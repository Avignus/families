# Families — Steam Gift-Pooling Platform

A full-stack web app that lets groups of Steam users pool money toward each other's Steam wishlist games.

---

## Quick Start

### 1. Prerequisites

- Node.js 20+
- Docker & Docker Compose
- A [Steam Web API Key](https://steamcommunity.com/dev/apikey)

### 2. Environment setup

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (default works with docker-compose) |
| `NEXTAUTH_SECRET` | Random secret — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL of the app (default: `http://localhost:3000`) |
| `STEAM_API_KEY` | Your Steam Web API key from https://steamcommunity.com/dev/apikey |
| `APP_BASE_URL` | Same as NEXTAUTH_URL |
| `DEFAULT_CURRENCY` | Currency code, e.g. `BRL` |
| `DEFAULT_COUNTRY` | ISO country code for Steam price lookups, e.g. `BR` |

### 3. How to get a Steam API Key

1. Go to https://steamcommunity.com/dev/apikey
2. Sign in with your Steam account
3. Enter any domain (e.g. `localhost`) for personal use
4. Copy the key into `STEAM_API_KEY`

### 4. Run with Docker

```bash
docker compose up --build
```

On first run this will:
1. Start Postgres
2. Build the Next.js app
3. Run `prisma migrate deploy` automatically
4. Start the app on port 3000

To seed the demo data (optional, gives you two families + wishlist items):

```bash
docker compose exec app npx tsx prisma/seed.ts
```

### 5. Run locally (dev)

```bash
npm install

# Start Postgres only
docker compose up postgres -d

# Set up DB
npm run db:migrate
npm run db:seed   # optional demo data

# Start Next.js dev server
npm run dev
```

Open http://localhost:3000.

---

## Testing

### Unit tests (Vitest)

Tests the pledge math and uniqueness logic in isolation (no DB required):

```bash
npm test
```

### E2E tests (Playwright)

Requires a running app instance:

```bash
npm run dev &   # or docker compose up

E2E_ENABLED=1 npm run test:e2e
```

The E2E suite mocks Steam login via `/api/auth/mock-login` (disabled in production).

---

## Architecture decisions

### Why no tRPC

The spec mentions tRPC as optional. This implementation uses plain Next.js Route Handlers (`app/api/*`) with Zod validation instead. Reasons: simpler to read, easier to debug with curl/Postman, no extra type-sharing setup needed for this scale.

### Steam auth implementation

Steam only supports OpenID 2.0, not OAuth2. The NextAuth "Steam provider" in the ecosystem is a community fork that wraps OpenID 2.0. This implementation takes a more direct route:

- `GET /api/auth/steam` — redirects to Steam's OpenID endpoint
- `GET /api/auth/steam/callback` — verifies the OpenID response by round-tripping back to Steam with `mode=check_authentication` (the correct OpenID 2.0 verification flow), then fetches the user profile via `ISteamUser/GetPlayerSummaries`, upserts the user, and manually mints a NextAuth JWT cookie.

The `nextauth` adapter is kept for session infrastructure but the Steam-specific auth is handled directly to avoid dependency on an unmaintained community package.

### Real-time notifications

Server-Sent Events (SSE) via `/api/notifications/stream`. An in-process subscriber map (see `lib/notifications/sse.ts`) delivers pushes to connected clients. Falls back to 30-second polling if the SSE connection drops (handled in the `NotificationProvider` client component).

**Limitation:** The in-process SSE map does not work across multiple Node.js instances (horizontal scaling). For production scale, replace it with Redis pub/sub. This is acceptable for v1 single-process deployment.

### Money

All monetary values are stored as `INT` (cents) in Postgres. The UI formats them with `Intl.NumberFormat`. This avoids all floating-point money bugs.

### v1 is bookkeeping only — no real payments

Steam does not expose a purchase API to third parties. Contributions in this app are **ledger entries only**. The family's designated buyer (typically the chief or item owner) must buy the game manually on Steam and then mark it as `purchased` in the app. The settlement table shows who owes whom, but actual money transfer happens outside the app (bank transfer, PIX, etc.). This is documented in the UI wherever relevant.

---

## Decisions not covered by the spec

| Decision | Rationale |
|---|---|
| Locale defaults to `pt-BR` | Target user is in Brazil. All notification templates, date formatting, and currency display default to Brazilian Portuguese. English strings are in `lib/notifications/templates.ts` as a fallback. |
| Vote default duration: 7 days | Not specified in spec; 7 days gives all members time to vote. |
| Price change warning threshold: 5% | Spec says "~5%" — implemented as `Math.abs(steam - target) / target > 0.05`. |
| No nightly catalog refresh cron in Docker | The Steam app catalog (`/ISteamApps/GetAppList/v2/`) is ~2MB JSON with 200k entries. Loading it on first search would be too slow. The seed populates a few popular games. In production, wire up a nightly job that calls `GET /api/steam/catalog-refresh` (not implemented in this PR; add a Vercel cron or a simple node-cron call). |
| SSE heartbeat every 25 seconds | Keeps load balancer connections alive; below the typical 30s idle timeout. |
| Pledge rate limit: 1 per second per user per item | Simple in-memory map. Good enough for single-instance v1. |
