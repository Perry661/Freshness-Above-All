import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const publicDir = path.join(root, "public");

const files = [
  "index.html",
  "ui.js",
  "uiData.js",
  "add.js",
  "calendar.js",
  "scan.js",
  "setting.js",
  "sound.js",
  "trash.js"
];

const directories = [
  "picKeyword",
  "FAA-sound"
];

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function copyFile(relativePath) {
  await ensureDir(path.dirname(path.join(publicDir, relativePath)));
  await fs.copyFile(
    path.join(root, relativePath),
    path.join(publicDir, relativePath)
  );
}

async function copyDirectory(relativePath) {
  await fs.cp(
    path.join(root, relativePath),
    path.join(publicDir, relativePath),
    { recursive: true, force: true }
  );
}

async function removeDsStore(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await removeDsStore(fullPath);
      continue;
    }

    if (entry.name === ".DS_Store") {
      await fs.unlink(fullPath);
    }
  }
}

async function main() {
  await ensureDir(publicDir);

  for (const file of files) {
    await copyFile(file);
  }

  for (const dir of directories) {
    await copyDirectory(dir);
  }

  await removeDsStore(publicDir);
  console.log(`Synced static assets to ${publicDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
