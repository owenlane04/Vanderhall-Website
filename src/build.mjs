import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { concepts } from "./data/concepts.mjs";
import { modelBySlug, models } from "./data/models.mjs";
import {
  buttonLink,
  eyebrow,
  featureModule,
  internationalDealerForm,
  leadForm,
  media,
  missing,
  modelCard,
  pageHeader,
  price,
  recommendDealerForm,
  shell,
  specTable,
  statBand,
  walkaround,
} from "./components.mjs";

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const websiteRoot = resolve(sourceRoot, "..");

const hero = (model) => {
  const heroAlt = {
    venice: "Silver Vanderhall Venice side view with motion light streaks",
    carmel: "Red Vanderhall Carmel at sunset",
    santarosa: "Red Vanderhall Santarosa side view with light streaks",
    brawley: "White Vanderhall Brawley at sunset in Utah",
  }[model.slug];
  const visual = model.images.hero
    ? `<picture><source media="(max-width: 767px)" srcset="${model.images.heroTallSrcset}" sizes="100vw"><img class="hero__image" src="${model.images.hero}" srcset="${model.images.heroSrcset}" sizes="100vw" width="1920" height="823" alt="${heroAlt}" loading="eager" fetchpriority="high" decoding="async"></picture>`
    : missing(`hero-wide/${model.slug}`);
  return `<section class="hero model-hero bleed${model.images.hero ? "" : " model-hero--missing"}" style="--hero-focal:${model.images.focal}">
    <div class="hero__media">${visual}</div>
    <div class="hero__scrim" aria-hidden="true"></div>
    <div class="hero__content">
      ${eyebrow(`${model.powertrain.fuel} · ${model.powertrain.layout}`)}
      <h1>${model.name}</h1>
      <p class="hero__descriptor">${model.descriptor}</p>
      ${price(model, "hero")}
      <div class="hero__actions">${buttonLink("Request info", `/contact/?model=${model.slug}`, "inverse")}<a class="button button--ghost-inverse" href="#specifications">See specs</a></div>
    </div>
  </section>`;
};

const relatedModels = (slug) => models.filter((model) => model.slug !== slug).slice(0, 2);

const brawleyFeatures = (model) => {
  const features = [
    {
      image: model.images.mountainRoad,
      alt: "White Vanderhall Brawley facing forward on a mountain road",
      eyebrowText: "POWERTRAIN",
      title: "Quad-motor 4WD",
      body: "Brawley uses four electric motors to drive all four wheels. Verified output spans 283 to 404 hp with 488 lb-ft of torque.",
    },
    {
      image: model.images.desert,
      alt: "Green Vanderhall Brawley in the desert",
      eyebrowText: "RANGE",
      title: "Up to 140 mi",
      body: "Published Brawley range is up to 140 mi. The verified figure applies to the Brawley product described in the current source material.",
      reverse: true,
    },
    {
      image: model.images.juniper,
      alt: "Atomic Green Vanderhall Brawley beneath a juniper tree",
      eyebrowText: "DRIVE MODES",
      title: "Five ways to direct four motors",
      body: "Published modes are 4x2, 4x4, eCrawl, eCrab, and eSteer. Each mode name is carried directly from Vanderhall's Brawley feature material.",
    },
    {
      image: model.images.mountain,
      alt: "Blue Vanderhall Brawley in a Utah mountain landscape",
      eyebrowText: "SUSPENSION",
      title: "21 in of travel",
      body: "Published suspension travel is 21 in. The measurement remains text in the page and is also included in the specification table.",
      reverse: true,
    },
    {
      image: model.images.steering,
      alt: "Vanderhall Brawley steering wheel and instrument cluster",
      eyebrowText: "CAPABILITY",
      title: "1,500 lb towing",
      body: "Published towing capacity is 1,500 lb. The number is repeated as HTML text in the specification table below.",
    },
    {
      image: model.images.interior,
      alt: "Vanderhall Brawley cabin with steering wheel and passenger seats",
      eyebrowText: "SEATING",
      title: "Four-seat capacity",
      body: "The 2026 owner's manual states a seating capacity of four. The manual also instructs operators not to exceed that capacity.",
      reverse: true,
    },
  ];
  const details = model.images.detailFeatures.map(([slug, alt], index) => featureModule({
    image: `${model.images.featureRoot}/${slug}-1280.webp`,
    alt,
    eyebrowText: "DETAIL",
    title: alt,
    body: model.descriptor,
    reverse: index % 2 === 1,
  }));
  return [...features.map(featureModule), ...details].join("");
};

