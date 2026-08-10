import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// Imported to compare what the pages publish against the one source those strings come from. The
// counts asserted below are hardcoded on purpose, so the structural checks stay independent of the
// generator: importing the data proves the strings match, the counts prove the shape is right.
import { currentModels, HISTORICAL_SPECS, modelBySlug, pastModels, SPEC_DISCLAIMER } from "../src/data/models.mjs";
import { conceptBySlug, concepts } from "../src/data/concepts.mjs";
import { privacySections } from "../src/data/privacy.mjs";
import { ambientVideos } from "../src/data/video.mjs";
import { FORM_ENDPOINTS, INQUIRY_EMAIL } from "../src/data/forms.mjs";
import { FOOTNOTES } from "../src/data/footnotes.mjs";
import { PRODUCTION_BLOCKERS } from "../src/data/prototype.mjs";
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

// V17-D-V17-6. The em-dash rule is a house style rule, and a house style rule does not get to edit a
// recall notice. Two of Vanderhall's three published notices contain em dashes inside CPSC's and
// Vanderhall's own sentences, and those notices are republished verbatim. The exemption is scoped to
// the record file and the notice detail pages and reaches nothing else: the safety index renders only
// the card summaries, which contain none, so it is still held to the rule like every other page.
const VERBATIM_NOTICE_FILES = [/\/src\/data\/safety\.mjs$/, /\/safety\/sn-[^/]+\/index\.html$/];
const isVerbatimNotice = (relative) => VERBATIM_NOTICE_FILES.some((pattern) => pattern.test(relative));

