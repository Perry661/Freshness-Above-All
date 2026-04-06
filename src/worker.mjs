const DEFAULT_SETTINGS = {
  trashAutoDeleteDays: 7,
  reminderStrategy: "standard",
  theme: "light",
  soundVolume: 100
};

const DEFAULT_ADD_SETTINGS = {
  allFoodSort: "expiry_asc",
  allFoodFilter: "all",
  allFoodCategoryFilter: "all",
  allFoodIconFilter: "all"
};

const SESSION_COOKIE = "freshtracker_session";
const GUEST_COOKIE = "freshtracker_guest";
const LEGACY_OWNER = { type: "guest", id: "legacy-import" };
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_SUMMARY_NOTIFICATION_TYPE = "daily-summary";
const DAILY_SUMMARY_URL = "/";
const WEB_PUSH_RECORD_SIZE = 4096;
const WEB_PUSH_TTL_SECONDS = 60 * 60;
const REMINDER_RULES = {
  light: { before: [7, 1, 0], overdue: [] },
  standard: { before: [7, 3, 1, 0], overdue: [-1, -3] },
  high: { before: [7, 6, 5, 4, 3, 2, 1, 0], overdue: [-1, -2, -3, -5] }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env, url);
      }

      return env.ASSETS.fetch(request);
    } catch (error) {
      return jsonResponse(
        { error: error?.message || "Internal server error" },
        getErrorStatus(error)
      );
    }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      processScheduledNotifications(
        env,
        new Date(controller?.scheduledTime || Date.now())
      ).catch((error) => {
        console.error("Scheduled notification processing failed", error);
      })
    );
  }
};

