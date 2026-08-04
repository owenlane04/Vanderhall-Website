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
const routes = ["/", "/vehicles/", "/venice/", "/carmel/", "/santarosa/", "/brawley/", "/concepts/", ...conceptRoutes, "/dealers/", "/recommend-dealer/", "/dealer-inquiry/", "/faq/", "/contact/", "/owners/", "/404/"];

const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(5000);
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
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  report.routes.push({ route, status, h1Count, bodyLength, brokenImages, ownersInNav, pageHeight });
  if (status !== 200 || h1Count !== 1 || bodyLength < 100 || brokenImages.length || ownersInNav !== 1) failures.push(`Route check failed for ${route}`);
}

// Probed on a throwaway page so the expected 404 does not pollute the console-error audit.
const probeContext = await browser.newContext();
const probePage = await probeContext.newPage();
const aboutResponse = await probePage.goto(`${base}/about/`, { waitUntil: "load" });
report.interactions.aboutRemoved = aboutResponse?.status() === 404;
if (!report.interactions.aboutRemoved) failures.push("/about/ still resolves in the static output");
await probeContext.close();

for (const route of ["/", "/vehicles/", "/brawley/", "/santarosa/", "/contact/", "/recommend-dealer/", "/dealer-inquiry/", "/concepts/", "/concepts/indio/", "/owners/", "/dealers/", "/faq/"]) {
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

await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${base}/vehicles/`, { waitUntil: "networkidle" });
report.interactions.vehicleSelector = {
  cards: await page.locator(".card").count(),
  everyCardLinks: await page.locator(".card .card__link").count(),
  hasSpecsOrPrices: await page.locator(".spec-table, .price").count(),
};
if (report.interactions.vehicleSelector.cards !== 4 || report.interactions.vehicleSelector.everyCardLinks !== 4 || report.interactions.vehicleSelector.hasSpecsOrPrices !== 0) failures.push("Vehicles selector structure failed");

await page.goto(`${base}/concepts/`, { waitUntil: "networkidle" });
report.interactions.conceptHubCards = await page.locator(".card .card__link").count();
if (report.interactions.conceptHubCards !== 9) failures.push("Concept hub must expose nine linked cards");

for (let index = 0; index < conceptRoutes.length; index += 1) {
  await page.goto(`${base}${conceptRoutes[index]}`, { waitUntil: "networkidle" });
  const links = await page.locator(".concept-ring a").evaluateAll((anchors) => anchors.map((anchor) => new URL(anchor.href).pathname));
  const previous = conceptRoutes[(index - 1 + conceptRoutes.length) % conceptRoutes.length];
  const next = conceptRoutes[(index + 1) % conceptRoutes.length];
  if (links[0] !== previous || links[1] !== "/concepts/" || links[2] !== next) failures.push(`Concept ring failed on ${conceptRoutes[index]}`);
}

await page.goto(`${base}/owners/`, { waitUntil: "networkidle" });
report.interactions.ownerManuals = await page.locator(".resource-row").count();
if (report.interactions.ownerManuals !== 19) failures.push("Owner manual list does not contain 19 rows");
const manualHrefs = await page.locator(".resource-row").evaluateAll((rows) => rows.map((row) => row.getAttribute("href")));
report.interactions.manualResponses = [];
for (const href of manualHrefs) {
  const response = await page.request.get(`${base}${href}`);
  const contentType = response.headers()["content-type"] || "";
  report.interactions.manualResponses.push({ href, status: response.status(), contentType });
  if (!response.ok() || !contentType.includes("pdf")) failures.push(`Manual did not serve as PDF: ${href}`);
}

await page.setViewportSize({ width: 1440, height: 1000 });
for (const route of ["/", "/vehicles/", "/brawley/", "/santarosa/", "/concepts/", "/concepts/indio/", "/owners/", "/contact/"]) {
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

await page.goto(`${base}/santarosa/`, { waitUntil: "networkidle" });
const metricRadio = page.getByLabel("Metric", { exact: true });
await metricRadio.check();
report.interactions.metricToggle = await page.locator("html").evaluate((element) => element.classList.contains("unit-metric"));
if (!report.interactions.metricToggle) failures.push("Metric toggle failed");

await page.goto(`${base}/contact/?model=brawley`, { waitUntil: "networkidle" });
const requestForm = page.locator("#contact-lead");
report.interactions.requestFormCount = await page.locator("[data-form-id='request-info']").count();
if (report.interactions.requestFormCount !== 1) failures.push("Contact page must hold exactly one request-info form");
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
for (const value of ["venice", "carmel", "santarosa", "brawley", "concepts", "not-sure-yet"]) {
  await page.goto(`${base}/contact/?model=${value}`, { waitUntil: "networkidle" });
  const checked = await page.locator(`[name='interest'][value='${value}']`).isChecked();
  report.interactions.modelPrefill[value] = checked;
  if (!checked) failures.push(`Contact model prefill failed for ${value}`);
}

// Screenshots are the human review surface, so reset persisted units and theme first.
await page.goto(`${base}/`, { waitUntil: "load" });
await page.evaluate(() => { localStorage.clear(); document.documentElement.classList.remove("unit-metric"); delete document.documentElement.dataset.theme; });

for (const [route, name] of [["/", "home"], ["/vehicles/", "vehicles"], ["/venice/", "venice"], ["/carmel/", "carmel"], ["/santarosa/", "santarosa"], ["/brawley/", "brawley"], ["/concepts/", "concepts"], ["/concepts/indio/", "indio"], ["/concepts/brawley-r/", "brawley-r"], ["/concepts/balboa/", "balboa"], ["/concepts/yuma/", "yuma"], ["/owners/", "owners"], ["/contact/", "contact"], ["/dealers/", "dealers"], ["/faq/", "faq"]]) {
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
if (JSON.stringify(report.interactions.mobileMenuLinks) !== JSON.stringify(["/vehicles/", "/concepts/", "/owners/", "/faq/", "/contact/"])) failures.push("Mobile menu does not mirror the desktop navigation");

await page.setViewportSize({ width: 1440, height: 1000 });
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(`${base}/vehicles/`, { waitUntil: "networkidle" });
report.reducedMotion = await page.evaluate(() => ({
  duration1: getComputedStyle(document.documentElement).getPropertyValue("--dur-1").trim(),
  scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
}));
if (report.reducedMotion.duration1 !== "1ms" || report.reducedMotion.scrollBehavior !== "auto") failures.push("Reduced motion override failed");
await page.emulateMedia({ reducedMotion: null });

const noJsContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
const noJsPage = await noJsContext.newPage();
const noJsResponse = await noJsPage.goto(`${base}/brawley/`, { waitUntil: "load" });
report.noJs = {
  status: noJsResponse?.status(),
  bodyLength: (await noJsPage.locator("body").innerText()).trim().length,
  visibleImperialValues: await noJsPage.locator("[data-unit='imp']:visible").count(),
  navLinks: await noJsPage.locator("nav a").count(),
  forms: {},
};
if (report.noJs.status !== 200 || report.noJs.bodyLength < 500 || report.noJs.visibleImperialValues === 0 || report.noJs.navLinks === 0) failures.push("No-JS verification failed");
await noJsPage.goto(`${base}/`, { waitUntil: "load" });
report.noJs.vehiclesHref = await noJsPage.getByRole("link", { name: "Vehicles", exact: true }).first().getAttribute("href");
if (report.noJs.vehiclesHref !== "/vehicles/") failures.push("No-JS Vehicles navigation is not a plain link");
for (const route of ["/contact/", "/recommend-dealer/", "/dealer-inquiry/"]) {
  await noJsPage.goto(`${base}${route}`, { waitUntil: "load" });
  const formAudit = await noJsPage.locator("[data-site-form]").last().evaluate((form) => {
    const controls = [...form.querySelectorAll("input:not([type=hidden]), select, textarea")];
    return { controls: controls.length, disabled: controls.filter((control) => control.disabled).length, unlabeled: controls.filter((control) => !control.labels?.length).map((control) => control.id || control.name) };
  });
  report.noJs.forms[route] = formAudit;
  if (!formAudit.controls || formAudit.disabled || formAudit.unlabeled.length) failures.push(`No-JS form audit failed for ${route}`);
}
await noJsContext.close();

for (const route of ["/contact/", "/recommend-dealer/", "/dealer-inquiry/"]) {
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
