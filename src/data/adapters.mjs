// THE ONE BOUNDARY BETWEEN DESIGN AND PRODUCTION DATA.
//
// Every V13 page builder reads its records through a function in this file and through nothing else. No
// template imports a fixture directly, and no template imports a submission endpoint. That is the whole
// contract: John replaces the bodies below with a database or API adapter and changes no layout
// component, no stylesheet, and no check.
//
// Three rules the shapes enforce rather than document:
//
// - Stable IDs and slugs are separate, and neither is an array position. A record's identity survives a
//   reorder, and the featured article is selected by ID for that reason.
// - A missing optional field disappears. A missing REQUIRED field throws at build time with the record
//   named, because a job posting that renders without a title is a page nobody notices is broken.
// - Dates are ISO 8601 in data and are formatted for display in exactly one place, so no two pages can
//   disagree about how a date reads.
//
// The submit functions transmit nothing and store nothing, on purpose. See src/data/prototype.mjs.
import { MOCK_DEALERS, DEALER_FILTERS } from "./mock/dealers.mjs";
import { ARTICLES, FEATURED_ARTICLE_ID } from "./articles.mjs";
import { MOCK_JOBS, EQUAL_OPPORTUNITY_STATEMENT } from "./mock/careers.mjs";
import { SAFETY_NOTICES, SAFETY_PORTAL_URL, SAFETY_RETRIEVED_AT } from "./safety.mjs";
import { santarosaLaunchCampaign, brawleyDeliveryStatus, CAMPAIGN_PHASES } from "./mock/campaign.mjs";
import { privacySections, PRIVACY_SOURCE_LINE } from "./privacy.mjs";
import { IS_PROTOTYPE } from "./prototype.mjs";

const required = (record, kind, fields) => {
  for (const field of fields) {
    const value = record[field];
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) {
      throw new Error(`${kind} ${record.id || record.slug || "(no id)"} is missing the required field "${field}"`);
    }
  }
  return record;
};

// One date formatter for the whole site. Written from the ISO parts rather than through toLocaleDateString
// so the build is not at the mercy of the machine's locale: a deploy from a differently configured host
// must not silently reformat every published date.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const formatDate = (iso) => {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) throw new Error(`Not an ISO 8601 date: ${iso}`);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
};

// ---------------------------------------------------------------------------------------------
// Dealers
// ---------------------------------------------------------------------------------------------
export const getDealers = () => MOCK_DEALERS.map((dealer) => required(dealer, "Dealer", ["id", "slug", "name", "address1", "city", "region", "postalCode", "latitude", "longitude", "phone"]));
export const getDealerFilters = () => DEALER_FILTERS;

// ---------------------------------------------------------------------------------------------
// Editorial
// ---------------------------------------------------------------------------------------------
// Newest first, and published state is a field rather than an assumption, so an unpublished draft in a
// connected CMS never reaches a page. V15: the records are the two real Vanderhall articles in
// src/data/articles.mjs, no longer fixtures, and the required set grows to the full editorial contract
// because a real article missing its standfirst or hero is a broken page, not a sparse card.
export const getPosts = () => ARTICLES
  .map((post) => required(post, "Post", ["id", "slug", "title", "standfirst", "excerpt", "category", "author", "publishedAt", "hero", "bodyBlocks", "relatedSlugs"]))
  .map((post) => {
    if (!post.seo?.description) throw new Error(`Post ${post.id} is missing the required field "seo.description"`);
    return post;
  })
  .slice()
  .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));

export const getPost = (slug) => getPosts().find((post) => post.slug === slug) || null;

// Only records with a body get a route. A card whose article is not written links nowhere rather than to
// an empty page, which is why this is a separate question from getPosts().
export const getPostRoutes = () => getPosts().filter((post) => post.bodyBlocks?.length);
export const hasPostRoute = (slug) => getPostRoutes().some((post) => post.slug === slug);

// The Experience hub's ordered module description. An allowlist rather than free-form data: an unknown
// module type throws at build time instead of rendering unsafe HTML, and V13 has exactly one type.
//
// This is what makes Events an integration rather than a redesign. When real event data, fields,
// ownership, and a route exist, a second entry joins this list and the hub renders it in place. Until
// then the hub has no Events heading, no empty calendar, no coming-soon card, and no Event schema.
const EXPERIENCE_MODULE_TYPES = new Set(["blog"]);
export const getExperienceModules = () => {
  const modules = [
    {
      type: "blog",
      heading: "Latest from Vanderhall.",
      // Post IDs, not copies of the records. The hub and the archive read the same adapter, so a story
      // cannot be featured on one and missing from the other.
      featuredId: FEATURED_ARTICLE_ID,
      recentIds: getPosts().filter((post) => post.id !== FEATURED_ARTICLE_ID).slice(0, 3).map((post) => post.id),
      // V15, D-V15-3: no archive action. With two stories the hub and the archive are the same page
      // with different furniture; /blog/ stays built as every article's back-link parent, and this
      // entry returns when the archive outgrows the hub.
    },
  ];
  for (const module of modules) {
    if (!EXPERIENCE_MODULE_TYPES.has(module.type)) throw new Error(`Unknown Experience module type: ${module.type}`);
  }
  return modules;
};

