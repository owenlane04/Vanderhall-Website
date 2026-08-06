import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { concepts } from "./data/concepts.mjs";
import { modelBySlug, models } from "./data/models.mjs";
import { privacySections, PRIVACY_SOURCE_LINE } from "./data/privacy.mjs";
import { heroLoop } from "./data/video.mjs";
import {
  backLink,
  buttonLink,
  conceptCard,
  conceptMarquee,
  escapeHtml,
  eyebrow,
  figureBand,
  hero,
  internationalDealerForm,
  leadForm,
  modelBar,
  modelHeadline,
  pageHeader,
  organizationSchema,
  photoScroll,
  price,
  productSchema,
  recommendDealerForm,
  sectionHeading,
  shell,
  sizeOf,
  specNote,
  specTable,
  textLink,
  vehicleSection,
  walkaround,
} from "./components.mjs";

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const websiteRoot = resolve(sourceRoot, "..");

// One way back from every page below the homepage, one level up. This map is the single source:
// scripts/check-content.mjs mirrors it and fails the build if any page disagrees with it, so a new
// route cannot ship without deciding where its back link goes.
const PARENTS = {
  vehicles: { label: "Home", href: "/" },
  concepts: { label: "Home", href: "/" },
  owners: { label: "Home", href: "/" },
  dealers: { label: "Home", href: "/" },
  brawley: { label: "All vehicles", href: "/vehicles/" },
  santarosa: { label: "All vehicles", href: "/vehicles/" },
  carmel: { label: "All vehicles", href: "/vehicles/" },
  venice: { label: "All vehicles", href: "/vehicles/" },
  "brawley/gts": { label: "Brawley", href: "/brawley/" },
  concept: { label: "All concepts", href: "/concepts/" },
  "recommend-dealer": { label: "Dealers", href: "/dealers/" },
  "dealer-inquiry": { label: "Dealers", href: "/dealers/" },
  privacy: { label: "Home", href: "/" },
};

const modelPage = (model) => {
  const cta = model.cta || { label: "Contact", href: `/dealers/?model=${model.slug}` };
  const heroContent = `${eyebrow(`${model.powertrain.fuel} · ${model.powertrain.layout}`)}
      ${modelHeadline(model.name, { level: 1, pastModel: model.pastModel })}
      <p class="hero__descriptor">${model.descriptor}</p>
      <div class="hero__actions">${buttonLink(cta.label, cta.href, "inverse")}</div>`;
  const body = `<div class="page">
    ${hero({ src: model.images.hero, srcset: model.images.heroSrcset, tallSrcset: model.images.heroTallSrcset, alt: model.images.heroAlt, focal: model.images.focal, align: model.images.heroAlign, content: heroContent })}
    ${/* The bar carries the way back on every model page now, which is something the header does
          not offer, so it earns its space on all four rather than on Brawley alone. */
      modelBar(model, { back: PARENTS[model.slug] })}
    <section class="section--tight narrow"><p class="lede">${model.overview}</p></section>
    ${/* V11-A: the ambient block that sat here between the overview and the detail scroll is gone
          with the other two loops. The overview now runs straight into "A closer look", which is
          the shape all four model pages shared before V10 and share again. */""}
    <section class="section">
      ${sectionHeading("IN DETAIL", `A closer look at ${model.name}.`)}
      ${/* Each photograph carries the figures it shows. The specification table that used to sit
            at the foot of this page is gone: a reference block down there went unread, while the
            photographs were carrying prose about where the vehicle was parked. */
        photoScroll(model.images.modules)}
    </section>
    <section class="section--tight narrow centered">${specNote(model)}</section>
  </div>`;
  return shell({ title: model.name, description: model.descriptor, path: `/${model.slug}`, body });
};

