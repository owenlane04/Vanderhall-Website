import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import axe from "axe-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.VHW_BASE_URL || "http://127.0.0.1:4173";
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outputDir = resolve(root, "work/browser-verification");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const report = { routes: [], accessibility: {}, heroes: {}, zoom200: {}, forms: {}, media: {}, interactions: {}, noJs: {}, reducedMotion: {}, consoleErrors: [] };
const failures = [];
const conceptSlugs = ["indio", "coachella", "brawley-r", "santarosa-r", "speedster", "yuma", "yuma-defense", "laduna", "balboa"];
const conceptRoutes = conceptSlugs.map((slug) => `/concepts/${slug}/`);
// V13 adds twelve routes. Every one of them joins this smoke pass, the axe array, and the reveal coverage
// suite, because a route that is not in all three is a route nobody is checking.
// V15, folding in V14: the two real Vanderhall articles replace the sample routes, and the fictional
// safety notice routes are retired with the safety page's portal state.
// V17: notice routes return, this time as Vanderhall's three real recalls, and the Brawley order page
// joins the form routes.
const articleRoutes = ["/blog/what-is-a-side-by-side-experience-the-future-with-the-vanderhall-brawley/", "/blog/electric-off-road-vehicles-the-future-of-adventure-driving/"];
const careerRoutes = ["/careers/assembly-technician/", "/careers/customer-experience-specialist/"];
const noticeRoutes = ["/safety/sn-00003/", "/safety/sn-00001/", "/safety/sn-00002/"];
const routes = ["/", "/vehicles/", "/brawley/", "/brawley/gts/", "/brawley/order/", "/santarosa/", "/santarosa/launch-edition/", "/carmel/", "/venice/", "/concepts/", ...conceptRoutes, "/experience/", "/blog/", ...articleRoutes, "/dealers/", "/contact/", "/careers/", ...careerRoutes, "/safety/", ...noticeRoutes, "/recommend-dealer/", "/dealer-inquiry/", "/owners/", "/privacy/", "/404/"];

const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(5000);
// The reveal animations advance with scroll position, so a full-page screenshot or an axe pass
// would otherwise catch below-fold blocks mid-entry and report them as invisible. This run
// resolves them to their final state; the motion itself is verified separately below.
await page.emulateMedia({ reducedMotion: "reduce" });
page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
page.on("pageerror", (error) => report.consoleErrors.push(error.message));

async function loadLazyMedia(targetPage) {
  await targetPage.locator("img").evaluateAll(async (images) => {
    images.forEach((image) => { image.loading = "eager"; });
    await Promise.all(images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolveImage) => {
        image.addEventListener("load", resolveImage, { once: true });
        image.addEventListener("error", resolveImage, { once: true });
      });
    }));
  });
  await targetPage.evaluate(async () => {
    const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
    for (let position = 0; position < document.documentElement.scrollHeight; position += innerHeight * 0.75) {
      scrollTo(0, position);
      await delay(40);
    }
    scrollTo(0, 0);
    await delay(80);
    await Promise.all([...document.images].map((image) => image.complete ? Promise.resolve() : new Promise((done) => {
      image.addEventListener("load", done, { once: true });
      image.addEventListener("error", done, { once: true });
    })));
    // Decoding matters for full-page capture: a loaded but undecoded image paints blank.
    await Promise.all([...document.images].map((image) => image.decode?.().catch(() => {})));
  });
  await targetPage.waitForFunction(() => [...document.images].every((image) => image.complete), null, { timeout: 10000 });
}

for (const route of routes) {
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const status = response?.status();
  const h1Count = await page.locator("h1").count();
  const bodyLength = (await page.locator("body").innerText()).trim().length;
  await loadLazyMedia(page);
  const brokenImages = await page.locator("img").evaluateAll((images) => images.filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc || image.getAttribute("src")));
  // V13: Owners left the primary navigation and Experience took its place. Both halves are pinned on every
  // route, and the footer entry that keeps the manual library reachable is pinned alongside them.
  const ownersInNav = await page.locator('.desktop-nav a[href="/owners/"]').count();
  const experienceInNav = await page.locator('.desktop-nav a[href="/experience/"]').count();
  const dealersInNav = await page.locator('.desktop-nav a[href="/dealers/"]').count();
  const ownersInFooter = await page.locator('.footer-links a[href="/owners/"]').count();
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  report.routes.push({ route, status, h1Count, bodyLength, brokenImages, ownersInNav, experienceInNav, dealersInNav, ownersInFooter, pageHeight });
  if (status !== 200 || h1Count !== 1 || bodyLength < 100 || brokenImages.length) failures.push(`Route check failed for ${route}`);
  if (ownersInNav !== 0) failures.push(`${route}: Owners must not remain in the primary navigation`);
  if (experienceInNav !== 1 || dealersInNav !== 1) failures.push(`${route}: expected Experience and Dealers once each in the primary navigation`);
  if (ownersInFooter !== 1) failures.push(`${route}: the manual library must stay reachable from the footer`);
}

// Probed on a throwaway page so the expected 404s do not pollute the console-error audit.
// Locally these routes simply do not exist; in production the vercel.json redirects carry
// /about/ home and /contact/ to its replacement, /dealers/.
const probeContext = await browser.newContext();
const probePage = await probeContext.newPage();
report.interactions.retiredRoutes = {};
// V13-G: /contact/ is a real route now, asserted in the smoke pass above and in contactFlow below. About and
// FAQ keep their retirement behaviour.
for (const [route, destination] of [["/about/", "/"], ["/faq/", null]]) {
  const response = await probePage.goto(`${base}${route}`, { waitUntil: "load" });
  const landedOn = new URL(probePage.url()).pathname;
  const removed = response?.status() === 404 || (destination !== null && landedOn === destination);
  report.interactions.retiredRoutes[route] = { status: response?.status(), landedOn, expected: destination, removed };
  if (!removed) failures.push(`${route} still resolves: ${response?.status()} at ${landedOn}`);
}
await probeContext.close();

// /carmel/ joins the list in V8: it had never been audited, and it now publishes figures and a tag.
// /privacy/ joins the list in V10: it is the site's only page of running legal copy, its own list
// markup, and a long wrapping link, so it is the page most likely to fail on contrast or reflow.
// V11-E puts the concepts hub and all nine detail pages on a white field, which changes every
// contrast pair on ten routes at once, so all ten are audited rather than the hub and one sample.
// V13 adds the Experience hub, the Launch Edition, and every new index plus one representative detail of
// each. The two past-model galleries stay in the list because their layout changed completely.
// V17 adds the order page and all three notice details. All three, not one representative: each is a
// different length of running legal copy with its own list and heading structure, and this is the one
// place on the site where a visitor may be reading under stress.
for (const route of ["/", "/vehicles/", "/brawley/", "/brawley/gts/", "/brawley/order/", "/santarosa/", "/santarosa/launch-edition/", "/venice/", "/carmel/", "/recommend-dealer/", "/dealer-inquiry/", "/concepts/", ...conceptRoutes, "/owners/", "/dealers/", "/contact/", "/experience/", "/blog/", ...articleRoutes, "/careers/", "/careers/assembly-technician/", "/safety/", ...noticeRoutes, "/privacy/", "/404/"]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async () => axe.run(document, { resultTypes: ["violations"] }));
  report.accessibility[route] = result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.length,
    help: violation.help,
    samples: violation.nodes.slice(0, 8).map((node) => ({ target: node.target, html: node.html, summary: node.failureSummary })),
  }));
  if (result.violations.length) failures.push(`axe violations on ${route}: ${result.violations.map((violation) => violation.id).join(", ")}`);
}
// V9 collapsed the two axe passes into one. There used to be a second run with data-theme="dark"
// forced on, because the default was light; the default is dark now, so the pass above audits the
// only palette that exists and keeps the fuller `samples` shape rather than the thinner dark one.

for (const route of ["/", "/venice/", "/carmel/", "/santarosa/", "/brawley/"]) {
  report.heroes[route] = [];
  for (const width of [390, 768, 1280, 1440, 320]) {
    await page.setViewportSize({ width, height: width === 320 ? 720 : 900 });
    await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    const result = await page.locator(".hero").evaluate((hero, isHome) => {
      const heroRect = hero.getBoundingClientRect();
      // V15-H: the model heroes lost their powertrain eyebrow, so only the homepage still carries
      // one, and a model hero that grew one back is its own failure below.
      const selectors = isHome ? [".eyebrow", "h1", ".hero__descriptor", ".hero__actions"] : ["h1", ".hero__descriptor", ".hero__actions"];
      const contentVisible = selectors.every((selector) => {
        const node = hero.querySelector(selector);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.top >= heroRect.top - 1 && rect.bottom <= heroRect.bottom + 1 && rect.left >= -1 && rect.right <= innerWidth + 1;
      });
      return { width: innerWidth, contentVisible, modelEyebrow: !isHome && Boolean(hero.querySelector(".eyebrow")), noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1, heroHeight: Math.round(heroRect.height) };
    }, route === "/");
    report.heroes[route].push(result);
    if (!result.contentVisible || !result.noHorizontalScroll) failures.push(`Hero reflow failed for ${route} at ${width}px`);
    if (result.modelEyebrow) failures.push(`${route} hero carries an eyebrow the V15-H cleanup removed, at ${width}px`);
  }
}

for (const width of [768, 1024, 1280, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${base}/santarosa/`, { waitUntil: "networkidle" });
  const aligned = await page.locator(".hero__content").evaluate((content) => getComputedStyle(content).alignItems === "flex-end");
  if (!aligned) failures.push(`Santarosa content-end alignment failed at ${width}px`);
}

for (const route of ["/", "/vehicles/", "/concepts/", "/santarosa/", "/owners/"]) {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  report.zoom200[route] = await page.evaluate(() => ({
    proxyViewport: "640 CSS px for a 1280 px viewport at 200% zoom",
    noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
    h1Visible: Boolean(document.querySelector("h1")?.getClientRects().length),
    navigationAvailable: Boolean(document.querySelector("[data-open-menu]")?.getClientRects().length),
  }));
  if (!Object.values(report.zoom200[route]).slice(1).every(Boolean)) failures.push(`200% zoom proxy failed for ${route}`);
}

// The card wall is gone: /vehicles/ is now four vehicle sections, each with a lead photograph,
// two supporting frames, and exactly one link into its model page.
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${base}/vehicles/`, { waitUntil: "networkidle" });
report.interactions.vehicleSections = {
  sections: await page.locator(".vehicle-section").count(),
  leadFrames: await page.locator(".vehicle-section__lead img").count(),
  supportFrames: await page.locator(".vehicle-section__support img").count(),
  modelLinks: await page.locator(".vehicle-section__body a").evaluateAll((anchors) => anchors
    .filter((anchor) => !anchor.getAttribute("href").startsWith("#"))
    .map((anchor) => new URL(anchor.href).pathname)),
  hasSpecsOrPrices: await page.locator(".spec-table, .price, .photo-module__specs").count(),
  // The photographs became links in V6. They must stay out of the tab order, so each section
  // still offers exactly one stop, the text link beneath the copy.
  focusableMedia: await page.locator('.vehicle-section__lead:not([tabindex="-1"]), .vehicle-section__support:not([tabindex="-1"])').count(),
};
const sectionShape = report.interactions.vehicleSections;
if (sectionShape.sections !== 2 || sectionShape.leadFrames !== 2 || sectionShape.supportFrames !== 4 || sectionShape.hasSpecsOrPrices !== 0) failures.push(`Vehicles section structure failed: ${JSON.stringify(sectionShape)}`);
if (JSON.stringify(sectionShape.modelLinks) !== JSON.stringify(["/brawley/", "/santarosa/"])) failures.push(`Vehicles sections must link to each current model once in order, got ${sectionShape.modelLinks.join(", ")}`);
if (sectionShape.focusableMedia !== 0) failures.push(`${sectionShape.focusableMedia} vehicle media links are still in the tab order`);

// Model pages: each photo module carries a photograph, a label, and the figures that photograph
// shows. Prose captions are gone, so a module holds either specification rows or its label alone,
// never a sentence. V12-A retired the sticky bar from all four and moved the way back into the hero,
// which is measured here as boxes rather than read from the markup: the link must be inside the
// photograph's content column and above the heading, which is the whole point of the move.
report.interactions.photoScroll = {};
// V13-C: only the two current models have a photo scroll at all. Carmel and Venice are galleries and have
// their own suite below.
for (const [route, expected, pairedGroups, tags, heroCta] of [
  ["/brawley/", 6, 6, 0, "/brawley/gts/"],
  ["/santarosa/", 5, 5, 0, "/contact/?category=product-information"],
]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const shape = await page.evaluate(() => {
    const modules = [...document.querySelectorAll(".photo-module")];
    const rows = [...document.querySelectorAll(".photo-module__specs .spec-row")];
    return {
      modules: modules.length,
      withLabel: modules.filter((node) => node.querySelector(".photo-module__body .eyebrow")?.textContent.trim()).length,
      withSpecs: modules.filter((node) => node.querySelector(".photo-module__specs .spec-row")).length,
      // Any paragraph in the caption other than the label would be the prose that was removed.
      proseParagraphs: modules.filter((node) => node.querySelector(".photo-module__body p:not(.eyebrow)")).length,
      rows: rows.length,
      emptyRows: rows.filter((row) => !row.querySelector("span")?.textContent.trim() || !row.querySelector("strong")?.textContent.trim()).length,
      visibleRows: rows.filter((row) => row.checkVisibility()).length,
      // The toggle is gone sitewide, and so is the second value it used to switch between.
      retiredUnitMarkup: document.querySelectorAll(".unit-toggle, [data-unit], [data-spec-table], .spec-table").length,
      specNotes: document.querySelectorAll(".spec-note").length,
      tags: document.querySelectorAll(".model-tag").length,
      heroTag: document.querySelectorAll(".hero__content .model-tag").length,
      bars: document.querySelectorAll(".model-bar").length,
      // No paragraph may sit between the hero and the IN DETAIL heading. Measured in the DOM rather
      // than by string, so a lede reintroduced under any class name still fails.
      ledes: document.querySelectorAll(".page > .section--tight > .lede").length,
      heroBack: document.querySelector(".hero__content .back-nav a")?.getAttribute("href"),
      heroCta: document.querySelector(".hero__actions a")?.getAttribute("href"),
      // The way back must render above the heading and inside the photograph, which is the geometry
      // the move was for. Two boxes, compared, rather than a class name asserted.
      backAboveHeading: (() => {
        const back = document.querySelector(".hero__content .back-nav a")?.getBoundingClientRect();
        const heading = document.querySelector(".hero__content h1")?.getBoundingClientRect();
        if (!back || !heading) return null;
        return { above: back.bottom <= heading.top, sharedLeft: Math.abs(back.left - heading.left) < 2, painted: back.width > 0 && back.height > 0 };
      })(),
      relatedGrids: document.querySelectorAll(".card-grid--related, .card").length,
    };
  });
  report.interactions.photoScroll[route] = shape;
  if (shape.modules !== expected || shape.withLabel !== expected) failures.push(`Photo scroll failed on ${route}: ${JSON.stringify(shape)}`);
  if (shape.withSpecs !== pairedGroups) failures.push(`${route} must pair ${pairedGroups} specification groups with photographs, found ${shape.withSpecs}`);
  if (shape.proseParagraphs !== 0) failures.push(`${route} still carries ${shape.proseParagraphs} prose captions`);
  if (shape.emptyRows !== 0) failures.push(`${route} has ${shape.emptyRows} specification rows with an empty label or value`);
  if (shape.rows === 0 || shape.visibleRows !== shape.rows) failures.push(`${route} renders ${shape.visibleRows} of ${shape.rows} specification rows visibly`);
  if (shape.retiredUnitMarkup !== 0) failures.push(`${route} still carries retired unit or spec-table markup`);
  if (shape.specNotes !== 1) failures.push(`${route} must carry one disclosure note, found ${shape.specNotes}`);
  if (shape.tags !== tags || shape.heroTag !== tags) failures.push(`${route} must carry ${tags} Legacy model tag in its hero, found ${shape.tags}`);
  // V12-A. No bar, no overview paragraph, and the way back inside the photograph above the heading.
  if (shape.bars !== 0) failures.push(`${route} must carry no sticky model bar, found ${shape.bars}`);
  if (shape.ledes !== 0) failures.push(`${route} must run hero to IN DETAIL with no overview paragraph, found ${shape.ledes}`);
  if (shape.heroBack !== "/vehicles/") failures.push(`${route} hero must carry the way back to /vehicles/, got ${shape.heroBack}`);
  if (!shape.heroCta?.startsWith(heroCta)) failures.push(`${route} hero action must lead to ${heroCta}, got ${shape.heroCta}`);
  if (!shape.backAboveHeading?.above || !shape.backAboveHeading?.sharedLeft || !shape.backAboveHeading?.painted) {
    failures.push(`${route} way back must paint above the heading on its left edge: ${JSON.stringify(shape.backAboveHeading)}`);
  }
  if (shape.relatedGrids !== 0) failures.push(`${route} still pushes the visitor to other models`);
}

// The way back, exercised by navigation rather than by reading markup: one sample of each page
// type, clicked, landing on its declared parent.
report.interactions.backLinks = {};
// One sample of each page type, clicked. V13 adds the four new hierarchies: Experience under Home, Blog under
// Experience, an article under Blog, and the Launch Edition under Santarosa.
for (const [route, parent] of [["/vehicles/", "/"], ["/venice/", "/vehicles/"], ["/brawley/gts/", "/brawley/"], ["/concepts/indio/", "/concepts/"], ["/recommend-dealer/", "/dealers/"], ["/owners/", "/"], ["/experience/", "/"], ["/blog/", "/experience/"], [articleRoutes[0], "/blog/"], ["/santarosa/launch-edition/", "/santarosa/"], ["/careers/assembly-technician/", "/careers/"], ["/safety/", "/"]]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const link = page.locator(".back-nav a").first();
  const count = await page.locator(".back-nav").count();
  await link.click();
  await page.waitForLoadState("networkidle");
  const landed = new URL(page.url()).pathname;
  report.interactions.backLinks[route] = { count, landed };
  if (count !== 1) failures.push(`${route} must carry exactly one back link, found ${count}`);
  if (landed !== parent) failures.push(`${route} back link landed on ${landed}, expected ${parent}`);
}

// One title per concept page, the wordmark, named for the accessible heading.
await page.goto(`${base}/concepts/indio/`, { waitUntil: "networkidle" });
report.interactions.conceptTitle = await page.evaluate(() => {
  const h1 = document.querySelector("h1");
  const image = h1?.querySelector("img");
  return {
    headings: document.querySelectorAll("h1").length,
    isWordmark: Boolean(image?.currentSrc?.includes("wordmark")),
    accessibleName: image?.getAttribute("alt"),
    plates: document.querySelectorAll(".wordmark").length,
  };
});
const titleShape = report.interactions.conceptTitle;
if (titleShape.headings !== 1 || !titleShape.isWordmark || titleShape.accessibleName !== "Indio" || titleShape.plates !== 0) {
  failures.push(`Concept title failed: ${JSON.stringify(titleShape)}`);
}

// Owner resources: V16-I makes the library a plain list. Every manual is a card, every group is
// typographic, and no model photograph survives on the page.
await page.goto(`${base}/owners/`, { waitUntil: "networkidle" });
report.interactions.ownerResources = await page.evaluate(() => ({
  cards: document.querySelectorAll(".resource-card").length,
  groups: document.querySelectorAll(".resource-group").length,
  withMedia: document.querySelectorAll(".resource-group--media, .resource-group__media, .resource-group img").length,
  retiredRows: document.querySelectorAll(".resource-row").length,
}));
const ownerShape = report.interactions.ownerResources;
if (ownerShape.cards !== 19 || ownerShape.groups !== 5 || ownerShape.withMedia !== 0 || ownerShape.retiredRows !== 0) {
  failures.push(`Owner resources failed: ${JSON.stringify(ownerShape)}`);
}

// The purchase page keeps the one specification table on the site, and it keeps real values in it.
await page.goto(`${base}/brawley/gts/`, { waitUntil: "networkidle" });
report.interactions.gtsSpecTable = await page.evaluate(() => ({
  tables: document.querySelectorAll(".spec-table").length,
  toggles: document.querySelectorAll(".unit-toggle, [data-unit]").length,
  emptyValues: [...document.querySelectorAll(".spec-table .spec-row strong")].filter((node) => !node.textContent.trim()).length,
  figures: [...document.querySelectorAll(".gts-figure__value")].map((node) => node.textContent.trim()).filter(Boolean).length,
  // V12-A and V12-D, measured on the page rather than in the markup: no bar, the way back above the
  // title, the disclaimer printed once, and the walkaround standing on the paper with no plate.
  bars: document.querySelectorAll(".model-bar").length,
  notes: document.querySelectorAll(".gts-note").length,
  backAboveTitle: (() => {
    const back = document.querySelector(".gts-open .back-nav a")?.getBoundingClientRect();
    const title = document.querySelector(".gts-open__intro h1")?.getBoundingClientRect();
    return back && title ? back.bottom <= title.top : null;
  })(),
  stage: (() => {
    const stage = document.querySelector(".walkaround__stage");
    if (!stage) return null;
    const style = getComputedStyle(stage);
    return { background: style.backgroundColor, borderWidth: style.borderTopWidth };
  })(),
  // The disclaimer sentence must still be on the page, at the foot, exactly once.
  disclaimerCount: [...document.querySelectorAll("p")].filter((node) => node.textContent.includes("Features and specifications are estimated")).length,
}));
const gtsShape = report.interactions.gtsSpecTable;
if (gtsShape.tables !== 1 || gtsShape.toggles !== 0 || gtsShape.emptyValues !== 0 || gtsShape.figures !== 3) {
  failures.push(`Purchase page specification table failed: ${JSON.stringify(gtsShape)}`);
}
if (gtsShape.bars !== 0 || gtsShape.notes !== 0) failures.push(`The purchase page must carry no model bar and no duplicated note: ${JSON.stringify(gtsShape)}`);
if (gtsShape.backAboveTitle !== true) failures.push("The purchase page's way back must paint above its title");
if (gtsShape.disclaimerCount !== 1) failures.push(`The specification disclaimer must appear once on the purchase page, found ${gtsShape.disclaimerCount}`);
// The stage is the page's own white with no plate around it: the frames are delivered on the studio
// white they were shot on, so a border would draw a box around a photograph rather than contain one.
if (gtsShape.stage?.background !== "rgb(255, 255, 255)" || parseFloat(gtsShape.stage?.borderWidth) !== 0) {
  failures.push(`The walkaround stage must be unbordered white on the studio field: ${JSON.stringify(gtsShape.stage)}`);
}

await page.goto(`${base}/concepts/`, { waitUntil: "networkidle" });
report.interactions.conceptHubCards = await page.locator(".card .card__link").count();
if (report.interactions.conceptHubCards !== 9) failures.push("Concept hub must expose nine linked cards");

// V18: the hub reads as two families, On-Road first in Owen's order, and every card sits in the
// grid its heading claims. Membership itself is asserted longhand in check-content; what the
// browser adds is that both headings paint and each grid's card count is what a visitor sees.
report.interactions.conceptHubGroups = await page.evaluate(() => [...document.querySelectorAll(".page--concepts .section-heading h2")].map((heading) => ({
  text: heading.textContent,
  painted: heading.getClientRects().length > 0,
  cards: heading.closest("section")?.querySelectorAll(".card .card__link").length ?? 0,
})));
const hubGroups = report.interactions.conceptHubGroups;
if (JSON.stringify(hubGroups.map(({ text, cards }) => [text, cards])) !== JSON.stringify([["On-Road Concepts", 4], ["Off-Road Concepts", 5]])) {
  failures.push(`The concepts hub must present On-Road Concepts (4 cards) then Off-Road Concepts (5 cards): ${JSON.stringify(hubGroups)}`);
}
if (hubGroups.some((group) => !group.painted)) failures.push("A concepts hub group heading is not painted");

// The concept band under reduced motion, which is this context's default. The still state must be a
// correct static layout: eighteen tiles, no animation, and no pause button offering to stop something
// that is not moving.
report.interactions.marqueeReduced = await page.evaluate(() => {
  const band = document.querySelector("[data-marquee]");
  const track = band?.querySelector(".concept-marquee__track");
  const toggle = band?.querySelector("[data-marquee-toggle]");
  return {
    items: band?.querySelectorAll(".concept-marquee__item").length,
    animationName: track ? getComputedStyle(track).animationName : null,
    ready: band?.hasAttribute("data-ready"),
    toggleVisible: Boolean(toggle && !toggle.hidden),
    viewportHidden: band?.querySelector(".concept-marquee__viewport")?.getAttribute("aria-hidden"),
    // overflow: clip cannot become a scroll container, and a transform never contributes to
    // scrollWidth, so the band can never widen the document.
    overflow: track ? getComputedStyle(track.parentElement).overflow : null,
    noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
  };
});
const marqueeStill = report.interactions.marqueeReduced;
if (marqueeStill.items !== 18) failures.push(`The concept band must render 18 tiles, found ${marqueeStill.items}`);
if (marqueeStill.animationName !== "none") failures.push(`Reduced motion must stop the concept band, got ${marqueeStill.animationName}`);
if (marqueeStill.ready || marqueeStill.toggleVisible) failures.push("Reduced motion must leave the concept band unstarted and its pause button hidden");
if (marqueeStill.viewportHidden !== "true") failures.push("The concept band's viewport must stay hidden from assistive technology");
if (marqueeStill.overflow !== "clip" || !marqueeStill.noHorizontalScroll) failures.push(`The concept band must clip rather than scroll: ${JSON.stringify(marqueeStill)}`);

// One way back on all nine concept routes. V8 moved it from the foot of the page into the header,
// where it is visible on arrival, and gave every other page below the homepage the same affordance.
report.interactions.conceptBackLinks = {};
for (const route of conceptRoutes) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const links = await page.locator(".back-nav a").evaluateAll((anchors) => anchors.map((anchor) => new URL(anchor.href).pathname));
  const inHeader = await page.locator(".page-header .back-nav").count();
  report.interactions.conceptBackLinks[route] = { links, inHeader };
  if (links.length !== 1 || links[0] !== "/concepts/") failures.push(`Concept back link failed on ${route}: ${links.join(", ") || "none"}`);
  if (inHeader !== 1) failures.push(`${route} back link must sit in the page header`);
}

await page.goto(`${base}/owners/`, { waitUntil: "networkidle" });
report.interactions.ownerManuals = await page.locator(".resource-card").count();
if (report.interactions.ownerManuals !== 19) failures.push("Owner manual list does not contain 19 cards");
const manualHrefs = await page.locator(".resource-card").evaluateAll((rows) => rows.map((row) => row.getAttribute("href")));
report.interactions.manualResponses = [];
for (const href of manualHrefs) {
  const response = await page.request.get(`${base}${href}`);
  const contentType = response.headers()["content-type"] || "";
  report.interactions.manualResponses.push({ href, status: response.status(), contentType });
  if (!response.ok() || !contentType.includes("pdf")) failures.push(`Manual did not serve as PDF: ${href}`);
}

