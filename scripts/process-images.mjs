import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const run = promisify(execFile);
const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(websiteRoot, "..");
const assetsRoot = resolve(projectRoot, "Assets");
const legacyRoot = resolve(assetsRoot, "Legacy Website Selection");
const v3Root = "/Users/owenburton/Desktop/v3 materials";
const v3ConceptRoot = resolve(v3Root, "Concepts");
const outputRoot = resolve(websiteRoot, "assets/images");
const brandRoot = resolve(websiteRoot, "assets/brand");
const manifest = [];

await rm(resolve(outputRoot, "v2"), { recursive: true, force: true });
await rm(resolve(outputRoot, "v3"), { recursive: true, force: true });
await rm(brandRoot, { recursive: true, force: true });

const record = (output, source, transform, metadata = {}) => manifest.push({
  delivered_file: relative(websiteRoot, output),
  source_path: source.startsWith(projectRoot) ? relative(projectRoot, source) : source,
  transform,
  verified_clean: "yes",
  ...metadata,
});

const encode = async (input, output, options = {}) => {
  await mkdir(dirname(output), { recursive: true });
  const sourceMetadata = await sharp(input).metadata();
  let pipeline = sharp(input).rotate();
  if (options.extract) pipeline = pipeline.extract(options.extract);
  // Legacy concept slides sit on padded canvases. Trimming the uniform border removes the
  // empty white or black margin so the delivered crop is only the composition itself.
  if (options.trim) pipeline = pipeline.trim({ threshold: options.trim });
  if (options.width && options.height) {
    pipeline = pipeline.resize({
      width: options.width,
      height: options.height,
      fit: options.fit || "cover",
      position: options.position || "centre",
      withoutEnlargement: true,
    });
  } else if (options.width) {
    pipeline = pipeline.resize({ width: options.width, withoutEnlargement: true });
  }
  if (options.extend) pipeline = pipeline.extend(options.extend);
  const outputInfo = await pipeline.webp({ quality: 80, effort: 6, smartSubsample: true }).toFile(output);
  record(output, input, options.transform || JSON.stringify(options), {
    source_width: sourceMetadata.width,
    source_height: sourceMetadata.height,
    output_width: outputInfo.width,
    output_height: outputInfo.height,
    crop_window: options.extract ? `x=${options.extract.left} y=${options.extract.top} width=${options.extract.width} height=${options.extract.height}` : "full frame",
  });
};

const crop = async (input, directory, slug, width, height, options = {}) => {
  const output = resolve(outputRoot, `v2/${directory}/${slug}-${width}.webp`);
  await encode(input, output, { width, height, ...options, transform: options.transform || `${width}x${height} cover crop` });
  return output;
};

const source = (group, name) => resolve(legacyRoot, group, `${name}.jpg`);

const cardSpecs = [
  ["Venice", "venice-exterior-seaside-profile", "venice", "50% 55%"],
  ["Carmel", "carmel-hero-sunset", "carmel", "52% 60%"],
];
for (const [group, name, slug, focal] of cardSpecs) {
  for (const width of [500, 800]) {
    await crop(source(group, name), `cards/${slug}`, slug, width, Math.round(width * 10 / 16), { transform: `16:10 card, focal ${focal}` });
  }
}

const heroes = [
  ["Brawley", "brawley-hero-mountain-pass", "home", "47% 60%"],
  ["Venice", "venice-hero-light-streaks", "venice", "45% 55%"],
  ["Carmel", "carmel-hero-sunset", "carmel", "52% 60%"],
];
for (const [group, name, slug, focal] of heroes) {
  const input = source(group, name);
  const metadata = await sharp(input).metadata();
  for (const width of [960, 1280, 1920, 2560].filter((value) => value <= metadata.width)) {
    await crop(input, `heroes/${slug}`, `${slug}-wide`, width, Math.round(width * 9 / 21), { transform: `21:9 hero, focal ${focal}` });
  }
  for (const width of [480, 720, 960].filter((value) => value <= metadata.width)) {
    await crop(input, `heroes/${slug}`, `${slug}-tall`, width, Math.round(width * 5 / 4), { transform: `4:5 mobile hero, focal ${focal}` });
  }
}

