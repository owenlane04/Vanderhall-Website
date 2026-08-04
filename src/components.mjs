import { models } from "./data/models.mjs";
import { disclaimersApproved, PRICE_DISCLAIMER, RESERVATION_DISCLAIMER } from "./data/disclaimers.mjs";

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

export const media = ({ src, alt, className = "", width = 1600, height = 1067, eager = false, srcset = "", sizes = "" }) => `
  <img class="${className}" src="${src}"${srcset ? ` srcset="${srcset}"` : ""}${sizes ? ` sizes="${sizes}"` : ""}
    width="${width}" height="${height}" alt="${escapeHtml(alt)}"
    loading="${eager ? "eager" : "lazy"}"${eager ? ' fetchpriority="high"' : ""} decoding="async">`;

const missingPrice = (slug) => missing(`from-msrp/${slug}`, "Verified current MSRP is required before any price can render.");

export const price = (model, context = "card") => {
  if (model.fromPriceUsd === null) return `<div class="price price--${context}">${missingPrice(model.slug)}</div>`;
  if (!disclaimersApproved) return `<div class="price price--${context}">${missing("legal-price-disclaimer")}</div>`;
  const disclaimer = model.status === "reserve" ? RESERVATION_DISCLAIMER : PRICE_DISCLAIMER;
  const value = model.status === "reserve" ? "Pricing announced soon" : `$${model.fromPriceUsd.toLocaleString("en-US")}`;
  return `<p class="price price--${context}">
    <span class="price__label">FROM</span>
    <span class="price__value">${value}</span>
    <span class="price__disclaimer">${escapeHtml(disclaimer)}</span>
  </p>`;
};

const modelImage = (model, eager = false) => model.images.cutout
  ? media({ src: model.images.cutout, alt: `Vanderhall ${model.name}, side profile`, className: "model-card__image", width: 1600, height: 902, eager })
  : missing(`card-cutout/${model.slug}`);

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