async function handleApi(request, env, url) {
  const { pathname } = url;
  const context = await buildRequestContext(request, env);
  const owner = context.owner;

  if (pathname === "/api/settings" && request.method === "GET") {
    return jsonResponse(await readState(env, owner, "settings", DEFAULT_SETTINGS), 200, context.cookies);
  }

  if (pathname === "/api/settings" && request.method === "PUT") {
    const settings = validateSettings(await readBody(request));
    await writeState(env, owner, "settings", settings);
    return jsonResponse(settings, 200, context.cookies);
  }

  if (pathname === "/api/settings" && request.method === "DELETE") {
    await writeState(env, owner, "settings", DEFAULT_SETTINGS);
    return jsonResponse(DEFAULT_SETTINGS, 200, context.cookies);
  }

  if (pathname === "/api/add-settings" && request.method === "GET") {
    return jsonResponse(await readState(env, owner, "add-settings", DEFAULT_ADD_SETTINGS), 200, context.cookies);
  }

  if (pathname === "/api/add-settings" && request.method === "PUT") {
    const settings = validateAddSettings(await readBody(request));
    await writeState(env, owner, "add-settings", settings);
    return jsonResponse(settings, 200, context.cookies);
  }

  if (pathname === "/api/add-settings" && request.method === "DELETE") {
    await writeState(env, owner, "add-settings", DEFAULT_ADD_SETTINGS);
    return jsonResponse(DEFAULT_ADD_SETTINGS, 200, context.cookies);
  }

  if (pathname === "/api/foods" && request.method === "GET") {
    return jsonResponse(await readCollection(env, "foods", owner), 200, context.cookies);
  }

  if (pathname === "/api/foods" && request.method === "POST") {
    const item = await readBody(request);
    validateFood(item);
    await insertCollectionItem(env, "foods", owner, item, item.createdAt);
    return jsonResponse(item, 201, context.cookies);
  }

  if (pathname.startsWith("/api/foods/")) {
    const id = decodeURIComponent(pathname.split("/").pop() || "");
    if (!id) {
      return jsonResponse({ error: "Food item not found" }, 404, context.cookies);
    }

    if (request.method === "PUT") {
      const item = await readBody(request);
      validateFood(item);
      const updated = await updateCollectionItem(env, "foods", owner, id, item, item.createdAt);
      if (!updated) {
        return jsonResponse({ error: "Food item not found" }, 404, context.cookies);
      }
      return jsonResponse(item, 200, context.cookies);
    }

    if (request.method === "DELETE") {
      const removed = await deleteCollectionItem(env, "foods", owner, id);
      if (!removed) {
        return jsonResponse({ error: "Food item not found" }, 404, context.cookies);
      }
      return jsonResponse(removed, 200, context.cookies);
    }
  }

  if (pathname === "/api/trash" && request.method === "GET") {
    return jsonResponse(await getActiveTrashItems(env, owner), 200, context.cookies);
  }

  if (pathname === "/api/trash" && request.method === "POST") {
    const item = await readBody(request);
    validateTrashItem(item);
    await insertCollectionItem(env, "trash_items", owner, item, item.deletedAt);
    return jsonResponse(item, 201, context.cookies);
  }

  if (pathname === "/api/trash" && request.method === "DELETE") {
    await env.DB.prepare(
      "DELETE FROM trash_items WHERE owner_type = ? AND owner_id = ?"
    ).bind(owner.type, owner.id).run();
    return jsonResponse({ success: true }, 200, context.cookies);
  }

  if (pathname.startsWith("/api/trash/")) {
    const id = decodeURIComponent(pathname.split("/").pop() || "");
    if (!id) {
      return jsonResponse({ error: "Trash item not found" }, 404, context.cookies);
    }

    if (request.method === "DELETE") {
      const removed = await deleteCollectionItem(env, "trash_items", owner, id);
      if (!removed) {
        return jsonResponse({ error: "Trash item not found" }, 404, context.cookies);
      }
      return jsonResponse(removed, 200, context.cookies);
    }
  }

  if (pathname.startsWith("/api/barcode/") && request.method === "GET") {
    const code = decodeURIComponent(pathname.split("/").pop() || "").trim();
    if (!code) {
      return jsonResponse({ error: "Barcode is required" }, 400, context.cookies);
    }

    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
      {
        headers: {
          "User-Agent": "FreshnessAboveAll/1.0 (Open Food Facts lookup)",
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      return jsonResponse({ error: `Barcode lookup failed: ${response.status}` }, 502, context.cookies);
    }

    return jsonResponse(mapOpenFoodFactsProduct(code, await response.json()), 200, context.cookies);
  }

  if (pathname === "/api/product-search" && request.method === "GET") {
    const query = String(url.searchParams.get("q") || "").trim();
    if (!query) {
      return jsonResponse({ error: "Search query is required" }, 400, context.cookies);
    }

    const response = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`,
      {
        headers: {
          "User-Agent": "FreshnessAboveAll/1.0 (Open Food Facts lookup)",
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      return jsonResponse({ error: `Product search failed: ${response.status}` }, 502, context.cookies);
    }

    return jsonResponse(
      mapOpenFoodFactsSearchResults(query, await response.json()),
      200,
      context.cookies
    );
  }

  if (pathname === "/api/auth/session" && request.method === "GET") {
    return jsonResponse(await getAuthSession(request, env), 200, context.cookies);
  }

  if (pathname === "/api/notifications/public-key" && request.method === "GET") {
    return jsonResponse({ publicKey: getVapidPublicKey(env) }, 200, context.cookies);
  }

  if (pathname === "/api/notifications/subscription" && request.method === "GET") {
    return jsonResponse(
      await getPushSubscriptionStatus(
        env,
        requireAuthenticatedSession(context.session),
        context.deviceId
      ),
      200,
      context.cookies
    );
  }

  if (pathname === "/api/notifications/subscription" && request.method === "POST") {
    const body = await readBody(request);
    const saved = await savePushSubscription(
      env,
      requireAuthenticatedSession(context.session),
      context.deviceId,
      body,
      request.headers.get("user-agent") || ""
    );
    return jsonResponse(saved, 201, context.cookies);
  }

  if (pathname === "/api/notifications/subscription" && request.method === "DELETE") {
    const body = await readBody(request);
    await deletePushSubscription(
      env,
      requireAuthenticatedSession(context.session),
      context.deviceId,
      body?.endpoint || ""
    );
    return jsonResponse({ success: true }, 200, context.cookies);
  }

  if (
    pathname === "/api/debug/notification-preview" &&
    request.method === "GET" &&
    isDebugNotificationPreviewEnabled(env)
  ) {
    const session = requireAuthenticatedSession(context.session);
    const previewAt = url.searchParams.get("at");
    const now = previewAt ? parseDebugDate(previewAt) : new Date();
    const email = normalizeEmail(session.email);
    const payload = await buildDailySummaryPayloadForEmail(env, email, now);
    const settings = await readState(env, { type: "user", id: email }, "settings", DEFAULT_SETTINGS);
    return jsonResponse(
      {
        dateKey: getLocalDateKey(now),
        reminderStrategy: normalizeReminderStrategy(settings?.reminderStrategy),
        payload
      },
      200,
      context.cookies
    );
  }

  if (
    pathname === "/api/debug/notification-send-now" &&
    (request.method === "POST" || request.method === "GET") &&
    isDebugNotificationPreviewEnabled(env)
  ) {
    const session = requireAuthenticatedSession(context.session);
    const email = normalizeEmail(session.email);
    const payload = await buildDailySummaryPayloadForEmail(env, email, new Date());

    if (!payload) {
      return jsonResponse(
        { success: false, error: "No reminder payload is available for this account today." },
        200,
        context.cookies
      );
    }

    const subscriptions = await listPushSubscriptionsForEmail(env, email);
    if (!subscriptions.length) {
      return jsonResponse(
        { success: false, error: "No active push subscription is registered for this account." },
        200,
        context.cookies
      );
    }

    let sentCount = 0;

    for (const subscription of subscriptions) {
      try {
        await sendWebPushToSubscription(env, subscription, payload);
        sentCount += 1;
      } catch (error) {
        if (error?.code === "INVALID_SUBSCRIPTION") {
          await deletePushSubscriptionByEndpoint(env, email, subscription.endpoint);
          continue;
        }

        throw error;
      }
    }

    return jsonResponse(
      {
        success: sentCount > 0,
        sentCount,
        payload
      },
      200,
      context.cookies
    );
  }

  if (pathname === "/api/auth/register" && request.method === "POST") {
    const email = validateAuthPayload(await readBody(request));
    const existing = await env.DB.prepare(
      "SELECT email FROM users WHERE email = ?"
    ).bind(email).first();

    if (existing) {
      return jsonResponse(
        { error: "This email is already registered. Please log in instead." },
        409,
        context.cookies
      );
    }

    const createdAt = new Date().toISOString();
    const name = getDisplayNameFromEmail(email);
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO users (email, name, created_at) VALUES (?, ?, ?)"
      ).bind(email, name, createdAt)
    ]);

    const nextGuestId = crypto.randomUUID();
    await claimGuestDataForNewUser(env, owner, email);
    const sessionId = await createSession(env, email);
    return jsonResponse(
      { authenticated: true, user: { email, name } },
      201,
      [...context.cookies, buildSessionCookie(sessionId), buildGuestCookie(nextGuestId)]
    );
  }

  if (pathname === "/api/auth/login" && request.method === "POST") {
    const email = validateAuthPayload(await readBody(request));
    const user = await env.DB.prepare(
      "SELECT email, name FROM users WHERE email = ?"
    ).bind(email).first();

    if (!user) {
      return jsonResponse(
        { error: "No account found for that email. Sign up first." },
        404,
        context.cookies
      );
    }

    const nextGuestId = crypto.randomUUID();
    await copyOwnerData(env, LEGACY_OWNER, { type: "user", id: email });
    const sessionId = await createSession(env, email);
    return jsonResponse(
      {
        authenticated: true,
        user: {
          email,
          name: String(user.name || getDisplayNameFromEmail(email)).trim()
        }
      },
      200,
      [...context.cookies, buildSessionCookie(sessionId), buildGuestCookie(nextGuestId)]
    );
  }


  if (pathname === "/api/auth/logout" && request.method === "POST") {
    await destroyCurrentSession(request, env);
    return jsonResponse(
      { authenticated: false, user: null },
      200,
      [...context.cookies, clearSessionCookie()]
    );
  }

  if (pathname === "/api/auth/account" && request.method === "DELETE") {
    const session = await getCurrentSession(request, env);
    if (!session) {
      return jsonResponse({ error: "No signed-in account to delete." }, 404, context.cookies);
    }

    await env.DB.batch([
      env.DB.prepare("DELETE FROM foods WHERE owner_type = 'user' AND owner_id = ?").bind(session.email),
      env.DB.prepare("DELETE FROM trash_items WHERE owner_type = 'user' AND owner_id = ?").bind(session.email),
      env.DB.prepare("DELETE FROM app_state WHERE owner_type = 'user' AND owner_id = ?").bind(session.email),
      env.DB.prepare("DELETE FROM sessions WHERE email = ?").bind(session.email),
      env.DB.prepare("DELETE FROM users WHERE email = ?").bind(session.email)
    ]);

    return jsonResponse(
      { authenticated: false, user: null },
      200,
      [...context.cookies, clearSessionCookie()]
    );
  }

  return jsonResponse({ error: "API route not found" }, 404, context.cookies);
}

function jsonResponse(data, status = 200, cookies = []) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8"
  });
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }

  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers
  });
}

function getErrorStatus(error) {
  return Number.isInteger(error?.status) ? error.status : 500;
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    throw error;
  }
}

async function readCollection(env, tableName, owner) {
  const { results } = await env.DB.prepare(
    `SELECT payload FROM ${tableName}
     WHERE owner_type = ? AND owner_id = ?
     ORDER BY created_at DESC, rowid DESC`
  ).bind(owner.type, owner.id).all();

  return (results || []).map((row) => JSON.parse(row.payload));
}

async function insertCollectionItem(env, tableName, owner, item, createdAt) {
  await env.DB.prepare(
    `INSERT INTO ${tableName} (owner_type, owner_id, id, created_at, payload) VALUES (?, ?, ?, ?, ?)`
  ).bind(owner.type, owner.id, item.id, String(createdAt || item.createdAt || item.deletedAt || new Date().toISOString()), JSON.stringify(item)).run();
}

async function updateCollectionItem(env, tableName, owner, id, item, createdAt) {
  const existing = await env.DB.prepare(
    `SELECT id FROM ${tableName} WHERE owner_type = ? AND owner_id = ? AND id = ?`
  ).bind(owner.type, owner.id, id).first();

  if (!existing) {
    return false;
  }

  await env.DB.prepare(
    `UPDATE ${tableName} SET payload = ?, created_at = ? WHERE owner_type = ? AND owner_id = ? AND id = ?`
  ).bind(
    JSON.stringify(item),
    String(createdAt || item.createdAt || item.deletedAt || new Date().toISOString()),
    owner.type,
    owner.id,
    id
  ).run();

  return true;
}

async function deleteCollectionItem(env, tableName, owner, id) {
  const existing = await env.DB.prepare(
    `SELECT payload FROM ${tableName} WHERE owner_type = ? AND owner_id = ? AND id = ?`
  ).bind(owner.type, owner.id, id).first();

  if (!existing) {
    return null;
  }

  await env.DB.prepare(
    `DELETE FROM ${tableName} WHERE owner_type = ? AND owner_id = ? AND id = ?`
  ).bind(owner.type, owner.id, id).run();
  return JSON.parse(existing.payload);
}

async function readState(env, owner, key, defaultValue) {
  const row = await env.DB.prepare(
    "SELECT value FROM app_state WHERE owner_type = ? AND owner_id = ? AND key = ?"
  ).bind(owner.type, owner.id, key).first();

  if (!row?.value) {
    return structuredClone(defaultValue);
  }

  try {
    return JSON.parse(row.value);
  } catch {
    return structuredClone(defaultValue);
  }
}

async function writeState(env, owner, key, value) {
  await env.DB.prepare(
    `INSERT INTO app_state (owner_type, owner_id, key, value)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(owner_type, owner_id, key) DO UPDATE SET value = excluded.value`
  ).bind(owner.type, owner.id, key, JSON.stringify(value)).run();
}

async function getActiveTrashItems(env, owner) {
  const [items, settings] = await Promise.all([
    readCollection(env, "trash_items", owner),
    readState(env, owner, "settings", DEFAULT_SETTINGS)
  ]);

  const retentionMs = settings.trashAutoDeleteDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const activeItems = [];
  const staleIds = [];

  for (const item of items) {
    const deletedAt = new Date(item.deletedAt).getTime();
    if (Number.isFinite(deletedAt) && deletedAt + retentionMs > now) {
      activeItems.push(item);
    } else {
      staleIds.push(item.id);
    }
  }

  if (staleIds.length) {
    await env.DB.batch(
      staleIds.map((id) =>
        env.DB.prepare(
          "DELETE FROM trash_items WHERE owner_type = ? AND owner_id = ? AND id = ?"
        ).bind(owner.type, owner.id, id)
      )
    );
  }

  return activeItems;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getDisplayNameFromEmail(email) {
  const localPart = normalizeEmail(email).split("@")[0] || "User";
  return (
    localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "User"
  );
}

function validateAuthPayload(body) {
  const email = normalizeEmail(body?.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email is required");
  }
  return email;
}

function validateFood(item) {
  const required = ["id", "name", "category", "size", "icon", "expiryDate", "createdAt"];
  for (const key of required) {
    if (!item?.[key] || typeof item[key] !== "string") {
      throw new Error(`Invalid food item: missing ${key}`);
    }
  }

  if (typeof item.barcode !== "undefined" && typeof item.barcode !== "string") {
    throw new Error("Invalid food item: barcode must be a string");
  }

  if (typeof item.brand !== "undefined" && typeof item.brand !== "string") {
    throw new Error("Invalid food item: brand must be a string");
  }

  if (typeof item.imageUrl !== "undefined" && typeof item.imageUrl !== "string") {
    throw new Error("Invalid food item: imageUrl must be a string");
  }

  if (typeof item.source !== "undefined" && typeof item.source !== "string") {
    throw new Error("Invalid food item: source must be a string");
  }
}

function validateTrashItem(item) {
  validateFood(item);

  const required = ["deletedAt", "cleanupReason", "cleanupNotes"];
  for (const key of required) {
    if (typeof item?.[key] !== "string") {
      throw new Error(`Invalid trash item: missing ${key}`);
    }
  }
}

function validateSettings(settings) {
  if (!settings || typeof settings !== "object") {
    throw new Error("Invalid settings payload");
  }

  const trashAutoDeleteDays = Number(settings.trashAutoDeleteDays);
  const reminderStrategy = String(settings.reminderStrategy || "");
  const theme = String(settings.theme || "");
  const soundVolume = Number(settings.soundVolume);

  if (![7, 14, 30].includes(trashAutoDeleteDays)) {
    throw new Error("Invalid settings payload: trashAutoDeleteDays");
  }

  if (!["light", "standard", "high"].includes(reminderStrategy)) {
    throw new Error("Invalid settings payload: reminderStrategy");
  }

  if (!["light", "dark"].includes(theme)) {
    throw new Error("Invalid settings payload: theme");
  }

  if (!Number.isFinite(soundVolume) || soundVolume < 0 || soundVolume > 200) {
    throw new Error("Invalid settings payload: soundVolume");
  }

  return {
    trashAutoDeleteDays,
    reminderStrategy,
    theme,
    soundVolume: Math.round(soundVolume)
  };
}

function validateAddSettings(settings) {
  if (!settings || typeof settings !== "object") {
    throw new Error("Invalid add settings payload");
  }

  const allFoodSort = String(settings.allFoodSort || "");
  const allFoodFilter = String(settings.allFoodFilter || "");
  const allFoodCategoryFilter = String(settings.allFoodCategoryFilter || "all").toLowerCase();
  const allFoodIconFilter = String(settings.allFoodIconFilter || "");

  if (!["expiry_asc", "expiry_desc", "created_asc", "created_desc"].includes(allFoodSort)) {
    throw new Error("Invalid add settings payload: allFoodSort");
  }

  if (!["all", "fresh", "soon", "expired"].includes(allFoodFilter)) {
    throw new Error("Invalid add settings payload: allFoodFilter");
  }

  const normalizedIconFilter =
    allFoodIconFilter === "with-icon"
      ? "system-icon"
      : allFoodIconFilter === "default-icon"
        ? "default-restaurant"
        : allFoodIconFilter;

  if (!["all", "system-icon", "default-restaurant"].includes(normalizedIconFilter)) {
    throw new Error("Invalid add settings payload: allFoodIconFilter");
  }

  return {
    allFoodSort,
    allFoodFilter,
    allFoodCategoryFilter: allFoodCategoryFilter || "all",
    allFoodIconFilter: normalizedIconFilter
  };
}

function getLocalDateKey(date = new Date()) {
  const normalized = normalizeCalendarDate(date);
  return [
    normalized.getUTCFullYear(),
    String(normalized.getUTCMonth() + 1).padStart(2, "0"),
    String(normalized.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function normalizeCalendarDate(date) {
  const value = date instanceof Date ? date : new Date(date);
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

function parseFoodPayload(row) {
  if (!row?.payload) {
    return null;
  }

  try {
    const item = JSON.parse(row.payload);
    return item && typeof item === "object" ? item : null;
  } catch {
    return null;
  }
}

function parseExpiryDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function diffInDaysFromDate(expiryDate, now = new Date()) {
  const target =
    expiryDate instanceof Date ? normalizeCalendarDate(expiryDate) : parseExpiryDate(expiryDate);
  if (!target) {
    return null;
  }

  const today = normalizeCalendarDate(now);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

function normalizeReminderStrategy(strategy) {
  return REMINDER_RULES[strategy] ? strategy : DEFAULT_SETTINGS.reminderStrategy;
}

function getReminderOffsets(strategy) {
  const normalized = normalizeReminderStrategy(strategy);
  return REMINDER_RULES[normalized];
}

function buildDailyReminderSummary(items, strategy, now = new Date()) {
  const offsets = getReminderOffsets(strategy);
  const allowedDays = new Set([...offsets.before, ...offsets.overdue]);
  const candidates = [];

  for (const item of items || []) {
    const name = String(item?.name || "").trim();
    const daysUntil = diffInDaysFromDate(item?.expiryDate, now);
    if (!name || !Number.isInteger(daysUntil) || !allowedDays.has(daysUntil)) {
      continue;
    }

    candidates.push({
      id: String(item.id || "").trim(),
      name,
      expiryDate: item.expiryDate,
      createdAt: item.createdAt,
      daysUntil
    });
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort(compareReminderCandidates);

  const expiredTodayCount = candidates.filter((item) => item.daysUntil === 0).length;
  const expiringSoonCount = candidates.filter((item) => item.daysUntil > 0).length;
  const overdueCount = candidates.filter((item) => item.daysUntil < 0).length;

  return {
    title: buildReminderTitle(expiredTodayCount, expiringSoonCount, overdueCount),
    body: buildReminderBody(candidates, expiredTodayCount, expiringSoonCount, overdueCount),
    data: {
      url: DAILY_SUMMARY_URL,
      expiredTodayCount,
      expiringSoonCount,
      overdueCount,
      dateKey: getLocalDateKey(now),
      notificationType: DAILY_SUMMARY_NOTIFICATION_TYPE
    }
  };
}

function compareReminderCandidates(a, b) {
  const categoryDiff = getReminderCategoryRank(a.daysUntil) - getReminderCategoryRank(b.daysUntil);
  if (categoryDiff !== 0) {
    return categoryDiff;
  }

  if (a.daysUntil < 0 && b.daysUntil < 0) {
    const overdueDiff = Math.abs(a.daysUntil) - Math.abs(b.daysUntil);
    if (overdueDiff !== 0) {
      return overdueDiff;
    }
  } else if (a.daysUntil > 0 && b.daysUntil > 0) {
    const soonDiff = a.daysUntil - b.daysUntil;
    if (soonDiff !== 0) {
      return soonDiff;
    }
  }

  const createdAtDiff =
    new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime();
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return a.name.localeCompare(b.name);
}

function getReminderCategoryRank(daysUntil) {
  if (daysUntil === 0) {
    return 0;
  }
  if (daysUntil < 0) {
    return 1;
  }
  return 2;
}

function buildReminderTitle(expiredTodayCount, expiringSoonCount, overdueCount) {
  void expiringSoonCount;
  void overdueCount;
  return `Today ${expiredTodayCount} food${expiredTodayCount === 1 ? "" : "s"} expire${expiredTodayCount === 1 ? "s" : ""}`;
}

function buildReminderBody(candidates, expiredTodayCount, expiringSoonCount, overdueCount) {
  const names = candidates.map((item) => item.name).filter(Boolean);
  const leadCount = Math.min(names.length, 3);
  const leadNames = names.slice(0, leadCount);
  const remainingCount = names.length - leadCount;
  const leadText = joinReminderNames(leadNames);
  const subject = leadText
    ? remainingCount > 0
      ? `${leadText} and ${remainingCount} more`
      : leadText
    : `${candidates.length} food${candidates.length === 1 ? "" : "s"}`;
  const plural = remainingCount > 0 || leadNames.length !== 1;

  if (overdueCount > 0 && expiredTodayCount === 0 && expiringSoonCount === 0) {
    return `${subject} ${plural ? "are" : "is"} overdue for cleanup.`;
  }

  if (overdueCount > 0) {
    return `${subject} ${plural ? "need" : "needs"} attention, including overdue items.`;
  }

  if (expiredTodayCount > 0) {
    return `${subject} ${plural ? "need" : "needs"} attention today.`;
  }

  return `${subject} ${plural ? "need" : "needs"} attention soon.`;
}

function joinReminderNames(names) {
  if (!names.length) {
    return "";
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function parseDebugDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error("Invalid debug preview date");
    error.status = 400;
    throw error;
  }
  return parsed;
}

function mapOpenFoodFactsProduct(code, payload) {
  const product = payload?.product;
  if (!product) {
    return { found: false, barcode: code, source: "open_food_facts" };
  }

  const rawCategory = Array.isArray(product.categories_tags)
    ? product.categories_tags[0] || ""
    : "";
  const category = mapCategory(rawCategory, product.categories || "");

  return {
    found: true,
    barcode: String(code),
    name: String(
      product.product_name ||
        product.generic_name ||
        product.abbreviated_product_name ||
        ""
    ).trim(),
    brand: String(product.brands || "").split(",")[0]?.trim() || "",
    category,
    size: String(product.quantity || "").trim(),
    imageUrl: String(
      product.image_front_url || product.image_front_small_url || ""
    ).trim(),
    source: "open_food_facts"
  };
}

function mapOpenFoodFactsSearchResults(query, payload) {
  const products = Array.isArray(payload?.products) ? payload.products : [];
  return {
    query,
    results: products
      .slice(0, 5)
      .map((product) => ({
        code: String(product.code || "").trim(),
        name: String(product.product_name || product.product_name_en || "").trim(),
        brand: String(product.brands || "").trim(),
        category: String(product.categories || "").trim(),
        imageUrl: String(
          product.image_front_small_url || product.image_front_url || ""
        ).trim(),
        source: "open_food_facts_search"
      }))
      .filter((product) => product.name)
  };
}

function mapCategory(primaryTag, fallbackLabel) {
  const text = `${primaryTag || ""} ${fallbackLabel || ""}`.toLowerCase();

  if (text.includes("drink") || text.includes("beverage") || text.includes("juice") || text.includes("water")) {
    return "drinks";
  }
  if (text.includes("meat") || text.includes("beef") || text.includes("pork") || text.includes("chicken") || text.includes("fish")) {
    return "meat";
  }
  if (text.includes("vegetable") || text.includes("salad") || text.includes("produce")) {
    return "vegetables";
  }
  if (text.includes("egg")) {
    return "eggs";
  }
  if (text.includes("snack") || text.includes("chip") || text.includes("candy") || text.includes("biscuit")) {
    return "snacks";
  }
  if (text.includes("frozen")) {
    return "frozen";
  }
  if (text.includes("yogurt") || text.includes("milk") || text.includes("cheese") || text.includes("dairy") || text.includes("refrigerated")) {
    return "refrigerated";
  }
  if (text.includes("bread") || text.includes("bakery") || text.includes("rice") || text.includes("pasta") || text.includes("grain")) {
    return "staple foods";
  }

  return "other";
}

function requireAuthenticatedSession(session) {
  if (!session?.email) {
    const error = new Error("Sign in to enable browser notifications.");
    error.status = 401;
    throw error;
  }

  return session;
}

async function getPushSubscriptionStatus(env, session, deviceId) {
  const email = normalizeEmail(session.email);
  const deviceKey = getPushDeviceStateKey(deviceId);
  const storedEndpoint = await readState(
    env,
    { type: "user", id: email },
    deviceKey,
    null
  );
  const endpoint = typeof storedEndpoint === "string" ? storedEndpoint.trim() : "";
  let row = null;

  if (endpoint) {
    row = await env.DB.prepare(
      `SELECT endpoint
       FROM push_subscriptions
       WHERE email = ? AND endpoint = ?
       LIMIT 1`
    ).bind(email, endpoint).first();
  }

  return {
    supported: Boolean(getVapidPublicKey(env)),
    subscribed: Boolean(row?.endpoint),
    endpoint: row?.endpoint ? String(row.endpoint) : null
  };
}

function getVapidPublicKey(env) {
  return String(env?.VAPID_PUBLIC_KEY || "").trim();
}

function isDebugNotificationPreviewEnabled(env) {
  return String(env?.ALLOW_DEBUG_NOTIFICATION_PREVIEW || "").trim() === "true";
}

function getVapidConfig(env) {
  const publicKey = getVapidPublicKey(env);
  const privateKey = String(env?.VAPID_PRIVATE_KEY || "").trim();
  const subject = String(env?.VAPID_SUBJECT || "").trim();

  return {
    publicKey,
    privateKey,
    subject,
    valid: Boolean(publicKey && privateKey && subject)
  };
}

async function savePushSubscription(env, session, deviceId, subscription, userAgent) {
  const normalized = validatePushSubscription(subscription);
  const email = normalizeEmail(session.email);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO push_subscriptions (email, endpoint, subscription_json, user_agent, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(email, endpoint) DO UPDATE SET
       subscription_json = excluded.subscription_json,
       user_agent = excluded.user_agent,
       updated_at = excluded.updated_at`
  ).bind(
    email,
    normalized.endpoint,
    JSON.stringify(normalized),
    String(userAgent || ""),
    now,
    now
  ).run();

  await writeState(
    env,
    { type: "user", id: email },
    getPushDeviceStateKey(deviceId),
    normalized.endpoint
  );

  return {
    supported: true,
    subscribed: true,
    endpoint: normalized.endpoint
  };
}

async function deletePushSubscription(env, session, deviceId, endpoint) {
  const normalizedEndpoint = String(endpoint || "").trim();
  if (!normalizedEndpoint) {
    const error = new Error("Invalid push subscription payload: endpoint");
    error.status = 400;
    throw error;
  }

  await env.DB.prepare(
    "DELETE FROM push_subscriptions WHERE email = ? AND endpoint = ?"
  ).bind(normalizeEmail(session.email), normalizedEndpoint).run();

  const email = normalizeEmail(session.email);
  const deviceKey = getPushDeviceStateKey(deviceId);
  const storedEndpoint = await readState(
    env,
    { type: "user", id: email },
    deviceKey,
    null
  );

  if (typeof storedEndpoint === "string" && storedEndpoint.trim() === normalizedEndpoint) {
    await env.DB.prepare(
      "DELETE FROM app_state WHERE owner_type = 'user' AND owner_id = ? AND key = ?"
    ).bind(email, deviceKey).run();
  }
}

function getPushDeviceStateKey(deviceId) {
  return `push-device:${String(deviceId || "").trim()}`;
}

function validatePushSubscription(subscription) {
  if (!subscription || typeof subscription !== "object") {
    const error = new Error("Invalid push subscription payload");
    error.status = 400;
    throw error;
  }

  const endpoint = normalizePushEndpoint(subscription.endpoint);
  const keys = subscription.keys;
  const p256dh = String(keys?.p256dh || "").trim();
  const auth = String(keys?.auth || "").trim();
  const expirationTime =
    subscription.expirationTime === null || typeof subscription.expirationTime === "undefined"
      ? null
      : Number(subscription.expirationTime);

  if (!endpoint || !p256dh || !auth) {
    const error = new Error("Invalid push subscription payload");
    error.status = 400;
    throw error;
  }

  if (expirationTime !== null && !Number.isFinite(expirationTime)) {
    const error = new Error("Invalid push subscription payload");
    error.status = 400;
    throw error;
  }

  return {
    endpoint,
    expirationTime,
    keys: {
      p256dh,
      auth
    }
  };
}

async function buildDailySummaryPayloadForEmail(env, email, now = new Date()) {
  const normalizedEmail = normalizeEmail(email);
  const [foods, settings] = await Promise.all([
    listFoodsForEmail(env, normalizedEmail),
    readState(env, { type: "user", id: normalizedEmail }, "settings", DEFAULT_SETTINGS)
  ]);

  return buildDailyReminderSummary(
    foods,
    normalizeReminderStrategy(settings?.reminderStrategy),
    now
  );
}

async function processScheduledNotifications(env, now = new Date()) {
  const vapid = getVapidConfig(env);
  const dateKey = getLocalDateKey(now);

  if (!vapid.valid) {
    console.log(`Skipping scheduled notifications for ${dateKey}: missing VAPID configuration`);
    return {
      dateKey,
      skipped: true,
      reason: "missing-vapid-config"
    };
  }

  const emails = await listUsersWithPushSubscriptions(env);
  const result = {
    dateKey,
    usersChecked: emails.length,
    usersSent: 0,
    usersSkipped: 0,
    usersFailed: 0,
    subscriptionsCleaned: 0
  };

  for (const email of emails) {
    try {
      const payload = await buildDailySummaryPayloadForEmail(env, email, now);
      if (!payload) {
        result.usersSkipped += 1;
        continue;
      }

      const subscriptions = await listPushSubscriptionsForEmail(env, email);
      if (!subscriptions.length) {
        result.usersSkipped += 1;
        continue;
      }

      const reserved = await reserveNotificationDelivery(
        env,
        email,
        dateKey,
        DAILY_SUMMARY_NOTIFICATION_TYPE
      );
      if (!reserved) {
        result.usersSkipped += 1;
        continue;
      }

      try {
        let sentCount = 0;

        for (const subscription of subscriptions) {
          try {
            await sendWebPushToSubscription(env, subscription, payload);
            sentCount += 1;
          } catch (error) {
            if (error?.code === "INVALID_SUBSCRIPTION") {
              await deletePushSubscriptionByEndpoint(env, email, subscription.endpoint);
              result.subscriptionsCleaned += 1;
              continue;
            }

            console.error(`Push delivery failed for ${email}`, error);
          }
        }

        if (!sentCount) {
          await releaseNotificationDeliveryReservation(
            env,
            email,
            dateKey,
            DAILY_SUMMARY_NOTIFICATION_TYPE
          );
          result.usersFailed += 1;
          continue;
        }

        await commitNotificationDelivery(
          env,
          email,
          dateKey,
          DAILY_SUMMARY_NOTIFICATION_TYPE,
          payload
        );
        result.usersSent += 1;
      } catch (error) {
        await releaseNotificationDeliveryReservation(
          env,
          email,
          dateKey,
          DAILY_SUMMARY_NOTIFICATION_TYPE
        );
        throw error;
      }
    } catch (error) {
      result.usersFailed += 1;
      console.error(`Scheduled notification processing failed for ${email}`, error);
    }
  }

  console.log("Scheduled notification summary", result);
  return result;
}

async function listUsersWithPushSubscriptions(env) {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT email
     FROM push_subscriptions
     ORDER BY email ASC`
  ).all();

  return (results || [])
    .map((row) => normalizeEmail(row.email))
    .filter(Boolean);
}

async function listFoodsForEmail(env, email) {
  const { results } = await env.DB.prepare(
    `SELECT payload
     FROM foods
     WHERE owner_type = 'user' AND owner_id = ?
     ORDER BY created_at DESC, rowid DESC`
  ).bind(email).all();

  return (results || []).map(parseFoodPayload).filter(Boolean);
}

async function listPushSubscriptionsForEmail(env, email) {
  const { results } = await env.DB.prepare(
    `SELECT endpoint, subscription_json
     FROM push_subscriptions
     WHERE email = ?
     ORDER BY updated_at DESC, endpoint ASC`
  ).bind(email).all();

  return (results || [])
    .map((row) => {
      try {
        const parsed = JSON.parse(row.subscription_json);
        return validatePushSubscription(parsed);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function reserveNotificationDelivery(env, email, dateKey, type) {
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO notification_deliveries
      (email, delivery_date, notification_type, payload_json, sent_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    email,
    dateKey,
    type,
    JSON.stringify({ status: "pending" }),
    ""
  ).run();

  return Number(result?.meta?.changes || 0) > 0;
}

async function commitNotificationDelivery(env, email, dateKey, type, payload) {
  await env.DB.prepare(
    `UPDATE notification_deliveries
     SET payload_json = ?, sent_at = ?
     WHERE email = ? AND delivery_date = ? AND notification_type = ?`
  ).bind(
    JSON.stringify(payload),
    new Date().toISOString(),
    email,
    dateKey,
    type
  ).run();
}

async function releaseNotificationDeliveryReservation(env, email, dateKey, type) {
  await env.DB.prepare(
    `DELETE FROM notification_deliveries
     WHERE email = ? AND delivery_date = ? AND notification_type = ? AND sent_at = ?`
  ).bind(
    email,
    dateKey,
    type,
    ""
  ).run();
}

async function deletePushSubscriptionByEndpoint(env, email, endpoint) {
  await env.DB.prepare(
    "DELETE FROM push_subscriptions WHERE email = ? AND endpoint = ?"
  ).bind(email, endpoint).run();
}

async function sendWebPushToSubscription(env, subscription, payload) {
  const vapid = getVapidConfig(env);
  if (!vapid.valid) {
    return false;
  }

  const endpointUrl = new URL(normalizePushEndpoint(subscription.endpoint));
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
  const authorization = await createVapidAuthorizationHeader(
    audience,
    vapid.subject,
    vapid.publicKey,
    vapid.privateKey
  );
  const encrypted = await encryptWebPushPayload(subscription, JSON.stringify(payload));
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Crypto-Key": `p256ecdsa=${vapid.publicKey}`,
      TTL: String(WEB_PUSH_TTL_SECONDS),
      Urgency: "normal",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream"
    },
    body: encrypted
  });

  if (response.status === 404 || response.status === 410) {
    const error = new Error(`Push subscription is no longer valid (${response.status})`);
    error.code = "INVALID_SUBSCRIPTION";
    throw error;
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Push delivery failed: ${response.status}${detail ? ` ${detail.slice(0, 200)}` : ""}`
    );
  }

  return true;
}