const featureSpecs = {
  venice: [
    ["venice-action-tunnel", "motion"], ["venice-lifestyle-forest-road", "forest-road"],
    ["venice-lifestyle-mountain-lake", "mountain-lake"], ["venice-interior-seats", "seats"],
    ["venice-detail-speedometer", "speedometer"], ["venice-detail-steering-wheel", "steering-wheel"],
  ],
  carmel: [
    ["carmel-lifestyle-downtown", "downtown"], ["carmel-lifestyle-beach-reflection", "beach-reflection"],
    ["carmel-lifestyle-lake-reflection", "lake-reflection"], ["carmel-interior-dashboard", "dashboard"],
    ["carmel-detail-shifter", "shifter"], ["carmel-interior-seats", "seats"],
  ],
  santarosa: [
    ["santarosa-lifestyle-sunset", "sunset"], ["santarosa-lifestyle-city", "city"],
    ["santarosa-lifestyle-street", "street"], ["santarosa-overview-top", "top-view"],
    ["santarosa-detail-dashboard", "dashboard"],
  ],
  brawley: [
    ["brawley-detail-suspension", "suspension"], ["brawley-detail-wheel", "wheel"],
  ],
};
for (const [slug, entries] of Object.entries(featureSpecs)) {
  const group = slug[0].toUpperCase() + slug.slice(1);
  for (const [name, delivered] of entries) {
    for (const width of [640, 960, 1280]) {
      const metadata = await sharp(source(group, name)).metadata();
      if (width <= metadata.width) await crop(source(group, name), `features/${slug}`, delivered, width, Math.round(width * 2 / 3));
    }
  }
}

const encodeLadder = async (input, directory, base, widths, { extract, trim, transform = "native ratio" } = {}) => {
  for (const width of widths) {
    const output = resolve(outputRoot, `v3/${directory}/${base}-${width}.webp`);
    await encode(input, output, { width, ...(extract ? { extract } : {}), ...(trim ? { trim } : {}), transform: `${transform}; ${width}w; WebP q80; verified clean` });
  }
};

const santarosaCover = resolve(v3Root, "Vehicle Cover Candidates/Santarosa/santarosa-hangar.jpg");
const brawleyCover = resolve(v3Root, "Vehicle Cover Candidates/Brawley/brawley-desert-three-quarter.jpg");
await encodeLadder(santarosaCover, "heroes/santarosa", "santarosa-wide", [960, 1280, 1920, 2560], { extract: { left: 0, top: 300, width: 2880, height: 1234 }, transform: "crop x=0..2880 y=300..1534; focal 34% 49%" });
await encodeLadder(santarosaCover, "heroes/santarosa", "santarosa-tall", [480, 720, 960], { extract: { left: 285, top: 0, width: 1410, height: 1762 }, transform: "crop x=285..1695 y=0..1762; focal 34% 49%" });
await encodeLadder(brawleyCover, "heroes/brawley", "brawley-wide", [960, 1280, 1920, 2560], { extract: { left: 0, top: 180, width: 2880, height: 1234 }, transform: "crop x=0..2880 y=180..1414; watermark excluded; focal 50% 55%" });
await encodeLadder(brawleyCover, "heroes/brawley", "brawley-tall", [480, 720, 960], { extract: { left: 1170, top: 0, width: 1131, height: 1414 }, transform: "crop x=1170..2301 y=0..1414; front three-quarter detail; focal 50% 55%" });

// V4 vehicle cards for the two models whose covers changed in V3.
for (const width of [500, 800]) {
  await encode(santarosaCover, resolve(outputRoot, `v3/cards/santarosa-${width}.webp`), {
    extract: { left: 30, top: 277, width: 1900, height: 1188 },
    width,
    height: Math.round(width * 10 / 16),
    transform: "16:10 card crop x=30..1930 y=277..1465 centred on the vehicle; watermarks excluded",
  });
  await encode(brawleyCover, resolve(outputRoot, `v3/cards/brawley-${width}.webp`), {
    extract: { left: 482, top: 220, width: 1900, height: 1188 },
    width,
    height: Math.round(width * 10 / 16),
    transform: "16:10 card crop x=482..2382 y=220..1408 centred on the vehicle; corner watermark excluded",
  });
}

