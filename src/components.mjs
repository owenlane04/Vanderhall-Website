import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { currentModels, models, pastModels } from "./data/models.mjs";
import { COUNTRIES, FORM_ENDPOINTS, INQUIRY_EMAIL, US_REGIONS } from "./data/forms.mjs";
import { FOOTNOTE_SYMBOLS, footnoteText } from "./data/footnotes.mjs";
import { IS_PROTOTYPE } from "./data/prototype.mjs";
import { CONTACT_CATEGORIES, CONTACT_TIMEFRAMES } from "./data/mock/contact.mjs";
import { campaignStatement } from "./data/mock/campaign.mjs";
import { formatDate } from "./data/adapters.mjs";
import { WORLD_BOX, WORLD_SIZE, mercatorPoint, worldBordersPath, worldLandPath } from "./data/worldmap.mjs";

// The public brand name, in one place. V13, Q-V13-25: `Vanderhall` only, across visible copy, titles,
// metadata, accessible labels, JSON-LD, and the web manifest. Every one of the ten source sites the plan
// enumerated now reads this constant or a string built from it, so the name cannot be changed on one
// surface and left on another. check-content bans the old phrase from delivered output outright.
export const BRAND = "Vanderhall";

// Delivered sizes are read from the build manifest rather than restated in data, because crops
// change: the hub cards are cut to their vehicle band and the corrected photographs are cut
// away from their baked disclaimer. Reading them keeps every width and height honest.
const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(resolve(websiteRoot, "assets/build-manifest.json"), "utf8"));
const deliveredSize = new Map(manifest
  .filter((entry) => entry.output_width && entry.output_height)
  .map((entry) => [`/${entry.delivered_file}`, { width: entry.output_width, height: entry.output_height }]));

export const sizeOf = (src) => {
  const size = deliveredSize.get(src);
  if (!size) throw new Error(`No delivered dimensions recorded for ${src}`);
  return size;
};

export const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

export const eyebrow = (text) => `<p class="eyebrow">${escapeHtml(text)}</p>`;

// ---------------------------------------------------------------------------------------------
// V13-F. Footnotes.
//
// One scope per region that prints its notes. A scope hands out symbols in first-use order, remembers how
// many times each note has been referenced, and renders the note block. Nothing anywhere in this build
// types an asterisk into copy: a row or a figure carries note IDs and the scope decides what mark it gets,
// which is the difference between this and the legacy site's habit of reusing `*` for different text on
// different pages.
//
// Why a scope rather than a module-level counter: two regions on one page must not share a symbol run, and
// two pages built in the same process must not share one at all. A build is a single Node process rendering
// twenty-odd pages, so any state outside a scope would leak across every page in the site.
//
// The note IDs are the DOM IDs (`fn-<noteId>`), so two notes can never collide, and a note referenced five
// times has one body and five backlinkable references. The note links back to its first reference.
export const footnoteScope = () => {
  const order = [];
  const counts = new Map();
  const mark = (ids = []) => {
    if (!ids?.length) return "";
    return `<sup class="fn-ref">${ids.map((id) => {
      footnoteText(id);
      if (!order.includes(id)) order.push(id);
      const index = order.indexOf(id);
      if (index >= FOOTNOTE_SYMBOLS.length) {
        throw new Error(`A page needs ${order.length} footnotes; use numbered footnotes rather than a fourth asterisk`);
      }
      const count = (counts.get(id) ?? 0) + 1;
      counts.set(id, count);
      // The glyph is decorative and the accessible name is the label, so assistive technology receives
      // "Footnote 1" rather than a bare star it cannot interpret.
      return `<a id="fnref-${id}-${count}" href="#fn-${id}" aria-label="Footnote ${index + 1}"><span aria-hidden="true">${FOOTNOTE_SYMBOLS[index]}</span></a>`;
    }).join("")}</sup>`;
  };
  // tabindex="-1" on the note is what makes the forward jump move focus rather than only scroll: a
  // paragraph is not focusable by default, so without it a keyboard visitor arrives at the note visually
  // and is still, as far as the browser is concerned, back at the reference.
  const notes = () => (order.length
    ? `<div class="footnotes">${order.map((id, index) => `<p class="footnote" id="fn-${id}" tabindex="-1"><a class="footnote__back" href="#fnref-${id}-1" aria-label="Back to footnote ${index + 1} reference"><span aria-hidden="true">${FOOTNOTE_SYMBOLS[index]}</span></a> ${escapeHtml(footnoteText(id))}</p>`).join("")}</div>`
    : "");
  return { mark, notes, get used() { return order.length; } };
};

// V15-F: the visible sample markers are retired sitewide on Owen's instruction. The honesty they
// carried now rests entirely on the other two layers, which do not print: the production gate in
// src/data/prototype.mjs still refuses a production build while any blocker is open, and the
// remaining fixtures stay provably fictional by construction (reserved 555-01xx numbers,
// example.com hosts). check-content asserts the marker classes and their sentences appear in zero
// delivered files, the inverse of the V13 rule.

export const buttonLink = (label, href, variant = "primary") => `<a class="button button--${variant}" href="${href}">${escapeHtml(label)}</a>`;

export const textLink = (label, href) => `<a class="text-link" href="${href}">${escapeHtml(label)}<span aria-hidden="true"> →</span></a>`;

// One way back, in the same place on every page below the homepage, leading one level up. A
// parent link rather than a history control: it needs no script, and it behaves the same for a
// visitor who arrived from a search result as for one who walked in from the parent page.
export const backLink = ({ label, href }) => `<nav class="back-nav" aria-label="Breadcrumb"><a href="${href}"><span aria-hidden="true">← </span>${escapeHtml(label)}</a></nav>`;

// On the single-purpose form pages the header takes the form's own column, so the page reads as one
// document instead of a heading on the left with a form floating in the middle of it.
//
// V10 removed the eyebrow this used to take. Every one of the six calls passed a caps-register word
// that the h1 directly beneath it then said again: CONCEPTS over "Design studies", OWNERS over
// "Owner resources", VEHICLES over "Vehicles". Two titles, one of them small, is what Owen asked to
// stop. What replaces it is the accent mark the eyebrow was already carrying in its ::before, now
// standing on its own above the title. The mark is CSS on --marked, so there is no empty element in
// the accessibility tree pretending to be a label.
export const pageHeader = (title, intro, className = "", back = null) => `<header class="page-header page-header--marked${className ? ` ${className}` : ""}">${back ? backLink(back) : ""}<h1>${escapeHtml(title)}</h1>${intro ? `<p>${escapeHtml(intro)}</p>` : ""}</header>`;

// Venice and Carmel only. Owen confirmed their status in chat on 2026-08-05; the two current
// models carry no tag, because current is the default a visitor already assumes.
export const pastModelTag = () => `<p class="model-tag">Past model</p>`;

// V11 amendment, Owen on 2026-08-05: the tag goes beside the name rather than under it, "so there's
// less text, less lengthy text". It is a qualifier on the name, not a line of its own, and a pill on
// its own row read as a second heading. The wrapper exists because the tag has to stay the heading's
// immediate next sibling: that adjacency is what check-content asserts, and it is what keeps the tag
// from drifting away from the word it qualifies. It wraps to its own line on a narrow screen rather
// than squeezing the name.
export const modelHeadline = (name, { level = 3, pastModel = false } = {}) =>
  `<div class="model-headline"><h${level}>${escapeHtml(name)}</h${level}>${pastModel ? pastModelTag() : ""}</div>`;

// A null eyebrow takes the marked treatment instead, for the one section whose category word and
// title were the same word. Everywhere else the eyebrow says something the title does not, which is
// why V10 kept them: IN DETAIL, PAINT, SPECIFICATIONS and ORDER are categories, not repetitions.
export const sectionHeading = (eyebrowText, title, intro = "") => `<div class="section-heading${eyebrowText ? "" : " section-heading--marked"}">${eyebrowText ? eyebrow(eyebrowText) : ""}<h2>${escapeHtml(title)}</h2>${intro ? `<p>${escapeHtml(intro)}</p>` : ""}</div>`;

export const conceptCard = (concept, { eager = false, level = 2 } = {}) => {
  const { width, height } = sizeOf(concept.card.src);
  return `<article class="card">
    <div class="card__media"><img src="${concept.card.src}" width="${width}" height="${height}" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 45vw, 92vw" alt="${escapeHtml(concept.card.alt)}" loading="${eager ? "eager" : "lazy"}" decoding="async"></div>
    <div class="card__body">
      <h${level} class="card__title"><a class="card__link" href="/concepts/${concept.slug}/">${concept.name}</a></h${level}>
      <p class="card__descriptor">${escapeHtml(concept.category)}</p>
    </div>
  </article>`;
};

// A continuous band of all nine concepts across the top of the hub. Decorative: the nine real cards
// below stay the interactive index, and nothing in here is a link, a heading, or an article, so the
// one-h1 rule and the two exactly-nine card assertions are untouched.
//
// Two identical halves of nine, because the loop translates the track by exactly -50% and lands the
// tenth item where the first was. Eighteen img elements over nine URLs; each file is fetched once.
//
// aria-hidden sits on the viewport rather than the outer element, so the pause control stays in the
// accessibility tree while the decorative filmstrip leaves it. The control ships with the hidden
// attribute and site.js reveals it in the same block that sets data-ready, which is what starts the
// animation: motion can therefore never exist without its off switch, the walkaround's pattern.
export const conceptMarquee = (items) => {
  const item = (concept) => {
    const { width, height } = sizeOf(concept.card.src);
    // V11-F: every tile is lazy now, where four used to be eager. The band is display: none below
    // 768px, and an eager fetch there would pull four files to the front of the queue for something
    // the visitor will never see. Above the breakpoint this costs nothing, because the band sits in
    // the first viewport and lazy defers only what is off-screen.
    //
    // Worth knowing before optimising this further: these eighteen tiles are nine URLs, and they are
    // the same nine files the card grid below is built from. A phone that fetches them has fetched
    // nothing it did not already need, which verify-browser asserts by comparing the two URL sets
    // rather than by counting requests. The three eager fetches on this route stay where they were,
    // on the first three real cards in the index.
    return `<div class="concept-marquee__item">
        <img src="${concept.card.src}" width="${width}" height="${height}" sizes="${Math.round(656 / 2)}px" alt="" loading="lazy" decoding="async">
        <span class="concept-marquee__name">${escapeHtml(concept.name)}</span>
      </div>`;
  };
  const half = () => items.map(item).join("");
  // V11-F: the dissolve and the left mask are applied to the viewport, never to the bar. That is V10
  // amendment 1 as a standing rule rather than a one-off fix: the media fades, its controls do not,
  // because a control that is operable while it is hard to read is the defect. The bar therefore sits
  // outside everything that changes opacity, and the pause button stays at full contrast whether the
  // filmstrip behind the title is at the start of its dissolve or the end of it.
  return `<div class="concept-marquee bleed" data-marquee>
    <div class="concept-marquee__viewport" aria-hidden="true">
      <div class="concept-marquee__track">${half()}${half()}</div>
    </div>
    <div class="concept-marquee__bar">
      <button class="concept-marquee__toggle" type="button" aria-pressed="false" data-marquee-toggle hidden>Pause</button>
    </div>
  </div>`;
};

// Declares the slot honestly, so high-density phones fetch the 960 rung for section media.
// Capping this at a 2x density would cut the homepage image payload by about 180 KB and take
// mobile LCP from 3.8 s to 3.2 s, at the cost of sharpness on those screens. That tradeoff is
// Owen's to make, so the honest value ships until he calls it.
const SPLIT_SIZES = "(min-width: 768px) 45vw, 92vw";