await page.setViewportSize({ width: 1440, height: 1000 });
for (const route of ["/", "/vehicles/", "/brawley/", "/santarosa/", "/venice/", "/carmel/", "/concepts/", "/concepts/indio/", "/owners/", "/dealers/"]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await loadLazyMedia(page);
  const audit = await page.locator("img").evaluateAll((images) => ({
    count: images.length,
    missingDimensions: images.filter((image) => !image.hasAttribute("width") || !image.hasAttribute("height")).map((image) => image.currentSrc),
    nonWebpPhotos: images.filter((image) => image.currentSrc && !image.currentSrc.includes("/assets/brand/") && !image.currentSrc.endsWith(".webp")).map((image) => image.currentSrc),
    // naturalWidth is density-corrected for srcset images, so read the real file width
    // from the chosen candidate's w descriptor instead.
    upscaled: images.map((image) => {
      const chosen = image.currentSrc.replace(location.origin, "");
      const descriptor = (image.getAttribute("srcset") || "").split(",")
        .map((candidate) => candidate.trim().split(/\s+/))
        .find(([url]) => url === chosen);
      const fileWidth = descriptor && descriptor[1]?.endsWith("w") ? parseInt(descriptor[1], 10) : image.naturalWidth;
      return { src: chosen, fileWidth, rendered: image.clientWidth };
    }).filter((entry) => entry.fileWidth && entry.rendered > entry.fileWidth * 1.05),
  }));
  report.media[route] = audit;
  if (audit.missingDimensions.length || audit.nonWebpPhotos.length || audit.upscaled.length) failures.push(`Media audit failed on ${route}`);
}

// The unit toggle is gone sitewide. It used to be exercised here; what is verified now is that
// nothing is left of it to exercise, and that the values it used to switch between are single.
await page.goto(`${base}/santarosa/`, { waitUntil: "networkidle" });
report.interactions.retiredUnitToggle = await page.evaluate(() => ({
  toggles: document.querySelectorAll(".unit-toggle, [data-spec-table], [data-unit], [data-unit-live]").length,
  metricClass: document.documentElement.classList.contains("unit-metric"),
  storedUnits: (() => { try { return localStorage.getItem("vhw.units"); } catch (error) { return null; } })(),
}));
const retired = report.interactions.retiredUnitToggle;
if (retired.toggles !== 0 || retired.metricClass || retired.storedUnits !== null) failures.push(`Retired unit toggle remains: ${JSON.stringify(retired)}`);

// Dark only, asserted positively rather than by the absence of a control. V9 removed light mode
// instead of defaulting away from it, so the claim being tested is that one palette is reachable:
// the dark values compute, the declared scheme is dark, the reverse lockup is what the header
// actually painted, and nothing survives that could put a second palette back.
await page.goto(`${base}/`, { waitUntil: "networkidle" });
report.interactions.darkOnly = await page.evaluate(() => {
  const rootStyle = getComputedStyle(document.documentElement);
  return {
    paper: rootStyle.getPropertyValue("--paper").trim(),
    ink: rootStyle.getPropertyValue("--ink").trim(),
    colorScheme: rootStyle.colorScheme,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    metaColorScheme: document.querySelector('meta[name="color-scheme"]')?.getAttribute("content"),
    toggles: document.querySelectorAll("[data-theme-toggle], .desktop-theme").length,
    themeAttribute: document.documentElement.dataset.theme ?? null,
    storedTheme: (() => { try { return localStorage.getItem("vhw.theme"); } catch (error) { return null; } })(),
    reverseLockup: document.querySelector(".brand img")?.currentSrc.endsWith("/assets/brand/vanderhall-lockup-horizontal-white.svg"),
    // The pre-paint script that read the stored preference is gone, so the only script the page
    // fetches is the island loader's one file.
    inlineScripts: [...document.querySelectorAll("script:not([src])")].filter((node) => node.textContent.includes("localStorage")).length,
  };
});
const dark = report.interactions.darkOnly;
if (dark.paper !== "#0E0E10" || dark.ink !== "#F4F4F5") failures.push(`Dark tokens did not compute: ${JSON.stringify(dark)}`);
if (dark.colorScheme !== "dark" || dark.metaColorScheme !== "dark") failures.push(`The declared color scheme is not dark alone: ${dark.colorScheme} / ${dark.metaColorScheme}`);
if (dark.bodyBackground !== "rgb(14, 14, 16)") failures.push(`The page is not painted on the dark paper: ${dark.bodyBackground}`);
if (dark.toggles !== 0 || dark.themeAttribute !== null || dark.storedTheme !== null) failures.push(`A theme switch survives: ${JSON.stringify(dark)}`);
if (!dark.reverseLockup) failures.push("The header must paint the reverse lockup without a CSS swap");
if (dark.inlineScripts !== 0) failures.push(`${dark.inlineScripts} inline scripts still read stored state before paint`);

// V13-G. The request form moved to /contact/ and became a three-step progressive form. Every claim below is
// about behaviour: the step advances, the branch matches the category, Back preserves what was typed, and the
// prototype says plainly that nothing was sent.
report.interactions.contactFlow = {};
await page.goto(`${base}/contact/`, { waitUntil: "networkidle" });
const contactForm = page.locator("#contact-form");
report.interactions.requestFormCount = await page.locator("[data-form-id='contact']").count();
report.interactions.dealersFormCount = 0;
if (report.interactions.requestFormCount !== 1) failures.push("/contact/ must hold exactly one contact form");
// Step one only, and the submit control is not offered before the last step: a visitor must not be able to
// send a request whose category has not been chosen and then be told so by an error summary.
report.interactions.contactFlow.initial = await page.evaluate(() => ({
  visibleSteps: [...document.querySelectorAll("[data-step]")].filter((step) => !step.hidden).map((step) => step.dataset.step),
  navVisible: [...document.querySelectorAll("[data-form-nav]")].some((nav) => !nav.hidden),
  // Computed display, not the hidden attribute. V16-B exists because the attribute was set and the
  // button rendered anyway: display:flex on the class beat the UA sheet's [hidden] rule, and this
  // assertion read the attribute and passed. Ask what the visitor sees, not what the DOM intends.
  submitVisible: getComputedStyle(document.querySelector(".form-submit-row")).display !== "none",
  status: document.querySelector("[data-step-status]").textContent,
}));
const contactInitial = report.interactions.contactFlow.initial;
if (JSON.stringify(contactInitial.visibleSteps) !== JSON.stringify(["1"])) failures.push(`/contact/ must open on step one, found ${contactInitial.visibleSteps.join(", ")}`);
if (!contactInitial.navVisible) failures.push("/contact/ step navigation must be revealed by the island");
if (contactInitial.submitVisible) failures.push("/contact/ must not offer the submit control before the last step");
if (contactInitial.status !== "Step 1 of 3") failures.push(`/contact/ must announce its step, found ${contactInitial.status}`);

// Continue with an empty step one must refuse and say which items, rather than advancing.
await contactForm.getByRole("button", { name: "Continue" }).first().click();
report.interactions.contactFlow.blocked = await page.evaluate(() => ({
  visibleSteps: [...document.querySelectorAll("[data-step]")].filter((step) => !step.hidden).map((step) => step.dataset.step),
  summaryVisible: !document.querySelector(".form-error-summary").hidden,
  summaryFocused: document.activeElement?.classList.contains("form-error-summary"),
}));
const contactBlocked = report.interactions.contactFlow.blocked;
if (JSON.stringify(contactBlocked.visibleSteps) !== JSON.stringify(["1"])) failures.push("/contact/ advanced past an incomplete step one");
if (!contactBlocked.summaryVisible || !contactBlocked.summaryFocused) failures.push(`/contact/ must focus an error summary on a blocked step: ${JSON.stringify(contactBlocked)}`);

await contactForm.getByLabel(/^First name/).fill("Test");
await contactForm.getByLabel(/^Last name/).fill("Visitor");
await contactForm.getByLabel(/^Email/).fill("test@example.com");
await contactForm.getByLabel(/^Phone/).fill("5550100");
await contactForm.getByRole("button", { name: "Continue" }).first().click();
await page.locator("#contact-form-category-customer-service").check();
await contactForm.getByRole("button", { name: "Continue" }).nth(0).click();
// Only the chosen branch is present, and the fields of the other two are disabled rather than merely hidden:
// a required control inside an invisible branch would fail validation with an error nobody could reach.
report.interactions.contactFlow.branch = await page.evaluate(() => ({
  visibleSteps: [...document.querySelectorAll("[data-step]")].filter((step) => !step.hidden).map((step) => step.dataset.step),
  visibleBranches: [...document.querySelectorAll("[data-branch]")].filter((branch) => !branch.hidden).map((branch) => branch.dataset.branch),
  disabledInHidden: [...document.querySelectorAll("[data-branch][hidden] input, [data-branch][hidden] select, [data-branch][hidden] textarea")].filter((control) => !control.disabled).length,
  // The ownership fields stay closed until the visitor says they own the vehicle.
  ownershipVisible: [...document.querySelectorAll("[data-branch]:not([hidden]) [data-ownership-field]")].filter((field) => !field.hidden).length,
}));
const contactBranch = report.interactions.contactFlow.branch;
if (JSON.stringify(contactBranch.visibleSteps) !== JSON.stringify(["3"])) failures.push(`/contact/ did not reach step three, found ${contactBranch.visibleSteps.join(", ")}`);
if (JSON.stringify(contactBranch.visibleBranches) !== JSON.stringify(["customer-service"])) failures.push(`/contact/ must show only the chosen branch, found ${contactBranch.visibleBranches.join(", ")}`);
if (contactBranch.disabledInHidden !== 0) failures.push(`${contactBranch.disabledInHidden} controls in hidden branches are still enabled`);
if (contactBranch.ownershipVisible !== 0) failures.push("Customer Service must not open its ownership fields before the visitor says they own the vehicle");

// Saying yes opens them; that is the conditional the plan asks for, in both directions.
await page.locator("#contact-form-customer-service-owns-yes").check();
report.interactions.contactFlow.ownership = await page.evaluate(() => [...document.querySelectorAll("[data-branch]:not([hidden]) [data-ownership-field]")].filter((field) => !field.hidden).length);
if (report.interactions.contactFlow.ownership < 3) failures.push(`Ownership fields must open once the visitor owns the vehicle, found ${report.interactions.contactFlow.ownership}`);

// Back preserves every value. This is the assertion that matters most about a multi-step form.
await contactForm.getByRole("button", { name: "Back" }).first().click();
await contactForm.getByRole("button", { name: "Back" }).first().click();
report.interactions.contactFlow.preserved = await page.evaluate(() => ({
  step: [...document.querySelectorAll("[data-step]")].filter((step) => !step.hidden).map((step) => step.dataset.step),
  firstName: document.querySelector("#contact-form-first").value,
  email: document.querySelector("#contact-form-email").value,
  category: document.querySelector("[name='category']:checked")?.value,
}));
const preserved = report.interactions.contactFlow.preserved;
if (JSON.stringify(preserved.step) !== JSON.stringify(["1"])) failures.push(`/contact/ Back did not return to step one, found ${preserved.step.join(", ")}`);
if (preserved.firstName !== "Test" || preserved.email !== "test@example.com" || preserved.category !== "customer-service") {
  failures.push(`/contact/ Back cleared entered values: ${JSON.stringify(preserved)}`);
}

// The prototype result, reached by submitting a complete form. Nothing is transmitted; the request listener
// below proves it rather than trusting the message.
const contactRequests = [];
page.on("request", (request) => { if (request.method() === "POST") contactRequests.push(request.url()); });
await contactForm.getByRole("button", { name: "Continue" }).first().click();
await contactForm.getByRole("button", { name: "Continue" }).nth(0).click();
await page.locator("#contact-form-customer-service-topic").selectOption("owner-documentation");
await contactForm.locator("[name='render_timestamp']").evaluate((input) => { input.value = String(Date.now() - 3000); });
await contactForm.getByRole("button", { name: "Send request" }).click();
const formStatus = await contactForm.locator(".form-status").innerText();
report.interactions.formValidation = formStatus === "Online submissions are not open yet. Email inquiry@vanderhall.com and the team will follow up.";
report.interactions.contactFlow.posted = contactRequests.length;
if (!report.interactions.formValidation) failures.push(`Contact form prototype result failed: ${formStatus}`);
if (contactRequests.length) failures.push(`The prototype contact form transmitted ${contactRequests.length} requests`);

// Query prefill for each valid category, and two invalid values that must select nothing and not throw.
report.interactions.modelPrefill = {};
for (const value of ["dealer-experience", "product-information", "customer-service"]) {
  await page.goto(`${base}/contact/?category=${value}`, { waitUntil: "networkidle" });
  const shape = await page.evaluate((wanted) => ({
    checked: document.querySelector("[name='category']:checked")?.value,
    branch: [...document.querySelectorAll("[data-branch]")].filter((branch) => !branch.hidden).map((branch) => branch.dataset.branch),
    step: [...document.querySelectorAll("[data-step]")].filter((step) => !step.hidden).map((step) => step.dataset.step),
    wanted,
  }), value);
  report.interactions.modelPrefill[value] = shape;
  if (shape.checked !== value || JSON.stringify(shape.branch) !== JSON.stringify([value])) failures.push(`Contact prefill failed for ${value}: ${JSON.stringify(shape)}`);
  if (JSON.stringify(shape.step) !== JSON.stringify(["3"])) failures.push(`A prefilled category should open the step that needs attention, found ${shape.step.join(", ")}`);
}
for (const value of ["nonsense", "DEALER"]) {
  await page.goto(`${base}/contact/?category=${value}`, { waitUntil: "networkidle" });
  const shape = await page.evaluate(() => ({
    checked: document.querySelector("[name='category']:checked")?.value ?? null,
    visibleBranches: [...document.querySelectorAll("[data-branch]")].filter((branch) => !branch.hidden).length,
    step: [...document.querySelectorAll("[data-step]")].filter((step) => !step.hidden).map((step) => step.dataset.step),
  }));
  report.interactions.modelPrefill[value] = shape;
  if (shape.checked !== null || shape.visibleBranches !== 0) failures.push(`An invalid category query must select nothing: ${value} gave ${JSON.stringify(shape)}`);
  if (JSON.stringify(shape.step) !== JSON.stringify(["1"])) failures.push(`An invalid category query must leave the form on step one, found ${shape.step.join(", ")}`);
}
// The model query lands on the branch's model select.
await page.goto(`${base}/contact/?category=product-information&model=santarosa`, { waitUntil: "networkidle" });
report.interactions.contactFlow.modelQuery = await page.locator("#contact-form-product-information-model").inputValue();
if (report.interactions.contactFlow.modelQuery !== "santarosa") failures.push(`The model query did not prefill the model select, found ${report.interactions.contactFlow.modelQuery}`);

// The studio walkaround. Every claim here is about behaviour a visitor can feel: the frame
// changes, the announcement follows it, choosing paint keeps the angle, and the partial colour
// says so instead of pretending to rotate.
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${base}/brawley/gts/`, { waitUntil: "networkidle" });
const viewer = page.locator("[data-walkaround]");
const activeFrame = () => page.locator(".walkaround__frame.is-active").first().getAttribute("src");
const liveText = () => page.locator("[data-walkaround-live]").innerText();

report.interactions.walkaround = {
  frames: await page.locator(".walkaround__frame").count(),
  swatches: await page.locator(".swatch").count(),
  // Enabled by the island: they ship hidden and disabled so the page works without JavaScript.
  controlsVisible: await page.locator("[data-walkaround-controls]").isVisible(),
  enabledSwatches: await page.locator(".swatch:not([disabled])").count(),
  eagerFrames: await page.locator('.walkaround__frame[loading="eager"]').count(),
  lazyFrames: await page.locator('.walkaround__frame[loading="lazy"]').count(),
  highPriority: await page.locator('.walkaround__frame[fetchpriority="high"]').count(),
  roleDescription: await page.locator("[data-walkaround-stage]").getAttribute("aria-roledescription"),
  startFrame: await activeFrame(),
};
const walk = report.interactions.walkaround;
if (walk.frames !== 8 || walk.swatches !== 9) failures.push(`Walkaround shape failed: ${JSON.stringify(walk)}`);
if (!walk.controlsVisible || walk.enabledSwatches !== 9) failures.push("Walkaround controls or swatches were not enabled by the island");
if (walk.eagerFrames !== 1 || walk.lazyFrames !== 7 || walk.highPriority !== 1) failures.push(`Walkaround loading strategy failed: ${JSON.stringify(walk)}`);
if (walk.roleDescription !== "360 viewer") failures.push("Walkaround stage is missing its 360 role description");

await page.locator("[data-walkaround-next]").click();
walk.afterNext = await activeFrame();
walk.afterNextLive = await liveText();
if (walk.afterNext === walk.startFrame || !walk.afterNextLive.includes("angle 2 of 8")) failures.push(`Walkaround next did not advance: ${walk.afterNextLive}`);

await page.locator("[data-walkaround-stage]").focus();
await page.keyboard.press("ArrowRight");
walk.afterArrow = await liveText();
if (!walk.afterArrow.includes("angle 3 of 8")) failures.push(`Walkaround keyboard step failed: ${walk.afterArrow}`);

// A colour change keeps the angle, so choosing paint does not throw away the chosen view.
await page.locator('.swatch[data-paint="rossa"]').click();
walk.afterPaint = await activeFrame();
walk.afterPaintLive = await liveText();
if (!walk.afterPaint.includes("/rossa/") || !walk.afterPaint.includes("side-960") && !walk.afterPaint.includes("side-1600")) failures.push(`Paint change lost the angle: ${walk.afterPaint}`);
if (!walk.afterPaintLive.startsWith("Rossa, angle 3 of 8")) failures.push(`Paint change announcement failed: ${walk.afterPaintLive}`);

// Jean Grey has four of the eight studio angles, so it is a still and reports itself as one.
await page.locator('.swatch[data-paint="jean-grey"]').click();
walk.stillLive = await liveText();
await page.locator("[data-walkaround-next]").click();
walk.stillAfterNext = await liveText();
if (walk.stillLive !== "Jean Grey, still image." || walk.stillAfterNext !== walk.stillLive) failures.push(`Partial colour must not rotate: ${walk.stillLive} then ${walk.stillAfterNext}`);

// Leaving the still restores the angle the visitor had been looking at.
await page.locator('.swatch[data-paint="ivory-white"]').click();
walk.restoredLive = await liveText();
if (!walk.restoredLive.startsWith("Ivory White, angle 3 of 8")) failures.push(`Angle was not restored after the still: ${walk.restoredLive}`);
walk.selectedCount = await page.locator(".swatch.is-selected").count();
walk.checkedCount = await page.locator('.swatch[aria-checked="true"]').count();
if (walk.selectedCount !== 1 || walk.checkedCount !== 1) failures.push("Exactly one paint option must be selected at a time");

// Structured data, checked by parsing it rather than by matching strings, and checked against the
// price the visitor actually reads on the page.
await page.goto(`${base}/brawley/gts/`, { waitUntil: "networkidle" });
report.interactions.schema = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll('script[type="application/ld+json"]')];
  let parsed = null;
  try { parsed = JSON.parse(blocks[0].textContent); } catch (error) { return { error: String(error) }; }
  return {
    blocks: blocks.length,
    type: parsed["@type"],
    price: parsed.offers?.price,
    currency: parsed.offers?.priceCurrency,
    offerUrl: parsed.offers?.url,
    visiblePrice: document.querySelector(".price__value")?.textContent.replace(/[^\d]/g, ""),
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
  };
});
const schema = report.interactions.schema;
if (schema.error) failures.push(`Purchase page JSON-LD does not parse: ${schema.error}`);
else if (schema.blocks !== 1 || schema.type !== "Product" || schema.currency !== "USD") failures.push(`Purchase page JSON-LD is malformed: ${JSON.stringify(schema)}`);
else if (schema.price !== schema.visiblePrice) failures.push(`JSON-LD price ${schema.price} disagrees with the visible price ${schema.visiblePrice}`);
// V17: the offer URL is the order page the visible buttons lead to, absolute as an offer URL has to be.
else if (schema.offerUrl !== "https://vanderhall-website.vercel.app/brawley/order/") failures.push(`JSON-LD offer must point at the order page, found ${schema.offerUrl}`);
if (schema.canonical !== `${base}/brawley/gts/`.replace("127.0.0.1:4173", "vanderhall-website.vercel.app").replace("http://", "https://")) {
  report.interactions.schema.canonicalNote = "canonical is absolute to production, which is correct when verifying locally";
}

// Screenshots are the human review surface, so clear anything a prior run persisted first. There is
// no theme dataset to unset any more; only the storage clear is still meaningful.
await page.goto(`${base}/`, { waitUntil: "load" });
await page.evaluate(() => { localStorage.clear(); });

for (const [route, name] of [["/", "home"], ["/vehicles/", "vehicles"], ["/venice/", "venice"], ["/carmel/", "carmel"], ["/santarosa/", "santarosa"], ["/brawley/", "brawley"], ["/brawley/gts/", "brawley-gts"], ["/concepts/", "concepts"], ["/concepts/indio/", "indio"], ["/concepts/brawley-r/", "brawley-r"], ["/concepts/balboa/", "balboa"], ["/concepts/yuma/", "yuma"], ["/owners/", "owners"], ["/dealers/", "dealers"], ["/recommend-dealer/", "recommend-dealer"], ["/privacy/", "privacy"]]) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await loadLazyMedia(page);
  await page.screenshot({ path: resolve(outputDir, `${name}-desktop.png`), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await loadLazyMedia(page);
  await page.screenshot({ path: resolve(outputDir, `${name}-mobile.png`), fullPage: true });
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/brawley/`, { waitUntil: "networkidle" });
await page.locator("[data-open-menu]").click();
report.interactions.mobileMenuOpen = await page.locator("[data-menu-sheet]").getAttribute("aria-hidden") === "false";
report.interactions.mobileMenuLinks = await page.locator("[data-menu-sheet] .mobile-nav a").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")));
await page.keyboard.press("Escape");
report.interactions.mobileMenuEscape = await page.locator("[data-menu-sheet]").getAttribute("aria-hidden") === "true";
if (!report.interactions.mobileMenuOpen || !report.interactions.mobileMenuEscape) failures.push("Mobile menu keyboard flow failed");
// V13 closes a carried open item here: the sheet used to list Dealers and Contact both pointing at /dealers/.
if (JSON.stringify(report.interactions.mobileMenuLinks) !== JSON.stringify(["/vehicles/", "/concepts/", "/experience/", "/dealers/", "/contact/"])) failures.push(`Mobile menu does not mirror the desktop navigation: ${report.interactions.mobileMenuLinks.join(", ")}`);

await page.setViewportSize({ width: 1440, height: 1000 });
// The homepage carries both surfaces the motion touches: a hero photograph and the reveals.
await page.goto(`${base}/`, { waitUntil: "networkidle" });
report.reducedMotion = await page.evaluate(() => ({
  duration1: getComputedStyle(document.documentElement).getPropertyValue("--dur-1").trim(),
  scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  // The hero drift is the only scroll-driven animation left on this page, so it is the one that must
  // read "none" here. The reveals are transitions on [data-reveal] and are made inert a different way,
  // below: site.js never marks anything under reduced motion, so there is no start state at all.
  heroTimeline: getComputedStyle(document.querySelector(".hero__image")).animationName,
  revealAnimation: getComputedStyle(document.querySelector(".vehicle-section__media")).animationName,
  marked: document.querySelectorAll("[data-reveal]").length,
  // The strongest form of the claim: nothing the reveal covers is faded. It does not depend on knowing
  // which selectors are in the list, and it reports what it found rather than a count, because a count
  // tells the next reader nothing about which element to go and look at.
  //
  // Scoped to the reveal's own start state rather than to every descendant of .page. Two elements on
  // this page are deliberately at opacity 0 and have nothing to do with scrolling: the hero video,
  // which fades in only once it has painted a frame and under reduced motion never paints at all, and
  // the walkaround frames that are not the active one. Sweeping every node would report those as
  // failures forever, which is a check that has to be ignored to be used.
  faded: [...document.querySelectorAll("[data-reveal], .vehicle-section__media, .vehicle-section__body, .section-heading, .split__media, .split__body")]
    .filter((node) => Number(getComputedStyle(node).opacity) < 0.99)
    .map((node) => `${node.className}@${Number(getComputedStyle(node).opacity).toFixed(2)}`),
}));
if (report.reducedMotion.duration1 !== "1ms" || report.reducedMotion.scrollBehavior !== "auto") failures.push("Reduced motion override failed");
if (report.reducedMotion.heroTimeline !== "none" || report.reducedMotion.revealAnimation !== "none") failures.push(`Reduced motion must remove the scroll-driven animations, got ${report.reducedMotion.heroTimeline} and ${report.reducedMotion.revealAnimation}`);
if (report.reducedMotion.marked !== 0) failures.push(`Reduced motion left ${report.reducedMotion.marked} elements marked for reveal, which is a start state nothing will clear`);
if (report.reducedMotion.faded.length) failures.push(`Reduced motion left ${report.reducedMotion.faded.length} revealable blocks below full opacity: ${report.reducedMotion.faded.join(", ")}`);

// V12-C retired the word cascade, so this is no longer a reduced-motion assertion but a retirement
// one: the split must not happen in ANY context. It went because it had the same defect as the other
// scrubbed reveals and in its worst form, a whole animation spent across one line-height of scroll,
// and because a heading rebuilt out of spans is a real cost to carry for motion nobody could see.
// Headings are read back whole here, which is the thing that would actually break if a split returned
// and went wrong.
for (const route of ["/", "/brawley/", "/concepts/indio/"]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const shape = await page.evaluate(() => ({
    words: document.querySelectorAll(".word").length,
    split: document.querySelectorAll(".is-split, [data-split]").length,
    headings: [...document.querySelectorAll(".section-heading h2")].map((node) => node.textContent),
  }));
  report.reducedMotion[`cascade${route}`] = shape;
  if (shape.words !== 0 || shape.split !== 0) failures.push(`${route}: the word cascade is retired, found ${shape.words} word spans and ${shape.split} split elements`);
  if (shape.headings.some((text) => !text.trim())) failures.push(`${route}: a section heading is empty`);
}
await page.goto(`${base}/`, { waitUntil: "networkidle" });