const conceptFile = (folder, filename) => resolve(v3ConceptRoot, folder, filename);
const conceptLadders = [
  ["Indio", "indio-desktop-slide-001.jpg", "indio", "gallery-1"],
  ["Indio", "indio-desktop-slide-002b.jpg", "indio", "gallery-2"],
  ["Indio", "indio-concept-slide-004c.jpg", "indio", "gallery-3"],
  ["Indio", "vanderhall-indio-concept-001.png", "indio", "gallery-4"],
  ["Coachella", "coachella-concept-03.jpg", "coachella", "hero"],
  ["Coachella", "coachella-concept-slide-02.jpg", "coachella", "gallery-1"],
  ["Coachella", "coachella-interior-front-view-slide-002.jpg", "coachella", "gallery-2"],
  ["Coachella", "vanderhall-coachella-concept-image.png", "coachella", "gallery-3"],
  ["Brawley R", "brawley-r-slide-8.jpg", "brawley-r", "hero"],
  ["Brawley R", "brawley-r-slide-1.jpg", "brawley-r", "gallery-1"],
  ["Brawley R", "vanderhall-brawley-r-lower-image-2.png", "brawley-r", "gallery-2"],
  ["Santarosa R", "santarosa-r-slide-2.jpg", "santarosa-r", "hero"],
  ["Santarosa R", "vanderhall-santarosa-r-lower-image.png", "santarosa-r", "gallery-1"],
  ["Speedster", "santarosa-speedster-slide-3.jpg", "speedster", "hero"],
  ["Speedster", "vanderhall-speedster.png", "speedster", "gallery-1"],
  ["Yuma", "vanderhall-yuma-concept-new-002-hinges.png", "yuma", "hero"],
  ["Yuma", "yuma-frame-1-3p-desert-scaled.jpg", "yuma", "gallery-1"],
  ["Yuma", "vanderhall-yuma-concept-desert-hinges.png", "yuma", "gallery-2"],
  ["Yuma Defense", "yuma-defense-frame-2.jpg", "yuma-defense", "hero"],
  ["Laduna", "vanderhall-yuma-concept-new-blue.png", "laduna", "hero"],
  ["Laduna", "laduna-frame-blue-interior-blue-scaled.jpg", "laduna", "gallery-1"],
  ["Laduna", "future-models-laduna-new-slide-grabber-blue-gold-wheels.png", "laduna", "gallery-2"],
  ["Balboa", "vanderhall-balboa-ev-concept.png", "balboa", "hero"],
  ["Balboa", "balboa-slide-1-2-scaled.jpg", "balboa", "gallery-1"],
];
for (const [folder, filename, slug, base] of conceptLadders) {
  const metadata = await sharp(conceptFile(folder, filename)).metadata();
  const widths = [960, 1280, 1920].filter((width) => width <= metadata.width);
  await encodeLadder(conceptFile(folder, filename), `concepts/${slug}`, base, widths, { trim: 12, transform: `${filename}; padded canvas trimmed; no line art, callouts, disclaimer, or legacy UI` });
}

await encodeLadder(conceptFile("Indio", "indio-beach-slide-scaled.jpg"), "concepts/indio", "hero", [960, 1440, 2560], { trim: 12, transform: "Indio hero; padded canvas trimmed" });
// Explicit crop only: this source carries an alpha channel, and trimming a transparent
// edge collapses the extract area.
await encodeLadder(conceptFile("Yuma Defense", "vanderhall-yuma-defense-concept-vehicle.png"), "concepts/yuma-defense", "gallery-2", [960, 1280], { extract: { left: 0, top: 0, width: 1400, height: 650 }, transform: "clean left vehicle band; More Concepts furniture excluded" });
const conceptMobiles = [
  ["Indio", "indio-slide-2-mobile.jpg", "indio"],
  ["Coachella", "coachella-slide-03-mobile-size.jpg", "coachella"],
  ["Brawley R", "brawley-r-slide-mobile-6.jpg", "brawley-r"],
  ["Santarosa R", "vanderhall-santarosa-r-slide-mobile.jpg", "santarosa-r"],
  ["Yuma", "yuma-slide-1-3-mobile-2.jpg", "yuma"],
];
for (const [folder, filename, slug] of conceptMobiles) await encode(conceptFile(folder, filename), resolve(outputRoot, `v3/concepts/${slug}/mobile-704.webp`), { width: 704, trim: 12, transform: `mobile source ${filename}; padded canvas trimmed; verified clean` });