const splitMedia = (image, { eager = false, sizes = SPLIT_SIZES } = {}) => {
  const { width, height } = sizeOf(image.src);
  return `<img src="${image.src}" srcset="${image.srcset}" width="${width}" height="${height}" sizes="${sizes}" alt="${escapeHtml(image.alt)}" loading="${eager ? "eager" : "lazy"}"${eager ? ' fetchpriority="high"' : ""} decoding="async">`;
};

// One section per vehicle, media on one side and content on the other, alternating down the
// page. The homepage passes one photograph and the vehicles page passes three, which is the
// only difference between the short version of this scroll and the fuller one.
export const vehicleSection = (model, { index, copy, eager = false, level = 3, withSupport = false, scope = null } = {}) => {
  // Each frame is a link to the model page, so the photograph answers a hover the way the concept
  // cards already do. It is removed from the tab order and hidden from assistive technology,
  // because the text link below says the same thing and should stay the one stop per section.
  const href = `/${model.slug}/`;
  const linked = (inner, className) => `<a class="${className}" href="${href}" tabindex="-1" aria-hidden="true">${inner}</a>`;
  const support = withSupport
    ? model.images.support.map((image) => linked(splitMedia(image, { sizes: "(min-width: 768px) 22vw, 46vw" }), "vehicle-section__support")).join("")
    : "";
  return `<section class="vehicle-section${index % 2 === 1 ? " vehicle-section--reverse" : ""}">
    <div class="vehicle-section__media">
      ${linked(splitMedia(model.images.lead, { eager }), "vehicle-section__lead")}
      ${support ? `<div class="vehicle-section__row">${support}</div>` : ""}
    </div>
    <div class="vehicle-section__body">
      ${modelHeadline(model.name, { level, pastModel: model.pastModel })}
      ${/* V13-F: the estimate note has to be resolved on the surface that prints the figure. These
            sentences carry torque, power and travel figures, and a note on the model page cannot qualify
            a sentence on the homepage, so the mark goes on the paragraph here and the lineup section
            prints the note itself. */""}
      <p>${escapeHtml(copy)}${model.copyNoteIds?.length && scope ? scope.mark(model.copyNoteIds) : ""}</p>
      ${textLink(`Explore ${model.name}`, `/${model.slug}/`)}
    </div>
  </section>`;
};

// V13-D. The compact past-model card, for the Past Models group on /vehicles/.
//
// One image, the name, one sentence, and a way in. It carries no support frames, no figures, no price, no
// warranty, and deliberately no `Past model` pill: the section heading above it already says so, and a
// status pill inside an already-labelled group is the same word twice. The pill does stay beside the h1 on
// each detail page, where there is no heading to supply the context.
export const pastModelCard = (model) => {
  const image = model.images.lead;
  const { width, height } = sizeOf(image.src);
  return `<article class="past-card">
    <a class="past-card__media" href="/${model.slug}/" tabindex="-1" aria-hidden="true"><img src="${image.src}" srcset="${image.srcset}" width="${width}" height="${height}" sizes="(min-width: 768px) 45vw, 92vw" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async"></a>
    <div class="past-card__body">
      <h3 class="past-card__title"><a href="/${model.slug}/">${escapeHtml(model.name)}</a></h3>
      <p>${escapeHtml(model.inventoryNote)}</p>
      ${textLink("View gallery", `/${model.slug}/`)}
    </div>
  </article>`;
};

// V13-F: the mark rides after the value, inside the row, and the scope is a required argument rather than
// an optional one. A row that carries note IDs and is rendered without a scope would print a figure whose
// qualifier silently vanished, so there is no default that lets that happen quietly.
export const specRows = (rows, scope) => rows
  .map((row) => {
    if (row.noteIds?.length && !scope) throw new Error(`The specification row "${row.label}" carries footnotes but was rendered without a footnote scope`);
    return `<div class="spec-row"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}${row.noteIds?.length ? scope.mark(row.noteIds) : ""}</strong></div>`;
  })
  .join("");

// A photograph, a label in the caps register, and the figures that photograph shows. V8 replaced
// the prose sentence with the paired specification group: the sentence described where the
// vehicle was parked, and the rows are both truer to the frame and verified.
//
// The group name is not rendered. The label already occupies the caps register, and a second caps
// line reading "Chassis and suspension" under a label reading CONTROL ARMS is noise. The rows
// label themselves. The label stays the caption's first child, which the build check asserts.
//
// A module with no figures runs full width with its label beneath, rather than taking the
// two-column layout and stranding a lone label in an empty half-column.
export const photoModule = (item, index, scope) => {
  const { width, height } = sizeOf(item.src);
  // The slot differs by layout, so the hint has to as well: a paired module's frame takes the wide
  // side of a two-column row, a plain one takes the whole content column. Declaring 58vw for a
  // full-width frame is what makes a 1440 viewport fetch the 960 rung for a 1200px slot and upscale.
  const sizes = item.specs ? "(min-width: 1024px) 58vw, 92vw" : "(min-width: 1280px) 1200px, 92vw";
  return `<figure class="photo-module${item.specs ? (index % 2 === 1 ? " photo-module--reverse" : "") : " photo-module--plain"}">
    <div class="photo-module__media"><img src="${item.src}" srcset="${item.srcset}" width="${width}" height="${height}" sizes="${sizes}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async"></div>
    <figcaption class="photo-module__body">
      <p class="eyebrow">${escapeHtml(item.label)}</p>${item.specs ? `<div class="photo-module__specs">${specRows(item.specs.rows, scope)}</div>` : ""}
    </figcaption>
  </figure>`;
};

export const photoScroll = (items, scope) => `<div class="photo-scroll">${items.map((item, index) => photoModule(item, index, scope)).join("")}</div>`;

// V13-C. The past-model gallery. Deliberately the simplest primitive that does the job, and deliberately
// the concept gallery's shape rather than a third image system: a photograph at the content width, its
// caption in the caps register beneath it, and nothing else. Six unrelated lifestyle and detail frames are
// not eight angles of one vehicle, so the Brawley walkaround is exactly the wrong pattern here; there is no
// carousel and no new JavaScript, because a vertical run of photographs needs neither.
export const galleryFigure = (item) => {
  const { width, height } = sizeOf(item.src);
  return `<figure class="photo-gallery__figure">
    <div class="photo-gallery__media"><img src="${item.src}" srcset="${item.srcset}" width="${width}" height="${height}" sizes="(min-width: 1280px) 1200px, 92vw" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async"></div>
    <figcaption class="photo-gallery__caption">${escapeHtml(item.label)}</figcaption>
  </figure>`;
};

export const gallery = (items) => `<div class="photo-gallery">${items.map(galleryFigure).join("")}</div>`;

// V12-A: modelBar() is retired. Owen on 2026-08-06, looking at /brawley/: the bar under the hero
// photograph read as clutter, and its three slots were each a repetition. The name it printed was
// already the h1 in the photograph directly above it. Its action was the hero's own button, said
// twice on one screen. Only the way back was unique to it, and that moves into the hero content,
// which keeps the sitewide rule of exactly one back link per page below the homepage. The class
// joins the retired-components list in check-content.mjs alongside pathways() and the unit toggle.

// V11-J: pathways() is retired. V11-D removed its homepage pair and V11-H removed its dealers pair,
// which were its last two callers, and a component with no callers is a thing that will be brought
// back by accident. Its four destinations all live in the primary navigation and the footer, on
// every page. The class joins the retired-components list in check-content.mjs, the treatment the
// card wall, the unit toggle and the ambient block have each had.

// The price is HTML text, never an image and never fetched, and the disclaimer is always visible
// rather than hidden behind a tooltip or a modal.
export const price = ({ label, value }, disclaimer, delivery) => `<p class="price">
    <span class="price__label">${escapeHtml(label)}</span>
    <span class="price__value">${escapeHtml(value)}<sup class="price__mark" aria-hidden="true">*</sup></span>
    ${delivery ? `<span class="price__delivery">${escapeHtml(delivery)}</span>` : ""}
    <span class="price__disclaimer">${escapeHtml(disclaimer)}</span>
  </p>`;

// Four figures already published in the specification table below, so the page never states a
// number the table does not.
export const figureBand = (figures, scope) => `<div class="gts-figures">${figures.map((figure) => `<div class="gts-figure">
      <span class="gts-figure__value">${escapeHtml(figure.value)}${figure.noteIds?.length ? scope.mark(figure.noteIds) : ""}</span>
      <span class="gts-figure__label">${escapeHtml(figure.label)}</span>
    </div>`).join("")}</div>`;

// The studio walkaround. Eight frames of one paint colour stacked in a fixed stage, with the
// other eight colours' frames declared on their swatches. Controls ship hidden and swatches ship
// disabled, so the no-JavaScript page shows a real photograph and a legible price list instead of
// dead controls; the island removes both on init.
export const walkaround = (gts) => {
  const initial = gts.paint.find((option) => option.slug === gts.defaultPaint);
  const { width, height } = sizeOf(initial.frames[0].split(",")[0].trim().split(/\s+/)[0]);
  const frameSizes = "(min-width: 1280px) 1140px, 92vw";
  const frame = (index, [angle, phrase]) => {
    const srcset = initial.frames[index];
    const src = srcset.split(",").at(-1).trim().split(/\s+/)[0];
    return `<img class="walkaround__frame${index === 0 ? " is-active" : ""}" src="${src}" srcset="${srcset}" sizes="${frameSizes}" width="${width}" height="${height}" alt="${index === 0 ? escapeHtml(`Brawley GTS in ${initial.name}, ${phrase}`) : ""}"${index === 0 ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"'} decoding="async"${index === 0 ? "" : ' aria-hidden="true"'} data-angle="${angle}">`;
  };
  const swatch = (option) => `<button class="swatch${option.slug === initial.slug ? " is-selected" : ""}" type="button" role="radio" aria-checked="${option.slug === initial.slug}" tabindex="${option.slug === initial.slug ? "0" : "-1"}" disabled aria-label="${escapeHtml(`${option.name}, ${option.tierLabel} paint, ${option.tierPrice}`)}" style="--swatch-color:${option.hex}" data-paint="${option.slug}" data-paint-name="${escapeHtml(option.name)}" data-tier-label="${escapeHtml(option.tierLabel)}" data-tier-price="${option.tierPrice}" data-complete="${option.complete}" ${option.complete ? "data-frames" : "data-still"}="${option.frames.join(", ")}"><span aria-hidden="true"></span></button>`;
  return `<section class="walkaround" data-walkaround data-paint="${initial.slug}">
    ${sectionHeading("PAINT", "Choose a color. Take a look around.")}
    <div class="walkaround__stage" tabindex="0" role="group" aria-roledescription="360 viewer" aria-label="${escapeHtml(`Brawley GTS 360 viewer, ${initial.name}`)}" data-walkaround-stage>
      ${gts.angles.map((angle, index) => frame(index, angle)).join("")}
    </div>
    <div class="walkaround__controls" data-walkaround-controls hidden>
      <button class="icon-button" type="button" data-walkaround-prev aria-label="Previous angle"><span aria-hidden="true">←</span></button>
      <div class="walkaround__dots" aria-hidden="true">${gts.angles.map((_, index) => `<span${index === 0 ? ' class="is-active"' : ""}></span>`).join("")}</div>
      <button class="icon-button" type="button" data-walkaround-next aria-label="Next angle"><span aria-hidden="true">→</span></button>
    </div>
    <p class="walkaround__hint" data-walkaround-hint>DRAG TO ROTATE</p>
    <p class="walkaround__caption" data-walkaround-caption><strong data-paint-name>${escapeHtml(initial.name)}</strong><span data-paint-tier>${escapeHtml(initial.tierLabel)} paint, ${initial.tierPrice}</span></p>
    <div class="sr-only" aria-live="polite" data-walkaround-live></div>
    <div class="swatch-tiers" role="radiogroup" aria-label="Paint">
      ${gts.tiers.map((tier) => `<div class="swatch-tier">
        <p class="swatch-tier__label">${escapeHtml(tier.label)} color<span aria-hidden="true"> · </span><span class="sr-only">, </span>${tier.price}</p>
        <div class="swatches">${gts.paint.filter((option) => option.tier === tier.key).map(swatch).join("")}</div>
      </div>`).join("")}
    </div>
    <p class="walkaround__note" data-walkaround-note>Jean Grey has a partial studio set, so it is shown as a single still image.</p>
  </section>`;
};

