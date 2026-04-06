# Browser Push Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser push notifications for signed-in users so they can receive one daily summary notification even when the page is closed, with the title showing how many foods expire today.

**Architecture:** Use a service worker plus the Push API on the client, store per-user push subscriptions in D1, and run a Cloudflare Worker cron job once per day to compute reminder candidates from each user's foods and settings. Build one summary notification per user per local day, deduplicate sends with a delivery log table, and include the required expired-today count in the notification title.

**Tech Stack:** Cloudflare Workers, D1, Web Push, Service Worker, browser Notifications API, existing vanilla JS frontend

---

## File Structure

- Modify: `schema.sql`
  - Add `push_subscriptions` and `notification_deliveries` tables plus indexes.
- Modify: `wrangler.jsonc`
  - Add cron trigger and VAPID environment variable placeholders.
- Modify: `src/worker.mjs`
  - Add push subscription APIs, scheduled handler, reminder aggregation, send dedupe, VAPID signing, and Web Push delivery.
- Modify: `uiData.js`
  - Add client API helpers for notification status, subscribe, unsubscribe, and public VAPID key fetch.
- Modify: `setting.js`
  - Add browser notification settings section for logged-in users, permission state, and device subscription actions.
- Modify: `ui.js`
  - Add notification permission/subscription state, service worker registration, subscribe/unsubscribe flows, and settings event handling.
- Create: `public/sw.js`
  - Service worker that receives push events and shows notifications.
- Modify: `scripts/sync-public.mjs`
  - Copy `sw.js` into `public`.
- Modify: `README.md`
  - Document setup, VAPID secrets, cron behavior, and browser limitations.
- Modify: `SUPPORT.md`
  - Add user-facing notification troubleshooting guidance.

## Task 1: Add D1 persistence for subscriptions and send dedupe

**Files:**
- Modify: `schema.sql`
- Test: manual SQL verification via Wrangler D1

- [ ] **Step 1: Write the failing schema expectation**

Add these definitions to `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  email TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  subscription_json TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (email, endpoint),
  FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_email
  ON push_subscriptions(email);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  email TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  PRIMARY KEY (email, delivery_date, notification_type),
  FOREIGN KEY (email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_email_date
  ON notification_deliveries(email, delivery_date DESC);
```

- [ ] **Step 2: Run migration locally**

Run: `npm run db:migrate:local`

Expected: Wrangler reports successful execution with no SQL errors.

- [ ] **Step 3: Verify tables exist**

Run: `npx wrangler d1 execute DB --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('push_subscriptions','notification_deliveries');"`

Expected output contains both table names.

- [ ] **Step 4: Commit**

```bash
git add schema.sql
git commit -m "feat: add push notification persistence tables"
```

## Task 2: Expose push subscription APIs in the Worker

**Files:**
- Modify: `src/worker.mjs`
- Test: manual `curl` against local worker after implementation

- [ ] **Step 1: Write the failing route list**

Add API routes for authenticated users only:

```js
if (pathname === "/api/notifications/public-key" && request.method === "GET") {
  return jsonResponse({ publicKey: env.VAPID_PUBLIC_KEY || "" }, 200, context.cookies);
}

if (pathname === "/api/notifications/subscription" && request.method === "GET") {
  return jsonResponse(await getPushSubscriptionStatus(env, context.session), 200, context.cookies);
}

if (pathname === "/api/notifications/subscription" && request.method === "POST") {
  const body = await readBody(request);
  const saved = await savePushSubscription(env, context.session, body, request.headers.get("user-agent") || "");
  return jsonResponse(saved, 201, context.cookies);
}

if (pathname === "/api/notifications/subscription" && request.method === "DELETE") {
  const body = await readBody(request);
  await deletePushSubscription(env, context.session, body?.endpoint || "");
  return jsonResponse({ success: true }, 200, context.cookies);
}
```

- [ ] **Step 2: Run local request to verify it fails before implementation**

Run: `npm run dev`

Then in another terminal:

Run: `curl -i http://127.0.0.1:8787/api/notifications/public-key`

Expected: `404` before route implementation.

- [ ] **Step 3: Implement minimal auth gate and helpers**

Add these helper signatures in `src/worker.mjs`:

