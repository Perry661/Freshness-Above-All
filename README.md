# Freshness Above All!

"Freshness Above All!" is a food expiration tracker for managing household food inventory, monitoring expiry dates, and reducing food waste.

The app includes a dashboard, an all-food inventory view, add/edit flows, a trash system with restore support, settings persistence, and food detail sheets. The current deployment target is Cloudflare Workers with D1 for persistence.

## Current Features

- Dashboard with expiration summary cards and recent items
- All Food inventory page with search, filter chips, sorting, batch selection, and cleanup
- Add Food flow with quick category selection, barcode scan entry, and optional size/icon fields
- Edit Food flow with current settings highlighted
- Food detail bottom sheet from the All Food page
- Cleanup flow with deletion reason and optional notes
- Trash page with restore support and deleted-item detail view
- Settings page with reminder strategy, theme, and trash retention controls
- Browser push notification opt-in for signed-in users on the current device
- Barcode lookup via Open Food Facts for unknown products
- Settings persistence via Cloudflare D1
- Cloud-backed data persistence for foods, trash, and lightweight auth session state

## Tech Stack

- Vanilla JavaScript
- Tailwind CSS via CDN
- Cloudflare Workers
- Cloudflare D1

## Cloudflare Setup

1. Create a D1 database:

```bash
npx wrangler d1 create freshness-above-all
```

2. Copy the returned `database_id` into [`wrangler.jsonc`](/Users/dongperry/code/Freshness-Above-All/wrangler.jsonc).

3. Apply the schema:

```bash
npm run db:migrate:remote
```

4. If you already deployed the older single-tenant schema, migrate it to owner-scoped storage first:

```bash
npm run db:migrate-owner-scope:remote
```

5. Optional: export your existing local JSON data into a seed file:

```bash
npm run db:seed:export
npx wrangler d1 execute DB --remote --file=seed.sql
```

6. Deploy:

```bash
npm run deploy
```

7. Configure browser push secrets and preview flag:

```bash
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_SUBJECT
```

Optional local/debug preview flag:

```bash
npx wrangler secret put ALLOW_DEBUG_NOTIFICATION_PREVIEW
```



## Local Development

1. Apply the schema to the local D1 database:

```bash
npm run db:migrate:local
```

2. Start the worker locally:

```bash
npm run dev
```

3. `npm run dev` will refresh `public/` first, then start Wrangler.
4. Open the local URL printed by Wrangler.

## Camera Access For Barcode Scan

Barcode scanning only works when the app is opened through the Worker URL in a browser.

1. Start the app:

```bash
npm run dev
```

2. Open the local Worker URL printed by Wrangler

3. Open `Add Food`
4. Choose `Scan Barcode`
5. Click `Start Scan`
6. When the browser asks for camera access, choose `Allow`

### Important Notes

- Do not open the app with `file://.../index.html` if you want camera access
- Your browser must support `getUserMedia` and `BarcodeDetector`
- Barcode scan is currently best supported in Chrome / Edge
- Safari can still use photo capture and manual barcode entry, but web barcode scanning may not start because Safari does not reliably support `BarcodeDetector`
- Your computer must be online if you want scanned barcodes to query Open Food Facts

### macOS Permission Check

If the camera does not open, check:

- Browser permission:
  - Chrome / Edge: click the camera icon in the address bar and allow camera access
  - Safari: `Safari -> Settings for This Website -> Camera -> Allow`
- System permission:
  - `System Settings -> Privacy & Security -> Camera`
  - Make sure your browser is allowed to use the camera

### What To Expect

- If camera permission is granted, the scan panel will start the camera preview
- In Safari, camera permission alone may not be enough for barcode scan because the current web implementation also depends on `BarcodeDetector`
- If a barcode is detected, the app stores the barcode and tries to auto-fill food info
- If the barcode already exists in your local data, the app reuses the existing item details
- If the barcode is new, the app queries Open Food Facts
- If Open Food Facts has no result, the barcode is still kept and you can complete the rest manually

## Project Structure

- [`index.html`](/Users/dongperry/code/Freshness-Above-All/index.html): app shell, global styles, script loading
- [`ui.js`](/Users/dongperry/code/Freshness-Above-All/ui.js): main app state, view switching, event handling
- [`uiData.js`](/Users/dongperry/code/Freshness-Above-All/uiData.js): request helpers, food/date utilities
- [`add.js`](/Users/dongperry/code/Freshness-Above-All/add.js): add/edit food UI helpers
- [`scan.js`](/Users/dongperry/code/Freshness-Above-All/scan.js): barcode scan controller
- [`setting.js`](/Users/dongperry/code/Freshness-Above-All/setting.js): settings UI and settings helpers
- [`trash.js`](/Users/dongperry/code/Freshness-Above-All/trash.js): trash UI, cleanup flow, trash detail helpers
- [`src/worker.mjs`](/Users/dongperry/code/Freshness-Above-All/src/worker.mjs): Cloudflare Worker API and static asset entrypoint
- [`schema.sql`](/Users/dongperry/code/Freshness-Above-All/schema.sql): D1 schema for foods, trash, app state, users, and sessions
- [`public/index.html`](/Users/dongperry/code/Freshness-Above-All/public/index.html): static app shell served by Cloudflare assets
- [`scripts/export-seed.mjs`](/Users/dongperry/code/Freshness-Above-All/scripts/export-seed.mjs): exports local JSON files into `seed.sql`

## Data Persistence

The deployed app stores data in Cloudflare D1.

- `foods` table stores active inventory items
- `trash_items` table stores deleted items waiting for permanent removal
- `app_state` stores settings and add-settings payloads
- `users` and `sessions` support the lightweight email-only auth flow
- `push_subscriptions` stores per-user browser push endpoints
- `notification_deliveries` stores daily notification send records for dedupe

## Interaction Highlights

- Delete an item -> choose a cleanup reason -> move it to Trash
- Restore an item from Trash back into the main inventory
- Open food details by clicking the item icon or title in All Food
- Save settings permanently through D1
- Enable browser notifications from Settings when signed in
- Use batch cleanup from the All Food inventory page

## Known Limitations

- Auth is still email-only and intentionally lightweight
- Data model is still single-tenant and not scoped per account
- No real image upload pipeline yet
- Browser push notifications are signed-in only and device-specific
- Daily reminder summaries are scheduled once per day and the title always reflects how many foods expire today
- Cron timing is configured in UTC in [`wrangler.jsonc`](/Users/dongperry/code/Freshness-Above-All/wrangler.jsonc); if you need user-local send times, add timezone-aware scheduling later
- Sound effects are planned but not implemented yet
- Barcode scanning depends on browser support for `BarcodeDetector`, so Safari may require manual entry even when camera access works
- Open Food Facts lookup depends on network availability and third-party data coverage

## Planned Improvements

- Sound effects for add, delete, and detail interactions
- Richer food metadata and storage locations
- More complete trash batch actions
- Better filtering and inventory analytics
- Improved mobile polish and animation
