import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { concepts } from "./data/concepts.mjs";
import { modelBySlug, models } from "./data/models.mjs";
import {
  buttonLink,
  conceptCard,
  eyebrow,
  figureBand,
  hero,
  internationalDealerForm,
  leadForm,
  modelBar,
  pageHeader,
  pathways,
  photoScroll,
  price,
  recommendDealerForm,
  sectionHeading,
  shell,
  sizeOf,
  specTable,
  textLink,
  vehicleSection,
  walkaround,
} from "./components.mjs";

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const websiteRoot = resolve(sourceRoot, "..");

const modelPage = (model) => {
  const hasSpecs = model.specGroups.length > 0;
  const cta = model.cta || { label: "Request info", href: `/dealers/?model=${model.slug}` };
  const heroContent = `${eyebrow(`${model.powertrain.fuel} · ${model.powertrain.layout}`)}
      <h1>${model.name}</h1>
      <p class="hero__descriptor">${model.descriptor}</p>
      <div class="hero__actions">${buttonLink(cta.label, cta.href, "inverse")}${hasSpecs ? '<a class="button button--ghost-inverse" href="#specifications">Specifications</a>' : ""}</div>`;
  const body = `<div class="page">
    ${hero({ src: model.images.hero, srcset: model.images.heroSrcset, tallSrcset: model.images.heroTallSrcset, alt: model.images.heroAlt, focal: model.images.focal, align: model.images.heroAlign, content: heroContent })}
    ${modelBar(model)}
    <section class="section--tight narrow"><p class="lede">${model.overview}</p></section>
    <section class="section">${sectionHeading("IN DETAIL", `A closer look at ${model.name}.`)}${photoScroll(model.images.modules)}</section>
    ${hasSpecs ? `<section class="section narrow centered" id="specifications">${sectionHeading("SPECIFICATIONS", "Published figures")}${specTable(model)}</section>` : ""}
  </div>`;
  return shell({ title: model.name, description: model.descriptor, path: `/${model.slug}`, body });
};

// The purchase page. /brawley/ stays the editorial page, six photographs each carrying one true
// sentence, and this is the transaction: the studio walkaround, the paint tiers, the price, and
// the two ways to act on it. Splitting them keeps the configurator from burying the photo essay.
const brawleyGtsPage = (model) => {
  const gts = model.gts;
  const actions = (variant) => `<div class="cluster">${buttonLink("Order yours now", gts.reserveUrl, variant)}${textLink("Request info", `/dealers/?model=${model.slug}`)}</div>`;
  const scene = {
    src: `/assets/images/brawley/lifestyle/${gts.scene.name}-1280.webp`,
    srcset: [640, 800, 960, 1280].map((width) => `/assets/images/brawley/lifestyle/${gts.scene.name}-${width}.webp ${width}w`).join(", "),
  };
  const body = `<div class="page">
    ${modelBar(model, { name: gts.name, label: "Order yours now", href: gts.reserveUrl })}
    <section class="section--tight">
      <div class="gts-open">
        <div class="gts-open__row">
          <div class="gts-open__intro">
            ${eyebrow("ELECTRIC OFF-ROAD UTV")}
            <h1>${gts.name}</h1>
            <p class="gts-open__descriptor">${gts.descriptor}</p>
          </div>
          ${price(gts.price, gts.priceDisclaimer, gts.delivery)}
        </div>
        ${actions("primary")}
      </div>
    </section>
    <section class="section--tight">${walkaround(gts)}</section>
    <section class="section--tight">${figureBand(gts.figures)}<p class="gts-note">${gts.specDisclaimer}</p></section>
    <section class="section--tight"><figure class="gts-scene"><img src="${scene.src}" srcset="${scene.srcset}" sizes="(min-width: 1280px) 1200px, 92vw" width="${sizeOf(scene.src).width}" height="${sizeOf(scene.src).height}" alt="${gts.scene.alt}" loading="lazy" decoding="async"><figcaption>${gts.scene.label}</figcaption></figure></section>
    <section class="section narrow centered" id="specifications">${sectionHeading("SPECIFICATIONS", "Published figures")}${specTable(model)}</section>
    <section class="section--tight narrow centered">
      ${sectionHeading("ORDER", `Reserve your ${gts.name}.`, "Order through the Vanderhall reservation system, or ask Vanderhall to connect you with a dealer.")}
      ${actions("primary")}
    </section>
    <section class="section--tight narrow centered">
      <div class="disclosures">
        ${eyebrow("DISCLOSURES")}
        <p>${gts.priceDisclaimer}</p>
        <p>${gts.specDisclaimer}</p>
        ${gts.safety.map((paragraph) => `<p>${paragraph}</p>`).join("")}
      </div>
    </section>
  </div>`;
  return shell({
    title: gts.name,
    description: `${gts.name} pricing and paint colors. ${gts.price.value} MSRP, quad-motor 4WD, 488 lb-ft of torque, and up to 140 mi of range.`,
    path: "/brawley/gts",
    body,
  });
};

