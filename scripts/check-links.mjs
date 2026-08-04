import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ignored = new Set(["node_modules", ".git", "work"]);

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.filter((entry) => !ignored.has(entry.name)).map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return [path];
  }));
  return nested.flat();
};

const files = await walk(root);
const htmlFiles = files.filter((path) => extname(path) === ".html");
const failures = [];

const candidateFor = (url) => {
  const clean = url.split("#")[0].split("?")[0];
  if (!clean || clean.startsWith("http:") || clean.startsWith("https:") || clean.startsWith("mailto:") || clean.startsWith("tel:") || clean.startsWith("data:")) return null;
  const pathname = clean.startsWith("/") ? clean : `/${clean}`;
  const direct = resolve(root, `.${pathname}`);
  return pathname.endsWith("/") ? resolve(direct, "index.html") : direct;
};

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, "utf8");
  const urls = [...html.matchAll(/(?:href|src|action)="([^"]+)"/g)].map((match) => match[1]);
  for (const srcset of [...html.matchAll(/srcset="([^"]+)"/g)].map((match) => match[1])) {
    urls.push(...srcset.split(",").map((part) => part.trim().split(/\s+/)[0]));
  }
  for (const url of urls) {
    const candidate = candidateFor(url);
    if (!candidate) continue;
    try {
      const info = await stat(candidate);
      if (info.isDirectory()) await stat(resolve(candidate, "index.html"));
    } catch (error) {
      failures.push(`${htmlFile.replace(root, "")}: ${url}`);
    }
  }
}

if (failures.length) {
  console.error(`Broken internal references (${failures.length}):\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`Checked ${htmlFiles.length} HTML files. All internal references resolve.`);
