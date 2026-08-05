import { execFile } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
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

// Sources that carry the legacy helmet and training paragraph burned into their pixels, with
// the band each one occupies, measured against a full-resolution read. V5 exists partly
// because six deliveries shipped this text while the manifest claimed they were clean, so
// the flag is now derived from the delivered window rather than asserted.
const BAKED_TEXT_BANDS = {
  "venice-action-tunnel.jpg": { top: 1425, bottom: 1515 },
  "venice-lifestyle-forest-road.jpg": { top: 1560, bottom: 1645 },
  "carmel-lifestyle-lake-reflection.jpg": { top: 75, bottom: 160 },
  "santarosa-lifestyle-sunset.jpg": { top: 1500, bottom: 1565 },
  "Brawley-EV-desert-01-scaled.jpg": { top: 70, bottom: 140 },
  "Brawley-front-view-on-mountain-road-01-scaled.jpg": { top: 80, bottom: 155 },
  "brawley-lakeside.jpg": { top: 1500, bottom: 1558 },
  "brawley-action-road.jpg": { top: 105, bottom: 195 },
  "brawley-mountain.jpg": { top: 60, bottom: 135 },
  "brawley-rocky-road.jpg": { top: 20, bottom: 105 },
  "brawley-hero-starry-night.jpg": { top: 2740, bottom: 2820 },
  "brawley-lifestyle-desert-camp.jpg": { top: 86, bottom: 137 },
  "santarosa-action-winding-road.jpg": { top: 2755, bottom: 2855 },
};

// The vertical span of the original that actually reaches the delivered file, accounting for
// the extract window and for the centre crop a cover resize performs on top of it.
const deliveredBand = (sourceMetadata, options) => {
  const extract = options.extract || { top: 0, left: 0, width: sourceMetadata.width, height: sourceMetadata.height };
  if (!options.width || !options.height) return { top: extract.top, bottom: extract.top + extract.height - 1 };
  const scale = Math.max(options.width / extract.width, options.height / extract.height);
  const usedHeight = Math.min(extract.height, options.height / scale);
  const top = extract.top + (extract.height - usedHeight) / 2;
  return { top, bottom: top + usedHeight - 1 };
};

const cleanliness = (input, sourceMetadata, options) => {
  const band = BAKED_TEXT_BANDS[basename(input)];
  if (!band) return { verified_clean: "yes" };
  // A trim() of unknown geometry cannot be reasoned about, so treat it as unverified.
  if (options.trim) return { verified_clean: "no", clean_basis: "trim geometry not derivable" };
  const delivered = deliveredBand(sourceMetadata, options);
  const excluded = delivered.bottom < band.top || delivered.top > band.bottom;
  return {
    verified_clean: excluded ? "yes" : "no",
    clean_basis: `baked text y=${band.top}..${band.bottom}; delivered y=${Math.round(delivered.top)}..${Math.round(delivered.bottom)}; ${excluded ? "excluded" : "OVERLAPS"}`,
  };
};

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
    ...cleanliness(input, sourceMetadata, options),
  });
};

const crop = async (input, directory, slug, width, height, options = {}) => {
  const output = resolve(outputRoot, `v2/${directory}/${slug}-${width}.webp`);
  await encode(input, output, { width, height, ...options, transform: options.transform || `${width}x${height} cover crop` });
  return output;
};

const source = (group, name) => resolve(legacyRoot, group, `${name}.jpg`);

