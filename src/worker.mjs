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
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

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
        500
      );
    }
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

  if (pathname === "/api/auth/code/send" && request.method === "POST") {
    const email = validateAuthPayload(await readBody(request));
    await sendVerificationCode(env, email);
    return jsonResponse(
      { success: true, message: "Verification code sent. Check your inbox." },
      200,
      context.cookies
    );
  }

  if (pathname === "/api/auth/code/verify" && request.method === "POST") {
    const body = await readBody(request);
    const email = validateAuthPayload(body);
    const code = String(body?.code || "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      return jsonResponse({ error: "Verification code must be 6 digits." }, 400, context.cookies);
    }

    await verifyStoredCode(env, email, code);

    const existing = await env.DB.prepare(
      "SELECT email, name FROM users WHERE email = ?"
    ).bind(email).first();

    if (!existing) {
      const createdAt = new Date().toISOString();
      const name = getDisplayNameFromEmail(email);
      await env.DB.prepare(
        "INSERT INTO users (email, name, created_at) VALUES (?, ?, ?)"
      ).bind(email, name, createdAt).run();
      await claimGuestDataForNewUser(env, owner, email);
    } else {
      await copyOwnerData(env, LEGACY_OWNER, { type: "user", id: email });
    }

    const nextGuestId = crypto.randomUUID();
    const sessionId = await createSession(env, email);
    const user = await env.DB.prepare(
      "SELECT email, name FROM users WHERE email = ?"
    ).bind(email).first();

    return jsonResponse(
      {
        authenticated: true,
        user: {
          email,
          name: String(user?.name || getDisplayNameFromEmail(email)).trim()
        }
      },
      200,
      [...context.cookies, buildSessionCookie(sessionId), buildGuestCookie(nextGuestId)]
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

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON body");
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

async function sendVerificationCode(env, email) {
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("Email delivery is not configured.");
  }

  const code = generateVerificationCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VERIFICATION_CODE_TTL_MS).toISOString();

  await env.DB.prepare(
    `INSERT INTO verification_codes (email, code, expires_at, created_at, attempts)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, created_at = excluded.created_at, attempts = 0`
  ).bind(email, code, expiresAt, now.toISOString()).run();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      from: "Freshness Above All <onboarding@resend.dev>",
      to: [email],
      subject: "Your Freshness Above All verification code",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <p>Your verification code is:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:0.35em;margin:16px 0">${code}</p>
        <p>This code expires in 10 minutes.</p>
      </div>`
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      response.status === 403
        ? "Email sending is in test mode. Resend can only send to your own email until you verify a domain."
        : `Failed to send verification email: ${errorText || response.status}`
    );
  }
}

async function verifyStoredCode(env, email, submittedCode) {
  const record = await env.DB.prepare(
    "SELECT code, expires_at, attempts FROM verification_codes WHERE email = ?"
  ).bind(email).first();

  if (!record) {
    throw new Error("Verification code expired or was not requested.");
  }

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare("DELETE FROM verification_codes WHERE email = ?").bind(email).run();
    throw new Error("Verification code expired. Request a new one.");
  }

  if (Number(record.attempts || 0) >= 5) {
    await env.DB.prepare("DELETE FROM verification_codes WHERE email = ?").bind(email).run();
    throw new Error("Too many failed attempts. Request a new code.");
  }

  if (String(record.code) !== submittedCode) {
    await env.DB.prepare(
      "UPDATE verification_codes SET attempts = attempts + 1 WHERE email = ?"
    ).bind(email).run();
    throw new Error("Incorrect verification code.");
  }

  await env.DB.prepare("DELETE FROM verification_codes WHERE email = ?").bind(email).run();
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function buildRequestContext(request, env) {
  const session = await getCurrentSession(request, env);
  const cookies = [];

  if (session) {
    return {
      owner: { type: "user", id: normalizeEmail(session.email) },
      session,
      cookies
    };
  }

  const parsedCookies = parseCookies(request.headers.get("Cookie") || "");
  let guestId = parsedCookies[GUEST_COOKIE];
  if (!guestId) {
    guestId = crypto.randomUUID();
    cookies.push(buildGuestCookie(guestId));
  }

  const owner = { type: "guest", id: guestId };
  await seedGuestFromLegacyIfNeeded(env, owner);
  return { owner, session: null, cookies };
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
