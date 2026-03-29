import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();

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

async function readJsonFile(filename, fallback) {
  try {
    const raw = await fs.readFile(path.join(root, filename), "utf8");
    if (!raw.trim()) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonString(value) {
  return sqlString(JSON.stringify(value));
}

async function main() {
  const foods = await readJsonFile("food.json", []);
  const trashItems = await readJsonFile("trash.json", []);
  const settings = await readJsonFile("setting.json", DEFAULT_SETTINGS);
  const addSettings = await readJsonFile("addSetting.json", DEFAULT_ADD_SETTINGS);
  const account = await readJsonFile("account.json", { users: [] });

  const lines = [
    "-- Seed data for Freshness Above All",
    "DELETE FROM foods;",
    "DELETE FROM trash_items;",
    "DELETE FROM app_state;",
    "DELETE FROM sessions;",
    "DELETE FROM users;"
  ];

  for (const item of Array.isArray(foods) ? foods : []) {
    if (!item?.id) {
      continue;
    }
    lines.push(
      `INSERT INTO foods (owner_type, owner_id, id, created_at, payload) VALUES ('guest', 'legacy-import', ${sqlString(item.id)}, ${sqlString(String(item.createdAt || new Date().toISOString()))}, ${jsonString(item)});`
    );
  }

  for (const item of Array.isArray(trashItems) ? trashItems : []) {
    if (!item?.id) {
      continue;
    }
    lines.push(
      `INSERT INTO trash_items (owner_type, owner_id, id, created_at, payload) VALUES ('guest', 'legacy-import', ${sqlString(item.id)}, ${sqlString(String(item.deletedAt || item.createdAt || new Date().toISOString()))}, ${jsonString(item)});`
    );
  }

  const users = Array.isArray(account?.users) ? account.users : [];
  for (const user of users) {
    const email = String(user?.email || "").trim().toLowerCase();
    const name = String(user?.name || "").trim() || email.split("@")[0] || "User";
    const createdAt = String(user?.createdAt || new Date().toISOString());
    if (!email) {
      continue;
    }
    lines.push(
      `INSERT INTO users (email, name, created_at) VALUES (${sqlString(email)}, ${sqlString(name)}, ${sqlString(createdAt)});`
    );
  }

  lines.push(
    `INSERT INTO app_state (owner_type, owner_id, key, value) VALUES ('guest', 'legacy-import', 'settings', ${jsonString(settings)}) ON CONFLICT(owner_type, owner_id, key) DO UPDATE SET value = excluded.value;`
  );
  lines.push(
    `INSERT INTO app_state (owner_type, owner_id, key, value) VALUES ('guest', 'legacy-import', 'add-settings', ${jsonString(addSettings)}) ON CONFLICT(owner_type, owner_id, key) DO UPDATE SET value = excluded.value;`
  );

  const output = `${lines.join("\n")}\n`;
  const outputPath = path.join(root, "seed.sql");
  await fs.writeFile(outputPath, output, "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
