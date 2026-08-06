import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { concepts } from "./data/concepts.mjs";
import { currentModels, modelBySlug, models, pastModels } from "./data/models.mjs";
import { heroFilm } from "./data/video.mjs";
import { INQUIRY_EMAIL } from "./data/forms.mjs";
import { assertProductionReady, IS_PROTOTYPE, PRODUCTION_BLOCKERS } from "./data/prototype.mjs";
import { campaignReviewFailures, campaignStatement } from "./data/mock/campaign.mjs";
import { CONTACT_PROTOTYPE_RESULT } from "./data/mock/contact.mjs";
import {
  applyAction,
  articleHeader,
  backLink,
  BRAND,
  buttonLink,
  campaignBand,
  conceptCard,
  conceptMarquee,
  contactForm,
  dealerLocator,
  emptyState,
  escapeHtml,
  experienceModules,
  eyebrow,
  figureBand,
  footnoteScope,
  gallery,
  hero,
  internationalDealerForm,
  jobCard,
  jobSections,
  launchInterestForm,
  modelHeadline,
  pageHeader,
  pastModelCard,
  policyContents,
  policyHeader,
  organizationSchema,
  photoScroll,
  postCard,
  price,
  productSchema,
  prose,
  recommendDealerForm,
  relatedPosts,
  safetyCard,
  sampleNote,
  sampleNoticeTag,
  sampleTag,
  sectionHeading,
  shell,
  sizeOf,
  specNote,
  specTable,
  textLink,
  vehicleSection,
  walkaround,
} from "./components.mjs";
import {
  formatDate,
  getBrawleyDeliveryStatus,
  getDealerFilters,
  getDealers,
  getEqualOpportunityStatement,
  getExperienceModules,
  getJobRoutes,
  getJobs,
  getPost,
  getPostRoutes,
  getPosts,
  getPrivacyPolicy,
  getSafetyFallbackUrl,
  getSafetyNoticeRoutes,
  getSafetyNotices,
  getSantarosaLaunchCampaign,
} from "./data/adapters.mjs";

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const websiteRoot = resolve(sourceRoot, "..");

// V13. The production gate runs first, before a single page is rendered, so a production build fails on the
// blocker list rather than after publishing twenty-two pages of sample content. In the default prototype
// mode this returns immediately.
assertProductionReady();
// The stale-date guard, production only for the same reason: a design build that refused to run because a
// campaign review date had passed would block layout work for no safety benefit, while a production build
// that ran past one would publish a claim nobody had rechecked. The date is passed in rather than read from
// the clock inside the data module, so the rule is testable.
if (!IS_PROTOTYPE) {
  const today = new Date().toISOString().slice(0, 10);
  const stale = campaignReviewFailures(today);
  if (stale.length) throw new Error(`Refusing to build in production mode:\n${stale.map((line) => `  ${line}`).join("\n")}`);
}

// The Google Maps environment. Never committed: the build reads it, and a build without it renders the
// locator's honest fallback panel rather than a map that cannot load. Restrict the key by allowed website
// and API in Google Cloud; see INTEGRATION.md.
const MAP_ENV = { mapKey: process.env.VHW_GOOGLE_MAPS_KEY || "", mapId: process.env.VHW_GOOGLE_MAP_ID || "" };

// One way back from every page below the homepage, one level up. This map is the single source:
// scripts/check-content.mjs mirrors it and fails the build if any page disagrees with it, so a new
// route cannot ship without deciding where its back link goes.
//
// V13 adds nine entries. Experience is a child of Home, Blog a child of Experience, and each article a child
// of Blog, which is the hierarchy section 5.1 defines; the Launch Edition nests under Santarosa; and Contact,
// Careers, and Safety each bring an index and a detail level.
const PARENTS = {
  vehicles: { label: "Home", href: "/" },
  concepts: { label: "Home", href: "/" },
  owners: { label: "Home", href: "/" },
  dealers: { label: "Home", href: "/" },
  contact: { label: "Home", href: "/" },
  experience: { label: "Home", href: "/" },
  blog: { label: "Experience", href: "/experience/" },
  article: { label: "Blog", href: "/blog/" },
  careers: { label: "Home", href: "/" },
  career: { label: "Careers", href: "/careers/" },
  safety: { label: "Home", href: "/" },
  notice: { label: "Safety notices", href: "/safety/" },
  brawley: { label: "All vehicles", href: "/vehicles/" },
  santarosa: { label: "All vehicles", href: "/vehicles/" },
  carmel: { label: "All vehicles", href: "/vehicles/" },
  venice: { label: "All vehicles", href: "/vehicles/" },
  "brawley/gts": { label: "Brawley", href: "/brawley/" },
  "santarosa/launch-edition": { label: "Santarosa", href: "/santarosa/" },
  concept: { label: "All concepts", href: "/concepts/" },
  "recommend-dealer": { label: "Dealers", href: "/dealers/" },
  "dealer-inquiry": { label: "Dealers", href: "/dealers/" },
  privacy: { label: "Home", href: "/" },
};

