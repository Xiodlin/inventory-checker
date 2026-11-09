# Inventory Checker

A local-first Electron desktop and React Native/Expo mobile app for retailer
availability and price alerts. **Neither app needs Docker, an API server, an
account, Redis, or Firebase.** Each device owns its own SQLite database.

## Run locally

Requirements: Node.js 22.12+ (Node 24 recommended), npm, and a graphical desktop.

```sh
npm install
npm run dev:desktop
```

On macOS this builds and ad-hoc-signs a local `.app` under
`desktop/release/local-dev/` before launching it. Electron's macOS notification
API requires a signed bundle; raw `electron .` / `npm start --workspace desktop`
can fail before showing any permission prompt. This does not modify the installed
Electron binary, require an Apple Developer account, or notarize a distributable
release. Quit older tray instances before switching to the signed build.

Use **Settings → Test desktop notification** to submit an explicit test and allow
the macOS prompt if shown. If previously denied, open **System Settings →
Notifications → Inventory Checker** and enable alerts. Focus / Do Not Disturb can
hide banners even when an alert was accepted. The test sends one notification
regardless of the automatic-alert preference; it does not change that preference.
Existing unread, undelivered alerts are retried on later checks.

The desktop app opens directly to your watchlist. Closing its window keeps it in
the tray; tray **Exit** stops monitoring. Its database is `inventory.sqlite` in
Electron's user-data directory, normally
`~/Library/Application Support/Inventory Checker/` on macOS. The renderer uses
validated IPC, not a localhost HTTP server.

### Mobile

Use a native development or production build; Expo Go is not sufficient for the
background workflow. Android requires Android Studio/SDK; iOS requires macOS and
Xcode with the necessary simulator/device support and signing.

```sh
npm run ios --workspace mobile
# Or:
npm run android --workspace mobile
```

After installing the native development build:

```sh
npm run dev:mobile
```

**Rebuild any previously installed mobile client:** this conversion adds native
SQLite, notification, background-task, secure-storage, backup, and shopping WebView modules.
No mobile/desktop `.env` file or API URL is required. Old API/Firebase environment
values are no longer used. Metro is development tooling, not an inventory backend;
a distributed production build bundles the application itself.

Products, history, alerts, and preferences live in the mobile application's private
SQLite directory. Best Buy keys use OS secure storage, accessible after the first
device unlock for background work. Grant notification permission when prompted;
Settings allows requesting it again. If denied, alerts remain in the app and
delivery failures are shown explicitly.

## Storybook component suite

```bash
npm run storybook --workspace desktop        # interactive catalog on port 6006
npm run test:storybook --workspace desktop   # headless Chromium interactions
npm run build-storybook --workspace desktop # static catalog in desktop/storybook-static
```

The desktop catalog includes:

- **Foundations:** role-based color scales, semantic surfaces and functional
  states, typography, spacing/sizing, elevation/radius/motion, a token-based
  product card, and token integrity checks.
- **Components → Overview → All Components:** a single-page visual inventory of
  all 22 token-based library components. Each component also has its own sidebar
  entry, generated prop documentation/controls, and isolated state stories:
  - **Actions:** Button and Icon Button; variants, sizes, hover/pressed/focus,
    disabled/loading states, and accessible names.
  - **Forms:** Input, Textarea, Select, Checkbox, Radio Group, Switch, Field Label,
    and Help Text; empty/filled, required, disabled/read-only, error, checked/mixed,
    selection, keyboard focus, and associated descriptions where applicable.
  - **Display:** Card, Badge, Disclosure, Empty State, and Divider.
  - **Feedback:** Alert, Dialog, Spinner, and Skeleton.
  - **Navigation:** Tabs and Link. **Data:** Table.
  Hover/pressed snapshots use explicit preview attributes sharing native
  pseudo-state CSS. Components are exported from
  `desktop/src/renderer/components/Button.tsx` and `UI.tsx`. The desktop application
  uses these same controls and semantic tokens across the dashboard, watchlist,
  notifications, settings, and legacy direct-retailer views.
- **Patterns → Common UI:** composed form validation/recovery, selection controls,
  feedback, product cards, confirmation flows, navigation, and loading examples.
- **Application:** unified dashboard, empty/error states, manual-check feedback,
  individual dismissal, confirmed clearing, direct/search product navigation,
  legacy/missing-product fallbacks, and simulated OS-banner navigation.
- **Monitoring:** compact generalized add flow, pending/unknown/out-of-stock/sale
  tags, lowest prices, retained observations, independent per-product filters,
  vendor grouping and two-level price sorting, verification evidence, uncertain
  matches, link selection, notification read/dismiss/clear actions and errors.
