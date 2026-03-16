const http = require("http");
const https = require("https");
const fs = require("fs/promises");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const FOOD_PATH = path.join(ROOT, "food.json");
const SETTINGS_PATH = path.join(ROOT, "setting.json");
const ADD_SETTINGS_PATH = path.join(ROOT, "addSetting.json");
const TRASH_PATH = path.join(ROOT, "trash.json");
const ACCOUNT_PATH = path.join(ROOT, "account.json");
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

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg"
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(data, null, 2));
}

async function readFoods() {
  const raw = await fs.readFile(FOOD_PATH, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeFoods(items) {
  await fs.writeFile(FOOD_PATH, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

async function readTrashItems() {
  try {
    const raw = await fs.readFile(TRASH_PATH, "utf8");
    if (!raw.trim()) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeTrashItems(items) {
  await fs.writeFile(TRASH_PATH, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

async function getActiveTrashItems() {
  const [items, settings] = await Promise.all([readTrashItems(), readSettings()]);
  const now = Date.now();
  const retentionMs = settings.trashAutoDeleteDays * 24 * 60 * 60 * 1000;
  const activeItems = items.filter((item) => {
    const deletedAt = new Date(item.deletedAt).getTime();
    return Number.isFinite(deletedAt) && deletedAt + retentionMs > now;
  });

  if (activeItems.length !== items.length) {
    await writeTrashItems(activeItems);
  }

  return activeItems;
}

async function readSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf8");
    if (!raw.trim()) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(raw);
    return validateSettings(parsed);
  } catch (error) {
    if (error.code === "ENOENT") {
      return { ...DEFAULT_SETTINGS };
    }

    throw error;
  }
}

async function writeSettings(settings) {
  const validated = validateSettings(settings);
  await fs.writeFile(SETTINGS_PATH, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return validated;
}

async function readAddSettings() {
  try {
    const raw = await fs.readFile(ADD_SETTINGS_PATH, "utf8");
    if (!raw.trim()) {
      return { ...DEFAULT_ADD_SETTINGS };
    }

    const parsed = JSON.parse(raw);
    return validateAddSettings(parsed);
  } catch (error) {
    if (error.code === "ENOENT") {
      return { ...DEFAULT_ADD_SETTINGS };
    }

    throw error;
  }
}

async function writeAddSettings(settings) {
  const validated = validateAddSettings(settings);
  await fs.writeFile(ADD_SETTINGS_PATH, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return validated;
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getDisplayNameFromEmail(email) {
  const localPart = normalizeEmail(email).split("@")[0] || "User";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "User";
}

async function readAccountStore() {
  try {
    const raw = await fs.readFile(ACCOUNT_PATH, "utf8");
    if (!raw.trim()) {
      return { users: [], currentEmail: "" };
    }

    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      currentEmail: normalizeEmail(parsed.currentEmail || "")
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { users: [], currentEmail: "" };
    }
    throw error;
  }
}

async function writeAccountStore(store) {
  const payload = {
    users: Array.isArray(store.users) ? store.users : [],
    currentEmail: normalizeEmail(store.currentEmail || "")
  };
  await fs.writeFile(ACCOUNT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

async function getAuthSession() {
  const store = await readAccountStore();
  const currentEmail = normalizeEmail(store.currentEmail);
  const user = store.users.find((entry) => normalizeEmail(entry.email) === currentEmail);
  if (!user) {
    return { authenticated: false, user: null };
  }
  return {
    authenticated: true,
    user: {
      email: normalizeEmail(user.email),
      name: String(user.name || getDisplayNameFromEmail(user.email)).trim()
    }
  };
}

function validateFood(item) {
  const required = ["id", "name", "category", "size", "icon", "expiryDate", "createdAt"];
  for (const key of required) {
    if (!item[key] || typeof item[key] !== "string") {
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
    if (typeof item[key] !== "string") {
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

function validateAuthPayload(body) {
  const email = normalizeEmail(body?.email);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email is required");
  }
  return email;
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

  const normalizedIconFilter = allFoodIconFilter === "with-icon" ? "system-icon" : allFoodIconFilter === "default-icon" ? "default-restaurant" : allFoodIconFilter;

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

function fetchJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "FreshnessAboveAll/1.0 (Open Food Facts lookup)",
            Accept: "application/json",
            ...headers
          }
        },
        (response) => {
          let raw = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            raw += chunk;
          });
          response.on("end", () => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
              reject(new Error(`Barcode lookup failed: ${response.statusCode}`));
              return;
            }

            try {
              resolve(JSON.parse(raw));
            } catch {
              reject(new Error("Barcode lookup returned invalid JSON"));
            }
          });
        }
      )
      .on("error", reject);
  });
}

function mapOpenFoodFactsProduct(code, payload) {
  const product = payload?.product;
  if (!product) {
    return { found: false, barcode: code, source: "open_food_facts" };
  }

  const rawCategory = Array.isArray(product.categories_tags) ? product.categories_tags[0] || "" : "";
  const category = mapCategory(rawCategory, product.categories || "");

  return {
    found: true,
    barcode: String(code),
    name: String(product.product_name || product.generic_name || product.abbreviated_product_name || "").trim(),
    brand: String(product.brands || "").split(",")[0]?.trim() || "",
    category,
    size: String(product.quantity || "").trim(),
    imageUrl: String(product.image_front_url || product.image_front_small_url || "").trim(),
    source: "open_food_facts"
  };
}

function mapOpenFoodFactsSearchResults(query, payload) {
  const products = Array.isArray(payload?.products) ? payload.products : [];
  return {
    query,
    results: products.slice(0, 5).map((product) => ({
      code: String(product.code || "").trim(),
      name: String(product.product_name || product.product_name_en || "").trim(),
      brand: String(product.brands || "").trim(),
      category: String(product.categories || "").trim(),
      imageUrl: String(product.image_front_small_url || product.image_front_url || "").trim(),
      source: "open_food_facts_search"
    })).filter((product) => product.name)
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

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  if (pathname === "/api/settings" && req.method === "GET") {
    return sendJson(res, 200, await readSettings());
  }

  if (pathname === "/api/settings" && req.method === "PUT") {
    const settings = await readBody(req);
    return sendJson(res, 200, await writeSettings(settings));
  }

  if (pathname === "/api/settings" && req.method === "DELETE") {
    return sendJson(res, 200, await writeSettings(DEFAULT_SETTINGS));
  }

  if (pathname === "/api/add-settings" && req.method === "GET") {
    return sendJson(res, 200, await readAddSettings());
  }

  if (pathname === "/api/add-settings" && req.method === "PUT") {
    const settings = await readBody(req);
    return sendJson(res, 200, await writeAddSettings(settings));
  }

  if (pathname === "/api/add-settings" && req.method === "DELETE") {
    return sendJson(res, 200, await writeAddSettings(DEFAULT_ADD_SETTINGS));
  }

  if (pathname === "/api/foods" && req.method === "GET") {
    return sendJson(res, 200, await readFoods());
  }

  if (pathname === "/api/foods" && req.method === "POST") {
    const item = await readBody(req);
    validateFood(item);
    const items = await readFoods();
    items.unshift(item);
    await writeFoods(items);
    return sendJson(res, 201, item);
  }

  if (pathname.startsWith("/api/barcode/") && req.method === "GET") {
    const code = decodeURIComponent(pathname.split("/").pop() || "").trim();
    if (!code) {
      return sendJson(res, 400, { error: "Barcode is required" });
    }

    const payload = await fetchJson(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    return sendJson(res, 200, mapOpenFoodFactsProduct(code, payload));
  }

  if (pathname === "/api/product-search" && req.method === "GET") {
    const query = String(url.searchParams.get("q") || "").trim();
    if (!query) {
      return sendJson(res, 400, { error: "Search query is required" });
    }

    const payload = await fetchJson(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=5`
    );
    return sendJson(res, 200, mapOpenFoodFactsSearchResults(query, payload));
  }

  if (pathname === "/api/auth/session" && req.method === "GET") {
    return sendJson(res, 200, await getAuthSession());
  }

  if (pathname === "/api/auth/register" && req.method === "POST") {
    const body = await readBody(req);
    const email = validateAuthPayload(body);
    const store = await readAccountStore();
    const exists = store.users.find((entry) => normalizeEmail(entry.email) === email);
    if (exists) {
      return sendJson(res, 409, { error: "This email is already registered. Please log in instead." });
    }

    const user = {
      email,
      name: getDisplayNameFromEmail(email),
      createdAt: new Date().toISOString()
    };
    store.users = [...store.users, user];
    store.currentEmail = email;
    await writeAccountStore(store);
    return sendJson(res, 201, { authenticated: true, user: { email, name: user.name } });
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readBody(req);
    const email = validateAuthPayload(body);
    const store = await readAccountStore();
    const user = store.users.find((entry) => normalizeEmail(entry.email) === email);
    if (!user) {
      return sendJson(res, 404, { error: "No account found for that email. Sign up first." });
    }

    store.currentEmail = email;
    await writeAccountStore(store);
    return sendJson(res, 200, {
      authenticated: true,
      user: {
        email,
        name: String(user.name || getDisplayNameFromEmail(email)).trim()
      }
    });
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    const store = await readAccountStore();
    store.currentEmail = "";
    await writeAccountStore(store);
    return sendJson(res, 200, { authenticated: false, user: null });
  }

  if (pathname === "/api/auth/account" && req.method === "DELETE") {
    const store = await readAccountStore();
    const currentEmail = normalizeEmail(store.currentEmail);
    if (!currentEmail) {
      return sendJson(res, 404, { error: "No signed-in account to delete." });
    }

    await fs.writeFile(ACCOUNT_PATH, "", "utf8");
    return sendJson(res, 200, { authenticated: false, user: null });
  }

  if (pathname.startsWith("/api/foods/")) {
    const id = decodeURIComponent(pathname.split("/").pop());
    const items = await readFoods();
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      return sendJson(res, 404, { error: "Food item not found" });
    }

    if (req.method === "PUT") {
      const item = await readBody(req);
      validateFood(item);
      items[index] = item;
      await writeFoods(items);
      return sendJson(res, 200, item);
    }

    if (req.method === "DELETE") {
      const [removed] = items.splice(index, 1);
      await writeFoods(items);
      return sendJson(res, 200, removed);
    }
  }

  if (pathname === "/api/trash" && req.method === "GET") {
    return sendJson(res, 200, await getActiveTrashItems());
  }

  if (pathname === "/api/trash" && req.method === "POST") {
    const item = await readBody(req);
    validateTrashItem(item);
    const items = await readTrashItems();
    items.unshift(item);
    await writeTrashItems(items);
    return sendJson(res, 201, item);
  }

  if (pathname === "/api/trash" && req.method === "DELETE") {
    await writeTrashItems([]);
    return sendJson(res, 200, { success: true });
  }

  if (pathname.startsWith("/api/trash/")) {
    const id = decodeURIComponent(pathname.split("/").pop());
    const items = await readTrashItems();
    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      return sendJson(res, 404, { error: "Trash item not found" });
    }

    if (req.method === "DELETE") {
      const [removed] = items.splice(index, 1);
      await writeTrashItems(items);
      return sendJson(res, 200, removed);
    }
  }

  return sendJson(res, 404, { error: "API route not found" });
}

async function handleStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(ROOT, path.normalize(safePath));

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const ext = path.extname(filePath);
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream"
    });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: "File not found" });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await handleStatic(req, res, url.pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`FreshTracker running at http://localhost:${PORT}`);
});
