import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { concepts } from "./data/concepts.mjs";
import { models } from "./data/models.mjs";
import {
  buttonLink,
  conceptCard,
  eyebrow,
  gallery,
  hero,
  internationalDealerForm,
  leadForm,
  pageHeader,
  recommendDealerForm,
  sectionHeading,
  shell,
  specTable,
  textLink,
  relatedGrid,
  vehicleGrid,
} from "./components.mjs";

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const websiteRoot = resolve(sourceRoot, "..");

// Concept slides are trimmed at export, so their delivered sizes vary. Read them from the
// build manifest instead of restating them, which keeps width and height honest.
const manifest = JSON.parse(await readFile(resolve(websiteRoot, "assets/build-manifest.json"), "utf8"));
const deliveredSize = new Map(manifest
  .filter((entry) => entry.output_width && entry.output_height)
  .map((entry) => [`/${entry.delivered_file}`, { width: entry.output_width, height: entry.output_height }]));
const sizeOf = (src) => {
  const size = deliveredSize.get(src);
  if (!size) throw new Error(`No delivered dimensions recorded for ${src}`);
  return size;
};

const relatedModels = (slug) => models.filter((model) => model.slug !== slug).slice(0, 2);

const modelPage = (model) => {
  const hasSpecs = model.specGroups.length > 0;
  const heroContent = `${eyebrow(`${model.powertrain.fuel} · ${model.powertrain.layout}`)}
      <h1>${model.name}</h1>
      <p class="hero__descriptor">${model.descriptor}</p>
      <div class="hero__actions">${buttonLink("Request info", `/contact/?model=${model.slug}`, "inverse")}${hasSpecs ? '<a class="button button--ghost-inverse" href="#specifications">Specifications</a>' : ""}</div>`;
  const body = `<div class="page">
    ${hero({ src: model.images.hero, srcset: model.images.heroSrcset, tallSrcset: model.images.heroTallSrcset, alt: model.images.heroAlt, focal: model.images.focal, align: model.images.heroAlign, content: heroContent })}
    <section class="section narrow"><p class="lede">${model.overview}</p></section>
    <section class="section">${sectionHeading("GALLERY", `${model.name} in detail`)}${gallery(model.images.gallery)}</section>
    ${hasSpecs ? `<section class="section narrow" id="specifications">${sectionHeading("SPECIFICATIONS", "Published figures")}${specTable(model)}</section>` : ""}
    <section class="section">${sectionHeading("KEEP EXPLORING", "Other vehicles")}${relatedGrid(relatedModels(model.slug))}</section>
  </div>`;
  return shell({ title: model.name, description: model.descriptor, path: `/${model.slug}`, body });
};

