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

// V4: no development-style gates, placeholders, or retired components may ship.
for (const token of ["data-missing", "MISSING:", "data-vehicles-trigger", "data-mega-panel", "data-open-lead", "data-lead-sheet", "data-filter-pill", "data-walkaround", "class=\"chapter", "concepts-theme", "stat-band", "concept-feature", "concept-wide", "concept-tile"]) {
  if (combinedHtml.includes(token)) failures.push(`Retired markup remains: ${token}`);
}
if (combinedHtml.includes("/about/")) failures.push("A link to the removed /about/ route remains");

const formCount = (id) => (combinedHtml.match(new RegExp(`data-form-id="${id}"`, "g")) || []).length;
for (const id of ["request-info", "recommend-dealer", "international-dealer-inquiry"]) {
  if (formCount(id) !== 1) failures.push(`Expected one ${id} form, found ${formCount(id)}`);
}

const pageBySuffix = (suffix) => builtPages.find((page) => page.path.endsWith(suffix))?.text || "";
const vehiclesHtml = pageBySuffix("/vehicles/index.html");
const vehicleCards = (vehiclesHtml.match(/<article class="card">/g) || []).length;
if (vehicleCards !== 4) failures.push(`Vehicles page must present four vehicle cards, found ${vehicleCards}`);
for (const slug of ["venice", "carmel", "santarosa", "brawley"]) {
  if (!vehiclesHtml.includes(`href="/${slug}/"`)) failures.push(`Vehicles page is missing a link to /${slug}/`);
}
if (!pageBySuffix("/santarosa/index.html").includes("/assets/images/v3/heroes/santarosa/")) failures.push("Santarosa is not using the V3 hangar hero");
if (!pageBySuffix("/brawley/index.html").includes("/assets/images/v3/heroes/brawley/")) failures.push("Brawley is not using the V3 desert hero");
for (const slug of ["venice", "carmel"]) {
  if (pageBySuffix(`/${slug}/index.html`).includes('id="specifications"')) failures.push(`/${slug}/ must omit specifications while no verified data exists`);
}

const conceptsHubHtml = pageBySuffix("/concepts/index.html");
const conceptCards = (conceptsHubHtml.match(/<article class="card">/g) || []).length;
if (conceptCards !== 9) failures.push(`Concepts hub must present nine cards, found ${conceptCards}`);

const conceptPages = builtPages.filter((page) => /\/concepts\/[^/]+\/index\.html$/.test(page.path));
if (conceptPages.length !== 9) failures.push(`Expected nine concept detail pages, found ${conceptPages.length}`);
for (const page of conceptPages) {
  if (!/<a class="nav-link is-current" href="\/concepts\/" aria-current="page">Concepts<\/a>/.test(page.text)) failures.push(`${page.path.replace(root, "")}: Concepts navigation is not current`);
  if (/\$\d|\bMSRP\b|\b\d[\d,.]*\s*(?:hp|lb-ft|mi|in\.)\b/i.test(page.text)) failures.push(`${page.path.replace(root, "")}: prohibited production fact or price appears on concept route`);
  if (!/<h1>[^<]+<\/h1>/.test(page.text)) failures.push(`${page.path.replace(root, "")}: concept name is not a text h1`);
  if (!page.text.includes("Concept vehicle. Not offered for sale.")) failures.push(`${page.path.replace(root, "")}: missing the not-for-sale statement`);
  for (const tag of page.text.match(/<img[^>]+wordmark\.webp[^>]*>/g) || []) if (!/alt=""/.test(tag)) failures.push(`${page.path.replace(root, "")}: wordmark alt must be empty`);
}

for (const page of builtPages) {
  if (!/<a class="nav-link(?: is-current)?" href="\/owners\/"/.test(page.text)) failures.push(`${page.path.replace(root, "")}: Owners is missing from the primary navigation`);
}

const sitemap = await readFile(resolve(root, "sitemap.xml"), "utf8");
for (const route of ["vehicles", "venice", "carmel", "santarosa", "brawley", "concepts", "owners", "dealers", "contact", "faq", "recommend-dealer", "dealer-inquiry", "concepts/indio", "concepts/coachella", "concepts/brawley-r", "concepts/santarosa-r", "concepts/speedster", "concepts/yuma", "concepts/yuma-defense", "concepts/laduna", "concepts/balboa"]) {
  if (!sitemap.includes(`/${route}/`)) failures.push(`sitemap.xml is missing /${route}/`);
}
if (sitemap.includes("/about/")) failures.push("sitemap.xml still lists /about/");

const manualFiles = files.filter((path) => path.includes("/assets/manuals/") && extname(path) === ".pdf");
if (manualFiles.length !== 19) failures.push(`Expected 19 owner manuals, found ${manualFiles.length}`);
const ownersHtml = pageBySuffix("/owners/index.html");
const manualRows = (ownersHtml.match(/class="resource-row"/g) || []).length;
if (manualRows !== 19) failures.push(`Owner resources must list 19 manuals, found ${manualRows}`);

const manifest = JSON.parse(await readFile(resolve(root, "assets/build-manifest.json"), "utf8"));
if (manifest.some((entry) => entry.verified_clean !== "yes")) failures.push("Every build manifest row must record verified_clean: yes");
const v3Deliveries = manifest.filter((entry) => entry.delivered_file.startsWith("assets/images/v3/") && entry.delivered_file.endsWith(".webp"));
if (!v3Deliveries.length) failures.push("Build manifest has no V3 image deliveries");
if (v3Deliveries.some((entry) => !entry.source_width || !entry.output_width || entry.output_width > entry.source_width)) failures.push("A V3 image delivery is missing dimensions or exceeds source width");
const excludedSources = ["yuma-slide-depart-angle.jpg", "vanderhall-balboa-ev-concept-desktop-scaled.jpg", "balboa-concept.png", "laduna-slide-2.jpg", "vanderhall-balboa-ev-concept-mobile.jpg"];
for (const filename of excludedSources) if (manifest.some((entry) => entry.source_path.endsWith(filename))) failures.push(`Excluded source appears in the manifest: ${filename}`);
for (const fragment of ["easter-sunset", "assets/images/v2/concepts", "brawley/walkaround", "assets/images/v3/vehicles"]) if (files.some((path) => path.includes(fragment))) failures.push(`Retired delivery remains: ${fragment}`);

// Every image referenced by the built pages must exist on disk, and nothing delivered may go unreferenced.
const referenced = new Set();
for (const page of builtPages) {
  for (const match of page.text.matchAll(/(?:src|srcset)="([^"]+)"/g)) {
    for (const candidate of match[1].split(",")) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url.startsWith("/assets/")) referenced.add(url);
    }
  }
}
for (const url of referenced) {
  if (!files.some((path) => path.replace(root, "") === url)) failures.push(`Referenced asset is missing from the build: ${url}`);
}
const deliveredImages = files.filter((path) => /\/assets\/(?:images|brand)\/.+\.(?:webp|svg|png)$/.test(path)).map((path) => path.replace(root, ""));
const orphans = deliveredImages.filter((url) => !referenced.has(url) && !url.startsWith("/assets/brand/"));
if (orphans.length) failures.push(`Delivered images that no page references: ${orphans.join(", ")}`);

if (failures.length) {
  console.error(`Content checks failed (${failures.length}):\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`Content checks passed across ${builtPages.length} pages. Zero public data gates or placeholders remain.`);
