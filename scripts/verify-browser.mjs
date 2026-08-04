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
const report = { routes: [], accessibility: {}, interactions: {}, noJs: {}, reducedMotion: {}, consoleErrors: [] };
const failures = [];
const routes = ["/", "/vehicles/", "/venice/", "/carmel/", "/santarosa/", "/brawley/", "/concepts/", "/dealers/", "/about/", "/faq/", "/contact/", "/404/"];

const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
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

for (const route of ["/", "/brawley/", "/contact/", "/concepts/"]) {
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
await brawleyForm.getByLabel("First name", { exact: true }).fill("Test");
await brawleyForm.getByLabel("Last name", { exact: true }).fill("Visitor");
await brawleyForm.getByLabel("Email", { exact: true }).fill("test@example.com");
await brawleyForm.getByLabel("ZIP", { exact: true }).fill("84601");
await brawleyForm.locator("[name='consent']").check();
await brawleyForm.locator("[name='renderedAt']").evaluate((input) => { input.value = String(Date.now() - 3000); });
await brawleyForm.getByRole("button", { name: "Send request" }).click();
const formStatus = await brawleyForm.locator(".form-status").innerText();
report.interactions.formValidation = formStatus.startsWith("Form validated");
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
};
if (report.noJs.status !== 200 || report.noJs.bodyLength < 1000 || report.noJs.visibleImperialValues === 0 || report.noJs.navLinks === 0 || report.noJs.visibleWalkaroundFrames !== 1) failures.push("No-JS verification failed");
await noJsContext.close();

report.consoleErrors = [...new Set(report.consoleErrors)];
if (report.consoleErrors.length) failures.push(`Console errors: ${report.consoleErrors.join(" | ")}`);
report.failures = failures;
await writeFile(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
await context.close();
await browser.close();

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