// The V6 additions have to answer reduced motion too: the frame cross-fade and the hover zoom.
await page.goto(`${base}/brawley/gts/`, { waitUntil: "networkidle" });
report.reducedMotion.gts = await page.evaluate(() => ({
  frameTransition: getComputedStyle(document.querySelectorAll(".walkaround__frame")[1]).transitionDuration,
  figuresAnimation: getComputedStyle(document.querySelector(".gts-figures")).animationName,
}));
if (report.reducedMotion.gts.frameTransition !== "0.001s" || report.reducedMotion.gts.figuresAnimation !== "none") failures.push(`Reduced motion did not clear the purchase page motion: ${JSON.stringify(report.reducedMotion.gts)}`);
await page.goto(`${base}/`, { waitUntil: "networkidle" });

// The motion itself, in a context that asks for it. V12-C made this the primary path rather than a
// fallback, so what is measured changed with it: not "is a view() timeline attached", but "is the
// element actually hidden before it arrives, does it carry a real duration, and does it resolve".
//
// The duration is the assertion that matters most, and it is the one V11 could not have made. A
// scrubbed reveal has no duration: it advances only with the scroll, which is why a flick spent the
// whole effect in two frames off the bottom of the screen and Owen twice reported seeing no motion.
// A transition with 680ms on the clock cannot be outrun by a fast scroll.
const motionContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference" });
const motionPage = await motionContext.newPage();
await motionPage.goto(`${base}/`, { waitUntil: "networkidle" });
report.motion = await motionPage.evaluate(async () => {
  const marked = [...document.querySelectorAll("[data-reveal]")];
  const belowFold = marked.filter((node) => node.getBoundingClientRect().top >= innerHeight).length;
  const target = marked.find((node) => Number(getComputedStyle(node).opacity) < 0.99);
  const before = target ? { opacity: Number(getComputedStyle(target).opacity), transition: getComputedStyle(target).transitionProperty, duration: getComputedStyle(target).transitionDuration, transform: getComputedStyle(target).transform } : null;
  const heroStyle = getComputedStyle(document.querySelector(".hero__image"));
  let after = null;
  if (target) {
    target.scrollIntoView({ block: "center", behavior: "instant" });
    // The transition needs its own time, unlike a scrubbed animation which resolved with the scroll.
    // That difference is the entire point of the change, so the wait is part of the assertion.
    await new Promise((done) => setTimeout(done, 1400));
    after = { opacity: Number(getComputedStyle(target).opacity), state: target.dataset.reveal, transform: getComputedStyle(target).transform };
  }
  return {
    markedCount: marked.length,
    markedAboveFold: marked.length - belowFold,
    before,
    after,
    hero: { animationName: heroStyle.animationName, timeline: heroStyle.animationTimeline },
    scriptTags: document.querySelectorAll("script[src]").length,
  };
});
if (report.motion.markedCount === 0) failures.push("The homepage marked nothing for reveal, so it has no scroll motion");
if (report.motion.markedAboveFold !== 0) failures.push(`${report.motion.markedAboveFold} elements above the fold were marked for reveal, which re-hides text the visitor is already reading`);
if (!report.motion.before) failures.push("Nothing on the homepage was actually hidden before it entered, so the reveal has no start state");
else {
  if (!report.motion.before.transition.includes("opacity")) failures.push(`The reveal must transition opacity, got ${report.motion.before.transition}`);
  // A duration a person can see. 680ms is --dur-4; this is the check that would catch the reveal
  // regressing to an instant state change or back to a scroll-scrubbed animation with no clock.
  if (parseFloat(report.motion.before.duration) < 0.3) failures.push(`The reveal's duration is ${report.motion.before.duration}, which is too short to be seen at any scroll speed`);
  // And it must actually be displaced, not merely faded: the rise is what makes it read as arriving.
  if (report.motion.before.transform === "none") failures.push("The reveal must carry a rise, not only a fade");
}
if (report.motion.after && (report.motion.after.opacity < 0.99 || report.motion.after.state !== "shown")) {
  failures.push(`A scrolled-into-view element did not resolve: ${JSON.stringify(report.motion.after)}`);
}
// A finished transform computes to an identity matrix rather than to the string "none", so the
// translation is read out of the matrix rather than compared against a keyword. V11's mutation testing
// found this exact defect in the check that came before this one.
if (report.motion.after) {
  const matrix = report.motion.after.transform.match(/matrix\(([^)]+)\)/);
  const translated = matrix ? Math.abs(parseFloat(matrix[1].split(",")[5])) : 0;
  if (translated > 0.5) failures.push(`A revealed element is still displaced by ${translated}px`);
}
if (report.motion.hero.animationName !== "hero-drift") failures.push("Hero drift is not attached");

// The concept band in a context that asks for motion: running, pausable by hover, and pausable by its
// button. The button is blurred before the resume is read, because :focus-within also pauses the band
// by design, and a focused button would otherwise make the resume look broken.
await motionPage.goto(`${base}/concepts/`, { waitUntil: "networkidle" });
await motionPage.waitForTimeout(400);
const trackState = () => motionPage.locator(".concept-marquee__track").evaluate((track) => {
  const style = getComputedStyle(track);
  return { animationName: style.animationName, playState: style.animationPlayState, duration: style.animationDuration, iterations: style.animationIterationCount };
});
report.motion.marquee = { running: await trackState() };
report.motion.marquee.ready = await motionPage.locator("[data-marquee]").evaluate((band) => band.hasAttribute("data-ready"));
// V11 amendment. Owen asked for the PAUSE labels off the page, so the control is no longer painted
// until it is focused. What must still hold is that it exists, that the island un-hid it, and that a
// keyboard can reach it: the band drifts continuously and the requirement to be able to stop it does
// not go away because the label did. Both halves are asserted, because "not visible" and "not there"
// are the two different things this change sits between.
report.motion.marquee.toggle = await motionPage.locator("[data-marquee-toggle]").evaluate((node) => ({
  inDocument: true,
  hiddenAttribute: node.hidden,
  paintedArea: Math.round(node.getBoundingClientRect().width * node.getBoundingClientRect().height),
  focusable: node.tabIndex >= 0,
  accessibleName: node.textContent.trim(),
}));
const running = report.motion.marquee.running;
if (running.animationName !== "concept-drift" || running.playState !== "running") failures.push(`The concept band is not drifting: ${JSON.stringify(running)}`);
if (running.duration !== "55s" || running.iterations !== "infinite") failures.push(`The concept band's drift is not the continuous one: ${JSON.stringify(running)}`);
if (!report.motion.marquee.ready || report.motion.marquee.toggle.hiddenAttribute) failures.push("The island must set data-ready and un-hide the pause control together");
if (report.motion.marquee.toggle.paintedArea > 4) failures.push(`The concept band's pause control must not be painted until focused, found ${report.motion.marquee.toggle.paintedArea}px2`);
if (!report.motion.marquee.toggle.focusable || report.motion.marquee.toggle.accessibleName !== "Pause") failures.push(`The concept band's pause control must stay reachable and named: ${JSON.stringify(report.motion.marquee.toggle)}`);
// Focused, it paints. This is the mechanism that keeps the control available rather than deleted.
await motionPage.locator("[data-marquee-toggle]").focus();
report.motion.marquee.toggleOnFocus = await motionPage.locator("[data-marquee-toggle]").evaluate((node) => Math.round(node.getBoundingClientRect().width * node.getBoundingClientRect().height));
if (report.motion.marquee.toggleOnFocus < 200) failures.push(`The concept band's pause control must become visible on focus, painted ${report.motion.marquee.toggleOnFocus}px2`);
await motionPage.locator("[data-marquee-toggle]").evaluate((node) => node.blur());
// V12-B inverts this. Owen on 2026-08-06: the band should "never stop even when you hover so it looks
// smooth and continuous". Both hover-pause rules are gone, so the assertion is that a pointer over the
// band CANNOT stall it. Two positions are tested because V11-F put the band behind the page header:
// the header's box covers the tiles across the content column, so a pointer over a tile actually hits
// the header, and both were hover targets until now.
// The header is hovered through its locator. The band cannot be, and the reason is the geometry
// itself: Playwright refuses to hover an element the header's box covers, which is precisely V11-F's
// note about why a second hover rule ever existed. So the band is hovered by moving the pointer to a
// measured point inside its own box, near its left edge, where the band is a full-bleed element and
// the header's content column is not. That point is over a tile and over nothing else.
const bandPoint = await motionPage.locator(".concept-marquee").evaluate((node) => {
  const rect = node.getBoundingClientRect();
  return { x: Math.round(rect.left + 24), y: Math.round(rect.top + rect.height / 2) };
});
for (const [label, action] of [
  ["header", () => motionPage.locator(".page--concepts > .page-header").first().hover()],
  ["band", () => motionPage.mouse.move(bandPoint.x, bandPoint.y)],
]) {
  await action();
  await motionPage.waitForTimeout(120);
  report.motion.marquee[`hovered_${label}`] = await trackState();
  if (report.motion.marquee[`hovered_${label}`].playState !== "running") {
    failures.push(`Hovering the ${label} must not stop the concept band: ${JSON.stringify(report.motion.marquee[`hovered_${label}`])}`);
  }
}
await motionPage.mouse.move(0, 0);
report.motion.marquee.unhovered = await trackState();
if (report.motion.marquee.unhovered.playState !== "running") failures.push("The concept band must keep drifting with the pointer away");
// The button, which does hold state.
await motionPage.locator("[data-marquee-toggle]").press("Enter");
report.motion.marquee.afterPress = { ...await trackState(), pressed: await motionPage.locator("[data-marquee-toggle]").getAttribute("aria-pressed") };
if (report.motion.marquee.afterPress.playState !== "paused" || report.motion.marquee.afterPress.pressed !== "true") failures.push(`The pause button did not pause the band: ${JSON.stringify(report.motion.marquee.afterPress)}`);
await motionPage.locator("[data-marquee-toggle]").press("Enter");
// The focus has to leave before the resume can be read: :focus-within pauses the band by design and
// clicking leaves the focus in the button, so reading play-state without blurring would report a pause
// the button did not cause. The pointer is moved away too, which is no longer strictly required now
// that hover does not pause, but it keeps this reading about the button and nothing else.
await motionPage.locator("[data-marquee-toggle]").evaluate((node) => node.blur());
await motionPage.mouse.move(0, 0);
report.motion.marquee.afterSecondPress = { ...await trackState(), pressed: await motionPage.locator("[data-marquee-toggle]").getAttribute("aria-pressed") };
if (report.motion.marquee.afterSecondPress.playState !== "running" || report.motion.marquee.afterSecondPress.pressed !== "false") failures.push(`The pause button did not resume the band: ${JSON.stringify(report.motion.marquee.afterSecondPress)}`);

// Reveal coverage, route by route, in a context that asks for motion. This replaces the word-cascade
// suite, and it is the assertion that answers Owen's actual complaint rather than a mechanism detail:
// he said he was not seeing scroll motion, and V11 had five routes with no reveal target of any kind
// (the privacy policy, the three form pages and 404) plus concept detail pages with one. Every route
// below must mark something, and the previously barren ones are in the list by name so that a coverage
// regression fails here rather than being noticed by eye months later.
//
// Which elements get marked depends on what sits below the fold at load, and that is deliberate: the
// first viewport stays still. So the assertion is "something below the fold was marked, nothing above
// it was", per route, rather than an exact count.
// Mirrors REVEAL_SELECTORS in src/scripts/site.js. Two copies of this list rather than V11's three:
// the CSS copy went with the scrubbed path in V12-C. It is duplicated here on purpose, because a check
// that imported the list from the file it is checking would agree with a mistake in it. Hoisted above
// the motion suite in V15, which now uses it to decide whether a route has anything below the fold to
// reveal at all.
const REVEAL_SELECTOR = [
  ".vehicle-section__media", ".vehicle-section__body", ".photo-module__media", ".photo-module__body",
  ".card-grid--concepts .card", ".concept-figure", ".split__media", ".split__body",
  ".section-heading", ".spec-table", ".gts-figures", ".gts-scene", ".disclosures", ".resource-group",
  ".photo-module__specs .spec-row", ".vehicle-section__row .vehicle-section__support",
  ".policy__section", ".lede", ".spec-note", ".form-heading",
  ".lead-form > .field", ".lead-form > .form-fieldset:not(.form-step)", ".lead-form > .form-submit-row",
  ".campaign-band__item", ".past-card", ".photo-gallery__figure", ".post-card", ".record-card", ".record-section",
  ".launch-highlights li", ".launch-fact", ".article-hero", ".prose", ".empty-state",
].join(", ");

report.motion.coverage = {};
for (const route of ["/", "/vehicles/", "/brawley/", "/brawley/gts/", "/brawley/order/", "/carmel/", "/venice/", "/santarosa/launch-edition/", "/concepts/", "/concepts/indio/", "/owners/", "/dealers/", "/contact/", "/experience/", "/blog/", articleRoutes[0], "/careers/", "/careers/assembly-technician/", "/safety/", noticeRoutes[0], "/privacy/", "/recommend-dealer/", "/dealer-inquiry/"]) {
  await motionPage.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await motionPage.waitForTimeout(400);
  const shape = await motionPage.evaluate(async (revealSelector) => {
    const marked = [...document.querySelectorAll("[data-reveal]")];
    // Counted before anything scrolls: a candidate that sits below the fold at load is what the
    // island should have marked, and a route with none has nothing it could honestly animate.
    const belowFoldCandidates = [...document.querySelectorAll(revealSelector)]
      .filter((node) => node.getBoundingClientRect().top >= innerHeight).length;
    const aboveFold = marked.filter((node) => node.getBoundingClientRect().top < innerHeight)
      .map((node) => `${node.className || node.tagName}: ${node.textContent.trim().slice(0, 30)}`);
    const hidden = marked.filter((node) => Number(getComputedStyle(node).opacity) < 0.99);
    const staggered = marked.filter((node) => node.style.getPropertyValue("--reveal-delay")).length;
    // Scroll the whole page and confirm every marked element resolves. This is the failure mode that
    // matters most: a marked element that never intersects is content permanently invisible.
    for (const node of marked) node.scrollIntoView({ block: "center", behavior: "instant" });
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((done) => setTimeout(done, 1500));
    const unresolved = marked.filter((node) => Number(getComputedStyle(node).opacity) < 0.99)
      .map((node) => `${node.className || node.tagName}`);
    return { markedCount: marked.length, belowFoldCandidates, aboveFold, hiddenBefore: hidden.length, staggered, unresolved };
  }, REVEAL_SELECTOR);
  report.motion.coverage[route] = shape;
  // V15: a route whose every reveal candidate already sits in the first viewport has nothing it
  // could honestly animate, and requiring motion there would mean padding the page to create it.
  // The shortened careers pages are the ones that legitimately fit; every route with a candidate
  // below the fold is still required to move. V17: /safety/ leaves that group. It publishes three
  // notice cards again, so it has candidates below the fold and is held to the rule like any other
  // record index.
  if (shape.belowFoldCandidates > 0 && shape.markedCount === 0) failures.push(`${route} marks nothing for reveal, so it has no scroll motion at all`);
  if (shape.markedCount > 0 && shape.hiddenBefore === 0) failures.push(`${route} marked ${shape.markedCount} elements but hid none of them, so nothing can be seen to arrive`);
  if (shape.aboveFold.length) failures.push(`${route}: ${shape.aboveFold.length} already-visible blocks were marked, which re-hides content the visitor is reading: ${shape.aboveFold.join(" / ")}`);
  if (shape.unresolved.length) failures.push(`${route}: ${shape.unresolved.length} revealed elements never resolved and are permanently invisible: ${shape.unresolved.join(", ")}`);
}
// The stagger is a feature and it must be reaching something, or groups snap in as blocks. Asserted
// across the set rather than per route, because which groups fall below the fold varies by page.
report.motion.totalStaggered = Object.values(report.motion.coverage).reduce((sum, shape) => sum + shape.staggered, 0);
if (report.motion.totalStaggered < 3) failures.push(`The reveal stagger reached only ${report.motion.totalStaggered} elements across the audited routes`);

await motionContext.close();

// V10. Everything below is new in this version: the renamed action, the footer's destinations, the
// single-title page headers, the policy page, and the three ambient videos.