```js
function requireAuthenticatedSession(session) {
  if (!session?.email) {
    const error = new Error("Sign in to enable browser notifications.");
    error.status = 401;
    throw error;
  }
  return session;
}

async function getPushSubscriptionStatus(env, session) {}
async function savePushSubscription(env, session, subscription, userAgent) {}
async function deletePushSubscription(env, session, endpoint) {}
function validatePushSubscription(subscription) {}
```

Implementation requirements:
- `GET` returns `{ supported: true, subscribed: boolean, endpoint: string | null }`
- `POST` upserts by `(email, endpoint)`
- `DELETE` removes only the current user's endpoint
- malformed subscription payload returns `400`
- unauthenticated access returns `401`

- [ ] **Step 4: Make Worker respect explicit error statuses**

Update top-level error handling so route helpers can throw status-aware errors:

```js
function getErrorStatus(error) {
  return Number.isInteger(error?.status) ? error.status : 500;
}
```

Use it in the `fetch` handler instead of always returning `500`.

- [ ] **Step 5: Run local smoke tests**

Run:

```bash
curl -i http://127.0.0.1:8787/api/notifications/public-key
curl -i http://127.0.0.1:8787/api/notifications/subscription
```

Expected:
- first returns `200` with `publicKey`
- second returns `401` when not logged in

- [ ] **Step 6: Commit**

```bash
git add src/worker.mjs
git commit -m "feat: add push subscription worker APIs"
```

## Task 3: Add client API helpers for notification management

**Files:**
- Modify: `uiData.js`
- Test: manual browser console or integration through settings screen

- [ ] **Step 1: Write the failing helper list**

Add these exports to `window.FreshTrackerData`:

```js
function fetchNotificationPublicKey() {
  return request("/api/notifications/public-key");
}

function fetchNotificationSubscription() {
  return request("/api/notifications/subscription");
}

function createNotificationSubscription(subscription) {
  return request("/api/notifications/subscription", {
    method: "POST",
    body: JSON.stringify(subscription)
  });
}

function deleteNotificationSubscription(endpoint) {
  return request("/api/notifications/subscription", {
    method: "DELETE",
    body: JSON.stringify({ endpoint })
  });
}
```

- [ ] **Step 2: Run a browser smoke check before wiring UI**

Open the app, then in DevTools console run:

```js
typeof window.FreshTrackerData.fetchNotificationPublicKey
```

Expected before implementation: `"undefined"`

- [ ] **Step 3: Implement and export the helpers**

Follow existing `request(...)` patterns in `uiData.js`. Do not add special fetch wrappers.

- [ ] **Step 4: Re-run console check**

Expected after implementation: `"function"`

- [ ] **Step 5: Commit**

```bash
git add uiData.js
git commit -m "feat: add notification client API helpers"
```

## Task 4: Add and register the service worker

**Files:**
- Create: `sw.js`
- Modify: `scripts/sync-public.mjs`
- Test: browser Application tab / service worker registration state

- [ ] **Step 1: Write the failing browser expectation**

After loading the app, this should currently fail:

```js
navigator.serviceWorker.getRegistration()
```

Expected before implementation: `undefined` registration for `/sw.js`.

- [ ] **Step 2: Create the minimal service worker**

Create `sw.js` with:

```js
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || "Freshness Above All!";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data || { url: "/" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(targetUrl));
});
```

If icons do not exist yet, temporarily omit `icon` and `badge` rather than referencing broken assets.

- [ ] **Step 3: Sync the file into `public/`**

Add `"sw.js"` to the `files` array in `scripts/sync-public.mjs`.

- [ ] **Step 4: Register the service worker from app code**

Add a small helper in `ui.js`:

```js
async function ensureServiceWorkerRegistered() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  return navigator.serviceWorker.register("./sw.js");
}
```

Call it once during app init after the first render.

- [ ] **Step 5: Verify registration**

Run app locally, then in DevTools console:

```js
const reg = await navigator.serviceWorker.getRegistration();
Boolean(reg)
```

Expected: `true`

- [ ] **Step 6: Commit**

```bash
git add sw.js scripts/sync-public.mjs ui.js
git commit -m "feat: add service worker registration for push notifications"
```

## Task 5: Add notification permission and subscription state to the settings UI

**Files:**
- Modify: `setting.js`
- Modify: `ui.js`
- Test: manual browser interaction in Settings

- [ ] **Step 1: Write the failing UI expectation**

Add a new settings section under reminder settings for signed-in users with:
- permission status text
- subscribe button when notifications are off
- unsubscribe button when this device is subscribed
- logged-out helper text instead of controls