const homePage = () => {
  const indio = concepts[0];
  const heroContent = `${eyebrow("VANDERHALL MOTOR WORKS")}
      <h1>Hand-built in Provo, Utah.</h1>
      <p class="hero__descriptor">Three-wheel gas roadsters and electric vehicles, built by Vanderhall since 2010.</p>
      <div class="hero__actions">${buttonLink("Explore vehicles", "/vehicles/", "inverse")}</div>`;
  const body = `<div class="page">
    ${hero({ src: "/assets/images/v3/heroes/home/home-wide-1920.webp", srcset: "/assets/images/v3/heroes/home/home-wide-960.webp 960w, /assets/images/v3/heroes/home/home-wide-1280.webp 1280w, /assets/images/v3/heroes/home/home-wide-1920.webp 1920w, /assets/images/v3/heroes/home/home-wide-2560.webp 2560w", tallSrcset: "/assets/images/v3/heroes/home/home-tall-480.webp 480w, /assets/images/v3/heroes/home/home-tall-720.webp 720w, /assets/images/v3/heroes/home/home-tall-800.webp 800w, /assets/images/v3/heroes/home/home-tall-960.webp 960w", alt: "Tan Vanderhall Brawley climbing a rock ledge above a mountain lake", focal: "50% 50%", content: heroContent })}
    <section class="section" id="vehicles">
      ${sectionHeading("VEHICLES", "Gas and electric, built in Provo.")}
      <!-- Every section here sits below the hero, so none of them competes with it for
           bandwidth. The hero is the only eagerly fetched image on this page. -->
      <div class="vehicle-scroll">${models.map((model, index) => vehicleSection(model, { index, copy: model.summary })).join("")}</div>
    </section>
    <section class="section split">
      <div class="split__body">${sectionHeading("CONCEPTS", "Design studies")}<p>Nine Vanderhall concept vehicles. They are not offered for sale.</p><div class="cluster">${buttonLink("View concepts", "/concepts/", "secondary")}</div></div>
      <a class="split__media" href="/concepts/"><img src="${indio.hero.src}" srcset="${indio.hero.srcset}" width="${sizeOf(indio.hero.src).width}" height="${sizeOf(indio.hero.src).height}" sizes="(min-width: 768px) 45vw, 92vw" alt="${indio.hero.alt}" loading="lazy" decoding="async"></a>
    </section>
    <section class="section">${pathways([
      { title: "Owner resources", body: "Vanderhall owner's manuals by model and year.", label: "View owner resources", href: "/owners/" },
      { title: "Talk with Vanderhall", body: "Tell Vanderhall where you are and which vehicle interests you.", label: "Request info", href: "/dealers/" },
    ])}</section>
  </div>`;
  return shell({ title: "Home", description: "Vanderhall Motor Works builds three-wheel gas roadsters and electric vehicles in Provo, Utah.", path: "/", body });
};

const vehiclesPage = () => {
  const body = `<div class="page">
    ${pageHeader("VEHICLES", "Vehicles", "Two three-wheel gas roadsters, one three-wheel electric autocycle, and one electric off-road UTV. All four are hand-built in Provo, Utah.")}
    <section class="section">
      <div class="vehicle-scroll">${models.map((model, index) => vehicleSection(model, { index, copy: model.intro, eager: index === 0, level: 2, withSupport: true })).join("")}</div>
    </section>
  </div>`;
  return shell({ title: "Vehicles", description: "The Vanderhall vehicle lineup: Venice, Carmel, Santarosa, and Brawley.", path: "/vehicles", body });
};

const conceptsPage = () => {
  const body = `<div class="page">
    ${pageHeader("CONCEPTS", "Design studies", "These nine vehicles are Vanderhall concepts. They are not offered for sale, and no pricing or specifications are published for them.")}
    <section class="section--tight"><div class="card-grid card-grid--concepts">${concepts.map((concept, index) => conceptCard(concept, { eager: index < 3 })).join("")}</div></section>
  </div>`;
  return shell({ title: "Concepts", description: "Vanderhall concept vehicles and design studies, not offered for sale.", path: "/concepts", body });
};

const conceptImage = (item, { eager = false } = {}) => {
  const { width, height } = sizeOf(item.src);
  return `<picture>${item.mobile ? `<source media="(max-width: 639px)" srcset="${item.mobile}">` : ""}<img src="${item.src}"${item.srcset ? ` srcset="${item.srcset}"` : ""} sizes="(min-width: 1280px) 1200px, 92vw" width="${width}" height="${height}" alt="${item.alt}" loading="${eager ? "eager" : "lazy"}"${eager ? ' fetchpriority="high"' : ""} decoding="async"></picture>`;
};