const heroes = [
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

// The fourth element is an extract window applied before the 3:2 crop. Four of these frames
// carry the legacy safety paragraph at an edge, which a plain centred cover crop cannot
// exclude, so each one names the window that drops the band and keeps the vehicle.
const featureSpecs = {
  venice: [
    ["venice-exterior-seaside-profile", "seaside"],
    ["venice-action-tunnel", "motion", { left: 0, top: 0, width: 2880, height: 1420 }],
    ["venice-lifestyle-forest-road", "forest-road", { left: 0, top: 0, width: 2880, height: 1550 }],
    ["venice-lifestyle-mountain-lake", "mountain-lake"], ["venice-interior-seats", "seats"],
    ["venice-detail-speedometer", "speedometer"], ["venice-detail-steering-wheel", "steering-wheel"],
  ],
  carmel: [
    ["carmel-lifestyle-downtown", "downtown"], ["carmel-lifestyle-beach-reflection", "beach-reflection"],
    ["carmel-lifestyle-lake-reflection", "lake-reflection", { left: 0, top: 175, width: 2880, height: 1744 }],
    ["carmel-interior-dashboard", "dashboard"],
    ["carmel-detail-shifter", "shifter"], ["carmel-interior-seats", "seats"],
  ],
  santarosa: [
    ["santarosa-lifestyle-sunset", "sunset", { left: 0, top: 0, width: 2880, height: 1490 }],
    ["santarosa-lifestyle-city", "city"],
    ["santarosa-lifestyle-street", "street"], ["santarosa-overview-top", "top-view"],
    ["santarosa-detail-dashboard", "dashboard"],
  ],
  brawley: [
    ["brawley-detail-suspension", "suspension"], ["brawley-detail-wheel", "wheel"],
  ],
};
for (const [slug, entries] of Object.entries(featureSpecs)) {
  const group = slug[0].toUpperCase() + slug.slice(1);
  for (const [name, delivered, extract] of entries) {
    for (const width of [640, 960, 1280]) {
      const metadata = await sharp(source(group, name)).metadata();
      if (width > metadata.width) continue;
      await crop(source(group, name), `features/${slug}`, delivered, width, Math.round(width * 2 / 3), extract
        ? { extract, transform: `3:2 crop inside y=${extract.top}..${extract.top + extract.height}; legacy safety paragraph excluded` }
        : {});
    }
  }
}

const encodeLadder = async (input, directory, base, widths, { extract, trim, transform = "native ratio" } = {}) => {
  for (const width of widths) {
    const output = resolve(outputRoot, `v3/${directory}/${base}-${width}.webp`);
    await encode(input, output, { width, ...(extract ? { extract } : {}), ...(trim ? { trim } : {}), transform: `${transform}; ${width}w; WebP q80; verified clean` });
  }
};

// V5 home hero: one Brawley on a rock ledge above a mountain lake, vehicle right of centre so
// the headline sits over open ground on the left. The source carries the safety paragraph
// across the bottom left, so both windows stop above it at y=1480 of 1620.
const homeCover = resolve(v3Root, "Vehicle Cover Candidates/Brawley/brawley-lakeside.jpg");
await encodeLadder(homeCover, "heroes/home", "home-wide", [960, 1280, 1920, 2560], { extract: { left: 0, top: 246, width: 2880, height: 1234 }, transform: "21:9 crop x=0..2880 y=246..1480; safety paragraph excluded; focal 50% 50%" });
await encodeLadder(homeCover, "heroes/home", "home-tall", [480, 720, 960], { extract: { left: 1120, top: 0, width: 1184, height: 1480 }, transform: "4:5 crop x=1120..2304 y=0..1480 centred on the vehicle; safety paragraph excluded" });

const santarosaCover = resolve(v3Root, "Vehicle Cover Candidates/Santarosa/santarosa-hangar.jpg");
const brawleyCover = resolve(v3Root, "Vehicle Cover Candidates/Brawley/brawley-desert-three-quarter.jpg");
await encodeLadder(santarosaCover, "heroes/santarosa", "santarosa-wide", [960, 1280, 1920, 2560], { extract: { left: 0, top: 300, width: 2880, height: 1234 }, transform: "crop x=0..2880 y=300..1534; focal 34% 49%" });
await encodeLadder(santarosaCover, "heroes/santarosa", "santarosa-tall", [480, 720, 960], { extract: { left: 285, top: 0, width: 1410, height: 1762 }, transform: "crop x=285..1695 y=0..1762; focal 34% 49%" });
await encodeLadder(brawleyCover, "heroes/brawley", "brawley-wide", [960, 1280, 1920, 2560], { extract: { left: 0, top: 180, width: 2880, height: 1234 }, transform: "crop x=0..2880 y=180..1414; watermark excluded; focal 50% 55%" });
await encodeLadder(brawleyCover, "heroes/brawley", "brawley-tall", [480, 720, 960], { extract: { left: 1170, top: 0, width: 1131, height: 1414 }, transform: "crop x=1170..2301 y=0..1414; front three-quarter detail; focal 50% 55%" });

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

// Hub cards. Each 656x445 source draws the vehicle in one band of non-white rows and the
// concept wordmark in a separate lower band, with a white gap between them. Taking the upper
// band only drops the baked wordmark, so each name appears once as HTML text instead of twice,
// and centring that band leaves the vehicle centred rather than leaning left. The canvas is
// 16:10, the ratio the card slot already uses, so CSS never cover-crops these files.
const CARD_WIDTH = 656;
const CARD_HEIGHT = 410;

const vehicleBand = async (input) => {
  const { data, info } = await sharp(input).greyscale().raw().toBuffer({ resolveWithObject: true });
  const inked = (y, x) => data[y * info.width + x] < 244;
  const bands = [];
  let start = -1;
  for (let y = 0; y <= info.height; y += 1) {
    let count = 0;
    if (y < info.height) for (let x = 0; x < info.width; x += 1) if (inked(y, x)) count += 1;
    const on = y < info.height && count > info.width * 0.01;
    if (on && start < 0) start = y;
    if (!on && start >= 0) { bands.push([start, y - 1]); start = -1; }
  }
  if (bands.length < 2) throw new Error(`${basename(input)}: expected a vehicle band above a wordmark band, found ${bands.length}`);
  const [top, bottom] = bands[0];
  let left = info.width;
  let right = 0;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = 0; x < info.width; x += 1) if (inked(y, x)) { if (x < left) left = x; if (x > right) right = x; }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
};