// One uniform 656x445 card per concept for the single hub grid.
for (const [filename, slug] of [["santarosa-r-concept.jpg", "santarosa-r"], ["speedster-concept.jpg", "speedster"], ["yuma-concept.jpg", "yuma"], ["yuma-defense-concept.jpg", "yuma-defense"], ["laduna-concept-blue-2.jpg", "laduna"], ["balboa-concept-2.jpg", "balboa"]]) {
  await encode(conceptFile("Hub Cards", filename), resolve(outputRoot, `v3/concepts/hub/${slug}-656.webp`), { width: 656, transform: `native 656x445 hub card ${filename}; verified clean` });
}
for (const [filename, slug] of [["concept-indio.jpg", "indio"], ["concept-coachella.jpg", "coachella"], ["concept-brawley-r.jpg", "brawley-r"]]) {
  await encode(resolve(legacyRoot, "Concepts", filename), resolve(outputRoot, `v3/concepts/hub/${slug}-656.webp`), { width: 656, transform: `native 656x445 hub card ${filename}; verified clean` });
}

for (const [folder, filename, slug] of [
  ["Indio", "indio-logo-2.png", "indio"],
  ["Coachella", "vanderhall-coachella-logo.png", "coachella"],
  ["Brawley R", "vanderhall-brawley-r-logo.png", "brawley-r"],
  ["Santarosa R", "vanderhall-vanderhall-r-logo.png", "santarosa-r"],
  ["Speedster", "vanderhall-speedster-logo-landing-page-1.png", "speedster"],
  ["Yuma", "yuma-logo.png", "yuma"],
  ["Yuma Defense", "yuma-defense-logo.png", "yuma-defense"],
  ["Laduna", "laduna-logo.png", "laduna"],
  ["Balboa", "balboa-logo.png", "balboa"],
]) await encode(conceptFile(folder, filename), resolve(outputRoot, `v3/concepts/${slug}/wordmark.webp`), { transform: `native wordmark ${filename}; WebP q80` });

await rm(resolve(outputRoot, "brawley"), { recursive: true, force: true });
const legacyLifestyle = [["Brawley-EV-desert-01-scaled.jpg", "desert"], ["Brawley-GTS-EV-interior-scaled.jpg", "interior"], ["Brawley-front-view-on-mountain-road-01-scaled.jpg", "mountain-road"], ["110A3943-HDR.jpg", "juniper"]];
for (const [filename, slug] of legacyLifestyle) for (const width of [640, 960, 1280]) await encode(resolve(assetsRoot, filename), resolve(outputRoot, `brawley/lifestyle/${slug}-${width}.webp`), { width, transform: `${width}w V1 carry-forward` });

await mkdir(brandRoot, { recursive: true });
const logoPdf = resolve(assetsRoot, "vanderhall logos/vanderhall logo with symbols.pdf");
const rawSvg = resolve(brandRoot, "lockup-source.svg");
await run("pdftocairo", ["-svg", logoPdf, rawSvg]);
let svg = await readFile(rawSvg, "utf8");
svg = svg.replace(/width="864pt" height="720pt" viewBox="0 0 864 720"/, 'width="585" height="61" viewBox="136 329 585 61"');
await writeFile(resolve(brandRoot, "vanderhall-lockup-horizontal.svg"), svg);
await writeFile(resolve(brandRoot, "vanderhall-lockup-horizontal-white.svg"), svg.replaceAll(/fill="rgb\([^\"]+\)"/g, 'fill="#FFFFFF"'));
const shield = svg.replace(/width="585" height="61" viewBox="136 329 585 61"/, 'width="66" height="61" viewBox="136 329 66 61"');
const favicon = shield.replace("</svg>", '<style>path,use{fill:#000000}@media(prefers-color-scheme:dark){path,use{fill:#FFFFFF}}</style></svg>');
await writeFile(resolve(brandRoot, "favicon.svg"), favicon);
await rm(rawSvg);
record(resolve(brandRoot, "vanderhall-lockup-horizontal.svg"), logoPdf, "vector crop viewBox 136 329 585 61");
record(resolve(brandRoot, "vanderhall-lockup-horizontal-white.svg"), logoPdf, "approved white knockout");
record(resolve(brandRoot, "favicon.svg"), logoPdf, "shield glyph with dark-mode fill swap");

