import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { models } from "./data/models.mjs";
import { COUNTRIES, FORM_ENDPOINTS } from "./data/forms.mjs";

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

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

export const eyebrow = (text) => `<p class="eyebrow">${escapeHtml(text)}</p>`;

export const buttonLink = (label, href, variant = "primary") => `<a class="button button--${variant}" href="${href}">${escapeHtml(label)}</a>`;

export const textLink = (label, href) => `<a class="text-link" href="${href}">${escapeHtml(label)}<span aria-hidden="true"> →</span></a>`;

// On the single-purpose form pages the header takes the form's own column, so the page reads as one
// document instead of a heading on the left with a form floating in the middle of it.
export const pageHeader = (eyebrowText, title, intro, className = "") => `<header class="page-header${className ? ` ${className}` : ""}">${eyebrow(eyebrowText)}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p></header>`;

export const sectionHeading = (eyebrowText, title, intro = "") => `<div class="section-heading">${eyebrow(eyebrowText)}<h2>${escapeHtml(title)}</h2>${intro ? `<p>${escapeHtml(intro)}</p>` : ""}</div>`;

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
export const vehicleSection = (model, { index, copy, eager = false, level = 3, withSupport = false } = {}) => {
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
      <h${level}>${model.name}</h${level}>
      <p>${escapeHtml(copy)}</p>
      ${textLink(`Explore ${model.name}`, `/${model.slug}/`)}
    </div>
  </section>`;
};

// The smallest component that can carry a photograph and something true about it: a 3:2 frame,
// a label in the caps register, and one or two sentences. Sides alternate strictly.
export const photoModule = (item, index) => {
  const { width, height } = sizeOf(item.src);
  return `<figure class="photo-module${index % 2 === 1 ? " photo-module--reverse" : ""}">
    <div class="photo-module__media"><img src="${item.src}" srcset="${item.srcset}" width="${width}" height="${height}" sizes="(min-width: 1024px) 58vw, 92vw" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async"></div>
    <figcaption class="photo-module__body">
      <p class="eyebrow">${escapeHtml(item.label)}</p>
      <p>${escapeHtml(item.description)}</p>
    </figcaption>
  </figure>`;
};

export const photoScroll = (items) => `<div class="photo-scroll">${items.map((item, index) => photoModule(item, index)).join("")}</div>`;

// Says where you are and what you can do, which is the job the deleted related-vehicles grid
// was doing badly. Pure CSS sticky, no JavaScript.
export const modelBar = (model, { name = model.name, label, href } = {}) => `<div class="model-bar bleed">
    <div class="model-bar__inner">
      <span class="model-bar__name">${escapeHtml(name)}</span>
      <a class="model-bar__action" href="${href || model.cta?.href || `/dealers/?model=${model.slug}`}">${escapeHtml(label || model.cta?.label || "Request info")}<span aria-hidden="true"> →</span></a>
    </div>
  </div>`;

// One bordered card per destination, replacing the V5 row of bare headings under a hairline.
// The same component carried four destinations of different weight and read as crammed, which is
// the complaint. The whole card is the target and the heading stays its accessible name.
export const pathways = (items) => `<div class="pathways">${items.map(({ title, body, label, href }) => `<div class="pathway">
      <h2 class="pathway__title"><a class="pathway__link" href="${href}">${escapeHtml(title)}</a></h2>
      <p>${escapeHtml(body)}</p>
      <span class="pathway__cue">${escapeHtml(label)}<span aria-hidden="true"> →</span></span>
    </div>`).join("")}</div>`;

// The price is HTML text, never an image and never fetched, and the disclaimer is always visible
// rather than hidden behind a tooltip or a modal.
export const price = ({ label, value }, disclaimer, delivery) => `<p class="price">
    <span class="price__label">${escapeHtml(label)}</span>
    <span class="price__value">${escapeHtml(value)}<sup class="price__mark" aria-hidden="true">*</sup></span>
    ${delivery ? `<span class="price__delivery">${escapeHtml(delivery)}</span>` : ""}
    <span class="price__disclaimer">${escapeHtml(disclaimer)}</span>
  </p>`;

// Four figures already published in the specification table below, on the same unit toggle, so
// the page never states a number the table does not.
export const figureBand = (figures) => `<div class="gts-figures">${figures.map((figure) => `<div class="gts-figure">
      <span class="gts-figure__value"><span data-unit="imp">${figure.imp}</span><span data-unit="met">${figure.met}</span></span>
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

export const hero = ({ src, srcset, tallSrcset, alt, focal, align = "", content }) => `<section class="hero bleed${align === "end" ? " hero--content-end" : ""}" style="--hero-focal:${focal}">
    <div class="hero__media"><picture>${tallSrcset ? `<source media="(max-width: 767px)" srcset="${tallSrcset}" sizes="100vw">` : ""}<img class="hero__image" src="${src}" srcset="${srcset}" sizes="100vw" width="1920" height="823" alt="${escapeHtml(alt)}" loading="eager" fetchpriority="high" decoding="async"></picture></div>
    <div class="hero__scrim" aria-hidden="true"></div>
    <div class="hero__content">${content}</div>
  </section>`;

export const specTable = (model) => `<div class="spec-table" data-spec-table>
    <div class="spec-toolbar">
      <div class="unit-toggle" role="radiogroup" aria-label="Units">
        <label><input type="radio" name="units-${model.slug}" value="imperial" checked> Imperial</label>
        <label><input type="radio" name="units-${model.slug}" value="metric"> Metric</label>
      </div>
    </div>
    <div class="sr-only" aria-live="polite" data-unit-live></div>
    ${model.specGroups.map((group) => `<div class="spec-group">
      <h3>${group.name}</h3>
      <div class="spec-rows">${group.rows.map((row) => `<div class="spec-row"><span>${row.label}</span><strong>${row.value ? row.value : `<span data-unit="imp">${row.imp}</span><span data-unit="met">${row.met}</span>`}</strong></div>`).join("")}</div>
    </div>`).join("")}
  </div>`;

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
  <p class="form-status" tabindex="-1" aria-live="polite"></p>
  <p class="form-note">This form is not connected yet, so nothing you enter here is sent.</p>`;

const formOpen = (id, formId) => `<form class="lead-form" id="${id}" novalidate data-site-form data-form-id="${formId}" data-endpoint="${FORM_ENDPOINTS[formId] || ""}">
  <p class="form-key">Fields marked * are required.</p>
  <div class="form-error-summary" role="alert" tabindex="-1" hidden></div>`;

export const leadForm = (id = "contact-lead") => {
  const interests = [...models.map((model) => model.name), "Concepts", "Not sure yet"];
  return `${formOpen(id, "request-info")}
    <div class="form-grid form-grid--pairs">
      <div class="field">${label(`${id}-first`, "First name", true)}<input id="${id}-first" name="first_name" autocomplete="given-name" required aria-required="true">${error(`${id}-first`)}</div>
      <div class="field">${label(`${id}-last`, "Last name", true)}<input id="${id}-last" name="last_name" autocomplete="family-name" required aria-required="true">${error(`${id}-last`)}</div>
    </div>
    <div class="field">${label(`${id}-email`, "Email", true)}<input id="${id}-email" name="email" type="email" autocomplete="email" inputmode="email" required aria-required="true">${error(`${id}-email`)}</div>
    <div class="field">${label(`${id}-phone`, "Phone")}<input id="${id}-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel">${error(`${id}-phone`)}</div>
    <div class="field">${label(`${id}-zip`, "ZIP", true)}<input id="${id}-zip" name="zip" autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" required aria-required="true">${error(`${id}-zip`)}</div>
    <fieldset class="field-group"><legend>I'm interested in</legend><div class="checkbox-grid">${interests.map((interest) => { const value = interest.toLowerCase().replaceAll(" ", "-"); return `<label class="check"><input type="checkbox" name="interest" value="${value}"> <span>${interest}</span></label>`; }).join("")}</div></fieldset>
    <div class="field">${label(`${id}-timeframe`, "Timeframe")}<select id="${id}-timeframe" name="timeframe"><option value="">Select a timeframe</option><option>Ready now</option><option>1 to 3 months</option><option>3 to 6 months</option><option>Just looking</option></select>${error(`${id}-timeframe`)}</div>
    <div class="field">${label(`${id}-message`, "Message")}<textarea id="${id}-message" name="message" rows="4"></textarea>${error(`${id}-message`)}</div>
    ${integrationFields("request-info", "Send request")}
  </form>`;
};

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

// Dealers is both the inquiry destination and a navigation item: the header button is the
// action, the navigation item is the place.
const navItems = [
  ["Vehicles", "/vehicles/", ["/vehicles", ...models.map((model) => `/${model.slug}`)]],
  ["Concepts", "/concepts/", ["/concepts"]],
  ["Owners", "/owners/", ["/owners"]],
  ["Dealers", "/dealers/", ["/dealers"]],
];

const isCurrent = (path, prefixes) => prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

export const header = (path) => `<a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" data-header>
    <div class="site-header__inner">
      <a class="brand" href="/"><img src="/assets/brand/vanderhall-lockup-horizontal.svg" alt="Vanderhall home" width="269" height="28"></a>
      <nav class="desktop-nav" aria-label="Primary">
        ${navItems.map(([name, href, prefixes]) => `<a class="nav-link${isCurrent(path, prefixes) ? " is-current" : ""}" href="${href}"${isCurrent(path, prefixes) ? ' aria-current="page"' : ""}>${name}</a>`).join("")}
      </nav>
      <div class="site-header__actions">
        <a class="button button--primary header-request" href="/dealers/">Request info</a>
        <button class="icon-button desktop-theme" type="button" data-theme-toggle aria-label="Use dark theme"><span aria-hidden="true">◐</span></button>
        <button class="icon-button menu-button" type="button" data-open-menu aria-label="Open menu" aria-expanded="false"><span aria-hidden="true">☰</span></button>
      </div>
    </div>
  </header>
  <div class="sheet" data-menu-sheet hidden aria-hidden="true">
    <div class="sheet__top"><img class="brand brand--sheet" src="/assets/brand/vanderhall-lockup-horizontal.svg" alt="Vanderhall" width="211" height="22"><button class="icon-button" type="button" data-close-menu aria-label="Close menu">×</button></div>
    <nav class="mobile-nav" aria-label="Mobile primary">
      ${navItems.map(([name, href]) => `<a href="${href}">${name}</a>`).join("")}
      <a class="button button--primary" href="/dealers/">Request info</a>
      <button class="button button--secondary" type="button" data-theme-toggle>Change theme</button>
    </nav>
  </div>
  <div class="sheet-backdrop" data-sheet-backdrop hidden></div>`;

export const footer = () => `<footer class="site-footer">
  <div class="footer-links">
    <div><h2>Vehicles</h2>${models.map((model) => `<a href="/${model.slug}/">${model.name}</a>`).join("")}<a href="/concepts/">Concepts</a></div>
    <div><h2>Owners</h2><a href="/owners/">Owner resources</a><a href="https://shop.vanderhallusa.com/">Parts and apparel</a></div>
    <div><h2>Connect</h2><a href="/dealers/">Dealers</a><a href="/recommend-dealer/">Recommend a dealer</a><a href="/dealer-inquiry/">Become a dealer</a></div>
  </div>
  <div class="footer-legal">
    <img class="footer-lockup" src="/assets/brand/vanderhall-lockup-horizontal-white.svg" width="231" height="24" loading="lazy" decoding="async" alt="Vanderhall Motor Works">
    <span>© 2026 Vanderhall Motor Works. Hand-built in Provo, Utah.</span>
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
      name: "Vanderhall Motor Works",
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/assets/brand/vanderhall-lockup-horizontal.svg`,
      // Provo and 2010 are the two company facts the site publishes, in the homepage hero.
      foundingDate: "2010",
      address: { "@type": "PostalAddress", addressLocality: "Provo", addressRegion: "UT", addressCountry: "US" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: "Vanderhall Motor Works",
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
    name: `Vanderhall ${gts.name}`,
    sku: "brawley-gts",
    description: gts.descriptor,
    url: `${SITE_URL}/brawley/gts/`,
    image: `${SITE_URL}${frame}`,
    brand: { "@type": "Brand", name: "Vanderhall Motor Works" },
    manufacturer: { "@id": `${SITE_URL}/#organization` },
    offers: {
      "@type": "Offer",
      url: gts.reserveUrl,
      priceCurrency: "USD",
      price: gts.price.value.replace(/[$,]/g, ""),
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "Vanderhall Motor Works" },
    },
    additionalProperty: gts.figures.map((figure) => ({
      "@type": "PropertyValue",
      name: figure.label.charAt(0) + figure.label.slice(1).toLowerCase(),
      value: figure.imp,
    })),
  });
};

export const shell = ({ title, description, path, body, schema = "" }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="description" content="${escapeHtml(description)}">
  <title>${escapeHtml(title)} | Vanderhall Motor Works</title>
  <link rel="icon" href="/assets/brand/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/brand/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <script>try{const t=localStorage.getItem('vhw.theme');if(t)document.documentElement.dataset.theme=t;const u=localStorage.getItem('vhw.units');if(u==='metric')document.documentElement.classList.add('unit-metric')}catch(e){}</script>
  <link rel="canonical" href="${SITE_URL}${path === "/" ? "/" : `${path}/`}">
  <link rel="stylesheet" href="/styles/bundle.css">
  ${schema}
</head>
<body>
  ${header(path)}
  <main id="main">${body}</main>
  ${footer()}
  <script>addEventListener('load',()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const s=document.createElement('script');s.src='/scripts/site.js';document.body.append(s)})),{once:true})</script>
</body>
</html>`;
