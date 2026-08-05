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

// No development-style gates, placeholders, or retired components may ship. The V5 additions
// are the card wall, the gallery grid, the related-vehicles grid, the concept ring, the status
// chips, and the FAQ list, all replaced by the vehicle sections and the photo scroll.
for (const token of ["data-missing", "MISSING:", "data-vehicles-trigger", "data-mega-panel", "data-open-lead", "data-lead-sheet", "data-filter-pill", "data-walkaround", "class=\"chapter", "concepts-theme", "stat-band", "concept-feature", "concept-wide", "concept-tile", "card-grid--vehicles", "card-grid--related", "class=\"gallery", "chip--status", "faq-list", "concept-ring"]) {
  if (combinedHtml.includes(token)) failures.push(`Retired markup remains: ${token}`);
}
for (const route of ["/about/", "/faq/", "/contact/"]) {
  if (combinedHtml.includes(route)) failures.push(`A link to the removed ${route} route remains`);
}

const formCount = (id) => (combinedHtml.match(new RegExp(`data-form-id="${id}"`, "g")) || []).length;
for (const id of ["request-info", "recommend-dealer", "international-dealer-inquiry"]) {
  if (formCount(id) !== 1) failures.push(`Expected one ${id} form, found ${formCount(id)}`);
}

const pageBySuffix = (suffix) => builtPages.find((page) => page.path.endsWith(suffix))?.text || "";
const MODEL_SLUGS = ["venice", "carmel", "santarosa", "brawley"];

// The single Request Info form lives on /dealers/, which is also a primary navigation item.
const dealersHtml = pageBySuffix("/dealers/index.html");
if (!dealersHtml.includes('data-form-id="request-info"')) failures.push("The one request-info form must be on /dealers/");
if (!dealersHtml.includes("This form is not connected yet, so nothing you enter here is sent.")) failures.push("/dealers/ must state plainly that the form is not connected");

