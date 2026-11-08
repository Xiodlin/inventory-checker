# Architecture

## Device-local boundaries

```text
Desktop renderer -> trusted Electron preload IPC -> desktop main process
                                                    | SQLite + OS key encryption
                                                    | local scheduler + notifications
                                                    `-> HTTPS retailers

Mobile screens -> local service -> Expo SQLite + SecureStore
                                -> foreground scheduler / OS background task
                                -> local notifications
                                `-> HTTPS retailers

Both runtimes reuse shared/ for validation, adapters, alerts, SQLite operations,
monitoring, and the backup contract. No inventory backend is required.
```

- `shared/src`: portable product/stock types, Zod schemas, retailer adapters,
  notification rules, transactional local storage, and bounded monitoring.
- `desktop/src/main`: embedded Node SQLite, serialized SQL adapter, encrypted API
  key file, scheduler/tray/wake lifecycle, native alerts, and validated IPC.
  On macOS the development launcher packages and ad-hoc-signs its own local app,
  verifying the complete bundle before launch. Native notifications require a valid
  signature; the app leaves notification authorization to the OS. Settings offers
  an explicit test and permission troubleshooting. Displayed notifications retain
  references until closed; successful OS submission does not prove banner visibility.
- `desktop/src/renderer`: React UI with no Node access, login, HTTP API, or WebSocket.
  CSP disables renderer network connections; retailer fetching belongs in main.
- `mobile/src/services`: Expo SQLite adapter, SecureStore, Expo Fetch for retailer
  requests, local notifications, file backups, and top-level background task.
- `backend/`: optional legacy server and one-time account-scoped exporter. Its
  existing API/authentication contracts remain available but neither client uses
  them. Docker/PostgreSQL/Redis/Firebase are not local-client dependencies.

## Persistence and ownership

Each app owns one device-private `inventory.sqlite` with schema-version checks and
transactional creation. Items, preferences, history, notifications, and scheduler
lease/status are durable. UUIDs identify entries; the legacy `user_id` field is
local metadata, not a login or authorization mechanism. Device OS access controls
protect local data; SQLite is not itself encrypted.

SQL values are parameterized. Per-connection queues prevent asynchronous UI
queries from accidentally joining a transaction. SQLite foreign keys cascade item
history on removal. Mobile uses a dedicated connection and explicit immediate
transactions so connection-specific foreign keys and timeouts remain effective.
Successful stock snapshots, history, and resulting alerts
commit atomically; failures preserve last known stock and record a visible error.

Best Buy credentials are separate from the database: Electron `safeStorage`
encryption (no insecure Linux plaintext fallback) or mobile SecureStore with
after-first-unlock accessibility. Backups never contain keys, password hashes, or
JWTs. Product ZIPs are personal location data and remain in backups; no automatic
app-managed upload or synchronization occurs. OS backups follow device settings.

Backups use a versioned validated JSON format, consistent snapshot export, and
transactional import. The 16 MB limit applies to UTF-8 bytes on export and import. Existing
IDs remain unchanged, imported notifications are not re-delivered, and device
preferences remain local. The legacy exporter selects one account and writes the
same format without deleting the original PostgreSQL data.

## Monitoring lifecycle

1. Desktop starts monitoring after local database initialization, then every minute.
   Suspension cancels further batch work and pauses the timer; resume triggers due
   checks. Closing the window keeps the main process/tray alive; Exit waits for
   active work and closes storage. Sleep is not prevented.
2. Mobile initializes local services and requests notification/background permissions
   from the foreground UI. Foreground minute ticks pause off-screen. A top-level
   TaskManager definition allows headless execution in a native build.
3. The monitor selects oldest due products by the device's interval, coalesces
   overlapping work, and uses a renewable SQLite lease to exclude competing
   runtimes. The lease expires after a killed process; background batches are
   bounded and expiry requests stop launching further work.
4. Portable adapters fetch only fixed retailer HTTPS hosts with no automatic redirects and
   explicit timeouts/body limits. Unknown/malformed/blocked responses are errors.
   Amazon share links resolve once to a validated canonical Amazon product URL;
   public HTML requires exact ASIN identity and recognized primary availability.
   Target `preselect` selects a validated variant TCIN; the parent is never used
   as a stock fallback. Dynamic Target pages without public offer metadata fail
   explicitly. Embedded eligibility flags are not treated as availability.
   Manual Check now bypasses item intervals, reports results, and does not overlap
   scheduled work. Automatic checks remain due-only.
   Apple pickup resolves an exact configured SKU and validates per-store distances,
   ZIP, eligibility, and stock; shipping never substitutes for pickup.
5. User-enabled stock/price rules generate durable alerts. Stock-only observations
   allow a null price. Pickup alerts identify newly available stores rather than
   only aggregate stock transitions.
6. The runtime submits undelivered alerts to the local OS notification system.
   Permission failures are retained in the panel and status, not silently swallowed.
   Crash windows and OS presentation restrictions prevent exactly-once guarantees.

## Sleep and deployment limits

Desktop shopping discovery is separate from the shared retailer monitor. A
short-lived sandboxed Electron window loads Google Shopping on a manual request.
It has an ephemeral session, no preload/Node access, denied permissions/downloads,
restricted navigation, and no automatic interaction with consent/CAPTCHA controls.
Only visible offer cards with titles and unambiguous prices are extracted. Required
title phrases, accessory/condition checks, and explicit availability labels produce
reported or uncertain matches, not verified retailer stock. The latest 20 outcomes
are stored in a desktop-only SQLite table and can be cleared from the UI; they do
not change watchlists, backups, or notification rules. Suspension cancels the
window and shutdown waits for cleanup. Live Google access has been blocked in
testing, so successful live extraction is not promised.

Desktop cannot run network checks during actual system sleep. Mobile requests an
inexact background delay of at least 15 minutes; the OS may run much later or not at
all under power, force-quit, permission, or network restrictions. Existing stock
cannot be inferred from scheduled reminders. Reliable unattended alerts while a
device cannot execute require an external always-on service and are intentionally
not promised by this design.

Native iOS/Android builds are required for background tasks. Metro/Expo development
tooling is not a production backend. Background execution must be validated on
physical devices; bundle/type/configuration validation is insufficient evidence
of actual scheduling. Apple's pickup endpoint currently blocks the live probe with
HTTP 541, so successful live pickup monitoring remains unverified.