// V13. Current models keep the photo scroll; the two past models are editorial galleries.
//
// The branch is on `pastModel` rather than on a slug list, and the two halves share a hero, a back link and a
// tag treatment and nothing else. That is the point: a gallery page has no specification group to render, so
// there is no path through this function by which a retained historical figure could reach the page.
const modelPage = (model) => {
  const scope = footnoteScope();
  const cta = model.cta || { label: "Contact", href: `/contact/?category=product-information&amp;model=${model.slug}` };
  // V12-A: the way back opens the hero content rather than sitting in a bar beneath the photograph.
  // It stays the page's one and only back-nav, so the sitewide back-link rule is untouched, and
  // .hero__content already inherits the reverse ink the photograph needs.
  //
  // V13-E: Santarosa carries a second action for the Launch Edition campaign. It is additive, and that is a
  // decision rather than an accident of layout: the general Contact path stays first, because a visitor who
  // wants to ask about a Santarosa should not have to go through a campaign to do it.
  const secondary = model.slug === "santarosa"
    ? buttonLink("View Launch Edition", "/santarosa/launch-edition/", "ghost-inverse")
    : "";
  const heroContent = `${backLink(PARENTS[model.slug])}
      ${eyebrow(`${model.powertrain.fuel} · ${model.powertrain.layout}`)}
      ${modelHeadline(model.name, { level: 1, pastModel: model.pastModel })}
      <p class="hero__descriptor">${model.descriptor}</p>
      <div class="hero__actions">${buttonLink(cta.label, cta.href, "inverse")}${secondary}</div>`;
  const body = `<div class="page">
    ${hero({ src: model.images.hero, srcset: model.images.heroSrcset, tallSrcset: model.images.heroTallSrcset, alt: model.images.heroAlt, focal: model.images.focal, align: model.images.heroAlign, content: heroContent })}
    ${model.pastModel
      ? `${/* V13-C. A past model publishes photographs and one honest sentence about availability. No
              specification rows, no model-year qualifier, no warranty term, no price, no purchase action,
              and nothing that implies Vanderhall or a dealer has one in stock. */""}
        <section class="section--tight narrow stack">
          <p class="lede">${escapeHtml(model.inventoryNote)}</p>
          <div class="cluster">${buttonLink(model.cta.label, model.cta.href, "secondary")}</div>
        </section>
        <section class="section">
          ${sectionHeading("GALLERY", `${model.name} in photographs.`)}
          ${gallery(model.images.gallery)}
        </section>`
      : `<section class="section">
          ${sectionHeading("IN DETAIL", `A closer look at ${model.name}.`)}
          ${photoScroll(model.images.modules, scope)}
        </section>
        <section class="section--tight narrow centered">${specNote(model, scope)}</section>`}
  </div>`;
  return shell({ title: model.name, description: model.descriptor, path: `/${model.slug}`, body });
};

// The purchase page. /brawley/ stays the editorial page, six photographs each carrying one true
// sentence, and this is the transaction: the studio walkaround, the paint tiers, the price, and
// the two ways to act on it. Splitting them keeps the configurator from burying the photo essay.
const brawleyGtsPage = (model) => {
  const gts = model.gts;
  const scope = footnoteScope();
  const actions = (variant) => `<div class="cluster">${buttonLink("Order yours now", gts.reserveUrl, variant)}${textLink("Contact", `/contact/?category=product-information&amp;model=${model.slug}`)}</div>`;
  const scene = {
    src: `/assets/images/brawley/lifestyle/${gts.scene.name}-1280.webp`,
    srcset: [640, 800, 960, 1280].map((width) => `/assets/images/brawley/lifestyle/${gts.scene.name}-${width}.webp ${width}w`).join(", "),
  };
  const body = `<div class="page">
    <section class="section--tight">
      <div class="gts-open">
        ${backLink(PARENTS["brawley/gts"])}
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
    <section class="section">${walkaround(gts)}</section>
    <section class="section--tight">${figureBand(gts.figures, scope)}</section>
    <section class="section--tight"><figure class="gts-scene"><img src="${scene.src}" srcset="${scene.srcset}" sizes="(min-width: 1280px) 1200px, 92vw" width="${sizeOf(scene.src).width}" height="${sizeOf(scene.src).height}" alt="${gts.scene.alt}" loading="lazy" decoding="async"><figcaption>${gts.scene.label}</figcaption></figure></section>
    <section class="section narrow centered" id="specifications">${sectionHeading("SPECIFICATIONS", "Published figures")}${specTable(model, scope)}</section>
    <section class="section--tight narrow centered">
      ${sectionHeading("ORDER", `Reserve your ${gts.name}.`, "Order through the Vanderhall reservation system, or ask Vanderhall to connect you with a dealer.")}
      ${actions("primary")}
    </section>
    <section class="section--tight narrow centered">
      <div class="disclosures">
        ${eyebrow("DISCLOSURES")}
        <p>${gts.priceDisclaimer}</p>
        ${gts.safety.map((paragraph) => `<p>${paragraph}</p>`).join("")}
        ${/* V13-F: the estimate sentence arrives here as the page's footnote, resolving the marks on the
              figure band and on every marked row of the specification table above. It is printed at the foot
              of the page because that is the smallest region containing all of its references. */""}
        ${scope.notes()}
      </div>
    </section>
  </div>`;
  return shell({
    title: gts.name,
    // V13-B: the range clause is out of the meta description too. A claim Vanderhall will not make should
    // not survive in a search result.
    description: `${gts.name} pricing and paint colors. ${gts.price.value} MSRP, quad-motor 4WD, 488 lb-ft of torque, and 21 in of suspension travel.`,
    path: "/brawley/gts",
    body,
    mainClass: STUDIO,
    schema: productSchema(model),
  });
};