const conceptPage = (concept) => {
  const body = `<div class="page">
    <header class="page-header concept-header">
      ${eyebrow("CONCEPT")}
      <h1>${concept.name}</h1>
      <span class="wordmark"><img src="${concept.wordmark.src}" width="${concept.wordmark.width}" height="${concept.wordmark.height}" alt="" loading="lazy" decoding="async"></span>
      <p>${concept.category}</p>
      <p class="concept-status">Concept vehicle. Not offered for sale.</p>
    </header>
    <section class="section--tight"><div class="concept-figure">${conceptImage(concept.hero, { eager: true })}</div></section>
    <section class="section--tight narrow"><p class="lede">${concept.intro}</p></section>
    ${concept.gallery.length ? `<section class="section--tight concept-gallery">${concept.gallery.map((item) => `<div class="concept-figure">${conceptImage(item)}</div>`).join("")}</section>` : ""}
    <nav class="concept-back section--tight" aria-label="Concept navigation"><a href="/concepts/"><span aria-hidden="true">← </span>All concepts</a></nav>
  </div>`;
  return shell({ title: `${concept.name} concept`, description: `${concept.name}, a Vanderhall ${concept.category.toLowerCase()} that is not offered for sale.`, path: `/concepts/${concept.slug}`, body });
};

const dealersPage = () => {
  const body = `<div class="page">
    ${pageHeader("DEALERS", "Find your dealer.", "Vanderhall vehicles are sold through a dealer network. Tell Vanderhall where you are and which vehicle interests you, and someone will connect you with a dealer.", "form-shell")}
    <section class="section--tight form-shell" id="request-info">
      <h2 class="form-heading">Request information</h2>
      ${leadForm()}
    </section>
    <section class="section--tight">${pathways([
      { title: "Know a dealer", body: "Recommend a dealer in your area for the Vanderhall network.", label: "Recommend a dealer", href: "/recommend-dealer/" },
      { title: "Selling Vanderhall", body: "Inquire about becoming an international Vanderhall dealer.", label: "Become a dealer", href: "/dealer-inquiry/" },
    ])}</section>
  </div>`;
  return shell({ title: "Dealers", description: "Request information from Vanderhall, recommend a dealer, or apply to become one.", path: "/dealers", body });
};

const recommendDealerPage = () => {
  const body = `<div class="page">${pageHeader("DEALER NETWORK", "Recommend a dealer", "Share a dealer candidate with Vanderhall.", "form-shell")}<section class="section--tight form-shell">${recommendDealerForm()}</section></div>`;
  return shell({ title: "Recommend a dealer", description: "Recommend a local dealer to Vanderhall.", path: "/recommend-dealer", body });
};

const dealerInquiryPage = () => {
  const body = `<div class="page">${pageHeader("INTERNATIONAL DEALERS", "Become a dealer", "Complete every section to prepare an international dealer inquiry.", "form-shell")}<section class="section--tight form-shell">${internationalDealerForm()}</section></div>`;
  return shell({ title: "Become a dealer", description: "International Vanderhall dealer inquiry.", path: "/dealer-inquiry", body });
};

const notFoundPage = () => {
  const body = `<div class="page"><section class="section not-found narrow">${eyebrow("404")}<h1>This road ends here.</h1><p>The page you requested does not exist.</p><div class="cluster">${buttonLink("Go home", "/")}${buttonLink("View vehicles", "/vehicles/", "secondary")}</div></section></div>`;
  return shell({ title: "Page not found", description: "The requested page was not found.", path: "/404", body });
};

const ownerManuals = [
  ["venice", "Venice", 2017, "2017-vanderhall-venice-owners-manual.pdf"],
  ["venice", "Venice", 2018, "2018-vanderhall-venice-owners-manual.pdf"],
  ["venice", "Venice", 2019, "2019-vanderhall-venice-owners-manual.pdf"],
  ["venice", "Venice", 2020, "2020-vanderhall-venice-owners-manual.pdf"],
  ["venice", "Venice", 2021, "2021-vanderhall-venice-owners-manual.pdf"],
  ["venice", "Venice", 2022, "2022-vanderhall-venice-owners-manual.pdf"],
  ["venice", "Venice", 2023, "2023-vanderhall-venice-owners-manual.pdf"],
  ["venice", "Venice", 2024, "2024-vanderhall-venice-owners-manual.pdf"],
  ["carmel", "Carmel", 2020, "2020-vanderhall-carmel-owners-manual.pdf"],
  ["carmel", "Carmel", 2021, "2021-vanderhall-carmel-owners-manual.pdf"],
  ["carmel", "Carmel", 2022, "2022-vanderhall-carmel-owners-manual.pdf"],
  ["carmel", "Carmel", 2023, "2023-vanderhall-carmel-owners-manual.pdf"],
  ["carmel", "Carmel", 2024, "2024-vanderhall-carmel-owners-manual.pdf"],
  ["brawley", "Brawley", 2024, "2024-brawley-owners-manual.pdf"],
  ["brawley", "Brawley", 2024, "2024-brawley-owners-manual-spanish.pdf", "Spanish"],
  ["brawley", "Brawley", 2025, "2025-brawley-owners-manual.pdf"],
  ["brawley", "Brawley", 2026, "2026-brawley-owners-manual.pdf"],
  ["speedster", "Speedster", 2019, "2019-vanderhall-speedster-owners-manual.pdf"],
  ["laguna", "Laguna", 2016, "2016-vanderhall-laguna-owners-manual.pdf"],
];

