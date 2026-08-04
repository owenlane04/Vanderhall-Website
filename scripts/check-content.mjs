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

const htmlFiles = files.filter((path) => extname(path) === ".html");
const builtPages = await Promise.all(htmlFiles.map(async (path) => ({ path, text: await readFile(path, "utf8") })));
const combinedHtml = builtPages.map((page) => page.text).join("\n");
for (const token of ["data-vehicles-trigger", "data-mega-panel", "aria-haspopup", "data-open-lead", "data-lead-sheet", "data-filter-pill"]) {
  if (combinedHtml.includes(token)) failures.push(`Retired markup remains: ${token}`);
}

const formCount = (id) => (combinedHtml.match(new RegExp(`data-form-id="${id}"`, "g")) || []).length;
if (formCount("request-info") !== 1) failures.push(`Expected one request-info form, found ${formCount("request-info")}`);
if (formCount("recommend-dealer") !== 1) failures.push(`Expected one recommend-dealer form, found ${formCount("recommend-dealer")}`);
if (formCount("international-dealer-inquiry") !== 1) failures.push(`Expected one international-dealer-inquiry form, found ${formCount("international-dealer-inquiry")}`);

const pageBySuffix = (suffix) => builtPages.find((page) => page.path.endsWith(suffix))?.text || "";
const vehiclesHtml = pageBySuffix("/vehicles/index.html");
if ((vehiclesHtml.match(/<section class="chapter/g) || []).length !== 4) failures.push("Vehicles page must contain four editorial chapters");
if ((vehiclesHtml.match(/<dl class="chapter__facts"/g) || []).length !== 2) failures.push("Only Santarosa and Brawley chapters may contain fact lists");
if ((vehiclesHtml.match(/data-missing="data\/msrp"/g) || []).length !== 4) failures.push("Vehicles chapters must render four MSRP gates");

const conceptPages = builtPages.filter((page) => /\/concepts\/[^/]+\/index\.html$/.test(page.path));
if (conceptPages.length !== 9) failures.push(`Expected nine concept detail pages, found ${conceptPages.length}`);
for (const page of conceptPages) {
  if (!/<a class="nav-link" href="\/concepts\/" aria-current="page">Concepts<\/a>/.test(page.text)) failures.push(`${page.path.replace(root, "")}: Concepts navigation is not current`);
  if (/\$\d|\bMSRP\b|\b\d[\d,.]*\s*(?:hp|lb-ft|mi|in\.)\b/i.test(page.text)) failures.push(`${page.path.replace(root, "")}: prohibited production fact or price appears on concept route`);
  if (!/<h1>[^<]+<\/h1>/.test(page.text)) failures.push(`${page.path.replace(root, "")}: concept name is not a text h1`);
  for (const tag of page.text.match(/<img[^>]+wordmark\.webp[^>]*>/g) || []) if (!/alt=""/.test(tag)) failures.push(`${page.path.replace(root, "")}: wordmark alt must be empty`);
}

const sitemap = await readFile(resolve(root, "sitemap.xml"), "utf8");
for (const route of ["owners", "concepts/indio", "concepts/coachella", "concepts/brawley-r", "concepts/santarosa-r", "concepts/speedster", "concepts/yuma", "concepts/yuma-defense", "concepts/laduna", "concepts/balboa"]) {
  if (!sitemap.includes(`/${route}/`)) failures.push(`sitemap.xml is missing /${route}/`);
}

const manualFiles = files.filter((path) => path.includes("/assets/manuals/") && extname(path) === ".pdf");
if (manualFiles.length !== 19) failures.push(`Expected 19 owner manuals, found ${manualFiles.length}`);

const manifest = JSON.parse(await readFile(resolve(root, "assets/build-manifest.json"), "utf8"));
if (manifest.some((entry) => entry.verified_clean !== "yes")) failures.push("Every build manifest row must record verified_clean: yes");
const v3Deliveries = manifest.filter((entry) => entry.delivered_file.startsWith("assets/images/v3/") && entry.delivered_file.endsWith(".webp"));
if (!v3Deliveries.length) failures.push("Build manifest has no V3 image deliveries");
if (v3Deliveries.some((entry) => !entry.source_width || !entry.output_width || entry.output_width > entry.source_width)) failures.push("A V3 image delivery is missing dimensions or exceeds source width");
const excludedSources = ["yuma-slide-depart-angle.jpg", "vanderhall-balboa-ev-concept-desktop-scaled.jpg", "balboa-concept.png", "laduna-slide-2.jpg", "vanderhall-balboa-ev-concept-mobile.jpg"];
for (const filename of excludedSources) if (manifest.some((entry) => entry.source_path.endsWith(filename))) failures.push(`Excluded source appears in the manifest: ${filename}`);
for (const fragment of ["easter-sunset", "assets/images/v2/heroes/santarosa", "assets/images/v2/concepts"]) if (files.some((path) => path.includes(fragment))) failures.push(`Retired delivery remains: ${fragment}`);

if (failures.length) {
  console.error(`Content checks failed (${failures.length}):\n${failures.join("\n")}`);
  process.exit(1);
}

const missingCount = builtPages.reduce((total, page) => total + (page.text.match(/data-missing=/g) || []).length, 0);
console.log(`Content checks passed. ${missingCount} explicit MISSING blocks remain across generated pages.`);
