const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const FOOD_PATH = path.join(ROOT, "food.json");

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

async function handleApi(req, res, pathname) {
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