const homePage = () => {
  const indio = concepts[0];
  const scope = footnoteScope();
  // Owen's copy, unchanged since V9 apart from the brand eyebrow, which V13 shortens to the public name.
  const heroContent = `${eyebrow(BRAND.toUpperCase())}
      <h1>Handcrafted electric vehicles.</h1>
      <p class="hero__descriptor">Vanderhall builds electric UTVs, side-by-sides, and three-wheeled autocycles. Experience performance, comfort, and style.</p>
      <div class="hero__actions">${buttonLink("Explore vehicles", "/vehicles/", "inverse")}</div>`;
  const body = `<div class="page">
    ${/* The V13 Brawley film, delivered on Owen's chat instruction of 2026-08-06: one play from the
          25.000-second action start, settling on the close front view. Publication rights remain an
          open item in INTEGRATION.md `brawley-film`; what Q-V13-16 still blocks is the production
          build, not this prototype delivery. */
      hero({
        src: heroFilm.poster.src,
        srcset: heroFilm.poster.srcset,
        alt: heroFilm.poster.alt,
        width: heroFilm.poster.width,
        height: heroFilm.poster.height,
        focal: heroFilm.focal,
        content: heroContent,
        video: heroFilm,
      })}
    ${/* V13-E. Two operational statements directly after the hero and before the lineup, Brawley first.
          Both are read from the campaign data, so this band and the Launch Edition page can never disagree
          about which phase the campaign is in. */
      campaignBand(getBrawleyDeliveryStatus(), getSantarosaLaunchCampaign())}
    <section class="section" id="vehicles">
      ${sectionHeading("VEHICLES", "The Vanderhall lineup.")}
      ${/* V13-D. Current models only, per Q-V13-9. Carmel and Venice keep their routes, their footer links,
            their sitemap entries and their owner manuals; what they lose is equal billing in the lineup, and
            one quiet link below carries a visitor who wants them. */""}
      <div class="vehicle-scroll">${currentModels.map((model, index) => vehicleSection(model, { index, copy: model.summary, scope })).join("")}</div>
      <p class="lineup-past">${textLink("Past models", "/vehicles/#past-models")}</p>
      ${scope.notes()}
    </section>
    <section class="section split split--media-first">
      <div class="split__body">${sectionHeading(null, "Concepts")}<p>Nine Vanderhall concept vehicles. They are not offered for sale.</p><div class="cluster">${buttonLink("View concepts", "/concepts/", "secondary")}</div></div>
      <a class="split__media" href="/concepts/"><img src="${indio.hero.src}" srcset="${indio.hero.srcset}" width="${sizeOf(indio.hero.src).width}" height="${sizeOf(indio.hero.src).height}" sizes="(min-width: 768px) 45vw, 92vw" alt="${indio.hero.alt}" loading="lazy" decoding="async"></a>
    </section>
  </div>`;
  return shell({ title: "Home", description: "Vanderhall builds handcrafted electric UTVs, side-by-sides, and three-wheeled autocycles.", path: "/", body, schema: organizationSchema() });
};

const vehiclesPage = () => {
  const scope = footnoteScope();
  const body = `<div class="page">
    ${pageHeader("Vehicles", "Explore Vanderhall's electric off-road UTV and three-wheel electric autocycle, hand-built in Provo, Utah.", "", PARENTS.vehicles)}
    <section class="section">
      <div class="vehicle-scroll">${currentModels.map((model, index) => vehicleSection(model, { index, copy: model.intro, eager: index === 0, level: 2, withSupport: true, scope })).join("")}</div>
      ${scope.notes()}
    </section>
    ${/* V13-D. A visually quieter group, not a second lineup. The heading supplies the status, which is why
          the cards inside it carry no Past model pill: the tag stays beside the h1 on each detail page,
          where there is no heading to say it. */""}
    <section class="section" id="past-models">
      ${sectionHeading("PAST MODELS", "Past Models", "Explore the design and history of earlier Vanderhall models, and contact the dealer network to ask about any remaining inventory.")}
      <div class="past-grid">${pastModels.map(pastModelCard).join("")}</div>
    </section>
  </div>`;
  return shell({ title: "Vehicles", description: "The Vanderhall vehicle lineup: Brawley and Santarosa, with the past Venice and Carmel models.", path: "/vehicles", body });
};