function normalizePushEndpoint(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    const error = new Error("Invalid push subscription payload: endpoint");
    error.status = 400;
    throw error;
  }

  if (parsed.protocol !== "https:") {
    const error = new Error("Invalid push subscription payload: endpoint");
    error.status = 400;
    throw error;
  }

  parsed.hash = "";
  return parsed.toString();
}

async function createVapidAuthorizationHeader(audience, subject, publicKey, privateKey) {
  const encodedHeader = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" }))
  );
  const encodedClaims = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject
      })
    )
  );
  const signingInput = `${encodedHeader}.${encodedClaims}`;
  const signature = await signVapidJwt(signingInput, publicKey, privateKey);
  return `vapid t=${signingInput}.${signature}, k=${publicKey}`;
}

async function signVapidJwt(input, publicKey, privateKey) {
  const signingKey = await importVapidPrivateKey(publicKey, privateKey);
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    new TextEncoder().encode(input)
  ));
  if (signature.length === 64) {
    return bytesToBase64Url(signature);
  }
  return derSignatureToBase64Url(signature, 64);
}

async function importVapidPrivateKey(publicKey, privateKey) {
  const publicBytes = base64UrlToBytes(publicKey);
  const privateBytes = base64UrlToBytes(privateKey);

  if (publicBytes.length !== 65 || publicBytes[0] !== 4 || privateBytes.length !== 32) {
    throw new Error("Invalid VAPID key material");
  }

  return crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      x: bytesToBase64Url(publicBytes.slice(1, 33)),
      y: bytesToBase64Url(publicBytes.slice(33, 65)),
      d: bytesToBase64Url(privateBytes),
      ext: true
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function encryptWebPushPayload(subscription, payload) {
  const applicationServerKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const applicationServerPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", applicationServerKeyPair.publicKey)
  );
  const userPublicKeyBytes = base64UrlToBytes(subscription.keys.p256dh);
  const userPublicKey = await crypto.subtle.importKey(
    "raw",
    userPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: userPublicKey },
      applicationServerKeyPair.privateKey,
      256
    )
  );
  const authSecret = base64UrlToBytes(subscription.keys.auth);
  const keyInfo = concatBytes(
    new TextEncoder().encode("WebPush: info\u0000"),
    userPublicKeyBytes,
    applicationServerPublicKey
  );
  const ikmSeed = await hmacSha256(authSecret, sharedSecret);
  const ikm = await hmacSha256(ikmSeed, concatBytes(keyInfo, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentPrk = await hmacSha256(salt, ikm);
  const contentEncryptionKey = (
    await hmacSha256(
      contentPrk,
      concatBytes(
        new TextEncoder().encode("Content-Encoding: aes128gcm\u0000"),
        new Uint8Array([1])
      )
    )
  ).slice(0, 16);
  const nonce = (
    await hmacSha256(
      contentPrk,
      concatBytes(
        new TextEncoder().encode("Content-Encoding: nonce\u0000"),
        new Uint8Array([1])
      )
    )
  ).slice(0, 12);
  const plaintext = concatBytes(new TextEncoder().encode(payload), new Uint8Array([2]));
  const key = await crypto.subtle.importKey(
    "raw",
    contentEncryptionKey,
    "AES-GCM",
    false,
    ["encrypt"]
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, plaintext)
  );

  return concatBytes(
    salt,
    uint32ToBytes(WEB_PUSH_RECORD_SIZE),
    new Uint8Array([applicationServerPublicKey.length]),
    applicationServerPublicKey,
    ciphertext
  );
}