// Both the homepage and /vehicles/ present the same four vehicle sections in the same order,
// each linking to its model page. This replaces the V4 four-card grid on /vehicles/. The scroll
// is isolated first, because the footer also links to all four models on every page.
const homeHtml = builtPages.find((page) => page.path === resolve(root, "index.html"))?.text || "";
const vehiclesHtml = pageBySuffix("/vehicles/index.html");
const withoutFooter = (html) => html.split("<footer")[0];
for (const [route, html] of [["/", homeHtml], ["/vehicles/", vehiclesHtml]]) {
  const scroll = withoutFooter(html);
  const sections = (scroll.match(/<section class="vehicle-section/g) || []).length;
  if (sections !== 4) failures.push(`${route}: expected four vehicle sections, found ${sections}`);
  const order = [...scroll.matchAll(/href="\/(venice|carmel|santarosa|brawley)\/"/g)].map((match) => match[1]);
  if (JSON.stringify(order) !== JSON.stringify(MODEL_SLUGS)) failures.push(`${route}: vehicle sections must link to ${MODEL_SLUGS.join(", ")} in order, found ${order.join(", ") || "none"}`);
  if (/class="price|\$\d/.test(html)) failures.push(`${route}: a price appears where none is verified`);
}
// The vehicles page is the fuller version of the same scroll: three photographs per vehicle.
const supportFrames = (vehiclesHtml.match(/vehicle-section__support/g) || []).length;
if (supportFrames !== 8) failures.push(`/vehicles/ must carry two supporting photographs per vehicle, found ${supportFrames}`);
if ((homeHtml.match(/vehicle-section__support/g) || []).length !== 0) failures.push("The homepage must stay the short version with one photograph per vehicle");

// Model pages end on their own content: a photo scroll, then specifications where verified.
// Nothing pushes the visitor back out to other models.
const MODULE_COUNTS = { venice: 6, carmel: 6, santarosa: 5, brawley: 6 };
for (const slug of MODEL_SLUGS) {
  const html = pageBySuffix(`/${slug}/index.html`);
  const found = (html.match(/<figure class="photo-module/g) || []).length;
  if (found !== MODULE_COUNTS[slug]) failures.push(`/${slug}/ must present ${MODULE_COUNTS[slug]} photo modules, found ${found}`);
  if (!html.includes('class="model-bar')) failures.push(`/${slug}/ is missing the sticky model bar`);
  if (!html.includes(`A closer look at ${slug[0].toUpperCase() + slug.slice(1)}.`)) failures.push(`/${slug}/ is missing its in-detail heading`);
  // Every module needs a label and a description, or the scroll is padding rather than content.
  const labels = (html.match(/photo-module__body">\s*<p class="eyebrow">/g) || []).length;
  if (labels !== MODULE_COUNTS[slug]) failures.push(`/${slug}/ has ${labels} module labels for ${found} modules`);
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
  // One clear way back, in place of the V4 previous/all/next ring.
  const backLinks = (page.text.match(/<nav class="concept-back[\s\S]*?<\/nav>/g) || []);
  if (backLinks.length !== 1) failures.push(`${page.path.replace(root, "")}: expected one back-link nav, found ${backLinks.length}`);
  else if ((backLinks[0].match(/<a /g) || []).length !== 1 || !backLinks[0].includes('href="/concepts/"')) failures.push(`${page.path.replace(root, "")}: the back link must be a single link to /concepts/`);
}

for (const page of builtPages) {
  for (const [label, href] of [["Owners", "/owners/"], ["Dealers", "/dealers/"]]) {
    if (!new RegExp(`<a class="nav-link(?: is-current)?" href="${href}"`).test(page.text)) failures.push(`${page.path.replace(root, "")}: ${label} is missing from the primary navigation`);
  }
}

const sitemap = await readFile(resolve(root, "sitemap.xml"), "utf8");
for (const route of ["vehicles", "venice", "carmel", "santarosa", "brawley", "concepts", "owners", "dealers", "recommend-dealer", "dealer-inquiry", "concepts/indio", "concepts/coachella", "concepts/brawley-r", "concepts/santarosa-r", "concepts/speedster", "concepts/yuma", "concepts/yuma-defense", "concepts/laduna", "concepts/balboa"]) {
  if (!sitemap.includes(`/${route}/`)) failures.push(`sitemap.xml is missing /${route}/`);
}
for (const route of ["/about/", "/faq/", "/contact/"]) {
  if (sitemap.includes(route)) failures.push(`sitemap.xml still lists ${route}`);
}

const manualFiles = files.filter((path) => path.includes("/assets/manuals/") && extname(path) === ".pdf");
if (manualFiles.length !== 19) failures.push(`Expected 19 owner manuals, found ${manualFiles.length}`);
const ownersHtml = pageBySuffix("/owners/index.html");
const manualRows = (ownersHtml.match(/class="resource-row"/g) || []).length;
if (manualRows !== 19) failures.push(`Owner resources must list 19 manuals, found ${manualRows}`);

const manifest = JSON.parse(await readFile(resolve(root, "assets/build-manifest.json"), "utf8"));
if (manifest.some((entry) => entry.verified_clean !== "yes")) failures.push("Every build manifest row must record verified_clean: yes");
// V4 recorded verified_clean: yes on every row unconditionally, and six deliveries shipped the
// legacy safety paragraph anyway. The flag is now derived from the delivered crop, so these
// deliveries must each carry the derivation that proves the disclaimer band is outside it.
const CORRECTED = [
  "assets/images/v2/features/venice/motion-1280.webp",
  "assets/images/v2/features/venice/forest-road-1280.webp",
  "assets/images/v2/features/carmel/lake-reflection-1280.webp",
  "assets/images/v2/features/santarosa/sunset-1280.webp",
  "assets/images/brawley/lifestyle/desert-1280.webp",
  "assets/images/brawley/lifestyle/mountain-road-1280.webp",
  "assets/images/v3/heroes/home/home-wide-2560.webp",
];
for (const file of CORRECTED) {
  const entry = manifest.find((row) => row.delivered_file === file);
  if (!entry) failures.push(`Corrected delivery is missing from the manifest: ${file}`);
  else if (!entry.clean_basis?.includes("excluded")) failures.push(`${file} does not record a derived exclusion of its baked text band`);
}
if (manifest.some((entry) => entry.clean_basis?.includes("OVERLAPS"))) failures.push("A delivered crop overlaps a known baked text band");
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