// The ambient video, in a context that asks for motion. Requests are recorded from before the first
// navigation, because the claim being tested is about ordering and timing, not just about what
// eventually loaded: the poster must be asked for before any video source, and no video source may be
// requested before the load event, which is when site.js runs.
report.ambient = { routes: {} };
const videoContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference" });
// V11-A: one placement. The two below-fold blocks are asserted absent further down rather than
// dropped silently from this list, because "no longer in the list" and "proved not to load" are
// different claims and only the second one is worth anything.
const AMBIENT_PLACEMENTS = [["/", ".hero", ".hero__image"]];
for (const [route, blockSelector, posterSelector] of AMBIENT_PLACEMENTS) {
  const videoPage = await videoContext.newPage();
  // Posters and videos are both served out of /assets/video/, so they are recorded as one ordered
  // list and separated by extension. Keeping the order is the point: the poster must be asked for
  // first, and no video source may be asked for before the load event.
  const requests = [];
  videoPage.on("request", (request) => {
    const url = new URL(request.url()).pathname;
    if (url.startsWith("/assets/video/")) requests.push(url);
  });
  const videoSourcesOf = (list) => list.filter((url) => /\.(?:webm|mp4)$/.test(url));
  // Captured with a buffered observer so the entry is not missed by starting to listen too late.
  await videoPage.addInitScript(() => {
    window.__lcp = null;
    new PerformanceObserver((list) => {
      const entry = list.getEntries().at(-1);
      window.__lcp = { url: entry?.url || null, tag: entry?.element?.tagName || null, className: entry?.element?.className || null };
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await videoPage.goto(`${base}${route}`, { waitUntil: "load" });
  // The state at the load event, before site.js has had a chance to run. No video may exist yet.
  const atLoad = videoSourcesOf(requests).length;
  const block = videoPage.locator(blockSelector).first();

  if (route !== "/") await block.scrollIntoViewIfNeeded();
  // Waiting for the fade to finish, not merely for it to start. data-painted is set on the first
  // presented frame and the cross-fade runs for --dur-4 after that, so reading opacity the moment the
  // attribute appears catches the transition at zero and reports a working fade as a broken one.
  await videoPage.waitForFunction((selector) => {
    const node = document.querySelector(selector);
    return node?.hasAttribute("data-painted") && Number(getComputedStyle(node.querySelector("[data-ambient-video]")).opacity) > 0.99;
  }, blockSelector, { timeout: 15000 }).catch(() => {});
  const shape = await block.evaluate((node, selector) => {
    const video = node.querySelector("[data-ambient-video]");
    const toggle = node.querySelector("[data-ambient-toggle]");
    const poster = node.querySelector(selector);
    return {
      painted: node.hasAttribute("data-painted"),
      paused: video.paused,
      muted: video.muted,
      loop: video.loop,
      currentSrc: new URL(video.currentSrc || "http://x/none", "http://x").pathname,
      readyState: video.readyState,
      toggleVisible: Boolean(toggle && !toggle.hidden),
      toggleLabel: toggle?.textContent,
      posterStillThere: Boolean(poster.getClientRects().length),
      // Same box to the pixel. A poster and a video that disagree would shift the page the moment one
      // replaced the other, which is the failure the shared 1900 by 900 declaration exists to prevent.
      //
      // Layout boxes, not client rects: the hero poster carries V9's hero-drift, which scales it by
      // 1.08, so its client rect is deliberately larger than its layout box and comparing rects would
      // report a working hero as broken. offsetWidth ignores transforms, which is what makes it the
      // right measure of "the same box".
      boxesMatch: poster.offsetWidth === video.offsetWidth && poster.offsetHeight === video.offsetHeight,
      objectFit: getComputedStyle(video).objectFit,
      videoOpacity: Number(getComputedStyle(video).opacity),
    };
  }, posterSelector);
  const lcp = await videoPage.evaluate(() => window.__lcp);
  report.ambient.routes[route] = { ...report.ambient.routes[route], atLoad, requests: [...requests], shape, lcp };

  const videoSources = videoSourcesOf(requests);
  const firstPoster = requests.findIndex((url) => url.endsWith(".webp"));
  const firstVideo = requests.findIndex((url) => /\.(?:webm|mp4)$/.test(url));
  if (atLoad !== 0) failures.push(`${route}: ${atLoad} video sources were requested before the load event, competing with the poster`);
  if (!videoSources.length) failures.push(`${route}: no video source was ever requested in a context that asks for motion`);
  // The poster is the first paint and must therefore be the first request of the pair.
  if (firstPoster === -1 || (firstVideo !== -1 && firstVideo < firstPoster)) failures.push(`${route}: a video source was requested before the poster: ${requests.join(", ")}`);
  // WebM first. An H.264 request in Chrome would mean the source order had been lost.
  if (videoSources.length && !videoSources[0].endsWith(".webm")) failures.push(`${route}: the first video source requested was ${videoSources[0]}, not the WebM`);
  if (videoSources.some((url) => url.endsWith(".mp4"))) failures.push(`${route}: Chrome fell through to the H.264 file: ${videoSources.join(", ")}`);
  if (!shape.painted || shape.videoOpacity < 0.99) failures.push(`${route}: the video never faded in over its poster: ${JSON.stringify(shape)}`);
  if (shape.paused) failures.push(`${route}: the ambient video is not playing`);
  // V15-A: the film loops, per Owen on 2026-08-06, so the attribute is required rather than banned.
  if (!shape.muted || !shape.loop) failures.push(`${route}: the ambient video must be muted and must loop`);
  if (!shape.currentSrc.endsWith(".webm")) failures.push(`${route}: the playing source is ${shape.currentSrc}`);
  if (!shape.toggleVisible || shape.toggleLabel !== "Pause") failures.push(`${route}: the control must be revealed reading Pause once playback starts, got ${JSON.stringify(shape.toggleLabel)}`);
  if (!shape.posterStillThere) failures.push(`${route}: the poster was removed, so there is nothing under the video`);
  if (!shape.boxesMatch || shape.objectFit !== "cover") failures.push(`${route}: the video and its poster do not share one box: ${JSON.stringify(shape)}`);
  await videoPage.close();
}
// The homepage's LCP must stay the poster image. A decoded video frame becoming the LCP element would
// mean the largest paint had moved behind the load event and the video gate.
const homeLcp = report.ambient.routes["/"].lcp;
if (!homeLcp?.url?.includes("/assets/video/brawley/brawley-film-25-60-poster-")) failures.push(`The homepage LCP element must be the hero poster, got ${JSON.stringify(homeLcp)}`);

// V11-A. The two retired loops, proved gone rather than assumed gone: no video element, no request
// for a video byte, and no reference to the asset directory at all. This is the assertion that would
// catch a loop reappearing on either Brawley page, which the shortened placement list above cannot.
report.ambient.brawleyRoutesSilent = {};
for (const route of ["/brawley/", "/brawley/gts/"]) {
  const silentPage = await videoContext.newPage();
  const silentRequests = [];
  silentPage.on("request", (request) => { if (/\/assets\/video\//.test(request.url())) silentRequests.push(new URL(request.url()).pathname); });
  await silentPage.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await silentPage.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await silentPage.waitForTimeout(800);
  const shape = await silentPage.evaluate(() => ({
    videos: document.querySelectorAll("video").length,
    ambientBlocks: document.querySelectorAll("[data-ambient]").length,
    ambientMarkup: document.querySelectorAll(".ambient, .ambient__frame, .ambient__poster").length,
  }));
  report.ambient.brawleyRoutesSilent[route] = { requests: silentRequests, ...shape };
  if (silentRequests.length) failures.push(`${route}: V11-A ships no footage here, but ${silentRequests.length} video assets were requested`);
  if (shape.videos || shape.ambientBlocks || shape.ambientMarkup) failures.push(`${route}: ambient video markup survives: ${JSON.stringify(shape)}`);
  await silentPage.close();
}

// Q-V11-1. Below 768px the film is not loaded at all: the visitor gets the poster, which is the
// film's own first frame, and no control. The film is megabytes of WebM and the site's one video
// sits on the homepage, so this is the assertion that keeps that cost off a phone. readyState 0 is
// the proof that nothing loaded rather than that nothing played.
report.ambient.mobileGate = {};
for (const width of [390, 767, 768]) {
  const gateContext = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: "no-preference" });
  const gatePage = await gateContext.newPage();
  const gateRequests = [];
  gatePage.on("request", (request) => { if (/\/assets\/video\/.+\.(?:webm|mp4)$/.test(request.url())) gateRequests.push(new URL(request.url()).pathname); });
  await gatePage.goto(`${base}/`, { waitUntil: "networkidle" });
  await gatePage.waitForTimeout(1200);
  const shape = await gatePage.evaluate(() => ({
    readyState: document.querySelector("[data-ambient-video]").readyState,
    toggleHidden: document.querySelector("[data-ambient-toggle]").hidden,
    painted: document.querySelector(".hero").hasAttribute("data-painted"),
    posterVisible: Boolean(document.querySelector(".hero__image").naturalWidth) && Boolean(document.querySelector(".hero__image").getClientRects().length),
  }));
  report.ambient.mobileGate[width] = { requests: gateRequests, ...shape };
  const gated = width < 768;
  if (gated && gateRequests.length) failures.push(`${width}px: the homepage loop is gated below 768px but requested ${gateRequests.length} video sources`);
  if (gated && (shape.readyState !== 0 || shape.painted || !shape.toggleHidden)) failures.push(`${width}px: the gate must leave the video unloaded and its control hidden: ${JSON.stringify(shape)}`);
  if (!gated && !gateRequests.length) failures.push(`${width}px: at the gate's own breakpoint the loop must load, and nothing was requested`);
  // The poster is the layout at every width, gate or no gate.
  if (!shape.posterVisible) failures.push(`${width}px: the homepage poster must render whether or not the loop is eligible`);
  await gateContext.close();
}

// The control, exercised. Pressing it must stop the film and say so; pressing it again must start it.
const togglePage = await videoContext.newPage();
await togglePage.goto(`${base}/`, { waitUntil: "networkidle" });
await togglePage.waitForFunction(() => document.querySelector(".hero")?.hasAttribute("data-painted"), null, { timeout: 15000 });
const heroVideoState = () => togglePage.locator(".hero__video").evaluate((video) => ({ paused: video.paused, time: video.currentTime }));
// Driven by the keyboard, because that is the only way in since the V11 amendment took the visible
// PAUSE label off the page. The control paints on focus and works from there; the same three
// exercises below are otherwise unchanged.
report.ambient.heroToggle = await togglePage.locator("[data-ambient-toggle]").evaluate((node) => ({
  hiddenAttribute: node.hidden,
  paintedArea: Math.round(node.getBoundingClientRect().width * node.getBoundingClientRect().height),
  focusable: node.tabIndex >= 0,
}));
if (report.ambient.heroToggle.hiddenAttribute) failures.push("The hero control must be un-hidden by the island once playback is attempted");
if (report.ambient.heroToggle.paintedArea > 4) failures.push(`The hero control must not be painted until focused, found ${report.ambient.heroToggle.paintedArea}px2`);
if (!report.ambient.heroToggle.focusable) failures.push("The hero control must stay reachable by keyboard");
await togglePage.locator("[data-ambient-toggle]").focus();
report.ambient.heroToggleOnFocus = await togglePage.locator("[data-ambient-toggle]").evaluate((node) => Math.round(node.getBoundingClientRect().width * node.getBoundingClientRect().height));
if (report.ambient.heroToggleOnFocus < 200) failures.push(`The hero control must become visible on focus, painted ${report.ambient.heroToggleOnFocus}px2`);
await togglePage.locator("[data-ambient-toggle]").press("Enter");
report.ambient.afterPause = { ...await heroVideoState(), label: await togglePage.locator("[data-ambient-toggle]").textContent() };
if (!report.ambient.afterPause.paused || report.ambient.afterPause.label !== "Play") failures.push(`The hero control did not pause the loop: ${JSON.stringify(report.ambient.afterPause)}`);
await togglePage.locator("[data-ambient-toggle]").press("Enter");
report.ambient.afterResume = { ...await heroVideoState(), label: await togglePage.locator("[data-ambient-toggle]").textContent() };
if (report.ambient.afterResume.paused || report.ambient.afterResume.label !== "Pause") failures.push(`The hero control did not resume the loop: ${JSON.stringify(report.ambient.afterResume)}`);

// A choice to pause has to survive scrolling away and coming back, which is what separates the
// visitor's intent from the viewport's housekeeping.
await togglePage.locator("[data-ambient-toggle]").press("Enter");
await togglePage.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
await togglePage.waitForTimeout(300);
await togglePage.evaluate(() => scrollTo(0, 0));
await togglePage.waitForTimeout(600);
report.ambient.choiceSurvivesScroll = await heroVideoState();
if (!report.ambient.choiceSurvivesScroll.paused) failures.push("A manually paused loop restarted itself after the visitor scrolled away and back");
await togglePage.close();

// Offscreen and hidden. Neither is a state the visitor chose, so both stop the film and both release
// it again. Verified on the homepage now, which is where the site's one loop lives: the hero is at
// the top of a long page, so scrolling to the foot genuinely takes it out of view even allowing for
// the observer's 200px rootMargin.
const offscreenPage = await videoContext.newPage();
await offscreenPage.goto(`${base}/`, { waitUntil: "networkidle" });
await offscreenPage.waitForFunction(() => document.querySelector(".hero")?.hasAttribute("data-painted"), null, { timeout: 15000 });
const ambientPaused = () => offscreenPage.locator(".hero__video").evaluate((video) => video.paused);
report.ambient.offscreen = { playingInView: !await ambientPaused() };
await offscreenPage.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
await offscreenPage.waitForTimeout(600);
report.ambient.offscreen.pausedOffscreen = await ambientPaused();
await offscreenPage.evaluate(() => scrollTo(0, 0));
await offscreenPage.waitForTimeout(600);
report.ambient.offscreen.resumedOnReturn = !await ambientPaused();
if (!report.ambient.offscreen.playingInView || !report.ambient.offscreen.pausedOffscreen || !report.ambient.offscreen.resumedOnReturn) {
  failures.push(`Offscreen pause and resume failed: ${JSON.stringify(report.ambient.offscreen)}`);
}
// Tab hidden. Dispatched rather than really backgrounding the tab, because a headless page has no
// window manager to background it, and the handler under test is the visibilitychange listener.
await offscreenPage.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
});
await offscreenPage.waitForTimeout(200);
report.ambient.hiddenTab = { pausedWhenHidden: await ambientPaused() };
await offscreenPage.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  document.dispatchEvent(new Event("visibilitychange"));
});
await offscreenPage.waitForTimeout(400);
report.ambient.hiddenTab.resumedWhenVisible = !await ambientPaused();
if (!report.ambient.hiddenTab.pausedWhenHidden || !report.ambient.hiddenTab.resumedWhenVisible) {
  failures.push(`Hidden-tab pause and resume failed: ${JSON.stringify(report.ambient.hiddenTab)}`);
}

// V15-A: the loop. Owen on 2026-08-06: "make sure that it never stops." The contract under test is
// that playback crosses the file's end and keeps going: the element carries the loop attribute, and
// seeking to the last fraction of a second produces a video that is still playing a moment later,
// with its clock wrapped back near the start and `ended` never set. Seeked rather than waited out,
// because the contract is the wrap, not the 34 seconds before it.
report.ambient.loop = await offscreenPage.locator(".hero__video").evaluate(async (video) => {
  const hasLoopAttribute = video.hasAttribute("loop");
  video.currentTime = video.duration - 0.15;
  await new Promise((done) => setTimeout(done, 1200));
  return {
    hasLoopAttribute,
    stillPlaying: !video.paused,
    neverEnded: !video.ended,
    wrapped: video.currentTime < 5,
    stillPainted: document.querySelector(".hero").hasAttribute("data-painted"),
    label: document.querySelector("[data-ambient-toggle]").textContent,
  };
});
if (!report.ambient.loop.hasLoopAttribute) failures.push("The hero film must carry the loop attribute");
if (!report.ambient.loop.stillPlaying || !report.ambient.loop.neverEnded || !report.ambient.loop.wrapped) {
  failures.push(`The film did not loop across its end: ${JSON.stringify(report.ambient.loop)}`);
}
if (!report.ambient.loop.stillPainted) failures.push("The looping film dropped back to the poster at the wrap");
if (report.ambient.loop.label !== "Pause") failures.push(`The control over a looping film must read Pause, got ${JSON.stringify(report.ambient.loop.label)}`);
// And the loop survives the two housekeeping pauses: away and back must return a PLAYING film now,
// which is the half of the V13 settled-state contract that inverts.
await offscreenPage.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
await offscreenPage.waitForTimeout(400);
await offscreenPage.evaluate(() => scrollTo(0, 0));
await offscreenPage.waitForTimeout(600);
report.ambient.loop.playingAfterScrollReturn = await offscreenPage.locator(".hero__video").evaluate((video) => !video.paused);
if (!report.ambient.loop.playingAfterScrollReturn) failures.push("The looping film did not resume after the visitor scrolled away and back");
await offscreenPage.close();
await videoContext.close();

// Save-Data. A visitor who has asked their browser to spend less data gets the poster and no control,
// exactly as a reduced-motion visitor does. The header cannot be set from Playwright's context in a
// way the page can read, so the property the island actually consults is defined before any script
// runs, which is the same thing site.js sees.
const saveDataContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference" });
await saveDataContext.addInitScript(() => {
  Object.defineProperty(navigator, "connection", { configurable: true, get: () => ({ saveData: true, effectiveType: "3g" }) });
});
const saveDataPage = await saveDataContext.newPage();
const saveDataRequests = [];
saveDataPage.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/assets/video/")) saveDataRequests.push(new URL(request.url()).pathname); });
await saveDataPage.goto(`${base}/`, { waitUntil: "networkidle" });
await saveDataPage.waitForTimeout(800);
report.ambient.saveData = {
  videoRequests: saveDataRequests.filter((url) => /\.(?:webm|mp4)$/.test(url)),
  posterRequests: saveDataRequests.filter((url) => url.endsWith(".webp")).length,
  toggleVisible: await saveDataPage.locator("[data-ambient-toggle]").isVisible(),
  painted: await saveDataPage.locator(".hero").evaluate((hero) => hero.hasAttribute("data-painted")),
  posterVisible: await saveDataPage.locator(".hero__image").evaluate((image) => Boolean(image.naturalWidth) && Boolean(image.getClientRects().length)),
};
const saveData = report.ambient.saveData;
if (saveData.videoRequests.length) failures.push(`Save-Data requested ${saveData.videoRequests.length} video sources: ${saveData.videoRequests.join(", ")}`);
if (saveData.toggleVisible || saveData.painted) failures.push("Save-Data must show no video control and never fade a video in");
if (!saveData.posterVisible || saveData.posterRequests === 0) failures.push("Save-Data must still render the poster");
await saveDataContext.close();

// Reduced motion. Same contract as Save-Data: the poster, and no control.
//
// emulateMedia is applied to this page explicitly rather than inherited. The suite's default page
// carries the preference, but it was set with page.emulateMedia rather than on the context, so a page
// opened from that context does NOT inherit it. Relying on the inheritance is what made the first run
// of this check load and play all three videos while claiming to be testing reduced motion.
report.reducedMotion.ambient = {};
for (const [route, blockSelector, posterSelector] of AMBIENT_PLACEMENTS) {
  const reducedPage = await context.newPage();
  await reducedPage.emulateMedia({ reducedMotion: "reduce" });
  const reducedRequests = [];
  reducedPage.on("request", (request) => { if (/\/assets\/video\/.+\.(?:webm|mp4)$/.test(request.url())) reducedRequests.push(request.url()); });
  await reducedPage.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await reducedPage.locator(blockSelector).first().scrollIntoViewIfNeeded();
  await reducedPage.waitForTimeout(600);
  const shape = await reducedPage.locator(blockSelector).first().evaluate((node, selector) => {
    const poster = node.querySelector(selector);
    return {
      painted: node.hasAttribute("data-painted"),
      paused: node.querySelector("[data-ambient-video]").paused,
      readyState: node.querySelector("[data-ambient-video]").readyState,
      toggleHidden: node.querySelector("[data-ambient-toggle]").hidden,
      posterVisible: Boolean(poster.naturalWidth) && Boolean(poster.getClientRects().length),
    };
  }, posterSelector);
  report.reducedMotion.ambient[route] = { requests: reducedRequests, shape };
  if (reducedRequests.length) failures.push(`${route}: reduced motion requested ${reducedRequests.length} video sources`);
  // readyState 0 is the proof that nothing was loaded, not merely that nothing was played.
  if (shape.readyState !== 0 || shape.painted || !shape.paused) failures.push(`${route}: reduced motion must leave the video unloaded: ${JSON.stringify(shape)}`);
  if (!shape.toggleHidden) failures.push(`${route}: reduced motion must leave the video control hidden`);
  if (!shape.posterVisible) failures.push(`${route}: reduced motion must still render the poster`);
  await reducedPage.close();
}

// The renamed action, and the one form it leads to.
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${base}/`, { waitUntil: "networkidle" });
report.interactions.contactRename = await page.evaluate(() => ({
  headerLabel: document.querySelector(".header-request")?.textContent,
  retired: document.body.innerText.includes("Request info"),
  headerHref: document.querySelector(".header-request")?.getAttribute("href"),
}));
const rename = report.interactions.contactRename;
if (rename.headerLabel !== "Contact Us" || rename.retired || rename.headerHref !== "/contact/") failures.push(`Contact rename failed: ${JSON.stringify(rename)}`);
await page.goto(`${base}/contact/`, { waitUntil: "networkidle" });
report.interactions.contactHeading = await page.locator("h1").innerText();
if (report.interactions.contactHeading !== "Contact Vanderhall.") failures.push(`The contact title is ${report.interactions.contactHeading}`);
// And the form heading that used to sit on /dealers/ is gone with the form.
await page.goto(`${base}/dealers/`, { waitUntil: "networkidle" });
report.interactions.dealersFormHeadings = await page.locator(".form-heading").count();
if (report.interactions.dealersFormHeadings !== 0) failures.push("/dealers/ still carries a form heading");

// The footer's new destinations, read off the rendered page rather than the markup, and asserted on a
// sample of routes because the footer is generated once for all of them.
report.interactions.footer = {};
for (const route of ["/", "/brawley/gts/", "/privacy/", "/concepts/indio/"]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  report.interactions.footer[route] = await page.evaluate(() => {
    const hrefs = (selector) => [...document.querySelectorAll(selector)].map((anchor) => anchor.getAttribute("href"));
    const social = [...document.querySelectorAll(".footer-follow a")];
    return {
      social: hrefs(".footer-follow a"),
      socialNames: social.map((anchor) => ({ visible: anchor.textContent, accessible: anchor.getAttribute("aria-label") })),
      legal: hrefs(".footer-legal__links a"),
      app: hrefs(".footer-links a").filter((href) => href.includes("apps.apple.com") || href.includes("play.google.com")),
      tracked: hrefs("a").filter((href) => href && /[?&](?:_gl|_ga|_gcl_au|utm_[a-z]+|fref)=/.test(href)),
      // The links a visitor can actually reach with a keyboard, which is the only test that matters
      // for a row of small text links.
      focusable: social.filter((anchor) => anchor.tabIndex >= 0).length,
      // V15-G. Four columns exactly: Vehicles, Owners, Connect, Follow. Experience sits in the
      // Vehicles column under Concepts, and Blog has no footer entry at all.
      columns: [...document.querySelectorAll(".footer-links > div h2")].map((heading) => heading.textContent),
      ownerManuals: [...document.querySelectorAll(".footer-links a")].filter((anchor) => anchor.getAttribute("href") === "/owners/").map((anchor) => anchor.textContent),
      experience: hrefs(".footer-links a").filter((href) => href === "/experience/" || href === "/blog/"),
      vehiclesColumn: hrefs(".footer-links > div:first-child a"),
    };
  });
  const footer = report.interactions.footer[route];
  if (footer.social.length !== 6) failures.push(`${route}: expected six social links in the footer, found ${footer.social.length}`);
  if (JSON.stringify(footer.columns) !== JSON.stringify(["Vehicles", "Owners", "Connect", "Follow"])) failures.push(`${route}: footer columns are ${footer.columns.join(", ")}`);
  if (JSON.stringify(footer.ownerManuals) !== JSON.stringify(["Owner manuals"])) failures.push(`${route}: the Owners column must lead with Owner manuals, found ${footer.ownerManuals.join(", ")}`);
  if (JSON.stringify(footer.experience) !== JSON.stringify(["/experience/"])) failures.push(`${route}: Experience must appear once, in the Vehicles column, and Blog not at all; found ${footer.experience.join(", ")}`);
  if (JSON.stringify(footer.vehiclesColumn.slice(-2)) !== JSON.stringify(["/concepts/", "/experience/"])) failures.push(`${route}: the Vehicles column must end Concepts then Experience, found ${footer.vehiclesColumn.join(", ")}`);
  // V13: the three legal destinations are internal routes now, not two external hosts.
  if (JSON.stringify(footer.legal) !== JSON.stringify(["/safety/", "/careers/", "/privacy/"])) failures.push(`${route}: the footer legal row must be the three internal routes, got ${footer.legal.join(", ")}`);
  if (footer.app.length !== 2) failures.push(`${route}: expected two app store links, found ${footer.app.length}`);
  if (footer.tracked.length) failures.push(`${route}: a footer link carries tracking parameters: ${footer.tracked.join(", ")}`);
  if (footer.focusable !== 6) failures.push(`${route}: ${6 - footer.focusable} social links are not reachable by keyboard`);
  for (const name of footer.socialNames) {
    if (!name.accessible?.includes(name.visible)) failures.push(`${route}: the accessible name ${name.accessible} does not contain the visible label ${name.visible}`);
  }
}
// The legal links resolve. The two external ones are checked by request rather than by navigation, so
// a Vanderhall system that has moved a page fails here instead of on a visitor's screen.
// V13: the three footer legal destinations are internal, so they are checked against this build. The external
// safety portal is checked separately, because it is now a labelled fallback on /safety/ rather than a footer
// destination, and it must stay reachable while data parity is unverified.
report.interactions.legalTargets = [];
for (const href of [`${base}/safety/`, `${base}/careers/`, `${base}/privacy/`, "https://portal.vanderhallusa.com/safety_notices"]) {
  try {
    const response = await page.request.get(href, { maxRedirects: 5, timeout: 20000 });
    report.interactions.legalTargets.push({ href, status: response.status() });
    if (response.status() >= 400) failures.push(`A footer legal destination returned ${response.status()}: ${href}`);
  } catch (error) {
    report.interactions.legalTargets.push({ href, error: String(error).slice(0, 120) });
    failures.push(`A footer legal destination could not be reached: ${href}`);
  }
}

// One title per page header, and the accent mark that replaced the caps label. Read from computed
// style, because the mark is a ::before and there is nothing in the markup to find.
report.interactions.pageHeaders = {};
for (const route of ["/vehicles/", "/concepts/", "/dealers/", "/recommend-dealer/", "/dealer-inquiry/", "/owners/", "/privacy/", "/contact/", "/experience/", "/blog/", "/careers/", "/safety/"]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  report.interactions.pageHeaders[route] = await page.evaluate(() => {
    const header = document.querySelector(".page-header");
    const heading = header.querySelector("h1");
    const mark = getComputedStyle(heading, "::before");
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    return {
      titles: header.querySelectorAll("h1, h2, .eyebrow").length,
      title: heading.textContent,
      markWidth: Math.round(parseFloat(mark.width)),
      markHeight: Math.round(parseFloat(mark.height)),
      markIsAccent: mark.backgroundColor,
      // Read from the header's own scope rather than from :root. V11-E gives the ten concept routes
      // a derived accent, because the dark-page value measures 2.65:1 on white and --focus-color is
      // the accent; comparing every route to one hardcoded orange would fail a page that is correct.
      accentToken: getComputedStyle(header).getPropertyValue("--accent").trim() || accent,
      // The title's left edge has to stay on the page's content edge. An inline mark would indent it,
      // which is why the mark sits above the title rather than beside it.
      markDisplay: mark.display,
      // The rendered left edge of the title's TEXT, measured with a range over the heading's own child
      // nodes, which excludes the ::before. The heading's bounding box is the wrong measure and
      // mutation testing proved it: switching the mark to display: inline-block indents every title by
      // the mark's width plus its margin, and the box's left edge does not move at all, so the check
      // passed on a visibly broken layout. What is being asserted is where the words start.
      titleLeft: (() => {
        const range = document.createRange();
        range.selectNodeContents(heading);
        const rect = range.getClientRects()[0];
        return rect ? Math.round(rect.left) : null;
      })(),
      // A content-column section, explicitly not a .bleed one. On /concepts/ the first child after the
      // header is the full-bleed concept band, which starts at x=0 by design, and comparing the title
      // to that reported a correctly aligned title as 120px indented.
      bodyLeft: Math.round(document.querySelector(".page > section:not(.bleed)").getBoundingClientRect().left),
    };
  });
  const header = report.interactions.pageHeaders[route];
  if (header.titles !== 1) failures.push(`${route}: the page header carries ${header.titles} titles, expected one`);
  if (header.markWidth < 8 || header.markHeight < 1) failures.push(`${route}: the title's accent mark did not render: ${JSON.stringify(header)}`);
  // Compared against the token in force on that page, converted to the same space, so the assertion
  // is "the mark is painted the accent" rather than "the mark is painted this one orange".
  const tokenAsRgb = `rgb(${[1, 3, 5].map((index) => parseInt(header.accentToken.slice(index, index + 2), 16)).join(", ")})`;
  if (header.markIsAccent !== tokenAsRgb) failures.push(`${route}: the title mark is ${header.markIsAccent}, not the accent token ${header.accentToken} (${tokenAsRgb})`);
  // The outcome, then the mechanism. The first is what a visitor sees; the second names the cause when
  // it breaks, because an indented title is almost always a mark that has gone inline.
  if (header.titleLeft === null || Math.abs(header.titleLeft - header.bodyLeft) > 1) failures.push(`${route}: the title's text starts ${header.titleLeft - header.bodyLeft}px off the content edge`);
  if (header.markDisplay !== "block") failures.push(`${route}: the title mark is ${header.markDisplay}, which puts it inline with the title instead of above it`);
}
if (report.interactions.pageHeaders["/concepts/"].title !== "Concepts") failures.push(`The concepts page title is ${report.interactions.pageHeaders["/concepts/"].title}`);
if (report.interactions.pageHeaders["/owners/"].title !== "Owner manuals.") failures.push(`The owners page title is ${report.interactions.pageHeaders["/owners/"].title}`);

