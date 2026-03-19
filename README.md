# Courier Service

Courier dispatch MVP built with SvelteKit, `adapter-node`, Drizzle, SQLite, and a WhatsApp Web worker powered by `whatsapp-web.js`.

## What is included

- Customer intake over WhatsApp with a strict state machine for size, dimensions, weight, pickup pin, dropoff pin, notes, and confirmation.
- Admin routes for dispatch visibility, driver management, and WhatsApp connection status.
- Driver routes for vehicle registration, online/offline presence, offer handling, and job progression.
- Deterministic assignment logic that ranks by smallest sufficient vehicle, then pickup proximity, then idle time.
- SQLite outbox processing for outbound WhatsApp notifications and driver-offer fallthrough.

## Stack

- SvelteKit + `@sveltejs/adapter-node`
- Drizzle ORM + SQLite via `@libsql/client`
- `whatsapp-web.js` + Puppeteer/Chromium
- Vitest + Playwright

## Local setup

0. Use Node 24 or Node 25 consistently for this repo.

```sh
nvm use
```

1. Install dependencies:

```sh
pnpm install
```

2. Copy environment defaults if needed:

```sh
cp .env.example .env
```

3. Generate the database and seed demo users:

```sh
pnpm db:migrate
```

4. Run the web app and worker in separate terminals:

```sh
pnpm dev:web
pnpm dev:worker
```

The worker is required for live WhatsApp QR auth, inbound message handling, offer expiry, and outbound queue delivery.

## Demo credentials

- Admin: `admin@example.com` / `admin1234`
- Driver 1: `driver1@example.com` / `driver1234`
- Driver 2: `driver2@example.com` / `driver1234`
- Driver 3: `driver3@example.com` / `driver1234`

Change these before any real deployment.

## Important runtime notes

- The app stores SQLite data and WhatsApp auth state in `./data` by default.
- The worker is not serverless-safe. It needs a long-lived Node process with persistent disk.
- The first real WhatsApp connection requires opening `/admin/integrations/whatsapp` and scanning the QR code once the worker is running.
- Driver WhatsApp acceptance is not implemented in v1. Drivers accept and progress jobs in the web portal.

## Useful commands

```sh
pnpm check
pnpm lint
pnpm test
pnpm build
pnpm worker
```