Expected before implementation: no browser notification controls visible in Settings.

- [ ] **Step 2: Add state fields**

Extend `state` in `ui.js` with:

```js
notificationSupport: false,
notificationPermission: "default",
notificationSubscription: null,
notificationLoading: false,
notificationError: ""
```

- [ ] **Step 3: Render the settings section**

In `setting.js`, add a new block that reads these values from `state`:

```js
state.notificationSupport
state.notificationPermission
Boolean(state.notificationSubscription)
state.notificationLoading
state.notificationError
```

Render copy rules:
- logged out: `Sign in to receive browser reminders on this device.`
- unsupported browser: `This browser does not support push notifications.`
- permission default: show `Enable Notifications`
- permission denied: show `Notifications are blocked in your browser settings.`
- subscribed: show `Notifications enabled on this device`

- [ ] **Step 4: Implement subscribe / unsubscribe flows**

Add helpers in `ui.js`:

```js
function getNotificationPermissionState() {
  return "Notification" in window ? Notification.permission : "unsupported";
}

async function refreshNotificationState() {}
async function subscribeCurrentDeviceToNotifications() {}
async function unsubscribeCurrentDeviceFromNotifications() {}
function urlBase64ToUint8Array(value) {}
```

Implementation requirements:
- only allow subscribe when logged in
- call `Notification.requestPermission()`
- fetch VAPID public key from `/api/notifications/public-key`
- use `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
- POST subscription JSON to Worker
- on unsubscribe, call both `PushSubscription.unsubscribe()` and API delete

- [ ] **Step 5: Wire button clicks**

Add click handlers in `ui.js` for:
- `#enable-browser-notifications`
- `#disable-browser-notifications`
- `#retry-browser-notifications`

- [ ] **Step 6: Verify in browser**

Manual verification:
1. Sign in
2. Open Settings
3. Click enable
4. Accept permission prompt
5. Confirm UI shows subscribed state
6. Reload app and confirm subscribed state persists

- [ ] **Step 7: Commit**

```bash
git add setting.js ui.js
git commit -m "feat: add browser notification controls to settings"
```

## Task 6: Implement reminder selection and daily summary payload generation

**Files:**
- Modify: `src/worker.mjs`
- Test: targeted local invocation helper route or temporary console logs

- [ ] **Step 1: Write the failing helper contract**

Add pure helper signatures:

```js
function getLocalDateKey(date = new Date()) {}
function parseFoodPayload(row) {}
function diffInDaysFromDate(expiryDate, now) {}
function getReminderOffsets(strategy) {}
function buildDailyReminderSummary(items, strategy, now) {}
```

Behavior contract:
- returns `null` when nothing should be sent today
- summary always includes `expiredTodayCount`
- summary also includes a short list of item names for the body

- [ ] **Step 2: Add reminder strategy mapping**

Implement exact strategy offsets:

```js
const REMINDER_RULES = {
  light: { before: [7, 1, 0], overdue: [] },
  standard: { before: [7, 3, 1, 0], overdue: [-1, -3] },
  high: { before: [7, 6, 5, 4, 3, 2, 1, 0], overdue: [-1, -2, -3, -5] }
};
```

Use `daysUntil` where:
- `7` means expires in 7 days
- `0` means expires today
- `-1` means expired yesterday

- [ ] **Step 3: Build the summary payload**

Payload shape:

```js
{
  title: "Today 3 foods expire",
  body: "Milk, spinach, yogurt and 2 more need attention.",
  data: {
    url: "/",
    expiredTodayCount: 3,
    expiringSoonCount: 4,
    overdueCount: 1
  }
}
```

Body rules:
- prefer up to 3 names
- if only overdue items match, mention overdue cleanup
- if both soon and overdue exist, keep body to one sentence
- title must prioritize `expiredTodayCount`

- [ ] **Step 4: Add a temporary debug route for local verification**

Add a development-only route shape in `src/worker.mjs`:

```js
if (pathname === "/api/debug/notification-preview" && request.method === "GET") {
  // signed-in users only
}
```

Return the computed payload without sending push.

- [ ] **Step 5: Verify with real food rows**

Run local worker, sign in, seed foods with varied expiry dates, then:

Run: `curl -i http://127.0.0.1:8787/api/debug/notification-preview`

Expected: JSON payload showing the correct title and counts for the signed-in user.

