import { models } from "./data/models.mjs";
import { disclaimersApproved, PRICE_DISCLAIMER, RESERVATION_DISCLAIMER } from "./data/disclaimers.mjs";
import { COUNTRIES, FORM_ENDPOINTS } from "./data/forms.mjs";

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

export const missing = (key, detail = "Required source material has not been supplied.") => `
  <div class="missing" role="status" data-missing="${escapeHtml(key)}">
    <strong>MISSING: ${escapeHtml(key)}</strong>
    <span>${escapeHtml(detail)}</span>
  </div>`;

export const eyebrow = (text) => `<p class="eyebrow">${escapeHtml(text)}</p>`;

export const buttonLink = (label, href, variant = "primary") => `
  <a class="button button--${variant}" href="${href}">${escapeHtml(label)}</a>`;

export const media = ({ src, alt, className = "", width = 1600, height = 1067, eager = false, srcset = "", sizes = "", style = "" }) => `
  <img class="${className}" src="${src}"${srcset ? ` srcset="${srcset}"` : ""}${sizes ? ` sizes="${sizes}"` : ""}${style ? ` style="${style}"` : ""}
    width="${width}" height="${height}" alt="${escapeHtml(alt)}"
    loading="${eager ? "eager" : "lazy"}" fetchpriority="${eager ? "high" : "low"}" decoding="async">`;

const missingPrice = () => missing("data/msrp", "Verified current MSRP is required before any price can render.");

export const price = (model, context = "card") => {
  if (model.fromPriceUsd === null) return `<div class="price price--${context}">${missingPrice()}</div>`;
  if (!disclaimersApproved) return `<div class="price price--${context}">${missing("legal/price-disclaimer")}</div>`;
  const disclaimer = model.status === "reserve" ? RESERVATION_DISCLAIMER : PRICE_DISCLAIMER;
  const value = model.status === "reserve" ? "Pricing announced soon" : `$${model.fromPriceUsd.toLocaleString("en-US")}`;
  return `<p class="price price--${context}">
    <span class="price__label">FROM</span>
    <span class="price__value">${value}</span>
    <span class="price__disclaimer">${escapeHtml(disclaimer)}</span>
  </p>`;
};

const modelImage = (model, eager = false) => model.images.card
  ? media({ src: model.images.card, alt: model.images.cardAlt, className: "model-card__image", width: 800, height: 500, eager, style: `--media-focal:${model.images.cardFocal}` })
  : missing(`card-photo/${model.slug}`);

export const modelCard = (model, { eager = false, related = false } = {}) => {
  const status = model.status === "delivering" ? "NOW DELIVERING" : model.status === "reserve" ? "RESERVATION STAGE" : "";
  const tags = `${model.powertrain.fuel} ${model.powertrain.layout}`;
  return `<article class="model-card${related ? " model-card--related" : ""}" data-filter="${tags}">
    <div class="model-card__well">${modelImage(model, eager)}</div>
    <div class="model-card__body">
      <div class="chip-row">
        <span class="chip">${model.powertrain.fuel} · ${model.powertrain.layout}</span>
        ${status ? `<span class="chip chip--status">${status}</span>` : ""}
      </div>
      <h3 class="model-card__title"><a class="model-card__link" href="/${model.slug}/">${model.name}</a></h3>
      <p class="model-card__descriptor">${escapeHtml(model.descriptor)}</p>
      ${price(model)}
      <div class="model-card__actions">
        ${buttonLink("Request info", `/contact/?model=${model.slug}`, "primary")}
        <a class="text-link" href="/${model.slug}/">Explore ${model.name}<span aria-hidden="true"> →</span></a>
      </div>
    </div>
  </article>`;
};