const navCurrent = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`) ? " aria-current=\"page\"" : "";

export const leadForm = ({ id = "lead", presentation = "full", prefill = "" } = {}) => {
  const interests = ["Venice", "Carmel", "Santarosa", "Brawley", "Concepts", "Not sure yet"];
  return `<form class="lead-form lead-form--${presentation}" id="${id}" action="/contact/#form-destination-missing" method="get" novalidate data-lead-form data-endpoint-missing="true">
    <div class="form-error-summary" role="alert" tabindex="-1" hidden></div>
    <div class="form-grid">
      <div class="field">
        <label for="${id}-first">First name</label>
        <input id="${id}-first" name="firstName" autocomplete="given-name" required>
        <span class="field__error" id="${id}-first-error"></span>
      </div>
      <div class="field">
        <label for="${id}-last">Last name</label>
        <input id="${id}-last" name="lastName" autocomplete="family-name" required>
        <span class="field__error" id="${id}-last-error"></span>
      </div>
      <div class="field">
        <label for="${id}-email">Email</label>
        <input id="${id}-email" name="email" type="email" autocomplete="email" inputmode="email" required>
        <span class="field__error" id="${id}-email-error"></span>
      </div>
      <div class="field">
        <label for="${id}-phone">Phone <span class="optional">Optional</span></label>
        <input id="${id}-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel">
        <span class="field__error" id="${id}-phone-error"></span>
      </div>
      <div class="field">
        <label for="${id}-zip">ZIP</label>
        <input id="${id}-zip" name="zip" autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" required>
        <span class="field__error" id="${id}-zip-error"></span>
      </div>
      <div class="field">
        <label for="${id}-dealer">Dealer</label>
        <select id="${id}-dealer" name="dealer" required>
          <option value="not-sure">Not sure yet, help me choose</option>
        </select>
        ${missing("dealer-list/select", "Dealer names and routing data have not been supplied.")}
      </div>
    </div>
    <fieldset class="field-group" data-required-checkbox-group>
      <legend>I'm interested in</legend>
      <div class="checkbox-grid">
        ${interests.map((interest) => {
          const value = interest.toLowerCase().replaceAll(" ", "-");
          return `<label class="check"><input type="checkbox" name="interest" value="${value}"${value === prefill ? " checked" : ""}> <span>${interest}</span></label>`;
        }).join("")}
      </div>
      <span class="field__error"></span>
    </fieldset>
    <details class="form-more">
      <summary>More details</summary>
      <div class="form-grid form-grid--more">
        <div class="field">
          <label for="${id}-timeframe">Timeframe <span class="optional">Optional</span></label>
          <select id="${id}-timeframe" name="timeframe">
            <option value="">Select a timeframe</option>
            <option>Ready now</option><option>1 to 3 months</option><option>3 to 6 months</option><option>Just looking</option>
          </select>
        </div>
        <div class="field field--wide">
          <label for="${id}-message">Message <span class="optional">Optional</span></label>
          <textarea id="${id}-message" name="message" rows="3"></textarea>
        </div>
      </div>
    </details>
    <div class="honeypot" aria-hidden="true"><label>Company<input name="company" tabindex="-1" autocomplete="off"></label></div>
    <input type="hidden" name="renderedAt" value="">
    <div class="check check--consent"><input id="${id}-consent" type="checkbox" name="consent" required aria-label="Consent checkbox. Legal-approved wording is missing."><label for="${id}-consent">${missing("legal-consent-copy", "Legal-approved email and SMS consent language is required.")}</label></div>
    ${missing("form-destination", "CRM, email routing, or form service has not been configured.")}
    <button class="button button--primary" type="submit">Send request</button>
    <div class="form-progress" aria-hidden="true"></div>
    <p class="form-status" aria-live="polite"></p>
  </form>`;
};

export const header = (path) => {
  const vehicleCurrent = ["/vehicles", "/venice", "/carmel", "/santarosa", "/brawley"].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  return `<a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header" data-header>
    <div class="site-header__inner">
      <a class="wordmark" href="/"><span>VANDERHALL</span><small>MOTOR WORKS</small></a>
      <nav class="desktop-nav" aria-label="Primary">
        <a class="nav-link${vehicleCurrent ? " is-current" : ""}" href="/vehicles/" data-vehicles-trigger aria-haspopup="true" aria-expanded="false">Vehicles</a>
        <a class="nav-link" href="/concepts/"${navCurrent(path, "/concepts")}>Concepts</a>
        <a class="nav-link" href="/about/"${navCurrent(path, "/about")}>About</a>
        <a class="nav-link" href="/faq/"${navCurrent(path, "/faq")}>Support</a>
      </nav>
      <div class="site-header__actions">
        <a class="dealer-link" href="/dealers/" aria-label="Find a dealer"${navCurrent(path, "/dealers")}><span aria-hidden="true">⌖</span><span class="dealer-link__text">Find a dealer</span></a>
        <button class="button button--primary header-request" type="button" data-open-lead>Request info</button>
        <button class="icon-button desktop-theme" type="button" data-theme-toggle aria-label="Use dark theme"><span aria-hidden="true">◐</span></button>
        <button class="icon-button menu-button" type="button" data-open-menu aria-label="Open menu" aria-expanded="false"><span aria-hidden="true">☰</span></button>
      </div>
    </div>
    <div class="mega-panel" data-mega-panel hidden>
      <div class="mega-panel__grid">
        ${models.map((model) => `<a class="mega-model" href="/${model.slug}/">
          <span class="mega-model__media">${model.images.cutout ? media({ src: model.images.cutout, alt: "", width: 800, height: 451 }) : missing(`nav-thumb/${model.slug}`)}</span>
          <strong>${model.name}</strong><span>${model.powertrain.fuel} · ${model.powertrain.layout}</span>
        </a>`).join("")}
      </div>
    </div>
  </header>
  <div class="sheet" data-menu-sheet hidden aria-hidden="true">
    <div class="sheet__top"><span class="wordmark"><span>VANDERHALL</span><small>MOTOR WORKS</small></span><button class="icon-button" type="button" data-close-menu aria-label="Close menu">×</button></div>
    <nav class="mobile-nav" aria-label="Mobile primary">
      <a href="/vehicles/">Vehicles</a><a href="/concepts/">Concepts</a><a href="/about/">About</a><a href="/faq/">Support</a>
      <div class="mobile-models">${models.map((model) => `<a href="/${model.slug}/">${model.name}</a>`).join("")}</div>
      <a href="/dealers/">Find a dealer</a><a class="button button--primary" href="/contact/">Request info</a>
      <button class="button button--secondary" type="button" data-theme-toggle>Change theme</button>
    </nav>
  </div>
  <div class="sheet sheet--lead" data-lead-sheet hidden aria-hidden="true">
    <div class="sheet__top"><div>${eyebrow("REQUEST INFO")}<h2>Start the conversation.</h2></div><button class="icon-button" type="button" data-close-lead aria-label="Close request form">×</button></div>
    ${leadForm({ id: "panel-lead", presentation: "panel" })}
  </div>
  <div class="sheet-backdrop" data-sheet-backdrop hidden></div>`;
};

export const footer = () => `<footer class="site-footer">
  <div class="footer-cta">
    <div><h2>Find the right next step.</h2><p>Connect with Vanderhall or find a dealer.</p></div>
    <div class="cluster">${buttonLink("Find a dealer", "/dealers/", "inverse")}${buttonLink("Request info", "/contact/", "secondary-inverse")}</div>
  </div>
  <div class="footer-links">
    <div><h3>Vehicles</h3>${models.map((model) => `<a href="/${model.slug}/">${model.name}</a>`).join("")}<a href="/concepts/">Concepts</a></div>
    <div><h3>Company</h3><a href="/about/">About</a></div>
    <div><h3>Owners</h3><a href="/faq/">Support and FAQ</a><a href="/assets/manuals/2026-brawley-owners-manual.pdf">2026 Brawley owner's manual</a><a href="https://shop.vanderhallusa.com/">Parts and apparel</a></div>
    <div><h3>Connect</h3><a href="/dealers/">Find a dealer</a><a href="/contact/">Contact</a></div>
  </div>
  <div class="footer-legal">
    <span>© 2026 Vanderhall Motor Works. Hand-built in Provo, Utah.</span>
    ${missing("legal-price-disclaimer", "Legal review is required before the site-wide price disclaimer can publish.")}
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
  <link rel="icon" href="data:,">
  <link rel="preload" href="/assets/fonts/archivo-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
  <script>try{const t=localStorage.getItem('vhw.theme');if(t)document.documentElement.dataset.theme=t;const u=localStorage.getItem('vhw.units');if(u==='metric')document.documentElement.classList.add('unit-metric')}catch(e){}</script>
  <link rel="stylesheet" href="/styles/tokens.css">
  <link rel="stylesheet" href="/styles/layout.css">
  <link rel="stylesheet" href="/styles/site.css">
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
      ${stat ? `<p class="stat-band__value">${stat.value} <span>${stat.unit}</span></p>${stat.qualifier ? `<p class="stat-band__qualifier">${stat.qualifier}</p>` : ""}` : missing(`stat/${model.slug}/${label.toLowerCase()}`)}
      <p class="stat-band__label">${label}</p>
    </div>`).join("")}
  </section>`;
};

export const specTable = (model) => {
  if (!model.specGroups.length) return missing(`spec-data/${model.slug}`, "Verified text specifications have not been supplied.");
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
  </div>`;
};

export const walkaround = (model) => {
  const complete = model.colorways.filter((color) => color.complete);
  const initial = complete[0];
  const angles = Object.keys(initial.frames);
  return `<section class="walkaround" data-walkaround data-color="${initial.slug}" data-angle="0">
    <div class="walkaround__heading">${eyebrow("EVERY ANGLE")}<h2>Choose a color. Take a look around.</h2></div>
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