- [ ] **Step 6: Commit**

```bash
git add src/worker.mjs
git commit -m "feat: add reminder summary generation for push notifications"
```

## Task 7: Add web push delivery and scheduled cron execution

**Files:**
- Modify: `src/worker.mjs`
- Modify: `wrangler.jsonc`
- Test: manual local invocation for payload generation plus deployed smoke test for actual push

- [ ] **Step 1: Write the failing deployment expectation**

Before implementation:
- Worker has no `scheduled()` handler
- `wrangler.jsonc` has no cron trigger
- no push messages can be sent

- [ ] **Step 2: Add cron config**

Update `wrangler.jsonc` with one daily cron trigger, for example:

```json
"triggers": {
  "crons": ["0 16 * * *"]
}
```

Use UTC in config and document the user-facing timezone assumption in `README.md`.

- [ ] **Step 3: Add scheduled entrypoint**

Extend default export:

```js
export default {
  async fetch(request, env) { ... },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(processScheduledNotifications(env, new Date(controller.scheduledTime)));
  }
};
```

- [ ] **Step 4: Implement sender pipeline**

Add helpers:

```js
async function processScheduledNotifications(env, now) {}
async function listUsersWithPushSubscriptions(env) {}
async function listFoodsForEmail(env, email) {}
async function listPushSubscriptionsForEmail(env, email) {}
async function hasNotificationAlreadyBeenSent(env, email, dateKey, type) {}
async function recordNotificationDelivery(env, email, dateKey, type, payload) {}
async function sendWebPushToSubscription(env, subscription, payload) {}
function createVapidAuthorizationHeader(audience, subject, publicKey, privateKey) {}
```

Rules:
- send at most one `daily-summary` notification per user per `delivery_date`
- if all subscriptions for a user fail with `404` or `410`, delete them
- continue processing other users if one send fails

- [ ] **Step 5: Validate environment requirements**

Require these Worker environment values:

```txt
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

If any are missing during scheduled execution, log and skip push sending rather than crashing the whole job.

- [ ] **Step 6: Smoke-test payload generation locally**

Local development cannot reliably deliver real push to browser endpoints without real secrets and deployment, so verify:
- scheduled handler calls summary generation
- dedupe records are written only once
- debug route still matches scheduled payload

- [ ] **Step 7: Deploy and verify one real subscription**

Run:

```bash
npm run deploy
```

Then:
1. Open deployed site
2. Sign in
3. Enable notifications
4. Seed one item expiring today
5. Trigger cron manually if available in dashboard, or temporarily call the same processing helper from a debug route
6. Confirm browser receives one push notification

- [ ] **Step 8: Commit**

```bash
git add src/worker.mjs wrangler.jsonc
git commit -m "feat: add scheduled web push reminder delivery"
```

## Task 8: Document setup and troubleshooting

**Files:**
- Modify: `README.md`
- Modify: `SUPPORT.md`

- [ ] **Step 1: Add README setup section**

Document:
- browser push architecture
- required VAPID keys
- how to set Worker secrets
- cron schedule
- logged-in-only limitation
- one-summary-per-day behavior

- [ ] **Step 2: Add support FAQ**

Add troubleshooting entries for:
- permission denied
- notifications enabled on one device only
- iOS/browser support caveats
- why a user may not receive a push every day

- [ ] **Step 3: Verify docs mention the exact user-visible behavior**

Required phrasing to preserve:
- notifications are available only for signed-in users
- title includes how many foods expire today
- reminder strategy affects which items are included in the daily summary

- [ ] **Step 4: Commit**

```bash
git add README.md SUPPORT.md
git commit -m "docs: add browser push notification setup and support notes"
```

## Self-Review

- Spec coverage:
  - signed-in users only: covered in Tasks 2 and 5
  - browser push when page is closed: covered in Tasks 4 and 7
  - one summary notification per day: covered in Tasks 6 and 7
  - title shows how many foods expire today: covered in Task 6
  - reminder strategy changes included items: covered in Task 6
- Placeholder scan:
  - no `TODO` or `TBD` placeholders remain
  - all routes, helper names, tables, and payload shapes are explicit
- Type consistency:
  - subscription API path is consistently `/api/notifications/subscription`
  - daily notification type is consistently `daily-summary`
  - settings field remains `reminderStrategy`

Plan complete and saved to `docs/superpowers/plans/2026-04-05-browser-push-reminders.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