async function hmacSha256(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, dataBytes));
}

function concatBytes(...parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

function uint32ToBytes(value) {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  ]);
}

function base64UrlToBytes(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const decoded = atob(padded);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function derSignatureToBase64Url(signature, outputLength) {
  const bytes = new Uint8Array(signature);
  let offset = 0;

  if (bytes[offset++] !== 0x30) {
    throw new Error("Invalid DER signature");
  }

  ({ offset } = readDerLength(bytes, offset));

  if (bytes[offset++] !== 0x02) {
    throw new Error("Invalid DER signature");
  }

  const rLengthInfo = readDerLength(bytes, offset);
  const rLength = rLengthInfo.length;
  offset = rLengthInfo.offset;
  const r = bytes.slice(offset, offset + rLength);
  offset += rLength;

  if (bytes[offset++] !== 0x02) {
    throw new Error("Invalid DER signature");
  }

  const sLengthInfo = readDerLength(bytes, offset);
  const sLength = sLengthInfo.length;
  offset = sLengthInfo.offset;
  const s = bytes.slice(offset, offset + sLength);
  const componentLength = outputLength / 2;

  return bytesToBase64Url(
    concatBytes(
      trimAndPadDerInteger(r, componentLength),
      trimAndPadDerInteger(s, componentLength)
    )
  );
}

function readDerLength(bytes, offset) {
  const first = bytes[offset];
  if (first < 0x80) {
    return { length: first, offset: offset + 1 };
  }

  const byteCount = first & 0x7f;
  let length = 0;

  for (let index = 0; index < byteCount; index += 1) {
    length = (length << 8) | bytes[offset + 1 + index];
  }

  return { length, offset: offset + 1 + byteCount };
}

function trimAndPadDerInteger(bytes, size) {
  let value = bytes;
  while (value.length > 1 && value[0] === 0) {
    value = value.slice(1);
  }

  if (value.length > size) {
    throw new Error("DER integer is too large");
  }

  const result = new Uint8Array(size);
  result.set(value, size - value.length);
  return result;
}

async function getAuthSession(request, env) {
  const session = await getCurrentSession(request, env);
  if (!session) {
    return { authenticated: false, user: null };
  }

  return {
    authenticated: true,
    user: {
      email: normalizeEmail(session.email),
      name: String(session.name || getDisplayNameFromEmail(session.email)).trim()
    }
  };
}

async function createSession(env, email) {
  const sessionId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO sessions (id, email, created_at) VALUES (?, ?, ?)"
  ).bind(sessionId, email, new Date().toISOString()).run();
  return sessionId;
}

