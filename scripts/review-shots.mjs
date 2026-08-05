// Focused review captures. Takes route/viewport/theme triples on the command line so a single
// surface can be re-examined without running the whole browser suite.
// Usage: node scripts/review-shots.mjs <outDir> <route>:<width>[:dark] ...
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const [outDir, ...specs] = process.argv.slice(2);
const base = process.env.VHW_BASE_URL || "http://127.0.0.1:4173";
const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
// Reveals are scroll-driven, so a full-page capture would freeze below-fold blocks part way
// through their entry. Reduced motion resolves every block to its final state.
await page.emulateMedia({ reducedMotion: "reduce" });

for (const spec of specs) {
  const [route, width, theme] = spec.split(":");
  await page.setViewportSize({ width: Number(width), height: 1000 });
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  if (theme) await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
  await page.locator("img").evaluateAll((images) => { images.forEach((image) => { image.loading = "eager"; }); });
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((done) => setTimeout(done, ms));
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.75) { scrollTo(0, y); await delay(40); }
    scrollTo(0, 0);
    await delay(120);
    await Promise.all([...document.images].map((image) => image.complete ? Promise.resolve() : new Promise((done) => {
      image.addEventListener("load", done, { once: true });
      image.addEventListener("error", done, { once: true });
    })));
    await Promise.all([...document.images].map((image) => image.decode?.().catch(() => {})));
  });
  const name = `${route.replace(/\//g, "-").replace(/^-|-$/g, "") || "home"}-${width}${theme ? `-${theme}` : ""}`;
  await page.screenshot({ path: resolve(outDir, `${name}.png`), fullPage: true });
  console.log(name, await page.evaluate(() => document.documentElement.scrollHeight));
}

await browser.close();