const ownerManualData = await Promise.all(ownerManuals.map(async ([slug, model, year, file, language = "English"]) => {
  const info = await stat(resolve(websiteRoot, "assets/manuals", file));
  const size = info.size >= 1024 * 1024 ? `${(info.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(info.size / 1024)} KB`;
  return { slug, model, year, file, language, size };
}));

const ownersPage = () => {
  const groups = ["venice", "carmel", "brawley", "speedster", "laguna"].map((slug) => {
    const manuals = ownerManualData.filter((manual) => manual.slug === slug);
    return `<section class="resource-group" id="${slug}"><h2>${manuals[0].model}</h2><div class="resource-list">${manuals.map((manual) => `<a class="resource-row" href="/assets/manuals/${manual.file}" type="application/pdf"><span class="resource-row__title">${manual.year} ${manual.model} owner's manual${manual.language === "Spanish" ? " (Spanish)" : ""}</span><span class="resource-row__meta">PDF · ${manual.size}</span></a>`).join("")}</div></section>`;
  }).join("");
  const body = `<div class="page">
    ${pageHeader("OWNERS", "Owner resources", "Vanderhall owner's manuals, grouped by model and year. Each file opens as a PDF.")}
    <section class="section--tight narrow"><div class="resource-groups">${groups}</div></section>
  </div>`;
  return shell({ title: "Owner resources", description: "Vanderhall owner's manuals grouped by model and year.", path: "/owners", body });
};

const routes = [
  "",
  "vehicles",
  ...models.map((model) => model.slug),
  "brawley/gts",
  "concepts",
  ...concepts.map((concept) => `concepts/${concept.slug}`),
  "owners",
  "dealers",
  "recommend-dealer",
  "dealer-inquiry",
];

const pages = new Map([
  ["index.html", homePage()],
  ["vehicles/index.html", vehiclesPage()],
  ["concepts/index.html", conceptsPage()],
  ...concepts.map((concept) => [`concepts/${concept.slug}/index.html`, conceptPage(concept)]),
  ["dealers/index.html", dealersPage()],
  ["owners/index.html", ownersPage()],
  ["recommend-dealer/index.html", recommendDealerPage()],
  ["dealer-inquiry/index.html", dealerInquiryPage()],
  ["404/index.html", notFoundPage()],
  ["404.html", notFoundPage()],
  ...models.map((model) => [`${model.slug}/index.html`, modelPage(model)]),
  ["brawley/gts/index.html", brawleyGtsPage(modelBySlug.brawley)],
]);

for (const [relativePath, html] of pages) {
  const outputPath = resolve(websiteRoot, relativePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html);
}

await mkdir(resolve(websiteRoot, "styles"), { recursive: true });
await mkdir(resolve(websiteRoot, "scripts"), { recursive: true });
await writeFile(resolve(websiteRoot, "styles/bundle.css"), (await Promise.all(["tokens.css", "layout.css", "site.css"].map((file) => readFile(resolve(sourceRoot, "styles", file), "utf8")))).join("\n"));
await cp(resolve(sourceRoot, "scripts/site.js"), resolve(websiteRoot, "scripts/site.js"));
await writeFile(resolve(websiteRoot, "robots.txt"), "User-agent: *\nAllow: /\n");
await writeFile(resolve(websiteRoot, "site.webmanifest"), JSON.stringify({ name: "Vanderhall Motor Works", short_name: "Vanderhall", icons: [{ src: "/assets/brand/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/assets/brand/icon-512.png", sizes: "512x512", type: "image/png" }], theme_color: "#0E0E10", background_color: "#FFFFFF", display: "standalone" }, null, 2));
await writeFile(resolve(websiteRoot, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>https://vanderhall-website.vercel.app/${route ? `${route}/` : ""}</loc></url>`).join("")}</urlset>`);

console.log(`Built ${pages.size} HTML pages.`);