// Sources are declared in one place. Six live in Assets; Laduna, Santarosa R, and Yuma Defense
// exist only in the external v3 archive, so that archive must be mounted for this step.
const hubCards = [
  ["indio", resolve(legacyRoot, "Concepts/concept-indio.jpg")],
  ["coachella", resolve(legacyRoot, "Concepts/concept-coachella.jpg")],
  ["brawley-r", resolve(legacyRoot, "Concepts/concept-brawley-r.jpg")],
  ["santarosa-r", conceptFile("Hub Cards", "santarosa-r-concept.jpg")],
  ["speedster", resolve(legacyRoot, "Concepts/concept-speedster.jpg")],
  ["yuma", resolve(legacyRoot, "Concepts/concept-yuma.jpg")],
  ["yuma-defense", conceptFile("Hub Cards", "yuma-defense-concept.jpg")],
  ["laduna", conceptFile("Hub Cards", "laduna-concept-blue-2.jpg")],
  ["balboa", resolve(legacyRoot, "Concepts/concept-balboa.jpg")],
];
for (const [slug, input] of hubCards) {
  const box = await vehicleBand(input);
  if (box.width > CARD_WIDTH || box.height > CARD_HEIGHT) throw new Error(`${slug}: vehicle band ${box.width}x${box.height} does not fit the ${CARD_WIDTH}x${CARD_HEIGHT} card`);
  const left = Math.floor((CARD_WIDTH - box.width) / 2);
  const top = Math.floor((CARD_HEIGHT - box.height) / 2);
  await encode(input, resolve(outputRoot, `v3/concepts/hub/${slug}-656.webp`), {
    extract: box,
    extend: { left, right: CARD_WIDTH - box.width - left, top, bottom: CARD_HEIGHT - box.height - top, background: "#FFFFFF" },
    transform: `vehicle band x=${box.left}..${box.left + box.width} y=${box.top}..${box.top + box.height} centred on a ${CARD_WIDTH}x${CARD_HEIGHT} white canvas; baked wordmark excluded`,
  });
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
// All four sources are natively 3:2 and are delivered at 3:2 so the photo modules share one
// slot. Desert and mountain-road carry the safety paragraph along their top edge; the desert
// window also drops a part-frame branded trailer at the left edge that no copy describes.
const legacyLifestyle = [
  ["Brawley-EV-desert-01-scaled.jpg", "desert", { left: 320, top: 160, width: 2560, height: 1707 }, "safety paragraph and part-frame trailer excluded"],
  ["Brawley-GTS-EV-interior-scaled.jpg", "interior"],
  ["Brawley-front-view-on-mountain-road-01-scaled.jpg", "mountain-road", { left: 0, top: 170, width: 2880, height: 1750 }, "safety paragraph excluded"],
  ["110A3943-HDR.jpg", "juniper"],
];
for (const [filename, slug, extract, note] of legacyLifestyle) {
  for (const width of [640, 960, 1280]) {
    await encode(resolve(assetsRoot, filename), resolve(outputRoot, `brawley/lifestyle/${slug}-${width}.webp`), {
      width,
      height: Math.round(width * 2 / 3),
      ...(extract ? { extract } : {}),
      transform: `${width}w 3:2 lifestyle${note ? `; ${note}` : ""}`,
    });
  }
}

await mkdir(brandRoot, { recursive: true });
const logoPdf = resolve(assetsRoot, "vanderhall logos/vanderhall logo with symbols.pdf");
const rawSvg = resolve(brandRoot, "lockup-source.svg");
await run("pdftocairo", ["-svg", logoPdf, rawSvg]);
let svg = await readFile(rawSvg, "utf8");
svg = svg.replace(/width="864pt" height="720pt" viewBox="0 0 864 720"/, 'width="585" height="61" viewBox="136 329 585 61"');
await writeFile(resolve(brandRoot, "vanderhall-lockup-horizontal.svg"), svg);

// Two-tone reverse for the dark footer and the dark-theme header. Painting all 23 fills white
// collapsed the shield: the artwork is stacked opaque shapes, so a flat knockout erased the
// inner field and both halves of the V and the lockup rendered as a silhouette. Only fill
// values change here, never geometry, so the file stays a recolour of the official vector.
const FOOTER_BACKGROUND = "#0E0E10";
const channel = (value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
const luminance = ([r, g, b]) => 0.2126 * channel(r / 255) + 0.7152 * channel(g / 255) + 0.0722 * channel(b / 255);
const parseHex = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
const contrast = (a, b) => {
  const [high, low] = [luminance(parseHex(a)), luminance(parseHex(b))].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};
// The grey that lands closest to a target contrast against the footer, so the values below are
// measured rather than picked by eye.
const greyAt = (target) => {
  let best = "#000000";
  for (let value = 0; value < 256; value += 1) {
    const hex = `#${value.toString(16).padStart(2, "0").repeat(3).toUpperCase()}`;
    if (Math.abs(contrast(hex, FOOTER_BACKGROUND) - target) < Math.abs(contrast(best, FOOTER_BACKGROUND) - target)) best = hex;
  }
  return best;
};

const SHIELD_MAX_X = 205;
const SOURCE_INK = {
  "rgb(0%, 0%, 0%)": "black",
  "rgb(50.19989%, 49.798584%, 49.798584%)": "frame",
  "rgb(50.999451%, 50.999451%, 50.999451%)": "mark",
  "rgb(100%, 100%, 100%)": "field",
};
// The frame's own mid grey already measures 4.88:1 on the footer, comfortably past the 3:1
// non-text floor, so it is kept rather than lightened. The black details become a grey that is
// separable from both the frame and the background, and the inner field becomes the footer
// value so it reads as a knockout instead of a white blob.
const REVERSE_INK = {
  wordmark: "#FFFFFF",
  detail: greyAt(2.2),
  frame: "#807F7F",
  field: FOOTER_BACKGROUND,
  mark: greyAt(9),
};
const reverseLockup = (source) => source.replace(/<(?:path|g)\b[^>]*?fill="rgb\([^"]*\)"[^>]*>/g, (element) => {
  const sourceFill = /fill="(rgb\([^"]*\))"/.exec(element)[1];
  const role = SOURCE_INK[sourceFill];
  if (!role) throw new Error(`Unmapped lockup fill ${sourceFill}. The reverse must be re-derived before it can ship.`);
  const geometry = /\sd="([^"]+)"/.exec(element)?.[1];
  const columns = geometry ? (geometry.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).filter((_, index) => index % 2 === 0) : [];
  // Black paints both the shield details and the ten wordmark letters, so the two are told
  // apart by position: the shield sits left of x=205 in this viewBox, the wordmark right of it.
  const isShield = columns.length > 0 && Math.max(...columns) < SHIELD_MAX_X;
  const value = role === "black" ? (isShield ? REVERSE_INK.detail : REVERSE_INK.wordmark) : REVERSE_INK[role];
  return element.replace(/fill="rgb\([^"]*\)"/, `fill="${value}"`);
});
const reverseSvg = reverseLockup(svg);
if ((reverseSvg.match(/fill="#/g) || []).length !== 23) throw new Error("The reverse lockup did not recolour all 23 fills");
await writeFile(resolve(brandRoot, "vanderhall-lockup-horizontal-white.svg"), reverseSvg);
console.log(`Lockup reverse: wordmark ${REVERSE_INK.wordmark} ${contrast(REVERSE_INK.wordmark, FOOTER_BACKGROUND).toFixed(2)}:1, frame ${REVERSE_INK.frame} ${contrast(REVERSE_INK.frame, FOOTER_BACKGROUND).toFixed(2)}:1, detail ${REVERSE_INK.detail} ${contrast(REVERSE_INK.detail, FOOTER_BACKGROUND).toFixed(2)}:1 (${contrast(REVERSE_INK.detail, REVERSE_INK.frame).toFixed(2)}:1 against the frame), marks ${REVERSE_INK.mark} ${contrast(REVERSE_INK.mark, FOOTER_BACKGROUND).toFixed(2)}:1`);
const shield = svg.replace(/width="585" height="61" viewBox="136 329 585 61"/, 'width="66" height="61" viewBox="136 329 66 61"');
const favicon = shield.replace("</svg>", '<style>path,use{fill:#000000}@media(prefers-color-scheme:dark){path,use{fill:#FFFFFF}}</style></svg>');
await writeFile(resolve(brandRoot, "favicon.svg"), favicon);
await rm(rawSvg);
record(resolve(brandRoot, "vanderhall-lockup-horizontal.svg"), logoPdf, "vector crop viewBox 136 329 585 61");
record(resolve(brandRoot, "vanderhall-lockup-horizontal-white.svg"), logoPdf, `two-tone reverse for dark surfaces: wordmark ${REVERSE_INK.wordmark}, shield frame ${REVERSE_INK.frame}, shield details ${REVERSE_INK.detail}, inner field ${REVERSE_INK.field}, marks ${REVERSE_INK.mark}; fills only, geometry unchanged`);
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