export const getFeaturedPost = () => getPosts().find((post) => post.id === FEATURED_ARTICLE_ID) || getPosts()[0] || null;

// ---------------------------------------------------------------------------------------------
// Careers
// ---------------------------------------------------------------------------------------------
export const getJobs = () => MOCK_JOBS
  .map((job) => required(job, "Job", ["id", "slug", "title", "department", "location", "workMode", "employmentType", "postedAt", "summary"]))
  .filter((job) => job.status === "open")
  .slice()
  .sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));

export const getJob = (slug) => getJobs().find((job) => job.slug === slug) || null;
export const getJobRoutes = () => getJobs().filter((job) => job.sections?.length);
export const hasJobRoute = (slug) => getJobRoutes().some((job) => job.slug === slug);
export const getEqualOpportunityStatement = () => EQUAL_OPPORTUNITY_STATEMENT;

// ---------------------------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------------------------
// V17: the real notices, transcribed from Vanderhall's portal. `sourceUrl` joins the required set,
// which it could not be while the records were fictional and carried none: a republished safety
// notice that does not cite the copy it was taken from is not something this site should be able to
// build.
export const getSafetyNotices = () => SAFETY_NOTICES
  .map((notice) => required(notice, "Safety notice", ["id", "slug", "title", "status", "postedAt", "hazardSummary", "remedySummary", "sourceUrl"]))
  .slice()
  .sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1));

export const getSafetyNotice = (slug) => getSafetyNotices().find((notice) => notice.slug === slug) || null;
export const getSafetyNoticeRoutes = () => getSafetyNotices().filter((notice) => notice.bodyBlocks?.length);
export const hasSafetyNoticeRoute = (slug) => getSafetyNoticeRoutes().some((notice) => notice.slug === slug);
// The portal stays the authoritative copy, and the page says so. These records are a snapshot taken on
// the date below, not a feed: nothing here learns about a revision or a fourth notice. Q-V13-10.
export const getSafetyFallbackUrl = () => SAFETY_PORTAL_URL;
export const getSafetyRetrievedAt = () => SAFETY_RETRIEVED_AT;

// ---------------------------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------------------------
// The document record, built from Vanderhall's own policy text. V13 redesigns the reading experience
// around it and changes not one word of the copy: the sections are still the verbatim legacy document
// supplied by Owen on 2026-08-05, typos and all, and the renderer adds structure only.
//
// The two dates are null, and that is the honest state rather than a gap to fill. Vanderhall's legacy
// page publishes neither an effective date nor a revision date, and inventing one would be a legal
// claim. The header prints each only when the record carries it, and the prototype label says why.
export const getPrivacyPolicy = () => ({
  title: "Privacy policy",
  effectiveAt: null,
  updatedAt: null,
  contactUrl: "/contact/",
  sourceLine: PRIVACY_SOURCE_LINE,
  sections: privacySections.map((section, index) => ({
    // A stable id for the table of contents. Derived from the heading when there is one, because a
    // heading is what a visitor is navigating to; positional only for the untitled preamble.
    id: section.heading
      ? `policy-${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}`
      : `policy-preamble-${index}`,
    heading: section.heading || null,
    blocks: section.blocks,
  })),
});

// ---------------------------------------------------------------------------------------------
// Campaign
// ---------------------------------------------------------------------------------------------
export const getSantarosaLaunchCampaign = () => {
  if (!CAMPAIGN_PHASES.includes(santarosaLaunchCampaign.phase)) {
    throw new Error(`Unknown campaign phase: ${santarosaLaunchCampaign.phase}`);
  }
  return santarosaLaunchCampaign;
};
export const getBrawleyDeliveryStatus = () => brawleyDeliveryStatus;

// ---------------------------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------------------------
// Both of these exist so that a page builder can ask "where does this go" and get a documented answer.
// In the prototype the answer is nowhere, stated rather than implied, and the browser is never handed a
// destination it could post to. The old dealer host is explicitly not used as a temporary endpoint: a
// design preview must not create a record in a production system.
export const submitContact = () => ({ transport: null, prototype: IS_PROTOTYPE, sends: false });
export const submitSantarosaLaunchInterest = () => ({ transport: null, prototype: IS_PROTOTYPE, sends: false });
