# Architecture

## Workspace boundaries

```text
mobile (React Native/Expo) ──┐
                            ├── HTTPS REST + authenticated WSS ── backend (Express)
desktop (Electron/React) ───┘                                      │
                                                ┌─────────────────┼─────────────┐
                                           PostgreSQL           Redis       retailers
                                                │                             adapters
                                           notifications ── FCM ── mobile OS
```

- `backend/src/api`: validated, authenticated, user-scoped HTTP endpoints.
- `backend/src/database`: pooled SQL connections, domain types, versioned SQL
  migrations. PostgreSQL is the source of truth.
- `backend/src/scrapers`: retailer-neutral snapshot contract and isolated retailer
  implementations. Unknown/unconfigured data is not represented as out of stock.
- `backend/src/services`: periodic checks, Redis TTL caching, persistent
  notifications, FCM delivery, and scoped WebSocket publication.
- `mobile/src`: typed API access, navigation, screens, in-app events, optional
  native Firebase notifications, and non-sensitive device preferences.
- `desktop/src/main`: sandboxed window, narrow preload bridge, tray and native
  notifications. The renderer cannot access Node.js or arbitrary IPC capabilities.
- `desktop/src/renderer`: React client with the same REST/WebSocket contract.

## Data ownership

A user owns tracked items, settings, device registrations, and notifications.
Price-history rows belong to a tracked item. Foreign keys and cascading deletes
preserve consistency; route queries include the authenticated user ID rather than
trusting IDs supplied by a client. SQL values are parameterized.

Passwords are salted and derived using Node's scrypt; JWTs have limited lifetimes.
Clients retain authentication in memory for this starter. Mobile/desktop tokens
must be stored in secure OS-backed storage if persistent login is added.
WebSocket authentication occurs in the first message, with an authentication timeout.

## Check lifecycle

1. The cron service selects due tracked items according to user polling intervals.
2. A retailer adapter resolves an identifier and returns a validated availability/
   price snapshot. Unsupported adapters return an explicit configuration error.
3. Redis caches successful retailer results for a short TTL. PostgreSQL retains
   item state and price history; failed checks do not overwrite the last good state.
4. Stock transitions and qualifying price changes generate persistent notifications.
5. Authenticated WebSocket clients receive item/panel events. Enabled mobile push
   preferences also permit delivery through FCM to registered devices.

The in-app panel remains available without Firebase. Native desktop notifications
require a running desktop process; mobile background push requires native Firebase/
APNs configuration. Neither WebSocket nor push is a guaranteed durable delivery
channel; notification history in PostgreSQL provides the recovery path.

## Operational boundaries

Migrations run explicitly and serialize concurrent migration attempts.
The starter scheduler avoids overlapping runs in one process, not across replicas.
Production scaling needs a durable queue, distributed locks, retry policies,
delivery state, metrics, and retailer-specific request budgets.

Docker Compose provides local databases, not production deployment. PostgreSQL
and Redis ports bind to loopback. Secrets come from ignored environment files;
Firebase service accounts stay server-side. The backend must not fetch arbitrary
client-provided URLs, and Electron must not load untrusted remote pages.

## Extension priorities

1. Authorized retailer product resolution by SKU/brand/model, contract-tested
   snapshots, currency and region/store semantics.
2. Distributed polling, transient-error backoff, transactional notification outbox,
   and retention/pagination.
3. Production account lifecycle, credential storage, native notification testing,
   client reconnect/recovery, signed installers, and deployment monitoring.