// The white studio field. V11-E introduced it for the ten concept routes; V12-D added the purchase page.
// Eleven routes and no others, and V13 adds none: every new route renders on the dark field, because the
// rule behind this list is that a page earns the white field when its imagery was shot in a white studio and
// is delivered unkeyed. Declared once here so no page can drift onto it, and so check-content can assert the
// exact set.
const STUDIO = "page--studio";

const conceptsPage = () => {
  const body = `<div class="page page--concepts">
    ${pageHeader("Concepts", "These nine vehicles are Vanderhall concepts. They are not offered for sale, and no pricing or specifications are published for them.", "", PARENTS.concepts)}
    ${conceptMarquee(concepts)}
    <section class="section--tight"><div class="card-grid card-grid--concepts">${concepts.map((concept, index) => conceptCard(concept, { eager: index < 3 })).join("")}</div></section>
  </div>`;
  return shell({ title: "Concepts", description: "Vanderhall concept vehicles and design studies, not offered for sale.", path: "/concepts", body, mainClass: STUDIO });
};

const conceptImage = (item, { eager = false } = {}) => {
  const { width, height } = sizeOf(item.src);
  return `<picture>${item.mobile ? `<source media="(max-width: 639px)" srcset="${item.mobile}">` : ""}<img src="${item.src}"${item.srcset ? ` srcset="${item.srcset}"` : ""} sizes="(min-width: 1280px) 1200px, 92vw" width="${width}" height="${height}" alt="${item.alt}" loading="${eager ? "eager" : "lazy"}"${eager ? ' fetchpriority="high"' : ""} decoding="async"></picture>`;
};

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

// V13-G. Dealers is a locator and nothing else. The generic lead form that stood here since V11-H is gone,
// along with its `#request-info` anchor, its form ID, and its endpoint key: requests belong to /contact/ now,
// and a page that both finds a dealer and takes an inquiry does neither job clearly.
const dealersPage = () => {
  const dealers = getDealers();
  const body = `<div class="page">
    ${pageHeader("Find a Vanderhall dealer.", "Search by city or postal code to find dealers and services near you.", "", PARENTS.dealers)}
    <section class="section--tight">
      ${sampleNote("Sample content. These six dealers are fictional records for layout review, with reserved telephone numbers and example.com websites. Vanderhall's own dealer data replaces them before launch.")}
      ${dealerLocator(dealers, getDealerFilters(), MAP_ENV)}
    </section>
  </div>`;
  return shell({ title: "Dealers", description: "Find a Vanderhall dealer by city or postal code, with directions, phone, and website for each location.", path: "/dealers", body });
};

// V13-G. /contact/ is a real route rather than a redirect, and it owns every request the site takes.
const contactPage = () => {
  const body = `<div class="page">
    ${pageHeader("Contact Vanderhall.", "Choose a request type and tell us how we can help. Your answers will guide your request to the right team.", "form-shell", PARENTS.contact)}
    <section class="section--tight form-shell form-stack">
      ${contactForm()}
      <p class="form-note">${escapeHtml(CONTACT_PROTOTYPE_RESULT)}</p>
      <p class="form-note">Prefer email? Write to <a href="mailto:${INQUIRY_EMAIL}">${INQUIRY_EMAIL}</a>.</p>
    </section>
  </div>`;
  return shell({ title: "Contact Us", description: "Contact Vanderhall about a dealer, a model, or support for a vehicle you own.", path: "/contact", body });
};

const recommendDealerPage = () => {
  const body = `<div class="page">${pageHeader("Recommend a dealer", "Share a dealer candidate with Vanderhall.", "form-shell", PARENTS["recommend-dealer"])}<section class="section--tight form-shell">${recommendDealerForm()}</section></div>`;
  return shell({ title: "Recommend a dealer", description: "Recommend a local dealer to Vanderhall.", path: "/recommend-dealer", body });
};

const dealerInquiryPage = () => {
  const body = `<div class="page">${pageHeader("Become a dealer", "Complete every section to prepare an international dealer inquiry.", "form-shell", PARENTS["dealer-inquiry"])}<section class="section--tight form-shell">${internationalDealerForm()}</section></div>`;
  return shell({ title: "Become a dealer", description: "International Vanderhall dealer inquiry.", path: "/dealer-inquiry", body });
};

// ---------------------------------------------------------------------------------------------
// V13. Experience, Blog, and the article template.
// ---------------------------------------------------------------------------------------------
const experiencePage = () => {
  const posts = getPosts();
  const byId = new Map(posts.map((post) => [post.id, post]));
  const body = `<div class="page">
    ${pageHeader("The Vanderhall experience.", "Stories, updates, and moments from the world of Vanderhall.", "", PARENTS.experience)}
    <section class="section--tight">${sampleNote()}</section>
    ${experienceModules(getExperienceModules(), { byId })}
  </div>`;
  return shell({ title: "Experience", description: "Stories, updates, and moments from the world of Vanderhall.", path: "/experience", body });
};