// The sources of every ambient video ship with no src attribute at all, only data-src, and this is
// the load gate rather than a convention. A page that is not eligible for video, or has no
// JavaScript, cannot request a byte of it: there is nothing for the parser to fetch. That is also
// why no video here carries autoplay or preload="auto". site.js supplies the src, once, after the
// load event and once the block is near the viewport.
const videoSources = ({ webm, mp4 }) => `<source data-src="${webm}" type="video/webm"><source data-src="${mp4}" type="video/mp4">`;

// The control ships hidden and site.js reveals it when it has actually attempted playback, so a
// visitor is never offered a pause for something that is not moving, and never left with motion and
// no way to stop it. It is labelled from the real state of the element, not from an assumption:
// if autoplay is refused, the same button reveals itself reading Play.
const videoToggle = (className) => `<button class="${className}" type="button" data-ambient-toggle hidden>Pause</button>`;

export const hero = ({ src, srcset, tallSrcset, alt, focal, align = "", content, width = 1920, height = 823, video = null }) => `<section class="hero bleed${align === "end" ? " hero--content-end" : ""}" style="--hero-focal:${focal}"${video ? " data-ambient" : ""}>
    <div class="hero__media"><picture>${tallSrcset ? `<source media="(max-width: 767px)" srcset="${tallSrcset}" sizes="100vw">` : ""}<img class="hero__image" src="${src}" srcset="${srcset}" sizes="100vw" width="${width}" height="${height}" alt="${escapeHtml(alt)}" loading="eager" fetchpriority="high" decoding="async"></picture>${video ? `<video class="hero__video" muted playsinline loop preload="none" tabindex="-1" aria-hidden="true" data-ambient-video>${videoSources(video)}</video>` : ""}</div>
    <div class="hero__scrim" aria-hidden="true"></div>
    <div class="hero__content">${content}</div>
    ${video ? `<div class="hero__bar">${videoToggle("hero__toggle")}</div>` : ""}
  </section>`;

// V11-A: ambientVideo() is retired with the two below-fold loops it rendered, on /brawley/ and
// /brawley/gts/. The homepage hero is the site's one moving image and it takes its video through
// hero() above, because there the film sits behind page content rather than in a figure of its own.
// The .ambient class family joins the retired-components list in check-content.mjs.
//
// What the block taught is kept in hero(): the poster is never removed and never covered by anything
// but the decoded video, so the switch is a cross-fade rather than a flash of black, and both are
// declared at the same 1900 by 900 box so it cannot move a pixel.

// The purchase page's reference block, and the only spec table left on the site. Model pages pair
// their groups with photographs instead. Imperial only since V8: the manufacturer's own pages
// carry broken conversions, and deriving a second unit system here would mean publishing figures
// Vanderhall never stated.
export const specTable = (model, scope) => `<div class="spec-table">
    ${model.specGroups.map((group) => `<div class="spec-group">
      <h3>${escapeHtml(group.name)}</h3>
      <div class="spec-rows">${specRows(group.rows, scope)}</div>
    </div>`).join("")}
  </div>`;

// Warranty and, since V13-F, the estimate sentence as a real footnote rather than a third paragraph.
//
// The order matters and it is not stylistic: warranty is a disclosure with its own meaning, so it stays a
// paragraph, and the footnote block follows it because it belongs to the figures above rather than to the
// warranty beside it. Price disclaimers, warranty terms, and safety copy are separate disclosure types and
// none of them ever becomes an asterisk note.
//
// The past models no longer reach this component at all: a gallery publishes no figure, so it has no
// warranty line to qualify, no model-year qualifier to state, and no estimate note to resolve.
export const specNote = (model, scope) => {
  const lines = [model.warranty].filter(Boolean);
  const notes = scope?.notes() || "";
  if (!lines.length && !notes) return "";
  return `<div class="spec-note">${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}${notes}</div>`;
};

const requiredMark = `<span aria-hidden="true"> *</span><span class="sr-only"> required</span>`;
const label = (id, text, required = false) => `<label for="${id}">${text}${required ? requiredMark : ""}</label>`;
const error = (id) => `<span class="field__error" id="${id}-error"></span>`;
const countryOptions = `<option value="">Select a country</option>${COUNTRIES.map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`).join("")}`;

const integrationFields = (formId, submitLabel) => `
  <div class="honeypot" aria-hidden="true"><label>Company<input name="honeypot" tabindex="-1" autocomplete="off"></label></div>
  <input type="hidden" name="render_timestamp" value="">
  <input type="hidden" name="form_id" value="${formId}">
  <input type="hidden" name="page" value="">
  <div class="form-submit-row"><button class="button button--primary" type="submit" data-submit-label="${submitLabel}">${submitLabel}</button></div>
  ${/* V15-F: the pre-submit "not connected" note is gone. The form still transmits nothing; on
        submit, site.js answers with one true sentence directing the visitor to the inquiry address,
        so nobody's message silently disappears and nothing pretends to have sent. */""}
  ${/* V16-A: the required-fields key reads at the foot of the form rather than the head. */""}
  <p class="form-key">Fields marked * are required.</p>
  <p class="form-status" tabindex="-1" aria-live="polite"></p>`;

const formOpen = (id, formId) => `<form class="lead-form" id="${id}" novalidate data-site-form data-form-id="${formId}" data-endpoint="${FORM_ENDPOINTS[formId] || ""}">
  <div class="form-error-summary" role="alert" tabindex="-1" hidden></div>`;

// V13-G. leadForm() is retired with the /dealers/ inquiry it served. Its identity is retired with it: the
// `request-info` form ID, the `#request-info` anchor, and the endpoint key are all gone, because the form
// that replaces it is not the same form. The old one asked for a ZIP, a checklist of interests and a
// timeframe in one step; contactForm() below has a category taxonomy, conditional ownership fields, and a
// support route that has nothing to do with sales. Letting the new submissions arrive under the old key
// would have meant John's endpoint receiving a payload labelled as something it is not.