// The purchase page. /brawley/ stays the editorial page, six photographs each carrying one true
// sentence, and this is the transaction: the studio walkaround, the paint tiers, the price, and
// the two ways to act on it. Splitting them keeps the configurator from burying the photo essay.
const brawleyGtsPage = (model) => {
  const gts = model.gts;
  const actions = (variant) => `<div class="cluster">${buttonLink("Order yours now", gts.reserveUrl, variant)}${textLink("Contact", `/dealers/?model=${model.slug}`)}</div>`;
  const scene = {
    src: `/assets/images/brawley/lifestyle/${gts.scene.name}-1280.webp`,
    srcset: [640, 800, 960, 1280].map((width) => `/assets/images/brawley/lifestyle/${gts.scene.name}-${width}.webp ${width}w`).join(", "),
  };
  const body = `<div class="page">
    ${modelBar(model, { name: gts.name, label: "Order yours now", href: gts.reserveUrl, back: PARENTS["brawley/gts"] })}
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
    ${/* V11-A: the action loop that sat between the lifestyle photograph and the figures is gone.
          The purchase page is now entirely still: the studio walkaround, the paint tiers, the price,
          and the specification block. */""}
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
    schema: productSchema(model),
  });
};

const homePage = () => {
  const indio = concepts[0];
  // Owen's copy. D-V9-5 approved one long sentence as the h1; he then asked in chat on 2026-08-05 for
  // a shorter title with the reference detail moved into the descriptor beneath it. Not one word is
  // new: the vehicle types and the experience line are his, redistributed. The title is a phrase again
  // rather than a full sentence, which is what the display-xl step is for.
  //
  // This is also why organizationSchema below publishes no founding date: the markup may only restate
  // visible text, and 2010 left the site with the old Provo hero. Provo survives in the footer line on
  // every page, which is what keeps the schema's address legitimate.
  const heroContent = `${eyebrow("VANDERHALL MOTOR WORKS")}
      <h1>Handcrafted electric vehicles.</h1>
      <p class="hero__descriptor">Vanderhall builds electric UTVs, side-by-sides, and three-wheeled autocycles. Experience performance, comfort, and style.</p>
      <div class="hero__actions">${buttonLink("Explore vehicles", "/vehicles/", "inverse")}</div>`;
  const body = `<div class="page">
    ${/* V10 moved the front of the page from a photograph to a video poster; V11-A changes which
          loop it is. The still is the montage's own frame at 00:02.5 rather than a separate
          photograph, which is what makes the switch to video invisible: same subject, same crop,
          same focal point, so nothing jumps when the loop fades in over it.
          The poster remains the eagerly fetched, high-priority LCP element. The video carries no
          autoplay and no src until site.js supplies one, after the load event and only above the
          768px gate Owen set on 2026-08-05: this clip is 2.83 MB against the 292 KB one it replaces,
          and a phone gets the poster instead. */
      hero({
        src: heroLoop.poster.src,
        srcset: heroLoop.poster.srcset,
        alt: heroLoop.poster.alt,
        width: heroLoop.poster.width,
        height: heroLoop.poster.height,
        focal: heroLoop.focal,
        content: heroContent,
        video: heroLoop,
      })}
    <section class="section" id="vehicles">
      ${/* The old heading read "Gas and electric, built in Provo.", which collided with the new
            hero's electric positioning the moment both sat on the same screen. */
        sectionHeading("VEHICLES", "The Vanderhall lineup.")}
      <!-- Every section here sits below the hero, so none of them competes with it for
           bandwidth. The hero is the only eagerly fetched image on this page. -->
      <div class="vehicle-scroll">${models.map((model, index) => vehicleSection(model, { index, copy: model.summary })).join("")}</div>
    </section>
    ${/* V11-D: media on the left from 768px up. The DOM keeps the body first, so reading order and
          tab order are unchanged and the swap is a grid-area assignment in site.css, the same move
          .vehicle-section--reverse already makes. The two pathway cards that used to close the page
          are gone: Owen, on 2026-08-05, "that's just crowding it at the bottom". Both destinations
          stay in the primary navigation and in the footer on every page, so nothing is unreachable.
          One title, matching the page it leads to. The eyebrow here read CONCEPTS above a heading
          reading "Design studies", which is the pair of near-identical titles V10 removed. */""}
    <section class="section split split--media-first">
      <div class="split__body">${sectionHeading(null, "Concepts")}<p>Nine Vanderhall concept vehicles. They are not offered for sale.</p><div class="cluster">${buttonLink("View concepts", "/concepts/", "secondary")}</div></div>
      <a class="split__media" href="/concepts/"><img src="${indio.hero.src}" srcset="${indio.hero.srcset}" width="${sizeOf(indio.hero.src).width}" height="${sizeOf(indio.hero.src).height}" sizes="(min-width: 768px) 45vw, 92vw" alt="${indio.hero.alt}" loading="lazy" decoding="async"></a>
    </section>
  </div>`;
  // The description is the descriptor's own words. It used to be the h1, which worked while the h1 was
  // a full sentence; a three-word title is not a description, and the line beneath it now is.
  return shell({ title: "Home", description: "Vanderhall builds handcrafted electric UTVs, side-by-sides, and three-wheeled autocycles.", path: "/", body, schema: organizationSchema() });
};

const vehiclesPage = () => {
  const body = `<div class="page">
    ${/* The old line said all four "are hand-built in Provo", present tense, which stopped being
          true for two of them the moment they were labeled past models. */
      pageHeader("Vehicles", "Two three-wheel gas roadsters, one three-wheel electric autocycle, and one electric off-road UTV, hand-built in Provo, Utah. Venice and Carmel are past models.", "", PARENTS.vehicles)}
    <section class="section">
      <div class="vehicle-scroll">${models.map((model, index) => vehicleSection(model, { index, copy: model.intro, eager: index === 0, level: 2, withSupport: true })).join("")}</div>
    </section>
  </div>`;
  return shell({ title: "Vehicles", description: "The Vanderhall vehicle lineup: Venice, Carmel, Santarosa, and Brawley.", path: "/vehicles", body });
};

// V11-E, D-V11-1. The ten concept routes and no others. Declared once here so that the hub and the
// nine detail pages cannot drift apart, and so that check-content can assert the exact route set: a
// white field appearing on an eleventh page would be a page whose imagery is still keyed onto black.
const STUDIO = "page--studio";

const conceptsPage = () => {
  const body = `<div class="page page--concepts">
    ${/* V11-F. The header and the band are both direct children of .page and both are assigned the
          same grid row in site.css, so they occupy one another's space: the band takes the full
          bleed column behind the title, masked away from the left so it emerges on the right rather
          than starting abruptly, and dissolves as the visitor scrolls toward the cards. Owen, on
          2026-08-05: "I wanted the things to come in on the right by concepts and slowly scroll
          over. As he gets closer and closer to the concepts in the paragraph, it fades away and
          blurs out so that it is seamless in the background. Not right below it."

          The header stays FIRST in the DOM, which is the whole reason this is a grid overlap rather
          than a reorder: the band carries a pause button, and a visitor tabbing into the page should
          reach the page's title before reaching a control for the decoration behind it. */
      pageHeader("Concepts", "These nine vehicles are Vanderhall concepts. They are not offered for sale, and no pricing or specifications are published for them.", "", PARENTS.concepts)}
    ${conceptMarquee(concepts)}
    <section class="section--tight"><div class="card-grid card-grid--concepts">${concepts.map((concept, index) => conceptCard(concept, { eager: index < 3 })).join("")}</div></section>
  </div>`;
  return shell({ title: "Concepts", description: "Vanderhall concept vehicles and design studies, not offered for sale.", path: "/concepts", body, mainClass: STUDIO });
};

const conceptImage = (item, { eager = false } = {}) => {
  const { width, height } = sizeOf(item.src);
  return `<picture>${item.mobile ? `<source media="(max-width: 639px)" srcset="${item.mobile}">` : ""}<img src="${item.src}"${item.srcset ? ` srcset="${item.srcset}"` : ""} sizes="(min-width: 1280px) 1200px, 92vw" width="${width}" height="${height}" alt="${item.alt}" loading="${eager ? "eager" : "lazy"}"${eager ? ' fetchpriority="high"' : ""} decoding="async"></picture>`;
};

// One title, the script wordmark, which is the concept's own mark. It used to sit under a bold sans
// h1 of the same word, and in dark theme it sat on a white plate because the artwork is dark on
// transparency. The artwork is monochrome, so dark theme inverts it instead and the plate is gone.
// The alt carries the name, so the accessible heading and a failed image both still say the word.
const conceptTitle = (concept) => `<h1 class="concept-title"><img src="${concept.wordmark.src}" width="${concept.wordmark.width}" height="${concept.wordmark.height}" alt="${concept.name}" loading="eager" fetchpriority="high" decoding="async"></h1>`;

const conceptPage = (concept) => {
  const body = `<div class="page">
    <header class="page-header concept-header">
      ${backLink(PARENTS.concept)}
      ${eyebrow("CONCEPT")}
      ${conceptTitle(concept)}
      <p>${concept.category}</p>
      <p class="concept-status">Concept vehicle. Not offered for sale.</p>
    </header>
    <section class="section--tight"><div class="concept-figure">${conceptImage(concept.hero, { eager: true })}</div></section>
    <section class="section--tight narrow"><p class="lede">${concept.intro}</p></section>
    ${concept.gallery.length ? `<section class="section--tight concept-gallery">${concept.gallery.map((item) => `<div class="concept-figure">${conceptImage(item)}</div>`).join("")}</section>` : ""}
  </div>`;
  return shell({ title: `${concept.name} concept`, description: `${concept.name}, a Vanderhall ${concept.category.toLowerCase()} that is not offered for sale.`, path: `/concepts/${concept.slug}`, body, mainClass: STUDIO });
};

// V11-H. The title was "Find your dealer.", which promised a locator this page does not have. Owen,
// on 2026-08-05: "It's just a normal inquiry." The form heading stays "Contact Vanderhall", and no
// href, data-form-id, #request-info anchor or endpoint key moves with the label: those are the
// form's identity, and the endpoint map is keyed on the first.
//
// The two pathway cards are gone with the homepage's. Owen: "there is no need to do a dealer selling
// Vanderhall on the dealers page, because that's at the bottom." The footer's Connect column carries
// "Recommend a dealer" and "Become a dealer" on every page, so both routes stay live and reachable.
const dealersPage = () => {
  const body = `<div class="page">
    ${pageHeader("Talk with Vanderhall.", "Vanderhall vehicles are sold through a dealer network. Tell Vanderhall where you are and which vehicle interests you, and someone will connect you with a dealer.", "form-shell", PARENTS.dealers)}
    <section class="section--tight form-shell" id="request-info">
      <h2 class="form-heading">Contact Vanderhall</h2>
      ${leadForm()}
    </section>
  </div>`;
  return shell({ title: "Dealers", description: "Talk with Vanderhall about a vehicle, recommend a dealer, or apply to become one.", path: "/dealers", body });
};

const recommendDealerPage = () => {
  const body = `<div class="page">${pageHeader("Recommend a dealer", "Share a dealer candidate with Vanderhall.", "form-shell", PARENTS["recommend-dealer"])}<section class="section--tight form-shell">${recommendDealerForm()}</section></div>`;
  return shell({ title: "Recommend a dealer", description: "Recommend a local dealer to Vanderhall.", path: "/recommend-dealer", body });
};

const dealerInquiryPage = () => {
  const body = `<div class="page">${pageHeader("Become a dealer", "Complete every section to prepare an international dealer inquiry.", "form-shell", PARENTS["dealer-inquiry"])}<section class="section--tight form-shell">${internationalDealerForm()}</section></div>`;
  return shell({ title: "Become a dealer", description: "International Vanderhall dealer inquiry.", path: "/dealer-inquiry", body });
};

// Vanderhall's own privacy policy. Every word is theirs, reproduced from the legacy site and
// supplied by Owen on 2026-08-05; see src/data/privacy.mjs for the provenance and for what this text
// says about the old site rather than this one. This function contributes structure and nothing else,
// which is why it switches on a block type and throws on one it does not know: a policy that silently
// drops a paragraph because a key was misspelled is the failure worth making loud.
const privacyPage = () => {
  const block = (item) => {
    if (item.type === "p") return `<p>${escapeHtml(item.text)}</p>`;
    if (item.type === "ul") return `<ul>${item.items.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>`;
    if (item.type === "url") return `<p class="policy__url"><a href="${item.href}">${escapeHtml(item.href)}</a></p>`;
    throw new Error(`Unknown privacy block type: ${item.type}`);
  };
  const sections = privacySections.map((section) => `<section class="policy__section">
      ${section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : ""}
      ${section.blocks.map(block).join("")}
    </section>`).join("");
  const body = `<div class="page">
    ${pageHeader("Privacy policy", PRIVACY_SOURCE_LINE, "", PARENTS.privacy)}
    <section class="section--tight narrow"><div class="policy">${sections}</div></section>
  </div>`;
  return shell({ title: "Privacy policy", description: "How Vanderhall collects, uses, and protects personally identifiable information.", path: "/privacy", body });
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

// Only the models whose photography is already delivered get a frame. Speedster and Laguna are
// retired roadsters and no photograph of either exists in Assets/, so their groups stay
// typographic rather than borrowing an image of a different vehicle. The concept named Speedster
// is not the same machine and must not stand in for it.
const OWNER_GROUP_IMAGE = {
  venice: modelBySlug.venice.images.lead,
  carmel: modelBySlug.carmel.images.lead,
  brawley: modelBySlug.brawley.images.lead,
};

const ownersPage = () => {
  const groups = ["venice", "carmel", "brawley", "speedster", "laguna"].map((slug) => {
    const manuals = ownerManualData.filter((manual) => manual.slug === slug);
    const image = OWNER_GROUP_IMAGE[slug];
    const media = image
      ? `<div class="resource-group__media"><img src="${image.src}" srcset="${image.srcset}" width="${sizeOf(image.src).width}" height="${sizeOf(image.src).height}" sizes="(min-width: 768px) 38vw, 92vw" alt="${image.alt}" loading="lazy" decoding="async"></div>`
      : "";
    const cards = manuals.map((manual) => `<a class="resource-card" href="/assets/manuals/${manual.file}" type="application/pdf">
        <span class="resource-card__title">${manual.year} ${manual.model} owner's manual${manual.language === "Spanish" ? " (Spanish)" : ""}</span>
        <span class="resource-card__meta">PDF · ${manual.size}<span class="resource-card__cue" aria-hidden="true">↓</span></span>
      </a>`).join("");
    return `<section class="resource-group${media ? " resource-group--media" : ""}" id="${slug}">
      ${media}
      <div class="resource-group__body"><h2>${manuals[0].model}</h2><div class="resource-cards">${cards}</div></div>
    </section>`;
  }).join("");
  const body = `<div class="page">
    ${pageHeader("Owner resources", "Vanderhall owner's manuals, grouped by model and year. Each file opens as a PDF.", "", PARENTS.owners)}
    <section class="section--tight"><div class="resource-groups">${groups}</div></section>
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
  "privacy",
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
  ["privacy/index.html", privacyPage()],
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
await writeFile(resolve(websiteRoot, "site.webmanifest"), JSON.stringify({ name: "Vanderhall Motor Works", short_name: "Vanderhall", icons: [{ src: "/assets/brand/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/assets/brand/icon-512.png", sizes: "512x512", type: "image/png" }], theme_color: "#0E0E10", background_color: "#0E0E10", display: "standalone" }, null, 2));
await writeFile(resolve(websiteRoot, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>https://vanderhall-website.vercel.app/${route ? `${route}/` : ""}</loc></url>`).join("")}</urlset>`);

console.log(`Built ${pages.size} HTML pages.`);
