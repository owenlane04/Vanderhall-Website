// V22. The six footer glyphs, read from the delivered files at build time rather than pasted into a
// string here.
//
// That is the whole point of this module. Every one of these marks is a registered trademark used
// under terms that require it be reproduced complete and unaltered, and the manifest at
// assets/brand/social/RIGHTS.md is what records, per file, which source it came from and which
// permission language covers it. If the path data lived here as a literal, the manifest would be
// describing a file nobody renders and the built page would be showing artwork with no provenance at
// all. Reading the file means the bytes in the HTML are derived from the bytes on disk, so the
// manifest is about the thing that actually ships. A missing or unreadable file fails the build here,
// loudly, instead of quietly rendering an empty box where a brand's mark should be.
//
// Nothing inside the artwork is edited, including its colour. That is not caution for its own sake, it
// is what the files turned out to need:
//
//   - Facebook, Instagram, X and LinkedIn were downloaded as their brand centres' WHITE variants, which
//     is already the one colour this footer wants. There is nothing to change.
//   - TikTok and YouTube (the two CC0 files) carry no fill attribute at all, so they inherit
//     `currentColor` from the wrapper below, which the stylesheet sets to white.
//
// An earlier version of this module stripped fill attributes to force currentColor everywhere, and it
// silently broke two of the six. Sketch exports the Meta marks inside a `<g fill="none">` wrapper with
// the real white fill on an inner group; removing the inner fill left the outer "none" in charge and
// both glyphs rendered as empty space. They still passed every geometry and accessibility assertion,
// because an invisible path has exactly the same bounding box as a visible one. It was caught by
// looking at them. Hence this rule: the bytes between the <svg> tags are the brand's, untouched, and
// what the build controls is the wrapper around them.
//
// White is an approved single-colour rendering for all six: Facebook's secondary white logo,
// Instagram's "any solid colour... we recommend black or white", X's "the X logo is black or white",
// LinkedIn's blue/black/white, and YouTube's monochrome fallback. Grey is approved by Instagram alone,
// so check-content refuses any fill in this row that is not white, currentColor, or none.
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const socialDir = resolve(websiteRoot, "assets/brand/social");

// The keys are exactly the labels in SOCIAL_LINKS, lowercased. Adding a destination without adding a
// file, or vice versa, is a build failure rather than a silent gap.
// LinkedIn is the odd one out and it is deliberate. Its brand centre ships the "in" bug as PNG and EPS
// only, with no SVG, and one of the two published rasters is already the white variant meant for dark
// backgrounds. So LinkedIn's mark is delivered as that file, unaltered, rather than being traced into a
// vector: redrawing a trademark to match a stylesheet is exactly the alteration every one of these
// licences forbids, and a conversion is a redrawing however careful it is. The cost is that this one
// glyph cannot inherit currentColor, which is fine because the file is already the approved colour.
export const SOCIAL_GLYPH_FILES = {
  facebook: "facebook.svg",
  instagram: "instagram.svg",
  x: "x.svg",
  linkedin: "linkedin.png",
  tiktok: "tiktok.svg",
  youtube: "youtube.svg",
};

// A brand SVG arrives wrapped in its own <svg> element carrying that brand's own width, height, fill
// and sometimes an XML prolog or a comment. What we want is the geometry and the coordinate system it
// is drawn in: the viewBox, and everything inside the root element. The rest is replaced by this
// site's own attributes so all six render at one size in one color.
const parseGlyph = (source, file) => {
  const open = source.match(/<svg\b[^>]*>/i);
  if (!open) throw new Error(`${file}: no <svg> element found`);
  const viewBox = (open[0].match(/viewBox\s*=\s*"([^"]+)"/i) || [])[1];
  if (!viewBox) throw new Error(`${file}: the artwork has no viewBox, so it cannot be scaled safely`);
  const inner = source
    .slice(source.indexOf(open[0]) + open[0].length, source.lastIndexOf("</svg>"))
    // Comments carry the brand centre's own export chatter and sometimes a licence header. The licence
    // belongs in RIGHTS.md where it can be read, not in every page's markup.
    .replace(/<!--[\s\S]*?-->/g, "")
    // <title> and <desc> go too, and they are the reason this row is checked for visible text at all.
    // Sketch stamps the Meta exports with "Fill 1" and "Created with Sketch."; Simple Icons ships a
    // <title> naming the platform. Inside an aria-hidden wrapper none of it reaches a screen reader,
    // but a <title> is a native tooltip, so hovering Facebook's mark would have popped up "Fill 1".
    // This is metadata about the file, not part of the mark, so removing it alters nothing published.
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/gi, "")
    .trim();
  if (!inner) throw new Error(`${file}: the artwork is empty once its wrapper is removed`);
  return { viewBox, inner };
};

const glyphs = new Map();
for (const [key, file] of Object.entries(SOCIAL_GLYPH_FILES)) {
  const path = resolve(socialDir, file);
  if (file.endsWith(".png")) {
    // Presence is still checked, so a deleted file fails the build rather than rendering a broken
    // image on forty pages. The bytes are served as a file rather than inlined.
    try {
      await readFile(path);
    } catch {
      throw new Error(`Missing footer social artwork: assets/brand/social/${file}.`);
    }
    glyphs.set(key, { raster: `/assets/brand/social/${file}` });
    continue;
  }
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch {
    throw new Error(`Missing footer social artwork: assets/brand/social/${file}. Every glyph in the footer row must be a real file from the platform's own brand centre or a stated public-domain source, recorded in assets/brand/social/RIGHTS.md. Do not hand-author path data to fill this gap.`);
  }
  glyphs.set(key, parseGlyph(source, file));
}

// aria-hidden, and focusable="false" for the older engines that put SVG in the tab order regardless:
// the anchor around it already carries the accessible name, and a mark the visitor cannot read should
// not announce itself twice or collect a stop of its own.
export const socialGlyph = (label) => {
  const glyph = glyphs.get(label.toLowerCase());
  if (!glyph) throw new Error(`No footer glyph for ${label}`);
  // Empty alt, not aria-hidden, because an <img> with no alt attribute at all announces its filename.
  // Either way the anchor's own label is the accessible name and the mark stays silent.
  if (glyph.raster) {
    return `<img class="footer-social__glyph" src="${glyph.raster}" width="30" height="30" loading="lazy" decoding="async" alt="">`;
  }
  return `<svg class="footer-social__glyph" viewBox="${glyph.viewBox}" width="30" height="30" fill="currentColor" aria-hidden="true" focusable="false">${glyph.inner}</svg>`;
};