const blogPage = () => {
  const posts = getPosts();
  const [featured, ...rest] = posts;
  const body = `<div class="page">
    ${pageHeader("Blog", "News, stories, and updates from Vanderhall.", "", PARENTS.blog)}
    <section class="section--tight">${sampleNote()}</section>
    ${featured
      ? `<section class="section--tight">${postCard(featured, { featured: true, level: 2, linkable: Boolean(featured.bodyBlocks?.length) })}</section>
        ${rest.length ? `<section class="section"><div class="card-grid card-grid--posts">${rest.map((post) => postCard(post, { level: 2, linkable: Boolean(post.bodyBlocks?.length) })).join("")}</div></section>` : ""}`
      : `<section class="section">${emptyState("No stories have been published yet.")}</section>`}
  </div>`;
  return shell({ title: "Blog", description: "News, stories, and updates from Vanderhall.", path: "/blog", body });
};

const articlePage = (post) => {
  const related = (post.relatedSlugs || []).map((slug) => getPost(slug)).filter(Boolean).slice(0, 2);
  const body = `<div class="page">
    ${articleHeader(post, PARENTS.article)}
    <section class="section--tight">${sampleNote()}</section>
    ${post.hero ? `<section class="section--tight"><figure class="article-hero"><img src="${post.hero.src}" srcset="${post.hero.srcset}" width="${sizeOf(post.hero.src).width}" height="${sizeOf(post.hero.src).height}" sizes="(min-width: 1280px) 1200px, 92vw" alt="${escapeHtml(post.hero.alt)}" loading="eager" fetchpriority="high" decoding="async"></figure></section>` : ""}
    <section class="section--tight narrow">${prose(post.bodyBlocks)}</section>
    ${relatedPosts(related)}
    <section class="section--tight narrow">
      ${sectionHeading(null, "Talk with Vanderhall")}
      <div class="cluster">${buttonLink("Contact Us", "/contact/", "secondary")}${buttonLink("Explore vehicles", "/vehicles/", "secondary")}</div>
    </section>
  </div>`;
  return shell({ title: post.title, description: post.seo?.description || post.excerpt, path: `/blog/${post.slug}`, body });
};

// ---------------------------------------------------------------------------------------------
// V13. Careers.
// ---------------------------------------------------------------------------------------------
const careersPage = () => {
  const jobs = getJobs();
  const routed = new Set(getJobRoutes().map((job) => job.slug));
  const body = `<div class="page">
    ${pageHeader("Careers", "Explore current opportunities with Vanderhall.", "", PARENTS.careers)}
    <section class="section--tight">${sampleNote("Sample content. These three openings are fictional records for layout review and are not Vanderhall vacancies. The real careers feed replaces them before launch.")}</section>
    <section class="section">
      ${jobs.length
        ? `<div class="record-list">${jobs.map((job) => jobCard(job, { linkable: routed.has(job.slug) })).join("")}</div>`
        : emptyState("No current openings are available from the connected source.")}
    </section>
  </div>`;
  return shell({ title: "Careers", description: "Explore current opportunities with Vanderhall.", path: "/careers", body });
};

const careerPage = (job) => {
  const statement = getEqualOpportunityStatement();
  const body = `<div class="page">
    <header class="page-header page-header--marked">
      ${backLink(PARENTS.career)}
      <div class="record-head">
        <h1>${escapeHtml(job.title)}</h1>
        ${sampleTag()}
      </div>
      <p>${escapeHtml(job.summary)}</p>
    </header>
    <section class="section--tight narrow">
      ${sampleNote("Sample content. This posting is a fictional record for layout review and is not a Vanderhall vacancy.")}
      <ul class="fact-row fact-row--detail">
        <li>${escapeHtml(job.department)}</li>
        <li>${escapeHtml(job.location)}</li>
        <li>${escapeHtml(job.workMode)}</li>
        <li>${escapeHtml(job.employmentType)}</li>
        ${job.compensation ? `<li>${escapeHtml(job.compensation)}</li>` : ""}
        <li>Posted <time datetime="${job.postedAt}">${escapeHtml(formatDate(job.postedAt))}</time></li>
      </ul>
    </section>
    <section class="section--tight narrow">${jobSections(job.sections)}</section>
    ${statement ? `<section class="section--tight narrow"><p class="record-legal">${escapeHtml(statement)}</p></section>` : ""}
    <section class="section--tight narrow">${applyAction(job)}</section>
  </div>`;
  return shell({ title: job.title, description: job.summary, path: `/careers/${job.slug}`, body });
};