// The Contact form. One accessible progressive form rather than the legacy multi-step page: visible step
// headings, a Back action that preserves what has been typed, and every branch reachable by keyboard.
//
// The progressive behaviour is entirely additive. Without JavaScript every step and every branch is visible
// and usable, which is why the step navigation ships hidden: a Continue button that cannot advance anything
// is worse than a longer form. site.js reveals the navigation, hides the branches that do not apply, and
// announces the step. That is the walkaround's rule applied to a form.
export const contactForm = (id = "contact-form") => {
  const branch = (category) => {
    const fields = [];
    if (category.subcategories) {
      fields.push(`<div class="field">${label(`${id}-${category.value}-subcategory`, "What is your request about?", true)}<select id="${id}-${category.value}-subcategory" name="subcategory" data-branch-required>${["<option value=\"\">Select a request type</option>", ...category.subcategories.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`)].join("")}</select>${error(`${id}-${category.value}-subcategory`)}</div>`);
    }
    if (category.topics) {
      fields.push(`<div class="field">${label(`${id}-${category.value}-topic`, "Request topic", true)}<select id="${id}-${category.value}-topic" name="topic" data-branch-required>${["<option value=\"\">Select a topic</option>", ...category.topics.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`)].join("")}</select>${error(`${id}-${category.value}-topic`)}</div>`);
    }
    if (category.models) {
      fields.push(`<div class="field">${label(`${id}-${category.value}-model`, "Model")}<select id="${id}-${category.value}-model" name="model" data-model-select>${["<option value=\"\">Select a model</option>", ...category.models.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}${option.pastModel ? " (past model)" : ""}</option>`)].join("")}</select>${error(`${id}-${category.value}-model`)}</div>`);
    }
    if (category.fields.includes("timeframe")) {
      fields.push(`<div class="field">${label(`${id}-${category.value}-timeframe`, "Purchase timeframe")}<select id="${id}-${category.value}-timeframe" name="timeframe">${["<option value=\"\">Select a timeframe</option>", ...CONTACT_TIMEFRAMES.map((option) => `<option>${escapeHtml(option)}</option>`)].join("")}</select>${error(`${id}-${category.value}-timeframe`)}</div>`);
    }
    if (category.fields.includes("postalCode")) {
      fields.push(`<div class="field">${label(`${id}-${category.value}-postal`, "ZIP or postal code")}<input id="${id}-${category.value}-postal" name="postalCode" autocomplete="postal-code" inputmode="numeric">${error(`${id}-${category.value}-postal`)}</div>`);
    }
    if (category.fields.includes("dealer")) {
      fields.push(`<div class="field">${label(`${id}-${category.value}-dealer`, "Dealer or location, if you know it")}<input id="${id}-${category.value}-dealer" name="dealerId" autocomplete="off">${error(`${id}-${category.value}-dealer`)}</div>`);
    }
    if (category.fields.includes("ownership")) {
      // The gate on every ownership field below it. A general documentation question must never be blocked
      // behind a VIN, which is why this is a question rather than an assumption.
      fields.push(`<fieldset class="field-group" data-radio-group data-ownership><legend>Do you own the vehicle?</legend><div class="radio-row">${["Yes", "No"].map((value) => `<label class="check"><input id="${id}-${category.value}-owns-${value.toLowerCase()}" type="radio" name="ownsVehicle" value="${value.toLowerCase()}"> <span>${value}</span></label>`).join("")}</div><span class="field__error" id="${id}-${category.value}-owns-error"></span></fieldset>`);
    }
    if (category.fields.includes("vin")) {
      const vinWhen = category.vinWhen ? ` data-vin-when="${category.vinWhen}"` : "";
      const ownershipGated = category.fields.includes("ownership") ? ' data-ownership-field' : "";
      fields.push(`<div class="field conditional-field" data-vin${vinWhen}${ownershipGated}>${label(`${id}-${category.value}-vin`, "VIN")}<input id="${id}-${category.value}-vin" name="vin" autocomplete="off" aria-describedby="${id}-${category.value}-vin-help ${id}-${category.value}-vin-error"><span class="field__help" id="${id}-${category.value}-vin-help">Seventeen characters, from the vehicle or its registration.</span>${error(`${id}-${category.value}-vin`)}</div>`);
    }
    if (category.fields.includes("dealerOfPurchase")) {
      fields.push(`<div class="field conditional-field" data-ownership-field>${label(`${id}-${category.value}-purchase-dealer`, "Dealer of purchase")}<input id="${id}-${category.value}-purchase-dealer" name="dealerOfPurchase" autocomplete="off">${error(`${id}-${category.value}-purchase-dealer`)}</div>`);
    }
    if (category.fields.includes("purchaseDate")) {
      fields.push(`<div class="field conditional-field" data-ownership-field>${label(`${id}-${category.value}-purchase-date`, "Purchase date")}<input id="${id}-${category.value}-purchase-date" name="purchaseDate" type="date" autocomplete="off">${error(`${id}-${category.value}-purchase-date`)}</div>`);
    }
    if (category.fields.includes("message")) {
      fields.push(`<div class="field">${label(`${id}-${category.value}-message`, "Message")}<textarea id="${id}-${category.value}-message" name="message" rows="4"></textarea>${error(`${id}-${category.value}-message`)}</div>`);
    }
    return `<div class="form-branch" data-branch="${category.value}">
      <h3 class="form-branch__title">${escapeHtml(category.label)}</h3>
      <p class="field__help">${escapeHtml(category.help)}</p>
      ${fields.join("")}
    </div>`;
  };
  return `${formOpen(id, "contact")}
    <p class="form-step-status" aria-live="polite" data-step-status></p>
    <fieldset class="form-fieldset form-step" data-step="1">
      <legend>Your details</legend>
      <div class="form-grid form-grid--pairs">
        <div class="field">${label(`${id}-first`, "First name", true)}<input id="${id}-first" name="firstName" autocomplete="given-name" required aria-required="true">${error(`${id}-first`)}</div>
        <div class="field">${label(`${id}-last`, "Last name", true)}<input id="${id}-last" name="lastName" autocomplete="family-name" required aria-required="true">${error(`${id}-last`)}</div>
      </div>
      <div class="field">${label(`${id}-email`, "Email", true)}<input id="${id}-email" name="email" type="email" autocomplete="email" inputmode="email" required aria-required="true">${error(`${id}-email`)}</div>
      ${/* Required in the prototype, and flagged for John. The legacy screen says contact information is
            required but publishes no HTML required state anywhere, so the real rule cannot be proven from
            the public UI. Q-V13-4: require it here and confirm the mapping before production. */""}
      <div class="field">${label(`${id}-phone`, "Phone", true)}<input id="${id}-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required aria-required="true">${error(`${id}-phone`)}</div>
      <div class="form-nav" data-form-nav hidden><button class="button button--secondary" type="button" data-step-next>Continue</button></div>
    </fieldset>
    <fieldset class="form-fieldset form-step" data-step="2">
      <legend>Your request</legend>
      ${/* Radios rather than the legacy select. Three options is a set to choose from rather than a list to
            search, radios expose the whole set to a screen reader at once, and arrow keys move between them
            without opening anything. */""}
      <fieldset class="field-group" data-radio-group data-category-group><legend>What can we help with?${requiredMark}</legend><div class="radio-column">${CONTACT_CATEGORIES.map((category) => `<label class="check"><input id="${id}-category-${category.value}" type="radio" name="category" value="${category.value}" required aria-required="true"> <span>${escapeHtml(category.label)}</span></label>`).join("")}</div><span class="field__error" id="${id}-category-error"></span></fieldset>
      <div class="form-nav" data-form-nav hidden><button class="button button--secondary" type="button" data-step-back>Back</button><button class="button button--secondary" type="button" data-step-next>Continue</button></div>
    </fieldset>
    <fieldset class="form-fieldset form-step" data-step="3">
      <legend>Details</legend>
      ${CONTACT_CATEGORIES.map(branch).join("")}
      <div class="form-nav" data-form-nav hidden><button class="button button--secondary" type="button" data-step-back>Back</button></div>
    </fieldset>
    ${integrationFields("contact", "Send request")}
  </form>`;
};

// The Santarosa Launch Edition interest form. A separate identity from Contact and from both dealer forms:
// a distinct route, a distinct endpoint key, and a distinct CRM destination once John supplies one. Every
// visible field Owen's boss specified is required.
//
// There is no consent checkbox, and its absence is deliberate rather than an oversight. Phone and email are
// both required and the introduction promises updates, which is marketing contact, and no approved email or
// SMS consent language was supplied. Inventing checkbox text would be inventing a legal statement, so the
// form collects nothing until legal supplies the wording; that is a production blocker, not a to-do.
export const launchInterestForm = (id = "santarosa-launch-interest-form") => `${formOpen(id, "santarosa-launch-interest")}
  <div class="form-grid form-grid--pairs">
    <div class="field">${label(`${id}-first`, "First name", true)}<input id="${id}-first" name="firstName" autocomplete="given-name" required aria-required="true">${error(`${id}-first`)}</div>
    <div class="field">${label(`${id}-last`, "Last name", true)}<input id="${id}-last" name="lastName" autocomplete="family-name" required aria-required="true">${error(`${id}-last`)}</div>
  </div>
  <div class="field">${label(`${id}-address`, "Address", true)}<input id="${id}-address" name="address" autocomplete="street-address" required aria-required="true">${error(`${id}-address`)}</div>
  <div class="form-grid form-grid--pairs">
    <div class="field">${label(`${id}-city`, "City", true)}<input id="${id}-city" name="city" autocomplete="address-level2" required aria-required="true">${error(`${id}-city`)}</div>
    <div class="field">${label(`${id}-state`, "State", true)}<select id="${id}-state" name="state" autocomplete="address-level1" required aria-required="true">${["<option value=\"\">Select a state</option>", ...US_REGIONS.map(([code, name]) => `<option value="${code}">${escapeHtml(name)}</option>`)].join("")}</select>${error(`${id}-state`)}</div>
  </div>
  ${/* Five digits with a help line rather than a pattern that rejects anything else. Q-V13-22 is
        unresolved: the campaign is stated as United States only, and nobody has said whether that includes
        the territories or a military post, so validation stays inclusive and the campaign owner defines
        eligibility before submissions open. */""}
  <div class="field">${label(`${id}-postal`, "ZIP", true)}<input id="${id}-postal" name="postalCode" autocomplete="postal-code" inputmode="numeric" required aria-required="true" aria-describedby="${id}-postal-help ${id}-postal-error"><span class="field__help" id="${id}-postal-help">Five digits, or your ZIP+4.</span>${error(`${id}-postal`)}</div>
  <div class="form-grid form-grid--pairs">
    <div class="field">${label(`${id}-phone`, "Phone", true)}<input id="${id}-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required aria-required="true">${error(`${id}-phone`)}</div>
    <div class="field">${label(`${id}-email`, "Email", true)}<input id="${id}-email" name="email" type="email" autocomplete="email" inputmode="email" required aria-required="true">${error(`${id}-email`)}</div>
  </div>
  ${integrationFields("santarosa-launch-interest", "Register your interest")}
</form>`;

export const recommendDealerForm = (id = "recommend-dealer-form") => `${formOpen(id, "recommend-dealer")}
  <div class="field">${label(`${id}-dealer-name`, "Recommended Dealer Name", true)}<input id="${id}-dealer-name" name="recommended_dealer_name" autocomplete="organization" required aria-required="true">${error(`${id}-dealer-name`)}</div>
  <div class="field">${label(`${id}-website`, "Website", true)}<input id="${id}-website" name="website" type="url" inputmode="url" autocomplete="url" required aria-required="true" aria-describedby="${id}-website-help ${id}-website-error"><span class="field__help" id="${id}-website-help">Include https://</span>${error(`${id}-website`)}</div>
  <fieldset class="form-fieldset"><legend>Specific individual we should contact</legend><div class="form-grid form-grid--pairs"><div class="field">${label(`${id}-contact-first`, "First name")}<input id="${id}-contact-first" name="contact_first_name" autocomplete="given-name">${error(`${id}-contact-first`)}</div><div class="field">${label(`${id}-contact-last`, "Last name")}<input id="${id}-contact-last" name="contact_last_name" autocomplete="family-name">${error(`${id}-contact-last`)}</div></div></fieldset>
  <div class="field">${label(`${id}-phone`, "Phone")}<input id="${id}-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel">${error(`${id}-phone`)}</div>
  <div class="field">${label(`${id}-email`, "Email")}<input id="${id}-email" name="email" type="email" inputmode="email" autocomplete="email">${error(`${id}-email`)}</div>
  <fieldset class="form-fieldset"><legend>Referring party's name</legend><div class="form-grid form-grid--pairs"><div class="field">${label(`${id}-referrer-first`, "First name")}<input id="${id}-referrer-first" name="referrer_first_name" autocomplete="given-name">${error(`${id}-referrer-first`)}</div><div class="field">${label(`${id}-referrer-last`, "Last name")}<input id="${id}-referrer-last" name="referrer_last_name" autocomplete="family-name">${error(`${id}-referrer-last`)}</div></div></fieldset>
  <div class="field">${label(`${id}-comments`, "Comments")}<textarea id="${id}-comments" name="comments" rows="5"></textarea>${error(`${id}-comments`)}</div>
  ${integrationFields("recommend-dealer", "Submit")}
</form>`;

const radioGroup = (id, name, legend, values = ["Yes", "No"], required = true) => `<fieldset class="field-group" data-radio-group><legend>${legend}${required ? requiredMark : ""}</legend><div class="radio-row">${values.map((value) => `<label class="check"><input id="${id}-${value.toLowerCase()}" type="radio" name="${name}" value="${value.toLowerCase()}"${required ? ' required aria-required="true"' : ""}> <span>${value}</span></label>`).join("")}</div><span class="field__error" id="${id}-error"></span></fieldset>`;
const requiredTextarea = (id, name, text) => `<div class="field">${label(id, text, true)}<textarea id="${id}" name="${name}" rows="5" required aria-required="true"></textarea>${error(id)}</div>`;

export const internationalDealerForm = (id = "international-dealer-form") => `${formOpen(id, "international-dealer-inquiry")}
  <fieldset class="form-fieldset form-section"><legend>Contact information</legend>
    <div class="field">${label(`${id}-dealer-name`, "Dealer Name", true)}<input id="${id}-dealer-name" name="dealer_name" autocomplete="organization" required aria-required="true">${error(`${id}-dealer-name`)}</div>
    <div class="field">${label(`${id}-name`, "Name", true)}<input id="${id}-name" name="name" autocomplete="name" required aria-required="true">${error(`${id}-name`)}</div>
    <div class="form-grid form-grid--pairs"><div class="field">${label(`${id}-day-phone`, "Day Phone", true)}<input id="${id}-day-phone" name="day_phone" type="tel" inputmode="tel" autocomplete="tel" required aria-required="true">${error(`${id}-day-phone`)}</div><div class="field">${label(`${id}-evening-phone`, "Evening Phone")}<input id="${id}-evening-phone" name="evening_phone" type="tel" inputmode="tel" autocomplete="tel">${error(`${id}-evening-phone`)}</div></div>
    <div class="field">${label(`${id}-email`, "Email", true)}<input id="${id}-email" name="email" type="email" inputmode="email" autocomplete="email" required aria-required="true">${error(`${id}-email`)}</div>
    <div class="field">${label(`${id}-street`, "Street Address", true)}<input id="${id}-street" name="street_address" autocomplete="address-line1" required aria-required="true">${error(`${id}-street`)}</div>
    <div class="field">${label(`${id}-street-2`, "Street Address 2")}<input id="${id}-street-2" name="street_address_2" autocomplete="address-line2">${error(`${id}-street-2`)}</div>
    <div class="form-grid form-grid--pairs"><div class="field">${label(`${id}-city`, "City", true)}<input id="${id}-city" name="city" autocomplete="address-level2" required aria-required="true">${error(`${id}-city`)}</div><div class="field">${label(`${id}-region`, "State / Province / Region", true)}<input id="${id}-region" name="state_province_region" autocomplete="address-level1" required aria-required="true">${error(`${id}-region`)}</div></div>
    <div class="form-grid form-grid--pairs"><div class="field">${label(`${id}-postal`, "ZIP / Postal Code", true)}<input id="${id}-postal" name="postal_code" autocomplete="postal-code" required aria-required="true">${error(`${id}-postal`)}</div><div class="field">${label(`${id}-country`, "Country", true)}<select id="${id}-country" name="country" autocomplete="country" required aria-required="true">${countryOptions}</select>${error(`${id}-country`)}</div></div>
    <div class="field">${label(`${id}-dealer-website`, "Dealer Website")}<input id="${id}-dealer-website" name="dealer_website" type="url" inputmode="url" autocomplete="url">${error(`${id}-dealer-website`)}</div>
  </fieldset>
  <fieldset class="form-fieldset form-section"><legend>Dealer area</legend><p class="field__help">What City(s) and State(s)/Province(s) are you inquiring about (include postal code)?</p>
    <div class="field">${label(`${id}-area-country`, "Country")}<select id="${id}-area-country" name="area_country" autocomplete="country-name">${countryOptions}</select>${error(`${id}-area-country`)}</div>
    <div class="field">${label(`${id}-area-region`, "State / Province")}<input id="${id}-area-region" name="area_state_province" autocomplete="address-level1">${error(`${id}-area-region`)}</div>
    <div class="form-grid form-grid--pairs"><div class="field">${label(`${id}-area-city`, "City", true)}<input id="${id}-area-city" name="area_city" autocomplete="address-level2" required aria-required="true">${error(`${id}-area-city`)}</div><div class="field">${label(`${id}-area-postal`, "Postal Code", true)}<input id="${id}-area-postal" name="area_postal_code" autocomplete="postal-code" required aria-required="true">${error(`${id}-area-postal`)}</div></div>
  </fieldset>
  <fieldset class="form-fieldset form-section"><legend>Facility information</legend>
    ${radioGroup(`${id}-facility-status`, "facility_status", "Facility Status", ["Current", "Proposed"])}
    ${[["building-size", "building_size_sq_ft", "Building Size"], ["showroom-size", "showroom_size_sq_ft", "Showroom Size"], ["service-size", "service_area_size_sq_ft", "Service Area Size"], ["demo-size", "demo_ride_site_sq_ft", "Demo Ride Site"]].map(([slug, name, text]) => `<div class="field">${label(`${id}-${slug}`, text, true)}<div class="input-suffix"><input id="${id}-${slug}" name="${name}" inputmode="numeric" pattern="[0-9, ]+" required aria-required="true"><span>Sq. ft</span></div>${error(`${id}-${slug}`)}</div>`).join("")}
    ${requiredTextarea(`${id}-facility-description`, "facility_description", "Facility Description")}
    <div class="field">${label(`${id}-business-info`, "Business Info")}<textarea id="${id}-business-info" name="business_info" rows="5"></textarea>${error(`${id}-business-info`)}</div>
  </fieldset>
  <fieldset class="form-fieldset form-section"><legend>Dealership info</legend>
    ${requiredTextarea(`${id}-why-area`, "why_area", "Why do you think this area would be a good location for a Vanderhall dealership?")}
    ${requiredTextarea(`${id}-learned`, "opportunity_source", "Where did you learn about potential Vanderhall dealership opportunities?")}
    ${requiredTextarea(`${id}-right-fit`, "right_fit", "Why do you think you are the right fit for a Vanderhall dealership, and why do you want to become a Vanderhall dealer?")}
    ${requiredTextarea(`${id}-products`, "current_products", "What products do you currently sell? Please be specific with brands and annual quantities.")}
    ${radioGroup(`${id}-computer-system`, "computer_based_system", "Do you currently use a computer-based business or inventory management system?")}
    <div class="field conditional-field">${label(`${id}-program-name`, "If yes, program name")}<input id="${id}-program-name" name="computer_system_program">${error(`${id}-program-name`)}</div>
    <div class="field">${label(`${id}-ad-budget`, "What is your annual advertising budget?", true)}<input id="${id}-ad-budget" name="annual_advertising_budget" inputmode="decimal" required aria-required="true">${error(`${id}-ad-budget`)}</div>
    ${radioGroup(`${id}-other-market`, "consider_other_market", "Are you willing to consider another market?")}
    <div class="field conditional-field">${label(`${id}-other-markets`, "If yes, list other markets")}<textarea id="${id}-other-markets" name="other_markets" rows="3"></textarea>${error(`${id}-other-markets`)}</div>
  </fieldset>
  ${integrationFields("international-dealer-inquiry", "Submit inquiry")}