for (const path of textFiles) {
  const text = await readFile(path, "utf8");
  if (text.includes("\u2014") && !isVerbatimNotice(path.replace(root, ""))) failures.push(`${path.replace(root, "")}: contains an em dash`);
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
for (const token of ["data-missing", "MISSING:", "data-vehicles-trigger", "data-mega-panel", "data-open-lead", "data-lead-sheet", "data-filter-pill", "class=\"chapter", "concepts-theme", "stat-band", "concept-feature", "concept-wide", "concept-tile", "card-grid--vehicles", "card-grid--related", "class=\"gallery", "chip--status", "faq-list", "concept-ring", "row-links", "unit-toggle", "data-unit", "data-spec-table", "unit-metric", "vhw.units", "spec-toolbar", "concept-back", "resource-row", "pathway", "class=\"ambient", "ambient__", "footer-social", "class=\"model-bar", "model-bar__", "class=\"word\"", "is-split", "data-split",
  // V13 retires the generic dealer lead form. Its identity is banned rather than merely unused: the endpoint
  // map is keyed on the form ID, so markup carrying the old one would route a materially different form's
  // submissions to whatever `request-info` eventually points at.
  "request-info", "contact-lead",
  // V15 retires four more. The sample markers went sitewide with Owen's cleanup; the quiet
  // past-models link went when the homepage began listing the past models; the category kickers went
  // when the feed became one surface; and the one-sentence map fallback went when the illustrative
  // map replaced it.
  "lineup-past", "post-card__category", "article-header__category", "locator__map-message",
  // V16 retires two more. The locator's List/Map switch went when both panes began rendering at
  // every width (the singular token matches the group and the buttons alike), and the owner
  // library's photograph column went when Owen made the page a plain list.
  "locator__mode", "data-locator-mode", "resource-group--media", "resource-group__media"]) {
  if (combinedHtml.includes(token)) failures.push(`Retired markup remains: ${token}`);
}
// The stylesheet has to lose them too. A retired component whose CSS survives is dead weight that
// reads as live code to the next person to open the file.
const bundleCss = await readFile(resolve(root, "styles/bundle.css"), "utf8");
// Comments are stripped first. Naming a retired component in a note that explains why it went is
// exactly what this file is full of, and a check that forbids writing down the reason would push the
// reason out of the code.
const bundleRules = bundleCss.replace(/\/\*[\s\S]*?\*\//g, "");
for (const token of [".pathway", ".ambient", ".footer-social", ".model-bar", ".is-split", ".word", ".gts-note", ".sample-note", ".sample-tag", ".lineup-past", ".post-card__category", ".article-header__category", ".locator__map-message", ".locator__mode", ".locator__modes", ".resource-group--media", ".resource-group__media"]) {
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
// V13-G: /contact/ leaves this list, because it is a native route now rather than a redirect. About and FAQ
// stay retired.
for (const route of ["/about/", "/faq/"]) {
  if (combinedHtml.includes(route)) failures.push(`A link to the removed ${route} route remains`);
}

const formCount = (id) => (combinedHtml.match(new RegExp(`data-form-id="${id}"`, "g")) || []).length;
// V13-G. Four forms, one each, and the retired one must be gone entirely. The count on `request-info` is the
// assertion that matters most: a zero here is what proves the old single-step lead schema is not quietly
// still identifying the new support form.
// V17 adds the fifth: the Brawley order form, one page, one instance.
for (const id of ["contact", "recommend-dealer", "international-dealer-inquiry", "santarosa-launch-interest", "brawley-order"]) {
  if (formCount(id) !== 1) failures.push(`Expected one ${id} form, found ${formCount(id)}`);
}
if (formCount("request-info") !== 0) failures.push(`The retired request-info form identity survives on ${formCount("request-info")} pages`);
if (combinedHtml.includes('id="request-info"')) failures.push("The retired #request-info section anchor remains");

// The endpoint key set, which no check asserted before V13. FORM_ENDPOINTS is consumed only by
// components.mjs, so a key could be added, renamed, or given a live destination with nothing noticing. The
// list here is written out rather than derived, for the reason every other independent expectation in this
// file is: an expectation read from the thing it checks agrees with a mistake in it.
const EXPECTED_ENDPOINT_KEYS = ["contact", "recommend-dealer", "international-dealer-inquiry", "santarosa-launch-interest", "brawley-order"];
const endpointKeys = Object.keys(FORM_ENDPOINTS).sort();
if (JSON.stringify(endpointKeys) !== JSON.stringify([...EXPECTED_ENDPOINT_KEYS].sort())) {
  failures.push(`The form endpoint map must hold exactly ${EXPECTED_ENDPOINT_KEYS.join(", ")}, found ${endpointKeys.join(", ")}`);
}
// And every one of them must still be null. A string here is a live destination, and Contact and the Launch
// Edition both carry copy stating plainly that nothing is sent, so a populated endpoint would make the page
// lie to a visitor while John's routing was still unverified.
for (const [key, value] of Object.entries(FORM_ENDPOINTS)) {
  if (value !== null) failures.push(`FORM_ENDPOINTS.${key} is set to ${value}: production routing is not verified, and the pages state that nothing is sent`);
}

const pageBySuffix = (suffix) => builtPages.find((page) => page.path.endsWith(suffix))?.text || "";
// V6 order: the flagship leads, then the other electric vehicle, then the two roadsters.
const MODEL_SLUGS = ["brawley", "santarosa", "carmel", "venice"];
// V13-D. The lineup is the current models only. Written out rather than filtered from the data, because a
// `pastModel` flag accidentally set on Brawley would remove it from the lineup AND from an expectation
// derived from the same flag, and both would still pass.
const CURRENT_SLUGS = ["brawley", "santarosa"];
const PAST_SLUGS = ["carmel", "venice"];
// V18, Owen on 2026-08-10 relaying Vanderhall's direction: the family split. Longhand for the same
// reason as CURRENT_SLUGS, and cross-checked against the data below so a terrain that drifts in
// models.mjs fails by name here rather than re-labelling a pill and passing. The two legacy
// roadsters carry On-Road per Owen's live-review instruction of the same day.
const TERRAIN_TAGS = { brawley: "Off-Road", santarosa: "On-Road", carmel: "On-Road", venice: "On-Road" };
for (const model of [...currentModels, ...pastModels]) {
  if ((model.terrain ?? null) !== TERRAIN_TAGS[model.slug]) {
    failures.push(`models.mjs declares ${model.slug} terrain ${model.terrain ?? "none"}, not the ${TERRAIN_TAGS[model.slug] ?? "none"} this script expects`);
  }
}
if (JSON.stringify(currentModels.map((model) => model.slug)) !== JSON.stringify(CURRENT_SLUGS)) {
  failures.push(`The data declares current models ${currentModels.map((model) => model.slug).join(", ")}, not the ${CURRENT_SLUGS.join(", ")} this script expects`);
}
if (JSON.stringify(pastModels.map((model) => model.slug)) !== JSON.stringify(PAST_SLUGS)) {
  failures.push(`The data declares past models ${pastModels.map((model) => model.slug).join(", ")}, not the ${PAST_SLUGS.join(", ")} this script expects`);
}

// V13-G. /dealers/ is a locator and holds no form at all. /contact/ holds the one request form and states
// plainly that it is not connected.
const dealersHtml = pageBySuffix("/dealers/index.html");
const contactHtml = pageBySuffix("/contact/index.html");
if (!contactHtml) failures.push("/contact/ was not built");
if ((dealersHtml.match(/<form/g) || []).length !== 1) failures.push(`/dealers/ must carry exactly one form, the locator's own search, found ${(dealersHtml.match(/<form/g) || []).length}`);
if (dealersHtml.includes("data-site-form")) failures.push("/dealers/ must carry no submission form: requests belong to /contact/");
if (!contactHtml.includes('data-form-id="contact"')) failures.push("The one contact form must be on /contact/");
// V15-F: the pre-submit scaffolding sentences are retired (asserted globally with the marker ban).
// What must remain is the honest alternative: the visible inquiry-address note beside the form, and
// the submit-time sentence in the delivered script, so a real visitor's message never silently dies.
if (!contactHtml.includes("Prefer email? Write to")) failures.push("/contact/ must offer the inquiry address beside the form");
if (!contactHtml.includes("<h1>Contact Vanderhall.</h1>")) failures.push("/contact/ must carry its approved title");
// The locator's own title and description, and the retired inquiry title banned by name.
if (!dealersHtml.includes("<h1>Find a Vanderhall dealer.</h1>")) failures.push("/dealers/ must carry the locator title");
if (!dealersHtml.includes('<meta name="description" content="Find a Vanderhall dealer')) failures.push("/dealers/ meta description must follow its locator title");
if (combinedHtml.includes("Talk with Vanderhall.")) failures.push("The retired V11-H dealers inquiry title remains");
// The locator's contract: the complete list is HTML, every control that needs JavaScript ships hidden, and
// the map fallback is honest rather than a spinner.
const dealerCards = (dealersHtml.match(/class="dealer-card"/g) || []).length;
if (dealerCards !== 6) failures.push(`/dealers/ must render all six dealer records as HTML, found ${dealerCards}`);
// The locator's script-dependent controls render at first paint, so becoming usable cannot shift the
// page, and a <noscript> style block withdraws them when scripting is off. Asserted on every page rather than
// on this one, because the block lives in the shared shell and a page that lost it would show dead controls.
// V16-E drops the mode switch's selector from the rule with the switch itself; the map's zoom controls are
// not in it because they follow the walkaround's pattern instead, shipping hidden until site.js reveals them.
const NOSCRIPT_RULE = "<noscript><style>[data-locator-search],[data-dealer-select]{display:none}</style></noscript>";
for (const page of builtPages) {
  if (!page.text.includes(NOSCRIPT_RULE)) failures.push(`${page.path.replace(root, "")}: the no-JavaScript rule that withdraws the locator's controls is missing`);
}
if (dealersHtml.includes("data-locator-search hidden")) failures.push("/dealers/ search must render at first paint: revealing it after load shifts the page");
if ((dealersHtml.match(/data-dealer-select="[^"]+"/g) || []).length !== 6) failures.push("Every dealer card must offer a map-selection control");
// V15-E. The no-key state carries the illustrative map: an SVG drawn for this site, one pin per
// dealer projected from the record's own coordinates, labelled as illustrative in its accessible
// name. The old one-sentence fallback is retired with it.
if (dealersHtml.includes("The map is unavailable right now.")) failures.push("/dealers/ still carries the retired map-failure sentence");
if (!dealersHtml.includes('class="locator__map-art')) failures.push("/dealers/ must render the illustrative map in the fallback panel");
if ((dealersHtml.match(/data-dealer-pin="[^"]+"/g) || []).length !== 6) failures.push("The illustrative map must carry one pin per dealer");
if (!/aria-label="Illustrative map of the 6 dealer locations/.test(dealersHtml)) failures.push("The illustrative map must name itself illustrative in its accessible name");
// The pins are the records' own coordinates, cross-checked pin by pin against the cards.
for (const card of dealersHtml.matchAll(/data-dealer="([^"]+)"/g)) {
  if (!dealersHtml.includes(`data-dealer-pin="${card[1]}"`)) failures.push(`The illustrative map has no pin for the dealer ${card[1]}`);
}
// No key is committed, ever. A key in built output is a key on every visitor's screen.
if (/data-map-key="[^"]+"/.test(combinedHtml)) failures.push("A Google Maps key reached the built output");
// Phone numbers and websites that prove the records are fictional, plus the two ways out of a no-results
// state. Both destinations are asserted because a locator that finds nothing must still lead somewhere.
if ((dealersHtml.match(/tel:\+1-555-01/g) || []).length !== 6) failures.push("The six fictional dealers must use reserved 555-01xx telephone numbers");
if ((dealersHtml.match(/\.example\.com/g) || []).length !== 6) failures.push("The six fictional dealers must use reserved example.com websites");
// V15-F: the fixtures stay fictional by construction, but the word Sample leaves their visible
// fields with the markers. A street named Sample was a label wearing an address's clothes.
if (/Sample [A-Z]/.test(dealersHtml)) failures.push("/dealers/ still carries a fixture field labelled Sample");
for (const href of ["/recommend-dealer/", "/contact/"]) {
  if (!dealersHtml.includes(`href="${href}"`)) failures.push(`/dealers/ no-results state must offer ${href}`);
}
// No location permission may be requested, and the way to prove that from the markup is that the API the
// browser would ask through is not named anywhere in the delivered script.
const siteScript = await readFile(resolve(root, "scripts/site.js"), "utf8");
if (siteScript.includes("geolocation")) failures.push("The delivered script references the geolocation API: the locator must never ask for a visitor's position");

// Both the homepage and /vehicles/ present the same four vehicle sections in the same order,
// each linking to its model page. This replaces the V4 four-card grid on /vehicles/. The scroll
// is isolated first, because the footer also links to all four models on every page.
const homeHtml = builtPages.find((page) => page.path === resolve(root, "index.html"))?.text || "";
const vehiclesHtml = pageBySuffix("/vehicles/index.html");
const withoutFooter = (html) => html.split("<footer")[0];
// V15-C, Owen on 2026-08-06: the homepage lineup shows all four models, current first, and each past
// model carries the Past model tag beside its name. /vehicles/ is deliberately untouched: its lineup
// stays the two current models, with the past models in their own quieter group below.
const LINEUP_ORDERS = { "/": [...CURRENT_SLUGS, ...PAST_SLUGS], "/vehicles/": CURRENT_SLUGS };
for (const [route, html] of [["/", homeHtml], ["/vehicles/", vehiclesHtml]]) {
  const scroll = withoutFooter(html);
  const blocks = scroll.split('<section class="vehicle-section').slice(1);
  const expectedOrder = LINEUP_ORDERS[route];
  if (blocks.length !== expectedOrder.length) failures.push(`${route}: expected ${expectedOrder.length} vehicle sections, found ${blocks.length}`);
  // Each section now links to its model page more than once, because the photographs became links
  // too, so the order is read one section at a time rather than from a flat list of hrefs.
  const order = blocks.map((block) => block.match(/href="\/(brawley|santarosa|carmel|venice)\/"/)?.[1] || "none");
  if (JSON.stringify(order) !== JSON.stringify(expectedOrder)) failures.push(`${route}: vehicle sections must link to ${expectedOrder.join(", ")} in order, found ${order.join(", ") || "none"}`);
  // V18: a lineup section carries its terrain pill and nothing else. The legacy pill left both
  // lineup surfaces with the grouping, because each group's heading supplies the status now; the
  // pill survives only beside each legacy detail page's h1 (D-V18-5).
  for (const [index, block] of blocks.entries()) {
    const expected = TERRAIN_TAGS[order[index]] ?? null;
    const pill = block.match(/<p class="model-tag model-tag--terrain">([^<]*)<\/p>/)?.[1] ?? null;
    if (pill !== expected) failures.push(`${route}: the ${order[index]} section must carry ${expected ? `the ${expected} terrain pill` : "no terrain pill"} beside its name, found ${pill ?? "none"}`);
    if (block.includes(">Legacy model<") || block.includes(">Past model<")) failures.push(`${route}: the ${order[index]} lineup section must not carry a status pill: its group heading says it`);
  }
  // Media links must never take a tab stop or a name away from the text link beneath them.
  for (const block of blocks) {
    for (const tag of block.match(/<a class="vehicle-section__(?:lead|support)"[^>]*>/g) || []) {
      if (!tag.includes('tabindex="-1"') || !tag.includes('aria-hidden="true"')) failures.push(`${route}: a vehicle media link is not removed from the tab order`);
    }
  }
}
// V18: the three family headings, in Owen's order, each sitting above the sections it heads. The
// markers are asserted strictly increasing from the top of each page, which pins heading-before-
// group without parsing the wrappers, and the exact heading strings also pin the levels the axe
// heading-order rule assumes (h3 under the homepage's lineup h2, h2 on /vehicles/). The terrain
// pill's adjacency to the name is pinned the same way.
for (const [route, html, level, sequence] of [
  ["/", homeHtml, 3, ["Vanderhall Off-Road|brawley", "Vanderhall On-Road|santarosa", "Vanderhall Legacy Vehicles|carmel", "|venice"]],
  ["/vehicles/", vehiclesHtml, 2, ["Vanderhall Off-Road|brawley", "Vanderhall On-Road|santarosa", "Vanderhall Legacy Vehicles|carmel", "|venice"]],
]) {
  const scroll = withoutFooter(html);
  let cursor = 0;
  for (const step of sequence) {
    const [family, slug] = step.split("|");
    for (const marker of [family ? `<h${level}>${family}</h${level}>` : null, `href="/${slug}/"`].filter(Boolean)) {
      const at = scroll.indexOf(marker, cursor);
      if (at < cursor || at < 0) { failures.push(`${route}: expected ${marker} after position ${cursor} in the grouped lineup`); break; }
      cursor = at + marker.length;
    }
  }
  for (const family of ["Vanderhall Off-Road", "Vanderhall On-Road", "Vanderhall Legacy Vehicles"]) {
    const count = (scroll.match(new RegExp(`<h${level}>${family}</h${level}>`, "g")) || []).length;
    if (count !== 1) failures.push(`${route}: the ${family} group heading must appear exactly once at h${level}, found ${count}`);
  }
  // The pill sits immediately beside the name it qualifies. On the homepage that is all four
  // models at h4; on /vehicles/ the two current models at h3, while the legacy pills live in the
  // compact cards asserted with the legacy group below.
  const nameLevel = level + 1;
  const pairs = route === "/"
    ? [["Brawley", "Off-Road"], ["Santarosa", "On-Road"], ["Carmel", "On-Road"], ["Venice", "On-Road"]]
    : [["Brawley", "Off-Road"], ["Santarosa", "On-Road"]];
  for (const [name, terrain] of pairs) {
    if (!scroll.includes(`<h${nameLevel}>${name}</h${nameLevel}><p class="model-tag model-tag--terrain">${terrain}</p>`)) {
      failures.push(`${route}: the ${terrain} pill must sit immediately beside the ${name} name at h${nameLevel}`);
    }
  }
}
// /vehicles/ must not grow a past-model full section, which is the half of the old rule that survives.
{
  const vehicleOrder = withoutFooter(vehiclesHtml).split('<section class="vehicle-section').slice(1)
    .map((block) => block.match(/href="\/(brawley|santarosa|carmel|venice)\/"/)?.[1] || "none");
  for (const slug of PAST_SLUGS) {
    if (vehicleOrder.includes(slug)) failures.push(`/vehicles/: ${slug} is a past model and must not take a full vehicle section`);
  }
}
// The vehicles page is the fuller version of the same scroll: three photographs per current vehicle.
const supportFrames = (vehiclesHtml.match(/vehicle-section__support/g) || []).length;
if (supportFrames !== 4) failures.push(`/vehicles/ must carry two supporting photographs per current vehicle, found ${supportFrames}`);
if ((homeHtml.match(/vehicle-section__support/g) || []).length !== 0) failures.push("The homepage must stay the short version with one photograph per vehicle");

// V13-D, renamed by V18. The legacy group: one section, two compact cards, one image each, and no
// status pill inside it, because the heading above already says what the group is.
const pastCards = (vehiclesHtml.match(/<article class="past-card">/g) || []).length;
if (pastCards !== 2) failures.push(`/vehicles/ must present two past-model cards, found ${pastCards}`);
if (!vehiclesHtml.includes('<section class="section" id="past-models">')) failures.push("/vehicles/ must carry the past-models anchor the homepage links to");
if (!vehiclesHtml.includes("<h2>Vanderhall Legacy Vehicles</h2>")) failures.push("/vehicles/ must head its legacy group Vanderhall Legacy Vehicles");
const pastGroup = vehiclesHtml.slice(vehiclesHtml.indexOf('id="past-models"'));
for (const slug of PAST_SLUGS) {
  if (!pastGroup.includes(`href="/${slug}/"`)) failures.push(`/vehicles/ past-model group must lead to /${slug}/`);
}
if ((pastGroup.match(/class="past-card__media"/g) || []).length !== 2) failures.push("Each past-model card must carry exactly one photograph");
if (withoutFooter(pastGroup).includes(">Legacy model<") || withoutFooter(pastGroup).includes(">Past model<")) failures.push("The legacy group must not repeat the status as a pill on each card");
// V18, Owen's live-review instruction: each legacy card carries the On-Road terrain pill beside
// its title. Terrain is not status, so the repeated-word rule above still holds alongside this.
for (const block of withoutFooter(pastGroup).split('<article class="past-card">').slice(1)) {
  if (!block.includes('<p class="model-tag model-tag--terrain">On-Road</p>')) failures.push("A legacy card is missing its On-Road terrain pill");
}
// V15-C: the quiet link is retired with the absence it compensated for. The homepage lists the past
// models directly now, so a link to a list of things the visitor is already looking at is gone.
if (homeHtml.includes('href="/vehicles/#past-models"')) failures.push("The retired quiet past-models link remains on the homepage");
for (const slug of PAST_SLUGS) {
  if (!withoutFooter(homeHtml).includes(`href="/${slug}/"`)) failures.push(`The homepage lineup must link to the past model ${slug}`);
}

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
// V13-C: the two past models publish no photo modules and no specification rows at all. Their pages are
// galleries, asserted separately below with their own counts.
const MODULE_COUNTS = { venice: 0, carmel: 0, santarosa: 5, brawley: 6 };
const SPEC_GROUP_COUNTS = { venice: 0, carmel: 0, santarosa: 5, brawley: 6 };
// V13-B: Brawley loses the Range row, so 33 becomes 32. Santarosa loses standard range, optional range and
// power and gains the moved Drivetrain row, so 28 becomes 25.
const SPEC_ROW_COUNTS = { venice: 0, carmel: 0, santarosa: 25, brawley: 32 };
const GALLERY_COUNTS = { venice: 6, carmel: 6 };
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
  brawley: [5, 6, 4, 6, 6, 5],
  santarosa: [5, 4, 6, 5, 5],
  carmel: [],
  venice: [],
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
  const name = slug[0].toUpperCase() + slug.slice(1);
  if (model.pastModel) {
    // V13-C. A gallery page: six captioned photographs, one honest sentence about availability, a way to the
    // dealer network, and nothing that publishes a figure or implies a vehicle is in stock.
    if (!html.includes(`${name} in photographs.`)) failures.push(`/${slug}/ is missing its gallery heading`);
    const frames = (html.match(/<figure class="photo-gallery__figure">/g) || []).length;
    if (frames !== GALLERY_COUNTS[slug]) failures.push(`/${slug}/ must present ${GALLERY_COUNTS[slug]} gallery frames, found ${frames}`);
    const captions = (html.match(/class="photo-gallery__caption"/g) || []).length;
    if (captions !== GALLERY_COUNTS[slug]) failures.push(`/${slug}/ has ${captions} gallery captions for ${frames} frames`);
    if (!html.includes(model.inventoryNote)) failures.push(`/${slug}/ must state that it is a past model and that availability is not guaranteed`);
    if (!html.includes('href="/dealers/"')) failures.push(`/${slug}/ must lead to the dealer network`);
    if (!html.includes(">Find a dealer<")) failures.push(`/${slug}/ must offer the approved Find a dealer action`);
    // The absence rules. Neither page had a warranty or a price field to begin with, so these are assertions
    // that nothing arrived rather than that something was removed.
    for (const token of ["limited warranty", "MSRP", 'class="price', 'class="spec-note"', "Manufacturer's Suggested Retail Price"]) {
      if (html.includes(token)) failures.push(`/${slug}/ is a past-model gallery and must not carry ${token}`);
    }
    if (html.includes(SPEC_DISCLAIMER)) failures.push(`/${slug}/ publishes no figure, so it must carry no specification estimate note`);
    if (html.includes("Specifications shown are for the")) failures.push(`/${slug}/ publishes no figure, so it must carry no model-year qualifier`);
    if (html.includes('class="fn-ref"')) failures.push(`/${slug}/ must carry no footnote references: it publishes no marked figure`);
    continue;
  }
  if (!html.includes(`A closer look at ${name}.`)) failures.push(`/${slug}/ is missing its in-detail heading`);
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
  // Warranty on the current models. The past-model branch that used to sit here is gone with the figures it
  // qualified: the loop returns above for a gallery page, which has no warranty term, no model-year
  // qualifier, and no estimate note, and asserts all three absences there.
  if (!html.includes(model.warranty)) failures.push(`/${slug}/ must carry its warranty line`);
  if (model.specNote) failures.push(`/${slug}/ is a current model and needs no model-year qualifier`);

  // V13-F. The estimate sentence reaches the page as a resolving footnote rather than as a flat paragraph.
  // Three things have to be true together, and the third is the one that catches a broken reference: every
  // mark points at a note that exists on the same page, and every note has at least one mark.
  const refs = [...html.matchAll(/<a id="fnref-([a-z-]+)-(\d+)" href="#fn-([a-z-]+)"/g)];
  if (!refs.length) failures.push(`/${slug}/ publishes figures but carries no footnote reference`);
  const noteIds = [...html.matchAll(/<p class="footnote" id="fn-([a-z-]+)"/g)].map((match) => match[1]);
  if (new Set(noteIds).size !== noteIds.length) failures.push(`/${slug}/ prints a duplicate footnote body`);
  for (const [, refId, , targetId] of refs) {
    if (refId !== targetId) failures.push(`/${slug}/ has a footnote reference for ${refId} pointing at ${targetId}`);
    if (!noteIds.includes(targetId)) failures.push(`/${slug}/ references footnote ${targetId}, which is not printed on this page`);
  }
  for (const id of noteIds) {
    if (!refs.some(([, refId]) => refId === id)) failures.push(`/${slug}/ prints the ${id} note with nothing referencing it`);
    if (!html.includes(FOOTNOTES[id].text)) failures.push(`/${slug}/ prints the ${id} note without its approved text`);
    // The note must be reachable back from its own body, and the back link points at the FIRST reference.
    if (!html.includes(`href="#fnref-${id}-1"`)) failures.push(`/${slug}/ note ${id} has no link back to its first reference`);
  }
  // A star must never reach assistive technology unlabelled. Every reference carries an accessible name and
  // hides the glyph, which is asserted as a count rather than a presence so one unlabelled mark fails.
  const labelled = (html.match(/aria-label="Footnote \d+"><span aria-hidden="true">/g) || []).length;
  if (labelled !== refs.length) failures.push(`/${slug}/ has ${refs.length} footnote marks but ${labelled} labelled ones`);
  if (!html.includes(SPEC_DISCLAIMER)) failures.push(`/${slug}/ must carry the specification estimate sentence`);
}

// V13-C. The inverse rendering rule, and the reason it is worth its own assertion: CARMEL_SPECS and
// VENICE_SPECS are still in the source with every figure, source note and provenance comment intact, so the
// research is preserved. What must never happen is one of those values reaching a page again. This walks every
// retained row and fails if its value appears in any built HTML.
//
// A handful of values are shared with figures the current models publish legitimately, so the comparison is
// against the two gallery pages specifically rather than against the whole site.
for (const [slug, history] of Object.entries(HISTORICAL_SPECS)) {
  const html = pageBySuffix(`/${slug}/index.html`);
  for (const group of history.groups) {
    if (html.includes(`<h3>${group.name}</h3>`)) failures.push(`/${slug}/ renders the retained historical group ${group.name}`);
    for (const row of group.rows) {
      if (html.includes(`<span>${row.label}</span>`)) failures.push(`/${slug}/ renders the retained historical row ${row.label}`);
    }
  }
}
if ((combinedHtml.match(/class="photo-module__specs"/g) || []).length !== Object.values(SPEC_GROUP_COUNTS).reduce((a, b) => a + b, 0)) {
  failures.push("Paired specification blocks appear outside the two current model pages");
}
// V13-C. And the gallery treatment appears on the two past-model pages and nowhere else.
const galleryFigures = (combinedHtml.match(/<figure class="photo-gallery__figure">/g) || []).length;
if (galleryFigures !== 12) failures.push(`Expected twelve gallery frames sitewide, six on each past model, found ${galleryFigures}`);

// Past models. Owen confirmed on 2026-08-05 that Venice and Carmel are past models and that
// Brawley and Santarosa are current. Six occurrences: two cards on each lineup surface, and the
// two model page heroes. A tag on a current model, or a missing tag on a past one, fails here.
// V13-D recalculates this from Q-V13-9. Six became two: the homepage no longer lists the past models at all,
// and the Past Models group on /vehicles/ carries the status in its heading rather than as a pill on each
// card. What is left is one tag beside each detail page's h1, which is the one surface with no heading above
// it to supply the context.
const PAST_MODELS = ["venice", "carmel"];
// V18 recuts the census to two, and renames the word to match the Vanderhall Legacy Vehicles
// family name. Both lineup surfaces head their legacy group now, so the pill survives only beside
// each legacy detail page's h1, which is the one surface with no heading to supply the context.
// The old wording is retired outright: a surviving ">Past model<" anywhere is a failure.
const totalTags = (combinedHtml.match(/>Legacy model</g) || []).length;
if (totalTags !== 2) failures.push(`Expected two Legacy model tags sitewide, found ${totalTags}`);
if ((withoutFooter(homeHtml).match(/>Legacy model</g) || []).length !== 0) failures.push("The homepage lineup must carry no Legacy model pill: its legacy group heading says it");
if (combinedHtml.includes(">Past model<")) failures.push("The retired Past model wording remains: V18 renamed the pill Legacy model");
for (const slug of MODEL_SLUGS) {
  const html = pageBySuffix(`/${slug}/index.html`);
  const tags = (html.match(/>Legacy model</g) || []).length;
  const expected = PAST_MODELS.includes(slug) ? 1 : 0;
  if (tags !== expected) failures.push(`/${slug}/ must carry ${expected} Legacy model tag, found ${tags}`);
  if (expected && !/<h1>[^<]*<\/h1>\s*<p class="model-tag">/.test(html)) failures.push(`/${slug}/ must place the Legacy model tag directly after the heading`);
}
// V18: the terrain pill census. Eight sitewide: one beside each of the four names on each of the
// two lineup surfaces (the legacy cards included, per Owen's live-review instruction), and none
// anywhere else. The model-page heroes stay clean of little text per V15-H, so a terrain pill
// reaching a hero fails here.
const terrainPills = (combinedHtml.match(/class="model-tag model-tag--terrain"/g) || []).length;
if (terrainPills !== 8) failures.push(`Expected eight terrain pills sitewide, found ${terrainPills}`);
for (const [route, html] of [["/", homeHtml], ["/vehicles/", vehiclesHtml]]) {
  const count = (withoutFooter(html).match(/class="model-tag model-tag--terrain"/g) || []).length;
  if (count !== 4) failures.push(`${route} must carry exactly four terrain pills, found ${count}`);
}
for (const slug of MODEL_SLUGS) {
  const html = pageBySuffix(`/${slug}/index.html`);
  if (html.includes("model-tag--terrain")) failures.push(`/${slug}/ must carry no terrain pill: the hero stays clean per V15-H`);
}
// Prices exist on exactly one route. V1 through V5 published none at all, and V6 publishes the
// Brawley GTS MSRP and its three paint tiers under Owen's approval of 2026-08-05, sourced from
// vanderhallusa.com. Anywhere else, a dollar amount still means something unverified escaped.
const GTS_PATH = "/brawley/gts/index.html";
const GTS_AMOUNTS = ["$49,950", "$0", "$750", "$1,050"];
// V17-D-V17-7. Two republished safety notices quote dollar figures, and both are quoted recall text
// rather than a Vanderhall offer: SN-00003 states the vehicles sold "for about $50,000", and CPSC's own
// boilerplate cites "$1 trillion" in annual incident cost, whose "$1" the pattern above matches. The
// exception is written out per page and per amount, so a price cannot reach a notice page by accident
// and no other page gains an inch: the order page itself still fails on any dollar sign at all.
const VERBATIM_AMOUNTS = {
  "/safety/sn-00003/index.html": ["$50,000", "$1"],
  "/safety/sn-00001/index.html": ["$1"],
};
const gtsHtml = pageBySuffix(GTS_PATH);
for (const page of builtPages) {
  const relative = page.path.replace(root, "");
  const isGts = page.path.endsWith(GTS_PATH);
  const allowed = isGts ? GTS_AMOUNTS : (VERBATIM_AMOUNTS[relative] || []);
  const amounts = [...page.text.matchAll(/\$[\d,]+/g)].map((match) => match[0]);
  const unexpected = amounts.filter((amount) => !allowed.includes(amount));
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
// V17-D-V17-3: the order path is this site's own page. The external reservation system is still live
// and is still where the form will post once John wires it, but it appears in INTEGRATION.md and in no
// delivered file, so the second assertion here is absence.
const ORDER_URL = "/brawley/order/";
const orderLinks = (gtsHtml.match(new RegExp(`href="${ORDER_URL}"`, "g")) || []).length;
// V12-A: two, not three. The third was the retired model bar's action, and it was the third time the
// same URL appeared on one page. The two that remain are the opening block and the ORDER section.
if (orderLinks !== 2) failures.push(`/brawley/gts/ must carry two order links, found ${orderLinks}`);
if (combinedHtml.includes("dealer.vanderhallusa.com/reserve")) failures.push("The external reservation URL was replaced by /brawley/order/ and must not ship");
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
// V13-G. Current models and the purchase page lead to Contact with their category and model in the query;
// the two past galleries lead to the plain dealer route, because their purpose is asking the network about
// remaining inventory rather than requesting information about something Vanderhall still builds.
if (!pageBySuffix("/santarosa/index.html").includes('href="/contact/?category=product-information&amp;model=santarosa"')) failures.push("/santarosa/ must lead to Contact with its product-information category");
if (!gtsHtml.includes('href="/contact/?category=product-information&amp;model=brawley"')) failures.push("/brawley/gts/ must lead to Contact with its product-information category");
for (const slug of ["carmel", "venice"]) {
  if (!pageBySuffix(`/${slug}/index.html`).includes('href="/dealers/"')) failures.push(`/${slug}/ must lead to the plain dealer route`);
  if (pageBySuffix(`/${slug}/index.html`).includes("/contact/?category=product-information")) failures.push(`/${slug}/ must not request product information about a past model`);
}
// The retired query shape, banned by name so a stale CTA cannot survive anywhere.
if (combinedHtml.includes("/dealers/?model=")) failures.push("The retired /dealers/?model= inquiry query remains");

// V13-B. The range ban, across visible copy, metadata, and serialized JSON-LD. No such assertion existed
// before V13: the Product schema is generated from gts.figures and was never asserted, so a range could have
// survived in machine-readable output with every check passing.
const BANNED_CLAIMS = [
  ["Up to 140 mi", "Brawley range"],
  ["140 mi", "Brawley range"],
  ["150 mi", "Santarosa standard range"],
  ["300 mi", "Santarosa optional range"],
  ["180 hp", "Santarosa power"],
];
// V15, folding in V14. The two migrated editorial articles are the ONLY exemption: they are real,
// previously published Vanderhall posts carried source-faithfully under their original dates, and
// they state the 140-mile range. The claim ban keeps every product, campaign, and metadata surface
// clean, and the article-claim-review production blocker holds the release gate until Vanderhall
// reviews the copy. An exemption is a named route, never a pattern.
const EDITORIAL_CLAIM_EXEMPT = new Set([
  "/blog/what-is-a-side-by-side-experience-the-future-with-the-vanderhall-brawley/index.html",
  "/blog/electric-off-road-vehicles-the-future-of-adventure-driving/index.html",
]);
for (const page of builtPages) {
  if (EDITORIAL_CLAIM_EXEMPT.has(page.path.replace(root, ""))) continue;
  for (const [claim, description] of BANNED_CLAIMS) {
    if (page.text.includes(claim)) failures.push(`${page.path.replace(root, "")}: the removed ${description} claim "${claim}" survives`);
  }
}
// The exemption must not be wider than its two routes need: the articles carry the range figure, so
// a silent edit that removed it should surface here as a question rather than pass unnoticed.
for (const relative of EDITORIAL_CLAIM_EXEMPT) {
  if (!pageBySuffix(relative).includes("140 mi")) failures.push(`${relative}: the source-faithful article no longer carries the range claim its exemption exists for`);
}
// And specifically inside the generated schema, read back out of the page rather than trusted from the data.
const gtsProduct = (gtsHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
if (!gtsProduct) failures.push("/brawley/gts/ carries no JSON-LD to check for the removed range claim");
else {
  const parsed = JSON.parse(gtsProduct.replaceAll("<\\/", "</"));
  const properties = (parsed.additionalProperty || []).map((property) => property.name);
  if (properties.includes("Range")) failures.push(`/brawley/gts/ Product schema still publishes a Range property: ${JSON.stringify(properties)}`);
  if (properties.length !== 3) failures.push(`/brawley/gts/ Product schema must publish three figures after the range removal, found ${properties.length}`);
  if (JSON.stringify(parsed).includes("140")) failures.push("/brawley/gts/ Product schema still contains the removed range figure");
}
// The figure band and the table are the visible half of the same claim.
if ((gtsHtml.match(/class="gts-figure"/g) || []).length !== 3) failures.push("/brawley/gts/ must publish three figures after the range removal");
if (gtsHtml.includes(">RANGE<")) failures.push("/brawley/gts/ figure band still carries a RANGE label");
if (gtsHtml.includes("<span>Range</span>")) failures.push("/brawley/gts/ specification table still carries a Range row");

// V11-D, V11-H and V11-J. The pathway cards are gone from the foot of both pages that carried them,
// and the component with them. The four destinations they held must still be reachable, so each one
// is asserted positively on every page rather than assumed to be somewhere in the footer.
// V13 adds Experience and Contact to the set, and keeps /owners/ in it deliberately: Owners left the primary
// navigation, so the footer link is now the only route into the manual library from the chrome and it has to
// be on every page rather than on most of them.
// V15-G: /blog/ leaves this list. The archive is reached through Experience and each article's back
// link now, not from the chrome of every page.
for (const href of ["/owners/", "/dealers/", "/recommend-dealer/", "/dealer-inquiry/", "/experience/", "/contact/", "/careers/", "/safety/"]) {
  for (const page of builtPages) {
    if (!page.text.includes(`href="${href}"`)) failures.push(`${page.path.replace(root, "")}: ${href} is not reachable from this page`);
  }
}
// And the manual library's own footer entry, by label as well as by href: "Owner resources" was the old name
// and the link is now the page's only entrance from the chrome.
for (const page of builtPages) {
  if (!page.text.includes('<a href="/owners/">Owner manuals</a>')) failures.push(`${page.path.replace(root, "")}: the footer must offer Owner manuals`);
  if (page.text.includes("Owner resources")) failures.push(`${page.path.replace(root, "")}: the retired Owner resources label remains`);
}
// V13-G supersedes V11-H: the dealers page is a locator again, and its own title and description are asserted
// where the locator's contract is, further up. "Find your dealer" stays banned as a title; "Find a dealer" is
// deliberately NOT banned, because it is now the approved action label on the two past-model galleries.
if (combinedHtml.includes("<h1>Find your dealer")) failures.push("The retired Find your dealer title remains");
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
  "/brawley/order/index.html": "/brawley/",
  "/privacy/index.html": "/",
  // V13. Experience is a child of Home, Blog a child of Experience, each article a child of Blog. The Launch
  // Edition nests under Santarosa rather than under Vehicles, because it is a campaign about one model.
  "/experience/index.html": "/",
  "/blog/index.html": "/experience/",
  "/contact/index.html": "/",
  "/careers/index.html": "/",
  "/safety/index.html": "/",
  "/santarosa/launch-edition/index.html": "/santarosa/",
};
// The detail levels fall through by pattern, the way the concept routes already do.
const BACK_PATTERNS = [
  [/^\/blog\/[^/]+\/index\.html$/, "/blog/"],
  [/^\/careers\/[^/]+\/index\.html$/, "/careers/"],
  [/^\/safety\/[^/]+\/index\.html$/, "/safety/"],
  [/^\/concepts\/[^/]+\/index\.html$/, "/concepts/"],
];
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
  const expected = BACK_TARGETS[relative] ?? (BACK_PATTERNS.find(([pattern]) => pattern.test(relative))?.[1] ?? null);
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
  if (product.offers?.url !== "https://vanderhall-website.vercel.app/brawley/order/") failures.push("/brawley/gts/ JSON-LD offer must point at the order page the buttons lead to");
  if (!product.image?.endsWith(".webp")) failures.push("/brawley/gts/ JSON-LD image must be a delivered WebP frame");
}
const homeSchemas = schemaOf(homeHtml);
if (homeSchemas.length !== 1 || !homeSchemas[0]["@graph"]?.some((node) => node["@type"] === "Organization")) failures.push("The homepage must carry one JSON-LD block describing the organization");
// No other page asserts structured data, so none can drift out of step with its own copy.
// V15, folding in V14: the two real article routes each carry one BlogPosting block, asserted with
// the editorial contract further down. Real records earn schema; fixtures never did.
for (const page of builtPages) {
  const count = schemaOf(page.text).length;
  const relative = page.path.replace(root, "");
  const carriesSchema = page.path.endsWith("/brawley/gts/index.html")
    || page.path === resolve(root, "index.html")
    || /^\/blog\/[^/]+\/index\.html$/.test(relative);
  if (count !== (carriesSchema ? 1 : 0)) failures.push(`${relative}: expected ${carriesSchema ? 1 : 0} JSON-LD blocks, found ${count}`);
}
// Every page states its own canonical, so the trailing-slash routes cannot compete with themselves.
for (const page of builtPages) {
  if (!/rel="canonical" href="https:\/\/vanderhall-website\.vercel\.app\//.test(page.text)) failures.push(`${page.path.replace(root, "")}: missing a canonical URL`);
}

const conceptsHubHtml = pageBySuffix("/concepts/index.html");
const conceptCards = (conceptsHubHtml.match(/<article class="card">/g) || []).length;
if (conceptCards !== 9) failures.push(`Concepts hub must present nine cards, found ${conceptCards}`);

// V18, Owen on 2026-08-10: the hub divides into the two families, On-Road first in his order.
// Membership is written out longhand per slug, as TERRAIN_TAGS above, and cross-checked against
// the data, so a record drifting between groups fails by name here rather than re-sorting
// silently. Balboa, the electric motorcycle, files as on-road per the plan.
const CONCEPT_TERRAIN = {
  indio: "on-road", coachella: "off-road", "brawley-r": "off-road", "santarosa-r": "on-road",
  speedster: "on-road", yuma: "off-road", "yuma-defense": "off-road", laduna: "off-road", balboa: "on-road",
};
const ON_ROAD_CONCEPTS = ["indio", "santarosa-r", "speedster", "balboa"];
const OFF_ROAD_CONCEPTS = ["coachella", "brawley-r", "yuma", "yuma-defense", "laduna"];
for (const concept of concepts) {
  if ((concept.terrain ?? null) !== CONCEPT_TERRAIN[concept.slug]) {
    failures.push(`concepts.mjs declares ${concept.slug} terrain ${concept.terrain ?? "none"}, not the ${CONCEPT_TERRAIN[concept.slug]} this script expects`);
  }
}
{
  const onRoadAt = conceptsHubHtml.indexOf("<h2>On-Road Concepts</h2>");
  const offRoadAt = conceptsHubHtml.indexOf("<h2>Off-Road Concepts</h2>");
  if (onRoadAt < 0 || offRoadAt < 0 || onRoadAt > offRoadAt) {
    failures.push("The concepts hub must head its two groups On-Road Concepts then Off-Road Concepts, in that order");
  } else {
    // Each grid holds exactly its family, in the data's own order, and nothing else.
    const gridSlugs = (html) => [...html.matchAll(/href="\/concepts\/([a-z-]+)\/"/g)].map((match) => match[1]);
    const onRoadFound = gridSlugs(conceptsHubHtml.slice(onRoadAt, offRoadAt));
    const offRoadFound = gridSlugs(withoutFooter(conceptsHubHtml.slice(offRoadAt)));
    if (JSON.stringify(onRoadFound) !== JSON.stringify(ON_ROAD_CONCEPTS)) failures.push(`The On-Road Concepts grid must hold ${ON_ROAD_CONCEPTS.join(", ")} in order, found ${onRoadFound.join(", ") || "none"}`);
    if (JSON.stringify(offRoadFound) !== JSON.stringify(OFF_ROAD_CONCEPTS)) failures.push(`The Off-Road Concepts grid must hold ${OFF_ROAD_CONCEPTS.join(", ")} in order, found ${offRoadFound.join(", ") || "none"}`);
  }
  // The card titles sit at h3 under the two group h2s, so the hub's heading order stays clean.
  const cardTitleH3s = (conceptsHubHtml.match(/<h3 class="card__title">/g) || []).length;
  if (cardTitleH3s !== 9) failures.push(`The nine concept card titles must sit at h3 under the group headings, found ${cardTitleH3s}`);
}

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

// V13. Experience replaces Owners in the primary navigation, per Q-V13-17. Both halves are asserted: the new
// item is present on every page, and the old one is gone from the primary menus on every page. Owners stays
// reachable from the footer, which is asserted separately above.
for (const page of builtPages) {
  const relative = page.path.replace(root, "");
  for (const [label, href] of [["Experience", "/experience/"], ["Dealers", "/dealers/"], ["Vehicles", "/vehicles/"], ["Concepts", "/concepts/"]]) {
    if (!new RegExp(`<a class="nav-link(?: is-current)?" href="${href}"`).test(page.text)) failures.push(`${relative}: ${label} is missing from the primary navigation`);
  }
  if (/<a class="nav-link[^"]*" href="\/owners\/"/.test(page.text)) failures.push(`${relative}: Owners must not remain in the primary navigation`);
  // The mobile sheet mirrors the desktop row, and its action is Contact Us to /contact/ rather than a second
  // Dealers link. That duplicate was a carried open item since V10 and this is what closes it.
  const sheet = (page.text.match(/<nav class="mobile-nav"[\s\S]*?<\/nav>/) || [])[0] || "";
  const sheetHrefs = [...sheet.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  if (JSON.stringify(sheetHrefs) !== JSON.stringify(["/vehicles/", "/concepts/", "/experience/", "/dealers/", "/contact/"])) {
    failures.push(`${relative}: the mobile menu must mirror the desktop navigation and end on Contact, found ${sheetHrefs.join(", ")}`);
  }
}
// Experience takes the current state on its hub, its archive, and every article.
for (const relative of ["/experience/index.html", "/blog/index.html", "/blog/what-is-a-side-by-side-experience-the-future-with-the-vanderhall-brawley/index.html"]) {
  const html = pageBySuffix(relative);
  if (!/<a class="nav-link is-current" href="\/experience\/" aria-current="page">Experience<\/a>/.test(html)) {
    failures.push(`${relative}: Experience must take the current primary-navigation state`);
  }
}

const sitemap = await readFile(resolve(root, "sitemap.xml"), "utf8");
// The full route list, written out. V13 adds twelve entries and keeps every existing one, including both past
// models: their routes and their owner manuals stay valid, which is exactly what Q-V13-9 preserved.
const SITEMAP_ROUTES = [
  "vehicles", "venice", "carmel", "santarosa", "brawley", "brawley/gts", "brawley/order", "santarosa/launch-edition",
  "concepts", "concepts/indio", "concepts/coachella", "concepts/brawley-r", "concepts/santarosa-r",
  "concepts/speedster", "concepts/yuma", "concepts/yuma-defense", "concepts/laduna", "concepts/balboa",
  "experience", "blog",
  // V15, folding in V14: the two real Vanderhall articles replace the two sample routes, and the
  // fictional safety notice routes are retired with the safety page's portal state. V17 lists the three
  // real notice routes below, which is a different thing: those records exist.
  "blog/what-is-a-side-by-side-experience-the-future-with-the-vanderhall-brawley",
  "blog/electric-off-road-vehicles-the-future-of-adventure-driving",
  "owners", "dealers", "contact", "careers", "careers/assembly-technician",
  // V17: the three real notice routes, named by the portal's own notice ids.
  "careers/customer-experience-specialist", "safety", "safety/sn-00003", "safety/sn-00001", "safety/sn-00002",
  "recommend-dealer", "dealer-inquiry", "privacy",
];
for (const route of SITEMAP_ROUTES) {
  if (!sitemap.includes(`<loc>https://vanderhall-website.vercel.app/${route}/</loc>`)) failures.push(`sitemap.xml is missing /${route}/`);
}
const sitemapCount = (sitemap.match(/<loc>/g) || []).length;
// One more than the list, because the homepage is in the sitemap and is not a named route.
if (sitemapCount !== SITEMAP_ROUTES.length + 1) failures.push(`sitemap.xml lists ${sitemapCount} URLs, expected ${SITEMAP_ROUTES.length + 1}`);
for (const route of ["/about/", "/faq/"]) {
  if (sitemap.includes(route)) failures.push(`sitemap.xml still lists ${route}`);
}
// A record whose detail page was not built must not be in the sitemap either. A URL here would be a
// 404 advertised to a crawler. V15: the retired sample routes join the card-only fixture.
for (const route of ["careers/mechanical-design-engineer", "blog/how-we-photograph-a-vehicle", "blog/notes-from-the-design-studio", "safety/placeholder-notice-a", "safety/placeholder-notice-b"]) {
  if (sitemap.includes(`/${route}/`)) failures.push(`sitemap.xml lists /${route}/, which has no built page`);
}

const manualFiles = files.filter((path) => path.includes("/assets/manuals/") && extname(path) === ".pdf");
if (manualFiles.length !== 19) failures.push(`Expected 19 owner manuals, found ${manualFiles.length}`);
const ownersHtml = pageBySuffix("/owners/index.html");
const manualCards = (ownersHtml.match(/class="resource-card"/g) || []).length;
if (manualCards !== 19) failures.push(`Owner manuals must list 19 manuals, found ${manualCards}`);
if ((ownersHtml.match(/type="application\/pdf"/g) || []).length !== 19) failures.push("Every owner resource card must declare its PDF type");
// V8 gave the groups the vehicle they are about. Venice, Carmel, and Brawley have delivered
// photography; Speedster and Laguna are retired roadsters with none in Assets/, and the concept
// named Speedster is a different machine that must not stand in for one.
// Footer first: the last group's slice would otherwise run to the end of the document and count
// the footer lockup as its photograph.
const ownerGroups = withoutFooter(ownersHtml).split('<section class="resource-group').slice(1);
if (ownerGroups.length !== 5) failures.push(`Owner manuals must present five model groups, found ${ownerGroups.length}`);
// V13. The title changes and the groups are current-first. Neither changes a file: the same nineteen PDFs, the
// same sizes, the same image pairings, reordered and retitled.
if (!ownersHtml.includes("<h1>Owner manuals.</h1>")) failures.push("/owners/ must carry the Owner manuals title");
if (!ownersHtml.includes("Find and download owner's manuals by model and year.")) failures.push("/owners/ must carry its approved introduction");
const ownerOrder = withoutFooter(ownersHtml).match(/<section class="resource-group[^"]*" id="([^"]+)"/g).map((tag) => tag.match(/id="([^"]+)"/)[1]);
if (JSON.stringify(ownerOrder) !== JSON.stringify(["brawley", "venice", "carmel", "speedster", "laguna"])) {
  failures.push(`/owners/ groups must run current-first, found ${ownerOrder.join(", ")}`);
}
// V16-I: the library is a plain list. No group carries a photograph any more, at any width.
for (const group of ownerGroups) {
  const slug = group.match(/id="([^"]+)"/)?.[1];
  const images = (group.match(/<img /g) || []).length;
  if (images !== 0) failures.push(`/owners/ group ${slug} must carry no photograph, found ${images}`);
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
// V13-G supersedes V10-A. The header action is Contact Us and it points at /contact/, which is a route now.
// Both halves are asserted, because the label moving without the href would leave the old destination.
for (const page of builtPages) {
  const relative = page.path.replace(root, "");
  const headerButtons = (page.text.match(/class="button button--primary header-request" href="\/contact\/">Contact Us</g) || []).length;
  if (headerButtons !== 1) failures.push(`${relative}: expected one Contact Us button in the header, found ${headerButtons}`);
  if (page.text.includes('class="button button--primary header-request" href="/dealers/"')) failures.push(`${relative}: the header action still points at /dealers/`);
}
if (dealersHtml.includes('class="form-heading"')) failures.push("/dealers/ must carry no form heading: the inquiry moved to /contact/");

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
  // V13: all three legal destinations are internal now. The external safety portal stays reachable, but from
  // the Safety page itself as a clearly labelled fallback rather than from the footer of every page.
  ["Safety notices", "/safety/"],
  ["Careers", "/careers/"],
  ["Privacy policy", "/privacy/"],
];
const EXPECTED_SOCIAL = 6;
const EXPECTED_LEGAL = 3;
// Vehicles, Owners, Connect, Follow. V15-G, Owen on 2026-08-06: "we have Vehicles, Owners, Connect,
// and Follow. Those are the only four." Experience folds into the Vehicles column under Concepts.
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

  // V13, Q-V13-26. The complete inquiry address, visible as text, in the Connect column, on every page. The
  // exact href matters as much as the label: a subject, a body, a tracking query, or a JavaScript handler
  // would each turn a mail link into something else, and the whole point of Owen's request was that a visitor
  // can read the address and use it however they like.
  const emailLink = (footer.match(/<a class="footer-email" href="mailto:([^"]+)">([^<]+)<\/a>/) || []);
  if (!emailLink.length) failures.push(`${relative}: the footer must carry the visible inquiry email link`);
  else {
    if (emailLink[1] !== INQUIRY_EMAIL) failures.push(`${relative}: the footer mail link points at ${emailLink[1]}, not ${INQUIRY_EMAIL}`);
    if (emailLink[2] !== INQUIRY_EMAIL) failures.push(`${relative}: the footer must show the complete address as its visible text, found ${emailLink[2]}`);
  }
  if (/mailto:[^"]*[?&]/.test(footer)) failures.push(`${relative}: the footer mail link carries a query string`);
  for (const generic of [">Email us<", ">Email<"]) {
    if (footer.includes(generic)) failures.push(`${relative}: the inquiry address must not hide behind a generic label`);
  }
  // Connect's order: Dealers, Contact, then the address immediately after it.
  if (!footer.includes('<a href="/contact/">Contact</a><a class="footer-email"')) failures.push(`${relative}: the inquiry address must sit immediately after Contact in the Connect column`);
  // V15-G. Experience sits in the Vehicles column directly under Concepts, and Blog has no footer
  // entry at all: the blog is part of Experience.
  if (!footer.includes('<a href="/concepts/">Concepts</a><a href="/experience/">Experience</a>')) failures.push(`${relative}: Experience must sit under Concepts in the Vehicles column`);
  if (footer.includes('href="/blog/"')) failures.push(`${relative}: the footer must not carry a Blog link`);
  if (footer.includes("<h2>Experience</h2>")) failures.push(`${relative}: the retired Experience footer column remains`);
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
  // V15-F: the visible Prototype label is retired with every other marker. The privacy-copy blocker
  // in src/data/prototype.mjs still holds the production gate, and the verbatim-copy assertions
  // below still prove the text is Vanderhall's own rather than anything invented here.
  if (privacyHtml.includes("Prototype policy structure")) {
    failures.push("/privacy/ still carries the retired prototype label");
  }
  // The table of contents: one nav, twelve entries, every one resolving to a section that exists on the page.
  const tocLinks = [...privacyHtml.matchAll(/<li><a href="#(policy-[a-z0-9-]+)">/g)].map((match) => match[1]);
  if (tocLinks.length !== 24) failures.push(`/privacy/ contents must offer twelve entries in each of its two presentations, found ${tocLinks.length}`);
  for (const id of new Set(tocLinks)) {
    if (!privacyHtml.includes(`<section class="policy__section" id="${id}">`)) failures.push(`/privacy/ contents links to #${id}, which is not a section on the page`);
  }
  if ((privacyHtml.match(/<nav class="policy-toc"/g) || []).length !== 1) failures.push("/privacy/ must carry exactly one contents nav, styled two ways rather than duplicated");
  // The document header is data-driven. Vanderhall publishes no effective or revision date, so neither may be
  // invented: the header prints what the record has, and today that is the contact route alone.
  if (/<dt>Effective<\/dt>|<dt>Last updated<\/dt>/.test(privacyHtml)) failures.push("/privacy/ prints a policy date Vanderhall has not published");
  if (!privacyHtml.includes("<dt>Questions</dt>")) failures.push("/privacy/ header must offer a way to ask about the policy");
  // Sliced section by section rather than matched with one regex across the document, so the count is
  // of paragraphs inside the policy and cannot be inflated by anything the page or footer adds later.
  const policySections = privacyHtml.split('<section class="policy__section" id=').slice(1)
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
const MARKED_HEADERS = ["/vehicles/index.html", "/concepts/index.html", "/dealers/index.html", "/recommend-dealer/index.html", "/dealer-inquiry/index.html", "/owners/index.html", "/privacy/index.html",
  // V17: the order page takes Contact's tight form header, and a notice detail takes the record header.
  "/brawley/order/index.html", "/safety/sn-00003/index.html",
  // V13's new page types take the same header treatment, which is most of what makes them read as part of the
  // same site rather than as pages added later.
  "/contact/index.html", "/experience/index.html", "/blog/index.html", "/careers/index.html", "/safety/index.html",
  "/blog/what-is-a-side-by-side-experience-the-future-with-the-vanderhall-brawley/index.html", "/careers/assembly-technician/index.html"];
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
// V18 adds the lineup group's old identity: the PAST MODELS eyebrow and its Past Models title
// gave way to the Vanderhall Legacy Vehicles family heading.
for (const retired of ["Design studies", ">OWNERS<", ">DEALERS<", ">CONCEPTS<", ">DEALER NETWORK<", ">INTERNATIONAL DEALERS<", ">PAST MODELS<", "<h2>Past Models</h2>"]) {
  if (combinedHtml.includes(retired)) failures.push(`A retired page-header eyebrow or title remains: ${retired}`);
}
if (!homeHtml.includes('<div class="section-heading section-heading--marked"><h2>Concepts</h2>')) failures.push("The homepage concepts section must carry one marked title reading Concepts");
// The informational eyebrows stay. D-V10-4: deleting these would delete content, not repetition.
// V15-H removes ELECTRIC OFF-ROAD UTV from this list: it repeated the descriptor directly beneath
// the GTS name, which is the same duplication V10 retired from the page headers.
for (const [route, text] of [["/brawley/gts/index.html", "DISCLOSURES"], ["/concepts/indio/index.html", "CONCEPT"], ["/brawley/index.html", "IN DETAIL"]]) {
  if (!pageBySuffix(route).includes(`<p class="eyebrow">${text}</p>`)) failures.push(`${route}: the informational ${text} eyebrow must stay`);
}
// V15-H, Owen on 2026-08-06, on the Brawley hero's "electric · 4x4": "Take that away. We don't need a
// ton of little text." No model hero carries an eyebrow, and neither does the GTS opening block.
for (const slug of MODEL_SLUGS) {
  const heroContent = pageBySuffix(`/${slug}/index.html`).match(/<div class="hero__content"[\s\S]*?<h1|<div class="hero__content"[\s\S]*?<div class="model-headline"/)?.[0] || "";
  if (heroContent.includes('class="eyebrow"')) failures.push(`/${slug}/ hero must carry no eyebrow above the model name`);
}
if (pageBySuffix(GTS_PATH).includes('<p class="eyebrow">ELECTRIC OFF-ROAD UTV</p>')) failures.push("/brawley/gts/ still carries the retired ELECTRIC OFF-ROAD UTV eyebrow");

// ONE ambient block, on the homepage, and nowhere else: D-V11-2 and D-V11-3 set the placement, and
// the V13 film inherits it from the montage it replaces. The block has to be complete in the markup,
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
  for (const required of ["muted", "playsinline", 'preload="none"']) {
    if (!tag.includes(required)) failures.push(`${key}: ambient video is missing ${required}`);
  }
  if (tag.includes("autoplay")) failures.push(`${key}: ambient video must not declare autoplay`);
  // V15-A, Owen on 2026-08-06: "make sure that it never stops, so just put it as a loop." The V13
  // play-once hold is retired; the film loops for as long as the page is open, and the cut from the
  // close front view back to the rock ledge is the accepted cost of continuous motion.
  if (!/\sloop[\s>]/.test(tag)) failures.push(`${key}: the film must carry the loop attribute; Owen asked for motion that never stops`);
  // Ships hidden. site.js reveals it only once playback has actually been attempted, which is the
  // same rule the concept band's pause button follows.
  if (!/data-ambient-toggle hidden>Pause<\/button>/.test(html)) failures.push(`${key}: the ambient control must ship hidden and labelled Pause`);
  if (html.includes("data-painted")) failures.push(`${key}: data-painted must be set by the island, never shipped in the markup`);
  const poster = kind === "hero"
    ? html.match(/<img class="hero__image"[^>]*>/)?.[0]
    : html.match(/<img class="ambient__poster"[^>]*>/)?.[0];
  if (!poster) { failures.push(`${key}: the ambient block has no poster image`); continue; }
  if (!/width="1920" height="1080"/.test(poster)) failures.push(`${key}: the poster must declare the 1920 by 1080 box the video shares`);
  const rungs = [...poster.matchAll(/(\d+)w/g)].map((match) => match[1]);
  if (JSON.stringify(rungs) !== JSON.stringify(["960", "1280", "1920"])) failures.push(`${key}: the poster must offer the three delivered rungs, found ${rungs.join(", ")}`);
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
// V16-D: three wide poster rungs and four tall still rungs, every one referenced by a page.
if (deliveredPosters.length !== 7) failures.push(`Expected seven delivered poster and still rungs, found ${deliveredPosters.length}`);
// V11-A retired ten files; the V13 film delivery retires the montage's five as well. Every stem is
// deleted, not merely unreferenced, and they are named here so the deletion cannot be quietly undone
// by a copy from the source package. The V11 loops' package is untouched in Assets/Video Image Plan/
// and the montage can be re-cut from the same source, so restoring any of them is cheap; what this
// forbids is a restore that nobody decided on. The orphan check above would catch the video files,
// but not the poster rungs, which is why every basename is listed.
for (const stem of ["brawley-canyon-hero-36-46", "brawley-canyon-action-13-23", "brawley-canyon-hero-poster", "brawley-canyon-action-13-23-poster", "brawley-canyon-montage-00-12", "brawley-canyon-montage-00-12-poster"]) {
  const survivors = files.filter((path) => path.includes("/assets/video/") && path.includes(stem)).map((path) => path.replace(root, ""));
  if (survivors.length) failures.push(`Retired video delivery remains: ${survivors.join(", ")}`);
}

// ---------------------------------------------------------------------------------------------
// V13. Four new assertion families: the public brand name, the mock-data production gate, the sample
// markers, and the new routes' shape.
// ---------------------------------------------------------------------------------------------

// Q-V13-25. `Vanderhall Motor Works` may not appear in anything delivered to a visitor: HTML, titles,
// metadata, JSON-LD, accessible labels, the web manifest, the sitemap, or robots.txt. Case-insensitive,
// because a stylised lowercase spelling would be the same claim.
//
// Source comments, this file, archived plans, and the research notes are deliberately NOT scanned. The plan
// permits the old name in material that is not delivered, and the reason is practical: the withheld legal
// sentence and the reasoning behind removing it both have to be recorded somewhere, and a check that forbade
// writing down what was removed would push that record out of the repository entirely.
const DELIVERED_TEXT = [
  ...builtPages.map((page) => [page.path.replace(root, ""), page.text]),
  ["/sitemap.xml", sitemap],
  ["/site.webmanifest", await readFile(resolve(root, "site.webmanifest"), "utf8")],
  ["/robots.txt", await readFile(resolve(root, "robots.txt"), "utf8")],
  ["/styles/bundle.css", bundleCss],
  ["/scripts/site.js", await readFile(resolve(root, "scripts/site.js"), "utf8")],
];
for (const [name, text] of DELIVERED_TEXT) {
  if (/vanderhall\s+motor\s+works/i.test(text)) failures.push(`${name}: the retired public brand name Vanderhall Motor Works reaches delivered output`);
}
// And the positive half, so the sweep cannot be satisfied by deleting the name rather than replacing it.
for (const page of builtPages) {
  const relative = page.path.replace(root, "");
  if (!/<title>[^<]* \| Vanderhall<\/title>/.test(page.text)) failures.push(`${relative}: the document title must end in the Vanderhall-only suffix`);
  if (!page.text.includes("<span>© 2026 Vanderhall. Hand-built in Provo, Utah.</span>")) failures.push(`${relative}: the footer must carry the Vanderhall-only copyright line`);
  if (!page.text.includes('class="footer-lockup" src="/assets/brand/vanderhall-lockup-horizontal-white.svg" width="231" height="24" loading="lazy" decoding="async" alt="Vanderhall"')) {
    failures.push(`${relative}: the footer lockup's alt text must be Vanderhall, which is what the artwork actually draws`);
  }
}
if (!homeHtml.includes('<p class="eyebrow">VANDERHALL</p>')) failures.push("The homepage eyebrow must read VANDERHALL");
const manifestJson = JSON.parse(await readFile(resolve(root, "site.webmanifest"), "utf8"));
if (manifestJson.name !== "Vanderhall" || manifestJson.short_name !== "Vanderhall") failures.push(`The web manifest must name the brand Vanderhall, found ${manifestJson.name} / ${manifestJson.short_name}`);
for (const node of [...(homeSchemas[0]?.["@graph"] || [])]) {
  if (node.name && node.name !== "Vanderhall") failures.push(`The homepage schema's ${node["@type"]} is named ${node.name}, not Vanderhall`);
}
const gtsSchema = gtsSchemas[0];
if (gtsSchema?.brand?.name !== "Vanderhall") failures.push(`The GTS Product brand is ${gtsSchema?.brand?.name}, not Vanderhall`);
if (gtsSchema?.offers?.seller?.name !== "Vanderhall") failures.push(`The GTS Offer seller is ${gtsSchema?.offers?.seller?.name}, not Vanderhall`);

// Q-V13-27. The trademark attribution that named the corporate entity is withheld rather than paraphrased,
// and this asserts both halves of that: the two safety sentences it shared a paragraph with still ship
// verbatim, and no rewritten attribution has been invented in their place.
if (!gtsHtml.includes("Never ride under the influence of alcohol or drugs. All riders should take a safety training course.")) {
  failures.push("/brawley/gts/ must keep both safety sentences from the paragraph the trademark clause was removed from");
}
if (/registered trademarks/i.test(combinedHtml)) failures.push("A trademark attribution has been written into the public build without legal-approved wording");
if (modelBySlug.brawley.gts.trademarkClause !== null) failures.push("The Brawley trademark clause must stay null until legal supplies Vanderhall-only wording");

// The production gate. In prototype mode the build renders sample markers and the six mock-data routes carry a
// noindex; a production build refuses to run at all. What is asserted here is that the gate exists, that its
// blocker list is not empty while sample content is live, and that the two things stay consistent.
if (!PRODUCTION_BLOCKERS.length) failures.push("The production blocker list is empty while mock records are still being published");
const blockerIds = PRODUCTION_BLOCKERS.map((blocker) => blocker.id);
// V15: article-records is resolved (the fictional fixtures are gone, replaced by the two real
// articles) and article-claim-review takes its place, holding the gate until Vanderhall reviews the
// migrated copy's claims.
// V17 adds brawley-order-endpoint. The order form is now the site's only order path, so an unwired
// endpoint is a heavier blocker than it was for any earlier form.
for (const required of ["dealer-records", "contact-endpoint", "launch-interest-endpoint", "brawley-order-endpoint", "article-claim-review", "career-records", "safety-records", "privacy-copy", "brawley-trademark-clause", "brawley-film"]) {
  if (!blockerIds.includes(required)) failures.push(`The production blocker list is missing ${required}`);
}
for (const blocker of PRODUCTION_BLOCKERS) {
  if (!blocker.owner || !blocker.detail) failures.push(`Production blocker ${blocker.id} has no owner or no detail`);
}
// INTEGRATION.md has to name every one of them. A blocker with no entry in the handoff document is a thing
// John has not been told about.
const integration = await readFile(resolve(root, "INTEGRATION.md"), "utf8");
for (const blocker of PRODUCTION_BLOCKERS) {
  if (!integration.includes(blocker.id)) failures.push(`INTEGRATION.md does not document the production blocker ${blocker.id}`);
}

// V15-F inverts the V13 marker rule. Owen asked for every visible "Sample" and scaffolding sentence
// to leave the site, so the assertion is now absence, everywhere, in every delivered file: the
// marker classes, their sentences, and the preview language may appear in nothing a visitor
// receives. The honesty they carried lives on in the production gate, the per-route noindex, and
// fixtures that are fictional by construction.
const SCAFFOLDING_TOKENS = ['class="sample-note"', 'class="sample-tag"', "Sample content", "Sample notice", "sample record", "Sample posting", "design preview", "not connected yet", "layout review", "Prototype copy", "Prototype policy"];
for (const [name, text] of DELIVERED_TEXT) {
  for (const token of SCAFFOLDING_TOKENS) {
    if (text.includes(token)) failures.push(`${name}: scaffolding language reaches delivered output: ${token}`);
  }
}
// V17-B. The safety page publishes records again, and this time they are Vanderhall's real notices.
//
// Three V15 assertions are gone from here: the ban on notice cards, the ban on notice detail pages, and
// the ban on the words accelerator, tie-rod, rear-steer and electrical shock. All three existed to stop
// a FICTIONAL recall reaching a visitor, and none of them describes a rule about real ones. What
// replaces them is stricter in the direction that still matters: every published notice is written out
// below by id, in posted order, each with the portal URL it was transcribed from, and the fictional
// fixture file has to stay deleted.
//
// What survives V15 unchanged: the portal stays reachable, because these records are a snapshot and the
// portal is the live document, and the page still never claims an absence of notices in either
// direction.
const safetyHtml = pageBySuffix("/safety/index.html");
for (const claim of ["no active recalls", "No active recalls", "no current notices", "No notices"]) {
  if (safetyHtml.includes(claim)) failures.push(`/safety/ must not claim an absence of notices: ${claim}`);
}
// The external portal stays reachable from the safety page while parity is unverified. Q-V13-10.
if (!safetyHtml.includes("https://portal.vanderhallusa.com/safety_notices")) failures.push("/safety/ must keep the official portal reachable");
// The three real notices, written out rather than derived from the data that produced the page.
const SAFETY_NOTICE_SOURCES = [
  ["SN-00003", "/safety/sn-00003/index.html", "https://portal.vanderhallusa.com/safety_notices/3"],
  ["SN-00001", "/safety/sn-00001/index.html", "https://portal.vanderhallusa.com/safety_notices/1"],
  ["SN-00002", "/safety/sn-00002/index.html", "https://portal.vanderhallusa.com/safety_notices/2"],
];
const noticeCards = (safetyHtml.match(/class="record-card record-card--notice"/g) || []).length;
if (noticeCards !== SAFETY_NOTICE_SOURCES.length) failures.push(`/safety/ must publish ${SAFETY_NOTICE_SOURCES.length} notice cards, found ${noticeCards}`);
// Newest first, asserted against the real posted dates rather than against the sort that produced them.
let lastIndex = -1;
for (const [id] of SAFETY_NOTICE_SOURCES) {
  const at = safetyHtml.indexOf(id);
  if (at === -1) { failures.push(`/safety/ does not list ${id}`); continue; }
  if (at < lastIndex) failures.push(`/safety/ lists ${id} out of posted order, newest first`);
  lastIndex = at;
}
const safetyDetailPages = builtPages.filter((page) => /\/safety\/[^/]+\/index\.html$/.test(page.path.replace(root, "")));
if (safetyDetailPages.length !== SAFETY_NOTICE_SOURCES.length) failures.push(`Expected ${SAFETY_NOTICE_SOURCES.length} safety notice detail pages, found ${safetyDetailPages.length}`);
// A republished notice cites the copy it came from, and collects nothing. A safety page with a form on
// it is a safety page that has become a lead source.
const REPUBLICATION_LINE = "Republished from Vanderhall's official safety notices portal, read on";
if (!safetyHtml.includes(REPUBLICATION_LINE)) failures.push("/safety/ must say where its notices were republished from and when");
for (const [id, relative, sourceUrl] of SAFETY_NOTICE_SOURCES) {
  const html = pageBySuffix(relative);
  if (!html) { failures.push(`${relative}: notice ${id} has no built page`); continue; }
  if (!html.includes(`href="${sourceUrl}"`)) failures.push(`${relative}: must link to the portal copy at ${sourceUrl}`);
  if (!html.includes(REPUBLICATION_LINE)) failures.push(`${relative}: must say where it was republished from and when`);
  if (html.includes("data-site-form")) failures.push(`${relative}: a safety notice must collect nothing`);
}
// The fictional fixtures are deleted, not parked beside the real records. Restoring that file has to be
// a decision somebody makes on purpose.
if (existsSync(resolve(root, "src/data/mock/safety.mjs"))) failures.push("The fictional safety fixtures are back in src/data/mock/safety.mjs and must not be");
// Careers must not have copied the live postings.
const careersHtml = pageBySuffix("/careers/index.html");
for (const posting of ["Paralegal", "Welding Operator"]) {
  if (careersHtml.includes(posting)) failures.push(`/careers/ copies the live ${posting} posting, which is a current operational record`);
}
// No applicant data is collected by a prototype apply action.
for (const relative of ["/careers/assembly-technician/index.html", "/careers/customer-experience-specialist/index.html"]) {
  const html = pageBySuffix(relative);
  if (!/<button class="button button--primary" type="button" disabled/.test(html)) failures.push(`${relative}: the sample apply action must be disabled`);
  if (html.includes("data-site-form")) failures.push(`${relative}: a prototype job page must collect no applicant data`);
}

// The noindex, on exactly the routes that should not be found in a search result, and on no others. Both
// directions, because a noindex on the homepage would be as wrong as its absence on /dealers/.
// V15: /experience/ and /blog/ leave the set with their fictional records. The two articles are
// real, previously published Vanderhall editorial, so keeping them out of an index would hide real
// content to protect nothing.
// V17-D-V17-9: the safety routes stay, and for a different reason than the rest of this set now that
// their records are real. These are static transcriptions of time-sensitive documents, and nothing here
// learns that Vanderhall has revised one. A stale indexed recall is the single page on this site where
// being out of date has a safety cost, so the portal keeps the search presence until the live source is
// connected. The three notice details join the index page. The order page is not in the set: it carries
// no records and behaves like Contact.
const NOINDEX_EXPECTED = new Set([
  "/dealers/index.html",
  "/careers/index.html", "/careers/assembly-technician/index.html", "/careers/customer-experience-specialist/index.html",
  "/safety/index.html", "/safety/sn-00003/index.html", "/safety/sn-00001/index.html", "/safety/sn-00002/index.html",
  "/santarosa/launch-edition/index.html",
]);
for (const page of builtPages) {
  const relative = page.path.replace(root, "");
  const noindexed = page.text.includes('<meta name="robots" content="noindex, follow">');
  if (NOINDEX_EXPECTED.has(relative) && !noindexed) failures.push(`${relative}: this route defers to an authoritative source and must not be indexable`);
  if (!NOINDEX_EXPECTED.has(relative) && noindexed) failures.push(`${relative}: this route is authoritative here and must stay indexable`);
}
// robots.txt still allows crawling, deliberately: a Disallow rule would stop a crawler before it could read
// the noindex above, which is the classic way to leave a page indexed while believing it is hidden.
const robots = await readFile(resolve(root, "robots.txt"), "utf8");
if (!robots.includes("Allow: /") || robots.includes("Disallow")) failures.push("robots.txt must keep crawling allowed so the per-route noindex can be read");

// The Launch Edition. The required claims, the banned ones, and the distinction the whole page rests on.
const launchHtml = pageBySuffix("/santarosa/launch-edition/index.html");
if (!launchHtml) failures.push("/santarosa/launch-edition/ was not built");
else {
  for (const required of ["Be Among the First.", "The Vanderhall Santarosa Launch Edition", "United States only", "50 individually numbered vehicles", "40 kWh battery", "fourth quarter of 2026", "Existing Santarosa reservation holders", "Authorized Vanderhall dealers", "Public reservations, anticipated by the end of August 2026 and subject to availability"]) {
    if (!launchHtml.includes(required)) failures.push(`/santarosa/launch-edition/ is missing required copy: ${required}`);
  }
  // The priority order, in order, rather than merely present.
  const priorityOrder = [...launchHtml.matchAll(/<li>((?:Existing|Authorized|Public)[^<]*)<\/li>/g)].map((match) => match[1]);
  if (priorityOrder.length !== 3 || !priorityOrder[0].startsWith("Existing") || !priorityOrder[1].startsWith("Authorized") || !priorityOrder[2].startsWith("Public")) {
    failures.push(`/santarosa/launch-edition/ must publish the reservation priority in order, found ${priorityOrder.join(" / ")}`);
  }
  // Q-V13-20. No public reserve action while the campaign is interest-open, and no reservation language that
  // would turn a registration of interest into a commitment.
  if (/>Reserve<|Reserve your interest|reservations are now open/i.test(launchHtml)) failures.push("/santarosa/launch-edition/ offers a reservation action while the campaign is not in a verified public-reservation phase");
  if (!launchHtml.includes("Registering your interest does not create a reservation, assign a number, hold a build slot, or guarantee availability.")) {
    failures.push("/santarosa/launch-edition/ must state what registering does not do");
  }
  // The qualifiers Owen's boss supplied are load-bearing: removing one materially changes the claim.
  for (const qualifier of ["expected to begin", "anticipated by the end of August 2026", "subject to availability"]) {
    if (!launchHtml.includes(qualifier)) failures.push(`/santarosa/launch-edition/ must preserve the qualifier "${qualifier}"`);
  }
  // No price, no deposit, no Offer schema, and no reintroduced Santarosa range or power.
  for (const banned of ["MSRP", "deposit", "refundable", "Offer", "150 mi", "300 mi", "180 hp"]) {
    if (launchHtml.includes(banned)) failures.push(`/santarosa/launch-edition/ must publish no ${banned}`);
  }
  // The 40 kWh figure carries the estimate note through the footnote system, not a typed asterisk.
  if (!/40 kWh battery<sup class="fn-ref">/.test(launchHtml)) failures.push("/santarosa/launch-edition/ must mark the 40 kWh figure with the shared estimate footnote");
  if (!launchHtml.includes(SPEC_DISCLAIMER)) failures.push("/santarosa/launch-edition/ must resolve its footnote on the same page");
  if (!launchHtml.includes('data-form-id="santarosa-launch-interest"')) failures.push("/santarosa/launch-edition/ must carry its own form identity");
  // Eight required fields, and no invented consent checkbox.
  const requiredFields = (launchHtml.match(/required aria-required="true"/g) || []).length;
  if (requiredFields !== 8) failures.push(`/santarosa/launch-edition/ must require all eight supplied fields, found ${requiredFields}`);
  if (/type="checkbox"/.test(launchHtml)) failures.push("/santarosa/launch-edition/ carries a consent checkbox whose wording legal has not supplied");
}

// The homepage status band. Brawley first, in the DOM, with both actions read from the campaign data.
// V15-B, Owen on 2026-08-06: it closes the page now, centered on the silver field, rather than
// sitting between the hero and the lineup.
const bandStart = homeHtml.indexOf('class="bleed campaign-band"');
if (bandStart < 0) failures.push("The homepage must carry the campaign status band");
else {
  const band = homeHtml.slice(bandStart, homeHtml.indexOf("</section>", bandStart));
  const items = (band.match(/class="campaign-band__item"/g) || []).length;
  if (items !== 2) failures.push(`The homepage status band must carry two items, found ${items}`);
  const order = [...band.matchAll(/class="campaign-band__label">([^<]+)</g)].map((match) => match[1]);
  if (!order[0]?.startsWith("Brawley")) failures.push(`The status band must lead with Brawley, found ${order[0]}`);
  if (!order[1]?.startsWith("Santarosa")) failures.push(`The status band's second item must be Santarosa, found ${order[1]}`);
  if (!band.includes('href="/brawley/"') || !band.includes('href="/santarosa/launch-edition/"')) failures.push("The status band's two actions must lead to Brawley and the Launch Edition");
  if (/>Reserve</.test(band)) failures.push("The status band must not offer a public Reserve action outside a verified public-reservation phase");
  if (!band.includes('class="campaign-band__inner"')) failures.push("The status band must carry its centered inner column");
  // It is the last section of the page: after the lineup, after the concepts split, before nothing.
  if (bandStart < homeHtml.indexOf('id="vehicles"') || bandStart < homeHtml.indexOf('class="section split split--media-first"')) {
    failures.push("The status band must close the homepage, after the lineup and the concepts split");
  }
  if (homeHtml.indexOf("<section", bandStart + 1) !== -1) failures.push("The status band must be the homepage's final section");
}
// The approved homepage h1 is untouched by the band.
if (!homeHtml.includes("<h1>Handcrafted electric vehicles.</h1>")) failures.push("The campaign band must not replace the approved homepage h1");

// The Experience hub launches with Blog content only. Every one of these is an absence, and absences are what
// this page needs asserted: a Coming soon event card is the exact thing Q-V13-18 forbids.
const experienceHtml = pageBySuffix("/experience/index.html");
if (!experienceHtml.includes("<h1>The Vanderhall experience.</h1>")) failures.push("/experience/ must carry its approved title");
if (!experienceHtml.includes("Latest from Vanderhall.")) failures.push("/experience/ must head its feed Latest from Vanderhall");
// V15-D: one feed, no BLOG framing. The heading takes the marked treatment instead of a category
// eyebrow, the archive button is gone (two stories do not need an archive door), and no card prints
// a category kicker: every story presents the same way regardless of its record's category.
if (experienceHtml.includes('<p class="eyebrow">BLOG</p>')) failures.push("/experience/ still carries the retired BLOG eyebrow");
if (!/section-heading section-heading--marked"><h2>Latest from Vanderhall\./.test(experienceHtml)) failures.push("/experience/ feed heading must take the marked treatment");
if (experienceHtml.includes(">View all stories<")) failures.push("/experience/ still offers the retired archive action");
if (combinedHtml.includes("post-card__category")) failures.push("A post card still prints its category kicker");
if (combinedHtml.includes("article-header__category")) failures.push("An article header still prints its category kicker");
// Narrowed deliberately. A sample ARTICLE whose category is Events is editorial and allowed; what Q-V13-18
// forbids is an events surface, so the ban is on the shapes one would take: a module heading, a coming-soon
// card, a registration action, an events route, or Event schema.
for (const token of ["<h2>Events</h2>", "Coming soon", "coming soon", "Register now", 'href="/events/"', "EventSeries", '"@type":"Event"']) {
  if (experienceHtml.includes(token)) failures.push(`/experience/ must render no event placeholder, found ${token}`);
}
if ((experienceHtml.match(/class="[^"]*experience-module[^"]*"/g) || []).length !== 1) failures.push("/experience/ must launch with exactly one module, the Blog area");
const experiencePosts = (experienceHtml.match(/<article class="post-card/g) || []).length;
if (experiencePosts !== 2) failures.push(`/experience/ must present the two real stories, found ${experiencePosts}`);
// The November article leads, featured, and both cards open into their complete articles.
if (!/post-card--featured[\s\S]*what-is-a-side-by-side-experience-the-future-with-the-vanderhall-brawley/.test(experienceHtml)) {
  failures.push("/experience/ must feature the November side-by-side article");
}

// The blog archive and the two real article routes, folded in from the V14 editorial migration.
const ARTICLE_ROUTES = [...EDITORIAL_CLAIM_EXEMPT];
const blogHtml = pageBySuffix("/blog/index.html");
if ((blogHtml.match(/<article class="post-card/g) || []).length !== 2) failures.push("/blog/ must present the two migrated records");
if (blogHtml.includes("This story is not published yet.")) failures.push("/blog/ carries an unpublished placeholder, and the archive must hold only linked records");
for (const relative of ARTICLE_ROUTES) {
  const html = pageBySuffix(relative);
  if (!html.includes('class="prose"')) failures.push(`${relative}: the article body did not render`);
  // The complete migrated record: real author, original publication date, standfirst, hero, and the
  // other article as related reading.
  if (!html.includes("Vanderhall USA")) failures.push(`${relative}: the article must carry its real author`);
  if (!html.includes('class="article-header__standfirst"')) failures.push(`${relative}: the article must carry its standfirst`);
  if (!html.includes('class="article-hero"')) failures.push(`${relative}: the article must carry its source hero image`);
  if (!html.includes("Related reading.")) failures.push(`${relative}: the article must offer the other story as related reading`);
  // BlogPosting JSON-LD, read back out of the page rather than trusted from the data.
  const schema = (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  const parsed = schema ? JSON.parse(schema.replaceAll("<\\/", "</")) : null;
  if (parsed?.["@type"] !== "BlogPosting") failures.push(`${relative}: the article must carry BlogPosting JSON-LD`);
  else {
    if (!parsed.datePublished?.startsWith("2025-")) failures.push(`${relative}: the BlogPosting must carry the article's real 2025 publication date`);
    if (!parsed.url?.endsWith(relative.replace("/index.html", "/"))) failures.push(`${relative}: the BlogPosting URL must be the article's own route`);
  }
  // No WordPress furniture came across.
  for (const token of ["Leave a comment", "comment-form", "Posted in", "Read more", "author-archive", "wp-content", "shortcode"]) {
    if (html.includes(token)) failures.push(`${relative}: legacy blog furniture remains: ${token}`);
  }
}
// The publication dates print under their original years, so the stories read as the dated editorial
// they are rather than as new claims.
for (const date of ['datetime="2025-11-12"', 'datetime="2025-10-25"']) {
  if (!blogHtml.includes(date)) failures.push(`/blog/ must print the original publication date ${date}`);
}

if (failures.length) {
  console.error(`Content checks failed (${failures.length}):\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`Content checks passed across ${builtPages.length} pages. Zero public data gates or placeholders remain.`);
