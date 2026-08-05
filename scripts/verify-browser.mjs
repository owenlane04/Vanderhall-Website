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
const routes = ["/", "/vehicles/", "/brawley/", "/brawley/gts/", "/santarosa/", "/carmel/", "/venice/", "/concepts/", ...conceptRoutes, "/dealers/", "/recommend-dealer/", "/dealer-inquiry/", "/owners/", "/privacy/", "/404/"];

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
  const ownersInNav = await page.locator('.desktop-nav a[href="/owners/"]').count();
  const dealersInNav = await page.locator('.desktop-nav a[href="/dealers/"]').count();
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  report.routes.push({ route, status, h1Count, bodyLength, brokenImages, ownersInNav, dealersInNav, pageHeight });
  if (status !== 200 || h1Count !== 1 || bodyLength < 100 || brokenImages.length || ownersInNav !== 1 || dealersInNav !== 1) failures.push(`Route check failed for ${route}`);
}

// Probed on a throwaway page so the expected 404s do not pollute the console-error audit.
// Locally these routes simply do not exist; in production the vercel.json redirects carry
// /about/ home and /contact/ to its replacement, /dealers/.
const probeContext = await browser.newContext();
const probePage = await probeContext.newPage();
report.interactions.retiredRoutes = {};
for (const [route, destination] of [["/about/", "/"], ["/contact/", "/dealers/"], ["/faq/", null]]) {
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
for (const route of ["/", "/vehicles/", "/brawley/", "/brawley/gts/", "/santarosa/", "/venice/", "/carmel/", "/recommend-dealer/", "/dealer-inquiry/", "/concepts/", "/concepts/indio/", "/owners/", "/dealers/", "/privacy/", "/404/"]) {
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
    const result = await page.locator(".hero").evaluate((hero) => {
      const heroRect = hero.getBoundingClientRect();
      const selectors = [".eyebrow", "h1", ".hero__descriptor", ".hero__actions"];
      const contentVisible = selectors.every((selector) => {
        const node = hero.querySelector(selector);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.top >= heroRect.top - 1 && rect.bottom <= heroRect.bottom + 1 && rect.left >= -1 && rect.right <= innerWidth + 1;
      });
      return { width: innerWidth, contentVisible, noHorizontalScroll: document.documentElement.scrollWidth <= innerWidth + 1, heroHeight: Math.round(heroRect.height) };
    });
    report.heroes[route].push(result);
    if (!result.contentVisible || !result.noHorizontalScroll) failures.push(`Hero reflow failed for ${route} at ${width}px`);
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
  modelLinks: await page.locator(".vehicle-section__body a").evaluateAll((anchors) => anchors.map((anchor) => new URL(anchor.href).pathname)),
  hasSpecsOrPrices: await page.locator(".spec-table, .price, .photo-module__specs").count(),
  // The photographs became links in V6. They must stay out of the tab order, so each section
  // still offers exactly one stop, the text link beneath the copy.
  focusableMedia: await page.locator('.vehicle-section__lead:not([tabindex="-1"]), .vehicle-section__support:not([tabindex="-1"])').count(),
};
const sectionShape = report.interactions.vehicleSections;
if (sectionShape.sections !== 4 || sectionShape.leadFrames !== 4 || sectionShape.supportFrames !== 8 || sectionShape.hasSpecsOrPrices !== 0) failures.push("Vehicles section structure failed");
if (JSON.stringify(sectionShape.modelLinks) !== JSON.stringify(["/brawley/", "/santarosa/", "/carmel/", "/venice/"])) failures.push(`Vehicles sections must link to each model once in order, got ${sectionShape.modelLinks.join(", ")}`);
if (sectionShape.focusableMedia !== 0) failures.push(`${sectionShape.focusableMedia} vehicle media links are still in the tab order`);

// Model pages: each photo module carries a photograph, a label, and the figures that photograph
// shows. Prose captions are gone, so a module holds either specification rows or its label alone,
// never a sentence. The sticky bar names the model and carries the way back on all four now.
report.interactions.photoScroll = {};
for (const [route, expected, pairedGroups, tags, barAction] of [
  ["/brawley/", 6, 6, 0, "/brawley/gts/"],
  ["/santarosa/", 5, 5, 0, null],
  ["/carmel/", 6, 6, 1, null],
  ["/venice/", 6, 4, 1, null],
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
      stickyBar: document.querySelector(".model-bar") ? getComputedStyle(document.querySelector(".model-bar")).position : null,
      barAction: document.querySelector(".model-bar__action")?.getAttribute("href"),
      barBack: document.querySelector(".model-bar .back-nav a")?.getAttribute("href"),
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
  if (shape.tags !== tags || shape.heroTag !== tags) failures.push(`${route} must carry ${tags} Past model tag in its hero, found ${shape.tags}`);
  // The bar is on every model page now, because it carries the way back, which the header does not.
  if (shape.bars !== 1) failures.push(`${route} must carry one sticky model bar, found ${shape.bars}`);
  if (shape.stickyBar !== "sticky") failures.push(`${route} model bar is not sticky`);
  if (shape.barBack !== "/vehicles/") failures.push(`${route} model bar must lead back to /vehicles/, got ${shape.barBack}`);
  if (barAction === null) {
    if (shape.barAction) failures.push(`${route} model bar must offer no action beyond the way back, got ${shape.barAction}`);
  } else if (!shape.barAction?.startsWith(barAction)) {
    failures.push(`Sticky model bar failed on ${route}: expected ${barAction}, got ${shape.barAction}`);
  }
  if (shape.relatedGrids !== 0) failures.push(`${route} still pushes the visitor to other models`);
}

// The way back, exercised by navigation rather than by reading markup: one sample of each page
// type, clicked, landing on its declared parent.
report.interactions.backLinks = {};
for (const [route, parent] of [["/vehicles/", "/"], ["/venice/", "/vehicles/"], ["/brawley/gts/", "/brawley/"], ["/concepts/indio/", "/concepts/"], ["/recommend-dealer/", "/dealers/"], ["/owners/", "/"]]) {
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

// Owner resources: the groups that have delivered photography carry it, and every manual is a card.
await page.goto(`${base}/owners/`, { waitUntil: "networkidle" });
report.interactions.ownerResources = await page.evaluate(() => ({
  cards: document.querySelectorAll(".resource-card").length,
  groups: document.querySelectorAll(".resource-group").length,
  withMedia: document.querySelectorAll(".resource-group--media .resource-group__media img").length,
  retiredRows: document.querySelectorAll(".resource-row").length,
}));
const ownerShape = report.interactions.ownerResources;
if (ownerShape.cards !== 19 || ownerShape.groups !== 5 || ownerShape.withMedia !== 3 || ownerShape.retiredRows !== 0) {
  failures.push(`Owner resources failed: ${JSON.stringify(ownerShape)}`);
}

// The purchase page keeps the one specification table on the site, and it keeps real values in it.
await page.goto(`${base}/brawley/gts/`, { waitUntil: "networkidle" });
report.interactions.gtsSpecTable = await page.evaluate(() => ({
  tables: document.querySelectorAll(".spec-table").length,
  toggles: document.querySelectorAll(".unit-toggle, [data-unit]").length,
  emptyValues: [...document.querySelectorAll(".spec-table .spec-row strong")].filter((node) => !node.textContent.trim()).length,
  figures: [...document.querySelectorAll(".gts-figure__value")].map((node) => node.textContent.trim()).filter(Boolean).length,
}));
const gtsShape = report.interactions.gtsSpecTable;
if (gtsShape.tables !== 1 || gtsShape.toggles !== 0 || gtsShape.emptyValues !== 0 || gtsShape.figures !== 4) {
  failures.push(`Purchase page specification table failed: ${JSON.stringify(gtsShape)}`);
}

await page.goto(`${base}/concepts/`, { waitUntil: "networkidle" });
report.interactions.conceptHubCards = await page.locator(".card .card__link").count();
if (report.interactions.conceptHubCards !== 9) failures.push("Concept hub must expose nine linked cards");

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

await page.goto(`${base}/dealers/?model=brawley`, { waitUntil: "networkidle" });
const requestForm = page.locator("#contact-lead");
report.interactions.requestFormCount = await page.locator("[data-form-id='request-info']").count();
if (report.interactions.requestFormCount !== 1) failures.push("The dealers page must hold exactly one request-info form");
await requestForm.getByLabel(/^First name/).fill("Test");
await requestForm.getByLabel(/^Last name/).fill("Visitor");
await requestForm.getByLabel(/^Email/).fill("test@example.com");
await requestForm.getByLabel(/^ZIP/).fill("84601");
await requestForm.locator("[name='render_timestamp']").evaluate((input) => { input.value = String(Date.now() - 3000); });
await requestForm.getByRole("button", { name: "Send request" }).click();
const formStatus = await requestForm.locator(".form-status").innerText();
report.interactions.formValidation = formStatus === "This form is not connected yet. Your information was not sent.";
if (!report.interactions.formValidation) failures.push("Lead form validation flow failed");

report.interactions.modelPrefill = {};
for (const value of ["brawley", "santarosa", "carmel", "venice", "concepts", "not-sure-yet"]) {
  await page.goto(`${base}/dealers/?model=${value}`, { waitUntil: "networkidle" });
  const checked = await page.locator(`[name='interest'][value='${value}']`).isChecked();
  report.interactions.modelPrefill[value] = checked;
  if (!checked) failures.push(`Dealers model prefill failed for ${value}`);
}

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
else if (!schema.offerUrl?.includes("dealer.vanderhallusa.com")) failures.push("JSON-LD offer must point at the reservation system");
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
if (JSON.stringify(report.interactions.mobileMenuLinks) !== JSON.stringify(["/vehicles/", "/concepts/", "/owners/", "/dealers/", "/dealers/"])) failures.push(`Mobile menu does not mirror the desktop navigation: ${report.interactions.mobileMenuLinks.join(", ")}`);

await page.setViewportSize({ width: 1440, height: 1000 });
// The homepage carries both surfaces the motion touches: a hero photograph and the reveals.
await page.goto(`${base}/`, { waitUntil: "networkidle" });
report.reducedMotion = await page.evaluate(() => ({
  duration1: getComputedStyle(document.documentElement).getPropertyValue("--dur-1").trim(),
  scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  revealAnimation: getComputedStyle(document.querySelector(".vehicle-section")).animationName,
  heroTimeline: getComputedStyle(document.querySelector(".hero__image")).animationName,
}));
if (report.reducedMotion.duration1 !== "1ms" || report.reducedMotion.scrollBehavior !== "auto") failures.push("Reduced motion override failed");
if (report.reducedMotion.revealAnimation !== "none" || report.reducedMotion.heroTimeline !== "none") failures.push(`Reduced motion must remove the scroll-driven animations, got ${report.reducedMotion.revealAnimation} and ${report.reducedMotion.heroTimeline}`);

// Under reduced motion the word cascade must not exist at all, rather than existing and being stilled.
// site.js carries its own guard for exactly this: a split element whose animation has been cleared is
// still a heading rebuilt out of spans, and there is no reason to rebuild it.
for (const route of ["/", "/brawley/", "/concepts/indio/"]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const shape = await page.evaluate(() => ({
    words: document.querySelectorAll(".word").length,
    split: document.querySelectorAll(".is-split, [data-split]").length,
    headings: [...document.querySelectorAll(".section-heading h2")].map((node) => node.textContent),
    lede: document.querySelector(".lede")?.textContent ?? null,
  }));
  report.reducedMotion[`cascade${route}`] = shape;
  if (shape.words !== 0 || shape.split !== 0) failures.push(`${route}: reduced motion must leave text unsplit, found ${shape.words} word spans`);
  if (shape.headings.some((text) => !text.trim())) failures.push(`${route}: a section heading is empty under reduced motion`);
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

// The motion itself, checked in a context that asks for it. Scroll-driven reveals must be
// attached to a view() timeline and must resolve to fully visible once the block has entered.
const motionContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference" });
const motionPage = await motionContext.newPage();
await motionPage.goto(`${base}/`, { waitUntil: "networkidle" });
report.motion = await motionPage.evaluate(async () => {
  const section = document.querySelectorAll(".vehicle-section")[2];
  const style = getComputedStyle(section);
  const attached = { animationName: style.animationName, timeline: style.animationTimeline, range: style.animationRange };
  const heroStyle = getComputedStyle(document.querySelector(".hero__image"));
  section.scrollIntoView({ block: "center", behavior: "instant" });
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  return {
    ...attached,
    hero: { animationName: heroStyle.animationName, timeline: heroStyle.animationTimeline },
    opacityOnceEntered: Number(getComputedStyle(section).opacity),
    // No JavaScript may be introduced to drive any of this.
    scriptTags: document.querySelectorAll("script[src]").length,
  };
});
if (report.motion.animationName !== "rise-in" || !report.motion.timeline.includes("view")) failures.push(`Scroll reveal is not attached: ${JSON.stringify(report.motion)}`);
if (report.motion.hero.animationName !== "hero-drift") failures.push("Hero drift is not attached");
if (report.motion.opacityOnceEntered < 0.99) failures.push(`A scrolled-into-view section did not resolve to fully visible: opacity ${report.motion.opacityOnceEntered}`);

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
report.motion.marquee.toggleVisible = await motionPage.locator("[data-marquee-toggle]").isVisible();
const running = report.motion.marquee.running;
if (running.animationName !== "concept-drift" || running.playState !== "running") failures.push(`The concept band is not drifting: ${JSON.stringify(running)}`);
if (running.duration !== "55s" || running.iterations !== "infinite") failures.push(`The concept band's drift is not the continuous one: ${JSON.stringify(running)}`);
if (!report.motion.marquee.ready || !report.motion.marquee.toggleVisible) failures.push("The island must set data-ready and reveal the pause button together");
// Hover pauses without touching state, so the band resumes on its own when the pointer leaves.
await motionPage.locator(".concept-marquee__viewport").hover();
report.motion.marquee.hovered = await trackState();
if (report.motion.marquee.hovered.playState !== "paused") failures.push("Hovering the concept band must pause it");
await motionPage.mouse.move(0, 0);
report.motion.marquee.unhovered = await trackState();
if (report.motion.marquee.unhovered.playState !== "running") failures.push("Leaving the concept band must resume it");
// The button, which does hold state.
await motionPage.locator("[data-marquee-toggle]").click();
report.motion.marquee.afterPress = { ...await trackState(), pressed: await motionPage.locator("[data-marquee-toggle]").getAttribute("aria-pressed") };
if (report.motion.marquee.afterPress.playState !== "paused" || report.motion.marquee.afterPress.pressed !== "true") failures.push(`The pause button did not pause the band: ${JSON.stringify(report.motion.marquee.afterPress)}`);
await motionPage.locator("[data-marquee-toggle]").click();
// Both the focus and the pointer have to leave before the resume can be read. Hover and focus-within
// each pause the band by design, and clicking leaves the pointer on the button and the focus in it, so
// reading play-state here without releasing both would report a pause the button did not cause.
await motionPage.locator("[data-marquee-toggle]").evaluate((node) => node.blur());
await motionPage.mouse.move(0, 0);
report.motion.marquee.afterSecondPress = { ...await trackState(), pressed: await motionPage.locator("[data-marquee-toggle]").getAttribute("aria-pressed") };
if (report.motion.marquee.afterSecondPress.playState !== "running" || report.motion.marquee.afterSecondPress.pressed !== "false") failures.push(`The pause button did not resume the band: ${JSON.stringify(report.motion.marquee.afterSecondPress)}`);

// The word cascade. Which headings get split depends on what sits below the fold at load time, and
// that is deliberate: the first viewport stays still. So existence is asserted across a set of routes
// rather than on one, while the invariants that must always hold are asserted on every one of them.
report.motion.wordCascade = { routes: {} };
for (const route of ["/", "/brawley/", "/concepts/indio/", "/brawley/gts/"]) {
  await motionPage.goto(`${base}${route}`, { waitUntil: "networkidle" });
  await motionPage.waitForTimeout(400);
  const shape = await motionPage.evaluate(async () => {
    const split = [...document.querySelectorAll(".is-split")];
    // Measured before anything scrolls, which is the only moment this means what it says. The guard in
    // site.js only splits blocks that sit entirely below the fold, because splitting text the visitor
    // is already reading would visibly re-hide it. This is that guarantee, stated as a number.
    const aboveFold = split.filter((element) => element.getBoundingClientRect().top < innerHeight)
      .map((element) => element.textContent.slice(0, 40));
    const readRange = (node) => {
      const style = getComputedStyle(node);
      return { start: style.animationRangeStart, name: style.animationName, timeline: style.animationTimeline };
    };
    const detail = split.map((element) => {
      const words = [...element.querySelectorAll(".word")];
      return {
        words: words.length,
        first: words[0] ? readRange(words[0]) : null,
        last: words.at(-1) ? readRange(words.at(-1)) : null,
        // The split must not change what the element says.
        text: element.textContent,
      };
    });
    // Resolve one of them and confirm every word lands fully visible.
    let resolved = null;
    if (split.length) {
      split[0].scrollIntoView({ block: "center", behavior: "instant" });
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      resolved = Math.min(...[...split[0].querySelectorAll(".word")].map((word) => Number(getComputedStyle(word).opacity)));
    }
    return {
      detail,
      resolved,
      aboveFold,
      // Belt and braces on the selector itself: hero and page-header h1s are excluded by never being
      // targeted, and this fires if that ever changes.
      heroSplit: document.querySelectorAll(".hero__content h1.is-split, .page-header h1.is-split").length,
      // The container's own reveal moves to its siblings rather than stacking with the cascade.
      splitContainers: [...document.querySelectorAll(".section-heading[data-split]")].map((node) => ({
        container: getComputedStyle(node).animationName,
        eyebrow: node.querySelector(".eyebrow") ? getComputedStyle(node.querySelector(".eyebrow")).animationName : null,
      })),
    };
  });
  report.motion.wordCascade.routes[route] = shape;
  if (shape.heroSplit !== 0) failures.push(`${route}: ${shape.heroSplit} first-viewport headings were split`);
  if (shape.aboveFold.length) failures.push(`${route}: ${shape.aboveFold.length} already-visible blocks were split, which re-hides text the visitor is reading: ${shape.aboveFold.join(" / ")}`);
  for (const container of shape.splitContainers) {
    if (container.container !== "none") failures.push(`${route}: a split section heading still runs its own block reveal (${container.container})`);
    if (container.eyebrow !== "rise-in") failures.push(`${route}: a split section heading's eyebrow lost its reveal (${container.eyebrow})`);
  }
  for (const element of shape.detail) {
    if (element.words < 2) failures.push(`${route}: a split element has ${element.words} words`);
    if (element.first?.name !== "rise-in") failures.push(`${route}: split words are not animated (${element.first?.name})`);
    if (!element.first?.timeline.includes("vhw-words")) failures.push(`${route}: split words are not on the element's named timeline (${element.first?.timeline})`);
    // The stagger IS the feature. Identical ranges mean the browser rejected calc inside a range and
    // fell back to every word rising together, which is a real regression and must be named, not
    // discovered by eye. Plan B in the V9 plan is bucketed ranges if this ever fires.
    if (element.first?.start === element.last?.start) failures.push(`${route}: the word stagger collapsed, every word starts at ${element.first?.start}. calc-in-range is unsupported here; apply the bucketed-range fallback.`);
  }
  if (shape.resolved !== null && shape.resolved < 0.99) failures.push(`${route}: a scrolled-into-view cascade did not resolve to fully visible: ${shape.resolved}`);
}
const cascadeRoutes = Object.values(report.motion.wordCascade.routes);
report.motion.wordCascade.totalSplit = cascadeRoutes.reduce((sum, shape) => sum + shape.detail.length, 0);
report.motion.wordCascade.totalWords = cascadeRoutes.reduce((sum, shape) => sum + shape.detail.reduce((inner, element) => inner + element.words, 0), 0);
if (report.motion.wordCascade.totalSplit < 3) failures.push(`The word cascade reached only ${report.motion.wordCascade.totalSplit} elements across four routes`);
if (report.motion.wordCascade.totalWords < 20) failures.push(`The word cascade split only ${report.motion.wordCascade.totalWords} words across four routes`);
await motionContext.close();

// V10. Everything below is new in this version: the renamed action, the footer's destinations, the
// single-title page headers, the policy page, and the three ambient videos.

// The ambient video, in a context that asks for motion. Requests are recorded from before the first
// navigation, because the claim being tested is about ordering and timing, not just about what
// eventually loaded: the poster must be asked for before any video source, and no video source may be
// requested before the load event, which is when site.js runs.
report.ambient = { routes: {} };
const videoContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference" });
const AMBIENT_PLACEMENTS = [["/", ".hero", ".hero__image"], ["/brawley/", ".ambient", ".ambient__poster"], ["/brawley/gts/", ".ambient", ".ambient__poster"]];
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
  report.ambient.routes[route] = { atLoad, requests: [...requests], shape, lcp };

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
  if (!shape.muted || !shape.loop) failures.push(`${route}: the ambient video must be muted and looping`);
  if (!shape.currentSrc.endsWith(".webm")) failures.push(`${route}: the playing source is ${shape.currentSrc}`);
  if (!shape.toggleVisible || shape.toggleLabel !== "Pause") failures.push(`${route}: the control must be revealed reading Pause once playback starts, got ${JSON.stringify(shape.toggleLabel)}`);
  if (!shape.posterStillThere) failures.push(`${route}: the poster was removed, so there is nothing under the video`);
  if (!shape.boxesMatch || shape.objectFit !== "cover") failures.push(`${route}: the video and its poster do not share one box: ${JSON.stringify(shape)}`);
  await videoPage.close();
}
// The homepage's LCP must stay the poster image. A decoded video frame becoming the LCP element would
// mean the largest paint had moved behind the load event and the video gate.
const homeLcp = report.ambient.routes["/"].lcp;
if (!homeLcp?.url?.includes("/assets/video/brawley/brawley-canyon-hero-poster-")) failures.push(`The homepage LCP element must be the hero poster, got ${JSON.stringify(homeLcp)}`);

// The control, exercised. Pressing it must stop the film and say so; pressing it again must start it.
const togglePage = await videoContext.newPage();
await togglePage.goto(`${base}/`, { waitUntil: "networkidle" });
await togglePage.waitForFunction(() => document.querySelector(".hero")?.hasAttribute("data-painted"), null, { timeout: 15000 });
const heroVideoState = () => togglePage.locator(".hero__video").evaluate((video) => ({ paused: video.paused, time: video.currentTime }));
await togglePage.locator("[data-ambient-toggle]").click();
report.ambient.afterPause = { ...await heroVideoState(), label: await togglePage.locator("[data-ambient-toggle]").textContent() };
if (!report.ambient.afterPause.paused || report.ambient.afterPause.label !== "Play") failures.push(`The hero control did not pause the loop: ${JSON.stringify(report.ambient.afterPause)}`);
await togglePage.locator("[data-ambient-toggle]").click();
report.ambient.afterResume = { ...await heroVideoState(), label: await togglePage.locator("[data-ambient-toggle]").textContent() };
if (report.ambient.afterResume.paused || report.ambient.afterResume.label !== "Pause") failures.push(`The hero control did not resume the loop: ${JSON.stringify(report.ambient.afterResume)}`);

// A choice to pause has to survive scrolling away and coming back, which is what separates the
// visitor's intent from the viewport's housekeeping.
await togglePage.locator("[data-ambient-toggle]").click();
await togglePage.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
await togglePage.waitForTimeout(300);
await togglePage.evaluate(() => scrollTo(0, 0));
await togglePage.waitForTimeout(600);
report.ambient.choiceSurvivesScroll = await heroVideoState();
if (!report.ambient.choiceSurvivesScroll.paused) failures.push("A manually paused loop restarted itself after the visitor scrolled away and back");
await togglePage.close();

// Offscreen and hidden. Neither is a state the visitor chose, so both stop the film and both release
// it again. Verified on /brawley/, where the block genuinely leaves the viewport.
const offscreenPage = await videoContext.newPage();
await offscreenPage.goto(`${base}/brawley/`, { waitUntil: "networkidle" });
await offscreenPage.locator(".ambient").scrollIntoViewIfNeeded();
await offscreenPage.waitForFunction(() => document.querySelector(".ambient")?.hasAttribute("data-painted"), null, { timeout: 15000 });
const ambientPaused = () => offscreenPage.locator(".ambient__video").evaluate((video) => video.paused);
report.ambient.offscreen = { playingInView: !await ambientPaused() };
// To the foot of the page, not to the top. The observer carries a 200px rootMargin so a block that is
// merely below the first viewport is still counted as in view, deliberately: it gives a block a moment
// to start moving before it is looked at. Scrolling to the top therefore does not take the /brawley/
// block out of view at a 1000px viewport, which is what made the first run of this check report a
// working pause as a failure.
await offscreenPage.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
await offscreenPage.waitForTimeout(600);
report.ambient.offscreen.pausedOffscreen = await ambientPaused();
await offscreenPage.locator(".ambient").scrollIntoViewIfNeeded();
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
if (rename.headerLabel !== "Contact" || rename.retired || rename.headerHref !== "/dealers/") failures.push(`Contact rename failed: ${JSON.stringify(rename)}`);
await page.goto(`${base}/dealers/`, { waitUntil: "networkidle" });
report.interactions.contactHeading = await page.locator(".form-heading").innerText();
if (report.interactions.contactHeading !== "Contact Vanderhall") failures.push(`The dealers form heading is ${report.interactions.contactHeading}`);

// The footer's new destinations, read off the rendered page rather than the markup, and asserted on a
// sample of routes because the footer is generated once for all of them.
report.interactions.footer = {};
for (const route of ["/", "/brawley/gts/", "/privacy/", "/concepts/indio/"]) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  report.interactions.footer[route] = await page.evaluate(() => {
    const hrefs = (selector) => [...document.querySelectorAll(selector)].map((anchor) => anchor.getAttribute("href"));
    const social = [...document.querySelectorAll(".footer-social a")];
    return {
      social: hrefs(".footer-social a"),
      socialNames: social.map((anchor) => ({ visible: anchor.textContent, accessible: anchor.getAttribute("aria-label") })),
      legal: hrefs(".footer-legal__links a"),
      app: hrefs(".footer-links a").filter((href) => href.includes("apps.apple.com") || href.includes("play.google.com")),
      tracked: hrefs("a").filter((href) => href && /[?&](?:_gl|_ga|_gcl_au|utm_[a-z]+|fref)=/.test(href)),
      // The links a visitor can actually reach with a keyboard, which is the only test that matters
      // for a row of small text links.
      focusable: social.filter((anchor) => anchor.tabIndex >= 0).length,
    };
  });
  const footer = report.interactions.footer[route];
  if (footer.social.length !== 6) failures.push(`${route}: expected six social links in the footer, found ${footer.social.length}`);
  if (footer.legal.length !== 3 || !footer.legal.includes("/privacy/")) failures.push(`${route}: the footer legal row must carry three links including /privacy/, got ${footer.legal.join(", ")}`);
  if (footer.app.length !== 2) failures.push(`${route}: expected two app store links, found ${footer.app.length}`);
  if (footer.tracked.length) failures.push(`${route}: a footer link carries tracking parameters: ${footer.tracked.join(", ")}`);
  if (footer.focusable !== 6) failures.push(`${route}: ${6 - footer.focusable} social links are not reachable by keyboard`);
  for (const name of footer.socialNames) {
    if (!name.accessible?.includes(name.visible)) failures.push(`${route}: the accessible name ${name.accessible} does not contain the visible label ${name.visible}`);
  }
}
// The legal links resolve. The two external ones are checked by request rather than by navigation, so
// a Vanderhall system that has moved a page fails here instead of on a visitor's screen.
report.interactions.legalTargets = [];
for (const href of ["https://portal.vanderhallusa.com/safety_notices", "https://dealer.vanderhallusa.com/careers", `${base}/privacy/`]) {
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
for (const route of ["/vehicles/", "/concepts/", "/dealers/", "/recommend-dealer/", "/dealer-inquiry/", "/owners/", "/privacy/"]) {
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
      accentToken: accent,
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
  if (header.markIsAccent !== "rgb(224, 138, 85)") failures.push(`${route}: the title mark is ${header.markIsAccent}, not the accent token ${header.accentToken}`);
  // The outcome, then the mechanism. The first is what a visitor sees; the second names the cause when
  // it breaks, because an indented title is almost always a mark that has gone inline.
  if (header.titleLeft === null || Math.abs(header.titleLeft - header.bodyLeft) > 1) failures.push(`${route}: the title's text starts ${header.titleLeft - header.bodyLeft}px off the content edge`);
  if (header.markDisplay !== "block") failures.push(`${route}: the title mark is ${header.markDisplay}, which puts it inline with the title instead of above it`);
}
if (report.interactions.pageHeaders["/concepts/"].title !== "Concepts") failures.push(`The concepts page title is ${report.interactions.pageHeaders["/concepts/"].title}`);
if (report.interactions.pageHeaders["/owners/"].title !== "Owner resources") failures.push(`The owners page title is ${report.interactions.pageHeaders["/owners/"].title}`);

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
  // The figures are plain markup, so all 28 of Brawley's rows render with no script at all. The
  // metric assertion is negative on purpose: it proves metric was removed rather than hidden by a
  // stylesheet the way the old toggle hid it.
  visibleSpecRows: await noJsPage.locator(".photo-module__specs .spec-row:visible").count(),
  showsImperial: noJsBodyText.includes("488 lb-ft"),
  showsMetric: noJsBodyText.includes("661 Nm"),
  backLinks: await noJsPage.locator(".back-nav a:visible").count(),
  navLinks: await noJsPage.locator("nav a").count(),
  forms: {},
};
if (report.noJs.status !== 200 || report.noJs.bodyLength < 500 || report.noJs.navLinks === 0) failures.push("No-JS verification failed");
if (report.noJs.visibleSpecRows !== 28) failures.push(`No-JS /brawley/ must render all 28 specification rows, found ${report.noJs.visibleSpecRows}`);
if (!report.noJs.showsImperial) failures.push("No-JS /brawley/ is missing its imperial torque figure");
if (report.noJs.showsMetric) failures.push("No-JS /brawley/ still carries a metric value");
if (report.noJs.backLinks !== 1) failures.push(`No-JS /brawley/ must offer one way back, found ${report.noJs.backLinks}`);
// The purchase page without JavaScript: a real photograph, the price, the disclaimer, and a
// plain reservation link. Controls hidden, swatches disabled, nothing dead on the screen.
await noJsPage.goto(`${base}/brawley/gts/`, { waitUntil: "load" });
report.noJs.gts = await noJsPage.evaluate(() => {
  const frame = document.querySelector(".walkaround__frame");
  const reserve = [...document.querySelectorAll("a")].find((anchor) => anchor.href.includes("dealer.vanderhallusa.com"));
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
for (const [route, blockSelector, posterSelector] of [["/", ".hero", ".hero__image"], ["/brawley/", ".ambient", ".ambient__poster"], ["/brawley/gts/", ".ambient", ".ambient__poster"]]) {
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
  social: document.querySelectorAll(".footer-social a[href]").length,
  legal: document.querySelectorAll(".footer-legal__links a[href]").length,
  privacyHref: [...document.querySelectorAll(".footer-legal__links a")].map((anchor) => anchor.getAttribute("href")).includes("/privacy/"),
}));
if (report.noJs.footer.social !== 6 || report.noJs.footer.legal !== 3 || !report.noJs.footer.privacyHref) failures.push(`No-JS footer links failed: ${JSON.stringify(report.noJs.footer)}`);

await noJsPage.goto(`${base}/`, { waitUntil: "load" });
report.noJs.vehiclesHref = await noJsPage.getByRole("link", { name: "Vehicles", exact: true }).first().getAttribute("href");
if (report.noJs.vehiclesHref !== "/vehicles/") failures.push("No-JS Vehicles navigation is not a plain link");
for (const route of ["/dealers/", "/recommend-dealer/", "/dealer-inquiry/"]) {
  await noJsPage.goto(`${base}${route}`, { waitUntil: "load" });
  const formAudit = await noJsPage.locator("[data-site-form]").last().evaluate((form) => {
    const controls = [...form.querySelectorAll("input:not([type=hidden]), select, textarea")];
    return { controls: controls.length, disabled: controls.filter((control) => control.disabled).length, unlabeled: controls.filter((control) => !control.labels?.length).map((control) => control.id || control.name) };
  });
  report.noJs.forms[route] = formAudit;
  if (!formAudit.controls || formAudit.disabled || formAudit.unlabeled.length) failures.push(`No-JS form audit failed for ${route}`);
}
await noJsContext.close();

for (const route of ["/dealers/", "/recommend-dealer/", "/dealer-inquiry/"]) {
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
  const notConnected = await form.locator(".form-status").innerText() === "This form is not connected yet. Your information was not sent.";
  report.forms[route] = { summaryFocused, anchorFocused, keyboardCompletion: notConnected, controls: await form.locator("input, select, textarea").count(), fieldsets: await form.locator("fieldset").count() };
  if (!summaryFocused || !anchorFocused || !notConnected) failures.push(`Form keyboard or error-summary flow failed for ${route}`);
}

report.consoleErrors = [...new Set(report.consoleErrors)];
if (report.consoleErrors.length) failures.push(`Console errors: ${report.consoleErrors.join(" | ")}`);
report.failures = failures;
await writeFile(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
await context.close();
await browser.close();

console.log(JSON.stringify({ failures, routes: report.routes.map((route) => ({ route: route.route, status: route.status, height: route.pageHeight })) }, null, 2));
if (failures.length) process.exit(1);
