# inventory-checker

A TypeScript monorepo for tracking availability and price alerts across Apple,
Target, Best Buy, and Amazon, with React Native mobile and Electron desktop clients.

## What is included

- Express API with registration/login, user-owned items, inventory status, price
  history, preferences, notification history, and authenticated WebSocket updates.
- PostgreSQL schema and versioned migrations; Redis caching; scheduled checks.
- Retailer adapter interface and extension templates. **Amazon, Target, and Apple
  are not live integrations.** Best Buy requires an API key and a product SKU.
- Mobile dashboard, add-item, item details, settings, and notification panel.
- Desktop dashboard, item entry, settings, notification panel, tray, and native alerts.
- Optional Firebase Cloud Messaging delivery to registered mobile devices.

This is a development foundation, not a production-ready retailer monitoring service.
An unconfigured adapter never invents prices or availability. Brand/model tracking
can be saved, but retailer-specific product resolution must be implemented before
those items can be checked.

## Requirements

- Node.js 22.12+ and npm (Node 24 recommended).
- Docker with Compose for PostgreSQL 16 and Redis 7.
- Mobile: Android Studio/Android SDK or macOS with Xcode for native builds.
- Desktop: a graphical environment; platform signing credentials for distribution.
- Optional: Firebase project and Best Buy developer API access.

## Local setup

Run commands from the repository root unless indicated otherwise:

```sh
npm install
cp .env.example .env
cp backend/.env.example backend/.env
cp mobile/.env.example mobile/.env
cp desktop/.env.example desktop/.env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use independently generated random values for `POSTGRES_PASSWORD` in the root
`.env` and `JWT_SECRET` in `backend/.env`. Set backend `DATABASE_URL` to a
PostgreSQL connection URL with user `inventory`, your generated password,
host `localhost`, port `5432`, and database `inventory_checker`.
URL-encode the password if it contains reserved URL characters. Never commit
credentials. Backend configuration is loaded relative to the backend workspace.

```sh
npm run services:up
npm run db:migrate
npm run dev:backend
```

The API defaults to `http://localhost:3000`; `GET /health` is a health check.
Migrations are explicit, not automatically run on startup. Re-running them is safe.
Docker volumes preserve data across restarts:

```sh
npm run services:down
# Destructive reset, only if you intend to delete local data:
docker compose down -v
```

### Desktop

In another terminal:

```sh
npm run dev:desktop
```

Configure `desktop/.env` with `VITE_API_URL` if the API is not at
`http://localhost:3000`. HTTP is permitted only for loopback hosts; remote API hosts
require HTTPS. Rebuild after changing the URL so the renderer CSP allows the exact
API/WebSocket host. Register or log in, add an item, and inspect the notification
panel. Desktop alerts come from the authenticated WebSocket, not FCM. Closing the
window keeps the tray application running; use the tray menu to quit.

### Mobile

Set `EXPO_PUBLIC_API_URL` in `mobile/.env`:

- Android emulator: `http://10.0.2.2:3000`.
- iOS simulator: `http://localhost:3000`.
- Physical device: the development machine's LAN address, reachable on the same network.

```sh
npm run dev:mobile
# Native development, from the root:
npm run android --workspace mobile
npm run ios --workspace mobile
```

Use HTTPS/WSS outside local development. Plain HTTP may need a development-only
Android network-security or iOS transport exception; do not ship a broad exception.
The API's CORS configuration must allow the desktop renderer origin (`file://`
for WebSockets, and `null` where emitted by local renderers); native apps
are not governed by browser CORS.

### Optional push notifications

FCM is disabled by default, so basic tracking does not require Firebase.

1. Create Firebase Android/iOS applications with identifiers matching `mobile/app.json`.
2. Download `google-services.json` and `GoogleService-Info.plist` into the mobile
   workspace (both are gitignored). `mobile/app.config.ts` automatically configures
   their paths and Firebase plugins when push is enabled; both files are required.
3. Set `EXPO_PUBLIC_FIREBASE_ENABLED=true` and create a native development build.
   React Native Firebase **does not work in Expo Go**. Rebuild after native config changes.
4. Enable backend `FIREBASE_ENABLED` and point `GOOGLE_APPLICATION_CREDENTIALS` to a
   server-side service-account file outside the repository. The starter requires
   file-based application default credentials; metadata-only credentials are not
   enabled. Never put server credentials in the mobile or desktop app.
5. Grant device notification permission. Device tokens register through the
   authenticated API; the application panel also receives WebSocket updates.

iOS additionally requires APNs configuration in Firebase and signing capabilities.
Platform-specific background delivery and signing must be verified on real devices.

## Development commands

```sh
npm run typecheck         # All three workspaces
npm run build             # Backend + desktop (mobile uses Expo/native builds)
npm test                  # Focused backend tests
npm run package --workspace desktop
```

There is no separate lint setup. The lockfile records the shared dependency tree;
use `npm ci` for repeatable installs once it is present. Build artifacts, native
generated projects, `.env` files, and Firebase credentials are ignored.