- **Preferences:** compact settings, notification test/failure, backup actions,
  saving and failure recovery. **Legacy** retains direct-retailer components.

Every story gets an isolated in-memory Electron bridge stub; interactive
application stories persist mutations within that story and never fetch live
Google/retailer data or invoke OS dialogs. The a11y addon reports findings but
remains advisory (`todo`), not a claim that the entire existing UI passes WCAG.
These are desktop browser stories, not native mobile or real OS-banner tests.
The desktop application imports the token foundation through `app.css`. Application
styles use semantic color, type, spacing, radius, focus, and motion tokens instead
of a parallel hardcoded theme. Shared controls retain native form submission,
validation, and keyboard behavior. Cards remain flat, notification links retain
product focus/highlighting, and reduced-motion preferences disable animated
scrolling and spinners. Navigation stacks above content on narrow windows; wide
product tables scroll within their own focusable region. This migration is for the
Electron desktop renderer; native mobile styling is unchanged.

## Checks, sleep, and notifications

Each saved alert has a **Dismiss** action that deletes only that alert.
Click/tap the alert title or body to open the dashboard, expand and highlight its
linked product card, and mark the alert read. Desktop and mobile OS-banner clicks
also open the linked dashboard card (mobile handles both running and cold launches).
New direct-retailer and saved-search alerts store stable product IDs, not inferred
title matches. Older alerts without a link open the dashboard with an explanation;
removed products are reported explicitly. Direct-product links survive backups;
saved-search alerts may refer to a missing search after transfer because searches
are not backed up. Dismissal does not reset monitoring or stock-change deduplication.

Use **Notifications → Clear notifications** (inside the collapsible notifications
section on mobile), then **Delete all notifications** to confirm. This permanently
deletes all saved alerts on this device, including read/unread alerts and pending
delivery retries, not just the latest displayed entries. Cancel leaves them intact.
Monitoring, stock-change deduplication, products, and price history are unchanged;
future qualifying changes still create alerts. Already displayed OS notifications
are not dismissed, and an alert already being delivered may still appear.

- Default product interval: **15 minutes**, configurable from 5 to 10,080 minutes.
- Desktop and foreground mobile look for due products every minute. New general
  searches start on the next available tick; overlapping runs are coalesced.
- **Check now** retries every tracked product immediately, including recent failed
  checks, and reports successes/failures. Automatic checks still respect your interval.
  Manual requests wait for an active run and coalesce repeated clicks; suspension
  interrupts remaining work. Each product shows its last attempt and any error.
- Desktop checks continue while minimized/in the tray **only while the computer
  is awake**. Actual system sleep pauses execution; due checks catch up on wake.
  Fully quitting or powering off stops checks. The app does not prevent sleep.
- Mobile requests best-effort OS background execution by default. Its requested
  background delay is at least **15 minutes**, even if foreground checks use 5.
  iOS/Android decide when to run—often much later. A locked screen can allow
  background work, but battery restrictions, Background App Refresh settings,
  force-quitting, reboot/first-unlock state, and network conditions can prevent it.
  Turn background checks off in Settings if desired.
- Background runs process a small bounded batch of due products and prioritize
  oldest attempts. Large watchlists may need additional OS opportunities.
- **No device-only design guarantees timely stock alerts during sleep.** Local
  notifications are generated after an actual successful check; a previously
  scheduled reminder cannot know whether stock has changed.

Successful observations update price/stock history transactionally. Stock alerts
cover first-observed availability and restocks, not every unchanged check. Price
alerts require an available product at/below a target and a qualifying price or
availability change. A stock-only product does not require a price. Failed checks
preserve the last good state and show errors, never invented stock or prices.
Undelivered native alerts are retained in the local notification panel and retried
while enabled; OS delivery and crash recovery are not exactly-once guarantees.

## Retailers and Apple pickup

New products use generalized Google Shopping monitoring. Existing direct retailer
products retain their stock/price/pickup rules and continue checking unchanged.

### Experimental shopping discovery and search alerts

**Add product** on the desktop and mobile Dashboard saves a Google Shopping search
without an API key. Enter a product/model and required variant phrases
(for example `MacBook Neo` and `256GB, Indigo`). An optional example URL is a saved
reference only: this prototype does not fetch it or infer specifications from it.