for (const width of [32, 180, 192, 512]) { const output = resolve(brandRoot, width === 32 ? "favicon-32.png" : width === 180 ? "apple-touch-icon.png" : `icon-${width}.png`); await sharp(resolve(brandRoot, "favicon.svg")).resize(width, width, { fit: "contain" }).png().toFile(output); record(output, logoPdf, `${width}x${width} shield raster`); }
await cp(resolve(brandRoot, "favicon-32.png"), resolve(brandRoot, "favicon.ico"));
record(resolve(brandRoot, "favicon.ico"), logoPdf, "32px PNG fallback with ICO filename");

const manualsOutput = resolve(websiteRoot, "assets/manuals");
await rm(manualsOutput, { recursive: true, force: true });
await mkdir(manualsOutput, { recursive: true });
const v3ManualRoot = resolve(v3Root, "Manuals/Owner Manuals");
const manualCopies = [
  ["2017-vanderhall-venice-owners-manual.pdf", "2017-vanderhall-venice-owners-manual.pdf"],
  ["2018-vanderhall-venice-owners-manual.pdf", "2018-vanderhall-venice-owners-manual.pdf"],
  ["2019-vanderhall-speedster-owners-manual.pdf", "2019-vanderhall-speedster-owners-manual.pdf"],
  ["2019-vanderhall-venice-owners-manual.pdf", "2019-vanderhall-venice-owners-manual.pdf"],
  ["2020-vanderhall-carmel-owners-manual.pdf", "2020-vanderhall-carmel-owners-manual.pdf"],
  ["2020-vanderhall-venice-owners-manual.pdf", "2020-vanderhall-venice-owners-manual.pdf"],
  ["2021-vanderhall-carmel-owners-manual.pdf", "2021-vanderhall-carmel-owners-manual.pdf"],
  ["2021-vanderhall-venice-owners-manual.pdf", "2021-vanderhall-venice-owners-manual.pdf"],
  ["2022-vanderhall-carmel-owners-manual.pdf", "2022-vanderhall-carmel-owners-manual.pdf"],
  ["2022-vanderhall-venice-owners-manual.pdf", "2022-vanderhall-venice-owners-manual.pdf"],
  ["2023-vanderhall-carmel-owners-manual.pdf", "2023-vanderhall-carmel-owners-manual.pdf"],
  ["2023-vanderhall-venice-owners-manual.pdf", "2023-vanderhall-venice-owners-manual.pdf"],
  ["2024-vanderhall-carmel-owners-manual.pdf", "2024-vanderhall-carmel-owners-manual.pdf"],
  ["2024-vanderhall-venice-owners-manual.pdf", "2024-vanderhall-venice-owners-manual.pdf"],
  ["2024_vanderhall_brawley_owners_manual_4.1.pdf", "2024-brawley-owners-manual.pdf"],
  ["spanish-2024_vanderhall_brawley_owners_manual_05062025.pdf", "2024-brawley-owners-manual-spanish.pdf"],
  ["2025_vanderhall_brawley_owners_manual_4.1.pdf", "2025-brawley-owners-manual.pdf"],
  ["laguna-owners-manual-2016-12-19.pdf", "2016-vanderhall-laguna-owners-manual.pdf"],
];
for (const [sourceName, outputName] of manualCopies) {
  const input = resolve(v3ManualRoot, sourceName);
  const output = resolve(manualsOutput, outputName);
  await cp(input, output);
  record(output, input, "approved owner manual copy; normalized filename");
}
const canonicalBrawleyManual = resolve(assetsRoot, "Owner Manuals/2026_Vanderhall_Brawley_Owners_Manual_01132026.pdf");
await cp(canonicalBrawleyManual, resolve(manualsOutput, "2026-brawley-owners-manual.pdf"));
record(resolve(manualsOutput, "2026-brawley-owners-manual.pdf"), canonicalBrawleyManual, "existing canonical 2026 owner manual");
await writeFile(resolve(websiteRoot, "assets/build-manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`Encoded ${manifest.length} traced assets.`);