// The policy page. The claim worth testing is that a long legal document renders as one readable
// column and that its longest link cannot widen a phone.
report.interactions.privacy = {};
for (const width of [320, 390, 768, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${base}/privacy/`, { waitUntil: "networkidle" });
  report.interactions.privacy[width] = await page.evaluate(() => ({
    sections: document.querySelectorAll(".policy__section").length,
    headings: document.querySelectorAll(".policy h2").length,
    paragraphs: document.querySelectorAll(".policy p").length,
    listItems: document.querySelectorAll(".policy li").length,
    references: [...document.querySelectorAll(".policy__url a")].map((anchor) => anchor.getAttribute("href")),
    noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
    backLink: document.querySelector(".back-nav a")?.getAttribute("href"),
    // Running legal copy on one narrow measure. A policy set to the full 1200px column would be
    // unreadable, and this is the page most likely to lose the narrow class in an edit.
    measure: Math.round(document.querySelector(".policy p").getBoundingClientRect().width),
  }));
  const policy = report.interactions.privacy[width];
  if (policy.sections !== 13 || policy.headings !== 12) failures.push(`/privacy/ at ${width}px renders ${policy.sections} sections and ${policy.headings} headings, expected 13 and 12`);
  // 44 paragraphs and 21 items across 8 lists. Stated here rather than read from the data, so this
  // assertion stays independent of the module it is checking; check-content compares the strings.
  if (policy.paragraphs !== 46) failures.push(`/privacy/ at ${width}px renders ${policy.paragraphs} paragraphs, expected 46`);
  if (policy.listItems !== 21) failures.push(`/privacy/ at ${width}px renders ${policy.listItems} list items, expected 21`);
  if (policy.references.length !== 2) failures.push(`/privacy/ at ${width}px renders ${policy.references.length} references, expected 2`);
  if (!policy.noHorizontalScroll) failures.push(`/privacy/ widened the document at ${width}px, most likely on one of its long reference URLs`);
  if (policy.backLink !== "/") failures.push(`/privacy/ back link leads to ${policy.backLink}, expected /`);
  if (policy.measure > 820) failures.push(`/privacy/ at ${width}px sets its copy to ${policy.measure}px, wider than the narrow measure`);
}
await page.setViewportSize({ width: 1440, height: 1000 });

const noJsContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
const noJsPage = await noJsContext.newPage();
const noJsResponse = await noJsPage.goto(`${base}/brawley/`, { waitUntil: "load" });
const noJsBodyText = await noJsPage.locator("body").innerText();
report.noJs = {
  status: noJsResponse?.status(),
  bodyLength: noJsBodyText.trim().length,
  // The figures are plain markup, so all 33 of Brawley's V11-C rows render with no script at all. The
  // metric assertion is negative on purpose: it proves metric was removed rather than hidden by a
  // stylesheet the way the old toggle hid it.
  // V13-B: 32 rows, not 33. The Range row is gone.
  visibleSpecRows: await noJsPage.locator(".photo-module__specs .spec-row:visible").count(),
  showsImperial: noJsBodyText.includes("488 lb-ft"),
  showsMetric: noJsBodyText.includes("661 Nm"),
  backLinks: await noJsPage.locator(".back-nav a:visible").count(),
  navLinks: await noJsPage.locator("nav a").count(),
  forms: {},
};
if (report.noJs.status !== 200 || report.noJs.bodyLength < 500 || report.noJs.navLinks === 0) failures.push("No-JS verification failed");
if (report.noJs.visibleSpecRows !== 32) failures.push(`No-JS /brawley/ must render all 32 specification rows, found ${report.noJs.visibleSpecRows}`);
if (!report.noJs.showsImperial) failures.push("No-JS /brawley/ is missing its imperial torque figure");
if (report.noJs.showsMetric) failures.push("No-JS /brawley/ still carries a metric value");
if (report.noJs.backLinks !== 1) failures.push(`No-JS /brawley/ must offer one way back, found ${report.noJs.backLinks}`);
// The purchase page without JavaScript: a real photograph, the price, the disclaimer, and a
// plain reservation link. Controls hidden, swatches disabled, nothing dead on the screen.
await noJsPage.goto(`${base}/brawley/gts/`, { waitUntil: "load" });
report.noJs.gts = await noJsPage.evaluate(() => {
  const frame = document.querySelector(".walkaround__frame");
  // V17: the order path is this site's own page, so the link to look for is internal now.
  const reserve = [...document.querySelectorAll("a")].find((anchor) => anchor.getAttribute("href") === "/brawley/order/");
  const text = document.body.innerText;
  return {
    frameLoaded: Boolean(frame?.naturalWidth),
    frameVisible: Boolean(frame?.getClientRects().length),
    controlsHidden: document.querySelector("[data-walkaround-controls]")?.hidden === true,
    disabledSwatches: document.querySelectorAll(".swatch[disabled]").length,
    reserveIsPlainLink: Boolean(reserve) && reserve.tagName === "A",
    hasPrice: text.includes("$49,950"),
    hasTiers: ["$0", "$750", "$1,050"].every((amount) => text.includes(amount)),
    hasDisclaimer: text.includes("Manufacturer's Suggested Retail Price"),
    hasSafety: text.includes("Refer to the relevant owner's manual"),
  };
});
const gtsNoJs = report.noJs.gts;
if (!gtsNoJs.frameLoaded || !gtsNoJs.frameVisible) failures.push("No-JS purchase page does not render a studio frame");
if (!gtsNoJs.controlsHidden || gtsNoJs.disabledSwatches !== 9) failures.push("No-JS purchase page shows controls it cannot drive");
if (!gtsNoJs.reserveIsPlainLink || !gtsNoJs.hasPrice || !gtsNoJs.hasTiers || !gtsNoJs.hasDisclaimer || !gtsNoJs.hasSafety) failures.push(`No-JS purchase page is missing price, disclosure, or the order link: ${JSON.stringify(gtsNoJs)}`);

// Without JavaScript the V9 additions must each read as a finished static layout. The band is a
// filmstrip with no pause button, and the headings are whole sentences rather than span soup.
await noJsPage.goto(`${base}/concepts/`, { waitUntil: "load" });
report.noJs.marquee = await noJsPage.evaluate(() => {
  const band = document.querySelector("[data-marquee]");
  const track = band?.querySelector(".concept-marquee__track");
  const toggle = band?.querySelector("[data-marquee-toggle]");
  return {
    items: band?.querySelectorAll(".concept-marquee__item").length,
    animationName: track ? getComputedStyle(track).animationName : null,
    ready: band?.hasAttribute("data-ready"),
    toggleHidden: toggle?.hidden === true,
    toggleVisible: Boolean(toggle?.getClientRects().length),
    tilesVisible: [...(band?.querySelectorAll(".concept-marquee__item img") ?? [])].filter((image) => image.getClientRects().length).length,
    noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
    cards: document.querySelectorAll(".card .card__link").length,
  };
});
const noJsMarquee = report.noJs.marquee;
if (noJsMarquee.items !== 18) failures.push(`No-JS concept band must render 18 tiles, found ${noJsMarquee.items}`);
if (noJsMarquee.animationName !== "none" || noJsMarquee.ready) failures.push("No-JS concept band must not animate: data-ready is the island's to set");
if (!noJsMarquee.toggleHidden || noJsMarquee.toggleVisible) failures.push("No-JS concept band must show no pause button it cannot drive");
if (!noJsMarquee.noHorizontalScroll) failures.push("No-JS concept band widened the document");
if (noJsMarquee.cards !== 9) failures.push(`No-JS concepts hub must still expose nine linked cards, found ${noJsMarquee.cards}`);

await noJsPage.goto(`${base}/concepts/indio/`, { waitUntil: "load" });
report.noJs.wordCascade = await noJsPage.evaluate(() => ({
  words: document.querySelectorAll(".word").length,
  split: document.querySelectorAll(".is-split, [data-split]").length,
  lede: document.querySelector(".lede")?.textContent ?? null,
  ledeVisible: Boolean(document.querySelector(".lede")?.getClientRects().length),
}));
const noJsCascade = report.noJs.wordCascade;
if (noJsCascade.words !== 0 || noJsCascade.split !== 0) failures.push(`No-JS pages must carry no word spans, found ${noJsCascade.words}`);
if (!noJsCascade.ledeVisible || (noJsCascade.lede ?? "").length < 80) failures.push(`No-JS lede must render whole: ${JSON.stringify(noJsCascade.lede)}`);

// Without JavaScript no video may be requested at all, and this is the strongest form of that claim:
// the sources carry data-src rather than src, so there is nothing in the markup for the parser to
// fetch. What the visitor gets is the poster, which is a real photograph, and no control.
report.noJs.ambient = {};
for (const [route, blockSelector, posterSelector] of AMBIENT_PLACEMENTS) {
  const noJsVideoRequests = [];
  const listener = (request) => { if (/\/assets\/video\/.+\.(?:webm|mp4)$/.test(request.url())) noJsVideoRequests.push(request.url()); };
  noJsPage.on("request", listener);
  await noJsPage.goto(`${base}${route}`, { waitUntil: "load" });
  await noJsPage.locator(blockSelector).first().scrollIntoViewIfNeeded();
  const shape = await noJsPage.locator(blockSelector).first().evaluate((node, selector) => {
    const poster = node.querySelector(selector);
    return {
      posterLoaded: Boolean(poster.naturalWidth),
      posterVisible: Boolean(poster.getClientRects().length),
      toggleHidden: node.querySelector("[data-ambient-toggle]").hidden,
      toggleVisible: Boolean(node.querySelector("[data-ambient-toggle]").getClientRects().length),
      painted: node.hasAttribute("data-painted"),
      readyState: node.querySelector("[data-ambient-video]").readyState,
      sourcesWithSrc: node.querySelectorAll("[data-ambient-video] source[src]").length,
    };
  }, posterSelector);
  noJsPage.off("request", listener);
  report.noJs.ambient[route] = { videoRequests: noJsVideoRequests, shape };
  if (noJsVideoRequests.length) failures.push(`No-JS ${route} requested ${noJsVideoRequests.length} video sources`);
  if (shape.sourcesWithSrc !== 0 || shape.readyState !== 0) failures.push(`No-JS ${route} left a resolvable video source in the markup: ${JSON.stringify(shape)}`);
  if (!shape.posterLoaded || !shape.posterVisible) failures.push(`No-JS ${route} does not render its poster`);
  if (!shape.toggleHidden || shape.toggleVisible || shape.painted) failures.push(`No-JS ${route} shows a video control it cannot drive`);
}

// V11-B. With JavaScript disabled, nothing may be left in a reveal's start state on either path, and
// the two paths fail differently so both are measured. The CSS path's start state sits inside
// @supports, so a browser without view() timelines renders the final state rather than hiding content
// it can never reveal. The fallback's start state lives on an attribute that only site.js sets, so a
// page where this file never arrives has no start state at all. Both reduce to one measurement: no
// element carries the attribute, and nothing that would have been revealed is under full opacity or
// displaced. This is the single most important no-JS assertion in the suite, because the failure it
// guards against is a page of invisible content that still returns 200.
// The claim is precise, and getting it wrong the first time is worth recording. Measuring opacity at
// scroll zero fails a correct page: with view() timelines supported, a below-fold block sits at
// opacity 0 because its own timeline has not advanced, and that is true with or without JavaScript,
// because the CSS path needs no script at all. Hidden-until-scrolled is the feature. What must never
// happen is hidden-after-scrolling, or a start state that nothing will ever clear.
//
// So this scrolls the page first, then measures only the blocks that have definitively finished
// entering, which is the ones now above the viewport. Anything still faded up there is content the
// visitor has scrolled past and cannot see.
// The scroll loop runs here rather than inside the page, and that is not a style preference. A
// context with javaScriptEnabled: false has no working timers, so an in-page `await setTimeout` never
// resolves and Playwright eventually reports the promise as garbage collected. Every evaluate below
// is synchronous; the waiting happens on this side.
// REVEAL_SELECTOR is defined above the motion coverage suite, which now shares it.
// V15: /safety/ left this sample when its portal state fit in one viewport and there was nothing to
// scroll past; an article route took its long-form place. V17 gives /safety/ three notice cards again,
// but the article route stays: it is still the longer scroll and the sample is about length, not topic.
for (const route of ["/", "/vehicles/", "/brawley/", "/concepts/", "/owners/", "/blog/", articleRoutes[1], "/santarosa/launch-edition/"]) {
  await noJsPage.goto(`${base}${route}`, { waitUntil: "load" });
  const before = await noJsPage.evaluate((selector) => {
    document.documentElement.style.scrollBehavior = "auto";
    return {
      candidates: document.querySelectorAll(selector).length,
      markedBeforeScroll: document.querySelectorAll("[data-reveal]").length,
      // V12-C makes this assertion possible, and it is much stronger than the one below it. In V11 a
      // below-fold block legitimately sat at opacity 0 without script, because the CSS view() path
      // needed no script and had not advanced its timeline yet, so nothing could be asserted at scroll
      // zero. There is no CSS reveal path now: without JavaScript nothing is ever hidden at any scroll
      // position, so a single faded candidate here is a defect no matter where it sits on the page.
      fadedAtRest: [...document.querySelectorAll(selector)].filter((element) => Number(getComputedStyle(element).opacity) < 0.99)
        .map((element) => `${element.className}@${Number(getComputedStyle(element).opacity).toFixed(2)}`),
      height: document.documentElement.scrollHeight,
      viewport: innerHeight,
    };
  }, REVEAL_SELECTOR);
  for (let position = 0; position < before.height; position += before.viewport * 0.6) {
    await noJsPage.evaluate((y) => scrollTo(0, y), position);
    await noJsPage.waitForTimeout(40);
  }
  await noJsPage.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await noJsPage.waitForTimeout(250);
  const measured = await noJsPage.evaluate((selector) => {
    const scrolledPast = [...document.querySelectorAll(selector)].filter((element) => element.getBoundingClientRect().bottom < 0);
    return {
      scrolledPast: scrolledPast.length,
      markedAfterScroll: document.querySelectorAll("[data-reveal]").length,
      stillFaded: scrolledPast.filter((element) => Number(getComputedStyle(element).opacity) < 0.99)
        .map((element) => `${element.className}@${Number(getComputedStyle(element).opacity).toFixed(2)}`),
      // Displacement in pixels, not the string "none". A finished animation whose last keyframe is
      // transform: none still computes to an identity matrix rather than to the keyword, so comparing
      // against "none" reports every correctly resolved reveal on the page as broken. What matters is
      // whether the block is still shifted from where it belongs, so the translation is read out of
      // the matrix and measured.
      stillDisplaced: scrolledPast.filter((element) => {
        const transform = getComputedStyle(element).transform;
        if (transform === "none") return false;
        const parts = (transform.match(/matrix\(([^)]+)\)/) || [])[1];
        if (!parts) return true;
        const [, , , , x, y] = parts.split(",").map((value) => Math.abs(parseFloat(value)));
        return x > 0.5 || y > 0.5;
      }).map((element) => `${element.className}@${getComputedStyle(element).transform}`),
    };
  }, REVEAL_SELECTOR);
  const shape = { ...before, ...measured };
  report.noJs[`reveals${route}`] = shape;
  if (shape.candidates === 0) failures.push(`No-JS ${route}: found no revealable blocks to check, so this assertion proves nothing`);
  if (shape.fadedAtRest.length) failures.push(`No-JS ${route}: ${shape.fadedAtRest.length} blocks are hidden before any scroll, which without script is content nothing can reveal: ${shape.fadedAtRest.slice(0, 4).join(", ")}`);
  if (shape.scrolledPast === 0) failures.push(`No-JS ${route}: nothing was scrolled past, so nothing was actually measured`);
  // The fallback's start state can only be set by site.js, so it must be absent at both ends.
  if (shape.markedBeforeScroll !== 0 || shape.markedAfterScroll !== 0) failures.push(`No-JS ${route}: ${shape.markedAfterScroll} elements carry the fallback's start state, which nothing will ever clear`);
  if (shape.stillFaded.length) failures.push(`No-JS ${route}: ${shape.stillFaded.length} scrolled-past blocks are still hidden without script: ${shape.stillFaded.slice(0, 4).join(", ")}`);
  if (shape.stillDisplaced.length) failures.push(`No-JS ${route}: ${shape.stillDisplaced.length} scrolled-past blocks never returned to their final position: ${shape.stillDisplaced.slice(0, 3).join(", ")}`);
}

// V13. Without JavaScript the locator shows the complete dealer list and none of the three controls that need
// scripting. The controls are in the DOM, because rendering them at first paint is what keeps the page from
// shifting when they become usable; the <noscript> style block is what withdraws them here.
await noJsPage.goto(`${base}/dealers/`, { waitUntil: "load" });
report.noJs.locator = await noJsPage.evaluate(() => ({
  cards: [...document.querySelectorAll(".dealer-card")].filter((card) => card.checkVisibility()).length,
  searchVisible: document.querySelector("[data-locator-search]").checkVisibility(),
  // V16-E: the mode switch is retired outright, and V16-F's zoom controls ship with the hidden
  // attribute, so neither may be visible here for opposite reasons: one must not exist at all,
  // the other exists and waits for the island.
  modeMarkup: document.querySelectorAll("[data-locator-modes], [data-locator-mode]").length,
  zoomControlsVisible: document.querySelector("[data-map-controls]")?.checkVisibility() ?? false,
  selectVisible: [...document.querySelectorAll("[data-dealer-select]")].filter((button) => button.checkVisibility()).length,
  phones: document.querySelectorAll('.dealer-card a[href^="tel:"]').length,
  directions: [...document.querySelectorAll(".dealer-card a")].filter((anchor) => anchor.href.includes("google.com/maps/dir")).length,
  mapArt: document.querySelector(".locator__map-art")?.checkVisibility(),
  mapPins: document.querySelectorAll("[data-dealer-pin]").length,
}));
const noJsLocator = report.noJs.locator;
if (noJsLocator.cards !== 6 || noJsLocator.phones !== 6 || noJsLocator.directions !== 6) failures.push(`No-JS /dealers/ must render every dealer with its phone and directions: ${JSON.stringify(noJsLocator)}`);
if (noJsLocator.searchVisible || noJsLocator.modeMarkup !== 0 || noJsLocator.zoomControlsVisible || noJsLocator.selectVisible) failures.push(`No-JS /dealers/ shows controls it cannot drive: ${JSON.stringify(noJsLocator)}`);
if (!noJsLocator.mapArt || noJsLocator.mapPins !== 6) failures.push(`No-JS /dealers/ must still show the illustrative map with all six pins: ${JSON.stringify(noJsLocator)}`);

// The policy page has to be complete without script, because it is a legal document.
await noJsPage.goto(`${base}/privacy/`, { waitUntil: "load" });
report.noJs.privacy = await noJsPage.evaluate(() => ({
  sections: document.querySelectorAll(".policy__section").length,
  paragraphs: document.querySelectorAll(".policy p").length,
  listItems: document.querySelectorAll(".policy li").length,
  words: document.querySelectorAll(".word").length,
  textLength: document.querySelector(".policy").innerText.trim().length,
}));
const noJsPrivacy = report.noJs.privacy;
if (noJsPrivacy.sections !== 13 || noJsPrivacy.paragraphs !== 46 || noJsPrivacy.listItems !== 21) failures.push(`No-JS /privacy/ is incomplete: ${JSON.stringify(noJsPrivacy)}`);
// The whole policy is about 9,900 characters of rendered text. The floor is set just under that, so
// losing any one of the thirteen sections drops below it, and no word may be split into spans: the
// cascade must never touch a legal document.
if (noJsPrivacy.words !== 0 || noJsPrivacy.textLength < 9500) failures.push(`No-JS /privacy/ must render the whole policy as plain text: ${JSON.stringify(noJsPrivacy)}`);

// Every footer destination must be a plain link with no script anywhere near it.
report.noJs.footer = await noJsPage.evaluate(() => ({
  social: document.querySelectorAll(".footer-follow a[href]").length,
  legal: document.querySelectorAll(".footer-legal__links a[href]").length,
  privacyHref: [...document.querySelectorAll(".footer-legal__links a")].map((anchor) => anchor.getAttribute("href")).includes("/privacy/"),
}));
if (report.noJs.footer.social !== 6 || report.noJs.footer.legal !== 3 || !report.noJs.footer.privacyHref) failures.push(`No-JS footer links failed: ${JSON.stringify(report.noJs.footer)}`);

await noJsPage.goto(`${base}/`, { waitUntil: "load" });
report.noJs.vehiclesHref = await noJsPage.getByRole("link", { name: "Vehicles", exact: true }).first().getAttribute("href");
if (report.noJs.vehiclesHref !== "/vehicles/") failures.push("No-JS Vehicles navigation is not a plain link");
// V13: without JavaScript the Contact form shows every step and every branch, with nothing disabled, which is
// exactly what this audit asserts. /dealers/ leaves the list because its only form is the locator's search,
// which ships hidden.
for (const route of ["/contact/", "/recommend-dealer/", "/dealer-inquiry/", "/brawley/order/"]) {
  await noJsPage.goto(`${base}${route}`, { waitUntil: "load" });
  const formAudit = await noJsPage.locator("[data-site-form]").last().evaluate((form) => {
    const controls = [...form.querySelectorAll("input:not([type=hidden]), select, textarea")];
    return { controls: controls.length, disabled: controls.filter((control) => control.disabled).length, unlabeled: controls.filter((control) => !control.labels?.length).map((control) => control.id || control.name) };
  });
  report.noJs.forms[route] = formAudit;
  if (!formAudit.controls || formAudit.disabled || formAudit.unlabeled.length) failures.push(`No-JS form audit failed for ${route}`);
}
await noJsContext.close();

// V13: /dealers/ carries no submission form, and /contact/ is exercised by its own suite above, because a
// three-step form cannot be completed by walking a flat list of required controls.
for (const route of ["/recommend-dealer/", "/dealer-inquiry/", "/brawley/order/"]) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const form = page.locator("[data-site-form]").last();
  await form.locator("[name='render_timestamp']").evaluate((input) => { input.value = String(Date.now() - 3000); });
  await form.getByRole("button", { name: /send request|submit inquiry|submit/i }).click();
  const summaryFocused = await page.evaluate(() => document.activeElement?.classList.contains("form-error-summary"));
  const firstAnchor = form.locator(".form-error-summary a").first();
  const target = await firstAnchor.getAttribute("href");
  await firstAnchor.click();
  const anchorFocused = await page.evaluate((selector) => document.activeElement?.id === selector.slice(1), target);
  const requiredControls = form.locator("input[required], select[required], textarea[required]");
  const completedGroups = new Set();
  for (let index = 0; index < await requiredControls.count(); index += 1) {
    const control = requiredControls.nth(index);
    const attributes = await control.evaluate((element) => ({ type: element.type, name: element.name, value: element.value, pattern: element.pattern }));
    if ((attributes.type === "radio" || attributes.type === "checkbox") && completedGroups.has(attributes.name)) continue;
    if (attributes.type === "radio" || attributes.type === "checkbox") completedGroups.add(attributes.name);
    await control.focus();
    if (attributes.type === "radio" || attributes.type === "checkbox") await page.keyboard.press("Space");
    else if (attributes.type === "select-one" && !attributes.value) { await page.keyboard.type("Afghanistan"); await page.keyboard.press("Enter"); }
    else if (!attributes.value) {
      const value = attributes.type === "email" ? "test@example.com" : attributes.type === "url" ? "https://example.com" : attributes.pattern ? (attributes.pattern.includes("{5}") ? "84601" : "1000") : "Test response";
      await page.keyboard.type(value);
    }
  }
  await form.locator("[name='render_timestamp']").evaluate((input) => { input.value = String(Date.now() - 3000); });
  const submit = form.getByRole("button", { name: /send request|submit inquiry|submit/i });
  await submit.focus();
  await page.keyboard.press("Enter");
  const notConnected = await form.locator(".form-status").innerText() === "Online submissions are not open yet. Email inquiry@vanderhall.com and the team will follow up.";
  report.forms[route] = { summaryFocused, anchorFocused, keyboardCompletion: notConnected, controls: await form.locator("input, select, textarea").count(), fieldsets: await form.locator("fieldset").count() };
  if (!summaryFocused || !anchorFocused || !notConnected) failures.push(`Form keyboard or error-summary flow failed for ${route}`);
}

// ---------------------------------------------------------------------------------------------
// V11. The white studio field, the filmstrip dissolve, the reveal fallback, and the evened-out
// specification groups.
// ---------------------------------------------------------------------------------------------