export const vehicleChapter = (model, reverse = false) => {
  const status = model.status === "delivering" ? "NOW DELIVERING" : model.status === "reserve" ? "RESERVATION STAGE" : "";
  const facts = model.slug === "santarosa"
    ? [["Power", "180", "hp"], ["Standard range", "150", "mi"], ["Drive", "Twin-motor", "front-wheel drive"]]
    : model.slug === "brawley"
      ? [["Power", "283 to 404", "hp"], ["Torque", "488", "lb-ft"], ["Range", "Up to 140", "mi"]]
      : [];
  return `<section class="chapter${reverse ? " chapter--reverse" : ""}" aria-labelledby="chapter-${model.slug}-title">
    <div class="chapter__media"><picture><source media="(max-width: 767px)" srcset="${model.images.chapterSmall} 800w" sizes="100vw"><img src="${model.images.chapter}" srcset="${model.images.chapter960} 960w, ${model.images.chapter} 1600w" sizes="(min-width: 1024px) 58vw, 100vw" width="1600" height="1067" alt="${escapeHtml(model.images.chapterAlt)}" loading="lazy" decoding="async" style="--media-focal:${model.images.chapterFocal}"></picture></div>
    <div class="chapter__body">
      <div class="chip-row"><span class="chip">${model.powertrain.fuel} · ${model.powertrain.layout}</span>${status ? `<span class="chip chip--status">${status}</span>` : ""}</div>
      <h2 class="chapter__title" id="chapter-${model.slug}-title">${model.name}</h2>
      <p class="chapter__descriptor">${escapeHtml(model.descriptor)}</p>
${facts.length ? `      <dl class="chapter__facts">${facts.map(([labelText, value, unit]) => `<div><dt>${labelText}</dt><dd>${value} <span>${unit}</span></dd></div>`).join("")}</dl>\n` : ""}      ${price(model, "chapter")}
      <div class="chapter__actions">${buttonLink(`Explore ${model.name}`, `/${model.slug}/`)}<a class="text-link" href="/contact/?model=${model.slug}">Request info<span aria-hidden="true"> →</span></a></div>
    </div>
  </section>`;
};

export const inquiryBand = (modelSlug = "") => `<section class="inquiry-band section--major narrow">
  ${eyebrow("REQUEST INFO")}
  <h2>Talk with Vanderhall.</h2>
  <p>One form, one conversation. Tell Vanderhall which vehicle interests you.</p>
  <div class="cluster">${buttonLink("Request info", modelSlug ? `/contact/?model=${modelSlug}` : "/contact/")}<a class="text-link" href="${modelSlug ? "/dealers/" : "/recommend-dealer/"}">${modelSlug ? "Find a dealer" : "Recommend a Dealer"}<span aria-hidden="true"> →</span></a></div>
</section>`;