const curatedFeatures = (model) => {
  const standard = model.images.features.map(([slug, alt], index) => featureModule({
    image: `${model.images.featureRoot}/${slug}-1280.webp`,
    alt,
    eyebrowText: "IN VIEW",
    title: alt,
    body: model.descriptor,
    reverse: index % 2 === 1,
  }));
  const additions = [];
  if (model.images.wideFeature) additions.push(featureModule({ image: model.images.wideFeature, alt: model.images.wideFeatureAlt, eyebrowText: "ON THE ROAD", title: model.images.wideFeatureAlt, body: model.descriptor, bleed: true }));
  if (model.images.portrait) additions.push(featureModule({ image: model.images.portrait, alt: model.images.portraitAlt, eyebrowText: "IN MOTION", title: model.images.portraitAlt, body: model.descriptor }));
  if (model.images.portraitDetail) additions.push(featureModule({ image: model.images.portraitDetail, alt: model.images.portraitDetailAlt, eyebrowText: "DETAIL", title: model.images.portraitDetailAlt, body: model.descriptor, reverse: true }));
  return [...standard, ...additions].join("");
};

const safetyNote = `<aside class="safety-note"><strong>Safety notice</strong><p>Always wear a helmet when operating a Vanderhall vehicle. Read the operator's manual and all safety warnings. Complete a safety training course and practice to become skilled with how to drive the vehicle. Local laws may require special licensing to operate the vehicle.</p></aside>`;

const modelPage = (model) => {
  const features = model.slug === "brawley"
    ? brawleyFeatures(model)
    : curatedFeatures(model);
  const colorways = model.slug === "brawley"
    ? walkaround(model)
    : missing("data/colorway-mapping", "Verified model colorway mapping and photography are required.");
  const darkCharacter = model.images.character
    ? `<section class="character bleed"><picture>${model.images.characterTall ? `<source media="(max-width: 767px)" srcset="${model.images.characterTall}">` : ""}<img src="${model.images.character}" width="1600" height="900" loading="lazy" decoding="async" alt="${model.images.characterAlt}"></picture><div class="character__scrim"></div><p>${model.verifiedStatement}</p></section>`
    : `<section class="section--major">${missing("dark-plate/santarosa", "Suitable approved night photography has not been supplied.")}</section>`;
  const body = `<div class="page model-page">
    ${hero(model)}
    ${statBand(model)}
    <section class="statement section--major narrow"><h2>${model.verifiedStatement}</h2>${model.slug === "brawley" ? `<p>Brawley combines quad-motor 4WD, 21 in of travel, and published drive modes for off-road use.</p>${safetyNote}` : `<p>${model.descriptor}</p>`}</section>
    <section class="features section--major">${features}</section>
    <section class="section--major">${colorways}</section>
    ${darkCharacter}
    <section class="section--major narrow" id="specifications"><div class="section-heading">${eyebrow("DETAILS")}<h2>Specifications</h2><p>Every published value is selectable HTML text.</p></div>${specTable(model)}</section>
    <section class="lead-section section--major narrow">${eyebrow("REQUEST INFO")}<h2>Talk with Vanderhall.</h2>${leadForm({ id: `${model.slug}-lead`, presentation: "compact", prefill: model.slug })}</section>
    <section class="related section--major"><div class="section-heading">${eyebrow("KEEP EXPLORING")}<h2>Related vehicles</h2></div><div class="related-grid">${relatedModels(model.slug).map((related) => modelCard(related, { related: true })).join("")}</div></section>
  </div>`;
  return shell({ title: model.name, description: model.descriptor, path: `/${model.slug}`, body });
};