// V11-E. The studio scope is measured rather than asserted by class name: what matters is that the
// ramp actually recomputed, that the header and the footer did not, and that the focus indicator
// clears 3:1 on the paper it now sits on.
const relativeLuminance = (rgb) => {
  const channel = (value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(rgb[0] / 255) + 0.7152 * channel(rgb[1] / 255) + 0.0722 * channel(rgb[2] / 255);
};
const parseRgb = (value) => (value.match(/\d+(?:\.\d+)?/g) || []).slice(0, 3).map(Number);
const contrastRatio = (a, b) => {
  const [high, low] = [relativeLuminance(parseRgb(a)), relativeLuminance(parseRgb(b))].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

report.studio = { routes: {} };
// V12-D adds the purchase page to the sample. A sample rather than all eleven routes: check-content
// asserts the exact route set as strings, and this measures that the scope actually resolves.
for (const route of ["/concepts/", "/concepts/indio/", "/concepts/yuma/", "/concepts/balboa/", "/brawley/gts/"]) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const shape = await page.evaluate(() => {
    const main = document.querySelector("main");
    const style = getComputedStyle(main);
    // The purchase page's h1 is inside .gts-open__intro rather than in a .page-header, and it has no
    // .concept-title, so without the third selector this returns null and the contrast read below
    // throws instead of measuring.
    const title = document.querySelector(".page-header h1, .concept-title, .gts-open__intro h1");
    const wordmark = document.querySelector(".concept-title img");
    return {
      scoped: main.classList.contains("page--studio"),
      paper: style.getPropertyValue("--paper").trim(),
      ink: style.getPropertyValue("--ink").trim(),
      accent: style.getPropertyValue("--accent").trim(),
      focusColor: style.getPropertyValue("--focus-color").trim(),
      mainBackground: style.backgroundColor,
      // The ramp has to have recomputed against the studio ink, which is the whole reason it is
      // restated in tokens.css rather than inherited. If a custom property resolved its var() where
      // it was declared instead, --text-secondary here would still be a light grey.
      textSecondary: style.getPropertyValue("--text-secondary").trim(),
      titleColor: title ? getComputedStyle(title).color : null,
      wordmarkFilter: wordmark ? getComputedStyle(wordmark).filter : null,
      // Outside main, and therefore still dark.
      headerBackground: getComputedStyle(document.querySelector(".site-header")).backgroundColor,
      footerColor: getComputedStyle(document.querySelector(".site-footer")).color,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
    };
  });
  const focusContrast = Number(contrastRatio(shape.focusColor.startsWith("#")
    ? `rgb(${[1, 3, 5].map((index) => parseInt(shape.focusColor.slice(index, index + 2), 16)).join(",")})`
    : shape.focusColor, "rgb(255,255,255)").toFixed(2));
  report.studio.routes[route] = { ...shape, focusContrast };
  if (!shape.scoped) failures.push(`${route}: must carry the studio scope on main`);
  if (shape.paper !== "#FFFFFF") failures.push(`${route}: the studio paper is ${shape.paper}`);
  if (shape.mainBackground !== "rgb(255, 255, 255)") failures.push(`${route}: main is painted ${shape.mainBackground}, not the studio white`);
  // Dark ink on white, measured rather than named.
  const inkContrast = Number(contrastRatio(shape.titleColor, "rgb(255,255,255)").toFixed(2));
  report.studio.routes[route].inkContrast = inkContrast;
  if (inkContrast < 7) failures.push(`${route}: the title measures ${inkContrast}:1 on the studio paper`);
  // 3:1 is the floor for a focus indicator. The derived value targets 3.5:1, so anything at or below
  // 3 means the accent was left as the dark-page value or the derivation was undone.
  if (focusContrast < 3) failures.push(`${route}: the focus indicator measures ${focusContrast}:1 against the studio paper, below the 3:1 floor`);
  if (shape.accent === "#E08A55") failures.push(`${route}: the studio scope is still using the dark-page accent, which measures 2.65:1 on white`);
  // The wordmark's inversion existed only because V9 put a dark page behind dark artwork.
  if (shape.wordmarkFilter && shape.wordmarkFilter !== "none") failures.push(`${route}: the concept wordmark is still inverted (${shape.wordmarkFilter}), so it is white artwork on a white page`);
  // The header and the footer are outside main and must not have followed it.
  if (shape.headerBackground.includes("255, 255, 255")) failures.push(`${route}: the site header followed the studio scope onto white`);
  if (shape.bodyBackground !== "rgb(14, 14, 16)") failures.push(`${route}: the studio scope escaped main and repainted the document`);
}
// And no other route took it.
await page.goto(`${base}/`, { waitUntil: "networkidle" });
report.studio.homeScoped = await page.evaluate(() => document.querySelector("main").classList.contains("page--studio"));
if (report.studio.homeScoped) failures.push("The studio scope reached the homepage, whose imagery is not authored on white");
// V13 adds twelve routes and none of them takes the white field: the rule is that a page earns it when its
// imagery was shot in a white studio, and none of the new pages has any.
report.studio.v13Routes = {};
for (const route of ["/dealers/", "/contact/", "/experience/", "/blog/", "/careers/", "/safety/", "/santarosa/launch-edition/"]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const scoped = await page.evaluate(() => document.querySelector("main").classList.contains("page--studio"));
  report.studio.v13Routes[route] = scoped;
  if (scoped) failures.push(`${route}: a V13 route took the white studio field, which is reserved for studio-shot imagery`);
}

// V11-F. The filmstrip fade, measured at three scroll positions rather than asserted by presence.
// Owen: "I want it to go through the middle of that and fade out a lot sooner than that." The claim
// is that it is quiet at rest, dissolving through the intro paragraph, and gone before the cards.
const stripContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference" });
const stripPage = await stripContext.newPage();
await stripPage.goto(`${base}/concepts/`, { waitUntil: "networkidle" });
await stripPage.evaluate(() => { document.documentElement.style.scrollBehavior = "auto"; });
const stripGeometry = await stripPage.evaluate(() => {
  const box = (selector) => {
    const rect = document.querySelector(selector).getBoundingClientRect();
    return { top: Math.round(rect.top + scrollY), height: Math.round(rect.height) };
  };
  return { band: box(".concept-marquee"), intro: box(".page-header > p"), grid: box(".card-grid--concepts") };
});
const stripAt = async (y) => {
  await stripPage.evaluate((position) => scrollTo(0, position), y);
  await stripPage.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  return stripPage.evaluate(() => {
    const viewport = document.querySelector(".concept-marquee__viewport");
    const style = getComputedStyle(viewport);
    return {
      scrollY: Math.round(scrollY),
      opacity: Number(Number(style.opacity).toFixed(3)),
      blur: Number((style.filter.match(/blur\(([\d.]+)px\)/) || [0, 0])[1]),
    };
  });
};
report.strip = {
  geometry: stripGeometry,
  atRest: await stripAt(0),
  midIntro: await stripAt(Math.round(stripGeometry.intro.top / 2)),
  atCards: await stripAt(stripGeometry.grid.top),
};
// Quiet at rest. It is decoration behind a title, not a second index.
if (report.strip.atRest.opacity > 0.6 || report.strip.atRest.opacity < 0.2) failures.push(`The filmstrip must sit well below full strength at rest, measured ${report.strip.atRest.opacity}`);
if (report.strip.atRest.blur > 0.5) failures.push(`The filmstrip must be sharp before any scroll, measured blur ${report.strip.atRest.blur}px`);
// Dissolving by the middle of the intro paragraph, which is the pacing Owen asked for.
if (report.strip.midIntro.opacity >= report.strip.atRest.opacity) failures.push(`The filmstrip had not begun to dissolve by the intro paragraph: ${JSON.stringify(report.strip)}`);
if (report.strip.midIntro.blur <= 0) failures.push("The filmstrip must blur as it dissolves, not only fade");
// Gone before the cards. This is the invariant the whole treatment rests on.
if (report.strip.atCards.opacity > 0.01) failures.push(`The filmstrip must be fully gone by the card grid, measured ${report.strip.atCards.opacity}`);
if (stripGeometry.grid.top <= stripGeometry.band.top) failures.push("The card grid must follow the band, or this measurement means nothing");
// The control does not fade with the film it controls. V10 amendment 1, as a standing rule.
report.strip.toggleOpacityAtRest = await stripPage.evaluate(() => {
  const toggle = document.querySelector("[data-marquee-toggle]");
  let value = 1;
  for (let element = toggle; element && element !== document.body; element = element.parentElement) value *= Number(getComputedStyle(element).opacity);
  return Number(value.toFixed(3));
});
if (report.strip.toggleOpacityAtRest < 1) failures.push(`The filmstrip's pause control must not inherit the dissolve, measured ${report.strip.toggleOpacityAtRest}`);
// Below the breakpoint the band is not rendered at all, so a phone spends nothing on it.
await stripPage.setViewportSize({ width: 390, height: 844 });
await stripPage.goto(`${base}/concepts/`, { waitUntil: "networkidle" });
report.strip.mobile = await stripPage.evaluate(() => {
  const url = (image) => new URL(image.currentSrc || image.src, location.origin).pathname;
  const bandUrls = new Set([...document.querySelectorAll(".concept-marquee__item img")].map(url));
  const cardUrls = new Set([...document.querySelectorAll(".card__media img")].map(url));
  return {
    bandDisplay: getComputedStyle(document.querySelector(".concept-marquee")).display,
    tilesPainted: [...document.querySelectorAll(".concept-marquee__item img")].filter((image) => image.getClientRects().length).length,
    // The cost question, asked correctly. The band renders eighteen tiles over nine URLs, and those
    // are the same nine files the card grid below is built from, so a phone that fetches them has
    // fetched nothing it did not already need. What would be wasteful is a URL unique to the band.
    bandOnlyUrls: [...bandUrls].filter((path) => !cardUrls.has(path)),
    cards: document.querySelectorAll(".card .card__link").length,
    noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
  };
});
if (report.strip.mobile.bandDisplay !== "none") failures.push(`The band must not render below 768px, found display ${report.strip.mobile.bandDisplay}`);
if (report.strip.mobile.tilesPainted !== 0) failures.push(`${report.strip.mobile.tilesPainted} band tiles are painted below the breakpoint`);
if (report.strip.mobile.bandOnlyUrls.length) failures.push(`A phone fetched ${report.strip.mobile.bandOnlyUrls.length} images that exist only for a band it will never see: ${report.strip.mobile.bandOnlyUrls.join(", ")}`);
if (report.strip.mobile.cards !== 9) failures.push(`The concepts index must still be nine cards on a phone, found ${report.strip.mobile.cards}`);
if (!report.strip.mobile.noHorizontalScroll) failures.push("The concepts hub widened the document at 390px");
await stripContext.close();

// V12-C. What stood here was the fallback suite: it faked CSS.supports so that Chrome would take the
// IntersectionObserver branch, then neutralised the CSS animation so the transition was the thing under
// test, and finally asserted that on a REAL Chrome nothing was marked, because the two paths had to be
// mutually exclusive. All of that scaffolding existed to reach a path that only Safari and Firefox took.
//
// There is one path now, so the scaffolding is gone and the assertions it made moved into the coverage
// suite above, where they run on the real browser across eleven routes rather than on a faked one across
// one. The inverse of the old no-double-drive check is asserted there too: marked elements are now
// expected on every browser, not forbidden on this one.
//
// One thing that suite cannot see is the reveal running at a width where the layout changes, so that is
// what is checked here: a phone. Groups that stack into a single column must still reveal, and nothing
// may be left hidden at a width where the stagger's row logic no longer describes the layout.
const narrowContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
const narrowPage = await narrowContext.newPage();
await narrowPage.goto(`${base}/vehicles/`, { waitUntil: "networkidle" });
await narrowPage.waitForTimeout(400);
report.motion.narrow = await narrowPage.evaluate(async () => {
  const marked = [...document.querySelectorAll("[data-reveal]")];
  const hiddenBefore = marked.filter((node) => Number(getComputedStyle(node).opacity) < 0.99).length;
  window.scrollTo(0, document.body.scrollHeight);
  await new Promise((done) => setTimeout(done, 1600));
  return {
    marked: marked.length,
    hiddenBefore,
    unresolved: marked.filter((node) => Number(getComputedStyle(node).opacity) < 0.99).length,
    noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
  };
});
const narrow = report.motion.narrow;
if (narrow.marked === 0) failures.push("Nothing was marked for reveal at 390px, so a phone sees no scroll motion");
if (narrow.hiddenBefore === 0) failures.push("Elements were marked at 390px but none was in its start state, so nothing will animate");
if (narrow.unresolved !== 0) failures.push(`${narrow.unresolved} elements are still hidden at 390px after scrolling to the foot of the page`);
if (!narrow.noHorizontalScroll) failures.push("The reveal's rise widened the document at 390px");
await narrowContext.close();

// V11-C. The specification groups, per photograph. The row totals are asserted in check-content;
// what is asserted here is the thing a visitor actually experiences, that no photograph carries one
// figure or nine, and that the premium treatment is really the stacked one and not the table.
report.interactions.specDistribution = {};
for (const [route, expected] of [
  ["/brawley/", [5, 6, 4, 6, 6, 5]],
  ["/santarosa/", [5, 4, 6, 5, 5]],
]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const shape = await page.evaluate(() => {
    const modules = [...document.querySelectorAll(".photo-module")];
    const first = document.querySelector(".photo-module__specs .spec-row");
    const label = first?.querySelector("span");
    const value = first?.querySelector("strong");
    return {
      perModule: modules.map((node) => node.querySelectorAll(".photo-module__specs .spec-row").length),
      // Stacked, not tabular: the label sits above the value, so their boxes do not overlap
      // vertically and the label is in the caps register.
      rowDisplay: first ? getComputedStyle(first).display : null,
      labelTransform: label ? getComputedStyle(label).textTransform : null,
      labelBottom: label ? Math.round(label.getBoundingClientRect().bottom) : null,
      valueTop: value ? Math.round(value.getBoundingClientRect().top) : null,
      valueSize: value ? Math.round(parseFloat(getComputedStyle(value).fontSize)) : null,
      labelSize: label ? Math.round(parseFloat(getComputedStyle(label).fontSize)) : null,
      // The GTS table is the one place that stays a table, and it is a different page.
      tables: document.querySelectorAll(".spec-table").length,
    };
  });
  report.interactions.specDistribution[route] = shape;
  if (JSON.stringify(shape.perModule) !== JSON.stringify(expected)) failures.push(`${route}: expected ${JSON.stringify(expected)} figures per photograph, found ${JSON.stringify(shape.perModule)}`);
  for (const count of shape.perModule) {
    if (count !== 0 && (count < 4 || count > 6)) failures.push(`${route}: a photograph carries ${count} figures, outside the four-to-six band`);
  }
  if (shape.rowDisplay !== "block") failures.push(`${route}: the paired specification rows are still laid out as a table (${shape.rowDisplay})`);
  if (shape.labelTransform !== "uppercase") failures.push(`${route}: the specification label is not in the caps register`);
  if (shape.labelBottom === null || shape.valueTop === null || shape.labelBottom > shape.valueTop) failures.push(`${route}: the specification label must sit above its value, not beside it`);
  if (!(shape.valueSize > shape.labelSize)) failures.push(`${route}: the value must take a larger step than its label, found ${shape.valueSize} against ${shape.labelSize}`);
  if (shape.tables !== 0) failures.push(`${route}: the reference table belongs on the purchase page alone`);
}
// The purchase page keeps the table treatment, which is the other half of the same claim.
await page.goto(`${base}/brawley/gts/`, { waitUntil: "networkidle" });
report.interactions.gtsRowsStayTabular = await page.evaluate(() => getComputedStyle(document.querySelector(".spec-table .spec-row")).display);
if (report.interactions.gtsRowsStayTabular !== "grid") failures.push(`The purchase page's reference table must stay a table, found ${report.interactions.gtsRowsStayTabular}`);

// V11-G asserted the owner group photographs sat centred against their lists; V16-I retires the
// photographs, so what is asserted now is that the library really is the plain list Owen asked
// for: no group renders a media column at this width either.
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${base}/owners/`, { waitUntil: "networkidle" });
report.interactions.ownerAlignment = await page.evaluate(() => ({
  mediaColumns: [...document.querySelectorAll(".resource-group")].filter((group) => getComputedStyle(group).gridTemplateColumns.trim().split(" ").length > 1).length,
  images: document.querySelectorAll(".resource-group img").length,
}));
if (report.interactions.ownerAlignment.mediaColumns !== 0 || report.interactions.ownerAlignment.images !== 0) {
  failures.push(`/owners/ still renders a photograph column: ${JSON.stringify(report.interactions.ownerAlignment)}`);
}

// V11-J. The pathway component is gone from the rendered page as well as from the markup.
report.interactions.pathwaysRetired = {};
for (const route of ["/", "/dealers/"]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  report.interactions.pathwaysRetired[route] = await page.evaluate(() => ({
    pathways: document.querySelectorAll(".pathways, .pathway").length,
    // Every destination those cards carried must still be one click away from here.
    reachable: ["/owners/", "/dealers/", "/recommend-dealer/", "/dealer-inquiry/", "/contact/", "/experience/"].filter((href) => document.querySelector(`a[href="${href}"]`)).length,
  }));
  const retired = report.interactions.pathwaysRetired[route];
  if (retired.pathways !== 0) failures.push(`${route}: ${retired.pathways} pathway cards survive`);
  if (retired.reachable !== 6) failures.push(`${route}: only ${retired.reachable} of the six required destinations are one click away`);
}
// V11-H. The dealers title.
await page.goto(`${base}/dealers/`, { waitUntil: "networkidle" });
report.interactions.dealersTitle = await page.locator("h1").innerText();
if (report.interactions.dealersTitle !== "Find a Vanderhall dealer.") failures.push(`The dealers title is ${report.interactions.dealersTitle}`);

// V11 amendment. The past-model tag sits beside the name rather than under it, on all four surfaces
// that carry one. Measured as boxes rather than read from the markup: what Owen asked for is that it
// stops taking a row of its own.
report.interactions.pastModelTag = {};
// V13-D: two surfaces, not four. The homepage no longer lists the past models and the Past Models group on
// /vehicles/ carries the status in its heading, so the tag survives only beside each detail page's h1.
for (const route of ["/carmel/", "/venice/"]) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  report.interactions.pastModelTag[route] = await page.evaluate(() => {
    const headline = [...document.querySelectorAll(".model-headline")].find((node) => node.querySelector(".model-tag"));
    if (!headline) return { found: false };
    const heading = headline.querySelector("h1, h2, h3");
    const tag = headline.querySelector(".model-tag");
    const headingRect = heading.getBoundingClientRect();
    const tagRect = tag.getBoundingClientRect();
    return {
      found: true,
      // Beside: the tag starts to the right of where the heading's text ends, and their boxes
      // overlap vertically rather than stacking.
      besideNotUnder: tagRect.left > headingRect.left && tagRect.top < headingRect.bottom,
      sharesRow: tagRect.top < headingRect.bottom && tagRect.bottom > headingRect.top,
    };
  });
  const tag = report.interactions.pastModelTag[route];
  if (!tag.found) failures.push(`${route}: no past-model tag was found to check`);
  else if (!tag.besideNotUnder || !tag.sharesRow) failures.push(`${route}: the past-model tag must sit beside the name, not under it: ${JSON.stringify(tag)}`);
}
await page.setViewportSize({ width: 1440, height: 1000 });

// V12-E. The site on a large monitor. Owen on 2026-08-06: it filled his MacBook Pro but not a bigger
// screen, and the cause was a 1440px max-width on .page that stopped the full-bleed elements along with
// everything else. The claim now has two halves and they pull in opposite directions, which is why both
// are measured: the photography spans the viewport, and the reading column does NOT. A change that
// satisfied only the first would give a 2560 monitor lines of text a metre wide.
report.wide = {};
for (const width of [1440, 2560]) {
  for (const route of ["/", "/brawley/", "/concepts/", "/dealers/", "/blog/", "/venice/", "/santarosa/launch-edition/"]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    const shape = await page.evaluate(() => {
      const pageEl = document.querySelector(".page");
      const bleed = document.querySelector(".page > .bleed");
      const content = [...document.querySelectorAll(".page > *:not(.bleed):not(.narrow)")].find((node) => node.getBoundingClientRect().width > 0);
      const contentRect = content?.getBoundingClientRect();
      const brand = document.querySelector(".site-header .brand")?.getBoundingClientRect();
      return {
        pageMaxWidth: getComputedStyle(pageEl).maxWidth,
        bleedWidth: bleed ? Math.round(bleed.getBoundingClientRect().width) : null,
        contentWidth: contentRect ? Math.round(contentRect.width) : null,
        // Centred: the space left of the content column equals the space to its right.
        contentOffset: contentRect ? Math.round(contentRect.left - (innerWidth - contentRect.right)) : null,
        // The header lockup and the content column must share a left edge, which is what the header's
        // width had to be re-anchored to --w-content for.
        brandToContent: brand && contentRect ? Math.round(brand.left - contentRect.left) : null,
        viewport: innerWidth,
        noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
      };
    });
    report.wide[`${width}${route}`] = shape;
    if (shape.pageMaxWidth !== "none") failures.push(`${route} at ${width}: .page is still capped at ${shape.pageMaxWidth}`);
    if (shape.bleedWidth !== null && Math.abs(shape.bleedWidth - shape.viewport) > 2) {
      failures.push(`${route} at ${width}: a full-bleed element is ${shape.bleedWidth}px wide in a ${shape.viewport}px viewport`);
    }
    if (shape.contentWidth !== null && shape.contentWidth > 1200) failures.push(`${route} at ${width}: the reading column is ${shape.contentWidth}px, wider than the 1200px measure`);
    if (shape.contentOffset !== null && Math.abs(shape.contentOffset) > 2) failures.push(`${route} at ${width}: the reading column is off centre by ${shape.contentOffset}px`);
    if (shape.brandToContent !== null && Math.abs(shape.brandToContent) > 2) failures.push(`${route} at ${width}: the header lockup is ${shape.brandToContent}px off the content column's left edge`);
    if (!shape.noHorizontalScroll) failures.push(`${route} at ${width}: the document scrolls horizontally`);
  }
}
// And the hero asks for the widest rung it has at 2560, rather than a rung it will upscale further.
await page.setViewportSize({ width: 2560, height: 1000 });
await page.goto(`${base}/brawley/`, { waitUntil: "networkidle" });
report.wide.heroRung = await page.evaluate(() => {
  const image = document.querySelector(".hero__image");
  return { currentSrc: new URL(image.currentSrc, location.origin).pathname, natural: image.naturalWidth, painted: Math.round(image.getBoundingClientRect().width) };
});
if (!report.wide.heroRung.currentSrc.includes("2560")) failures.push(`At 2560 the Brawley hero requested ${report.wide.heroRung.currentSrc} rather than its widest rung`);
await page.setViewportSize({ width: 1440, height: 1000 });

// ---------------------------------------------------------------------------------------------
// V13. The new page types, measured rather than asserted by class name.
// ---------------------------------------------------------------------------------------------
await page.setViewportSize({ width: 1440, height: 1000 });

// brandNaming. The Vanderhall-only rule, read off the rendered page rather than the markup: visible text, the
// title, the description, every accessible name in the accessibility tree's reach, the serialized JSON-LD, and
// the web manifest fetched as the browser would fetch it.
report.brandNaming = {};
for (const route of ["/", "/brawley/gts/", "/privacy/", "/experience/", "/dealers/"]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  report.brandNaming[route] = await page.evaluate(() => {
    const banned = /vanderhall\s+motor\s+works/i;
    const labels = [...document.querySelectorAll("[aria-label], [alt], [title]")]
      .flatMap((node) => [node.getAttribute("aria-label"), node.getAttribute("alt"), node.getAttribute("title")])
      .filter(Boolean);
    const schema = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => node.textContent).join(" ");
    return {
      title: document.title,
      inText: banned.test(document.body.innerText),
      inLabels: labels.filter((label) => banned.test(label)),
      inSchema: banned.test(schema),
      inMeta: banned.test(document.querySelector('meta[name="description"]')?.content || ""),
      copyright: [...document.querySelectorAll(".footer-legal span")].map((node) => node.textContent)[0],
      lockupAlt: document.querySelector(".footer-lockup")?.getAttribute("alt"),
    };
  });
  const brand = report.brandNaming[route];
  if (brand.inText || brand.inSchema || brand.inMeta || brand.inLabels.length) failures.push(`${route}: the retired brand name survives: ${JSON.stringify(brand)}`);
  if (!brand.title.endsWith(" | Vanderhall")) failures.push(`${route}: the title is ${brand.title}`);
  if (brand.copyright !== "© 2026 Vanderhall. Hand-built in Provo, Utah.") failures.push(`${route}: the footer line is ${brand.copyright}`);
  if (brand.lockupAlt !== "Vanderhall") failures.push(`${route}: the footer lockup alt is ${brand.lockupAlt}`);
}
const manifestResponse = await page.request.get(`${base}/site.webmanifest`);
report.brandNaming.manifest = await manifestResponse.json();
if (report.brandNaming.manifest.name !== "Vanderhall") failures.push(`The web manifest names the brand ${report.brandNaming.manifest.name}`);

// footerInquiryEmail. Visible, complete, focusable, and a plain mail link, at desktop and mobile widths and
// with JavaScript disabled. Opening a mail client is not attempted: the href is read, not followed.
report.footerInquiryEmail = {};
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of ["/", "/safety/"]) {
    await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    const shape = await page.evaluate(() => {
      const link = document.querySelector(".footer-email");
      if (!link) return { found: false };
      link.focus();
      const rect = link.getBoundingClientRect();
      const style = getComputedStyle(link);
      return {
        found: true,
        href: link.getAttribute("href"),
        visibleText: link.textContent.trim(),
        accessibleName: link.getAttribute("aria-label") || link.textContent.trim(),
        painted: rect.width > 0 && rect.height > 0,
        // Truncation would hide part of the address, which is exactly what Owen asked not to happen.
        notTruncated: link.scrollWidth <= link.clientWidth + 1,
        focused: document.activeElement === link,
        focusRing: getComputedStyle(link, ":focus-visible").outlineStyle,
        textOverflow: style.textOverflow,
      };
    });
    report.footerInquiryEmail[`${width}${route}`] = shape;
    if (!shape.found) failures.push(`${route} at ${width}: the footer inquiry email is missing`);
    else {
      if (shape.href !== "mailto:inquiry@vanderhall.com") failures.push(`${route} at ${width}: the mail href is ${shape.href}`);
      if (shape.visibleText !== "inquiry@vanderhall.com") failures.push(`${route} at ${width}: the visible address is ${shape.visibleText}`);
      if (!shape.accessibleName.includes("inquiry@vanderhall.com")) failures.push(`${route} at ${width}: the accessible name omits the address`);
      if (!shape.painted || !shape.notTruncated) failures.push(`${route} at ${width}: the address is not fully visible: ${JSON.stringify(shape)}`);
      if (!shape.focused) failures.push(`${route} at ${width}: the address is not keyboard focusable`);
    }
  }
}
await page.setViewportSize({ width: 1440, height: 1000 });

// homepageCampaignStatus. Brawley first, both statements read from the campaign data, and no public Reserve
// action while the phase is interest-open. V15-B: the band closes the page, centered, on the silver
// field, so the placement, the alignment, and the recomputed light ramp are all measured.
await page.goto(`${base}/`, { waitUntil: "networkidle" });
report.homepageCampaignStatus = await page.evaluate(() => {
  const band = document.querySelector(".campaign-band");
  if (!band) return { found: false };
  const items = [...band.querySelectorAll(".campaign-band__item")];
  const lineup = document.querySelector("#vehicles").getBoundingClientRect();
  const split = document.querySelector(".split--media-first").getBoundingClientRect();
  const bandRect = band.getBoundingClientRect();
  const bandStyle = getComputedStyle(band);
  const labelStyle = getComputedStyle(band.querySelector(".campaign-band__label"));
  const firstItem = items[0].getBoundingClientRect();
  return {
    found: true,
    items: items.length,
    labels: items.map((item) => item.querySelector(".campaign-band__label").textContent),
    actions: items.map((item) => item.querySelector("a").getAttribute("href")),
    actionLabels: items.map((item) => item.querySelector("a").textContent.trim()),
    // DOM order and visual order agree, which is what the mobile requirement reduces to.
    domOrder: items.map((item) => item.querySelector(".campaign-band__label").textContent.split(" ")[0]),
    afterLineup: bandRect.top >= lineup.bottom - 2,
    afterSplit: bandRect.top >= split.bottom - 2,
    lastOnPage: !band.nextElementSibling && band.closest(".page") && !band.closest(".page").nextElementSibling?.matches("section"),
    // The silver field: a light background with dark ink, measured as computed values rather than
    // trusted from the stylesheet, and full bleed at the viewport width.
    lightField: bandStyle.backgroundImage.includes("linear-gradient"),
    inkIsDark: labelStyle.color.match(/\d+/g).slice(0, 3).map(Number).every((channel) => channel < 64),
    fullBleed: Math.round(bandRect.width) >= innerWidth - 1,
    centered: getComputedStyle(items[0]).textAlign === "center" && Math.abs((firstItem.left + firstItem.width / 2) < innerWidth ? 0 : 1) === 0,
    h1: document.querySelector("h1").textContent,
    // No alert-bar behaviour: nothing to dismiss, no timer, no modal.
    dismissers: document.querySelectorAll(".campaign-band [data-dismiss], .campaign-band button").length,
  };
});
const campaign = report.homepageCampaignStatus;
if (!campaign.found) failures.push("The homepage campaign status band is missing");
else {
  if (campaign.items !== 2) failures.push(`The status band carries ${campaign.items} items`);
  if (campaign.domOrder[0] !== "Brawley" || campaign.domOrder[1] !== "Santarosa") failures.push(`The status band order is ${campaign.domOrder.join(", ")}`);
  if (campaign.labels[0] !== "Brawley deliveries are underway.") failures.push(`The Brawley status reads ${campaign.labels[0]}`);
  if (campaign.labels[1] !== "Santarosa Launch Edition registration of interest is open.") failures.push(`The Santarosa status reads ${campaign.labels[1]}`);
  if (JSON.stringify(campaign.actions) !== JSON.stringify(["/brawley/", "/santarosa/launch-edition/"])) failures.push(`The status band actions are ${campaign.actions.join(", ")}`);
  if (campaign.actionLabels.some((label) => label.startsWith("Reserve"))) failures.push("The status band offers a Reserve action outside a verified public-reservation phase");
  if (!campaign.afterLineup || !campaign.afterSplit) failures.push("The status band must close the homepage, after the lineup and the concepts split");
  if (!campaign.lightField || !campaign.inkIsDark) failures.push(`The status band must render as dark ink on the silver field: ${JSON.stringify({ lightField: campaign.lightField, inkIsDark: campaign.inkIsDark })}`);
  if (!campaign.fullBleed) failures.push("The status band must run the full viewport width");
  if (!campaign.centered) failures.push("The status band items must be centered");
  if (campaign.h1 !== "Handcrafted electric vehicles.") failures.push(`The campaign band changed the homepage h1 to ${campaign.h1}`);
  if (campaign.dismissers !== 0) failures.push("The status band must carry no dismiss control or timer");
}
// And the same band at 390, where Brawley must still be first both in the DOM and on the screen.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/`, { waitUntil: "networkidle" });
report.homepageCampaignStatus.mobile = await page.evaluate(() => {
  const items = [...document.querySelectorAll(".campaign-band__item")];
  return { tops: items.map((item) => Math.round(item.getBoundingClientRect().top)), labels: items.map((item) => item.querySelector(".campaign-band__label").textContent.split(" ")[0]) };
});
const bandMobile = report.homepageCampaignStatus.mobile;
if (bandMobile.labels[0] !== "Brawley" || bandMobile.tops[0] > bandMobile.tops[1]) failures.push(`At 390px the status band must keep Brawley first: ${JSON.stringify(bandMobile)}`);
await page.setViewportSize({ width: 1440, height: 1000 });

// pastModelGrouping and pastModelGalleries. The group is quieter than the lineup and the galleries publish no
// figure at all, which is the whole point of the conversion.
await page.goto(`${base}/vehicles/`, { waitUntil: "networkidle" });
report.pastModelGrouping = await page.evaluate(() => {
  const group = document.querySelector("#past-models");
  const sections = [...document.querySelectorAll(".vehicle-section")];
  return {
    currentSections: sections.length,
    currentLinks: sections.map((section) => section.querySelector("a[href]").getAttribute("href")),
    groupHeading: group?.querySelector("h2")?.textContent,
    cards: group ? group.querySelectorAll(".past-card").length : 0,
    imagesPerCard: group ? [...group.querySelectorAll(".past-card")].map((card) => card.querySelectorAll("img").length) : [],
    pillsInGroup: group ? group.querySelectorAll(".model-tag").length : 0,
    terrainPillsInGroup: group ? group.querySelectorAll(".model-tag--terrain").length : 0,
    // Quieter, measured: a compact card's title must take a smaller step than a lineup section's name.
    // V18: the model name sits at h3 under the family group h2s.
    cardTitleSize: group ? Math.round(parseFloat(getComputedStyle(group.querySelector(".past-card__title")).fontSize)) : 0,
    sectionTitleSize: Math.round(parseFloat(getComputedStyle(sections[0].querySelector("h3")).fontSize)),
    // V18: the three family headings, in order, all painted.
    familyHeadings: [...document.querySelectorAll(".section-heading--group h2")].map((heading) => ({
      text: heading.textContent,
      painted: heading.getClientRects().length > 0,
    })),
    groupAfterLineup: group && sections.length ? group.getBoundingClientRect().top > sections.at(-1).getBoundingClientRect().top : false,
  };
});
const grouping = report.pastModelGrouping;
if (grouping.currentSections !== 2) failures.push(`/vehicles/ must present two current-model sections, found ${grouping.currentSections}`);
if (JSON.stringify(grouping.currentLinks) !== JSON.stringify(["/brawley/", "/santarosa/"])) failures.push(`/vehicles/ current sections are ${grouping.currentLinks.join(", ")}`);
if (grouping.groupHeading !== "Vanderhall Legacy Vehicles") failures.push(`The legacy group heading is ${grouping.groupHeading}`);
if (JSON.stringify(grouping.familyHeadings.map((heading) => heading.text)) !== JSON.stringify(["Vanderhall Off-Road", "Vanderhall On-Road", "Vanderhall Legacy Vehicles"])) failures.push(`/vehicles/ family headings are ${JSON.stringify(grouping.familyHeadings)}`);
if (grouping.familyHeadings.some((heading) => !heading.painted)) failures.push("A /vehicles/ family heading is not painted");
if (grouping.cards !== 2 || JSON.stringify(grouping.imagesPerCard) !== JSON.stringify([1, 1])) failures.push(`The past-model group must be two one-image cards: ${JSON.stringify(grouping)}`);
if (grouping.pillsInGroup !== 2 || grouping.terrainPillsInGroup !== 2) failures.push(`The legacy group must carry one On-Road terrain pill per card and no status pill, found ${grouping.pillsInGroup} pills of which ${grouping.terrainPillsInGroup} terrain`);
if (!(grouping.cardTitleSize < grouping.sectionTitleSize)) failures.push(`A past-model card's title (${grouping.cardTitleSize}px) must be quieter than a current section's (${grouping.sectionTitleSize}px)`);
if (!grouping.groupAfterLineup) failures.push("The past-model group must follow the current lineup");

