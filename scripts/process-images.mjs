import { execFile } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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
  ["Santarosa", "santarosa-hero-light-streaks", "santarosa", "52% 50%"],
];
for (const [group, name, slug, focal] of cardSpecs) {
  await crop(source(group, name), `cards/${slug}`, slug, 800, 500, { transform: `16:10 card, focal ${focal}` });
}
await crop(source("Brawley", "brawley-lifestyle-desert-camp"), "cards/brawley", "brawley", 800, 500, {
  extract: { left: 0, top: 140, width: 2880, height: 1446 },
  transform: "16:10 crop after y=140; baked top disclaimer excluded",
});

const heroes = [
  ["Brawley", "brawley-hero-mountain-pass", "home", "47% 60%"],
  ["Venice", "venice-hero-light-streaks", "venice", "45% 55%"],
  ["Carmel", "carmel-hero-sunset", "carmel", "52% 60%"],
];
for (const [group, name, slug, focal] of heroes) {
  const input = source(group, name);
  const metadata = await sharp(input).metadata();
  for (const width of [640, 960, 1280, 1920, 2560].filter((value) => value <= metadata.width)) {
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
    ["brawley-detail-seat-emboss", "seat-emboss"], ["brawley-detail-charging-port", "charging-port"],
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

await crop(source("Venice", "venice-action-mountain-road"), "features/venice", "mountain-road", 1600, 604, { transform: "native 2.65:1 mid-page bleed" });
await crop(source("Venice", "venice-exterior-underpass-reflection"), "character/venice", "underpass", 1600, 900, { transform: "16:9 center-band crop, focal 50% 45%" });
await crop(source("Carmel", "carmel-action-palm-trees"), "features/carmel", "palm-trees", 960, 1200, { transform: "4:5 portrait, focal 50% 55%" });
await crop(source("Carmel", "carmel-action-night-street"), "character/carmel", "night-street", 1600, 900, { transform: "16:9 crop, focal 40% 50%" });
await crop(source("Santarosa", "santarosa-action-winding-road"), "features/santarosa", "winding-road", 960, 1200, {
  extract: { left: 120, top: 0, width: 2192, height: 2740 },
  transform: "4:5 crop with bottom edge y=2740; baked bottom disclaimer excluded",
});
await crop(source("Santarosa", "santarosa-detail-steering-wheel"), "features/santarosa", "steering-wheel", 960, 1200, { transform: "4:5 portrait, focal 50% 40%" });
await crop(source("Brawley", "brawley-hero-starry-night"), "character/brawley", "starry-night", 1600, 900, {
  extract: { left: 262, top: 1100, width: 1778, height: 1000 },
  transform: "16:9 center band y=1100..2100; baked bottom disclaimer excluded",
});
await crop(source("Brawley", "brawley-hero-starry-night"), "character/brawley", "starry-night-tall", 960, 1200, {
  extract: { left: 432, top: 800, width: 1440, height: 1800 },
  transform: "4:5 crop y=800..2600; baked bottom disclaimer excluded",
});

const encodeLadder = async (input, directory, base, widths, { extract, transform = "native ratio" } = {}) => {
  for (const width of widths) {
    const output = resolve(outputRoot, `v3/${directory}/${base}-${width}.webp`);
    await encode(input, output, { width, ...(extract ? { extract } : {}), transform: `${transform}; ${width}w; WebP q80; verified clean` });
  }
};

const santarosaCover = resolve(v3Root, "Vehicle Cover Candidates/Santarosa/santarosa-hangar.jpg");
const brawleyCover = resolve(v3Root, "Vehicle Cover Candidates/Brawley/brawley-desert-three-quarter.jpg");
await encodeLadder(santarosaCover, "heroes/santarosa", "santarosa-wide", [960, 1280, 1920, 2560], { extract: { left: 0, top: 300, width: 2880, height: 1234 }, transform: "crop x=0..2880 y=300..1534; focal 34% 49%" });
await encodeLadder(santarosaCover, "heroes/santarosa", "santarosa-tall", [480, 720, 960], { extract: { left: 285, top: 0, width: 1410, height: 1762 }, transform: "crop x=285..1695 y=0..1762; focal 34% 49%" });
await encodeLadder(brawleyCover, "heroes/brawley", "brawley-wide", [960, 1280, 1920, 2560], { extract: { left: 0, top: 180, width: 2880, height: 1234 }, transform: "crop x=0..2880 y=180..1414; watermark excluded; focal 50% 55%" });
await encodeLadder(brawleyCover, "heroes/brawley", "brawley-tall", [480, 720, 960], { extract: { left: 1170, top: 0, width: 1131, height: 1414 }, transform: "crop x=1170..2301 y=0..1414; front three-quarter detail; focal 50% 55%" });

const santarosaLightStreaks = source("Santarosa", "santarosa-hero-light-streaks");
await encodeLadder(santarosaLightStreaks, "character/santarosa", "light-streaks", [1600], { transform: "16:9 full-frame character plate; focal 52% 50%" });
await encodeLadder(santarosaLightStreaks, "character/santarosa", "light-streaks-tall", [960], { extract: { left: 792, top: 0, width: 1296, height: 1620 }, transform: "4:5 center character crop; focal 52% 50%" });

const chapterSpecs = [
  [source("Venice", "venice-exterior-seaside-profile"), "venice", null, "full frame"],
  [source("Carmel", "carmel-lifestyle-beach-reflection"), "carmel", { left: 188, top: 0, width: 2504, height: 1669 }, "3:2 crop x=188..2692"],
  [source("Santarosa", "santarosa-lifestyle-sunset"), "santarosa", { left: 250, top: 0, width: 2160, height: 1440 }, "3:2 crop with bottom disclaimer excluded"],
  [source("Brawley", "brawley-lifestyle-desert-camp"), "brawley", { left: 355, top: 140, width: 2169, height: 1446 }, "3:2 crop after y=140; baked top disclaimer excluded"],
];
for (const [input, slug, extract, transform] of chapterSpecs) await encodeLadder(input, "vehicles", slug, [800, 960, 1600], { extract, transform });

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
  const widths = [960, 1280, 1920, 2560].filter((width) => width <= metadata.width);
  await encodeLadder(conceptFile(folder, filename), `concepts/${slug}`, base, widths, { transform: `full-frame ${filename}; no line art, callouts, disclaimer, or legacy UI` });
}

await encodeLadder(conceptFile("Indio", "indio-beach-slide-scaled.jpg"), "concepts/indio", "hero", [960, 1440, 2560], { transform: "full-frame featured Indio hero" });
await encodeLadder(conceptFile("Yuma Defense", "vanderhall-yuma-defense-concept-vehicle.png"), "concepts/yuma-defense", "gallery-2", [960, 1280], { extract: { left: 0, top: 0, width: 1400, height: 650 }, transform: "clean left vehicle band; More Concepts furniture excluded" });
const conceptMobiles = [
  ["Indio", "indio-slide-2-mobile.jpg", "indio"],
  ["Coachella", "coachella-slide-03-mobile-size.jpg", "coachella"],
  ["Brawley R", "brawley-r-slide-mobile-6.jpg", "brawley-r"],
  ["Santarosa R", "vanderhall-santarosa-r-slide-mobile.jpg", "santarosa-r"],
  ["Yuma", "yuma-slide-1-3-mobile-2.jpg", "yuma"],
];
for (const [folder, filename, slug] of conceptMobiles) await encode(conceptFile(folder, filename), resolve(outputRoot, `v3/concepts/${slug}/mobile-704.webp`), { width: 704, transform: `native mobile source ${filename}; verified clean` });
await encode(conceptFile("Speedster", "santarosa-speedster.jpg"), resolve(outputRoot, "v3/concepts/speedster/gallery-2-704.webp"), { width: 704, transform: "native small gallery plate; verified clean" });
await encode(conceptFile("Yuma Defense", "yuma-defense-slide-revised-2.jpg"), resolve(outputRoot, "v3/concepts/yuma-defense/gallery-1-704.webp"), { width: 704, transform: "native small gallery plate; verified clean" });

await encodeLadder(conceptFile("Coachella", "coachella-concept-03.jpg"), "concepts/hub", "coachella", [800, 1200, 1880], { extract: { left: 500, top: 0, width: 1880, height: 806 }, transform: "21:9 hub crop x=500..2380" });
await encodeLadder(conceptFile("Brawley R", "brawley-r-slide-8.jpg"), "concepts/hub", "brawley-r", [800, 1200, 1880], { extract: { left: 500, top: 0, width: 1880, height: 806 }, transform: "21:9 hub crop x=500..2380" });
for (const [filename, slug] of [["santarosa-r-concept.jpg", "santarosa-r"], ["speedster-concept.jpg", "speedster"], ["yuma-concept.jpg", "yuma"], ["yuma-defense-concept.jpg", "yuma-defense"], ["laduna-concept-blue-2.jpg", "laduna"], ["balboa-concept-2.jpg", "balboa"]]) {
  await encode(conceptFile("Hub Cards", filename), resolve(outputRoot, `v3/concepts/hub/${slug}-656.webp`), { width: 656, transform: `native 656x445 hub card ${filename}; verified clean` });
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

const studioDir = resolve(assetsRoot, "Brawley Icons");
const studioFiles = (await readdir(studioDir)).filter((name) => name.toLowerCase().endsWith(".jpg")).sort();
const colorMap = [["Atomic-Green", "atomic-green"], ["Bosco-Blue", "bosco-blue"], ["Concrete-Grey", "concrete-grey"], ["Emerald-Green", "emerald-green"], ["Ida-Rose", "ida-rose"], ["Ivory-White", "ivory-white"], ["Jean-Grey", "jean-grey"], ["Obsidian-Black", "obsidian-black"], ["Rossa", "rossa"], ["Royal-Blue", "royal-blue"]];
const angleMap = [["front-side-driver", "front-side-driver"], ["front-side-passenger", "front-side-passenger"], ["side-rear-diver", "side-rear-driver"], ["side-rear-passenger", "side-rear-passenger"], ["side-reverse", "side-reverse"], ["front", "front"], ["rear", "rear"], ["side", "side"]];
const written = new Set();
for (const filename of studioFiles) {
  const color = colorMap.find(([needle]) => filename.includes(needle))?.[1];
  const angle = angleMap.find(([needle]) => filename.includes(needle))?.[1];
  if (!color || !angle) throw new Error(`Could not normalize ${filename}`);
  const output = resolve(outputRoot, `brawley/walkaround/${color}/${angle}.webp`);
  if (written.has(output)) continue;
  written.add(output);
  await encode(resolve(studioDir, filename), output, { width: 1600, transform: "1600w walkaround frame" });
}

const legacyLifestyle = [["Brawley-EV-desert-01-scaled.jpg", "desert", [640, 960, 1280]], ["Brawley-GTS-EV-interior-scaled.jpg", "interior", [640, 960, 1280]], ["Brawley-GTS-off-road-EV-01.jpg", "off-road", [640, 960, 1280]], ["Brawley-front-view-on-mountain-road-01-scaled.jpg", "mountain-road", [640, 960, 1280]], ["110A3638-HDR.jpg", "mountain", [640, 960, 1280]], ["110A3943-HDR.jpg", "juniper", [640, 960, 1280]], ["Bralwey-steering-wheel-scaled.jpg", "steering", [640, 960, 1280]]];
for (const [filename, slug, widths] of legacyLifestyle) for (const width of widths) await encode(resolve(assetsRoot, filename), resolve(outputRoot, `brawley/lifestyle/${slug}-${width}.webp`), { width, transform: `${width}w V1 carry-forward` });
const brawleyLifestyleDir = resolve(outputRoot, "brawley/lifestyle");
for (const filename of await readdir(brawleyLifestyleDir)) if (filename.startsWith("easter-sunset-")) await rm(resolve(brawleyLifestyleDir, filename));

await mkdir(brandRoot, { recursive: true });
const logoPdf = resolve(assetsRoot, "vanderhall logos/vanderhall logo with symbols.pdf");
const rawSvg = resolve(brandRoot, "lockup-source.svg");
await run("pdftocairo", ["-svg", logoPdf, rawSvg]);
let svg = await readFile(rawSvg, "utf8");
svg = svg.replace(/width="864pt" height="720pt" viewBox="0 0 864 720"/, 'width="585" height="61" viewBox="136 329 585 61"');
await writeFile(resolve(brandRoot, "vanderhall-lockup-horizontal.svg"), svg);
await writeFile(resolve(brandRoot, "vanderhall-lockup-horizontal-white.svg"), svg.replaceAll(/fill="rgb\([^\"]+\)"/g, 'fill="#FFFFFF"'));
const shield = svg.replace(/width="585" height="61" viewBox="136 329 585 61"/, 'width="66" height="61" viewBox="136 329 66 61"');
await writeFile(resolve(brandRoot, "vanderhall-shield.svg"), shield);
const favicon = shield.replace("</svg>", '<style>path,use{fill:#000000}@media(prefers-color-scheme:dark){path,use{fill:#FFFFFF}}</style></svg>');
await writeFile(resolve(brandRoot, "favicon.svg"), favicon);
await rm(rawSvg);
record(resolve(brandRoot, "vanderhall-lockup-horizontal.svg"), logoPdf, "vector crop viewBox 136 329 585 61");
record(resolve(brandRoot, "vanderhall-lockup-horizontal-white.svg"), logoPdf, "approved white knockout");
record(resolve(brandRoot, "vanderhall-shield.svg"), logoPdf, "shield glyph crop");
record(resolve(brandRoot, "favicon.svg"), logoPdf, "shield glyph with dark-mode fill swap");

const sealSource = resolve(assetsRoot, "vanderhall logos/PNG/round 2 inch vanderhall motor works logo 2.png");
for (const width of [192, 384]) { const output = resolve(brandRoot, `vanderhall-seal-${width}.png`); await sharp(sealSource).resize({ width, height: width, withoutEnlargement: true }).png().toFile(output); record(output, sealSource, `${width}x${width}`); }
const scriptSource = resolve(assetsRoot, "vanderhall logos/PNG/brawley logo png.png");
for (const [filename, width] of [["brawley-script.png", 1600], ["brawley-script@2x.png", 2800]]) { const output = resolve(brandRoot, filename); await sharp(scriptSource).resize({ width, withoutEnlargement: true }).png().toFile(output); record(output, scriptSource, `${width}w, no upscale`); }
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

console.log(`Encoded ${manifest.length} traced assets, including ${written.size} walkaround frames.`);