const homePage = () => {
  const brawley = modelBySlug.brawley;
  const body = `<div class="page home-page">
    <section class="hero home-hero bleed" style="--hero-focal:47% 60%">
      <div class="hero__media"><picture><source media="(max-width: 767px)" srcset="/assets/images/v2/heroes/home/home-tall-480.webp 480w, /assets/images/v2/heroes/home/home-tall-720.webp 720w, /assets/images/v2/heroes/home/home-tall-960.webp 960w" sizes="100vw"><img src="/assets/images/v2/heroes/home/home-wide-1920.webp" srcset="/assets/images/v2/heroes/home/home-wide-960.webp 960w, /assets/images/v2/heroes/home/home-wide-1280.webp 1280w, /assets/images/v2/heroes/home/home-wide-1920.webp 1920w, /assets/images/v2/heroes/home/home-wide-2560.webp 2560w" sizes="100vw" width="1920" height="823" alt="Green Vanderhall Brawley on a mountain pass at sunset" class="hero__image" loading="eager" fetchpriority="high" decoding="async"></picture></div>
      <div class="hero__scrim"></div>
      <div class="hero__content">${eyebrow("BRAWLEY")}<h1>Four motors. Utah terrain.</h1><p class="hero__descriptor">Quad-motor electric off-road UTV.</p><div class="hero__actions">${buttonLink("Request info", "/contact/?model=brawley", "inverse")}<a class="button button--ghost-inverse" href="#lineup">Explore the lineup</a></div></div>
    </section>
    <section class="section--major" id="lineup"><div class="section-heading">${eyebrow("THE LINEUP")}<h2>Gas and electric. Road and trail.</h2></div><div class="model-grid">${models.map((model, index) => modelCard(model, { eager: index < 2 })).join("")}</div></section>
    ${featureModule({ image: null, alt: "", eyebrowText: "PROVO, UTAH", title: "Built where Vanderhall began.", body: "Steve Hall founded Vanderhall in 2010. Vanderhall headquarters and manufacturing are in Provo, Utah." }).replace("feature-media/provo,-utah", "feature/provo-factory")}
    <section class="section--major">${missing("data/brand-numbers-home", "Three verified brand-level numbers have not been supplied, so this band cannot publish.")}</section>
    ${featureModule({ image: "/assets/images/v2/features/venice/motion-1280.webp", alt: "Vanderhall Venice driving through a tunnel", eyebrowText: "ONE LINEUP", title: "Gas roadsters and electric vehicles.", body: "The lineup includes the gas Venice and Carmel three-wheel roadsters. Santarosa and Brawley represent Vanderhall's electric vehicles.", reverse: true })}
    <section class="character bleed"><img src="${brawley.images.offRoad}" width="1640" height="993" loading="lazy" decoding="async" alt="Green Vanderhall Brawley on a mountain trail at dusk"><div class="character__scrim"></div><p>Founded in 2010. Built in Provo.</p></section>
    <section class="dealer-cta section--major narrow">${eyebrow("DEALERS")}<h2>Connect with Vanderhall.</h2><p>A verified dealer directory is still required. The request form is ready for routing once that data arrives.</p><div class="cluster">${buttonLink("Find a dealer", "/dealers/")}${buttonLink("Request info", "/contact/", "secondary")}</div></section>
  </div>`;
  return shell({ title: "Home", description: "Vanderhall Motor Works, founded in 2010 and built in Provo, Utah.", path: "/", body });
};

const vehiclesPage = () => {
  const body = `<div class="page vehicles-page">
    ${pageHeader("VEHICLES", "Choose your road. Or leave it.", "Explore Vanderhall's gas and electric lineup.")}
    <section class="section--tight">
      <div class="filter-row" aria-label="Filter vehicles">${["All", "Gas", "Electric", "On-road", "Off-road"].map((filter, index) => `<button type="button" class="filter-pill${index === 0 ? " is-active" : ""}" aria-pressed="${index === 0 ? "true" : "false"}" data-filter-pill="${filter.toLowerCase()}">${filter}</button>`).join("")}</div>
      <p class="sr-only" aria-live="polite" data-filter-live></p>
      <div class="model-grid model-grid--lineup" data-model-grid>${models.map((model, index) => modelCard(model, { eager: index < 2 })).join("")}</div>
    </section>
    <section class="concepts-teaser section--major">${eyebrow("CONCEPTS")}<h2>Ideas beyond the current lineup.</h2><p>Concept vehicles are not offered for sale.</p>${buttonLink("View concepts", "/concepts/", "secondary")}</section>
  </div>`;
  return shell({ title: "Vehicles", description: "Explore Vanderhall gas and electric vehicles.", path: "/vehicles", body });
};

const conceptsPage = () => {
  const body = `<div class="page concepts-page">
    ${pageHeader("DESIGN STUDIES", "Concepts", "These vehicles are concepts. They are not offered for sale, and no pricing or specifications are published here.")}
    <section class="concept-grid section--tight">${concepts.map((concept) => `<article class="concept-card"><div class="concept-card__media">${media({ src: concept.image, alt: `${concept.name} concept vehicle`, width: 656, height: 445 })}</div><span class="chip chip--concept">CONCEPT</span><h2>${concept.name}</h2></article>`).join("")}</section>
  </div>`;
  return shell({ title: "Concepts", description: "Vanderhall concept vehicles, clearly identified as not for sale.", path: "/concepts", body, bodyClass: "concepts-theme" });
};