</form>`;

// V13. Owners leaves the primary navigation and Experience takes its place, per Q-V13-17. Dealers stays and
// becomes the locator; the header action is Contact, which is now a route of its own rather than a second
// name for Dealers.
//
// Every route below Experience marks it current: the hub, the archive, and each article. An eventual
// /events/ joins that prefix list when the route exists, and not before. Owner manuals stays reachable from
// the footer on every page, which is asserted rather than assumed.
const navItems = [
  ["Vehicles", "/vehicles/", ["/vehicles", ...models.map((model) => `/${model.slug}`)]],
  ["Concepts", "/concepts/", ["/concepts"]],
  ["Experience", "/experience/", ["/experience", "/blog"]],
  ["Dealers", "/dealers/", ["/dealers"]],
];

const isCurrent = (path, prefixes) => prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

export const header = (path) => `<a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" data-header>
    <div class="site-header__inner">
      <a class="brand" href="/"><img src="/assets/brand/vanderhall-lockup-horizontal-white.svg" alt="Vanderhall home" width="269" height="28"></a>
      <nav class="desktop-nav" aria-label="Primary">
        ${navItems.map(([name, href, prefixes]) => `<a class="nav-link${isCurrent(path, prefixes) ? " is-current" : ""}" href="${href}"${isCurrent(path, prefixes) ? ' aria-current="page"' : ""}>${name}</a>`).join("")}
      </nav>
      <div class="site-header__actions">
        <a class="button button--primary header-request" href="/contact/">Contact Us</a>
        <button class="icon-button menu-button" type="button" data-open-menu aria-label="Open menu" aria-expanded="false"><span aria-hidden="true">☰</span></button>
      </div>
    </div>
  </header>
  <div class="sheet" data-menu-sheet hidden aria-hidden="true">
    <div class="sheet__top"><img class="brand brand--sheet" src="/assets/brand/vanderhall-lockup-horizontal-white.svg" alt="Vanderhall" width="211" height="22"><button class="icon-button" type="button" data-close-menu aria-label="Close menu">×</button></div>
    <nav class="mobile-nav" aria-label="Mobile primary">
      ${navItems.map(([name, href]) => `<a href="${href}">${name}</a>`).join("")}
      <a class="button button--primary" href="/contact/">Contact Us</a>
    </nav>
  </div>
  <div class="sheet-backdrop" data-sheet-backdrop hidden></div>`;

// Vanderhall's own destinations, supplied by Owen in chat on 2026-08-05. Every URL he pasted came
// off his own screen carrying Google's cross-domain linker parameters, Facebook's referrer tag, or a
// campaign source, all of which are artefacts of his own session and no part of any address. They are
// stripped here, and check-content fails the build if one ever reaches the HTML: publishing them would
// hand every visitor a copy of one person's analytics identifiers. The check bans the parameter names
// as strings across this tree, which is why they are described here rather than written out.
export const SOCIAL_LINKS = [
  ["Facebook", "https://www.facebook.com/vanderhallusa/"],
  ["Instagram", "https://www.instagram.com/vanderhall/"],
  ["Twitter", "https://twitter.com/vanderhallusa"],
  ["LinkedIn", "https://www.linkedin.com/company/vanderhall"],
  ["TikTok", "https://www.tiktok.com/@vanderhallusa"],
  ["YouTube", "https://www.youtube.com/@VanderhallUSA"],
];

// Text, not store badges. Apple and Google both licence their badge artwork under brand terms this
// project has not cleared, and the same rule keeps the Brawley icon set on the open-items list for
// want of a rights manifest.
export const APP_LINKS = [
  ["Vanderhall app for iPhone", "https://apps.apple.com/us/app/vanderhall/id6761500330"],
  ["Vanderhall app for Android", "https://play.google.com/store/apps/details?id=com.vanderhall.customerapp"],
];

// V13. All three legal destinations are internal now. V10's reasoning for keeping two of them external was
// sound and has been answered rather than overruled: reproducing a safety notice or a job posting risked
// publishing a record Vanderhall had already changed, and the answer is that these routes are generated
// from an adapter rather than transcribed. Until John connects the authoritative sources, /safety/ carries
// explicitly fictional notices, keeps a clearly labelled link to Vanderhall's own portal as a fallback, and
// is blocked from production by the mock-data guard. Q-V13-10.
export const LEGAL_LINKS = [
  ["Safety notices", "/safety/"],
  ["Careers", "/careers/"],
  ["Privacy policy", "/privacy/"],
];

// V11-I. The six destinations become a fourth column rather than a horizontal caps row above the
// legal band, so they read as a section of the footer instead of a strip appended to it, and the
// sr-only heading becomes a visible "Follow" that matches the other three columns.
//
// Text, not glyphs, and this is a change from the V11 plan rather than a shortcut. The plan's own
// constraint was inline SVG "under a stated license", and it named Simple Icons because that
// collection is CC0. Two of the six are not in it: LinkedIn was removed at v14.0.0 following
// Microsoft's legal notice, and LinkedIn's brand guidelines say third parties generally may not use
// its logo; Twitter left with the X rebrand, so the collection's glyph is X while Owen's destination
// and label are Twitter. Shipping four marks and two bare words would read as unfinished, and
// reinstating LinkedIn's mark from an older release would mean publishing artwork its owner asked to
// have withdrawn. Owen chose all six as text on 2026-08-05. It is the same rule that keeps the two
// app store links as text: this project publishes a brand's artwork only under terms it can state.
//
// The visible word is the first half of the accessible name, so the longer label is additive and
// Label in Name (WCAG 2.5.3) holds.
// V13 changes three things about this footer and leaves everything else where V11-I put it.
//
// 1. A fifth column, Experience, carrying the hub and the archive. Events joins it when that route exists.
// 2. Owners leads with `Owner manuals` rather than `Owner resources`, pointing at the same /owners/ route.
//    That link is now the ONLY way into the manual library from the chrome, because Owners left the primary
//    navigation, so it appears on every page and check-content asserts it on every page.
// 3. Connect carries the complete inquiry address as visible text, immediately after Contact. Q-V13-26,
//    Owen on 2026-08-06: the whole point is that a visitor can read the address, so it is not hidden behind
//    an "Email us" label or an icon, and the accessible name is the address itself. The href is exactly
//    mailto: plus the address, with no subject, no body, no query, and no script: a convenience route, not
//    a form endpoint. That choice accepts ordinary address-scraping in exchange for the access Owen asked
//    for, which is a tradeoff he made knowingly.
export const footer = () => `<footer class="site-footer">
  <div class="footer-links">
    ${/* V15-G, Owen on 2026-08-06: four columns exactly. Experience folds into the Vehicles column
          under Concepts, and Blog leaves the footer entirely because the blog is part of Experience. */""}
    <div><h2>Vehicles</h2>${models.map((model) => `<a href="/${model.slug}/">${model.name}</a>`).join("")}<a href="/concepts/">Concepts</a><a href="/experience/">Experience</a></div>
    <div><h2>Owners</h2><a href="/owners/">Owner manuals</a><a href="https://shop.vanderhallusa.com/">Parts and apparel</a>${APP_LINKS.map(([label, href]) => `<a href="${href}">${escapeHtml(label)}</a>`).join("")}</div>
    <div><h2>Connect</h2><a href="/dealers/">Dealers</a><a href="/contact/">Contact</a><a class="footer-email" href="mailto:${INQUIRY_EMAIL}">${escapeHtml(INQUIRY_EMAIL)}</a><a href="/recommend-dealer/">Recommend a dealer</a><a href="/dealer-inquiry/">Become a dealer</a></div>
    <div class="footer-follow"><h2>Follow</h2>${SOCIAL_LINKS.map(([label, href]) => `<a href="${href}" aria-label="${BRAND} on ${escapeHtml(label)}">${escapeHtml(label)}</a>`).join("")}</div>
  </div>
  <div class="footer-legal">
    <img class="footer-lockup" src="/assets/brand/vanderhall-lockup-horizontal-white.svg" width="231" height="24" loading="lazy" decoding="async" alt="${BRAND}">
    <span>© 2026 ${BRAND}. Hand-built in Provo, Utah.</span>
    <ul class="footer-legal__links">${LEGAL_LINKS.map(([label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join("")}</ul>
  </div>
</footer>`;

// Structured data. Every value here is already published as visible text on the page that carries
// it, so the markup can never say something the visitor cannot read for themselves. JSON.stringify
// escapes the payload, and the one sequence that could still close the script early is neutralised.
export const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replaceAll("</", "<\\/")}</script>`;

const SITE_URL = "https://vanderhall-website.vercel.app";

export const organizationSchema = () => jsonLd({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: BRAND,
      url: `${SITE_URL}/`,
      // Still the dark-ink lockup, not the reverse the header now paints: a consumer of this markup
      // draws the logo on its own surface, usually a light one, where a white mark disappears.
      logo: `${SITE_URL}/assets/brand/vanderhall-lockup-horizontal.svg`,
      // Provo is the one company fact the site still publishes, in the footer line that appears on
      // every page. The founding date left with the V9 hero copy, and this markup may only restate
      // text a visitor can read, so it left here too rather than outliving its source.
      address: { "@type": "PostalAddress", addressLocality: "Provo", addressRegion: "UT", addressCountry: "US" },
      // Read from the same constant the footer renders, for the same reason the address may stay: a
      // visitor can read every one of these on this page. The app store links are deliberately not
      // here; sameAs is the organization's own profiles, and an app listing is a product page.
      sameAs: SOCIAL_LINKS.map(([, href]) => href),
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: BRAND,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
  ],
});

// The price, the currency, and every figure below are the approved values, and the reservation URL
// is the same one the page's own buttons use. Availability is InStock because Vanderhall's own page
// says the vehicle is now delivering; the regional caveat stays in the visible copy.
export const productSchema = (model) => {
  const gts = model.gts;
  const frame = gts.paint.find((option) => option.slug === gts.defaultPaint).frames[0].split(",").at(-1).trim().split(/\s+/)[0];
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${BRAND} ${gts.name}`,
    sku: "brawley-gts",
    description: gts.descriptor,
    url: `${SITE_URL}/brawley/gts/`,
    image: `${SITE_URL}${frame}`,
    brand: { "@type": "Brand", name: BRAND },
    manufacturer: { "@id": `${SITE_URL}/#organization` },
    offers: {
      "@type": "Offer",
      url: gts.reserveUrl,
      priceCurrency: "USD",
      price: gts.price.value.replace(/[$,]/g, ""),
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: BRAND },
    },
    additionalProperty: gts.figures.map((figure) => ({
      "@type": "PropertyValue",
      name: figure.label.charAt(0) + figure.label.slice(1).toLowerCase(),
      value: figure.value,
    })),
  });
};