// ---------------------------------------------------------------------------------------------
// V13. Safety notices.
// ---------------------------------------------------------------------------------------------
const safetyPage = () => {
  const notices = getSafetyNotices();
  const routed = new Set(getSafetyNoticeRoutes().map((notice) => notice.slug));
  const body = `<div class="page">
    ${pageHeader("Safety notices", "Review safety notices and supporting information from Vanderhall's authoritative safety source.", "", PARENTS.safety)}
    <section class="section--tight">
      ${sampleNote("Sample content. Every notice below is fictional and describes no hazard. Vanderhall's authoritative safety source is not connected yet, so use the official portal for real notices.")}
      <p class="record-fallback">${textLink("Vanderhall safety notices portal", getSafetyFallbackUrl())}</p>
    </section>
    <section class="section">
      ${notices.length
        ? `<div class="record-list">${notices.map((notice) => safetyCard(notice, { linkable: routed.has(notice.slug) })).join("")}</div>`
        : emptyState("No notices are available from the connected source.")}
    </section>
  </div>`;
  return shell({ title: "Safety notices", description: "Vanderhall safety notices and supporting information.", path: "/safety", body });
};

const safetyNoticePage = (notice) => {
  const body = `<div class="page">
    <header class="page-header page-header--marked">
      ${backLink(PARENTS.notice)}
      <div class="record-head">
        <h1>${escapeHtml(notice.title)}</h1>
        ${sampleNoticeTag()}
      </div>
      <p>${escapeHtml(notice.hazardSummary)}</p>
    </header>
    <section class="section--tight narrow">
      ${sampleNote("Sample content. This notice is fictional, describes no hazard, and must not be acted on. Use the official Vanderhall safety portal for real notices.")}
      <dl class="notice-facts notice-facts--detail">
        <dt>Notice</dt><dd>${escapeHtml(notice.id)}</dd>
        <dt>Status</dt><dd>${escapeHtml(notice.status)}</dd>
        <dt>Posted</dt><dd><time datetime="${notice.postedAt}">${escapeHtml(formatDate(notice.postedAt))}</time></dd>
        ${notice.revisedAt ? `<dt>Revised</dt><dd><time datetime="${notice.revisedAt}">${escapeHtml(formatDate(notice.revisedAt))}</time></dd>` : ""}
        <dt>Affected</dt><dd>${notice.affectedProducts.map((product) => escapeHtml(product)).join(", ")}</dd>
        <dt>Remedy</dt><dd>${escapeHtml(notice.remedySummary)}</dd>
        <dt>What to do</dt><dd>${escapeHtml(notice.consumerAction)}</dd>
      </dl>
    </section>
    <section class="section--tight narrow">${prose(notice.bodyBlocks)}</section>
    <section class="section--tight narrow">
      <p class="record-fallback">${textLink("Vanderhall safety notices portal", getSafetyFallbackUrl())}</p>
    </section>
  </div>`;
  return shell({ title: notice.title, description: `${notice.title}. Sample Vanderhall safety notice used for layout review.`, path: `/safety/${notice.slug}`, body });
};