const dealersPage = () => {
  const body = `<div class="page dealers-page">
    ${pageHeader("FIND A DEALER", "Start with your ZIP.", "The complete Vanderhall dealer directory has not yet been supplied.")}
    <section class="dealer-tools section--tight narrow">
      <form class="zip-filter" data-dealer-filter><label for="dealer-zip">ZIP</label><div class="cluster"><input id="dealer-zip" name="zip" inputmode="numeric" pattern="[0-9]{5}" maxlength="5"><button class="button button--primary" type="submit">Search</button></div></form>
      ${missing("data/dealer-list", "Names, addresses, phones, hours, and routing data are required.")}
      <a class="text-link" href="/recommend-dealer/">Recommend a Dealer<span aria-hidden="true"> →</span></a>
    </section>
    <section class="lead-section section--major narrow">${eyebrow("REQUEST INFO")}<h2>Let Vanderhall help.</h2>${leadForm({ id: "dealers-lead", presentation: "full" })}</section>
  </div>`;
  return shell({ title: "Dealers", description: "Find a Vanderhall dealer or request information.", path: "/dealers", body });
};

const aboutPage = () => {
  const body = `<div class="page about-page">
    ${pageHeader("VANDERHALL MOTOR WORKS", "Built in Provo since 2010.", "Steve Hall founded Vanderhall in 2010. The company is headquartered and manufactures in Provo, Utah.")}
    <section class="about-brand section--tight"><img src="/assets/brand/vanderhall-seal-192.png" srcset="/assets/brand/vanderhall-seal-192.png 192w, /assets/brand/vanderhall-seal-384.png 384w" sizes="160px" width="192" height="192" alt="Vanderhall Motor Works"></section>
    <section class="about-plate section--tight">${missing("feature/provo-factory", "Approved factory photography has not been supplied.")}</section>
    <section class="statement section--major narrow"><h2>From Steve Hall's founding in 2010 to production in Provo.</h2><p>The Laguna entered production in 2016. Today the Vanderhall name spans gas three-wheel roadsters and electric vehicles.</p></section>
    ${featureModule({ image: null, alt: "", eyebrowText: "FOUNDER", title: "Steve Hall", body: "Steve Hall founded Vanderhall in 2010. An approved founder portrait and additional biography have not been supplied." })}
    ${featureModule({ image: null, alt: "", eyebrowText: "MANUFACTURING", title: "Provo, Utah", body: "Vanderhall headquarters and manufacturing are in Provo, Utah. Verified factory-process copy and photography have not been supplied.", reverse: true })}
  </div>`;
  return shell({ title: "About", description: "Vanderhall was founded by Steve Hall in 2010 and manufactures in Provo, Utah.", path: "/about", body });
};

const faqPage = () => {
  const body = `<div class="page faq-page">
    ${pageHeader("SUPPORT", "Frequently asked questions", "Verified answers publish only when supported by Vanderhall source material.")}
    <section class="faq-list section--tight narrow">
      <details open><summary>Where is Vanderhall based?</summary><p>Vanderhall headquarters and manufacturing are in Provo, Utah.</p></details>
      <details><summary>When was Vanderhall founded?</summary><p>Steve Hall founded Vanderhall in 2010. The Laguna entered production in 2016.</p></details>
      <details><summary>What is the Brawley seating capacity?</summary><p>The 2026 owner's manual states a seating capacity of four.</p></details>
      <details><summary>What warranty applies to off-road products?</summary><p>Vanderhall off-road products carry a 6-month limited warranty from Vanderhall North America, LLC, also identified as Vanderhall NA.</p></details>
      <details><summary>Do I need a helmet or motorcycle endorsement?</summary>${missing("legal/licensing-faq", "The existing safety language requires legal review before publishing as guidance.")}</details>
      <div>${missing("legal/safety-boilerplate", "Legal-approved site-wide safety language has not been supplied.")}</div>
      <div class="manual-callout"><h2>Brawley owner's manual</h2><p>Read the complete 2026 source manual for operating and safety information.</p>${buttonLink("Open 2026 manual", "/assets/manuals/2026-brawley-owners-manual.pdf", "secondary")}</div>
    </section>
  </div>`;
  return shell({ title: "FAQ", description: "Verified Vanderhall support information and frequently asked questions.", path: "/faq", body });
};

