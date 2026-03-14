const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const FOOD_PATH = path.join(ROOT, "food.json");
const SETTINGS_PATH = path.join(ROOT, "setting.json");
const TRASH_PATH = path.join(ROOT, "trash.json");
const DEFAULT_SETTINGS = {
  trashAutoDeleteDays: 7,
  reminderStrategy: "standard",
  theme: "light"
};

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8"
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

function validateFood(item) {
  const required = ["id", "name", "category", "size", "icon", "expiryDate", "createdAt"];
  for (const key of required) {
    if (!item[key] || typeof item[key] !== "string") {
      throw new Error(`Invalid food item: missing ${key}`);
    }
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

  if (![7, 14, 30].includes(trashAutoDeleteDays)) {
    throw new Error("Invalid settings payload: trashAutoDeleteDays");
  }

  if (!["light", "standard", "high"].includes(reminderStrategy)) {
    throw new Error("Invalid settings payload: reminderStrategy");
  }

  if (!["light", "dark"].includes(theme)) {
    throw new Error("Invalid settings payload: theme");
  }

  return {
    trashAutoDeleteDays,
    reminderStrategy,
    theme
  };
}

async function handleApi(req, res, pathname) {
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
      await handleApi(req, res, url.pathname);
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
