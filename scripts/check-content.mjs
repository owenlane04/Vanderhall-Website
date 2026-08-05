import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// Imported to compare what the pages publish against the one source those strings come from. The
// counts asserted below are hardcoded on purpose, so the structural checks stay independent of the
// generator: importing the data proves the strings match, the counts prove the shape is right.
import { modelBySlug, SPEC_DISCLAIMER } from "../src/data/models.mjs";
import { conceptBySlug } from "../src/data/concepts.mjs";

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
// V6 removes data-walkaround from this list: the studio viewer is back, on /brawley/gts/ only,
// and is asserted positively below. row-links joins the list, replaced by the pathway cards.
// V8 retires the unit toggle: every figure ships imperial, so a second value cannot go stale or
// be derived here. concept-back and resource-row are retired by the site-wide back affordance and
// the owners page cards that replaced them.
for (const token of ["data-missing", "MISSING:", "data-vehicles-trigger", "data-mega-panel", "data-open-lead", "data-lead-sheet", "data-filter-pill", "class=\"chapter", "concepts-theme", "stat-band", "concept-feature", "concept-wide", "concept-tile", "card-grid--vehicles", "card-grid--related", "class=\"gallery", "chip--status", "faq-list", "concept-ring", "row-links", "unit-toggle", "data-unit", "data-spec-table", "unit-metric", "vhw.units", "spec-toolbar", "concept-back", "resource-row"]) {
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
// V6 order: the flagship leads, then the other electric vehicle, then the two roadsters.
const MODEL_SLUGS = ["brawley", "santarosa", "carmel", "venice"];

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
  const blocks = scroll.split('<section class="vehicle-section').slice(1);
  if (blocks.length !== 4) failures.push(`${route}: expected four vehicle sections, found ${blocks.length}`);
  // Each section now links to its model page more than once, because the photographs became links
  // too, so the order is read one section at a time rather than from a flat list of hrefs.
  const order = blocks.map((block) => block.match(/href="\/(brawley|santarosa|carmel|venice)\/"/)?.[1] || "none");
  if (JSON.stringify(order) !== JSON.stringify(MODEL_SLUGS)) failures.push(`${route}: vehicle sections must link to ${MODEL_SLUGS.join(", ")} in order, found ${order.join(", ") || "none"}`);
  // Media links must never take a tab stop or a name away from the text link beneath them.
  for (const block of blocks) {
    for (const tag of block.match(/<a class="vehicle-section__(?:lead|support)"[^>]*>/g) || []) {
      if (!tag.includes('tabindex="-1"') || !tag.includes('aria-hidden="true"')) failures.push(`${route}: a vehicle media link is not removed from the tab order`);
    }
  }
}
// The vehicles page is the fuller version of the same scroll: three photographs per vehicle.
const supportFrames = (vehiclesHtml.match(/vehicle-section__support/g) || []).length;
if (supportFrames !== 8) failures.push(`/vehicles/ must carry two supporting photographs per vehicle, found ${supportFrames}`);
if ((homeHtml.match(/vehicle-section__support/g) || []).length !== 0) failures.push("The homepage must stay the short version with one photograph per vehicle");