const navCurrent = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`) ? " aria-current=\"page\"" : "";

const requiredMark = `<span aria-hidden="true"> *</span><span class="sr-only"> required</span>`;
const label = (id, text, required = false) => `<label for="${id}">${text}${required ? requiredMark : ""}</label>`;
const error = (id) => `<span class="field__error" id="${id}-error"></span>`;
const countryOptions = `<option value="">Select a country</option>${COUNTRIES.map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`).join("")}`;
const integrationFields = (id, formId, submitLabel) => `
  <div class="honeypot" aria-hidden="true"><label>Company<input name="honeypot" tabindex="-1" autocomplete="off"></label></div>
  <input type="hidden" name="render_timestamp" value="">
  <input type="hidden" name="form_id" value="${formId}">
  <input type="hidden" name="page" value="">
  <div class="form-submit-row"><button class="button button--primary" type="submit" data-submit-label="${submitLabel}">${submitLabel}</button>${missing(`form-endpoint/${formId}`, "No submission destination is configured. Your information will not be sent.")}</div>
  <div class="form-progress" aria-hidden="true"></div>
  <p class="form-status" tabindex="-1" aria-live="polite"></p>`;

const formOpen = (id, formId, presentation = "full") => `<form class="lead-form lead-form--${presentation}" id="${id}" novalidate data-site-form data-form-id="${formId}" data-endpoint="${FORM_ENDPOINTS[formId] || ""}">
  <p class="form-key">Fields marked * are required.</p>
  <div class="form-error-summary" role="alert" tabindex="-1" hidden></div>`;

export const leadForm = ({ id = "lead", presentation = "full", prefill = "" } = {}) => {
  const interests = ["Venice", "Carmel", "Santarosa", "Brawley", "Concepts", "Not sure yet"];
  return `${formOpen(id, "request-info", presentation)}
    <div class="form-grid form-grid--pairs">
      <div class="field">${label(`${id}-first`, "First name", true)}<input id="${id}-first" name="first_name" autocomplete="given-name" required aria-required="true">${error(`${id}-first`)}</div>
      <div class="field">${label(`${id}-last`, "Last name", true)}<input id="${id}-last" name="last_name" autocomplete="family-name" required aria-required="true">${error(`${id}-last`)}</div>
    </div>
    <div class="field">${label(`${id}-email`, "Email", true)}<input id="${id}-email" name="email" type="email" autocomplete="email" inputmode="email" required aria-required="true">${error(`${id}-email`)}</div>
    <div class="field">${label(`${id}-phone`, "Phone")}<input id="${id}-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel">${error(`${id}-phone`)}</div>
    <div class="field">${label(`${id}-zip`, "ZIP", true)}<input id="${id}-zip" name="zip" autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" required aria-required="true">${error(`${id}-zip`)}</div>
    <div class="field">${label(`${id}-dealer`, "Dealer", true)}<select id="${id}-dealer" name="dealer" required aria-required="true"><option value="not-sure">Not sure yet, help me choose</option></select>${error(`${id}-dealer`)}${missing("data/dealer-list", "Verified dealer names and routing data have not been supplied.")}</div>
    <fieldset class="field-group"><legend>I'm interested in</legend><div class="checkbox-grid">${interests.map((interest) => { const value = interest.toLowerCase().replaceAll(" ", "-"); return `<label class="check"><input type="checkbox" name="interest" value="${value}"${value === prefill ? " checked" : ""}> <span>${interest}</span></label>`; }).join("")}</div></fieldset>
    <div class="field">${label(`${id}-timeframe`, "Timeframe")}<select id="${id}-timeframe" name="timeframe"><option value="">Select a timeframe</option><option>Ready now</option><option>1 to 3 months</option><option>3 to 6 months</option><option>Just looking</option></select>${error(`${id}-timeframe`)}</div>
    <div class="field">${label(`${id}-message`, "Message")}<textarea id="${id}-message" name="message" rows="4"></textarea>${error(`${id}-message`)}</div>
    <div class="check check--consent"><input id="${id}-consent" type="checkbox" name="consent" required aria-required="true" aria-describedby="${id}-consent-copy"><label id="${id}-consent-copy" for="${id}-consent"><span class="sr-only">Consent required. </span>${missing("form/consent-copy", "Legal-approved email and SMS consent language is required.")}</label></div>
    ${integrationFields(id, "request-info", "Send request")}
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
  ${integrationFields(id, "recommend-dealer", "Submit")}
</form>`;

const radioGroup = (id, name, legend, values = ["Yes", "No"], required = true) => `<fieldset class="field-group" data-radio-group><legend>${legend}${required ? requiredMark : ""}</legend><div class="radio-row">${values.map((value) => `<label class="check"><input id="${id}-${value.toLowerCase()}" type="radio" name="${name}" value="${value.toLowerCase()}"${required ? ' required aria-required="true"' : ""}> <span>${value}</span></label>`).join("")}</div><span class="field__error" id="${id}-error"></span></fieldset>`;
const requiredTextarea = (id, name, text) => `<div class="field">${label(id, text, true)}<textarea id="${id}" name="${name}" rows="5" required aria-required="true"></textarea>${error(id)}</div>`;

export const internationalDealerForm = (id = "international-dealer-form") => `${formOpen(id, "international-dealer-inquiry")}
  <nav class="form-section-nav" aria-label="Dealer inquiry sections"><a href="#contact-information">Contact</a><a href="#dealer-area">Dealer area</a><a href="#facility-information">Facility</a><a href="#dealership-info">Dealership</a></nav>
  <fieldset class="form-fieldset form-section" id="contact-information"><p class="eyebrow">SECTION 1 OF 4</p><legend>Contact Information</legend>
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
  <fieldset class="form-fieldset form-section" id="dealer-area"><p class="eyebrow">SECTION 2 OF 4</p><legend>Dealer Area</legend><p class="field__help">What City(s) and State(s)/Province(s) are you inquiring about (include postal code)?</p>
    <div class="field">${label(`${id}-area-country`, "Country")}<select id="${id}-area-country" name="area_country" autocomplete="country-name">${countryOptions}</select>${error(`${id}-area-country`)}</div>
    <div class="field">${label(`${id}-area-region`, "State / Province")}<input id="${id}-area-region" name="area_state_province" autocomplete="address-level1">${error(`${id}-area-region`)}</div>
    <div class="form-grid form-grid--pairs"><div class="field">${label(`${id}-area-city`, "City", true)}<input id="${id}-area-city" name="area_city" autocomplete="address-level2" required aria-required="true">${error(`${id}-area-city`)}</div><div class="field">${label(`${id}-area-postal`, "Postal Code", true)}<input id="${id}-area-postal" name="area_postal_code" autocomplete="postal-code" required aria-required="true">${error(`${id}-area-postal`)}</div></div>
  </fieldset>
  <fieldset class="form-fieldset form-section" id="facility-information"><p class="eyebrow">SECTION 3 OF 4</p><legend>Facility Information</legend>
    ${radioGroup(`${id}-facility-status`, "facility_status", "Facility Status", ["Current", "Proposed"])}
    ${[["building-size", "building_size_sq_ft", "Building Size"], ["showroom-size", "showroom_size_sq_ft", "Showroom Size"], ["service-size", "service_area_size_sq_ft", "Service Area Size"], ["demo-size", "demo_ride_site_sq_ft", "Demo Ride Site"]].map(([slug, name, text]) => `<div class="field">${label(`${id}-${slug}`, text, true)}<div class="input-suffix"><input id="${id}-${slug}" name="${name}" inputmode="numeric" pattern="[0-9, ]+" required aria-required="true"><span>Sq. ft</span></div>${error(`${id}-${slug}`)}</div>`).join("")}
    ${requiredTextarea(`${id}-facility-description`, "facility_description", "Facility Description")}
    <div class="field">${label(`${id}-business-info`, "Business Info")}<textarea id="${id}-business-info" name="business_info" rows="5"></textarea>${error(`${id}-business-info`)}</div>
  </fieldset>
  <fieldset class="form-fieldset form-section" id="dealership-info"><p class="eyebrow">SECTION 4 OF 4</p><legend>Dealership Info</legend>
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
  ${integrationFields(id, "international-dealer-inquiry", "Submit inquiry")}
</form>`;

export const header = (path) => {
  const vehicleCurrent = ["/vehicles", "/venice", "/carmel", "/santarosa", "/brawley"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  return `<a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" data-header>
    <div class="site-header__inner">
      <a class="brand" href="/"><img src="/assets/brand/vanderhall-lockup-horizontal.svg" alt="Vanderhall home" width="269" height="28"></a>
      <nav class="desktop-nav" aria-label="Primary">
        <a class="nav-link${vehicleCurrent ? " is-current" : ""}" href="/vehicles/"${vehicleCurrent ? ' aria-current="page"' : ""}>Vehicles</a>
        <a class="nav-link" href="/concepts/"${navCurrent(path, "/concepts")}>Concepts</a>
        <a class="nav-link" href="/about/"${navCurrent(path, "/about")}>About</a>
        <a class="nav-link" href="/faq/"${navCurrent(path, "/faq")}>Support</a>
      </nav>
      <div class="site-header__actions">
        <a class="dealer-link" href="/dealers/" aria-label="Find a dealer"${navCurrent(path, "/dealers")}><span aria-hidden="true">⌖</span><span class="dealer-link__text">Find a dealer</span></a>
        <a class="button button--primary header-request" href="/contact/">Request info</a>
        <button class="icon-button desktop-theme" type="button" data-theme-toggle aria-label="Use dark theme"><span aria-hidden="true">◐</span></button>
        <button class="icon-button menu-button" type="button" data-open-menu aria-label="Open menu" aria-expanded="false"><span aria-hidden="true">☰</span></button>
      </div>
    </div>
  </header>
  <div class="sheet" data-menu-sheet hidden aria-hidden="true">
    <div class="sheet__top"><img class="brand brand--sheet" src="/assets/brand/vanderhall-lockup-horizontal.svg" alt="Vanderhall" width="211" height="22"><button class="icon-button" type="button" data-close-menu aria-label="Close menu">×</button></div>
    <nav class="mobile-nav" aria-label="Mobile primary">
      <a href="/vehicles/">Vehicles</a><a href="/concepts/">Concepts</a><a href="/about/">About</a><a href="/faq/">Support</a>
      <div class="mobile-models">${models.map((model) => `<a href="/${model.slug}/">${model.name}</a>`).join("")}</div>
      <a href="/dealers/">Find a dealer</a><a class="button button--primary" href="/contact/">Request info</a>
      <button class="button button--secondary" type="button" data-theme-toggle>Change theme</button>
    </nav>
  </div>
  <div class="sheet-backdrop" data-sheet-backdrop hidden></div>`;
};

export const footer = () => `<footer class="site-footer">
  <div class="footer-cta">
    <div><h2>Find the right next step.</h2><p>Connect with Vanderhall or find a dealer.</p></div>
    <div class="cluster">${buttonLink("Find a dealer", "/dealers/", "inverse")}${buttonLink("Request info", "/contact/", "secondary-inverse")}</div>
  </div>
  <div class="footer-brand"><img src="/assets/brand/vanderhall-seal-192.png" srcset="/assets/brand/vanderhall-seal-192.png 1x, /assets/brand/vanderhall-seal-384.png 2x" width="96" height="96" loading="lazy" decoding="async" alt=""></div>
  <div class="footer-links">
    <div><h3>Vehicles</h3>${models.map((model) => `<a href="/${model.slug}/">${model.name}</a>`).join("")}<a href="/concepts/">Concepts</a></div>
    <div><h3>Company</h3><a href="/about/">About</a></div>
    <div><h3>Owners</h3><a href="/owners/">Owner resources</a><a href="/faq/">Support and FAQ</a><a href="/assets/manuals/2026-brawley-owners-manual.pdf">2026 Brawley owner's manual</a><a href="https://shop.vanderhallusa.com/">Parts and apparel</a></div>
    <div><h3>Connect</h3><a href="/dealers/">Find a dealer</a><a href="/recommend-dealer/">Recommend a Dealer</a><a href="/contact/">Contact</a><a href="/dealer-inquiry/">Become a Dealer</a></div>
  </div>
  <div class="footer-legal">
    <img class="footer-lockup" src="/assets/brand/vanderhall-lockup-horizontal-white.svg" width="231" height="24" loading="lazy" decoding="async" alt="Vanderhall Motor Works">
    <span>© 2026 Vanderhall Motor Works. Hand-built in Provo, Utah.</span>
${missing("legal/price-disclaimer", "Legal review is required before the site-wide price disclaimer can publish.")}
  </div>
</footer>`;

export const shell = ({ title, description, path, body, bodyClass = "" }) => `<!doctype html>
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
  <link rel="preload" href="/assets/fonts/archivo-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
  <script>try{const t=localStorage.getItem('vhw.theme');if(t)document.documentElement.dataset.theme=t;const u=localStorage.getItem('vhw.units');if(u==='metric')document.documentElement.classList.add('unit-metric')}catch(e){}</script>
  <link rel="stylesheet" href="/styles/bundle.css">
</head>
<body class="${bodyClass}">
  ${header(path)}
  <main id="main">${body}</main>
  ${footer()}
  <script>addEventListener('load',()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const s=document.createElement('script');s.src='/scripts/site.js';document.body.append(s)})),{once:true})</script>
</body>
</html>`;

export const statBand = (model) => {
  const cells = [
    ["Power", model.stats.power],
    ["Weight", model.stats.weight],
    [model.stats.signature?.label || "Signature", model.stats.signature],
  ];
  return `<section class="stat-band bleed" aria-label="${model.name} highlights">
    ${cells.map(([label, stat]) => `<div class="stat-band__cell">
      ${stat ? `<p class="stat-band__value">${stat.value} <span>${stat.unit}</span></p>${stat.qualifier ? `<p class="stat-band__qualifier">${stat.qualifier}</p>` : ""}` : missing(label === "Weight" ? "data/curb-weights" : "data/venice-carmel-specs")}
      <p class="stat-band__label">${label}</p>
    </div>`).join("")}
  </section>`;
};

export const specTable = (model) => {
  if (!model.specGroups.length) return missing(model.slug === "venice" || model.slug === "carmel" ? "data/venice-carmel-specs" : "data/spec-tables", "Verified text specifications have not been supplied.");
  return `<div class="spec-table" data-spec-table>
    <div class="spec-toolbar">
      ${eyebrow("SPECIFICATIONS")}
      <div class="unit-toggle" role="radiogroup" aria-label="Units">
        <label><input type="radio" name="units-${model.slug}" value="imperial" checked> Imperial</label>
        <label><input type="radio" name="units-${model.slug}" value="metric"> Metric</label>
      </div>
      <button class="text-button" type="button" data-expand-specs>Expand all</button>
    </div>
    <div class="sr-only" aria-live="polite" data-unit-live></div>
    ${model.specGroups.map((group) => `<details class="spec-group" open>
      <summary><span>${group.name}</span><span>${group.rows.length} ${group.rows.length === 1 ? "item" : "items"}</span></summary>
      <div class="spec-rows">${group.rows.map((row) => `<div class="spec-row"><span>${row.label}</span><strong>${row.value ? row.value : `<span data-unit="imp">${row.imp}</span><span data-unit="met">${row.met}</span>`}</strong></div>`).join("")}</div>
    </details>`).join("")}
    ${missing("data/spec-tables", "The full verified specification table has not been supplied.").trim()}
  </div>`;
};

export const walkaround = (model) => {
  const complete = model.colorways.filter((color) => color.complete);
  const initial = complete[0];
  const angles = Object.keys(initial.frames);
  return `<section class="walkaround" data-walkaround data-color="${initial.slug}" data-angle="0">
    <div class="walkaround__heading"><img class="brawley-script" src="/assets/brand/brawley-script.png" srcset="/assets/brand/brawley-script.png 1600w, /assets/brand/brawley-script@2x.png 2800w" sizes="(min-width: 1024px) 200px, 160px" width="1600" height="514" alt="Brawley">${eyebrow("EVERY ANGLE")}<h2>Choose a color. Take a look around.</h2></div>
    <div class="walkaround__stage" tabindex="0" role="group" aria-roledescription="360 viewer" aria-label="Angle 1 of 8, ${initial.name}" data-walkaround-stage>
      ${angles.map((angle, index) => media({ src: initial.frames[angle], alt: index === 0 ? `Vanderhall Brawley in ${initial.name}` : "", className: `walkaround__frame${index === 0 ? " is-active" : ""}`, width: 1600, height: 902, eager: index === 0 })).join("")}
    </div>
    <div class="walkaround__controls">
      <button class="icon-button" type="button" data-walkaround-prev aria-label="Previous angle">←</button>
      <div class="walkaround__dots" aria-hidden="true">${angles.map((_, index) => `<span${index === 0 ? ' class="is-active"' : ""}></span>`).join("")}</div>
      <button class="icon-button" type="button" data-walkaround-next aria-label="Next angle">→</button>
    </div>
    <p class="walkaround__hint" data-walkaround-hint>DRAG TO ROTATE</p>
    <p class="walkaround__name" data-walkaround-name>${initial.name}</p>
    <div class="swatches" role="radiogroup" aria-label="Brawley colorways">
      ${model.colorways.map((color, index) => `<button class="swatch${index === 0 ? " is-selected" : ""}${color.complete ? "" : " is-partial"}" type="button" role="radio" aria-checked="${index === 0 ? "true" : "false"}" aria-label="${color.name}" style="--swatch-color:${color.swatch}" data-colorway='${escapeHtml(JSON.stringify(color))}'><span aria-hidden="true"></span></button>`).join("")}
    </div>
    <p class="walkaround__availability" data-colorway-note>Jean Grey and Concrete Grey have partial studio sets and display as still images.</p>
    ${missing("data/colorway-mapping", "Current colorway mapping and approved paint values have not been supplied.").trim()}
    <noscript><p>Available studio colorways: ${model.colorways.map((color) => color.name).join(", ")}.</p></noscript>
  </section>`;
};

export const featureModule = ({ image, alt, eyebrowText, title, body, reverse = false, bleed = false }) => {
  const responsive = image?.endsWith("-1280.webp")
    ? `${image.replace("-1280.webp", "-640.webp")} 640w, ${image.replace("-1280.webp", "-960.webp")} 960w, ${image} 1280w`
    : "";
  return `<article class="feature${reverse ? " feature--reverse" : ""}${bleed ? " feature--bleed" : ""}">
  <div class="feature__media">${image ? media({ src: image, srcset: responsive, sizes: "(min-width: 1024px) 50vw, 100vw", alt, className: "feature__image", width: 1280, height: 853 }) : missing(`feature-media/${eyebrowText.toLowerCase().replaceAll(" ", "-")}`)}</div>
  <div class="feature__copy">${eyebrow(eyebrowText)}<h3>${title}</h3><p>${body}</p></div>
</article>`;
};

export const pageHeader = (eyebrowText, title, intro) => `<header class="page-header section--major">${eyebrow(eyebrowText)}<h1>${title}</h1><p>${intro}</p></header>`;