const contactPage = () => {
  const body = `<div class="page contact-page">
    ${pageHeader("CONTACT", "Start the conversation.", "Tell Vanderhall which vehicle or next step interests you.")}
    <section class="lead-section section--tight narrow" id="form-destination-missing">${leadForm({ id: "contact-lead", presentation: "full" })}</section>
    <section class="gate-register section--major narrow" aria-label="Open form integration items">${missing("form/dealer-routing", "Dealer routing rules have not been supplied.")}${missing("form/spam-protection", "Final spam protection depends on the endpoint platform.")}${missing("form/success-messaging", "Approved success copy and response timing have not been supplied.")}${missing("form/email-confirmation", "Submitter confirmation behavior has not been approved.")}</section>
  </div>`;
  return shell({ title: "Contact", description: "Contact Vanderhall Motor Works.", path: "/contact", body });
};

const recommendDealerPage = () => {
  const body = `<div class="page utility-page">${pageHeader("DEALER NETWORK", "Recommend a Local Dealer", "Share a dealer candidate with Vanderhall.")}<section class="lead-section section--tight form-shell">${missing("copy/recommend-dealer-intro", "Introductory copy is pending editorial approval.")}${recommendDealerForm()}</section></div>`;
  return shell({ title: "Recommend a Local Dealer", description: "Recommend a local dealer to Vanderhall.", path: "/recommend-dealer", body });
};

const dealerInquiryPage = () => {
  const body = `<div class="page utility-page">${pageHeader("INTERNATIONAL DEALERS", "International Dealer Inquiry", "Complete all four sections to prepare an inquiry.")}<section class="lead-section section--tight form-shell">${missing("copy/dealer-inquiry-surrounding", "Dealer requirements and surrounding legacy copy are excluded pending approval.")}${internationalDealerForm()}</section></div>`;
  return shell({ title: "International Dealer Inquiry", description: "International Vanderhall dealer inquiry form.", path: "/dealer-inquiry", body });
};

const notFoundPage = () => {
  const body = `<div class="page not-found-page"><section class="not-found section--major narrow">${eyebrow("404")}<h1>This road ends here.</h1><p>The page you requested does not exist.</p><div class="cluster">${buttonLink("Go home", "/")}${buttonLink("View vehicles", "/vehicles/", "secondary")}</div></section></div>`;
  return shell({ title: "Page not found", description: "The requested page was not found.", path: "/404", body });
};

const pages = new Map([
  ["index.html", homePage()],
  ["vehicles/index.html", vehiclesPage()],
  ["concepts/index.html", conceptsPage()],
  ["dealers/index.html", dealersPage()],
  ["about/index.html", aboutPage()],
  ["faq/index.html", faqPage()],
  ["contact/index.html", contactPage()],
  ["recommend-dealer/index.html", recommendDealerPage()],
  ["dealer-inquiry/index.html", dealerInquiryPage()],
  ["404/index.html", notFoundPage()],
  ["404.html", notFoundPage()],
  ...models.map((model) => [`${model.slug}/index.html`, modelPage(model)]),
]);

for (const [relativePath, html] of pages) {
  const outputPath = resolve(websiteRoot, relativePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html);
}

await mkdir(resolve(websiteRoot, "styles"), { recursive: true });
await mkdir(resolve(websiteRoot, "scripts"), { recursive: true });
await cp(resolve(sourceRoot, "styles/tokens.css"), resolve(websiteRoot, "styles/tokens.css"));
await cp(resolve(sourceRoot, "styles/layout.css"), resolve(websiteRoot, "styles/layout.css"));
await cp(resolve(sourceRoot, "styles/site.css"), resolve(websiteRoot, "styles/site.css"));
await writeFile(resolve(websiteRoot, "styles/bundle.css"), (await Promise.all(["tokens.css", "layout.css", "site.css"].map((file) => readFile(resolve(sourceRoot, "styles", file), "utf8")))).join("\n"));
await cp(resolve(sourceRoot, "scripts/site.js"), resolve(websiteRoot, "scripts/site.js"));
await writeFile(resolve(websiteRoot, "robots.txt"), "User-agent: *\nAllow: /\n");
await writeFile(resolve(websiteRoot, "site.webmanifest"), JSON.stringify({ name: "Vanderhall Motor Works", short_name: "Vanderhall", icons: [{ src: "/assets/brand/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/assets/brand/icon-512.png", sizes: "512x512", type: "image/png" }], theme_color: "#0E0E10", background_color: "#FFFFFF", display: "standalone" }, null, 2));
await writeFile(resolve(websiteRoot, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["", "vehicles", "venice", "carmel", "santarosa", "brawley", "concepts", "dealers", "recommend-dealer", "dealer-inquiry", "about", "faq", "contact"].map((route) => `<url><loc>https://vanderhall-website.vercel.app/${route ? `${route}/` : ""}</loc></url>`).join("")}</urlset>`);

console.log(`Built ${pages.size} HTML pages.`);