A separate browser renders normal Google results: sandboxed Electron on desktop,
an incognito native WebView while the mobile app is open. It has no application
preload, Node access, sign-in session, download permission, or access to the local
app's IPC bridge. It does not click purchase controls or automate CAPTCHA/consent.
Navigation stays on Google's search/product pages. Cookies/cache are cleared after
each desktop search; the mobile private WebView is removed after each search.
The latest **20** desktop search outcomes are retained internally in local SQLite,
separately from each product's last successful result. There is no separate
one-time search or recent-history page. Search data is not included
in watchlist backups. Google receives the search, network address, and browser
requests; on-device storage does not mean offline or third-party-free processing.
No ZIP/GPS is sent by this prototype; location-dependent results may use Google's
inferred location and are not verified to be near you.

Required text matches contain all requested phrases in the offer title. This is
not proof of an exact SKU: uncertain variants, accessories, and used/refurbished
listings are separated. Stock requires an explicit visible stock/pickup label;
a price, delivery estimate, or ordinary listing alone leaves availability unknown.
All availability is **Google-reported**, never retailer-verified. Google coverage
does not include every retailer or product; generalized searches do not replace
an official retailer API's guarantees.

There is one add flow and one **Tracked products** watchlist for general searches
and existing direct retailer products. Expand a product's **Details and latest
offers** to see the latest successful observation; there is no separate results
panel. Expand an offer's
**Offer link**, then click its URL field to select the complete link for copying.
Alert behavior and retention details are available in expandable help sections.
The add form and product/offer details start collapsed. Collapsing a section does not
stop monitoring or discard its form values. Mobile notifications are also collapsible.

Use **Add product** even before a successful search or when no
required-text match was found. Saved products recheck using the **same interval in
Settings as retailer checks** (15 minutes by default). Automatic search checks
respect the background-checks toggle. One oldest due search runs per minute tick,
so large lists may check later than the configured interval.
**Check now** retries saved searches as well as existing retailer products, even
when automatic searches are paused. It checks sequentially, so many products may
take time; Google failures appear on the affected product.

- **Desktop:** runs while the app is open or in the tray and the computer is awake.
- **Mobile:** Google checks run **only while the app is open and active**. They are
  not part of iOS/Android background tasks and cannot check while suspended or
  sleeping. Due searches catch up on reopening. Existing direct retailer
  background checks are unchanged.
- An alert is saved in **Notifications** only when a required-text match explicitly
  reports stock/pickup. New such matches and matches returning after a successful
  absence trigger alerts. Uncertain variants/accessories and unknown stock do not.
  Unchanged listings, price changes, and Google tracking-link changes do not
  repeat stock alerts. A temporarily missing stock label on the same match does
  not reset its alert baseline. Device delivery uses existing permission and notification
  Settings; failed delivery stays in the durable queue.
- Failed/blocked searches retain the last successful result and alert baseline,
  show their error/attempt time, and retry when next due. They do not mean no stock.
- Saved searches and their last successful results remain on-device until
  **Remove product**. Alerts remain
  even after deleting a search. Searches are excluded from watchlist backups; alerts
  use the existing backup policy. Devices do not synchronize.

Google offer details now retain visible delivery, pickup, return, and condition
text, plus labeled seller names. Delivery estimates and store opening hours are
not treated as proof of stock. The inspected live layout did not expose reliable
expanded product/seller URLs; the app does not invent or navigate to hidden ones.

After a successful search, automatic retailer verification considers at most
two required-text offers. Supported direct Amazon, Target, and specific Apple
product URLs are fetched through existing bounded public-page readers (15-second
request timeouts; no automatic redirects). This may add up to 30 seconds to a check.
An exposed Google `/url` or `adurl` destination can be checked; opaque ad/goto
tracking links are not clicked or decoded. Best Buy and other unsupported sellers
show an explicit unsupported reason. Verification requires the retailer title to
match every requested phrase and unambiguous product stock metadata. It is not
exact-SKU or local-pickup verification. Google and retailer observations are shown
separately; verification failures do not erase Google observations. A verified
out-of-stock result suppresses a conflicting Google stock alert. The existing
Google-reported-only alert rule remains unchanged for other offers.

Each search has a 30-second timeout. Existing automatic
retailer checks are unchanged. Live Google offer extraction has been verified
after fixing premature cancellation during Google's normal search-page reload.
Controlled rendered-page tests cover interrupted loads, matching, HTTP errors,
and denied redirects. Other live testing encountered unusual-traffic/verification
blocking; a successful search does not guarantee continued access. Google's
layouts and access policies can change. Mobile native rendering and foreground
behavior still require validation on real devices; desktop success does not
guarantee the mobile layout is readable. Blocked, consent, unsupported, and
unreadable pages produce explicit errors—not successful empty-stock results.

