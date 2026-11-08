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

## Checks, sleep, and notifications

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
| Best Buy | Numeric SKU or Best Buy product URL. Enter a Best Buy developer API key in the app's Settings. Uses the official product API. |
| Amazon | ASIN, HTTPS `amazon.com` URL containing `/dp/ASIN` or `/gp/product/ASIN`, or `https://a.co/d/...` share link. Reads public Schema.org data or exact-ASIN product-page stock/price fields; verification pages fail explicitly. |
| Target | TCIN or HTTPS `target.com/p/.../-/A-TCIN` URL. A `preselect=TCIN` query selects that exact variant instead of the parent TCIN. Requires public stock/offer metadata; dynamic-only pages are unsupported and show an explicit error. |
| Apple shipping | Specific HTTPS `apple.com/shop/product/...` URL publishing usable stock metadata. |
| Apple pickup | A specific `/shop/product/...` URL or fully configured `/shop/buy-.../.../...` URL. Select Apple Store pickup and enter a five-digit US ZIP and a 1–250-mile radius (default **50**). |

Best Buy keys are encrypted with Electron OS credential protection on desktop and
SecureStore on mobile, not written into SQLite or backups. No plaintext fallback is
used if desktop credential encryption is unavailable.

### Getting a Best Buy API key

Best Buy is currently the only retailer requiring a user-supplied API key.
In either app's Settings, select **How to get a key** beside the key field to open
these instructions in a pop-up. Select **Close** to return to Settings (desktop
also supports Escape; Android supports Back):

1. Open the official [Best Buy developer portal](https://developer.bestbuy.com/)
   in your browser and select **Get API Key**.
2. Sign in to or create a Best Buy account. Follow the developer registration
   prompts and review the API terms.
3. Copy the API key issued by the developer portal into **Settings → Best Buy API
   key**, then choose **Save preferences** on desktop or **Save settings and enable
   notifications** on mobile.

Use the API key, **not your account password**. Do not share it in screenshots,
logs, or support messages. Keys are not transferred by backups; configure each
device separately. If the portal does not issue a key, contact Best Buy developer
support rather than entering another credential. Access is subject to Best Buy's
registration requirements and API limits; see their
[official API documentation](https://bestbuyapis.github.io/api-documentation/#user-guide).
Amazon, Target, and Apple checks do not currently need API keys.

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