// V15, folding in V14. BlogPosting markup for the two migrated articles. Every value restates
// visible page text or the record's own provenance: real title, real dates, real author, and the
// article's delivered hero image. The publisher is the Organization node the homepage declares.
export const blogPostingSchema = (post) => jsonLd({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: post.title,
  description: post.seo?.description || post.excerpt,
  url: `${SITE_URL}/blog/${post.slug}/`,
  mainEntityOfPage: `${SITE_URL}/blog/${post.slug}/`,
  datePublished: post.publishedAt,
  ...(post.updatedAt ? { dateModified: post.updatedAt } : {}),
  author: { "@type": "Organization", name: post.author },
  publisher: { "@id": `${SITE_URL}/#organization` },
  ...(post.hero ? { image: `${SITE_URL}${post.hero.src}` } : {}),
});

// mainClass carries the V11-E studio scope, and it goes on <main> rather than on .page for one
// mechanical reason: .page is capped at --w-page and centred, so a white field declared there would
// leave dark bands down both sides of a 1600px viewport. main is full width. The header and the
// footer sit outside it and stay dark, which is what D-V11-1 asked for.
// V13. The routes whose records are fictional carry a noindex while the prototype flag is set. Decided here
// from the path rather than passed in by each page builder, so a new mock-data route cannot forget it.
//
// This is a deliberate narrowing of the plan's "staging or mock-data deployments should be noindex", and the
// reason is proportion. This deployment is mostly real: deindexing the homepage, the two current models, the
// purchase page, the nine concepts, and the manual library because six new routes carry sample records would
// cost Vanderhall its actual search presence to protect against pages nobody has linked to yet.
//
// `/contact/` and `/privacy/` are deliberately absent from the list. Contact carries no invented record, only
// a null endpoint, which is the state the two dealer forms have shipped in since V3; and the privacy copy is
// Vanderhall's own text, stale rather than fabricated. robots.txt still allows crawling everywhere, because a
// Disallow rule would stop a crawler before it could read the tag, which is the classic way to leave a page
// indexed while believing it is hidden.
// V15: /experience and /blog leave the list. Their records are now the two real, previously
// published Vanderhall articles, so there is nothing fictional left to keep out of an index.
const NOINDEX_ROUTES = ["/dealers", "/careers", "/safety", "/santarosa/launch-edition"];
const isNoindex = (path) => IS_PROTOTYPE && NOINDEX_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));

// V16-C: the homepage opens through a veil. The animation is entirely CSS and self-removing (the
// final keyframe holds visibility hidden), so a visitor without JavaScript still reaches the page;
// the one script involved is the pre-paint session gate below, which keeps the veil to the first
// homepage view of a session rather than every return to it. Reduced motion never sees it.
const introVeil = () => `<div class="intro-veil" aria-hidden="true">
    <img class="intro-veil__logo" src="/assets/brand/vanderhall-lockup-horizontal-white.svg" alt="" width="585" height="61" decoding="async">
  </div>`;
const introGate = `<script>try{if(sessionStorage.getItem("vhw.intro"))document.documentElement.setAttribute("data-intro-seen","");else sessionStorage.setItem("vhw.intro","1")}catch(e){}</script>`;

export const shell = ({ title, description, path, body, schema = "", mainClass = "", intro = false }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="description" content="${escapeHtml(description)}">
  ${isNoindex(path) ? '<meta name="robots" content="noindex, follow">\n  ' : ""}<title>${escapeHtml(title)} | ${BRAND}</title>
  <link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/brand/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="canonical" href="${SITE_URL}${path === "/" ? "/" : `${path}/`}">
  <link rel="stylesheet" href="/styles/bundle.css">
  ${/* The one place this site withdraws something rather than adding it. These three controls need JavaScript
        and they render at first paint, so that becoming usable cannot shift the page; without scripting this
        block takes them away again, which leaves a no-JS visitor the complete dealer list and no control that
        could not work. A <noscript> style applies only when scripting is off, so it costs nobody else
        anything. */""}
  <noscript><style>[data-locator-search],[data-dealer-select]{display:none}</style></noscript>
  ${intro ? `${introGate}\n  ` : ""}${schema}
</head>
<body>
  ${intro ? `${introVeil()}\n  ` : ""}${header(path)}
  <main id="main"${mainClass ? ` class="${mainClass}"` : ""}>${body}</main>
  ${footer()}
  <script>addEventListener('load',()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const s=document.createElement('script');s.src='/scripts/site.js';document.body.append(s)})),{once:true})</script>
</body>
</html>`;

// ---------------------------------------------------------------------------------------------
// V13. New page components. Every one of them receives records as arguments and imports no adapter, so
// John replaces src/data/adapters.mjs and nothing below changes.
// ---------------------------------------------------------------------------------------------

// The allowlisted rich-text block model, shared by articles and safety notices.
//
// It throws on an unknown type for the same reason the privacy renderer does: a body that silently drops a
// block is a document that lost a paragraph without telling anybody, and a body that passes a CMS field
// through as HTML is an injection. Nothing here accepts markup. Every string is escaped.
//
// V15, folding in V14: paragraphs and list items may carry inline segments so the two migrated
// Vanderhall articles keep their links and emphasis without this model ever accepting source HTML.
// A segment is a plain string, or {text, href} for a link, or {text, strong} / {text, emphasis}.
// An href must be a site-internal path or https, and anything else throws rather than renders.
const inlineSegment = (segment) => {
  if (typeof segment === "string") return escapeHtml(segment);
  if (segment?.href !== undefined) {
    if (!/^(\/|https:\/\/)/.test(segment.href)) throw new Error(`Refusing an inline link href: ${segment.href}`);
    return `<a href="${escapeHtml(segment.href)}">${escapeHtml(segment.text)}</a>`;
  }
  if (segment?.strong) return `<strong>${escapeHtml(segment.text)}</strong>`;
  if (segment?.emphasis) return `<em>${escapeHtml(segment.text)}</em>`;
  throw new Error(`Unknown inline segment shape: ${JSON.stringify(segment)}`);
};
const inlineText = (block) => (block.segments ? block.segments.map(inlineSegment).join("") : escapeHtml(block.text));
const BODY_BLOCKS = {
  p: (block) => `<p>${inlineText(block)}</p>`,
  h2: (block) => `<h2>${escapeHtml(block.text)}</h2>`,
  h3: (block) => `<h3>${escapeHtml(block.text)}</h3>`,
  ul: (block) => `<ul>${block.items.map((item) => `<li>${Array.isArray(item) ? item.map(inlineSegment).join("") : escapeHtml(item)}</li>`).join("")}</ul>`,
  quote: (block) => `<blockquote class="prose__quote"><p>${escapeHtml(block.text)}</p>${block.attribution ? `<footer>${escapeHtml(block.attribution)}</footer>` : ""}</blockquote>`,
  image: (block) => {
    const { width, height } = sizeOf(block.src);
    return `<figure class="prose__figure"><img src="${block.src}"${block.srcset ? ` srcset="${block.srcset}"` : ""} width="${width}" height="${height}" sizes="(min-width: 1280px) 800px, 92vw" alt="${escapeHtml(block.alt)}" loading="lazy" decoding="async">${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}</figure>`;
  },
};

export const prose = (blocks) => `<div class="prose">${blocks.map((block) => {
  const render = BODY_BLOCKS[block.type];
  if (!render) throw new Error(`Unknown body block type: ${block.type}`);
  return render(block);
}).join("")}</div>`;

// ---------------------------------------------------------------------------------------------
// Editorial
// ---------------------------------------------------------------------------------------------
const postMeta = (post) => {
  const parts = [
    `<span class="post-meta__author">${escapeHtml(post.author)}</span>`,
    `<time datetime="${post.publishedAt}">${escapeHtml(formatDate(post.publishedAt))}</time>`,
  ];
  if (post.updatedAt) parts.push(`<span>Updated <time datetime="${post.updatedAt}">${escapeHtml(formatDate(post.updatedAt))}</time></span>`);
  if (post.readingMinutes) parts.push(`<span>${post.readingMinutes} min read</span>`);
  return `<p class="post-meta">${parts.join("")}</p>`;
};

const postImage = (image, { sizes, eager = false }) => {
  const { width, height } = sizeOf(image.src);
  return `<img src="${image.src}"${image.srcset ? ` srcset="${image.srcset}"` : ""} width="${width}" height="${height}" sizes="${sizes}" alt="${escapeHtml(image.alt)}" loading="${eager ? "eager" : "lazy"}"${eager ? ' fetchpriority="high"' : ""} decoding="async">`;
};

// A card whose record has no article body links nowhere and says so, rather than offering a link into an
// empty page. That state is not a defect to design around: it is the ordinary condition of a real archive
// with a story in progress, and the index has to look finished with one in it.
export const postCard = (post, { featured = false, wide = false, level = 3, linkable = true } = {}) => {
  const href = `/blog/${post.slug}/`;
  const title = linkable ? `<a class="post-card__link" href="${href}">${escapeHtml(post.title)}</a>` : escapeHtml(post.title);
  // V15: `wide` is the supporting story's treatment when it stands alone. A single card in the
  // three-column grid read as two-thirds of empty page, so a lone follow-up story takes the featured
  // split's shape, mirrored, at a quieter type size. Three or more stories take the grid as before.
  return `<article class="post-card${featured ? " post-card--featured" : ""}${wide ? " post-card--wide" : ""}">
    ${post.hero ? `<div class="post-card__media">${linkable ? `<a href="${href}" tabindex="-1" aria-hidden="true">${postImage(post.hero, { sizes: featured || wide ? "(min-width: 1024px) 60vw, 92vw" : "(min-width: 1024px) 30vw, 92vw", eager: featured })}</a>` : postImage(post.hero, { sizes: "(min-width: 1024px) 30vw, 92vw" })}</div>` : ""}
    <div class="post-card__body">
      ${/* V15: no category kicker. Owen's direction is one feed where every story presents the same
            way, so the record keeps its category for future filtering and the card stops printing it. */""}
      <h${level} class="post-card__title">${title}</h${level}>
      <p class="post-card__excerpt">${escapeHtml(post.excerpt)}</p>
      ${postMeta(post)}
      ${linkable ? "" : `<p class="post-card__pending">This story is not published yet.</p>`}
    </div>
  </article>`;
};

export const articleHeader = (post, back) => `<header class="page-header page-header--marked article-header">
  ${backLink(back)}
  ${/* V15: the category kicker is gone here for the same reason it left the cards. The title, the
        standfirst, and the meta line say everything the label said. */""}
  <h1>${escapeHtml(post.title)}</h1>
  <p class="article-header__standfirst">${escapeHtml(post.standfirst)}</p>
  ${postMeta(post)}
