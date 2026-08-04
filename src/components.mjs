import { models } from "./data/models.mjs";
import { COUNTRIES, FORM_ENDPOINTS } from "./data/forms.mjs";

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

export const eyebrow = (text) => `<p class="eyebrow">${escapeHtml(text)}</p>`;

export const buttonLink = (label, href, variant = "primary") => `<a class="button button--${variant}" href="${href}">${escapeHtml(label)}</a>`;

export const textLink = (label, href) => `<a class="text-link" href="${href}">${escapeHtml(label)}<span aria-hidden="true"> →</span></a>`;

export const pageHeader = (eyebrowText, title, intro) => `<header class="page-header">${eyebrow(eyebrowText)}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(intro)}</p></header>`;

export const sectionHeading = (eyebrowText, title, intro = "") => `<div class="section-heading">${eyebrow(eyebrowText)}<h2>${escapeHtml(title)}</h2>${intro ? `<p>${escapeHtml(intro)}</p>` : ""}</div>`;

const statusLabel = (status) => status === "delivering" ? "NOW DELIVERING" : status === "reserve" ? "RESERVATION STAGE" : "";

const CARD_SIZES_4UP = "(min-width: 1280px) 25vw, (min-width: 768px) 45vw, 92vw";
const CARD_SIZES_2UP = "(min-width: 768px) 45vw, 92vw";

export const vehicleCard = (model, { eager = false, level = 3, sizes = CARD_SIZES_4UP } = {}) => {
  const status = statusLabel(model.status);
  return `<article class="card">
    <div class="card__media"><img src="${model.images.card}" srcset="${model.images.cardSrcset}" width="800" height="500" sizes="${sizes}" alt="${escapeHtml(model.images.cardAlt)}" loading="${eager ? "eager" : "lazy"}" decoding="async" style="--media-focal:${model.images.cardFocal}">${status ? `<span class="chip chip--status card__status">${status}</span>` : ""}</div>
    <div class="card__body">
      <div class="chip-row"><span class="chip">${model.powertrain.fuel} · ${model.powertrain.layout}</span></div>
      <h${level} class="card__title"><a class="card__link" href="/${model.slug}/">${model.name}</a></h${level}>
      <p class="card__descriptor">${escapeHtml(model.descriptor)}</p>
      <p class="card__cue">Explore<span aria-hidden="true"> →</span></p>
    </div>
  </article>`;
};

export const relatedGrid = (list) => `<div class="card-grid card-grid--related">${list.map((model) => vehicleCard(model, { sizes: CARD_SIZES_2UP })).join("")}</div>`;

export const vehicleGrid = (list = models, { eagerCount = 0, level = 3 } = {}) => `<div class="card-grid card-grid--vehicles">${list.map((model, index) => vehicleCard(model, { eager: index < eagerCount, level })).join("")}</div>`;

export const conceptCard = (concept, { eager = false, level = 2 } = {}) => `<article class="card">
    <div class="card__media"><img src="${concept.card.src}" width="${concept.card.width}" height="${concept.card.height}" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 45vw, 92vw" alt="${escapeHtml(concept.card.alt)}" loading="${eager ? "eager" : "lazy"}" decoding="async"></div>
    <div class="card__body">
      <h${level} class="card__title"><a class="card__link" href="/concepts/${concept.slug}/">${concept.name}</a></h${level}>
      <p class="card__descriptor">${escapeHtml(concept.category)}</p>
    </div>
  </article>`;

export const gallery = (items) => `<div class="gallery">${items.map((item) => `<img src="${item.src}"${item.srcset ? ` srcset="${item.srcset}"` : ""} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 45vw, 92vw" width="960" height="640" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async">`).join("")}</div>`;

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
  <p class="form-note">This form is not connected yet, so nothing you enter here is sent.</p>
  <div class="form-submit-row"><button class="button button--primary" type="submit" data-submit-label="${submitLabel}">${submitLabel}</button></div>
  <p class="form-status" tabindex="-1" aria-live="polite"></p>`;

const formOpen = (id, formId) => `<form class="lead-form" id="${id}" novalidate data-site-form data-form-id="${formId}" data-endpoint="${FORM_ENDPOINTS[formId] || ""}">
  <p class="form-key">Fields marked * are required.</p>
  <div class="form-error-summary" role="alert" tabindex="-1" hidden></div>`;

export const leadForm = (id = "contact-lead") => {
  const interests = ["Venice", "Carmel", "Santarosa", "Brawley", "Concepts", "Not sure yet"];
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

const navItems = [
  ["Vehicles", "/vehicles/", ["/vehicles", "/venice", "/carmel", "/santarosa", "/brawley"]],
  ["Concepts", "/concepts/", ["/concepts"]],
  ["Owners", "/owners/", ["/owners"]],
  ["Support", "/faq/", ["/faq"]],
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
        <a class="button button--primary header-request" href="/contact/">Request info</a>
        <button class="icon-button desktop-theme" type="button" data-theme-toggle aria-label="Use dark theme"><span aria-hidden="true">◐</span></button>
        <button class="icon-button menu-button" type="button" data-open-menu aria-label="Open menu" aria-expanded="false"><span aria-hidden="true">☰</span></button>
      </div>
    </div>
  </header>
  <div class="sheet" data-menu-sheet hidden aria-hidden="true">
    <div class="sheet__top"><img class="brand brand--sheet" src="/assets/brand/vanderhall-lockup-horizontal.svg" alt="Vanderhall" width="211" height="22"><button class="icon-button" type="button" data-close-menu aria-label="Close menu">×</button></div>
    <nav class="mobile-nav" aria-label="Mobile primary">
      ${navItems.map(([name, href]) => `<a href="${href}">${name}</a>`).join("")}
      <a class="button button--primary" href="/contact/">Request info</a>
      <button class="button button--secondary" type="button" data-theme-toggle>Change theme</button>
    </nav>
  </div>
  <div class="sheet-backdrop" data-sheet-backdrop hidden></div>`;

export const footer = () => `<footer class="site-footer">
  <div class="footer-links">
    <div><h2>Vehicles</h2>${models.map((model) => `<a href="/${model.slug}/">${model.name}</a>`).join("")}<a href="/concepts/">Concepts</a></div>
    <div><h2>Owners</h2><a href="/owners/">Owner resources</a><a href="/faq/">Support</a><a href="https://shop.vanderhallusa.com/">Parts and apparel</a></div>
    <div><h2>Connect</h2><a href="/contact/">Contact</a><a href="/dealers/">Dealers</a><a href="/recommend-dealer/">Recommend a dealer</a><a href="/dealer-inquiry/">Become a dealer</a></div>
  </div>
  <div class="footer-legal">
    <img class="footer-lockup" src="/assets/brand/vanderhall-lockup-horizontal-white.svg" width="231" height="24" loading="lazy" decoding="async" alt="Vanderhall Motor Works">
    <span>© 2026 Vanderhall Motor Works. Hand-built in Provo, Utah.</span>
  </div>
</footer>`;

export const shell = ({ title, description, path, body }) => `<!doctype html>
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
  <link rel="stylesheet" href="/styles/bundle.css">
</head>
<body>
  ${header(path)}
  <main id="main">${body}</main>
  ${footer()}
  <script>addEventListener('load',()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const s=document.createElement('script');s.src='/scripts/site.js';document.body.append(s)})),{once:true})</script>
</body>
</html>`;