| Retailer | Input and requirements |
|---|---|
| Best Buy (legacy entries) | Uses the official product API with a previously configured key. Settings no longer provides key controls; entries without a key report an explicit configuration error. New generalized searches need no key. |
| Amazon | ASIN, HTTPS `amazon.com` URL containing `/dp/ASIN` or `/gp/product/ASIN`, or `https://a.co/d/...` share link. Reads public Schema.org data or exact-ASIN product-page stock/price fields; verification pages fail explicitly. |
| Target | TCIN or HTTPS `target.com/p/.../-/A-TCIN` URL. A `preselect=TCIN` query selects that exact variant instead of the parent TCIN. Requires public stock/offer metadata; dynamic-only pages are unsupported and show an explicit error. |
| Apple shipping | Specific HTTPS `apple.com/shop/product/...` URL publishing usable stock metadata. |
| Apple pickup | A specific `/shop/product/...` URL or fully configured `/shop/buy-.../.../...` URL. Select Apple Store pickup and enter a five-digit US ZIP and a 1–250-mile radius (default **50**). |

Best Buy keys are encrypted with Electron OS credential protection on desktop and
SecureStore on mobile, not written into SQLite or backups. No plaintext fallback is
used if desktop credential encryption is unavailable.

### Compact settings

Notifications and check interval remain immediately accessible. Expand
**Notifications & check timing help** for permission and scheduling guidance, or
**Backups & local data** for export/import actions. Both sections start collapsed
on desktop and mobile. Best Buy key fields and setup dialogs have been removed;
previously stored keys are retained for existing legacy retailer entries.

Tracked product cards show **In Stock**, **Out of Stock**, or **Stock unknown**
from the latest successful observation. Search tags use only required-text
matches: any explicitly available match gives In Stock; all matches must be
explicitly unavailable for Out of Stock. Missing offers do not prove stock absence.
Retailer verification takes precedence over Google stock labels for that offer.
Failed checks mark retained tags **Last known**.

**On Sale** appears only for an explicit sale/discount label on a required-text
matching Google offer; a lower price, target price, or shipping promotion does not
qualify. Expand offers to see the source label. Legacy direct-retailer checks
do not currently collect sale labels, so they show stock tags but no sale tag.
Tags are observational summaries, not guaranteed live inventory or new alert rules.

**Lowest found: $…** shows the lowest Google-listed price among required-text
matches in the latest successful search. It includes unknown/out-of-stock offers,
excludes tax and shipping, and does not imply an all-time low or purchasability.
No price tag appears without a matching listed price; failed checks retain the
last successful price with the **Last known** marker.

Within each product's latest offers, sort Google-listed prices low-to-high or
high-to-low, or retain the original order. Seller-confidence filters offer all
sellers, verified retailer pages, recognized domains/names, or unassessed sellers.
Controls are independent per product and reset when the view unmounts; they do
not alter monitoring, alerts, or summary tags. Invalid/missing prices sort last.

Offers appear under collapsible vendor headings with listing counts. Repeated
seller names (ignoring case/extra spaces) share a group; Apple Education Store
and Apple share **Apple** while each listing keeps its original seller label.
Grouping uses displayed seller names, not proof of site identity. Filters apply
before grouping; the selected price order controls listings within a vendor and
vendor order by each vendor's lowest listed price, lowest vendor first for either
price direction. Original order preserves source ordering. Desktop keeps uncertain matches
in their separate section. All listings remain accessible; none are deduplicated.

Evidence labels are not legitimacy ratings or safety guarantees. A verified
retailer page means the existing product-page verification succeeded. Recognized
domains use an exact list of known retailer/marketplace hosts; a recognized name
on an opaque Google link does not verify its destination. Marketplace recognition
does not establish an individual seller's reliability. Other sellers are
unassessed, not presumed fraudulent. No independent reputation lookup is performed.

Apple pickup resolves the exact offer SKU from the product page, including carrier,
then uses Apple's public-facing fulfillment endpoint. Returned stores are validated,
sorted nearest first, and filtered by their numeric distance (kilometers are
converted to miles; exactly-on-boundary stores are included). Availability means
the exact configuration is pickup-eligible at a returned store inside your radius;
shipping stock is never a fallback. Alerts name newly available stores even while
another store remains available.

ZIP codes are stored locally per product and sent to Apple for pickup queries—not
to a geocoding service. No full street address or GPS is collected. Distances are
from Apple's ZIP-area search, not your house or driving routes. Apple may return a
limited nearest-store list rather than every store in the radius.