const homePage = () => {
  const indio = concepts[0];
  const heroContent = `${eyebrow("VANDERHALL MOTOR WORKS")}
      <h1>Hand-built in Provo, Utah.</h1>
      <p class="hero__descriptor">Three-wheel gas roadsters and electric vehicles, built by Vanderhall since 2010.</p>
      <div class="hero__actions">${buttonLink("Explore vehicles", "/vehicles/", "inverse")}</div>`;
  const body = `<div class="page">
    ${hero({ src: "/assets/images/v2/heroes/home/home-wide-1920.webp", srcset: "/assets/images/v2/heroes/home/home-wide-960.webp 960w, /assets/images/v2/heroes/home/home-wide-1280.webp 1280w, /assets/images/v2/heroes/home/home-wide-1920.webp 1920w, /assets/images/v2/heroes/home/home-wide-2560.webp 2560w", tallSrcset: "/assets/images/v2/heroes/home/home-tall-480.webp 480w, /assets/images/v2/heroes/home/home-tall-720.webp 720w, /assets/images/v2/heroes/home/home-tall-960.webp 960w", alt: "Green Vanderhall Brawley on a mountain pass at sunset", focal: "47% 60%", content: heroContent })}
    <section class="section" id="vehicles">${sectionHeading("VEHICLES", "Choose a vehicle")}${vehicleGrid(models)}</section>
    <section class="section split">
      <div class="split__body">${sectionHeading("CONCEPTS", "Design studies")}<p>Nine Vanderhall concept vehicles. They are not offered for sale.</p><div class="cluster">${buttonLink("View concepts", "/concepts/", "secondary")}</div></div>
      <a class="split__media" href="/concepts/"><img src="${indio.hero.src}" srcset="${indio.hero.srcset}" width="${sizeOf(indio.hero.src).width}" height="${sizeOf(indio.hero.src).height}" sizes="(min-width: 768px) 45vw, 92vw" alt="${indio.hero.alt}" loading="lazy" decoding="async"></a>
    </section>
    <section class="section row-links">
      <div><h2>Owner resources</h2><p>Vanderhall owner's manuals by model and year.</p>${textLink("View owner resources", "/owners/")}</div>
      <div><h2>Talk with Vanderhall</h2><p>Ask about a vehicle or how to reach a dealer.</p>${textLink("Request info", "/contact/")}</div>
    </section>
  </div>`;
  return shell({ title: "Home", description: "Vanderhall Motor Works builds three-wheel gas roadsters and electric vehicles in Provo, Utah.", path: "/", body });
};

const vehiclesPage = () => {
  const body = `<div class="page">
    ${pageHeader("VEHICLES", "The Vanderhall lineup", "Four vehicles, gas and electric. Choose one to see its photography and published specifications.")}
    <section class="section--tight">${vehicleGrid(models, { eagerCount: 1, level: 2 })}</section>
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

const conceptPage = (concept, index) => {
  const previous = concepts[(index - 1 + concepts.length) % concepts.length];
  const next = concepts[(index + 1) % concepts.length];
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
    <nav class="concept-ring section--tight" aria-label="Concept navigation"><a rel="prev" href="/concepts/${previous.slug}/"><span aria-hidden="true">← </span>${previous.name}</a><a href="/concepts/">All concepts</a><a rel="next" href="/concepts/${next.slug}/">${next.name}<span aria-hidden="true"> →</span></a></nav>
  </div>`;
  return shell({ title: `${concept.name} concept`, description: `${concept.name}, a Vanderhall ${concept.category.toLowerCase()} that is not offered for sale.`, path: `/concepts/${concept.slug}`, body });
};

const dealersPage = () => {
  const body = `<div class="page">
    ${pageHeader("DEALERS", "Vanderhall dealers", "Vanderhall vehicles are sold through a dealer network. Send a request and Vanderhall will help you find the nearest dealer.")}
    <section class="section--tight row-links row-links--three">
      <div><h2>Looking for a vehicle</h2><p>Tell Vanderhall which vehicle interests you and where you are.</p>${textLink("Request info", "/contact/")}</div>
      <div><h2>Know a dealer</h2><p>Recommend a dealer in your area for the Vanderhall network.</p>${textLink("Recommend a dealer", "/recommend-dealer/")}</div>
      <div><h2>Selling Vanderhall</h2><p>Enquire about becoming an international Vanderhall dealer.</p>${textLink("Become a dealer", "/dealer-inquiry/")}</div>
    </section>
  </div>`;
  return shell({ title: "Dealers", description: "How to reach a Vanderhall dealer, recommend one, or apply to become one.", path: "/dealers", body });
};