// ---------------------------------------------------------------------------------------------
// V13. The Santarosa Launch Edition campaign page.
// ---------------------------------------------------------------------------------------------
const launchEditionPage = () => {
  const campaign = getSantarosaLaunchCampaign();
  const santarosa = modelBySlug.santarosa;
  const scope = footnoteScope();
  const statement = campaignStatement(campaign);
  // Typography-led, with one approved Santarosa photograph. No supplied image proves numbered badging, the
  // specialty options package, or any carbon-fiber part, so no photograph here is captioned as though it
  // did, and nothing is retouched, composited, or generated to suggest equipment the frame does not show.
  const heroContent = `${backLink(PARENTS["santarosa/launch-edition"])}
      ${eyebrow("SANTAROSA LAUNCH EDITION")}
      <h1>Be Among the First.</h1>
      <p class="hero__descriptor">The Vanderhall Santarosa Launch Edition</p>
      <p class="launch-market">United States only</p>
      <div class="hero__actions">${buttonLink("Register your interest", "#santarosa-launch-interest", "inverse")}</div>`;
  const body = `<div class="page">
    ${/* Deliberately NOT santarosa.images.heroAlign. The model page right-aligns its hero content because the
          vehicle sits on the left of that frame; here the same alignment put the eyebrow and the back link over
          the hangar's bright windows, where white type on glass is unreadable and the bottom-up scrim does not
          reach. Left-aligned, the block sits over the dark floor and the car, which is where the scrim is
          strongest. */""}
    ${hero({ src: santarosa.images.hero, srcset: santarosa.images.heroSrcset, tallSrcset: santarosa.images.heroTallSrcset, alt: santarosa.images.heroAlt, focal: santarosa.images.focal, content: heroContent })}
    <section class="section--tight narrow stack">
      ${/* The marker here says something different from the one on /dealers/ and /careers/, and the difference
            is the point: no record on this page is fictional. Every fact came from Owen's boss on 2026-08-06.
            What is unapproved is the wording around them, the consent language, and the campaign state, so the
            note says that rather than claiming the vehicle is a sample. */
        sampleNote("Prototype copy. The Launch Edition facts on this page are real; the wording, the consent language, and the campaign state are pending approval, and the registration form is not connected.")}
      <p class="lede">A new chapter is about to begin.</p>
      <p>The Santarosa Launch Edition will be limited to just ${campaign.totalUnits} individually numbered vehicles. Each will be built with exclusive features available only on this inaugural edition.</p>
    </section>
    <section class="section">
      ${sectionHeading("LAUNCH EDITION", "Launch Edition highlights")}
      <ul class="launch-highlights">${campaign.highlights.map((highlight) => `<li>${escapeHtml(highlight.text)}${highlight.noteIds?.length ? scope.mark(highlight.noteIds) : ""}</li>`).join("")}</ul>
      <p class="launch-more">More details will be announced as we get closer to launch.</p>
    </section>
    <section class="section--tight">
      <div class="launch-facts">
        <div class="launch-fact">
          <h2>Expected deliveries</h2>
          <p>Initial customer deliveries are expected to begin during the ${escapeHtml(campaign.expectedDelivery.label.toLowerCase())}.</p>
        </div>
        <div class="launch-fact">
          <h2>Reservation priority</h2>
          <p>Reservation opportunities will be offered in this order:</p>
          <ol class="launch-priority">${campaign.priority.map((step) => `<li>${escapeHtml(step.label)}</li>`).join("")}</ol>
        </div>
      </div>
    </section>
    <section class="section--tight narrow form-shell form-stack" id="santarosa-launch-interest">
      ${sectionHeading("STAY INFORMED", "Register your interest")}
      <p>Register your interest to receive Launch Edition updates, reservation announcements, exclusive previews, and important milestones as production approaches.</p>
      ${/* The action's own label comes from the campaign phase, never from a date. In interest-open it says
            register, and it will not say Reserve until the phase is public-reservations AND a verified
            reservation destination exists. */""}
      <p class="launch-state">${escapeHtml(statement.label)}</p>
      ${launchInterestForm()}
      <p class="form-note">This registration is not connected yet, so nothing you enter is sent, stored, or forwarded. Registering does not create a reservation, assign a number, hold a build slot, or guarantee availability.</p>
    </section>
    <section class="section--tight narrow">
      <div class="disclosures">
        ${eyebrow("AVAILABILITY")}
        <p>Only ${campaign.totalUnits} Santarosa Launch Edition vehicles will be built. Do not miss the opportunity to be part of the Santarosa debut.</p>
        ${scope.notes()}
      </div>
    </section>
  </div>`;
  return shell({
    title: "Santarosa Launch Edition",
    description: `Learn about the United States Santarosa Launch Edition, limited to ${campaign.totalUnits} individually numbered vehicles, and register your interest for launch updates.`,
    path: "/santarosa/launch-edition",
    body,
  });
};

// ---------------------------------------------------------------------------------------------
// Privacy, redesigned around the document record. Not one word of Vanderhall's own policy changes.
// ---------------------------------------------------------------------------------------------
const privacyPage = () => {
  const policy = getPrivacyPolicy();
  const block = (item) => {
    if (item.type === "p") return `<p>${escapeHtml(item.text)}</p>`;
    if (item.type === "ul") return `<ul>${item.items.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>`;
    if (item.type === "url") return `<p class="policy__url"><a href="${item.href}">${escapeHtml(item.href)}</a></p>`;
    throw new Error(`Unknown privacy block type: ${item.type}`);
  };
  const sections = policy.sections.map((section) => `<section class="policy__section" id="${section.id}">
      ${section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : ""}
      ${section.blocks.map(block).join("")}
    </section>`).join("");
  const body = `<div class="page">
    ${policyHeader(policy, PARENTS.privacy)}
    <section class="section--tight narrow">
      ${/* The label is the honest state of this page. Vanderhall's own text is reproduced verbatim, and
            several passages of it describe the old WordPress site: advertising, cookies, a cart, and card
            payments this site does not have. A polished layout does not approve stale copy. */""}
      <p class="sample-note"><span class="sample-note__tag">Prototype</span>Prototype policy structure. Approved legal copy is required before publication.</p>
    </section>
    <section class="section--tight policy-layout">
      ${policyContents(policy)}
      <div class="policy">${sections}</div>
    </section>
  </div>`;
  return shell({ title: "Privacy policy", description: "How Vanderhall collects, uses, and protects personally identifiable information.", path: "/privacy", body });
};