**Retailer access remains best-effort.** An Apple accessory shipping check and exact
iPhone configuration resolution were verified live. Apple's pickup endpoint returned
HTTP 541. Amazon has returned verification pages on earlier probes; the supplied
`B0CX18LHWS` product page was fetched and its public HTML checked during this update.
Moving checks onto your device
does not remove blocking. Missing metadata, ambiguous variants, malformed data,
timeouts, and blocked responses remain visible errors. Adapters use fixed HTTPS
hosts, no automatic redirects, bounded responses, and timeouts. Amazon share links
allow one inspected redirect only to a validated Amazon product URL; tracking
parameters are removed before fetching the canonical product. They do not execute remote
JavaScript or bypass access controls. Respect retailer terms, robots policies, and
rate limits; use authorized integrations where public access is insufficient.

The supplied Target MacBook link selects TCIN `91122045` (256GB, Blush), not parent
`95288385`. Its public page was verified to load but lacked price/stock metadata.
Variant selection is supported; successful live availability monitoring for that
page is **not** verified or currently supported. Product eligibility flags and
generic shipping descriptions are not evidence of stock.

## Backups and moving existing data

Each device is independent. There is **no automatic cloud sync**. The app does not
upload its database; operating-system backups are controlled by device settings.
Uninstalling/clearing mobile data or deleting the desktop user-data directory can
remove your watchlist.

Both apps have **Export local backup** and **Import backup / legacy data** in
Settings. Export includes products, up to 1,000 history entries per product, and
the latest 1,000 alerts. The format supports up to 500 products and a 16 MB import
limit. Backups include pickup ZIPs: keep them private. They exclude credentials,
API keys, and device-specific settings.

Import is transactional, keeps entries with already-existing item IDs unchanged,
and does not re-send imported alerts. File export is user-directed; choose a local
destination if you do not want a cloud-backed folder/share target.

Your previous PostgreSQL/Docker data is **not deleted or automatically imported**.
To move the previous watchlist/history/alerts, keep the legacy database running
just for this one-time export:

```sh
npm run build --workspace shared
npm run db:migrate
npm run export:local --workspace backend -- your-account-email inventory-backup.json
```

Import that JSON through Settings on desktop and/or mobile. The exporter uses the
existing backend environment configuration, selects only that account, omits
credentials, and refuses to overwrite an existing output file. Then the old backend
and Docker services can be stopped:

```sh
npm run services:down
```

Do not delete Docker volumes until you have verified the imported data.

## Development and validation

```sh
npm run typecheck
npm run build               # Shared engine + desktop
npm test                   # SQLite/core + legacy retailer/API tests
npm test --workspace desktop # Actual Electron SQLite/IPC smoke test, after build
npm run package --workspace desktop
```

### Desktop installers

```sh
npm run package:mac --workspace desktop # macOS: separate Apple Silicon and Intel DMGs
npm run package:win --workspace desktop # Windows: x64 NSIS setup wizard
```

Installers are written to `desktop/release/` with platform and architecture in
their names. Open the appropriate Mac DMG and drag Inventory Checker to
Applications. On Windows, run the setup executable; it installs for the current
user, offers an installation-directory choice, and creates Start menu/desktop
shortcuts. Uninstalling keeps device-local data. Quit the tray application before
installing an update; do not delete its data directory.

The Mac command creates ad-hoc-signed builds, **not Apple-notarized distribution
builds**. Other Macs may block them with Gatekeeper. Windows builds without a
configured signing certificate are unsigned and may trigger SmartScreen. Do not
disable OS protections; use organization-approved installation procedures.
Trusted public distribution requires Apple Developer signing/notarization and
Windows code-signing credentials supplied securely to electron-builder, never
committed to the repository. Use the generic `package` command with your release
signing configuration instead of the explicitly ad-hoc Mac command.

Build Mac installers on macOS. Windows x64 setup also cross-builds on Apple Silicon
using the configured native-compatible NSIS toolset. Prefer Windows for final
installation/launch testing; other resource-editing/signing configurations may
require Wine when cross-building.
Creating an installer does not verify launch, notifications, or monitoring on a
different operating system; test each installer on its target platform.

The shared package builds automatically for desktop. Metro uses its portable
TypeScript source for mobile. There is no separate lint setup.

Verified for the local-first conversion: SQLite persistence/reopening, atomic
updates/import, polling intervals/wake catch-up, durable alerts, lease exclusion,
retailer regressions, sandboxed Electron IPC, desktop build, both iOS/Android Metro
bundles, and native background configuration. **Physical-device sleep/background
execution and notification delivery still need on-device validation.** Bundling
does not prove that an OS will schedule background work.

`backend/` and Docker Compose remain as optional legacy/export tooling, not client
runtime dependencies. See [ARCHITECTURE.md](./ARCHITECTURE.md) for boundaries.