The root manifest pins patched gRPC and modern glob/minimatch transitive versions.
`npm audit --omit=dev` reports no vulnerabilities in the installed runtime tree.
The full audit still reports moderate minimatch denial-of-service advisories in
legacy Electron packaging dependencies; npm proposes breaking tooling changes
rather than compatible fixes. Use only trusted local packaging inputs and
recheck `npm audit` before distributing builds. Do not run `npm audit fix --force`
without testing the resulting major tooling changes.

## API reference

JSON request/response bodies; all `/api` routes except registration and login
require an `Authorization` header using the `Bearer` scheme and the login token.
IDs are UUIDs. Responses for list endpoints
are arrays. Item access, histories, preferences, notifications, and device tokens
are scoped to the authenticated user.

| Method | Path | Purpose / request |
|---|---|---|
| POST | `/api/users/register` | `{ "email": "...", "password": "..." }` → `{ token, user }` |
| POST | `/api/users/login` | Same request → `{ token, user }` |
| GET | `/api/users/me` | Current user (never password hash) |
| GET | `/api/items` | List tracked items |
| POST | `/api/items` | Add item, example below |
| GET | `/api/items/:id` | Item details |
| DELETE | `/api/items/:id` | Remove item and dependent history |
| GET | `/api/items/:id/prices` | Price/availability history |
| GET | `/api/inventory` | Latest inventory states |
| GET | `/api/settings` | Notification preferences and polling interval |
| PATCH | `/api/settings` | `{ "notifications_enabled": true, "check_interval_minutes": 15 }` |
| GET | `/api/notifications` | In-app notification history |
| PATCH | `/api/notifications/:id` | `{ "read": true }` |
| POST | `/api/notifications/devices` | Register FCM `{ "token": "..." }` |
| DELETE | `/api/notifications/devices` | Unregister FCM `{ "token": "..." }` |

Example item:

```json
{
  "retailer": "bestbuy",
  "brand": "Example",
  "model": "Example Model",
  "sku": "1234567",
  "target_price": 199.99
}
```

Retailer values: `amazon`, `target`, `bestbuy`, `apple`. Supply a SKU, a product URL,
or a model (optionally with a brand). Passwords must contain 8–128 characters, and
check intervals range from 5 to 10080 minutes. Prices use the retailer's supported currency; the foundation
does not perform currency conversion. New items have unknown price/availability
until a successful check. `last_checked_at` records attempts; `last_check_error`
explains failed or unconfigured checks without replacing the last good price/stock.
Price history records observed changes, not every polling attempt.
Saved URLs are identifiers, not arbitrary server-side
fetch targets.

Registration example:

```sh
curl -X POST http://localhost:3000/api/users/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@example.com","password":"choose-a-long-unique-password"}'
```

Use the returned token in subsequent requests. Validation errors return 400,
unauthenticated requests 401, inaccessible items 404, duplicate registrations 409,
and rate-limited requests 429. Internal errors do not expose stack traces.

### WebSocket protocol

Connect to `ws://localhost:3000/ws` (use WSS in production), then immediately send:

```json
{ "type": "auth", "token": "<login token>" }
```

Tokens are never placed in URL query strings. Unauthenticated connections time out.
Events are user-scoped:

```json
{ "type": "item.updated", "item": { "id": "...", "current_price": 199.99, "in_stock": true } }
```

```json
{ "type": "notification", "notification": { "id": "...", "title": "...", "body": "..." } }
```

Treat events as invalidation signals and reload API data as necessary. Reload history
after reconnecting: WebSocket delivery is not a durable queue.

## Extending retailer integrations

Implement the contract in `backend/src/scrapers/baseScraper.ts` and register the
adapter in the scheduler. Prefer authorized official APIs. Best Buy uses
`BESTBUY_API_KEY`; API access and data availability are subject to retailer policies.
Target's unofficial endpoints should not be assumed stable or authorized.
Amazon and Apple need approved data sources or permitted scraping implementations.

Respect terms of service, robots policies, rate limits, timeouts, and regional/store
availability. Do not bypass access controls. Use fixed allowlisted retailer hosts;
do not fetch arbitrary user URLs. Add product lookup, currency/region handling,
retry/backoff, adapter contract tests, and observability before enabling live checks.

The scheduler respects user polling preferences, compares successful snapshots,
persists history, and creates back-in-stock/target-price alerts. It is designed for
a **single backend process**; distributed scheduling/locking is needed before
running multiple workers.

## Production considerations

Add email verification/password reset, token revocation, secure OS credential
storage, reconnect/backoff, notification delivery retries, retention/pagination,
monitoring, backups, and deployment automation. Use TLS, restrict allowed origins,
rotate secrets, and protect PostgreSQL/Redis behind private networks with
authentication. The local Redis service intentionally has no password and binds
only to loopback. This project does not include packaged/signed mobile binaries.

See [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries and data flow.
