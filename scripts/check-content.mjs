import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ignored = new Set(["node_modules", ".git", "public", ".vercel"]);

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.filter((entry) => !ignored.has(entry.name)).map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
};

const files = await walk(root);
const textExtensions = new Set([".html", ".css", ".js", ".mjs", ".json", ".txt"]);
const textFiles = files.filter((path) => textExtensions.has(extname(path)));
const failures = [];

for (const path of textFiles) {
  const text = await readFile(path, "utf8");
  if (text.includes("\u2014")) failures.push(`${path.replace(root, "")}: contains an em dash`);
  if (extname(path) === ".html") {
    const h1Count = (text.match(/<h1(?:\s|>)/g) || []).length;
    if (h1Count !== 1) failures.push(`${path.replace(root, "")}: expected one h1, found ${h1Count}`);
    if (/\.jpe?g(?:["'\s?])/i.test(text) || /(?:src|href)="(?!\/assets\/brand\/)[^"]+\.png/i.test(text)) failures.push(`${path.replace(root, "")}: references a source photo raster format`);
  }
  if (extname(path) === ".css" && !path.endsWith("tokens.css") && !path.endsWith("bundle.css") && /#[0-9a-f]{3,8}\b/i.test(text)) failures.push(`${path.replace(root, "")}: raw hex value outside tokens.css`);
}

const sourceRasters = files.filter((path) => /\.(?:jpe?g)$/i.test(path));
if (sourceRasters.length) failures.push(`Source JPEGs shipped: ${sourceRasters.map((path) => path.replace(root, "")).join(", ")}`);

if (failures.length) {
  console.error(`Content checks failed (${failures.length}):\n${failures.join("\n")}`);
  process.exit(1);
}

const html = await Promise.all(files.filter((path) => extname(path) === ".html").map((path) => readFile(path, "utf8")));
const missingCount = html.reduce((total, page) => total + (page.match(/data-missing=/g) || []).length, 0);
console.log(`Content checks passed. ${missingCount} explicit MISSING blocks remain across generated pages.`);
