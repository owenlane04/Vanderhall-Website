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
const outputRoot = resolve(websiteRoot, "assets/images");
const brandRoot = resolve(websiteRoot, "assets/brand");
const manifest = [];

await rm(resolve(outputRoot, "v2"), { recursive: true, force: true });
await rm(brandRoot, { recursive: true, force: true });

const record = (output, source, transform) => manifest.push({
  delivered_file: relative(websiteRoot, output),
  source_path: relative(projectRoot, source),
  transform,
});

const encode = async (input, output, options = {}) => {
  await mkdir(dirname(output), { recursive: true });
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
  await pipeline.webp({ quality: 80, effort: 6, smartSubsample: true }).toFile(output);
  record(output, input, options.transform || JSON.stringify(options));
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
  ["Santarosa", "santarosa-hero-light-streaks", "santarosa", "52% 50%"],
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

const conceptLegacy = ["indio", "yuma", "brawley-r", "speedster", "coachella", "balboa"];
for (const slug of conceptLegacy) await encode(source("Concepts", `concept-${slug}`), resolve(outputRoot, `v2/concepts/${slug}.webp`), { width: 656, transform: "source-width concept card" });
for (const [filename, slug] of [["concepts-Laduna-resized-blue.jpg", "laduna"], ["concepts-Santarosa-R.jpg", "santarosa-r"], ["concepts-Yuma-Defense.jpg", "yuma-defense"]]) {
  await encode(resolve(assetsRoot, filename), resolve(outputRoot, `v2/concepts/${slug}.webp`), { width: 656, transform: "concept card, no upscale" });
}

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

const legacyLifestyle = [["Vanderhall Brawley White Easter Jeep Safari (138).jpg", "easter-sunset", [640, 960, 1600, 2400]], ["Brawley-EV-desert-01-scaled.jpg", "desert", [640, 960, 1280]], ["Brawley-GTS-EV-interior-scaled.jpg", "interior", [640, 960, 1280]], ["Brawley-GTS-off-road-EV-01.jpg", "off-road", [640, 960, 1280]], ["Brawley-front-view-on-mountain-road-01-scaled.jpg", "mountain-road", [640, 960, 1280]], ["110A3638-HDR.jpg", "mountain", [640, 960, 1280]], ["110A3943-HDR.jpg", "juniper", [640, 960, 1280]], ["Bralwey-steering-wheel-scaled.jpg", "steering", [640, 960, 1280]]];
for (const [filename, slug, widths] of legacyLifestyle) for (const width of widths) await encode(resolve(assetsRoot, filename), resolve(outputRoot, `brawley/lifestyle/${slug}-${width}.webp`), { width, transform: `${width}w V1 carry-forward` });
for (const width of [480, 640, 720, 960, 1440]) await encode(resolve(assetsRoot, "Vanderhall Brawley White Easter Jeep Safari (138).jpg"), resolve(outputRoot, `brawley/lifestyle/easter-sunset-tall-${width}.webp`), { extract: { left: 2836, top: 0, width: 3240, height: 4050 }, width, height: Math.round(width * 5 / 4), transform: "4:5 V1 hero carry-forward" });

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

await mkdir(resolve(websiteRoot, "assets/manuals"), { recursive: true });
await cp(resolve(assetsRoot, "Owner Manuals/2026_Vanderhall_Brawley_Owners_Manual_01132026.pdf"), resolve(websiteRoot, "assets/manuals/2026-brawley-owners-manual.pdf"));
await writeFile(resolve(websiteRoot, "assets/build-manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`Encoded ${manifest.length} traced assets, including ${written.size} walkaround frames.`);