</header>`;

export const relatedPosts = (posts) => (posts.length
  ? `<section class="section--tight related">
      ${sectionHeading("MORE STORIES", "Related reading.")}
      <div class="card-grid card-grid--posts">${posts.map((post) => postCard(post, { level: 3, linkable: Boolean(post.bodyBlocks?.length) })).join("")}</div>
    </section>`
  : "");

// ---------------------------------------------------------------------------------------------
// Experience hub
// ---------------------------------------------------------------------------------------------
// The hub renders an ordered module description rather than a hand-built page, which is what makes Events an
// integration rather than a second redesign: a new approved module joins the list and lands here in place.
// An unknown type throws at build time. V13 launches with one module, and it has to look intentional with
// one, so the Blog area carries a real featured story, three cards, and one way into the archive.
export const experienceModules = (modules, { byId }) => modules.map((module) => {
  if (module.type !== "blog") throw new Error(`Unknown Experience module type: ${module.type}`);
  const featured = byId.get(module.featuredId);
  if (!featured) throw new Error(`Experience blog module references an unknown featured post: ${module.featuredId}`);
  const recent = module.recentIds.map((id) => {
    const post = byId.get(id);
    if (!post) throw new Error(`Experience blog module references an unknown post: ${id}`);
    return post;
  });
  // V15: the BLOG eyebrow is gone (the feed is one surface, not a category) and the heading takes
  // the marked treatment instead. The archive button renders only when the module carries one,
  // which V15 does not; see D-V15-3 in Plans/V15-plan.md.
  const supporting = recent.length === 1
    ? postCard(recent[0], { wide: true, level: 3, linkable: Boolean(recent[0].bodyBlocks?.length) })
    : (recent.length ? `<div class="card-grid card-grid--posts">${recent.map((post) => postCard(post, { level: 3, linkable: Boolean(post.bodyBlocks?.length) })).join("")}</div>` : "");
  return `<section class="section experience-module">
    ${sectionHeading(null, module.heading)}
    ${postCard(featured, { featured: true, level: 3, linkable: Boolean(featured.bodyBlocks?.length) })}
    ${supporting}
    ${module.archive ? `<div class="cluster">${buttonLink(module.archive.label, module.archive.href, "secondary")}</div>` : ""}
  </section>`;
}).join("");

// ---------------------------------------------------------------------------------------------
// Careers
// ---------------------------------------------------------------------------------------------
const jobFacts = (job) => `<ul class="fact-row">
  <li>${escapeHtml(job.department)}</li>
  <li>${escapeHtml(job.location)}</li>
  <li>${escapeHtml(job.workMode)}</li>
  <li>${escapeHtml(job.employmentType)}</li>
  ${job.compensation ? `<li>${escapeHtml(job.compensation)}</li>` : ""}
</ul>`;

export const jobCard = (job, { linkable = true, level = 2 } = {}) => {
  const href = `/careers/${job.slug}/`;
  return `<article class="record-card">
    <div class="record-card__head">
      ${/* h2 by default: on the index these are the first headings under the page title. */""}
      <h${level} class="record-card__title">${linkable ? `<a href="${href}">${escapeHtml(job.title)}</a>` : escapeHtml(job.title)}</h${level}>
    </div>
    ${jobFacts(job)}
    <p class="record-card__summary">${escapeHtml(job.summary)}</p>
    <p class="record-card__meta">Posted <time datetime="${job.postedAt}">${escapeHtml(formatDate(job.postedAt))}</time></p>
    ${/* V15-F: a card whose record has no detail page simply carries no action, rather than a
          sentence explaining the archive's internals. */""}
    ${linkable ? textLink("View this role", href) : ""}
  </article>`;
};

// The apply action, and the one thing it must never do is work. A mock apply that accepted a name and a
// resume and then discarded them would be collecting applicant data into nothing, so the control is a
// disabled button that says why, and the prototype has no upload, no fields, and no destination.
export const applyAction = (job) => (job.applyUrl
  ? `<div class="cluster">${buttonLink("Apply for this role", job.applyUrl)}</div>`
  : `<div class="cluster apply-disabled"><button class="button button--primary" type="button" disabled aria-describedby="apply-note">Apply for this role</button><p class="form-note" id="apply-note">Applications for this role are not open yet.</p></div>`);

export const jobSections = (sections) => sections.map((section) => `<section class="record-section">
  <h2>${escapeHtml(section.heading)}</h2>
  ${section.items.length === 1 ? `<p>${escapeHtml(section.items[0])}</p>` : `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`}
</section>`).join("");

// ---------------------------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------------------------
// Calm and authoritative, not a marketing page, and every key fact visible on the card without a hover: a
// visitor scanning for whether a notice concerns them should not have to open anything to find out.
export const safetyCard = (notice, { linkable = true, level = 2 } = {}) => {
  const href = `/safety/${notice.slug}/`;
  return `<article class="record-card record-card--notice">
    <div class="record-card__head">
      <h${level} class="record-card__title">${linkable ? `<a href="${href}">${escapeHtml(notice.title)}</a>` : escapeHtml(notice.title)}</h${level}>
    </div>
    <dl class="notice-facts">
      <dt>Notice</dt><dd>${escapeHtml(notice.id)}</dd>
      <dt>Posted</dt><dd><time datetime="${notice.postedAt}">${escapeHtml(formatDate(notice.postedAt))}</time></dd>
      ${notice.revisedAt ? `<dt>Revised</dt><dd><time datetime="${notice.revisedAt}">${escapeHtml(formatDate(notice.revisedAt))}</time></dd>` : ""}
      <dt>Affected</dt><dd>${notice.affectedProducts.map((product) => escapeHtml(product)).join(", ")}</dd>
      <dt>Hazard</dt><dd>${escapeHtml(notice.hazardSummary)}</dd>
      <dt>Remedy</dt><dd>${escapeHtml(notice.remedySummary)}</dd>
    </dl>
    ${linkable ? textLink("Read this notice", href) : `<p class="record-card__pending">This notice has no detail page yet.</p>`}
  </article>`;
};

export const emptyState = (message, actions = "") => `<div class="empty-state"><p>${escapeHtml(message)}</p>${actions}</div>`;

// ---------------------------------------------------------------------------------------------
// Policy document
// ---------------------------------------------------------------------------------------------
// The document header and its table of contents. Both are driven by the record: the two dates print only
// when the record carries them, and Vanderhall's legacy page publishes neither, so today the header shows a
// contact route and nothing else rather than an invented effective date.
export const policyHeader = (policy, back) => `<header class="page-header page-header--marked policy-header">
  ${backLink(back)}
  <h1>${escapeHtml(policy.title)}</h1>
  <p>${escapeHtml(policy.sourceLine)}</p>
  <dl class="policy-header__meta">
    ${policy.effectiveAt ? `<dt>Effective</dt><dd><time datetime="${policy.effectiveAt}">${escapeHtml(formatDate(policy.effectiveAt))}</time></dd>` : ""}
    ${policy.updatedAt ? `<dt>Last updated</dt><dd><time datetime="${policy.updatedAt}">${escapeHtml(formatDate(policy.updatedAt))}</time></dd>` : ""}
    <dt>Questions</dt><dd><a href="${policy.contactUrl}">Contact Vanderhall</a></dd>
  </dl>
</header>`;

// On desktop a restrained sticky column beside the body; on mobile the same list inside a details
// disclosure. One nav element, styled two ways, rather than two copies of the same links in the DOM.
export const policyContents = (policy) => {
  const items = policy.sections.filter((section) => section.heading);
  if (!items.length) return "";
  const list = `<ol class="policy-toc__list">${items.map((section) => `<li><a href="#${section.id}">${escapeHtml(section.heading)}</a></li>`).join("")}</ol>`;
  return `<nav class="policy-toc" aria-label="On this page">
    <details class="policy-toc__mobile">
      <summary>On this page</summary>
      ${list}
    </details>
    <div class="policy-toc__desktop">
      <h2 class="policy-toc__title">On this page</h2>
      ${list}
    </div>
  </nav>`;
};

// ---------------------------------------------------------------------------------------------
// Homepage campaign status band
// ---------------------------------------------------------------------------------------------
// Two operational statements, Brawley first in the DOM and on the screen, both read from the campaign data
// rather than written into this component. There is no countdown, no flashing, no modal, and nothing to
// dismiss.
//
// V15-B, Owen on 2026-08-06: the band leaves its position after the hero and closes the homepage
// instead, centered, on a silver field. It is the one light-field band on the dark page, which is
// what makes the two statements read as a considered close rather than a notice bar. The wiring is
// unchanged: both statements come from the campaign records, so this band and the Launch Edition
// page cannot disagree about the campaign's phase.
export const campaignBand = (delivery, campaign) => {
  const santarosa = campaignStatement(campaign);
  const item = (label, action) => `<div class="campaign-band__item">
    <p class="campaign-band__label">${escapeHtml(label)}</p>
    ${textLink(action.label, action.href)}
  </div>`;
  return `<section class="bleed campaign-band" aria-label="Current availability">
    <div class="campaign-band__inner">
      ${item(delivery.label, delivery.action)}
      ${item(santarosa.label, santarosa.action)}
    </div>
  </section>`;
};

// ---------------------------------------------------------------------------------------------
// Dealer locator
// ---------------------------------------------------------------------------------------------
// Two panes above 1024px, a segmented List and Map control below it, and the complete dealer list rendered
// as HTML in both cases. The map is an enhancement and never the only way to find a dealer: with no key, a
// failed SDK, or no JavaScript at all, every dealer's address, telephone number, website, and directions
// link is still on the page and still works.
//
// The controls a visitor cannot use without JavaScript are withdrawn by a <noscript> style block in the
// document head rather than shipped behind a `hidden` attribute the island removes. That is a deliberate
// departure from the walkaround's ship-hidden-then-reveal pattern, and the reason is measured rather than
// aesthetic: revealing the search panel after load pushed the result bar and both panes down the page, which
// Lighthouse recorded as a 0.048 layout shift on this route against a site-wide 0. Rendering the controls at
// first paint and letting <noscript> take them away inverts the default to the common case, costs a no-JS
// visitor nothing, and still leaves nobody looking at a control that cannot work.
const capabilityLabels = { ev: "Electric", gas: "Gas", service: "Service" };

const dealerCard = (dealer) => {
  const capabilities = Object.entries(dealer.capabilities || {}).filter(([, value]) => value).map(([key]) => capabilityLabels[key]).filter(Boolean);
  const address = [dealer.address1, dealer.address2, `${dealer.city}, ${dealer.region} ${dealer.postalCode}`].filter(Boolean);
  // The official directions URL, with coordinates rather than a formatted address: the coordinates are what
  // the record actually knows, and a re-geocoded address string is a second chance to land on the wrong side
  // of a highway.
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${dealer.latitude},${dealer.longitude}`;
  return `<article class="dealer-card" id="dealer-${dealer.slug}" data-dealer="${dealer.slug}" data-lat="${dealer.latitude}" data-lng="${dealer.longitude}" data-ev="${Boolean(dealer.capabilities?.ev)}" data-gas="${Boolean(dealer.capabilities?.gas)}" data-service="${Boolean(dealer.capabilities?.service)}" data-city="${escapeHtml(dealer.city)}" data-region="${escapeHtml(dealer.region)}" data-postal="${escapeHtml(dealer.postalCode)}" tabindex="-1">
    <div class="dealer-card__head">
      ${/* h2, not h3: these are the first headings under the page title, and axe is right that skipping a
             level breaks the document outline a screen-reader user navigates by. */""}
      <h2 class="dealer-card__name">${escapeHtml(dealer.name)}</h2>
      <p class="dealer-card__distance" data-dealer-distance></p>
    </div>
    <p class="dealer-card__address">${address.map((line) => escapeHtml(line)).join("<br>")}</p>
    ${capabilities.length ? `<ul class="dealer-card__tags">${capabilities.map((label) => `<li>${escapeHtml(label)}</li>`).join("")}</ul>` : ""}
    ${dealer.models?.length ? `<p class="dealer-card__models">${escapeHtml(dealer.models.join(", "))}</p>` : ""}
    ${dealer.hours || dealer.status ? `<p class="dealer-card__hours">${[dealer.hours, dealer.status].filter(Boolean).map((line) => escapeHtml(line)).join(". ")}</p>` : ""}
    <div class="dealer-card__actions">
      <a href="tel:${escapeHtml(dealer.phone)}">${escapeHtml(dealer.phone)}</a>
      <a href="${dealer.websiteUrl}">Website</a>
      <a href="${directions}">Directions</a>
      <button class="dealer-card__select" type="button" data-dealer-select="${dealer.slug}">Show on map</button>
    </div>
  </article>`;
};

