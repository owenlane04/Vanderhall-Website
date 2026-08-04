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
const report = { routes: [], accessibility: {}, heroes: {}, forms: {}, media: {}, interactions: {}, noJs: {}, reducedMotion: {}, consoleErrors: [] };
const failures = [];
const routes = ["/", "/vehicles/", "/venice/", "/carmel/", "/santarosa/", "/brawley/", "/concepts/", "/dealers/", "/recommend-dealer/", "/dealer-inquiry/", "/about/", "/faq/", "/contact/", "/404/"];

const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(5000);
page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
page.on("pageerror", (error) => report.consoleErrors.push(error.message));

for (const route of routes) {
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  const status = response?.status();
  const h1Count = await page.locator("h1").count();
  const bodyLength = (await page.locator("body").innerText()).trim().length;
  const brokenImages = await page.locator("img").evaluateAll((images) => images.filter((image) => image.currentSrc && image.complete && image.naturalWidth === 0).map((image) => image.currentSrc));
  report.routes.push({ route, status, h1Count, bodyLength, brokenImages });
  if (status !== 200 || h1Count !== 1 || bodyLength < 100 || brokenImages.length) failures.push(`Route check failed for ${route}`);
}

for (const route of ["/", "/brawley/", "/contact/", "/recommend-dealer/", "/dealer-inquiry/", "/concepts/"]) {
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

await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${base}/`, { waitUntil: "networkidle" });
report.media = await page.locator("img").evaluateAll((images) => ({
  count: images.length,
  missingDimensions: images.filter((image) => !image.hasAttribute("width") || !image.hasAttribute("height")).map((image) => image.currentSrc),
  nonWebpPhotos: images.filter((image) => image.currentSrc && !image.currentSrc.includes("/assets/brand/") && !image.currentSrc.endsWith(".webp")).map((image) => image.currentSrc),
}));
if (report.media.missingDimensions.length || report.media.nonWebpPhotos.length) failures.push("Media attribute or format audit failed");

await page.goto(`${base}/brawley/`, { waitUntil: "networkidle" });
const initialAngle = await page.locator("[data-walkaround-stage]").getAttribute("aria-label");
await page.locator("[data-walkaround-stage]").focus();
await page.keyboard.press("ArrowRight");
const nextAngle = await page.locator("[data-walkaround-stage]").getAttribute("aria-label");
report.interactions.walkaroundKeyboard = initialAngle !== nextAngle;
if (!report.interactions.walkaroundKeyboard) failures.push("Walkaround keyboard step failed");

const metricRadio = page.getByLabel("Metric", { exact: true });
await metricRadio.check();
report.interactions.metricToggle = await page.locator("html").evaluate((element) => element.classList.contains("unit-metric"));
if (!report.interactions.metricToggle) failures.push("Metric toggle failed");

const brawleyForm = page.locator("#brawley-lead");
await brawleyForm.getByLabel(/^First name/).fill("Test");
await brawleyForm.getByLabel(/^Last name/).fill("Visitor");
await brawleyForm.getByLabel(/^Email/).fill("test@example.com");
await brawleyForm.getByLabel(/^ZIP/).fill("84601");
await brawleyForm.locator("[name='consent']").check();
await brawleyForm.locator("[name='render_timestamp']").evaluate((input) => { input.value = String(Date.now() - 3000); });
await brawleyForm.getByRole("button", { name: "Send request" }).click();
const formStatus = await brawleyForm.locator(".form-status").innerText();
report.interactions.formValidation = formStatus === "This form is not connected yet. Your information was not sent.";
if (!report.interactions.formValidation) failures.push("Lead form validation flow failed");

await page.screenshot({ path: resolve(outputDir, "brawley-desktop.png"), fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/brawley/`, { waitUntil: "networkidle" });
await page.locator("[data-open-menu]").click();
report.interactions.mobileMenuOpen = await page.locator("[data-menu-sheet]").getAttribute("aria-hidden") === "false";
await page.keyboard.press("Escape");
report.interactions.mobileMenuEscape = await page.locator("[data-menu-sheet]").getAttribute("aria-hidden") === "true";
if (!report.interactions.mobileMenuOpen || !report.interactions.mobileMenuEscape) failures.push("Mobile menu keyboard flow failed");
await page.screenshot({ path: resolve(outputDir, "brawley-mobile.png"), fullPage: true });

await page.setViewportSize({ width: 1440, height: 1000 });
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(`${base}/brawley/`, { waitUntil: "networkidle" });
report.reducedMotion = await page.evaluate(() => ({
  duration1: getComputedStyle(document.documentElement).getPropertyValue("--dur-1").trim(),
  scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  frameTransition: getComputedStyle(document.querySelector(".walkaround__frame")).transitionDuration,
}));
if (report.reducedMotion.duration1 !== "1ms" || report.reducedMotion.scrollBehavior !== "auto") failures.push("Reduced motion override failed");

const noJsContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
const noJsPage = await noJsContext.newPage();
const noJsResponse = await noJsPage.goto(`${base}/brawley/`, { waitUntil: "load" });
report.noJs = {
  status: noJsResponse?.status(),
  bodyLength: (await noJsPage.locator("body").innerText()).trim().length,
  visibleImperialValues: await noJsPage.locator("[data-unit='imp']:visible").count(),
  navLinks: await noJsPage.locator("nav a").count(),
  visibleWalkaroundFrames: await noJsPage.locator(".walkaround__frame").evaluateAll((frames) => frames.filter((frame) => Number(getComputedStyle(frame).opacity) > 0).length),
  forms: {},
};
if (report.noJs.status !== 200 || report.noJs.bodyLength < 1000 || report.noJs.visibleImperialValues === 0 || report.noJs.navLinks === 0 || report.noJs.visibleWalkaroundFrames !== 1) failures.push("No-JS verification failed");
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

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