// homepageLineup. V15-C kept all four models on the homepage, current first. V18 groups them under
// the three family headings, puts the terrain pill beside each current model's name, and drops the
// legacy pill from the lineup: the legacy group's heading says it now.
await page.goto(`${base}/`, { waitUntil: "networkidle" });
report.homepageLineup = await page.evaluate(() => {
  const sections = [...document.querySelectorAll(".vehicle-section")];
  return {
    count: sections.length,
    order: sections.map((section) => section.querySelector("a[href]").getAttribute("href")),
    tags: sections.map((section) => section.querySelectorAll(".model-tag").length),
    pillTexts: sections.map((section) => section.querySelector(".model-tag")?.textContent ?? null),
    tagsVisible: sections.map((section) => section.querySelector(".model-tag")?.checkVisibility() ?? null),
    familyHeadings: [...document.querySelectorAll("#vehicles .section-heading--group h3")].map((heading) => ({
      text: heading.textContent,
      painted: heading.getClientRects().length > 0,
    })),
    quietLink: [...document.querySelectorAll("a")].filter((anchor) => (anchor.getAttribute("href") || "").includes("#past-models")).length,
  };
});
const homepageLineup = report.homepageLineup;
if (homepageLineup.count !== 4) failures.push(`The homepage must present four vehicle sections, found ${homepageLineup.count}`);
if (JSON.stringify(homepageLineup.order) !== JSON.stringify(["/brawley/", "/santarosa/", "/carmel/", "/venice/"])) failures.push(`The homepage lineup order is ${homepageLineup.order.join(", ")}`);
if (JSON.stringify(homepageLineup.tags) !== JSON.stringify([1, 1, 1, 1])) failures.push(`Every homepage lineup section must carry exactly one terrain pill: ${JSON.stringify(homepageLineup.tags)}`);
if (JSON.stringify(homepageLineup.pillTexts) !== JSON.stringify(["Off-Road", "On-Road", "On-Road", "On-Road"])) failures.push(`The homepage pills must read Off-Road beside Brawley and On-Road beside the three roadsters: ${JSON.stringify(homepageLineup.pillTexts)}`);
if (homepageLineup.tagsVisible.some((visible) => visible !== true)) failures.push("A homepage terrain pill is not visible");
if (JSON.stringify(homepageLineup.familyHeadings.map((heading) => heading.text)) !== JSON.stringify(["Vanderhall Off-Road", "Vanderhall On-Road", "Vanderhall Legacy Vehicles"])) failures.push(`The homepage family headings are ${JSON.stringify(homepageLineup.familyHeadings)}`);
if (homepageLineup.familyHeadings.some((heading) => !heading.painted)) failures.push("A homepage family heading is not painted");
if (homepageLineup.quietLink !== 0) failures.push("The retired quiet past-models link remains on the homepage");

report.pastModelGalleries = {};
for (const route of ["/carmel/", "/venice/"]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await loadLazyMedia(page);
  const shape = await page.evaluate(() => ({
    frames: document.querySelectorAll(".photo-gallery__figure").length,
    captions: [...document.querySelectorAll(".photo-gallery__caption")].map((node) => node.textContent.trim()).filter(Boolean).length,
    // Responsive: every frame offers a srcset and none is upscaled past its natural width.
    responsive: [...document.querySelectorAll(".photo-gallery__figure img")].filter((image) => image.srcset).length,
    upscaled: [...document.querySelectorAll(".photo-gallery__figure img")].filter((image) => image.naturalWidth && image.getBoundingClientRect().width > image.naturalWidth + 1).length,
    // The absences. A gallery must publish no figure, no price, no warranty, and no purchase action, and it
    // must not have become a carousel.
    specRows: document.querySelectorAll(".spec-row").length,
    specTables: document.querySelectorAll(".spec-table").length,
    specNotes: document.querySelectorAll(".spec-note").length,
    footnotes: document.querySelectorAll(".fn-ref, .footnote").length,
    prices: document.querySelectorAll(".price").length,
    walkarounds: document.querySelectorAll("[data-walkaround]").length,
    tag: document.querySelectorAll(".hero__content .model-tag").length,
    inventory: document.querySelector(".page > .section--tight.narrow .lede")?.textContent.trim(),
    dealerAction: [...document.querySelectorAll("a")].filter((anchor) => anchor.getAttribute("href") === "/dealers/" && anchor.closest(".page")).length,
    bodyText: document.body.innerText,
    noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
  }));
  report.pastModelGalleries[route] = { ...shape, bodyText: undefined };
  if (shape.frames !== 6 || shape.captions !== 6) failures.push(`${route} must present six captioned gallery frames, found ${shape.frames} and ${shape.captions}`);
  if (shape.responsive !== 6) failures.push(`${route} has ${6 - shape.responsive} gallery frames with no srcset`);
  if (shape.upscaled !== 0) failures.push(`${route} upscales ${shape.upscaled} gallery frames`);
  if (shape.specRows || shape.specTables || shape.specNotes || shape.footnotes) failures.push(`${route} still publishes specification markup: ${JSON.stringify(shape)}`);
  if (shape.prices || shape.walkarounds) failures.push(`${route} must carry no price and no walkaround`);
  if (shape.tag !== 1) failures.push(`${route} must carry one Legacy model tag beside its h1, found ${shape.tag}`);
  if (!shape.inventory?.includes("Availability is not guaranteed.")) failures.push(`${route} must state that availability is not guaranteed, found ${shape.inventory}`);
  if (shape.dealerAction === 0) failures.push(`${route} must offer a way to the dealer network`);
  if (/\b\d[\d,.]*\s*(?:hp|lb-ft|in\b|lb\b)/.test(shape.bodyText)) failures.push(`${route} gallery page renders an engineering figure`);
  if (!shape.noHorizontalScroll) failures.push(`${route} scrolls horizontally`);
}

// footnoteNavigation. Both jumps, at both widths, with focus surviving and the destination clear of the
// sticky header.
report.footnoteNavigation = {};
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of ["/brawley/", "/brawley/gts/", "/santarosa/launch-edition/"]) {
    await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    const shape = await page.evaluate(() => {
      const refs = [...document.querySelectorAll(".fn-ref a")];
      const notes = [...document.querySelectorAll(".footnote")];
      const symbols = refs.map((ref) => ref.textContent.trim());
      const ids = notes.map((note) => note.id);
      return {
        refs: refs.length,
        notes: notes.length,
        // Deterministic first-use order: the first distinct symbol seen is one star, the second is two.
        firstUseOrder: [...new Set(symbols)],
        // Every reference resolves to a note on this page, and no note ID is shared.
        unresolved: refs.filter((ref) => !ids.includes(ref.getAttribute("href").slice(1))).length,
        duplicateIds: ids.length - new Set(ids).size,
        labelled: refs.filter((ref) => /^Footnote \d+$/.test(ref.getAttribute("aria-label") || "")).length,
        glyphsHidden: refs.filter((ref) => ref.querySelector("span[aria-hidden='true']")).length,
        backLinks: notes.filter((note) => note.querySelector(".footnote__back")?.getAttribute("href")?.startsWith("#fnref-")).length,
        headerHeight: Math.round(document.querySelector(".site-header").getBoundingClientRect().height),
      };
    });
    // The forward jump, driven by the keyboard, then the jump back.
    const firstRef = page.locator(".fn-ref a").first();
    const noteId = (await firstRef.getAttribute("href")).slice(1);
    await firstRef.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const forward = await page.evaluate((id) => {
      const note = document.getElementById(id);
      const rect = note.getBoundingClientRect();
      const header = document.querySelector(".site-header").getBoundingClientRect();
      return {
        focused: document.activeElement === note,
        // Not obscured by the sticky header, which is what the scroll-margin is for.
        clearOfHeader: rect.top >= header.bottom - 1,
        visible: rect.top >= 0 && rect.top < innerHeight,
      };
    }, noteId);
    await page.locator(`#${noteId} .footnote__back`).press("Enter");
    await page.waitForTimeout(400);
    const backward = await page.evaluate(() => {
      const active = document.activeElement;
      const rect = active?.getBoundingClientRect();
      const header = document.querySelector(".site-header").getBoundingClientRect();
      return {
        onReference: Boolean(active?.closest(".fn-ref")),
        clearOfHeader: rect ? rect.top >= header.bottom - 1 : false,
        focusVisible: active ? getComputedStyle(active).outlineStyle !== "none" || active.matches(":focus-visible") : false,
      };
    });
    report.footnoteNavigation[`${width}${route}`] = { ...shape, forward, backward };
    if (shape.refs === 0 || shape.notes === 0) failures.push(`${route} at ${width}: no footnote to navigate`);
    if (shape.unresolved !== 0) failures.push(`${route} at ${width}: ${shape.unresolved} references resolve to no note`);
    if (shape.duplicateIds !== 0) failures.push(`${route} at ${width}: two notes share one DOM id`);
    if (shape.labelled !== shape.refs || shape.glyphsHidden !== shape.refs) failures.push(`${route} at ${width}: ${shape.refs - shape.labelled} marks reach assistive technology unlabelled`);
    if (shape.backLinks !== shape.notes) failures.push(`${route} at ${width}: a note has no link back to its reference`);
    if (shape.firstUseOrder[0] !== "*" || (shape.firstUseOrder[1] && shape.firstUseOrder[1] !== "**")) failures.push(`${route} at ${width}: symbols are not assigned in first-use order: ${shape.firstUseOrder.join(", ")}`);
    if (shape.firstUseOrder.some((symbol) => symbol.length > 3)) failures.push(`${route} at ${width}: a fourth asterisk was rendered`);
    if (!forward.focused || !forward.clearOfHeader) failures.push(`${route} at ${width}: the forward jump failed: ${JSON.stringify(forward)}`);
    if (!backward.onReference || !backward.clearOfHeader) failures.push(`${route} at ${width}: the jump back failed: ${JSON.stringify(backward)}`);
  }
}
await page.setViewportSize({ width: 1440, height: 1000 });

// dealerLocator, dealerMapFailure and dealerMobileMode. The list is what has to work, and with no key that is
// exactly the state under test: no map, no spinner, and every dealer reachable.
await page.goto(`${base}/dealers/`, { waitUntil: "networkidle" });
report.dealerLocator = await page.evaluate(() => {
  const cards = [...document.querySelectorAll(".dealer-card")];
  return {
    cards: cards.length,
    visible: cards.filter((card) => card.checkVisibility()).length,
    // Every card carries the facts that matter without a hover or a click.
    complete: cards.filter((card) => card.querySelector(".dealer-card__address") && card.querySelector('a[href^="tel:"]') && [...card.querySelectorAll("a")].some((anchor) => anchor.href.includes("google.com/maps/dir"))).length,
    searchVisible: document.querySelector("[data-locator-search]").checkVisibility(),
    // V16-E: the retired mode switch must not come back under either of its selectors.
    modeMarkup: document.querySelectorAll("[data-locator-modes], [data-locator-mode]").length,
    selectButtons: [...document.querySelectorAll("[data-dealer-select]")].filter((button) => button.checkVisibility()).length,
    count: document.querySelector("[data-locator-count]").textContent,
    filters: [...document.querySelectorAll("[name='capability']")].map((radio) => radio.value),
    noResultsHidden: document.querySelector("[data-locator-state='no-results']").hidden,
  };
});
const locator = report.dealerLocator;
if (locator.cards !== 6 || locator.visible !== 6) failures.push(`/dealers/ must render six visible dealer cards, found ${locator.cards} and ${locator.visible}`);
if (locator.complete !== 6) failures.push(`${6 - locator.complete} dealer cards are missing an address, a telephone number, or directions`);
if (!locator.searchVisible || locator.modeMarkup !== 0 || locator.selectButtons !== 6) failures.push(`The locator controls are not rendered: ${JSON.stringify(locator)}`);
if (JSON.stringify(locator.filters) !== JSON.stringify(["all", "ev", "gas", "service"])) failures.push(`The locator filters are ${locator.filters.join(", ")}`);
if (!locator.noResultsHidden) failures.push("The locator shows its no-results state with six results");

// Each filter, then a search that matches nothing.
report.dealerLocator.filtering = {};
for (const [value, expected] of [["ev", 5], ["gas", 4], ["service", 4], ["all", 6]]) {
  await page.locator(`[name='capability'][value='${value}']`).check();
  await page.waitForTimeout(120);
  const shape = await page.evaluate(() => ({
    visible: [...document.querySelectorAll(".dealer-card")].filter((card) => !card.hidden).length,
    count: document.querySelector("[data-locator-count]").textContent,
  }));
  report.dealerLocator.filtering[value] = shape;
  if (shape.visible !== expected) failures.push(`The ${value} filter shows ${shape.visible} dealers, expected ${expected}`);
  if (!shape.count.startsWith(String(expected))) failures.push(`The result count reads ${shape.count} for ${shape.visible} visible dealers`);
}
await page.locator("#locator-location").fill("Provo");
await page.locator("[data-locator-search] button[type='submit']").click();
await page.waitForTimeout(200);
report.dealerLocator.textSearch = await page.evaluate(() => ({
  visible: [...document.querySelectorAll(".dealer-card")].filter((card) => !card.hidden).length,
  first: document.querySelector(".dealer-card:not([hidden]) .dealer-card__name")?.textContent,
}));
if (report.dealerLocator.textSearch.visible !== 1 || !report.dealerLocator.textSearch.first?.includes("Wasatch")) {
  failures.push(`A city search did not narrow the list: ${JSON.stringify(report.dealerLocator.textSearch)}`);
}
await page.locator("#locator-location").fill("Nowheresville");
await page.locator("[data-locator-search] button[type='submit']").click();
await page.waitForTimeout(200);
report.dealerLocator.noResults = await page.evaluate(() => {
  const empty = document.querySelector("[data-locator-state='no-results']");
  return {
    visible: [...document.querySelectorAll(".dealer-card")].filter((card) => !card.hidden).length,
    shown: !empty.hidden,
    // The two ways out, which a locator that finds nothing must still offer.
    links: [...empty.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href")),
  };
});
const empty = report.dealerLocator.noResults;
if (empty.visible !== 0 || !empty.shown) failures.push(`The no-results state did not appear: ${JSON.stringify(empty)}`);
if (!empty.links.includes("/recommend-dealer/") || !empty.links.includes("/contact/")) failures.push(`The no-results state must lead to Recommend a dealer and Contact, found ${empty.links.join(", ")}`);
// Clear restores the whole list.
await page.locator("[data-locator-reset]").click();
await page.waitForTimeout(200);
report.dealerLocator.afterReset = await page.evaluate(() => [...document.querySelectorAll(".dealer-card")].filter((card) => !card.hidden).length);
if (report.dealerLocator.afterReset !== 6) failures.push(`Clearing the search must restore all six dealers, found ${report.dealerLocator.afterReset}`);

// dealerIllustrativeMap. No key is configured in this build, so this is the live state rather than a
// simulation: the panel shows the illustrative SVG map with one pin per dealer, no Google script is
// requested, and the list stays fully usable beside it. V15-E replaces the one-sentence fallback.
report.dealerIllustrativeMap = await page.evaluate(() => ({
  fallbackVisible: !document.querySelector("[data-locator-map-fallback]").hidden,
  artVisible: document.querySelector(".locator__map-art")?.checkVisibility(),
  pins: document.querySelectorAll("[data-dealer-pin]").length,
  labels: [...document.querySelectorAll(".map-pin__label")].map((node) => node.textContent),
  accessibleName: document.querySelector(".locator__map-art")?.getAttribute("aria-label") || "",
  keyAttribute: document.querySelector("[data-locator]").getAttribute("data-map-key"),
  googleScripts: [...document.querySelectorAll("script")].filter((node) => (node.src || "").includes("maps.googleapis.com")).length,
  searchStillWorks: !document.querySelector("[data-locator-search]").hidden,
  cardsStillVisible: [...document.querySelectorAll(".dealer-card")].filter((card) => !card.hidden).length,
}));
const mapFailure = report.dealerIllustrativeMap;
if (!mapFailure.fallbackVisible || !mapFailure.artVisible) failures.push(`The illustrative map must be visible with no key: ${JSON.stringify({ fallbackVisible: mapFailure.fallbackVisible, artVisible: mapFailure.artVisible })}`);
if (mapFailure.pins !== 6) failures.push(`The illustrative map must carry six pins, found ${mapFailure.pins}`);
if (!mapFailure.accessibleName.startsWith("Illustrative map")) failures.push(`The map must name itself illustrative, found ${JSON.stringify(mapFailure.accessibleName)}`);
if (mapFailure.keyAttribute) failures.push("A Google Maps key reached the rendered page");
if (mapFailure.googleScripts !== 0) failures.push(`${mapFailure.googleScripts} Google Maps scripts were requested with no key configured`);
if (!mapFailure.searchStillWorks || mapFailure.cardsStillVisible !== 6) failures.push("The illustrative map must leave the whole dealer list usable");
// The pins follow the list. Show on map selects a pin; filtering dims the pins the list dropped.
await page.locator("[data-dealer-select]").first().click();
await page.waitForTimeout(200);
report.dealerIllustrativeMap.selection = await page.evaluate(() => ({
  selected: [...document.querySelectorAll(".map-pin.is-selected")].map((pin) => pin.dataset.dealerPin),
  cardSelected: document.querySelector(".dealer-card.is-selected")?.dataset.dealer,
}));
const pinSelection = report.dealerIllustrativeMap.selection;
if (pinSelection.selected.length !== 1 || pinSelection.selected[0] !== pinSelection.cardSelected) {
  failures.push(`Show on map must highlight exactly the selected dealer's pin: ${JSON.stringify(pinSelection)}`);
}
await page.locator("[name='capability'][value='service']").check();
await page.waitForTimeout(200);
report.dealerIllustrativeMap.filteredPins = await page.evaluate(() => ({
  visibleCards: [...document.querySelectorAll(".dealer-card")].filter((card) => !card.hidden).length,
  dimmedPins: document.querySelectorAll(".map-pin.is-dimmed").length,
  totalPins: document.querySelectorAll(".map-pin").length,
}));
const filteredPins = report.dealerIllustrativeMap.filteredPins;
if (filteredPins.visibleCards + filteredPins.dimmedPins !== filteredPins.totalPins) {
  failures.push(`Filtered-out dealers must dim their pins: ${JSON.stringify(filteredPins)}`);
}
await page.locator("[data-locator-reset]").click();
await page.waitForTimeout(200);
// And no location permission was ever requested. Asserted by overriding the API and proving it is never called.
const permissionContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await permissionContext.addInitScript(() => {
  window.__geolocationCalls = 0;
  Object.defineProperty(navigator, "geolocation", { configurable: true, get: () => ({ getCurrentPosition: () => { window.__geolocationCalls += 1; }, watchPosition: () => { window.__geolocationCalls += 1; } }) });
});
const permissionPage = await permissionContext.newPage();
await permissionPage.goto(`${base}/dealers/`, { waitUntil: "networkidle" });
await permissionPage.waitForTimeout(600);
report.dealerLocator.geolocationCalls = await permissionPage.evaluate(() => window.__geolocationCalls);
if (report.dealerLocator.geolocationCalls !== 0) failures.push(`The locator requested the visitor's location ${report.dealerLocator.geolocationCalls} times on load`);
await permissionContext.close();

// dealerMobileStack. V16-E: no mode switch at any width. Below 1024px both panes stack with the
// map first, every dealer stays visible, and nothing about the retired switch survives.
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/dealers/`, { waitUntil: "networkidle" });
report.dealerMobileStack = await page.evaluate(() => {
  const map = document.querySelector(".locator__map");
  const list = document.querySelector(".locator__list");
  return {
    listVisible: list.checkVisibility(),
    mapVisible: map.checkVisibility(),
    mapAboveList: map.getBoundingClientRect().top < list.getBoundingClientRect().top,
    fallbackVisible: !document.querySelector("[data-locator-map-fallback]").hidden,
    cards: [...document.querySelectorAll(".dealer-card")].filter((card) => card.checkVisibility()).length,
    modeButtons: document.querySelectorAll("[data-locator-modes], [data-locator-mode]").length,
    modeAttribute: document.querySelector("[data-locator-panes]").dataset.mode ?? null,
    noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
  };
});
const mobileStack = report.dealerMobileStack;
if (!mobileStack.listVisible || !mobileStack.mapVisible || !mobileStack.mapAboveList) failures.push(`Both panes must stack map-first below 1024px: ${JSON.stringify(mobileStack)}`);
if (!mobileStack.fallbackVisible) failures.push("The stacked map must show the honest fallback with no key configured");
if (mobileStack.cards !== 6) failures.push(`A phone must see all six dealers, found ${mobileStack.cards}`);
if (mobileStack.modeButtons !== 0 || mobileStack.modeAttribute !== null) failures.push(`The retired mode switch survives: ${JSON.stringify(mobileStack)}`);
if (!mobileStack.noHorizontalScroll) failures.push("The locator widened the document at 390px");
await page.setViewportSize({ width: 1440, height: 1000 });

// dealerMapCamera. V16-F: the illustrative map zooms and pans by viewBox. The controls are revealed
// by the island, zooming in narrows the view while the pins counter-scale to a constant on-screen
// size, zooming all the way out is clamped to the whole world, and Fit restores the opening view.
await page.goto(`${base}/dealers/`, { waitUntil: "networkidle" });
report.dealerMapCamera = await page.evaluate(() => {
  const art = document.querySelector(".locator__map-art");
  return {
    controlsVisible: !document.querySelector("[data-map-controls]").hidden,
    viewBox: art.getAttribute("viewBox"),
    fit: art.dataset.mapFit,
    world: art.dataset.mapWorld,
    landPaths: document.querySelectorAll(".map-land").length,
    borderPaths: document.querySelectorAll(".map-borders").length,
    labelsOpen: art.classList.contains("map-art--labels"),
  };
});
const camera = report.dealerMapCamera;
if (!camera.controlsVisible) failures.push("The map's zoom controls were not revealed by the island");
if (camera.viewBox !== camera.fit) failures.push(`The map must open on its fitted view: ${camera.viewBox} vs ${camera.fit}`);
if (camera.landPaths !== 1 || camera.borderPaths !== 1) failures.push(`The world base must be two paths, found ${camera.landPaths} land and ${camera.borderPaths} borders`);
if (!camera.labelsOpen) failures.push("Six pins must carry open labels at the fitted view");
const pinScreenSize = () => page.evaluate(() => document.querySelector("[data-dealer-pin] .map-pin__dot").getBoundingClientRect().width);
const sizeAtFit = await pinScreenSize();
await page.locator("[data-map-zoom='in']").click();
await page.waitForTimeout(100);
report.dealerMapCamera.zoomedIn = await page.evaluate(() => ({
  width: Number(document.querySelector(".locator__map-art").getAttribute("viewBox").split(" ")[2]),
  fitWidth: Number(document.querySelector(".locator__map-art").dataset.mapFit.split(" ")[2]),
}));
if (report.dealerMapCamera.zoomedIn.width >= report.dealerMapCamera.zoomedIn.fitWidth) failures.push("Zoom in did not narrow the viewBox");
const sizeZoomed = await pinScreenSize();
if (Math.abs(sizeZoomed - sizeAtFit) > 1) failures.push(`Pins must hold their on-screen size through zoom: ${sizeAtFit}px became ${sizeZoomed}px`);
for (let i = 0; i < 8; i += 1) await page.locator("[data-map-zoom='out']").click();
await page.waitForTimeout(100);
report.dealerMapCamera.world = await page.evaluate(() => ({
  width: Number(document.querySelector(".locator__map-art").getAttribute("viewBox").split(" ")[2]),
  worldWidth: Number(document.querySelector(".locator__map-art").dataset.mapWorld.split(" ")[2]),
  outDisabled: document.querySelector("[data-map-zoom='out']").disabled,
  labelsOpen: document.querySelector(".locator__map-art").classList.contains("map-art--labels"),
}));
const worldView = report.dealerMapCamera.world;
if (worldView.width !== worldView.worldWidth || !worldView.outDisabled) failures.push(`Zoom out must clamp to the whole world and say so: ${JSON.stringify(worldView)}`);
if (worldView.labelsOpen) failures.push("City labels must close at the world view");
await page.locator("[data-map-zoom='fit']").click();
await page.waitForTimeout(100);
report.dealerMapCamera.afterFit = await page.evaluate(() => {
  const art = document.querySelector(".locator__map-art");
  return { viewBox: art.getAttribute("viewBox"), fit: art.dataset.mapFit };
});
if (report.dealerMapCamera.afterFit.viewBox !== report.dealerMapCamera.afterFit.fit) failures.push(`Fit must restore the opening view: ${JSON.stringify(report.dealerMapCamera.afterFit)}`);

// experienceHub. One feed of real stories, no BLOG framing, no category kickers, no archive door,
// and none of the event placeholders Q-V13-18 forbids.
await page.goto(`${base}/experience/`, { waitUntil: "networkidle" });
report.experienceHub = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    h1: document.querySelector("h1").textContent,
    modules: document.querySelectorAll(".experience-module").length,
    heading: document.querySelector(".experience-module h2")?.textContent,
    blogEyebrow: [...document.querySelectorAll(".experience-module .eyebrow")].filter((node) => node.textContent === "BLOG").length,
    kickers: document.querySelectorAll(".post-card__category").length,
    featured: document.querySelectorAll(".post-card--featured").length,
    cards: document.querySelectorAll(".post-card").length,
    titles: [...document.querySelectorAll(".post-card__title")].map((node) => node.textContent.trim()),
    linked: document.querySelectorAll(".post-card__link").length,
    archive: [...document.querySelectorAll("a")].find((anchor) => anchor.textContent.includes("View all stories"))?.getAttribute("href") || null,
    eventHeadings: [...document.querySelectorAll("h2, h3")].filter((node) => /^events$/i.test(node.textContent.trim())).length,
    comingSoon: /coming soon/i.test(text),
    registration: [...document.querySelectorAll("button, a")].filter((node) => /register now|rsvp/i.test(node.textContent)).length,
    eventSchema: [...document.querySelectorAll('script[type="application/ld+json"]')].filter((node) => /"@type"\s*:\s*"Event/.test(node.textContent)).length,
    sampleMarker: document.querySelectorAll(".sample-note, .sample-tag").length,
    navCurrent: document.querySelector('.desktop-nav a[aria-current="page"]')?.textContent,
  };
});
const hub = report.experienceHub;
if (hub.h1 !== "The Vanderhall experience.") failures.push(`The Experience h1 is ${hub.h1}`);
if (hub.modules !== 1 || hub.heading !== "Latest from Vanderhall.") failures.push(`The hub must present one feed headed Latest from Vanderhall: ${JSON.stringify({ modules: hub.modules, heading: hub.heading })}`);
if (hub.blogEyebrow !== 0) failures.push("The hub still carries the retired BLOG eyebrow");
if (hub.kickers !== 0) failures.push("A hub card still prints its category kicker");
if (hub.featured !== 1 || hub.cards !== 2 || hub.linked !== 2) failures.push(`The hub must present the two real stories, both linked, one featured: ${JSON.stringify({ featured: hub.featured, cards: hub.cards, linked: hub.linked })}`);
if (!hub.titles[0]?.startsWith("What Is a Side-by-Side?")) failures.push(`The November article must lead the feed, found ${hub.titles[0]}`);
if (hub.archive !== null) failures.push(`The retired archive action remains, leading to ${hub.archive}`);
if (hub.eventHeadings || hub.comingSoon || hub.registration || hub.eventSchema) failures.push(`The hub renders event placeholders: ${JSON.stringify(hub)}`);
if (hub.sampleMarker !== 0) failures.push("The hub still carries a retired sample marker");
if (hub.navCurrent !== "Experience") failures.push(`Experience must be the current primary section, found ${hub.navCurrent}`);

// editorialTemplates. The archive, the two real articles, and no WordPress furniture. V15, folding
// in V14: complete migrated records under their original dates, safe inline links in the body, one
// BlogPosting schema per article, and the other story as related reading.
report.editorialTemplates = {};
await page.goto(`${base}/blog/`, { waitUntil: "networkidle" });
report.editorialTemplates["/blog/"] = await page.evaluate(() => ({
  cards: document.querySelectorAll(".post-card").length,
  linked: document.querySelectorAll(".post-card__link").length,
  pending: document.querySelectorAll(".post-card__pending").length,
  kickers: document.querySelectorAll(".post-card__category").length,
  dates: [...document.querySelectorAll(".post-meta time")].map((node) => node.getAttribute("datetime")),
  furniture: ["Leave a comment", "Posted in", "Read more"].filter((token) => document.body.innerText.includes(token)),
}));
const archive = report.editorialTemplates["/blog/"];
if (archive.cards !== 2 || archive.linked !== 2 || archive.pending !== 0) failures.push(`The archive must show the two migrated articles, both linked: ${JSON.stringify(archive)}`);
if (archive.kickers !== 0) failures.push("An archive card still prints its category kicker");
if (!archive.dates.includes("2025-11-12") || !archive.dates.includes("2025-10-25")) failures.push(`The archive must print the original publication dates, found ${archive.dates.join(", ")}`);
if (archive.furniture.length) failures.push(`Legacy blog furniture remains: ${archive.furniture.join(", ")}`);
for (const route of articleRoutes) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const shape = await page.evaluate(() => ({
    standfirst: Boolean(document.querySelector(".article-header__standfirst")?.textContent.trim()),
    author: document.querySelector(".post-meta__author")?.textContent.trim(),
    published: document.querySelectorAll(".post-meta time").length,
    hero: document.querySelector(".article-hero img")?.naturalWidth > 0,
    // Long-form copy takes the narrow measure, which is the rule the policy page already follows.
    measure: Math.round(document.querySelector(".prose p").getBoundingClientRect().width),
    blocks: document.querySelectorAll(".prose > *").length,
    inlineLinks: [...document.querySelectorAll(".prose a")].map((anchor) => anchor.getAttribute("href")),
    related: document.querySelectorAll(".related .post-card").length,
    cta: [...document.querySelectorAll(".page a")].filter((anchor) => anchor.getAttribute("href") === "/contact/").length,
    unescaped: document.querySelector(".prose").innerHTML.includes("<script"),
    blogPosting: [...document.querySelectorAll('script[type="application/ld+json"]')].filter((node) => /"@type"\s*:\s*"BlogPosting"/.test(node.textContent)).length,
  }));
  report.editorialTemplates[route] = shape;
  if (!shape.standfirst || shape.author !== "Vanderhall USA" || shape.published === 0) failures.push(`${route} article header is incomplete: ${JSON.stringify(shape)}`);
  if (!shape.hero) failures.push(`${route} must render its source hero image`);
  if (shape.measure > 820) failures.push(`${route} sets its body to ${shape.measure}px, wider than the narrow measure`);
  if (shape.blocks < 10) failures.push(`${route} rendered ${shape.blocks} body blocks; the complete article did not arrive`);
  if (!shape.inlineLinks.length || shape.inlineLinks.some((href) => !/^(\/|https:\/\/)/.test(href))) failures.push(`${route} inline links are missing or unsafe: ${shape.inlineLinks.join(", ")}`);
  if (shape.related !== 1) failures.push(`${route} must end on the other story as related reading, found ${shape.related}`);
  if (shape.cta === 0) failures.push(`${route} must offer a way to contact Vanderhall`);
  if (shape.unescaped) failures.push(`${route} article body contains raw markup`);
  if (shape.blogPosting !== 1) failures.push(`${route} must carry one BlogPosting schema, found ${shape.blogPosting}`);
}

// careersStates and safetyStates. Records, long titles, absent optional fields, and the disabled apply action.
report.careersStates = await (async () => {
  await page.goto(`${base}/careers/`, { waitUntil: "networkidle" });
  const index = await page.evaluate(() => ({
    cards: document.querySelectorAll(".record-card").length,
    linked: document.querySelectorAll(".record-card__title a").length,
    // V15-F: no compensation renders anywhere (no fixture invents a range any more), no sample tags,
    // and the word Sample appears nowhere on the page.
    factCounts: [...document.querySelectorAll(".record-card")].map((card) => card.querySelectorAll(".fact-row li").length),
    sampleTags: document.querySelectorAll(".sample-tag, .sample-note").length,
    saysSample: /\bsample\b/i.test(document.body.innerText),
    livePostings: ["Paralegal", "Welding Operator"].filter((title) => document.body.innerText.includes(title)),
  }));
  await page.goto(`${base}/careers/assembly-technician/`, { waitUntil: "networkidle" });
  const detail = await page.evaluate(() => ({
    sections: document.querySelectorAll(".record-section").length,
    applyDisabled: document.querySelector(".apply-disabled button")?.disabled,
    applyDescribed: Boolean(document.querySelector(".apply-disabled button")?.getAttribute("aria-describedby")),
    applyNote: document.querySelector("#apply-note")?.textContent.trim(),
    forms: document.querySelectorAll("form").length,
    schemaBlocks: document.querySelectorAll('script[type="application/ld+json"]').length,
  }));
  return { index, detail };
})();
const careers = report.careersStates;
if (careers.index.cards !== 3 || careers.index.linked !== 2) failures.push(`/careers/ must list three openings with two detail pages: ${JSON.stringify(careers.index)}`);
if (careers.index.factCounts.some((count) => count !== 4)) failures.push(`/careers/ cards must carry the four fact fields and no invented compensation: ${JSON.stringify(careers.index.factCounts)}`);
if (careers.index.sampleTags !== 0 || careers.index.saysSample) failures.push("/careers/ still carries retired sample language");
if (careers.index.livePostings.length) failures.push(`/careers/ copies live postings: ${careers.index.livePostings.join(", ")}`);
if (careers.detail.sections < 3) failures.push(`A job detail page rendered ${careers.detail.sections} sections`);
if (!careers.detail.applyDisabled || !careers.detail.applyDescribed) failures.push("The apply action must be disabled and say why");
if (careers.detail.applyNote !== "Applications for this role are not open yet.") failures.push(`The apply note reads ${JSON.stringify(careers.detail.applyNote)}`);
if (careers.detail.forms !== 0) failures.push("A prototype job page must collect no applicant data");
if (careers.detail.schemaBlocks !== 0) failures.push("A fictional job record must emit no JobPosting schema");

// safetyStates. V17-B: the real notices. Three cards, newest first, each opening a detail page; still
// no absence claim in either direction; the official portal still reachable, because these records are
// a transcription and the portal is the live document.
//
// The V15 assertion that no card exists and the ban on the live notices' subject words are both gone.
// They existed to keep a FICTIONAL recall off this page, and what is here now is the real thing.
report.safetyStates = await (async () => {
  await page.goto(`${base}/safety/`, { waitUntil: "networkidle" });
  return await page.evaluate(() => ({
    h1: document.querySelector("h1").textContent,
    cards: document.querySelectorAll(".record-card--notice").length,
    ids: [...document.querySelectorAll(".record-card--notice")].map((card) => card.querySelector("dd")?.textContent.trim()),
    linkedCards: [...document.querySelectorAll(".record-card--notice")].filter((card) => card.querySelector('a[href^="/safety/sn-"]')).length,
    forbiddenClaim: /no active recalls|no current notices|no notices/i.test(document.body.innerText),
    republished: document.body.innerText.includes("Republished from Vanderhall's official safety notices portal, read on"),
    portalAction: [...document.querySelectorAll("a.button")].filter((anchor) => (anchor.getAttribute("href") || "").includes("portal.vanderhallusa.com")).length,
    contactAction: [...document.querySelectorAll(".page a")].filter((anchor) => anchor.getAttribute("href") === "/contact/").length,
    sampleLanguage: /\bsample\b/i.test(document.body.innerText),
    schemaBlocks: document.querySelectorAll('script[type="application/ld+json"]').length,
  }));
})();
const safety = report.safetyStates;
if (safety.h1 !== "Safety notices") failures.push(`The safety page h1 is ${safety.h1}`);
if (safety.cards !== 3) failures.push(`/safety/ must publish the three real notices, found ${safety.cards}`);
if (JSON.stringify(safety.ids) !== JSON.stringify(["SN-00003", "SN-00001", "SN-00002"])) failures.push(`/safety/ lists notices out of posted order: ${safety.ids.join(", ")}`);
if (safety.linkedCards !== 3) failures.push(`/safety/ must open a detail page from every card, found ${safety.linkedCards}`);
if (safety.forbiddenClaim) failures.push("/safety/ must not claim an absence of notices: only the authoritative system can determine that");
if (!safety.republished) failures.push("/safety/ must say where its notices were republished from and when");
if (safety.portalAction === 0) failures.push("/safety/ must keep the official portal reachable");
if (safety.contactAction === 0) failures.push("/safety/ must offer a way to Contact");
if (safety.sampleLanguage) failures.push("/safety/ still carries retired sample language");
if (safety.schemaBlocks !== 0) failures.push("/safety/ must emit no structured data");

// safetyNoticeDetail. What a visitor under stress has to be able to do on a recall page: read the
// facts without opening anything, read the notice itself, reach the authoritative copy, and reach a
// human. And what the page must not do: ask them for anything.
report.safetyNoticeDetail = {};
for (const [route, sourceUrl] of [["/safety/sn-00003/", "https://portal.vanderhallusa.com/safety_notices/3"], ["/safety/sn-00001/", "https://portal.vanderhallusa.com/safety_notices/1"], ["/safety/sn-00002/", "https://portal.vanderhallusa.com/safety_notices/2"]]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const shape = await page.evaluate((expectedSource) => ({
    headings: document.querySelectorAll("h1").length,
    facts: document.querySelectorAll(".notice-facts--detail dt").length,
    proseBlocks: document.querySelectorAll(".prose > *").length,
    sourceLink: [...document.querySelectorAll("a")].filter((anchor) => anchor.getAttribute("href") === expectedSource).length,
    republished: document.body.innerText.includes("Republished from Vanderhall's official safety notices portal, read on"),
    forms: document.querySelectorAll("[data-site-form]").length,
    backHref: document.querySelector(".back-nav a")?.getAttribute("href"),
  }), sourceUrl);
  report.safetyNoticeDetail[route] = shape;
  if (shape.headings !== 1) failures.push(`${route}: expected one title, found ${shape.headings}`);
  if (shape.facts < 6) failures.push(`${route}: the notice facts are incomplete, found ${shape.facts}`);
  if (shape.proseBlocks < 5) failures.push(`${route}: the notice body did not render, found ${shape.proseBlocks} blocks`);
  if (!shape.sourceLink) failures.push(`${route}: must link to its portal copy at ${sourceUrl}`);
  if (!shape.republished) failures.push(`${route}: must say where it was republished from and when`);
  if (shape.forms) failures.push(`${route}: a safety notice must collect nothing`);
  if (shape.backHref !== "/safety/") failures.push(`${route}: the way back must lead to /safety/, found ${shape.backHref}`);
}

// privacyDocument. The reading experience changed and the copy did not.
report.privacyDocument = {};
for (const width of [390, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${base}/privacy/`, { waitUntil: "networkidle" });
  const shape = await page.evaluate(() => {
    const desktop = document.querySelector(".policy-toc__desktop");
    const mobile = document.querySelector(".policy-toc__mobile");
    const links = [...document.querySelectorAll(".policy-toc__list a")];
    return {
      navs: document.querySelectorAll(".policy-toc").length,
      desktopVisible: desktop ? desktop.checkVisibility() : false,
      mobileVisible: mobile ? mobile.checkVisibility() : false,
      mobileOpenByDefault: mobile ? mobile.hasAttribute("open") : false,
      entries: links.length,
      unresolved: links.filter((anchor) => !document.querySelector(anchor.getAttribute("href").replace("#", "#"))).length,
      prototypeLabel: document.body.innerText.includes("Prototype policy structure."),
      verbatimAnchor: document.body.innerText.includes("This privacy policy has been compiled to better serve"),
      dates: [...document.querySelectorAll(".policy-header__meta dt")].map((node) => node.textContent),
      sections: document.querySelectorAll(".policy__section").length,
      measure: Math.round(document.querySelector(".policy p").getBoundingClientRect().width),
      noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
    };
  });
  report.privacyDocument[width] = shape;
  if (shape.navs !== 1) failures.push(`/privacy/ at ${width}: expected one contents nav, found ${shape.navs}`);
  if (shape.unresolved !== 0) failures.push(`/privacy/ at ${width}: ${shape.unresolved} contents entries resolve to nothing`);
  if (shape.entries === 0) failures.push(`/privacy/ at ${width}: the contents list is empty`);
  // V15-F: the visible label is retired; the verbatim copy itself must still be present in full.
  if (shape.prototypeLabel) failures.push(`/privacy/ at ${width}: the retired prototype label remains`);
  if (!shape.verbatimAnchor) failures.push(`/privacy/ at ${width}: Vanderhall's verbatim policy text is missing`);
  if (shape.dates.includes("Effective") || shape.dates.includes("Last updated")) failures.push(`/privacy/ at ${width}: a policy date was invented`);
  if (shape.sections !== 13) failures.push(`/privacy/ at ${width}: renders ${shape.sections} sections`);
  if (!shape.noHorizontalScroll) failures.push(`/privacy/ widened the document at ${width}px`);
  if (width >= 1024 && (!shape.desktopVisible || shape.mobileVisible)) failures.push(`/privacy/ at ${width}: the desktop contents column must be the visible one`);
  if (width < 1024 && (shape.desktopVisible || !shape.mobileVisible)) failures.push(`/privacy/ at ${width}: the mobile disclosure must be the visible one`);
  if (width < 1024 && shape.mobileOpenByDefault) failures.push(`/privacy/ at ${width}: the contents disclosure must start closed`);
}
await page.setViewportSize({ width: 1440, height: 1000 });
// The contents actually navigate, and the destination clears the sticky header.
await page.goto(`${base}/privacy/`, { waitUntil: "networkidle" });
const tocTarget = await page.locator(".policy-toc__desktop .policy-toc__list a").nth(3).getAttribute("href");
await page.locator(".policy-toc__desktop .policy-toc__list a").nth(3).click();
await page.waitForTimeout(500);
report.privacyDocument.navigation = await page.evaluate((target) => {
  const section = document.querySelector(target);
  const rect = section.getBoundingClientRect();
  const header = document.querySelector(".site-header").getBoundingClientRect();
  return { landed: rect.top >= header.bottom - 2 && rect.top < innerHeight, top: Math.round(rect.top), headerBottom: Math.round(header.bottom) };
}, tocTarget);
if (!report.privacyDocument.navigation.landed) failures.push(`A contents entry did not land clear of the sticky header: ${JSON.stringify(report.privacyDocument.navigation)}`);

