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

Shopping discovery uses shared visible-card extraction/matching and a separate
portable `ShoppingMonitor`. Manual or scheduled desktop searches load Google
Shopping in a short-lived sandboxed Electron window.
It has an ephemeral session, no preload/Node access, denied permissions/downloads,
restricted navigation, and no automatic interaction with consent/CAPTCHA controls.
Only visible offer cards with titles and unambiguous prices are extracted. Required
title phrases, accessory/condition checks, and explicit availability labels produce
reported or uncertain matches, not verified retailer stock. The latest 20 outcomes
are stored in a desktop-only SQLite table and can be cleared from the UI.
Both clients persist saved inputs, latest successful outcomes, errors/attempt times,
and stock-alert deduplication in `shopping_watches`. Due searches use retailer
Settings and the automatic-check toggle; at most one oldest due search runs per
foreground/desktop minute tick. Explicitly in-stock required-text matches create
alerts atomically with the saved observation in the existing notification queue.
Identity uses title/seller, not ephemeral Google tracking URLs or prices.
Errors retain previous stock and results. Deleting a watch during a check prevents
its result/alerts from being committed. Searches are not in portable backups;
their alerts use the existing alert backup/delivery policies. Suspension cancels the
window and shutdown waits for cleanup. Electron's initial load can be interrupted
by Google's ordinary client-side search navigation; extraction waits for an allowed
main-frame navigation to finish within the existing timeout. HTTP errors and denied
redirects still stop the search. Live offer extraction has succeeded, but Google has
also blocked other probes, so continued access is not promised.

Mobile mounts an ephemeral incognito native WebView only for an active search.
Remote messages are accepted only from allowed Google pages and visible-card data
is schema-validated before matching. Navigation, files, popups, geolocation, and
shared login cookies are restricted. DOM extraction is kept free of transpiler
helpers so its serialized function can execute inside the WebView.
Leaving the foreground cancels the search and its pending monitoring update.
Google shopping is **not** invoked by the headless BackgroundTask: rendering a
WebView in a suspended mobile app is not reliable. Direct retailer background
monitoring remains unchanged.

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