const faqPage = () => {
  const body = `<div class="page">
    ${pageHeader("SUPPORT", "Frequently asked questions", "Answers published here come from Vanderhall source material.")}
    <section class="section--tight narrow faq-list">
      <details open><summary>Where is Vanderhall based?</summary><p>Vanderhall headquarters and manufacturing are in Provo, Utah.</p></details>
      <details><summary>When was Vanderhall founded?</summary><p>Steve Hall founded Vanderhall in 2010. The Laguna entered production in 2016.</p></details>
      <details><summary>What is the Brawley seating capacity?</summary><p>The 2026 owner's manual states a seating capacity of four.</p></details>
      <details><summary>What warranty applies to off-road products?</summary><p>Vanderhall off-road products carry a 6-month limited warranty from Vanderhall North America, LLC, also identified as Vanderhall NA.</p></details>
      <details><summary>Where can I find an owner's manual?</summary><p>Owner's manuals for Venice, Carmel, Brawley, Speedster, and Laguna are on the owner resources page.</p></details>
    </section>
    <section class="section--tight row-links">
      <div><h2>Owner resources</h2><p>Browse owner's manuals by model and year.</p>${textLink("View owner resources", "/owners/")}</div>
      <div><h2>Still have a question</h2><p>Send Vanderhall a request and someone will follow up.</p>${textLink("Request info", "/contact/")}</div>
    </section>
  </div>`;
  return shell({ title: "Support", description: "Vanderhall support answers and owner resources.", path: "/faq", body });
};

const contactPage = () => {
  const body = `<div class="page">
    ${pageHeader("CONTACT", "Request information", "Tell Vanderhall which vehicle interests you and how to reach you.")}
    <section class="section--tight narrow" id="request-info">${leadForm()}</section>
  </div>`;
  return shell({ title: "Contact", description: "Request information from Vanderhall Motor Works.", path: "/contact", body });
};

const recommendDealerPage = () => {
  const body = `<div class="page">${pageHeader("DEALER NETWORK", "Recommend a dealer", "Share a dealer candidate with Vanderhall.")}<section class="section--tight form-shell">${recommendDealerForm()}</section></div>`;
  return shell({ title: "Recommend a dealer", description: "Recommend a local dealer to Vanderhall.", path: "/recommend-dealer", body });
};

const dealerInquiryPage = () => {
  const body = `<div class="page">${pageHeader("INTERNATIONAL DEALERS", "Become a dealer", "Complete every section to prepare an international dealer inquiry.")}<section class="section--tight form-shell">${internationalDealerForm()}</section></div>`;
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
  "concepts",
  ...concepts.map((concept) => `concepts/${concept.slug}`),
  "owners",
  "dealers",
  "recommend-dealer",
  "dealer-inquiry",
  "faq",
  "contact",
];

const pages = new Map([
  ["index.html", homePage()],
  ["vehicles/index.html", vehiclesPage()],
  ["concepts/index.html", conceptsPage()],
  ...concepts.map((concept, index) => [`concepts/${concept.slug}/index.html`, conceptPage(concept, index)]),
  ["dealers/index.html", dealersPage()],
  ["faq/index.html", faqPage()],
  ["contact/index.html", contactPage()],
  ["owners/index.html", ownersPage()],
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
await writeFile(resolve(websiteRoot, "styles/bundle.css"), (await Promise.all(["tokens.css", "layout.css", "site.css"].map((file) => readFile(resolve(sourceRoot, "styles", file), "utf8")))).join("\n"));
await cp(resolve(sourceRoot, "scripts/site.js"), resolve(websiteRoot, "scripts/site.js"));
await writeFile(resolve(websiteRoot, "robots.txt"), "User-agent: *\nAllow: /\n");
await writeFile(resolve(websiteRoot, "site.webmanifest"), JSON.stringify({ name: "Vanderhall Motor Works", short_name: "Vanderhall", icons: [{ src: "/assets/brand/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/assets/brand/icon-512.png", sizes: "512x512", type: "image/png" }], theme_color: "#0E0E10", background_color: "#FFFFFF", display: "standalone" }, null, 2));
await writeFile(resolve(websiteRoot, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>https://vanderhall-website.vercel.app/${route ? `${route}/` : ""}</loc></url>`).join("")}</urlset>`);

console.log(`Built ${pages.size} HTML pages.`);