// santarosaLaunchEdition and launchInterestForm.
report.santarosaLaunchEdition = {};
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${base}/santarosa/launch-edition/`, { waitUntil: "networkidle" });
  const shape = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      h1: document.querySelector("h1").textContent,
      market: document.querySelector(".launch-market")?.textContent,
      highlights: document.querySelectorAll(".launch-highlights li").length,
      battery: [...document.querySelectorAll(".launch-highlights li")].find((item) => item.textContent.includes("40 kWh"))?.querySelector(".fn-ref") !== null,
      priority: [...document.querySelectorAll(".launch-priority li")].map((item) => item.textContent.trim().split(" ")[0]),
      delivery: text.includes("expected to begin during the fourth quarter of 2026"),
      state: document.querySelector(".launch-state")?.textContent,
      reserveActions: [...document.querySelectorAll("a, button")].filter((node) => /^reserve/i.test(node.textContent.trim())).length,
      disclaims: text.includes("Registering your interest does not create a reservation"),
      banned: ["MSRP", "deposit", "150 mi", "300 mi", "180 hp"].filter((token) => text.includes(token)),
      consentCheckboxes: document.querySelectorAll("input[type='checkbox']").length,
      noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1,
      schemaBlocks: document.querySelectorAll('script[type="application/ld+json"]').length,
      backLink: document.querySelector(".back-nav a")?.getAttribute("href"),
    };
  });
  report.santarosaLaunchEdition[width] = shape;
  if (shape.h1 !== "Be Among the First.") failures.push(`The Launch Edition h1 is ${shape.h1} at ${width}`);
  if (shape.market !== "United States only") failures.push(`The market qualifier is ${shape.market} at ${width}`);
  if (shape.highlights !== 10) failures.push(`The Launch Edition must list ten highlights, found ${shape.highlights} at ${width}`);
  if (!shape.battery) failures.push(`The 40 kWh figure must carry a footnote mark at ${width}`);
  if (JSON.stringify(shape.priority) !== JSON.stringify(["Existing", "Authorized", "Public"])) failures.push(`The priority order is ${shape.priority.join(", ")} at ${width}`);
  if (!shape.delivery) failures.push(`The Q4 2026 delivery statement is missing or reworded at ${width}`);
  if (shape.reserveActions) failures.push(`A Reserve action appeared while the campaign is interest-open, at ${width}`);
  if (!shape.disclaims) failures.push(`The page must state what registering does not do, at ${width}`);
  if (shape.banned.length) failures.push(`The Launch Edition publishes ${shape.banned.join(", ")} at ${width}`);
  if (shape.consentCheckboxes) failures.push(`A consent checkbox appeared without approved wording, at ${width}`);
  if (!shape.noHorizontalScroll) failures.push(`The Launch Edition widened the document at ${width}px`);
  if (shape.schemaBlocks !== 0) failures.push(`The Launch Edition must emit no Product or Offer schema, found ${shape.schemaBlocks} blocks at ${width}`);
  if (shape.backLink !== "/santarosa/") failures.push(`The Launch Edition back link leads to ${shape.backLink}`);
}
await page.setViewportSize({ width: 1440, height: 1000 });

// launchInterestForm. All eight fields required, errors announced, values preserved, and nothing transmitted.
await page.goto(`${base}/santarosa/launch-edition/`, { waitUntil: "networkidle" });
const launchRequests = [];
page.on("request", (request) => { if (request.method() === "POST") launchRequests.push(request.url()); });
const launchForm = page.locator("#santarosa-launch-interest-form");
await launchForm.locator("[name='render_timestamp']").evaluate((input) => { input.value = String(Date.now() - 3000); });
await launchForm.getByRole("button", { name: "Register your interest" }).click();
report.launchInterestForm = await page.evaluate(() => ({
  requiredControls: document.querySelectorAll("#santarosa-launch-interest-form [required]").length,
  invalid: document.querySelectorAll("#santarosa-launch-interest-form [aria-invalid='true']").length,
  summaryVisible: !document.querySelector("#santarosa-launch-interest-form .form-error-summary").hidden,
  summaryFocused: document.activeElement?.classList.contains("form-error-summary"),
  summaryItems: document.querySelectorAll("#santarosa-launch-interest-form .form-error-summary li").length,
}));
const launch = report.launchInterestForm;
if (launch.requiredControls !== 8) failures.push(`The Launch Edition form must require all eight fields, found ${launch.requiredControls}`);
if (launch.invalid !== 8 || launch.summaryItems !== 8) failures.push(`An empty submit must flag all eight fields: ${JSON.stringify(launch)}`);
if (!launch.summaryVisible || !launch.summaryFocused) failures.push(`The Launch Edition error summary must appear and take focus: ${JSON.stringify(launch)}`);
// An invalid email is caught by type rather than by pattern, and the entered values survive.
await launchForm.getByLabel(/^First name/).fill("Test");
await launchForm.getByLabel(/^Last name/).fill("Visitor");
await launchForm.getByLabel(/^Address/).fill("1 Test Street");
await launchForm.getByLabel(/^City/).fill("Provo");
await launchForm.getByLabel(/^State/).selectOption("UT");
await launchForm.getByLabel(/^ZIP/).fill("84601");
await launchForm.getByLabel(/^Phone/).fill("5550100");
await launchForm.getByLabel(/^Email/).fill("not-an-email");
await launchForm.locator("[name='render_timestamp']").evaluate((input) => { input.value = String(Date.now() - 3000); });
await launchForm.getByRole("button", { name: "Register your interest" }).click();
report.launchInterestForm.invalidEmail = await page.evaluate(() => ({
  flagged: document.querySelector("#santarosa-launch-interest-form-email").getAttribute("aria-invalid"),
  preserved: document.querySelector("#santarosa-launch-interest-form-first").value,
  state: document.querySelector("#santarosa-launch-interest-form-state").value,
}));
const invalidEmail = report.launchInterestForm.invalidEmail;
if (invalidEmail.flagged !== "true") failures.push("An invalid email must be flagged on the Launch Edition form");
if (invalidEmail.preserved !== "Test" || invalidEmail.state !== "UT") failures.push(`Validation cleared entered values: ${JSON.stringify(invalidEmail)}`);
await launchForm.getByLabel(/^Email/).fill("test@example.com");
await launchForm.locator("[name='render_timestamp']").evaluate((input) => { input.value = String(Date.now() - 3000); });
await launchForm.getByRole("button", { name: "Register your interest" }).click();
report.launchInterestForm.result = await launchForm.locator(".form-status").innerText();
report.launchInterestForm.posted = launchRequests.length;
if (report.launchInterestForm.result !== "Online submissions are not open yet. Email inquiry@vanderhall.com and the team will follow up.") failures.push(`The Launch Edition prototype result reads ${report.launchInterestForm.result}`);
if (launchRequests.length) failures.push(`The Launch Edition prototype transmitted ${launchRequests.length} requests`);

// ownerManualAccess. Reached from the footer, every file still where it was, and nothing about the manuals
// changed except the order and the title.
report.ownerManualAccess = {};
for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  const footerLink = page.locator('.footer-links a[href="/owners/"]');
  await footerLink.scrollIntoViewIfNeeded();
  await footerLink.click();
  await page.waitForLoadState("networkidle");
  const shape = await page.evaluate(() => ({
    landed: location.pathname,
    h1: document.querySelector("h1").textContent,
    groups: [...document.querySelectorAll(".resource-group")].map((group) => group.id),
    cards: document.querySelectorAll(".resource-card").length,
    pdfs: [...document.querySelectorAll(".resource-card")].filter((card) => card.getAttribute("type") === "application/pdf").length,
    sizes: [...document.querySelectorAll(".resource-card__meta")].filter((meta) => /PDF · \d/.test(meta.textContent)).length,
    hrefs: [...document.querySelectorAll(".resource-card")].map((card) => card.getAttribute("href")),
    images: document.querySelectorAll(".resource-group img").length,
  }));
  report.ownerManualAccess[width] = shape;
  if (shape.landed !== "/owners/") failures.push(`The footer Owner manuals link landed on ${shape.landed} at ${width}`);
  if (shape.h1 !== "Owner manuals.") failures.push(`The manual library title is ${shape.h1} at ${width}`);
  if (JSON.stringify(shape.groups) !== JSON.stringify(["brawley", "venice", "carmel", "speedster", "laguna"])) failures.push(`The manual groups run ${shape.groups.join(", ")} at ${width}`);
  if (shape.cards !== 19 || shape.pdfs !== 19 || shape.sizes !== 19) failures.push(`All 19 manuals must keep their PDF type and size label: ${JSON.stringify(shape)}`);
  // V16-I: the library is a plain list at every width.
  if (shape.images !== 0) failures.push(`No manual group may carry photography, found ${shape.images} at ${width}`);
  if (shape.hrefs.some((href) => !href.startsWith("/assets/manuals/"))) failures.push("A manual URL moved");
}
await page.setViewportSize({ width: 1440, height: 1000 });

// mockProductionGuard. The noindex set and the negative test: a production build must refuse to run
// while the blockers are open. V15-F retires the visible markers, so the marker assertion inverts:
// no route may render one, and the mock routes' remaining public safeguard is the noindex below.
// /experience/ and /blog/ left the set with their fictional records.
report.mockProductionGuard = { routes: {} };
for (const route of ["/dealers/", "/careers/", "/safety/", "/santarosa/launch-edition/"]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const shape = await page.evaluate(() => ({
    sampleMarkers: document.querySelectorAll(".sample-note, .sample-tag").length,
    robots: document.querySelector('meta[name="robots"]')?.content ?? null,
  }));
  report.mockProductionGuard.routes[route] = shape;
  if (shape.sampleMarkers !== 0) failures.push(`${route}: a retired sample marker is still rendered`);
  if (shape.robots !== "noindex, follow") failures.push(`${route}: a mock-data route must not be indexable, found ${shape.robots}`);
}
for (const route of ["/", "/brawley/", "/contact/", "/privacy/", "/owners/", "/experience/", "/blog/", ...articleRoutes]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const robots = await page.evaluate(() => document.querySelector('meta[name="robots"]')?.content ?? null);
  report.mockProductionGuard.routes[route] = { robots };
  if (robots) failures.push(`${route}: this route carries no fictional record and must stay indexable, found ${robots}`);
}
const robotsTxt = await (await page.request.get(`${base}/robots.txt`)).text();
report.mockProductionGuard.robotsTxt = robotsTxt.trim();
if (!robotsTxt.includes("Allow: /") || robotsTxt.includes("Disallow")) failures.push(`robots.txt must keep crawling allowed so the per-route noindex can be read: ${robotsTxt.trim()}`);
// The gate itself, run as a real build. This is the negative test the plan asks for: it must fail, and the
// output must name the blockers.
report.mockProductionGuard.productionBuild = await new Promise((done) => {
  execFile("node", [resolve(root, "src/build.mjs")], { cwd: root, env: { ...process.env, VHW_MODE: "production" } }, (error, stdout, stderr) => {
    done({ failed: Boolean(error), namesBlockers: /production blockers|blockers are open/i.test(`${stdout}${stderr}`), output: `${stderr}`.slice(0, 400) });
  });
});
const guard = report.mockProductionGuard.productionBuild;
if (!guard.failed) failures.push("A production build succeeded while mock records and null endpoints are still live");
if (!guard.namesBlockers) failures.push(`The production gate failed without naming the blockers: ${guard.output}`);

report.consoleErrors = [...new Set(report.consoleErrors)];
if (report.consoleErrors.length) failures.push(`Console errors: ${report.consoleErrors.join(" | ")}`);
report.failures = failures;
await writeFile(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
await context.close();
await browser.close();

console.log(JSON.stringify({ failures, routes: report.routes.map((route) => ({ route: route.route, status: route.status, height: route.pageHeight })) }, null, 2));
if (failures.length) process.exit(1);
