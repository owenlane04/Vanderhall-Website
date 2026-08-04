import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = resolve(websiteRoot, "..");
const assetsRoot = resolve(projectRoot, "Assets");
const outputRoot = resolve(websiteRoot, "assets/images");

await rm(resolve(outputRoot, "brawley"), { recursive: true, force: true });
await rm(resolve(outputRoot, "concepts"), { recursive: true, force: true });

const encode = async (input, output, options = {}) => {
  await mkdir(dirname(output), { recursive: true });
  let pipeline = sharp(input).rotate();
  if (options.extract) pipeline = pipeline.extract(options.extract);
  if (options.width && options.height) pipeline = pipeline.resize(options.width, options.height);
  else if (options.width) pipeline = pipeline.resize({ width: options.width, withoutEnlargement: true });
  if (options.extend) pipeline = pipeline.extend(options.extend);
  await pipeline.webp({ quality: 80, effort: 6, smartSubsample: true }).toFile(output);
};

const studioDir = resolve(assetsRoot, "Brawley Icons");
const studioFiles = (await readdir(studioDir)).filter((name) => name.toLowerCase().endsWith(".jpg")).sort();

const colorMap = [
  ["Atomic-Green", "atomic-green"],
  ["Bosco-Blue", "bosco-blue"],
  ["Concrete-Grey", "concrete-grey"],
  ["Emerald-Green", "emerald-green"],
  ["Ida-Rose", "ida-rose"],
  ["Ivory-White", "ivory-white"],
  ["Jean-Grey", "jean-grey"],
  ["Obsidian-Black", "obsidian-black"],
  ["Rossa", "rossa"],
  ["Royal-Blue", "royal-blue"],
];

const angleMap = [
  ["front-side-driver", "front-side-driver"],
  ["front-side-passenger", "front-side-passenger"],
  ["side-rear-diver", "side-rear-driver"],
  ["side-rear-passenger", "side-rear-passenger"],
  ["side-reverse", "side-reverse"],
  ["front", "front"],
  ["rear", "rear"],
  ["side", "side"],
];

const written = new Set();
for (const filename of studioFiles) {
  const color = colorMap.find(([needle]) => filename.includes(needle))?.[1];
  const angle = angleMap.find(([needle]) => filename.includes(needle))?.[1];
  if (!color || !angle) throw new Error(`Could not normalize ${filename}`);
  const output = resolve(outputRoot, `brawley/walkaround/${color}/${angle}.webp`);
  if (written.has(output)) continue;
  written.add(output);
  await encode(resolve(studioDir, filename), output, { width: 1600 });
}

const lifestyle = [
  ["Vanderhall Brawley White Easter Jeep Safari (138).jpg", "easter-sunset", [640, 960, 1600, 2400]],
  ["Brawley-EV-desert-01-scaled.jpg", "desert", [640, 960, 1280]],
  ["Brawley-GTS-EV-interior-scaled.jpg", "interior", [640, 960, 1280]],
  ["Brawley-GTS-off-road-EV-01.jpg", "off-road", [640, 960, 1280]],
  ["Brawley-front-view-on-mountain-road-01-scaled.jpg", "mountain-road", [640, 960, 1280]],
  ["110A3638-HDR.jpg", "mountain", [640, 960, 1280]],
  ["110A3943-HDR.jpg", "juniper", [640, 960, 1280]],
  ["Bralwey-steering-wheel-scaled.jpg", "steering", [640, 960, 1280]],
];

for (const [filename, slug, widths] of lifestyle) {
  const input = resolve(assetsRoot, filename);
  for (const width of widths) {
    const info = await stat(input);
    if (!info.isFile()) throw new Error(`Missing ${input}`);
    await encode(input, resolve(outputRoot, `brawley/lifestyle/${slug}-${width}.webp`), { width });
  }
}

await encode(
  resolve(assetsRoot, "Vanderhall Brawley White Easter Jeep Safari (138).jpg"),
  resolve(outputRoot, "brawley/lifestyle/easter-sunset-tall-1440.webp"),
  { extract: { left: 2836, top: 0, width: 3240, height: 4050 }, width: 1440, height: 1800 },
);
await encode(
  resolve(assetsRoot, "Vanderhall Brawley White Easter Jeep Safari (138).jpg"),
  resolve(outputRoot, "brawley/lifestyle/easter-sunset-tall-720.webp"),
  { extract: { left: 2836, top: 0, width: 3240, height: 4050 }, width: 720, height: 900 },
);
await encode(
  resolve(assetsRoot, "Vanderhall Brawley White Easter Jeep Safari (138).jpg"),
  resolve(outputRoot, "brawley/lifestyle/easter-sunset-tall-640.webp"),
  { extract: { left: 2836, top: 0, width: 3240, height: 4050 }, width: 640, height: 800 },
);
await encode(
  resolve(assetsRoot, "Vanderhall Brawley White Easter Jeep Safari (138).jpg"),
  resolve(outputRoot, "brawley/lifestyle/easter-sunset-tall-480.webp"),
  { extract: { left: 2836, top: 0, width: 3240, height: 4050 }, width: 480, height: 600 },
);
await encode(
  resolve(assetsRoot, "Vanderhall Brawley White Easter Jeep Safari (138).jpg"),
  resolve(outputRoot, "brawley/lifestyle/easter-sunset-tall-960.webp"),
  { extract: { left: 2836, top: 0, width: 3240, height: 4050 }, width: 960, height: 1200 },
);

const conceptImages = [
  ["concepts-Laduna-resized-blue.jpg", "laduna"],
  ["concepts-Santarosa-R.jpg", "santarosa-r"],
  ["concepts-Yuma-Defense.jpg", "yuma-defense"],
];

for (const [filename, slug] of conceptImages) {
  await encode(
    resolve(assetsRoot, filename),
    resolve(outputRoot, `concepts/${slug}.webp`),
    {
      extract: { left: 0, top: 0, width: 600, height: 260 },
      width: 900,
      height: 390,
      extend: { top: 105, bottom: 105, left: 0, right: 0, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    },
  );
}

await mkdir(resolve(websiteRoot, "assets/manuals"), { recursive: true });
await cp(
  resolve(assetsRoot, "Owner Manuals/2026_Vanderhall_Brawley_Owners_Manual_01132026.pdf"),
  resolve(websiteRoot, "assets/manuals/2026-brawley-owners-manual.pdf"),
);

console.log(`Encoded ${written.size} normalized walkaround frames, lifestyle variants, concept crops, and the 2026 manual.`);
