// Time-sensitive operational data, kept out of the templates entirely.
//
// The Santarosa Launch Edition facts came from Owen's boss on 2026-08-06 and are real. What is NOT
// approved is the polished wording around them, the legal qualifications, the form consent, and the
// live campaign state, all of which are production blockers in src/data/prototype.mjs.
//
// Every visible label and action on the landing page and on the homepage status band is derived from
// `phase` rather than from a date, because a date alone must never open public reservations. Two review
// dates carry that rule into the build: after each one, a production build fails until the content owner
// reconfirms the statement or changes it. That is what stops a page from still saying "anticipated by
// the end of August 2026" in October.

export const CAMPAIGN_PHASES = Object.freeze(["interest-open", "priority-reservations", "public-reservations", "closed"]);

// Q-V13-20 is unresolved: Owen said reservations have started, and the supplied schedule says public
// reservations are anticipated by the end of August. Those two statements are only compatible if what
// has started is the priority process. Until he confirms which, the campaign stays in the phase that
// makes the weaker claim, and the public action stays a registration of interest rather than a
// reservation. The homepage and this page read the same field, so they cannot disagree.
export const santarosaLaunchCampaign = Object.freeze({
  id: "santarosa-launch-edition-us",
  market: "US",
  totalUnits: 50,
  numbered: true,
  expectedDelivery: { quarter: 4, year: 2026, label: "Fourth quarter of 2026" },
  phase: "interest-open",
  publicReservationTarget: "2026-08-31",
  // The verified reservation destination, once John supplies one. Null is what keeps a public Reserve
  // action from rendering at all, in every phase, rather than rendering it at a guessed URL.
  reservationUrl: null,
  highlights: Object.freeze([
    { text: "Individually numbered Launch Edition badging, 1 of 50" },
    { text: "Exclusive Launch Edition specialty options package" },
    // The one quantitative engineering figure on the page, so it carries the shared estimate note
    // through the footnote system rather than a typed asterisk.
    { text: "40 kWh battery", noteIds: ["spec-estimate"] },
    { text: "Carbon-fiber dashboard" },
    { text: "Carbon-fiber glovebox" },
    { text: "Carbon-fiber center console" },
    { text: "Carbon-fiber door-jamb trim" },
    { text: "Carbon-fiber front spoiler" },
    { text: "Carbon-fiber ducktail" },
    { text: "Additional exclusive Launch Edition enhancements" },
  ]),
  priority: Object.freeze([
    { key: "existing-reservation-holders", label: "Existing Santarosa reservation holders" },
    { key: "authorized-dealers", label: "Authorized Vanderhall dealers" },
    { key: "public", label: "Public reservations, anticipated by the end of August 2026 and subject to availability" },
  ]),
  formId: "santarosa-launch-interest",
  // Owner and review dates. A production build fails past either one until somebody reconfirms.
  contentOwner: "Owen",
  verifiedAt: "2026-08-06",
  reviewAt: "2026-08-31",
  deliveryReviewAt: "2026-12-31",
});

// Brawley's delivery status is operational too, and it is stored beside the campaign for exactly that
// reason. "Brawley deliveries are underway" is true on a date; it is not evergreen model copy, and it
// must not be hard-coded into the homepage component.
export const brawleyDeliveryStatus = Object.freeze({
  id: "brawley-delivery-2026",
  state: "delivering",
  label: "Brawley deliveries are underway.",
  action: { label: "Explore Brawley", href: "/brawley/" },
  contentOwner: "Owen",
  verifiedAt: "2026-08-06",
  reviewAt: "2026-11-30",
});

// State-derived copy for the homepage band and the landing-page action. Nothing here reads a date.
export const campaignStatement = (campaign) => {
  if (campaign.phase === "interest-open") {
    return { label: "Santarosa Launch Edition registration of interest is open.", action: { label: "View Launch Edition", href: "/santarosa/launch-edition/" } };
  }
  if (campaign.phase === "priority-reservations") {
    return { label: "Santarosa Launch Edition reservation priority is underway.", action: { label: "View Launch Edition", href: "/santarosa/launch-edition/" } };
  }
  if (campaign.phase === "public-reservations") {
    // A public Reserve action requires a verified destination. Without one the page keeps the weaker
    // claim rather than pointing a reservation button at nothing.
    if (!campaign.reservationUrl) return { label: "Santarosa Launch Edition registration of interest is open.", action: { label: "View Launch Edition", href: "/santarosa/launch-edition/" } };
    return { label: "Santarosa Launch Edition reservations are now open.", action: { label: "Reserve", href: campaign.reservationUrl } };
  }
  return { label: "Santarosa Launch Edition registration is closed.", action: { label: "View Launch Edition", href: "/santarosa/launch-edition/" } };
};

// The stale-date guard. It runs at build time in production mode only: a prototype build that fails
// because a review date has passed would block design work for no safety benefit, while a production
// build that succeeds past one would publish a claim nobody has rechecked.
export const campaignReviewFailures = (today) => {
  const failures = [];
  if (today > santarosaLaunchCampaign.reviewAt && santarosaLaunchCampaign.phase !== "public-reservations") {
    failures.push(`The Santarosa public-reservation target ${santarosaLaunchCampaign.reviewAt} has passed while the campaign is still ${santarosaLaunchCampaign.phase}. ${santarosaLaunchCampaign.contentOwner} must reconfirm or change the phase.`);
  }
  if (today > santarosaLaunchCampaign.deliveryReviewAt) {
    failures.push(`The ${santarosaLaunchCampaign.expectedDelivery.label} delivery statement is past its ${santarosaLaunchCampaign.deliveryReviewAt} review date.`);
  }
  if (today > brawleyDeliveryStatus.reviewAt) {
    failures.push(`The Brawley delivery status is past its ${brawleyDeliveryStatus.reviewAt} review date and must be reconfirmed by ${brawleyDeliveryStatus.contentOwner}.`);
  }
  return failures;
};