// Model pages end on their own content: a photo scroll where each photograph carries the figures it
// shows, then the disclosure line. Nothing pushes the visitor back out to other models.
//
// SPEC_GROUP_COUNTS is stated here rather than read from the data, so the assertion stays
// independent of the generator it is checking. models.mjs is imported too, but only to compare the
// published strings against their source of truth; the counts below are the non-circular anchor.
const MODULE_COUNTS = { venice: 6, carmel: 6, santarosa: 5, brawley: 6 };
const SPEC_GROUP_COUNTS = { venice: 4, carmel: 6, santarosa: 5, brawley: 6 };
const SPEC_ROW_COUNTS = { venice: 19, carmel: 15, santarosa: 28, brawley: 28 };
for (const slug of MODEL_SLUGS) {
  const html = pageBySuffix(`/${slug}/index.html`);
  const model = modelBySlug[slug];
  const found = (html.match(/<figure class="photo-module/g) || []).length;
  if (found !== MODULE_COUNTS[slug]) failures.push(`/${slug}/ must present ${MODULE_COUNTS[slug]} photo modules, found ${found}`);
  // The bar carries the way back on every model page now, so all four have it.
  if (!html.includes('class="model-bar')) failures.push(`/${slug}/ is missing the sticky model bar`);
  if (!html.includes(`A closer look at ${slug[0].toUpperCase() + slug.slice(1)}.`)) failures.push(`/${slug}/ is missing its in-detail heading`);
  // Every module needs a label, and the label must be the caption's first child, because the
  // specification block follows it.
  const labels = (html.match(/photo-module__body">\s*<p class="eyebrow">/g) || []).length;
  if (labels !== MODULE_COUNTS[slug]) failures.push(`/${slug}/ has ${labels} module labels for ${found} modules`);
  // Specification groups are paired with photographs, one group per photograph.
  const specBlocks = (html.match(/class="photo-module__specs"/g) || []).length;
  if (specBlocks !== SPEC_GROUP_COUNTS[slug]) failures.push(`/${slug}/ must pair ${SPEC_GROUP_COUNTS[slug]} specification groups with photographs, found ${specBlocks}`);
  if (specBlocks !== model.specGroups.length) failures.push(`/${slug}/ pairs ${specBlocks} groups but the data declares ${model.specGroups.length}`);
  const rows = (html.match(/class="spec-row"/g) || []).length;
  if (rows !== SPEC_ROW_COUNTS[slug]) failures.push(`/${slug}/ must publish ${SPEC_ROW_COUNTS[slug]} specification rows, found ${rows}`);
  // Every declared row must actually reach the page. A group silently dropped from a pairing is
  // the failure this catches.
  for (const group of model.specGroups) {
    for (const row of group.rows) {
      if (!html.includes(`<span>${row.label}</span>`)) failures.push(`/${slug}/ is missing the specification label ${row.label}`);
      if (!html.includes(row.value.replaceAll("&", "&amp;"))) failures.push(`/${slug}/ is missing the value for ${row.label}: ${row.value}`);
    }
  }
  // The prose captions are gone. After a label comes either the figures or the end of the caption,
  // never a sentence about where the vehicle was parked.
  const captionShapes = (html.match(/photo-module__body">\s*<p class="eyebrow">[^<]*<\/p>(?:<div class="photo-module__specs">|\s*<\/figcaption>)/g) || []).length;
  if (captionShapes !== MODULE_COUNTS[slug]) failures.push(`/${slug}/ has ${captionShapes} modules in the label-then-figures shape, expected ${MODULE_COUNTS[slug]}`);
  // Model pages carry no specification table and no anchor to one. The purchase page is asserted
  // separately below, and holds the only copy on the site.
  for (const token of ['id="specifications"', 'class="spec-table"', "Published figures"]) {
    if (html.includes(token)) failures.push(`/${slug}/ must not carry ${token}: figures are paired with photographs now`);
  }
  // The estimate sentence belongs on every page that publishes figures.
  if (!html.includes(SPEC_DISCLAIMER)) failures.push(`/${slug}/ must carry the specification estimate disclaimer`);
  // Warranty on the current models, a model-year qualifier on the past ones. Never both, because a
  // warranty term for a vehicle no longer sold would mislead.
  if (model.pastModel) {
    if (!html.includes(model.specNote)) failures.push(`/${slug}/ must state which model year its figures describe`);
    if (html.includes("limited warranty")) failures.push(`/${slug}/ is a past model and must publish no warranty term`);
  } else {
    if (!html.includes(model.warranty)) failures.push(`/${slug}/ must carry its warranty line`);
    if (model.specNote) failures.push(`/${slug}/ is a current model and needs no model-year qualifier`);
  }
}
if ((combinedHtml.match(/class="photo-module__specs"/g) || []).length !== Object.values(SPEC_GROUP_COUNTS).reduce((a, b) => a + b, 0)) {
  failures.push("Paired specification blocks appear outside the four model pages");
}

// Past models. Owen confirmed on 2026-08-05 that Venice and Carmel are past models and that
// Brawley and Santarosa are current. Six occurrences: two cards on each lineup surface, and the
// two model page heroes. A tag on a current model, or a missing tag on a past one, fails here.
const PAST_MODELS = ["venice", "carmel"];
const totalTags = (combinedHtml.match(/>Past model</g) || []).length;
if (totalTags !== 6) failures.push(`Expected six Past model tags sitewide, found ${totalTags}`);
for (const slug of MODEL_SLUGS) {
  const html = pageBySuffix(`/${slug}/index.html`);
  const tags = (html.match(/>Past model</g) || []).length;
  const expected = PAST_MODELS.includes(slug) ? 1 : 0;
  if (tags !== expected) failures.push(`/${slug}/ must carry ${expected} Past model tag, found ${tags}`);
  if (expected && !/<h1>[^<]*<\/h1>\s*<p class="model-tag">/.test(html)) failures.push(`/${slug}/ must place the Past model tag directly after the heading`);
}
for (const [route, html] of [["/", homeHtml], ["/vehicles/", vehiclesHtml]]) {
  const blocks = withoutFooter(html).split('<section class="vehicle-section').slice(1);
  for (const block of blocks) {
    const slug = block.match(/href="\/(brawley|santarosa|carmel|venice)\/"/)?.[1];
    const tagged = block.includes(">Past model<");
    if (tagged !== PAST_MODELS.includes(slug)) failures.push(`${route}: ${slug} ${tagged ? "must not be" : "must be"} tagged as a past model`);
  }
}
// Prices exist on exactly one route. V1 through V5 published none at all, and V6 publishes the
// Brawley GTS MSRP and its three paint tiers under Owen's approval of 2026-08-05, sourced from
// vanderhallusa.com. Anywhere else, a dollar amount still means something unverified escaped.
const GTS_PATH = "/brawley/gts/index.html";
const GTS_AMOUNTS = ["$49,950", "$0", "$750", "$1,050"];
const gtsHtml = pageBySuffix(GTS_PATH);
for (const page of builtPages) {
  const isGts = page.path.endsWith(GTS_PATH);
  const amounts = [...page.text.matchAll(/\$[\d,]+/g)].map((match) => match[0]);
  const unexpected = amounts.filter((amount) => !isGts || !GTS_AMOUNTS.includes(amount));
  if (unexpected.length) failures.push(`${page.path.replace(root, "")}: unapproved price ${[...new Set(unexpected)].join(", ")}`);
  if (!isGts && /class="price\b|\bMSRP\b/.test(page.text)) failures.push(`${page.path.replace(root, "")}: a price block appears where no price is approved`);
}
for (const amount of GTS_AMOUNTS) {
  if (!gtsHtml.includes(amount)) failures.push(`/brawley/gts/ is missing the approved amount ${amount}`);
}

// The purchase page: one viewer, nine paint options in one radio group, eight frames, the
// reservation link, and every disclosure the price obliges. Controls ship hidden and swatches ship
// disabled so the page without JavaScript shows a photograph rather than dead controls.
const viewers = (gtsHtml.match(/data-walkaround(?=[\s>])/g) || []).length;
if (viewers !== 1) failures.push(`/brawley/gts/ must carry exactly one walkaround viewer, found ${viewers}`);
if ((combinedHtml.match(/data-walkaround(?=[\s>])/g) || []).length !== 1) failures.push("The walkaround viewer must appear on /brawley/gts/ only");
const swatchCount = (gtsHtml.match(/class="swatch(?: is-selected)?"/g) || []).length;
if (swatchCount !== 9) failures.push(`/brawley/gts/ must offer nine paint options, found ${swatchCount}`);
// One group for all nine, not one per tier, so arrow keys cover the whole palette. The unit
// toggle is the page's other radio group and is matched by its own label.
if ((gtsHtml.match(/role="radiogroup" aria-label="Paint"/g) || []).length !== 1) failures.push("/brawley/gts/ paint options must sit in one radio group, so arrow keys cover all nine");
const frameCount = (gtsHtml.match(/class="walkaround__frame/g) || []).length;
if (frameCount !== 8) failures.push(`/brawley/gts/ must stack eight studio frames, found ${frameCount}`);
if (!gtsHtml.includes('aria-roledescription="360 viewer"')) failures.push("/brawley/gts/ viewer is missing its 360 role description");
if (!gtsHtml.includes("data-walkaround-live")) failures.push("/brawley/gts/ viewer is missing its live region");
if (!/data-walkaround-controls hidden/.test(gtsHtml)) failures.push("/brawley/gts/ viewer controls must ship hidden for the no-JavaScript state");
if ((gtsHtml.match(/class="swatch[^"]*"[^>]*disabled/g) || []).length !== 9) failures.push("/brawley/gts/ swatches must ship disabled for the no-JavaScript state");
if ((gtsHtml.match(/fetchpriority="high"/g) || []).length !== 1) failures.push("/brawley/gts/ must promote exactly one frame to high priority");
const RESERVE_URL = "https://dealer.vanderhallusa.com/reserve/index/brawley";
const reserveLinks = (gtsHtml.match(new RegExp(`href="${RESERVE_URL}"`, "g")) || []).length;
if (reserveLinks !== 3) failures.push(`/brawley/gts/ must carry three reservation links, found ${reserveLinks}`);
for (const required of [
  "Manufacturer's Suggested Retail Price. Excludes options; taxes; title; registration; delivery, processing and handling fee; dealer charges.",
  "Features and specifications are estimated and subject to change without notice.",
  "The Brawley is an off-road, electric vehicle not intended for on-road use and can be hazardous to operate.",
  "Some states may require additional training and certification.",
  "Never ride under the influence of alcohol or drugs.",
  "Refer to the relevant owner's manual and all safety warnings before driving or riding.",
  "Now delivering in select regions.",
]) {
  if (!gtsHtml.includes(required)) failures.push(`/brawley/gts/ is missing required disclosure text: ${required.slice(0, 48)}`);
}
// Brawley is the one model with a page beyond the inquiry form, so its bar and hero point there.
if (!pageBySuffix("/brawley/index.html").includes('class="model-bar__action" href="/brawley/gts/"')) failures.push("/brawley/ model bar must lead to the purchase page");
if (!gtsHtml.includes('class="model-bar__action" href="https://dealer.vanderhallusa.com/reserve/index/brawley"')) failures.push("/brawley/gts/ model bar must carry the reservation link");
// V8 renamed the destination. "See more info" promised information and delivered a configurator
// with a price, which is what read as three pages of "more" in a row. The label appears twice on
// the page, once in the hero and once in the bar, from one string in the data.
const brawleyLabels = (pageBySuffix("/brawley/index.html").match(/>Pricing and colors</g) || []).length;
if (brawleyLabels !== 2) failures.push(`/brawley/ must offer Pricing and colors in both the hero and the model bar, found ${brawleyLabels}`);
if (combinedHtml.includes("See more info")) failures.push("The retired See more info label remains");
// The purchase page holds the only specification table and the only anchor to one on the site.
if (!gtsHtml.includes('id="specifications"')) failures.push("/brawley/gts/ must keep its specification anchor");
if (!gtsHtml.includes('class="spec-table"')) failures.push("/brawley/gts/ must keep its specification table");
if (!gtsHtml.includes("Published figures")) failures.push("/brawley/gts/ must keep its specification heading");
const anchorCount = (combinedHtml.match(/id="specifications"/g) || []).length;
if (anchorCount !== 1) failures.push(`The specifications anchor must exist once sitewide, found ${anchorCount}`);
for (const slug of ["santarosa", "carmel", "venice"]) {
  if (!pageBySuffix(`/${slug}/index.html`).includes(`href="/dealers/?model=${slug}"`)) failures.push(`/${slug}/ must still lead to the inquiry form`);
}

// Two pathway cards each, in place of the V5 row of bare headings under a hairline rule.
for (const [route, html] of [["/", homeHtml], ["/dealers/", dealersHtml]]) {
  const cards = (html.match(/class="pathway"/g) || []).length;
  if (cards !== 2) failures.push(`${route}: expected two pathway cards, found ${cards}`);
}

if (!pageBySuffix("/santarosa/index.html").includes("/assets/images/v3/heroes/santarosa/")) failures.push("Santarosa is not using the V3 hangar hero");
if (!pageBySuffix("/brawley/index.html").includes("/assets/images/v3/heroes/brawley/")) failures.push("Brawley is not using the V3 desert hero");

// One way back from every page below the homepage, leading one level up. This map mirrors PARENTS
// in src/build.mjs: if a route's back link disagrees with it, or a page has none, the build fails.
// The 404 pair is exempt, because it already offers two ways out and has no parent.
const BACK_TARGETS = {
  "/vehicles/index.html": "/",
  "/concepts/index.html": "/",
  "/owners/index.html": "/",
  "/dealers/index.html": "/",
  "/recommend-dealer/index.html": "/dealers/",
  "/dealer-inquiry/index.html": "/dealers/",
  "/venice/index.html": "/vehicles/",
  "/carmel/index.html": "/vehicles/",
  "/santarosa/index.html": "/vehicles/",
  "/brawley/index.html": "/vehicles/",
  "/brawley/gts/index.html": "/brawley/",
};
for (const page of builtPages) {
  const relative = page.path.replace(root, "");
  const isHome = page.path === resolve(root, "index.html");
  const is404 = relative === "/404/index.html" || relative === "/404.html";
  const navs = page.text.match(/<nav class="back-nav"[\s\S]*?<\/nav>/g) || [];
  if (isHome || is404) {
    if (navs.length) failures.push(`${relative}: must not carry a back link`);
    continue;
  }
  if (navs.length !== 1) {
    failures.push(`${relative}: expected one back link, found ${navs.length}`);
    continue;
  }
  const expected = BACK_TARGETS[relative] ?? (/\/concepts\/[^/]+\/index\.html$/.test(relative) ? "/concepts/" : null);
  if (!expected) failures.push(`${relative}: no back-link target is declared for this route`);
  else if (!navs[0].includes(`href="${expected}"`)) failures.push(`${relative}: back link must lead to ${expected}`);
  if ((navs[0].match(/<a /g) || []).length !== 1) failures.push(`${relative}: the back link must be a single link`);
}

// Structured data is held to the same rule as the visible copy: it may only restate an approved
// value. A price that drifts between the markup and the page is the failure mode worth catching.
const schemaOf = (html) => (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [])
  .map((block) => JSON.parse(block.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "").replaceAll("<\\/", "</")));
const gtsSchemas = schemaOf(gtsHtml);
if (gtsSchemas.length !== 1) failures.push(`/brawley/gts/ must carry one JSON-LD block, found ${gtsSchemas.length}`);
else {
  const product = gtsSchemas[0];
  if (product["@type"] !== "Product") failures.push("/brawley/gts/ JSON-LD must describe a Product");
  if (product.offers?.price !== "49950" || product.offers?.priceCurrency !== "USD") failures.push(`/brawley/gts/ JSON-LD price must match the published price, found ${product.offers?.price} ${product.offers?.priceCurrency}`);
  if (product.offers?.url !== "https://dealer.vanderhallusa.com/reserve/index/brawley") failures.push("/brawley/gts/ JSON-LD offer must point at the reservation system");
  if (!product.image?.endsWith(".webp")) failures.push("/brawley/gts/ JSON-LD image must be a delivered WebP frame");
}
const homeSchemas = schemaOf(homeHtml);
if (homeSchemas.length !== 1 || !homeSchemas[0]["@graph"]?.some((node) => node["@type"] === "Organization")) failures.push("The homepage must carry one JSON-LD block describing the organization");
// No other page asserts structured data, so none can drift out of step with its own copy.
for (const page of builtPages) {
  const count = schemaOf(page.text).length;
  const expected = page.path.endsWith("/brawley/gts/index.html") || page.path === resolve(root, "index.html") ? 1 : 0;
  if (count !== expected) failures.push(`${page.path.replace(root, "")}: expected ${expected} JSON-LD blocks, found ${count}`);
}
// Every page states its own canonical, so the trailing-slash routes cannot compete with themselves.
for (const page of builtPages) {
  if (!/rel="canonical" href="https:\/\/vanderhall-website\.vercel\.app\//.test(page.text)) failures.push(`${page.path.replace(root, "")}: missing a canonical URL`);
}

const conceptsHubHtml = pageBySuffix("/concepts/index.html");
const conceptCards = (conceptsHubHtml.match(/<article class="card">/g) || []).length;
if (conceptCards !== 9) failures.push(`Concepts hub must present nine cards, found ${conceptCards}`);

const conceptPages = builtPages.filter((page) => /\/concepts\/[^/]+\/index\.html$/.test(page.path));
if (conceptPages.length !== 9) failures.push(`Expected nine concept detail pages, found ${conceptPages.length}`);
for (const page of conceptPages) {
  if (!/<a class="nav-link is-current" href="\/concepts\/" aria-current="page">Concepts<\/a>/.test(page.text)) failures.push(`${page.path.replace(root, "")}: Concepts navigation is not current`);
  if (/\$\d|\bMSRP\b|\b\d[\d,.]*\s*(?:hp|lb-ft|mi|in\.)\b/i.test(page.text)) failures.push(`${page.path.replace(root, "")}: prohibited production fact or price appears on concept route`);
  if (!page.text.includes("Concept vehicle. Not offered for sale.")) failures.push(`${page.path.replace(root, "")}: missing the not-for-sale statement`);
  // One title per concept, the script wordmark, which is the concept's own mark. It used to sit
  // under a sans h1 of the same word. The alt carries the name, so the heading still says it and a
  // failed image still reads.
  const heading = page.text.match(/<h1 class="concept-title">([\s\S]*?)<\/h1>/);
  if (!heading) failures.push(`${page.path.replace(root, "")}: the concept title must be the wordmark h1`);
  else {
    const slug = page.path.replace(root, "").split("/")[2];
    const name = conceptBySlug[slug]?.name;
    if (!heading[1].includes("wordmark.webp")) failures.push(`${page.path.replace(root, "")}: the h1 must contain the wordmark image`);
    if (/<p|<span/.test(heading[1])) failures.push(`${page.path.replace(root, "")}: the h1 must contain nothing but the wordmark`);
    if (name && !heading[1].includes(`alt="${name}"`)) failures.push(`${page.path.replace(root, "")}: the wordmark alt must be the concept name`);
  }
  if (/<span class="wordmark"/.test(page.text)) failures.push(`${page.path.replace(root, "")}: the wordmark plate markup remains`);
}

for (const page of builtPages) {
  for (const [label, href] of [["Owners", "/owners/"], ["Dealers", "/dealers/"]]) {
    if (!new RegExp(`<a class="nav-link(?: is-current)?" href="${href}"`).test(page.text)) failures.push(`${page.path.replace(root, "")}: ${label} is missing from the primary navigation`);
  }
}

const sitemap = await readFile(resolve(root, "sitemap.xml"), "utf8");
for (const route of ["vehicles", "venice", "carmel", "santarosa", "brawley", "brawley/gts", "concepts", "owners", "dealers", "recommend-dealer", "dealer-inquiry", "concepts/indio", "concepts/coachella", "concepts/brawley-r", "concepts/santarosa-r", "concepts/speedster", "concepts/yuma", "concepts/yuma-defense", "concepts/laduna", "concepts/balboa"]) {
  if (!sitemap.includes(`/${route}/`)) failures.push(`sitemap.xml is missing /${route}/`);
}
for (const route of ["/about/", "/faq/", "/contact/"]) {
  if (sitemap.includes(route)) failures.push(`sitemap.xml still lists ${route}`);
}

const manualFiles = files.filter((path) => path.includes("/assets/manuals/") && extname(path) === ".pdf");
if (manualFiles.length !== 19) failures.push(`Expected 19 owner manuals, found ${manualFiles.length}`);
const ownersHtml = pageBySuffix("/owners/index.html");
const manualCards = (ownersHtml.match(/class="resource-card"/g) || []).length;
if (manualCards !== 19) failures.push(`Owner resources must list 19 manuals, found ${manualCards}`);
if ((ownersHtml.match(/type="application\/pdf"/g) || []).length !== 19) failures.push("Every owner resource card must declare its PDF type");
// V8 gave the groups the vehicle they are about. Venice, Carmel, and Brawley have delivered
// photography; Speedster and Laguna are retired roadsters with none in Assets/, and the concept
// named Speedster is a different machine that must not stand in for one.
// Footer first: the last group's slice would otherwise run to the end of the document and count
// the footer lockup as its photograph.
const ownerGroups = withoutFooter(ownersHtml).split('<section class="resource-group').slice(1);
if (ownerGroups.length !== 5) failures.push(`Owner resources must present five model groups, found ${ownerGroups.length}`);
for (const group of ownerGroups) {
  const slug = group.match(/id="([^"]+)"/)?.[1];
  const images = (group.match(/<img /g) || []).length;
  const expected = ["venice", "carmel", "brawley"].includes(slug) ? 1 : 0;
  if (images !== expected) failures.push(`/owners/ group ${slug} must carry ${expected} photograph, found ${images}`);
}

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
for (const fragment of ["easter-sunset", "assets/images/v2/concepts", "assets/images/v3/vehicles"]) if (files.some((path) => path.includes(fragment))) failures.push(`Retired delivery remains: ${fragment}`);
// The studio walkaround returns in V6: eight angles for each of the eight complete colours, plus
// one still for Jean Grey, at two rungs each. Concrete Grey is not offered and is not delivered.
const walkaroundRows = manifest.filter((entry) => entry.delivered_file.includes("brawley/walkaround"));
if (walkaroundRows.length !== 130) failures.push(`Expected 130 walkaround frames in the manifest, found ${walkaroundRows.length}`);
if (walkaroundRows.some((entry) => !entry.output_width || entry.output_width > entry.source_width)) failures.push("A walkaround frame is missing dimensions or exceeds its source width");
if (walkaroundRows.some((entry) => entry.delivered_file.includes("concrete-grey"))) failures.push("Concrete Grey is not offered and must not be delivered");

// Every image referenced by the built pages must exist on disk, and nothing delivered may go unreferenced.
// data-frames and data-still are read too. The viewer builds its frame list from those attributes
// rather than from a path template, which is what lets one source satisfy both the runtime and
// this check: a frame no page can reach fails the build instead of shipping unreachable.
const referenced = new Set();
for (const page of builtPages) {
  for (const match of page.text.matchAll(/(?:src|srcset|data-frames|data-still)="([^"]+)"/g)) {
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