// V15-E introduced the illustrative map: a build-time SVG drawn for this site, not a tile service
// and not an imitation of one. One pin per dealer projected from the record's real coordinates, so
// the pins are as honest as the list. It renders at first paint in the no-key state and stands
// until John's Google key exists; with a key, the Google canvas takes over and this panel is the
// failure fallback rather than a sentence.
//
// V16-F rebuilds the drawing on a world base. Owen asked for a map that can hold thirty-plus
// dealers and zoom from the whole world to a region, so the projection is now Web Mercator over
// the world-atlas outlines (src/data/worldmap.mjs), the delivered viewBox is fitted to wherever
// the records actually are, and site.js drives zoom and pan by rewriting that viewBox. Everything
// below still works with the script gone: the fitted view is baked in, and the zoom controls ship
// hidden exactly as the walkaround's do.
const MAP_SCALE_REF = 700; // the V15 drawing's box; pin geometry is authored against it and scaled
const MAP_MIN_VIEW = 40;   // never fit tighter than ~14 degrees of longitude
const mapPoint = (lat, lng) => mercatorPoint(lat, lng);

// The fitted opening view: the pins' own box, padded, squared, and clamped to the world.
const mapFitBox = (dealers) => {
  const points = dealers.map((dealer) => mapPoint(dealer.latitude, dealer.longitude));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const pad = Math.max(6, (Math.max(...xs) - Math.min(...xs)) * 0.14, (Math.max(...ys) - Math.min(...ys)) * 0.14);
  let x0 = Math.min(...xs) - pad;
  let x1 = Math.max(...xs) + pad;
  let y0 = Math.min(...ys) - pad;
  let y1 = Math.max(...ys) + pad;
  const side = Math.min(Math.max(x1 - x0, y1 - y0, MAP_MIN_VIEW), WORLD_SIZE);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  x0 = cx - side / 2; y0 = cy - side / 2;
  // Clamp inside the world box so the opening view never letterboxes on empty projection space; a
  // spread of dealers wider than the world's own height centres on the world instead.
  x0 = Math.min(Math.max(x0, WORLD_BOX.x), WORLD_BOX.x + WORLD_BOX.width - side);
  y0 = side >= WORLD_BOX.height
    ? WORLD_BOX.y - (side - WORLD_BOX.height) / 2
    : Math.min(Math.max(y0, WORLD_BOX.y), WORLD_BOX.y + WORLD_BOX.height - side);
  const round = (value) => Number(value.toFixed(1));
  return { x: round(x0), y: round(y0), width: round(side), height: round(side) };
};

// Each polyline is [lat, lng] vertices. The straight segments are the borders' actual defining
// lines (the 37th, 42nd, 45th, and 49th parallels; the 104.05, 109.05, 111.05, 114.05, and 117.03
// meridians); the coast and the two mountain borders are simplified by hand.
const MAP_STATE_LINES = [
  [[49, -123.2], [48.4, -124.7], [46.3, -124.1], [43.3, -124.4], [40.4, -124.4], [38.9, -123.7], [36.6, -121.9], [34.4, -119.7], [33.7, -118.2], [32.5, -117.1]],
  [[32.5, -117.1], [32.7, -114.7], [31.3, -111.07], [31.3, -108.2], [31.78, -108.2], [31.78, -106.5]],
  [[49, -123.2], [49, -101.5]],
  [[42, -120], [39, -120], [35, -114.63]],
  [[35, -114.63], [34.3, -114.14], [32.7, -114.7]],
  [[35, -114.63], [36.1, -114.05], [42, -114.05]],
  [[42, -124.4], [42, -111.05]],
  [[37, -114.05], [37, -102.05]],
  [[41, -109.05], [31.3, -109.05]],
  [[45, -111.05], [41, -111.05], [41, -104.05], [45, -104.05], [45, -111.05]],
  [[41, -109.05], [41, -102.05], [37, -102.05]],
  [[42, -117.02], [44, -117.02], [45.9, -116.9], [46.4, -117.04], [49, -117.03]],
  [[44.5, -111.05], [45.7, -112.9], [46.6, -114.4], [47.4, -115.7], [49, -116.05]],
  [[42, -111.05], [44.5, -111.05]],
  [[45, -104.05], [49, -104.05]],
  [[46.2, -124.1], [45.7, -121.2], [46, -116.9]],
];

export const dealerMap = (dealers) => {
  const fit = mapFitBox(dealers);
  const lines = MAP_STATE_LINES.map((line) => `M${line.map(([lat, lng]) => {
    const { x, y } = mapPoint(lat, lng);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join("L")}`).join("");
  // Pin geometry keeps its V15 authoring scale and is counter-scaled to the fitted view, which is
  // the same arithmetic site.js applies on every zoom: a pin's on-screen size never follows the
  // camera. Labels ship visible for a set this small; past twelve pins they wait for site.js to
  // open them at a regional zoom, because thirty city names over a whole-country view is noise.
  const pinScale = (fit.width / MAP_SCALE_REF).toFixed(4);
  const pins = dealers.map((dealer) => {
    const { x, y } = mapPoint(dealer.latitude, dealer.longitude);
    return `<g class="map-pin" data-dealer-pin="${dealer.slug}" data-map-x="${x.toFixed(1)}" data-map-y="${y.toFixed(1)}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${pinScale})">
      <circle class="map-pin__halo" r="10"></circle>
      <circle class="map-pin__dot" r="4"></circle>
      <text class="map-pin__label" x="15" y="4">${escapeHtml(dealer.city)}</text>
    </g>`;
  }).join("");
  const viewBox = `${fit.x} ${fit.y} ${fit.width} ${fit.height}`;
  return `<svg class="locator__map-art${dealers.length <= 12 ? " map-art--labels" : ""}" viewBox="${viewBox}" data-map-fit="${viewBox}" data-map-world="${WORLD_BOX.x} ${WORLD_BOX.y} ${WORLD_BOX.width} ${WORLD_BOX.height}" role="img" aria-label="Illustrative map of the ${dealers.length} dealer locations. Full addresses and directions are in the dealer list." preserveAspectRatio="xMidYMid meet">
    <path class="map-land" fill-rule="evenodd" vector-effect="non-scaling-stroke" d="${worldLandPath}"></path>
    <path class="map-borders" vector-effect="non-scaling-stroke" d="${worldBordersPath}"></path>
    <path class="map-lines" vector-effect="non-scaling-stroke" d="${lines}"></path>
    ${pins}
  </svg>`;
};

export const dealerLocator = (dealers, filters, { mapKey = "", mapId = "" } = {}) => `<section class="locator" data-locator data-map="${mapKey ? "google" : "none"}"${mapKey ? ` data-map-key="${escapeHtml(mapKey)}"` : ""}${mapId ? ` data-map-id="${escapeHtml(mapId)}"` : ""}>
  <form class="locator__search" data-locator-search>
    <div class="field">
      <label for="locator-location">City or postal code</label>
      ${/* No geolocation request on load, ever. The visitor types where they are, or does not, and the
            complete list is what they see either way. */""}
      <input id="locator-location" name="location" type="search" autocomplete="postal-code" inputmode="search" placeholder="Provo, or 84601">
    </div>
    <fieldset class="field-group" data-locator-filters>
      <legend>Show</legend>
      <div class="radio-row">${filters.map((filter, index) => `<label class="check"><input type="radio" name="capability" value="${filter.value}"${index === 0 ? " checked" : ""}> <span>${escapeHtml(filter.label)}</span></label>`).join("")}</div>
    </fieldset>
    <div class="locator__search-actions">
      <button class="button button--primary" type="submit">Search</button>
      <button class="button button--secondary" type="reset" data-locator-reset>Clear</button>
    </div>
  </form>
  ${/* V16-E, Owen on 2026-08-06: the List/Map switch is retired. Both panes render at every width,
        side by side where there is room and stacked with the map first where there is not, so there
        is no mode for a control to change. */""}
  <div class="locator__bar">
    <p class="locator__count" data-locator-count>${dealers.length} ${dealers.length === 1 ? "dealer" : "dealers"}</p>
  </div>
  <p class="locator__state" data-locator-state="searching" role="status" hidden>Searching</p>
  <p class="locator__state" data-locator-state="data-failed" role="alert" hidden>The dealer list could not be loaded. Please try again, or contact Vanderhall.</p>
  <div class="locator__panes" data-locator-panes>
    <div class="locator__list" data-locator-list>
      ${dealers.map(dealerCard).join("")}
      <div class="locator__no-results" data-locator-state="no-results" hidden>
        <p>No dealers matched this search. Try another location, contact Vanderhall, or recommend a local dealer.</p>
        <div class="cluster">${buttonLink("Recommend a dealer", "/recommend-dealer/", "secondary")}${buttonLink("Contact Vanderhall", "/contact/", "secondary")}</div>
      </div>
    </div>
    <div class="locator__map">
      <div class="locator__canvas" data-locator-canvas></div>
      ${/* V15-E: the fallback is the illustrative map rather than a sentence. It renders with no key,
            with a blocked SDK, and with no JavaScript, and it never pretends to be the live map: it is
            a drawing of where the dealers are, and the list beside it carries everything else. */""}
      <div class="locator__map-fallback" data-locator-map-fallback>
        ${dealerMap(dealers)}
        ${/* V16-F: the zoom controls belong to the drawing and leave with it when the Google map
              takes over. Hidden until site.js can honour them, the walkaround's rule again. */""}
        <div class="locator__map-controls" data-map-controls hidden>
          <button class="locator__map-button" type="button" data-map-zoom="in" aria-label="Zoom in">+</button>
          <button class="locator__map-button" type="button" data-map-zoom="out" aria-label="Zoom out">&minus;</button>
          <button class="locator__map-button locator__map-button--fit" type="button" data-map-zoom="fit" aria-label="Reset the map view">Fit</button>
        </div>
      </div>
    </div>
  </div>
</section>`;
