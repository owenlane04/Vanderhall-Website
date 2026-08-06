import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// Imported to compare what the pages publish against the one source those strings come from. The
// counts asserted below are hardcoded on purpose, so the structural checks stay independent of the
// generator: importing the data proves the strings match, the counts prove the shape is right.
import { modelBySlug, SPEC_DISCLAIMER } from "../src/data/models.mjs";
import { conceptBySlug } from "../src/data/concepts.mjs";
import { privacySections } from "../src/data/privacy.mjs";
import { ambientVideos } from "../src/data/video.mjs";
import { APP_LINKS, LEGAL_LINKS, SOCIAL_LINKS } from "../src/components.mjs";

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

// Light mode was removed in V9, not defaulted away, so the tokens that could bring it back are
// banned across the source tree rather than only in built HTML: the stored preference lives in
// JavaScript, the two-value colors lived in CSS, and the control lived in both. The two check
// scripts are exempt because they have to name what they ban, and work/ is exempt because it holds
// gitignored verification output that can quote pre-V9 markup back at us. Everything that ships is
// scanned, including scripts/site.js. A comment mentioning one of these by name fails too, which is
// deliberate: the ban is on the string, so the way to discuss it is to describe it.
const RETIRED_THEME_TOKENS = ["data-theme-toggle", "vhw.theme", "light-dark(", "desktop-theme", 'data-theme="'];
const CHECK_SCRIPTS = ["check-content.mjs", "verify-browser.mjs"].map((name) => resolve(root, "scripts", name));
const themeScanned = textFiles.filter((path) => !CHECK_SCRIPTS.includes(path) && !path.startsWith(resolve(root, "work")));
for (const path of themeScanned) {
  const text = await readFile(path, "utf8");
  for (const token of RETIRED_THEME_TOKENS) {
    if (text.includes(token)) failures.push(`${path.replace(root, "")}: retired light-mode token remains: ${token}`);
  }
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
// V11 retires two more. The pathway card lost both its callers when V11-D cleared the foot of the
// homepage and V11-H cleared the foot of the dealers page; the ambient figure lost both of its
// callers when V11-A deleted the two below-fold loops. Neither component exists any more, and both
// are banned here rather than merely unreferenced, so a future edit cannot reintroduce markup whose
// styles have gone. class="pathway matches both the container and the card, which is deliberate.
// V12 retires three more. The sticky model bar went from all five pages that carried it, per Owen on
// 2026-08-06: its name repeated the heading in the photograph above it and its action repeated the
// hero button, leaving only the way back, which moved into the hero content. The word cascade and its
// .word spans went with the scrubbed reveal path in V12-C. And .gts-note lost its only caller when the
// purchase page stopped printing one disclaimer twice.
for (const token of ["data-missing", "MISSING:", "data-vehicles-trigger", "data-mega-panel", "data-open-lead", "data-lead-sheet", "data-filter-pill", "class=\"chapter", "concepts-theme", "stat-band", "concept-feature", "concept-wide", "concept-tile", "card-grid--vehicles", "card-grid--related", "class=\"gallery", "chip--status", "faq-list", "concept-ring", "row-links", "unit-toggle", "data-unit", "data-spec-table", "unit-metric", "vhw.units", "spec-toolbar", "concept-back", "resource-row", "pathway", "class=\"ambient", "ambient__", "footer-social", "class=\"model-bar", "model-bar__", "class=\"word\"", "is-split", "data-split"]) {
  if (combinedHtml.includes(token)) failures.push(`Retired markup remains: ${token}`);
}
// The stylesheet has to lose them too. A retired component whose CSS survives is dead weight that
// reads as live code to the next person to open the file.
const bundleCss = await readFile(resolve(root, "styles/bundle.css"), "utf8");
// Comments are stripped first. Naming a retired component in a note that explains why it went is
// exactly what this file is full of, and a check that forbids writing down the reason would push the
// reason out of the code.
const bundleRules = bundleCss.replace(/\/\*[\s\S]*?\*\//g, "");
for (const token of [".pathway", ".ambient", ".footer-social", ".model-bar", ".is-split", ".word", ".gts-note"]) {
  if (new RegExp(`\\${token}[\\s{,:_]`).test(bundleRules)) failures.push(`Retired component styles remain in the bundle: ${token}`);
}
// V12-C. The reveals are no longer driven by view() at all: they are IntersectionObserver-triggered
// transitions on [data-reveal], which is now the only reveal mechanism on every browser. What is left
// inside the @supports guard is the two continuous scrub effects, the hero parallax drift and the
// concept band's dissolve, and neither reveals content, so neither can hide anything from a browser
// that lacks view(). The assertions below still exist for the same reason they always did: anything
// inside that guard is invisible to a browser without timelines, so nothing that hides content may
// live there, and nothing that declares a view() timeline may live outside it.
//
// The reveal's own start state is safe by a different mechanism, asserted further down: it hangs off
// [data-reveal], which only site.js sets, so no JavaScript means no start state at all. That mattered
// in V11 and it is the whole safety story now that no CSS path renders the end state.
// Written with real brace matching, and the first version of it is why. That one searched the bundle
// for the guard with indexOf and checked everything before the match. Mutation testing said MISSED:
// indexOf had found the string inside a COMMENT, hundreds of lines above the first real guard, so
// "everything before it" was a region the reveal rules were never in. The check could not have fired
// for any input. Comments are stripped first now, and membership is decided by whether an offset
// falls inside a guard's braces rather than by whether it appears before one.
const cssRules = bundleCss.replace(/\/\*[\s\S]*?\*\//g, " ");
const guardRanges = [];
for (const match of cssRules.matchAll(/@supports \(animation-timeline: view\(\)\)\s*\{/g)) {
  let depth = 0;
  let index = match.index + match[0].length - 1;
  for (; index < cssRules.length; index += 1) {
    if (cssRules[index] === "{") depth += 1;
    else if (cssRules[index] === "}") { depth -= 1; if (depth === 0) break; }
  }
  guardRanges.push([match.index, index]);
}
const insideAGuard = (offset) => guardRanges.some(([start, end]) => offset > start && offset < end);
if (!guardRanges.length) failures.push("The scroll-scrubbed effects must stay inside an @supports (animation-timeline: view()) guard");
else {
  // The keyframe carries the start state. Outside the guard, a browser that cannot run the timeline
  // would apply opacity: 0 and never advance past it, which is content hidden with no way to reveal
  // it. verify-browser cannot test that combination, because faking the feature query needs
  // JavaScript and the case is JavaScript being absent.
  for (const match of cssRules.matchAll(/@keyframes\s+(hero-drift|strip-dissolve)\b/g)) {
    if (!insideAGuard(match.index)) failures.push(`The ${match[1]} keyframe escaped the @supports guard, so a browser without view() timelines would hide content it can never reveal`);
  }
  for (const match of cssRules.matchAll(/animation-timeline:\s*view\(\)/g)) {
    if (!insideAGuard(match.index)) failures.push("A view() timeline is declared outside the @supports guard");
  }
  // And the guards must actually contain the two effects, or they are guarding nothing.
  for (const effect of ["hero-drift", "strip-dissolve"]) {
    if (!guardRanges.some(([start, end]) => cssRules.slice(start, end).includes(`animation: ${effect}`))) {
      failures.push(`No @supports guard contains the ${effect} animation, so the guard and the animation have drifted apart`);
    }
  }
  // The scrubbed reveal is retired, and this is what stops it coming back. A rise-in inside the guard
  // would be a reveal that Safari and Firefox cannot see; outside it, one that hides content on a
  // browser without timelines. Either way it is the defect V12-C removed: a reveal with no duration,
  // spent in two frames at the bottom edge of the screen.
  if (/@keyframes\s+rise-in\b/.test(cssRules) || /animation:\s*rise-in/.test(cssRules)) {
    failures.push("The scrubbed rise-in reveal is retired: reveals are time-based transitions on [data-reveal]");
  }
}
// And the reveal's start state must be reachable ONLY through the attribute, which is what makes a
// page with no JavaScript have no start state at all. The selector list is read out and required to
// be exactly [data-reveal]: a rule that also named a class would hide that class unconditionally,
// including on a page whose script never arrived, and no browser test available here can see that
// combination because the case is JavaScript being absent. This was true in V11 and it is now the only
// thing standing between a failed script load and a page of invisible content.
// The opening delimiter includes { because this rule lives inside a media block, so the character
// before its selector is that block's own brace rather than a semicolon or a closing brace.
const fallbackRule = cssRules.match(/(^|[;{}])\s*([^{};@]*\[data-reveal\][^{};]*?)\s*\{([^}]*opacity:\s*0[^}]*)\}/);
if (!fallbackRule) failures.push("The reveal's start state must hang off [data-reveal], which only site.js sets");
else {
  const selectors = fallbackRule[2].split(",").map((entry) => entry.trim()).filter(Boolean);
  if (selectors.length !== 1 || selectors[0] !== "[data-reveal]") {
    failures.push(`The reveal's start state must be keyed on [data-reveal] alone, found: ${selectors.join(", ")}`);
  }
}
if (!/\[data-reveal="shown"\]/.test(cssRules)) failures.push("The reveal has no revealed state to transition into");
// V12-C: the reveal must be driven by a transition with a real duration. This is the assertion that
// encodes why the mechanism changed at all. A scrubbed animation advances only as far as the scroll
// does, so a flick spends its whole range in two frames and the motion is never seen; a transition
// runs on its own clock and cannot be outrun. If this rule ever loses its transition, the reveal
// becomes an instant state change and the site is back to having no visible scroll motion.
if (fallbackRule && !/transition:[^;]*opacity/.test(fallbackRule[3])) {
  failures.push("The reveal's start state must declare a transition on opacity, or the reveal has no duration a visitor can see");
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

// The V9 homepage front of page. Owen supplied the h1 and the descriptor verbatim; the retired
// strings are matched in the shapes they occupied rather than as bare words, because "Hand-built in
// Provo, Utah." is still the footer line on every page and must stay there.
const HOME_H1 = "Handcrafted electric vehicles.";
const HOME_DESCRIPTOR = "Vanderhall builds electric UTVs, side-by-sides, and three-wheeled autocycles. Experience performance, comfort, and style.";
const HOME_META = "Vanderhall builds handcrafted electric UTVs, side-by-sides, and three-wheeled autocycles.";
if (!homeHtml.includes(`<h1>${HOME_H1}</h1>`)) failures.push("The homepage hero must carry its approved h1");
if (!homeHtml.includes(`<p class="hero__descriptor">${HOME_DESCRIPTOR}</p>`)) failures.push("The homepage hero must carry its approved descriptor");
if (!homeHtml.includes(`<meta name="description" content="${HOME_META}">`)) failures.push("The homepage description must state what the site is");
// The title is a phrase again, so it takes the poster step. A regression to the long sentence would
// silently need the smaller step back, which is why the retired modifier is banned outright.
if (combinedHtml.includes("hero--statement")) failures.push("The retired hero--statement type step remains");
if (!homeHtml.includes("<h2>The Vanderhall lineup.</h2>")) failures.push("The homepage vehicles section must carry its V9 heading");
for (const retired of ["<h1>Hand-built in Provo, Utah.</h1>", "since 2010", "Gas and electric, built in Provo.", "foundingDate"]) {
  if (combinedHtml.includes(retired)) failures.push(`Retired homepage copy remains: ${retired}`);
}
// The schema's Provo address is only legitimate while the footer publishes Provo as visible text.
// The founding date left the site with the old hero, so it must not survive in markup either.
for (const page of builtPages) {
  if (!page.text.includes("Hand-built in Provo, Utah.")) failures.push(`${page.path.replace(root, "")}: the footer must keep the Provo line the organization schema rests on`);
}

// Model pages end on their own content: a photo scroll where each photograph carries the figures it
// shows, then the disclosure line. Nothing pushes the visitor back out to other models.
//
// SPEC_GROUP_COUNTS is stated here rather than read from the data, so the assertion stays
// independent of the generator it is checking. models.mjs is imported too, but only to compare the
// published strings against their source of truth; the counts below are the non-circular anchor.
const MODULE_COUNTS = { venice: 6, carmel: 6, santarosa: 5, brawley: 6 };
const SPEC_GROUP_COUNTS = { venice: 4, carmel: 3, santarosa: 5, brawley: 6 };
const SPEC_ROW_COUNTS = { venice: 20, carmel: 15, santarosa: 28, brawley: 33 };
// V11-C. Owen asked for the figures evened out: "Some of them only have two, some of them have
// eight, so how can we even them out? I'll have four to five." This is the result, per module, in
// page order, and it is the single most important number in this file to state independently.
//
// It is written out rather than derived from models.mjs, and V10's mutation testing is the reason:
// two checks there took their expected value from the data they were checking, so deleting a row
// deleted the expectation with it and both still passed. If a rebalance ever drops a specification
// group back to two rows or pushes one to nine, this list is what notices. A zero is a photograph
// that carries its label alone, which is a deliberate pattern on Carmel and Venice and is checked
// as a count rather than as an absence.
const MODULE_ROW_COUNTS = {
  brawley: [5, 6, 5, 6, 6, 5],
  santarosa: [6, 6, 6, 5, 5],
  carmel: [5, 5, 0, 5, 0, 0],
  venice: [5, 6, 5, 4, 0, 0],
};
// The claim in one line: every module that carries figures carries between four and six of them.
const MODULE_ROW_FLOOR = 4;
const MODULE_ROW_CEILING = 6;
for (const slug of MODEL_SLUGS) {
  const html = pageBySuffix(`/${slug}/index.html`);
  const model = modelBySlug[slug];
  const found = (html.match(/<figure class="photo-module/g) || []).length;
  if (found !== MODULE_COUNTS[slug]) failures.push(`/${slug}/ must present ${MODULE_COUNTS[slug]} photo modules, found ${found}`);
  // V12-A. The bar is gone and the way back opens the hero content instead, which is asserted as an
  // adjacency rather than as a presence: the whole point is that it is the first thing inside the
  // photograph's content column, above the eyebrow, rather than in a strip beneath the photograph.
  if (!/<div class="hero__content"[^>]*>\s*<nav class="back-nav"/.test(html)) {
    failures.push(`/${slug}/ must open its hero content with the way back`);
  }
  // And the photograph must hand straight to the detail section: no paragraph in between. This is the
  // second half of what Owen asked for on 2026-08-06 and the only assertion that would notice an
  // overview paragraph being reintroduced between the hero and "A closer look".
  if (/<\/section>\s*<section class="section--tight narrow"><p class="lede">/.test(html)) {
    failures.push(`/${slug}/ must run from the hero straight into IN DETAIL, with no overview paragraph between them`);
  }
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
  // V11-C, per module rather than per page. A page can hold the right total and still be the
  // 2-and-9 distribution Owen asked to fix, which is why the total above is not enough on its own.
  // Sliced module by module: the last slice runs to the end of the document, and nothing after the
  // photo scroll carries a spec-row, so the count stays honest.
  const moduleChunks = html.split('<figure class="photo-module').slice(1);
  const perModule = moduleChunks.map((chunk) => (chunk.match(/class="spec-row"/g) || []).length);
  if (JSON.stringify(perModule) !== JSON.stringify(MODULE_ROW_COUNTS[slug])) {
    failures.push(`/${slug}/ must publish ${JSON.stringify(MODULE_ROW_COUNTS[slug])} specification rows per photograph, found ${JSON.stringify(perModule)}`);
  }
  for (const count of perModule) {
    if (count !== 0 && (count < MODULE_ROW_FLOOR || count > MODULE_ROW_CEILING)) {
      failures.push(`/${slug}/ has a photograph carrying ${count} specification rows, outside the ${MODULE_ROW_FLOOR} to ${MODULE_ROW_CEILING} band V11-C established`);
    }
  }
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
// V12-A: two, not three. The third was the retired model bar's action, and it was the third time the
// same URL appeared on one page. The two that remain are the opening block and the ORDER section.
if (reserveLinks !== 2) failures.push(`/brawley/gts/ must carry two reservation links, found ${reserveLinks}`);
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
// Brawley is the one model with a page beyond the inquiry form. V12-A retired the bar that carried a
// second link to it, so the hero button is now the only way there from /brawley/ and this assertion is
// what keeps the purchase page reachable at all from the page that sells it.
if (!pageBySuffix("/brawley/index.html").includes('class="button button--inverse" href="/brawley/gts/"')) {
  failures.push("/brawley/ hero must lead to the purchase page");
}
// V8 renamed the destination. "See more info" promised information and delivered a configurator
// with a price, which is what read as three pages of "more" in a row. V12-A: the label appears ONCE
// now, in the hero. It used to appear twice, in the hero and in the bar, from one string in the data.
const brawleyLabels = (pageBySuffix("/brawley/index.html").match(/>Pricing and colors</g) || []).length;
if (brawleyLabels !== 1) failures.push(`/brawley/ must offer Pricing and colors once, in the hero, found ${brawleyLabels}`);
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

// V11-D, V11-H and V11-J. The pathway cards are gone from the foot of both pages that carried them,
// and the component with them. The four destinations they held must still be reachable, so each one
// is asserted positively on every page rather than assumed to be somewhere in the footer.
for (const href of ["/owners/", "/dealers/", "/recommend-dealer/", "/dealer-inquiry/"]) {
  for (const page of builtPages) {
    if (!page.text.includes(`href="${href}"`)) failures.push(`${page.path.replace(root, "")}: ${href} became unreachable when the pathway cards were removed`);
  }
}
// V11-H. The dealers page is an inquiry, not a locator. Owen, 2026-08-05: "It's just a normal
// inquiry." The retired title is banned sitewide and the form's own heading is deliberately unchanged.
if (combinedHtml.includes("Find your dealer")) failures.push("The retired Find your dealer title remains");
if (!dealersHtml.includes("<h1>Talk with Vanderhall.</h1>")) failures.push("/dealers/ must carry the Talk with Vanderhall. title");
if (!dealersHtml.includes('<meta name="description" content="Talk with Vanderhall')) failures.push("/dealers/ meta description must follow its title");
// V11-D. The homepage ends on the concepts split, and that split puts its media first from 768px up.
// DOM order is the assertion that matters: the flip is a grid-area swap, so the body must still come
// first in the markup, or the reading order has silently changed along with the visual one.
if (!homeHtml.includes('<section class="section split split--media-first">')) failures.push("The homepage concepts split must take the media-first modifier");
const splitBodyAt = homeHtml.indexOf('class="split__body"');
const splitMediaAt = homeHtml.indexOf('class="split__media"');
if (splitBodyAt < 0 || splitMediaAt < 0 || splitBodyAt > splitMediaAt) failures.push("The homepage split must keep its body first in the DOM, so the visual flip cannot reorder the page for a screen reader");

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
  "/privacy/index.html": "/",
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

// The V9 concept band. Decorative by construction, which is what keeps the assertions above true: the
// nine cards are still nine because nothing in the band is an article, and the one h1 is still one
// because nothing in it is a heading.
//
// The band is sliced out of the page rather than matched with a nested-div regex, which cannot be
// written correctly for this shape.
const marqueeStart = conceptsHubHtml.indexOf('<div class="concept-marquee bleed"');
if (marqueeStart < 0) failures.push("The concepts hub must carry the concept band");
else {
  const after = conceptsHubHtml.slice(marqueeStart);
  const band = after.slice(0, after.indexOf("<section"));
  const items = (band.match(/class="concept-marquee__item"/g) || []).length;
  // Two identical halves of nine. The loop translates the track by exactly -50%, so an odd count or a
  // count that is not twice the concept total would seam.
  if (items !== 18) failures.push(`The concept band must carry 18 items, two halves of nine, found ${items}`);
  if (items !== conceptCards * 2) failures.push(`The concept band carries ${items} items for ${conceptCards} concepts`);
  if (!band.includes('<div class="concept-marquee__viewport" aria-hidden="true">')) failures.push("The concept band's viewport must be hidden from assistive technology");
  // aria-hidden belongs on the viewport, never the outer element, or the pause control leaves the
  // accessibility tree with it.
  if (/<div class="concept-marquee bleed"[^>]*aria-hidden/.test(band)) failures.push("aria-hidden must sit on the band's viewport, not on the band itself");
  if (band.includes("<a ")) failures.push("The concept band must contain no links: the nine cards below are the index");
  if (band.includes("<article")) failures.push("The concept band must contain no articles, so the nine-card assertion stays honest");
  if (/<h[1-6][\s>]/.test(band)) failures.push("The concept band must contain no headings");
  // Motion ships with its off switch or not at all: site.js reveals this button in the same block that
  // sets data-ready, and data-ready is what starts the animation.
  if (!/<button class="concept-marquee__toggle" type="button" aria-pressed="false" data-marquee-toggle hidden>Pause<\/button>/.test(band)) failures.push("The concept band's pause control must ship hidden, unpressed, and labelled Pause");
  if (band.includes("data-ready")) failures.push("data-ready must be set by the island, never shipped in the markup");
  const bandImages = (band.match(/<img /g) || []).length;
  if (bandImages !== 18) failures.push(`The concept band must carry one image per item, found ${bandImages}`);
  // V11-F. Every tile is lazy now, where four used to be eager. The band is display: none below
  // 768px, and a phone should spend nothing on decoration it will never see; above the breakpoint
  // the band is in the first viewport, where lazy defers nothing.
  const eager = (band.match(/loading="eager"/g) || []).length;
  if (eager !== 0) failures.push(`The concept band must fetch no tile eagerly, found ${eager}`);
  if ((band.match(/loading="lazy"/g) || []).length !== 18) failures.push("Every concept band image must be lazy");
  if ((band.match(/alt=""/g) || []).length !== 18) failures.push("Every concept band image must carry an empty alt");
}
// V11-F. The band sits in the same grid row as the page header, behind the title, and the header
// must still come FIRST in the markup: the band carries a pause button, and a visitor tabbing into
// the page should reach the page's own title before a control for the decoration behind it.
const conceptsHeaderAt = conceptsHubHtml.indexOf('<header class="page-header');
const conceptsBandAt = conceptsHubHtml.indexOf('<div class="concept-marquee');
if (conceptsHeaderAt < 0 || conceptsBandAt < 0 || conceptsHeaderAt > conceptsBandAt) {
  failures.push("The concepts header must precede the band in the DOM, so the title is reached before the band's pause control");
}
if (!conceptsHubHtml.includes('<div class="page page--concepts">')) failures.push("The concepts hub must carry the class that overlaps its header and its band");

// V11-E, extended by V12-D. The white studio field is on the ten concept routes and the purchase page,
// and on no others. The rule behind the list: a page earns it when its imagery was shot in a white
// studio and is delivered unkeyed. Nothing in this pipeline keys onto a dark field any more, so a page
// that took this scope without white imagery would show its subject on a plate, and a page that lost
// it would show white plates on black. Stated as an exact route list rather than a count, which is
// what makes a wrong page fail by name.
const STUDIO_ROUTES = [
  "/concepts/index.html",
  ...["indio", "coachella", "brawley-r", "santarosa-r", "speedster", "yuma", "yuma-defense", "laduna", "balboa"].map((slug) => `/concepts/${slug}/index.html`),
  "/brawley/gts/index.html",
];
if (STUDIO_ROUTES.length !== 11) failures.push(`The studio route list must name the ten concept routes and the purchase page, found ${STUDIO_ROUTES.length}`);
for (const page of builtPages) {
  const relative = page.path.replace(root, "");
  const expected = STUDIO_ROUTES.includes(relative);
  const found = page.text.includes('<main id="main" class="page--studio">');
  if (expected && !found) failures.push(`${relative}: must render on the white studio field`);
  if (!expected && found) failures.push(`${relative}: must not render on the white studio field`);
  // The scope goes on main so the header and the footer, which sit outside it, stay dark.
  if (found && !/<main id="main" class="page--studio">[\s\S]*<\/main>\s*<footer/.test(page.text)) failures.push(`${relative}: the studio scope must close before the footer, which stays dark`);
}
// The wordmark inversion existed only because V9 put a dark page behind dark artwork. On the studio
// field the artwork renders as authored, and the override must be present or every concept title
// renders as a white mark on white.
if (!bundleCss.includes(".page--studio .concept-title img { filter: none; }")) failures.push("The concept wordmark must lose its inversion inside the studio scope");
// V11-E is not light mode returning. The bans that removed it in V9 are asserted above across the
// whole source tree; this is the positive half, that the studio scope is a fixed set of values on
// one class with no branch, no control, and nothing stored.
const tokensCss = await readFile(resolve(root, "src/styles/tokens.css"), "utf8");
const studioScope = (tokensCss.match(/\.page--studio \{([\s\S]*?)\n\}/) || [])[1] || "";
if (!studioScope) failures.push("The studio scope must be declared in tokens.css, which is the one file allowed raw values");
else {
  for (const property of ["--paper", "--ink", "--accent", "--focus-color", "--text-primary", "--text-secondary", "--text-tertiary", "--line", "--surface-1"]) {
    if (!studioScope.includes(`${property}:`)) failures.push(`The studio scope must restate ${property}: a custom property resolves its var() where it is declared, so an inherited ramp would still mix the dark value`);
  }
  // The ramp is restated in full for the same reason, and every rung has to be there.
  for (const rung of ["--ink-70", "--ink-60", "--ink-50", "--ink-24", "--ink-12", "--ink-06", "--ink-03"]) {
    if (!studioScope.includes(`${rung}:`)) failures.push(`The studio scope is missing the ${rung} rung of the ink ramp`);
  }
  if (studioScope.includes("var(--accent)") && !studioScope.includes("--accent: #")) failures.push("The studio accent must be a derived value, not a reference to the dark-page accent");
}
const marqueeCount = (combinedHtml.match(/data-marquee(?=[\s>])/g) || []).length;
if (marqueeCount !== 1) failures.push(`The concept band must appear on the hub alone, found ${marqueeCount}`);

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
for (const route of ["vehicles", "venice", "carmel", "santarosa", "brawley", "brawley/gts", "concepts", "owners", "dealers", "recommend-dealer", "dealer-inquiry", "privacy", "concepts/indio", "concepts/coachella", "concepts/brawley-r", "concepts/santarosa-r", "concepts/speedster", "concepts/yuma", "concepts/yuma-defense", "concepts/laduna", "concepts/balboa"]) {
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
// home-wide-2560.webp left this list in V10 with the ladder itself. The row proved that a delivered
// crop excluded the source's baked safety paragraph, and there is no longer a delivered crop to prove
// it about; the check above proves the whole ladder is gone instead.
const CORRECTED = [
  "assets/images/v2/features/venice/motion-1280.webp",
  "assets/images/v2/features/venice/forest-road-1280.webp",
  "assets/images/v2/features/carmel/lake-reflection-1280.webp",
  "assets/images/v2/features/santarosa/sunset-1280.webp",
  "assets/images/brawley/lifestyle/desert-1280.webp",
  "assets/images/brawley/lifestyle/mountain-road-1280.webp",
  // V11 amendment. The clean chassis crop tops out at 960 because its source is 1640px wide and the
  // window is tight, so the widest delivery is the one asserted here.
  "assets/images/brawley/lifestyle/chassis-960.webp",
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
// V10 retires the lakeside home hero ladder with the homepage that used it. Both the files and the
// encodeLadder calls that produced them are gone, so a future image run cannot quietly bring back
// eight deliveries no page references.
for (const fragment of ["easter-sunset", "assets/images/v2/concepts", "assets/images/v3/vehicles", "assets/images/v3/heroes/home"]) if (files.some((path) => path.includes(fragment))) failures.push(`Retired delivery remains: ${fragment}`);
// Comments are stripped first, so a line that only describes a retired step cannot fail the check
// that the step is gone. Both of these are pipeline assertions rather than output assertions: the
// delivered files could be right today and wrong on the next `npm run images`.
const pipelineSource = (await readFile(resolve(root, "scripts/process-images.mjs"), "utf8")).replace(/\/\/[^\n]*/g, "");
if (/heroes\/home/.test(pipelineSource)) failures.push("The retired home hero ladder is still encoded by the image pipeline");
// V11-E. The concept slides and hub cards are delivered as authored, on the white canvas they were
// drawn on. No threshold key removes a soft studio floor cleanly, and what survived V9's attempt is
// the grey ghosting Owen reported. The pipeline must not key them again.
if (!pipelineSource.includes('const STUDIO_PAPER = "#FFFFFF"') || !pipelineSource.includes("background: STUDIO_PAPER")) failures.push("The concept hub cards must be extended onto the studio white");
// V12-D inverts what V11 asserted here. V11 required the walkaround keying to SURVIVE, because those
// frames were the one set still on a dark page. The purchase page is white now, so the keying is not
// merely unnecessary, it is the defect: no threshold key removes a soft contact shadow, and what got
// through the mask only hid because the paper behind it was darker still. Nothing in this pipeline
// composites onto a dark field any more, and these three assertions are what keep it that way.
for (const token of ["keyCanvas", "keyWhiteCanvas", "keyStudioFrame", "DARK_PAPER"]) {
  if (pipelineSource.includes(token)) failures.push(`The image pipeline must not key onto a dark field: ${token}`);
}
if (existsSync(resolve(root, "scripts/lib/key-studio-frame.mjs"))) {
  failures.push("scripts/lib/key-studio-frame.mjs is retired with the keying and must not exist");
}
// The studio walkaround returns in V6: eight angles for each of the eight complete colours, plus
// one still for Jean Grey, at two rungs each. Concrete Grey is not offered and is not delivered.
const walkaroundRows = manifest.filter((entry) => entry.delivered_file.includes("brawley/walkaround"));
if (walkaroundRows.length !== 130) failures.push(`Expected 130 walkaround frames in the manifest, found ${walkaroundRows.length}`);
if (walkaroundRows.some((entry) => !entry.output_width || entry.output_width > entry.source_width)) failures.push("A walkaround frame is missing dimensions or exceeds its source width");
if (walkaroundRows.some((entry) => entry.delivered_file.includes("concrete-grey"))) failures.push("Concrete Grey is not offered and must not be delivered");
// And the positive half of the keying retirement, on the delivered rows rather than on the pipeline:
// every frame must say what it is, which is the studio white it was photographed on.
const notWhite = walkaroundRows.filter((entry) => !entry.transform.includes("white studio as shot; not keyed"));
if (notWhite.length) failures.push(`${notWhite.length} walkaround frames are not recorded as delivered on the white studio field as shot, starting with ${notWhite[0].delivered_file}`);

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

// V10-A. The label is Contact everywhere the visitor reads it. data-form-id and the #request-info
// anchor are deliberately not renamed: they are the form's identity, not its label, and the endpoint
// map is keyed on the former.
if (combinedHtml.includes("Request info")) failures.push("The retired Request info label remains");
if (combinedHtml.includes("Request information")) failures.push("The retired Request information heading remains");
if (!dealersHtml.includes('<h2 class="form-heading">Contact Vanderhall</h2>')) failures.push("/dealers/ must head its form Contact Vanderhall");
for (const page of builtPages) {
  const headerButtons = (page.text.match(/class="button button--primary header-request" href="\/dealers\/">Contact</g) || []).length;
  if (headerButtons !== 1) failures.push(`${page.path.replace(root, "")}: expected one Contact button in the header, found ${headerButtons}`);
}

// V10-B and V10-C. The footer is the same on all 24 pages, so every destination is asserted on every
// one of them rather than on a sample.
const TRACKING_PARAMS = ["_gl=", "_ga=", "_gcl_au=", "utm_source=", "utm_medium=", "utm_campaign=", "fref="];
// Written out here rather than read from components.mjs, and this is the whole point of writing them
// out. Mutation testing caught it: with the counts and the URLs both taken from SOCIAL_LINKS, deleting
// TikTok from that constant deleted it from the page and from the expectation at the same time, and
// every assertion still passed. These eleven destinations are Owen's, supplied on 2026-08-05, and this
// list is the independent record of them. Changing a URL means changing it in two places on purpose.
const EXPECTED_FOOTER_LINKS = [
  ["Facebook", "https://www.facebook.com/vanderhallusa/"],
  ["Instagram", "https://www.instagram.com/vanderhall/"],
  ["Twitter", "https://twitter.com/vanderhallusa"],
  ["LinkedIn", "https://www.linkedin.com/company/vanderhall"],
  ["TikTok", "https://www.tiktok.com/@vanderhallusa"],
  ["YouTube", "https://www.youtube.com/@VanderhallUSA"],
  ["Vanderhall app for iPhone", "https://apps.apple.com/us/app/vanderhall/id6761500330"],
  ["Vanderhall app for Android", "https://play.google.com/store/apps/details?id=com.vanderhall.customerapp"],
  ["Safety notices", "https://portal.vanderhallusa.com/safety_notices"],
  ["Careers", "https://dealer.vanderhallusa.com/careers"],
  ["Privacy policy", "/privacy/"],
];
const EXPECTED_SOCIAL = 6;
const EXPECTED_LEGAL = 3;
// Vehicles, Owners, Connect, Follow. V11-I adds the fourth.
const EXPECTED_FOOTER_COLUMNS = 4;
// The generator must agree with the record, in both directions, so neither can drift alone.
if (JSON.stringify([...SOCIAL_LINKS, ...APP_LINKS, ...LEGAL_LINKS]) !== JSON.stringify(EXPECTED_FOOTER_LINKS)) {
  failures.push("The footer's link data no longer matches this script's independent record of Owen's destinations");
}
const FOOTER_LINKS = EXPECTED_FOOTER_LINKS;
for (const page of builtPages) {
  const relative = page.path.replace(root, "");
  const footer = page.text.slice(page.text.indexOf("<footer"));
  if (!footer) { failures.push(`${relative}: has no footer`); continue; }
  for (const [label, href] of FOOTER_LINKS) {
    if (!footer.includes(`href="${href}"`)) failures.push(`${relative}: the footer is missing the ${label} destination ${href}`);
  }
  // V11-I. The six destinations are a fourth column of .footer-links now, not a horizontal caps row
  // above the legal band, so they are matched in the column's own shape.
  const socialItems = (footer.match(/<a href="[^"]+" aria-label="Vanderhall on /g) || []).length;
  if (socialItems !== EXPECTED_SOCIAL) failures.push(`${relative}: expected ${EXPECTED_SOCIAL} social links, found ${socialItems}`);
  const columns = (footer.match(/<div class="footer-links">([\s\S]*?)<\/div>\s*<div class="footer-legal">/) || [])[1];
  const columnCount = columns ? (columns.match(/<h2>/g) || []).length : 0;
  if (columnCount !== EXPECTED_FOOTER_COLUMNS) failures.push(`${relative}: expected ${EXPECTED_FOOTER_COLUMNS} footer columns, found ${columnCount}`);
  if (!footer.includes('<div class="footer-follow"><h2>Follow</h2>')) failures.push(`${relative}: the social destinations must head their own Follow column`);
  // The two app links stay in the Owners column and out of the Follow one. sameAs is the
  // organization's own profiles, and an app listing is a product page.
  const followColumn = (footer.match(/<div class="footer-follow">([\s\S]*?)<\/div>/) || [])[1] || "";
  for (const [label, href] of EXPECTED_FOOTER_LINKS.slice(EXPECTED_SOCIAL, EXPECTED_SOCIAL + 2)) {
    if (followColumn.includes(href)) failures.push(`${relative}: the ${label} link belongs in the Owners column, not in Follow`);
  }
  const legalItems = ((footer.match(/<ul class="footer-legal__links">([\s\S]*?)<\/ul>/) || [])[1] || "").match(/<li>/g) || [];
  if (legalItems.length !== EXPECTED_LEGAL) failures.push(`${relative}: expected ${EXPECTED_LEGAL} legal links, found ${legalItems.length}`);
  // The visible word must be inside the longer accessible name, or the label the visitor reads is not
  // the label they can speak. WCAG 2.5.3, asserted rather than assumed.
  for (const [label] of EXPECTED_FOOTER_LINKS.slice(0, EXPECTED_SOCIAL)) {
    if (!footer.includes(`aria-label="Vanderhall on ${label}">${label}</a>`)) failures.push(`${relative}: ${label}'s accessible name must contain its visible text`);
  }
  // V11-I shipped text, not glyphs, and this is the check that keeps that decision from being
  // reversed by accident. LinkedIn's mark was removed from Simple Icons at v14.0.0 after Microsoft's
  // legal notice and LinkedIn's own brand guidelines do not permit third-party use; Twitter's left
  // with the X rebrand, so the collection's glyph is X while the destination and the label are
  // Twitter. Four marks and two bare words would read as unfinished, and reinstating LinkedIn's from
  // an older release would mean publishing artwork its owner asked to have withdrawn. Owen chose all
  // six as text on 2026-08-05. An inline SVG appearing in this column means somebody has re-opened a
  // rights question, and it should fail until they have answered it.
  if (/<div class="footer-follow">[\s\S]*?<svg/.test(footer)) failures.push(`${relative}: a glyph appeared in the Follow column; the platform artwork rights behind it are not cleared`);
}
// Owen pasted these URLs with his own session's analytics identifiers attached. Publishing one would
// hand every visitor a copy of them, so the ban is on the whole built tree and on the source that
// generates it, not on the footer alone.
for (const path of textFiles.filter((file) => !CHECK_SCRIPTS.includes(file) && !file.startsWith(resolve(root, "work")))) {
  const text = await readFile(path, "utf8");
  for (const parameter of TRACKING_PARAMS) {
    if (text.includes(parameter)) failures.push(`${path.replace(root, "")}: tracking parameter remains: ${parameter}`);
  }
}
// Structured data may only restate visible text, and these are now visible on every page.
const organization = homeSchemas[0]?.["@graph"]?.find((node) => node["@type"] === "Organization");
if (JSON.stringify(organization?.sameAs) !== JSON.stringify(EXPECTED_FOOTER_LINKS.slice(0, EXPECTED_SOCIAL).map(([, href]) => href))) {
  failures.push(`The organization schema's sameAs must be the six visible social destinations, found ${JSON.stringify(organization?.sameAs)}`);
}

// V10-D. The policy page reproduces Vanderhall's text, so the check is that all of it arrived: every
// heading, every list item, and the exact paragraph count the data declares. A section quietly lost in
// an edit is the failure this catches, and a legal document losing a clause silently is the reason it
// is worth catching.
const privacyHtml = pageBySuffix("/privacy/index.html");
if (!privacyHtml) failures.push("/privacy/ was not built");
else {
  if (!privacyHtml.includes("<h1>Privacy policy</h1>")) failures.push("/privacy/ must carry its title");
  // Sliced section by section rather than matched with one regex across the document, so the count is
  // of paragraphs inside the policy and cannot be inflated by anything the page or footer adds later.
  const policySections = privacyHtml.split('<section class="policy__section">').slice(1)
    .map((chunk) => chunk.slice(0, chunk.indexOf("</section>")));
  // 13 sections, 44 paragraphs and 21 list items, written out here rather than counted from the data.
  // Mutation testing caught the circularity: with the expectation derived from privacySections,
  // deleting a paragraph deleted the expectation with it and the check passed on a shortened legal
  // document. That is the one failure mode on this page that actually matters.
  if (policySections.length !== 13) failures.push(`/privacy/ must publish all 13 policy sections, found ${policySections.length}`);
  if (privacySections.length !== 13) failures.push(`The policy data declares ${privacySections.length} sections, not the 13 this script expects`);
  const policyBody = policySections.join("");
  const paragraphs = policyBody.match(/<p>/g)?.length || 0;
  if (paragraphs !== 44) failures.push(`/privacy/ must publish all 44 policy paragraphs, found ${paragraphs}`);
  const items = policyBody.match(/<li>/g)?.length || 0;
  if (items !== 21) failures.push(`/privacy/ must publish all 21 policy list items, found ${items}`);
  for (const section of privacySections) {
    if (section.heading && !privacyHtml.includes(`<h2>${section.heading.replaceAll("&", "&amp;")}</h2>`)) failures.push(`/privacy/ is missing the section heading: ${section.heading}`);
    for (const block of section.blocks) {
      if (block.type === "p" && !privacyHtml.includes(`<p>${block.text.replaceAll("&", "&amp;")}</p>`)) failures.push(`/privacy/ is missing a paragraph: ${block.text.slice(0, 48)}`);
      if (block.type === "ul") for (const item of block.items) {
        if (!privacyHtml.includes(`<li>${item.replaceAll("&", "&amp;")}</li>`)) failures.push(`/privacy/ is missing a list item: ${item.slice(0, 48)}`);
      }
      if (block.type === "url" && !privacyHtml.includes(`<a href="${block.href}">`)) failures.push(`/privacy/ is missing the reference ${block.href}`);
    }
  }
  // The policy is the one page on the site with real list markers, and it is the only page allowed
  // them: everywhere else a bulleted run would be a card grid or a specification group.
  const listPages = builtPages.filter((page) => /<div class="policy">/.test(page.text));
  if (listPages.length !== 1) failures.push(`Policy markup must appear on /privacy/ alone, found ${listPages.length} pages`);
}

// V10-F. One title per page header. The eyebrow is gone from all six, and what replaced it is CSS on
// the heading, so the assertion is that no page-header contains a caps-register label any more. The
// concept detail pages keep theirs, and are excluded by name because CONCEPT says something the
// wordmark title does not.
const MARKED_HEADERS = ["/vehicles/index.html", "/concepts/index.html", "/dealers/index.html", "/recommend-dealer/index.html", "/dealer-inquiry/index.html", "/owners/index.html", "/privacy/index.html"];
for (const relative of MARKED_HEADERS) {
  const html = pageBySuffix(relative);
  const header = html.match(/<header class="page-header[^"]*">[\s\S]*?<\/header>/)?.[0];
  if (!header) { failures.push(`${relative}: has no page header`); continue; }
  if (!header.includes("page-header--marked")) failures.push(`${relative}: the page header must take the marked treatment`);
  if (header.includes('class="eyebrow"')) failures.push(`${relative}: the page header still carries an eyebrow above its title`);
  if ((header.match(/<h1>/g) || []).length !== 1) failures.push(`${relative}: the page header must carry exactly one title`);
}
// Only the words that no longer have a home anywhere. VEHICLES is deliberately absent from this list:
// it is still the homepage lineup section's eyebrow, above a heading reading "The Vanderhall lineup.",
// and that pair says two different things. The assertion that matters for the page headers is the one
// above, that none of them contains a caps label at all.
for (const retired of ["Design studies", ">OWNERS<", ">DEALERS<", ">CONCEPTS<", ">DEALER NETWORK<", ">INTERNATIONAL DEALERS<"]) {
  if (combinedHtml.includes(retired)) failures.push(`A retired page-header eyebrow or title remains: ${retired}`);
}
if (!homeHtml.includes('<div class="section-heading section-heading--marked"><h2>Concepts</h2>')) failures.push("The homepage concepts section must carry one marked title reading Concepts");
// The informational eyebrows stay. D-V10-4: deleting these would delete content, not repetition.
for (const [route, text] of [["/brawley/gts/index.html", "ELECTRIC OFF-ROAD UTV"], ["/brawley/gts/index.html", "DISCLOSURES"], ["/concepts/indio/index.html", "CONCEPT"], ["/brawley/index.html", "IN DETAIL"]]) {
  if (!pageBySuffix(route).includes(`<p class="eyebrow">${text}</p>`)) failures.push(`${route}: the informational ${text} eyebrow must stay`);
}

// V11-A. ONE ambient block, on the homepage, and nowhere else. D-V11-2 and D-V11-3: the montage
// becomes the hero loop and the other two are deleted. The block has to be complete in the markup,
// because the markup is the whole no-JavaScript, reduced-motion and below-768px experience.
const AMBIENT_ROUTES = { "index.html": "hero" };
const ambientCount = (combinedHtml.match(/data-ambient(?=[\s>])/g) || []).length;
if (ambientCount !== 1) failures.push(`Expected one ambient video block sitewide, found ${ambientCount}`);
const videoTags = (combinedHtml.match(/<video(?=[\s>])/g) || []).length;
if (videoTags !== 1) failures.push(`Expected one video element sitewide, found ${videoTags}`);
for (const page of builtPages) {
  const relative = page.path.replace(root, "");
  const key = page.path === resolve(root, "index.html") ? "index.html" : relative;
  const expected = AMBIENT_ROUTES[key] ? 1 : 0;
  const found = (page.text.match(/data-ambient(?=[\s>])/g) || []).length;
  if (found !== expected) failures.push(`${relative}: expected ${expected} ambient video blocks, found ${found}`);
  if (!expected && page.text.includes("/assets/video/")) failures.push(`${relative}: references video on a route with no approved placement`);
}
// Stated as routes rather than as an absence, so a loop reappearing on either Brawley page is named
// by the check that owns it rather than by whichever count happens to move.
for (const route of ["/brawley/index.html", "/brawley/gts/index.html"]) {
  const html = pageBySuffix(route);
  if (html.includes("<video")) failures.push(`${route}: V11-A ships no motion footage on the Brawley pages`);
  if (html.includes("/assets/video/")) failures.push(`${route}: still references a video asset`);
}
for (const [key, kind] of Object.entries(AMBIENT_ROUTES)) {
  const html = key === "index.html" ? homeHtml : pageBySuffix(key);
  const tag = html.match(/<video[^>]*>[\s\S]*?<\/video>/)?.[0] || "";
  // WebM first so a browser that can decode VP9 never downloads the larger H.264 file.
  const order = [...tag.matchAll(/<source data-src="([^"]+)"/g)].map((match) => match[1]);
  if (order.length !== 2 || !order[0].endsWith(".webm") || !order[1].endsWith(".mp4")) failures.push(`${key}: ambient video must offer WebM first and MP4 second, found ${order.join(", ") || "none"}`);
  // No src, only data-src. This is what makes the video unreachable to a parser, and therefore
  // unreachable without script: it is the load gate, not a style.
  if (/<source[^>]+\ssrc=/.test(tag)) failures.push(`${key}: an ambient source ships a src attribute, so the video loads before it is eligible`);
  for (const required of ["muted", "loop", "playsinline", 'preload="none"']) {
    if (!tag.includes(required)) failures.push(`${key}: ambient video is missing ${required}`);
  }
  if (tag.includes("autoplay")) failures.push(`${key}: ambient video must not declare autoplay`);
  // Ships hidden. site.js reveals it only once playback has actually been attempted, which is the
  // same rule the concept band's pause button follows.
  if (!/data-ambient-toggle hidden>Pause<\/button>/.test(html)) failures.push(`${key}: the ambient control must ship hidden and labelled Pause`);
  if (html.includes("data-painted")) failures.push(`${key}: data-painted must be set by the island, never shipped in the markup`);
  const poster = kind === "hero"
    ? html.match(/<img class="hero__image"[^>]*>/)?.[0]
    : html.match(/<img class="ambient__poster"[^>]*>/)?.[0];
  if (!poster) { failures.push(`${key}: the ambient block has no poster image`); continue; }
  if (!/width="1900" height="900"/.test(poster)) failures.push(`${key}: the poster must declare the 1900 by 900 box the video shares`);
  const rungs = [...poster.matchAll(/(\d+)w/g)].map((match) => match[1]);
  if (JSON.stringify(rungs) !== JSON.stringify(["960", "1280", "1900"])) failures.push(`${key}: the poster must offer the three delivered rungs, found ${rungs.join(", ")}`);
  // The homepage poster stays the LCP candidate; the two below-fold posters must not compete with it.
  if (kind === "hero") {
    if (!poster.includes('loading="eager"') || !poster.includes('fetchpriority="high"')) failures.push("The homepage poster must stay eager and high priority");
  } else if (!poster.includes('loading="lazy"')) {
    failures.push(`${key}: a below-fold poster must be lazy`);
  }
}
// Every delivered video file must exist, and nothing may be delivered that no page can reach. The
// link checker cannot do this for us, because these URLs are in data-src by design.
const videoUrls = new Set([...combinedHtml.matchAll(/data-src="([^"]+)"/g)].map((match) => match[1]));
for (const video of ambientVideos) {
  for (const url of [video.webm, video.mp4]) {
    if (!videoUrls.has(url)) failures.push(`Delivered video that no page references: ${url}`);
    if (!files.some((path) => path.replace(root, "") === url)) failures.push(`Referenced video is missing from the build: ${url}`);
  }
}
const deliveredVideoFiles = files.filter((path) => /\/assets\/video\/.+\.(?:webm|mp4)$/.test(path)).map((path) => path.replace(root, ""));
for (const url of deliveredVideoFiles) {
  if (!videoUrls.has(url)) failures.push(`Delivered video that no page references: ${url}`);
}
if (deliveredVideoFiles.length !== 2) failures.push(`Expected two delivered video files, found ${deliveredVideoFiles.length}`);
const deliveredPosters = files.filter((path) => /\/assets\/video\/.+\.webp$/.test(path)).map((path) => path.replace(root, ""));
for (const url of deliveredPosters) {
  if (!referenced.has(url)) failures.push(`Delivered poster that no page references: ${url}`);
}
if (deliveredPosters.length !== 3) failures.push(`Expected three delivered posters, found ${deliveredPosters.length}`);
// V11-A. The ten retired files are deleted, not merely unreferenced, and they are named here so the
// deletion cannot be quietly undone by a copy from the source package. The package itself is
// untouched in Assets/Video Image Plan/, so restoring either loop is a copy rather than a re-encode;
// what this forbids is a restore that nobody decided on. The orphan check above would catch the two
// video files, but not the six poster rungs, which is why every basename is listed.
for (const stem of ["brawley-canyon-hero-36-46", "brawley-canyon-action-13-23", "brawley-canyon-hero-poster", "brawley-canyon-action-13-23-poster"]) {
  const survivors = files.filter((path) => path.includes("/assets/video/") && path.includes(stem)).map((path) => path.replace(root, ""));
  if (survivors.length) failures.push(`Retired V11-A video delivery remains: ${survivors.join(", ")}`);
}

if (failures.length) {
  console.error(`Content checks failed (${failures.length}):\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`Content checks passed across ${builtPages.length} pages. Zero public data gates or placeholders remain.`);
