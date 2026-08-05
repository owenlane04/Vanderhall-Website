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
const routes = ["/", "/vehicles/", "/brawley/", "/brawley/gts/", "/santarosa/", "/carmel/", "/venice/", "/concepts/", ...conceptRoutes, "/dealers/", "/recommend-dealer/", "/dealer-inquiry/", "/owners/", "/404/"];

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
for (const route of ["/", "/vehicles/", "/brawley/", "/brawley/gts/", "/santarosa/", "/venice/", "/carmel/", "/recommend-dealer/", "/dealer-inquiry/", "/concepts/", "/concepts/indio/", "/owners/", "/dealers/", "/404/"]) {
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
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await page.waitForTimeout(300);
  const darkResult = await page.evaluate(async () => axe.run(document, { resultTypes: ["violations"] }));
  report.accessibility[`${route}#dark`] = darkResult.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length, help: violation.help }));
  if (darkResult.violations.length) failures.push(`dark-theme axe violations on ${route}: ${darkResult.violations.map((violation) => violation.id).join(", ")}`);
}

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

// Screenshots are the human review surface, so reset persisted units and theme first.
await page.goto(`${base}/`, { waitUntil: "load" });
await page.evaluate(() => { localStorage.clear(); delete document.documentElement.dataset.theme; });

for (const [route, name] of [["/", "home"], ["/vehicles/", "vehicles"], ["/venice/", "venice"], ["/carmel/", "carmel"], ["/santarosa/", "santarosa"], ["/brawley/", "brawley"], ["/brawley/gts/", "brawley-gts"], ["/concepts/", "concepts"], ["/concepts/indio/", "indio"], ["/concepts/brawley-r/", "brawley-r"], ["/concepts/balboa/", "balboa"], ["/concepts/yuma/", "yuma"], ["/owners/", "owners"], ["/dealers/", "dealers"], ["/recommend-dealer/", "recommend-dealer"]]) {
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
await motionContext.close();

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