async function getCurrentSession(request, env) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies[SESSION_COOKIE];

  if (!sessionId) {
    return null;
  }

  return env.DB.prepare(
    `SELECT sessions.id, sessions.email, users.name
     FROM sessions
     JOIN users ON users.email = sessions.email
     WHERE sessions.id = ?`
  ).bind(sessionId).first();
}

async function destroyCurrentSession(request, env) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const sessionId = cookies[SESSION_COOKIE];

  if (!sessionId) {
    return;
  }

  await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

function buildSessionCookie(sessionId) {
  return `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function buildGuestCookie(guestId) {
  return `${GUEST_COOKIE}=${guestId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`;
}

function parseCookies(cookieHeader) {
  return cookieHeader.split(";").reduce((cookies, part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) {
      return cookies;
    }

    cookies[rawKey] = rawValue.join("=");
    return cookies;
  }, {});
}


async function buildRequestContext(request, env) {
  const cookies = [];
  const parsedCookies = parseCookies(request.headers.get("Cookie") || "");
  let guestId = parsedCookies[GUEST_COOKIE];
  if (!guestId) {
    guestId = crypto.randomUUID();
    cookies.push(buildGuestCookie(guestId));
  }

  const session = await getCurrentSession(request, env);

  if (session) {
    return {
      owner: { type: "user", id: normalizeEmail(session.email) },
      session,
      cookies,
      deviceId: guestId
    };
  }

  const owner = { type: "guest", id: guestId };
  await seedGuestFromLegacyIfNeeded(env, owner);
  return { owner, session: null, cookies, deviceId: guestId };
}

async function seedGuestFromLegacyIfNeeded(env, owner) {
  if (owner.type !== "guest" || owner.id === LEGACY_OWNER.id) {
    return;
  }

  const [hasOwnedFood, hasOwnedTrash, hasOwnedState, hasLegacyFood, hasLegacyTrash, hasLegacyState] = await Promise.all([
    env.DB.prepare("SELECT 1 FROM foods WHERE owner_type = ? AND owner_id = ? LIMIT 1").bind(owner.type, owner.id).first(),
    env.DB.prepare("SELECT 1 FROM trash_items WHERE owner_type = ? AND owner_id = ? LIMIT 1").bind(owner.type, owner.id).first(),
    env.DB.prepare("SELECT 1 FROM app_state WHERE owner_type = ? AND owner_id = ? LIMIT 1").bind(owner.type, owner.id).first(),
    env.DB.prepare("SELECT 1 FROM foods WHERE owner_type = ? AND owner_id = ? LIMIT 1").bind(LEGACY_OWNER.type, LEGACY_OWNER.id).first(),
    env.DB.prepare("SELECT 1 FROM trash_items WHERE owner_type = ? AND owner_id = ? LIMIT 1").bind(LEGACY_OWNER.type, LEGACY_OWNER.id).first(),
    env.DB.prepare("SELECT 1 FROM app_state WHERE owner_type = ? AND owner_id = ? LIMIT 1").bind(LEGACY_OWNER.type, LEGACY_OWNER.id).first()
  ]);

  if (hasOwnedFood || hasOwnedTrash || hasOwnedState) {
    return;
  }

  if (!hasLegacyFood && !hasLegacyTrash && !hasLegacyState) {
    return;
  }

  await copyOwnerData(env, LEGACY_OWNER, owner);
}

async function claimGuestDataForNewUser(env, owner, email) {
  const userOwner = { type: "user", id: email };

  await copyOwnerData(env, LEGACY_OWNER, userOwner);
  await adoptOwnerData(env, owner, userOwner);
}

async function adoptOwnerData(env, fromOwner, toOwner) {
  if (!fromOwner?.id || !toOwner?.id) {
    return;
  }

  if (fromOwner.type === toOwner.type && fromOwner.id === toOwner.id) {
    return;
  }

  await copyOwnerData(env, fromOwner, toOwner);
}

async function copyOwnerData(env, fromOwner, toOwner) {
  if (!fromOwner?.id || !toOwner?.id) {
    return;
  }

  if (fromOwner.type === toOwner.type && fromOwner.id === toOwner.id) {
    return;
  }

  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR REPLACE INTO foods (owner_type, owner_id, id, created_at, payload)
       SELECT ?, ?, id, created_at, payload
       FROM foods
       WHERE owner_type = ? AND owner_id = ?`
    ).bind(toOwner.type, toOwner.id, fromOwner.type, fromOwner.id),
    env.DB.prepare(
      `INSERT OR REPLACE INTO trash_items (owner_type, owner_id, id, created_at, payload)
       SELECT ?, ?, id, created_at, payload
       FROM trash_items
       WHERE owner_type = ? AND owner_id = ?`
    ).bind(toOwner.type, toOwner.id, fromOwner.type, fromOwner.id),
    env.DB.prepare(
      `INSERT OR REPLACE INTO app_state (owner_type, owner_id, key, value)
       SELECT ?, ?, key, value
       FROM app_state
       WHERE owner_type = ? AND owner_id = ?`
    ).bind(toOwner.type, toOwner.id, fromOwner.type, fromOwner.id)
  ]);
}