const notFoundPage = () => {
  const body = `<div class="page"><section class="section not-found narrow">${eyebrow("404")}<h1>This road ends here.</h1><p>The page you requested does not exist.</p><div class="cluster">${buttonLink("Go home", "/")}${buttonLink("View vehicles", "/vehicles/", "secondary")}${buttonLink("Contact Us", "/contact/", "secondary")}</div></section></div>`;
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

// V13. Owners is a focused manual library reached from the footer, not the site's primary Owners
// destination. Nothing about the files changes: every PDF URL, size label, group, and image pairing is
// exactly what V12 delivered, and no manual is added or removed. What changes is the title, the group
// order, and where the page is reached from.
//
// The groups are current-first now, Brawley before the two past roadsters before the two retired ones,
// because a visitor looking for a manual is most likely to own the vehicle Vanderhall is still building.
const OWNER_GROUP_ORDER = ["brawley", "venice", "carmel", "speedster", "laguna"];

const ownersPage = () => {
  const groups = OWNER_GROUP_ORDER.map((slug) => {
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
    ${pageHeader("Owner manuals.", "Find and download owner's manuals by model and year.", "", PARENTS.owners)}
    <section class="section--tight"><div class="resource-groups">${groups}</div></section>
  </div>`;
  return shell({ title: "Owner manuals", description: "Vanderhall owner's manuals grouped by model and year.", path: "/owners", body });
};

const postRoutes = getPostRoutes();
const jobRoutes = getJobRoutes();
const noticeRoutes = getSafetyNoticeRoutes();

const routes = [
  "",
  "vehicles",
  ...models.map((model) => model.slug),
  "brawley/gts",
  "santarosa/launch-edition",
  "concepts",
  ...concepts.map((concept) => `concepts/${concept.slug}`),
  "experience",
  "blog",
  ...postRoutes.map((post) => `blog/${post.slug}`),
  "owners",
  "dealers",
  "contact",
  "careers",
  ...jobRoutes.map((job) => `careers/${job.slug}`),
  "safety",
  ...noticeRoutes.map((notice) => `safety/${notice.slug}`),
  "recommend-dealer",
  "dealer-inquiry",
  "privacy",
];

const pages = new Map([
  ["index.html", homePage()],
  ["vehicles/index.html", vehiclesPage()],
  ["concepts/index.html", conceptsPage()],
  ...concepts.map((concept) => [`concepts/${concept.slug}/index.html`, conceptPage(concept)]),
  ["experience/index.html", experiencePage()],
  ["blog/index.html", blogPage()],
  ...postRoutes.map((post) => [`blog/${post.slug}/index.html`, articlePage(post)]),
  ["dealers/index.html", dealersPage()],
  ["contact/index.html", contactPage()],
  ["careers/index.html", careersPage()],
  ...jobRoutes.map((job) => [`careers/${job.slug}/index.html`, careerPage(job)]),
  ["safety/index.html", safetyPage()],
  ...noticeRoutes.map((notice) => [`safety/${notice.slug}/index.html`, safetyNoticePage(notice)]),
  ["owners/index.html", ownersPage()],
  ["recommend-dealer/index.html", recommendDealerPage()],
  ["dealer-inquiry/index.html", dealerInquiryPage()],
  ["privacy/index.html", privacyPage()],
  ["404/index.html", notFoundPage()],
  ["404.html", notFoundPage()],
  ...models.map((model) => [`${model.slug}/index.html`, modelPage(model)]),
  ["brawley/gts/index.html", brawleyGtsPage(modelBySlug.brawley)],
  ["santarosa/launch-edition/index.html", launchEditionPage()],
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
// robots.txt still allows the whole site, and the noindex is applied per route instead. That is a
// deliberate narrowing of the plan's "staging or mock-data deployments should be noindex", and the reason is
// proportion: this deployment is mostly real. Deindexing the homepage, the two current models, the purchase
// page, the nine concepts, and the manual library because six new routes carry fictional records would cost
// Vanderhall its actual search presence to protect against sample content on pages nobody has linked to yet.
//
// So NOINDEX_ROUTES below carries the meta tag on exactly the routes with mock records, and crawling stays
// allowed so that the tag can be read at all: a Disallow rule would stop the crawler before it saw the
// noindex, which is the classic way to leave a page indexed while believing it is hidden.
await writeFile(resolve(websiteRoot, "robots.txt"), "User-agent: *\nAllow: /\n");
await writeFile(resolve(websiteRoot, "site.webmanifest"), JSON.stringify({ name: BRAND, short_name: BRAND, icons: [{ src: "/assets/brand/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/assets/brand/icon-512.png", sizes: "512x512", type: "image/png" }], theme_color: "#0E0E10", background_color: "#0E0E10", display: "standalone" }, null, 2));
await writeFile(resolve(websiteRoot, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>https://vanderhall-website.vercel.app/${route ? `${route}/` : ""}</loc></url>`).join("")}</urlset>`);

console.log(`Built ${pages.size} HTML pages across ${routes.length} routes in ${IS_PROTOTYPE ? "prototype" : "production"} mode.`);
if (IS_PROTOTYPE) console.log(`Prototype mode: ${PRODUCTION_BLOCKERS.length} production blockers open, and the six mock-data routes carry a noindex. See INTEGRATION.md.`);
