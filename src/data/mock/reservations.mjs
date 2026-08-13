// V21. Reservation status records, and ONE FICTIONAL CUSTOMER.
//
// The source is Vanderhall's own reservation portal, read on 2026-08-13 from a real customer's
// tokenized link at dealer.vanderhallusa.com/reservation_status/index/<token>/<token>. Nothing was
// submitted, clicked, or changed on that system. Plans/V21-plan.md section 2 is the only record of
// what that page contains, because it lives on a subdomain no earlier audit crawled.
//
// THE REAL CUSTOMER'S DETAILS ARE NOT IN THIS REPOSITORY AND MUST NEVER BE. The capture carried a
// name, an email address, a telephone number, and a street address belonging to an actual person.
// The customer below is invented and stays provably fictional by construction, the same rule the
// dealer fixtures follow: a reserved 555-01xx telephone number and an example.com address. Two
// check-content assertions ban the real customer's surname and email outright, so a careless paste
// fails the build rather than reaching a deployment.
//
// The record shape mirrors the portal's structure so that connecting it is an adapter change and
// not a template rewrite. John replaces getReservation() in src/data/adapters.mjs; no page builder
// reads this file. See the reservation-status-hookup row in src/data/prototype.mjs.

import { modelBySlug } from "../models.mjs";

// When the portal was read. The pages state nothing about freshness, because a reservation status
// is meaningless as a snapshot; this exists so that whoever wires the live source can see how old
// the structure they are replacing is.
export const RESERVATIONS_RETRIEVED_AT = "2026-08-13";

// The four-step tracker, verbatim from the portal. Each step prints two lines, exactly as it does
// there: the state on top, the obligation beneath it. The wording is Vanderhall's, including the
// fee figures, and it is not paraphrased anywhere.
export const RESERVATION_STEPS = Object.freeze([
  { key: "information", title: "Information Added", detail: "Availability Determined" },
  { key: "reservation-fee", title: "$100 Non-Refundable", detail: "Reservation Order Fee" },
  { key: "order-fee", title: "Production is Close", detail: "Additional $900 Order Fee" },
  { key: "delivered", title: "Vehicle has Been Delivered", detail: "Arrange for Pickup and Payment" },
]);

// The page-foot line, verbatim from the portal.
export const RESERVATION_DISCLAIMER = "Model, color, and dealer selection are not final until $900 order fee is made.";

// The fictional customer. Provo puts them beside the first dealer fixture, which is what makes the
// closest-dealer copy on the Santarosa page mean something under review.
export const MOCK_RESERVATION_CUSTOMER = Object.freeze({
  firstName: "Jordan",
  lastName: "Avery",
  email: "jordan.avery@example.com",
  phone: "+1 801 555 0142",
  country: "US",
  address: "429 S 500 E",
  city: "Provo",
  state: "UT",
  postalCode: "84606",
});

// Which dealers may receive a reservation vehicle. The portal publishes ten real Vanderhall stores
// here and this build deliberately does not reproduce them, which is the one place V21 departs from
// portal-faithfulness on purpose.
//
// Two reasons. Every other record on these pages is fictional, so printing a real store's name beside
// an invented customer's invented reservation would attach an actual dealership to a person who does
// not exist. And the site already has one dealer source: /dealers/ renders getDealers(), so reading
// the same records here means the reservation picker starts naming real stores the moment John
// replaces that adapter, with no second list to remember. The portal's ten names are recorded in
// Plans/V21-plan.md section 2.2 and the live list replaces all of this at hookup.
//
// Five of the six fixtures are authorized and the sixth is not, which is what reproduces the
// portal's second dealer state: a reservation assigned to a store that cannot receive it.
export const RESERVATION_AUTHORIZED_DEALER_SLUGS = Object.freeze([
  "wasatch-motorworks",
  "high-desert-electric",
  "silver-state-roadsters",
  "front-range-autocycle",
  "treasure-valley-powersports",
]);
export const RESERVATION_UNAUTHORIZED_DEALER_SLUG = "valley-electric-sport";

// The Santarosa model options, verbatim from the portal's own select.
export const SANTAROSA_RESERVATION_MODELS = Object.freeze([
  "Santarosa",
  "Santarosa GTS",
  "Santarosa GTS+",
  "Santarosa Launch",
]);

// The Santarosa color options. The portal's select is a concatenation of every model's list, so it
// offers twenty-three options over nine distinct colors, repeats Obsidian Black four times, and
// carries one typo ("Emeral Green Metallic"). Deduplicated here, in the portal's own first-seen
// order, with the typo corrected. This is a presentation cleanup of mock data and not a product
// claim: the live list replaces it at hookup, and no page states which colors a Santarosa is
// actually available in.
export const SANTAROSA_RESERVATION_COLORS = Object.freeze([
  "Atomic Green",
  "Bosco Blue",
  "Obsidian Black",
  "Rossa",
  "Ida Rose",
  "Royal Blue",
  "Ivory White",
  "Jean Grey",
  "Emerald Green Metallic",
]);

// The Brawley payment card, verbatim from the portal. Every sentence below is Vanderhall's, quoted
// rather than rewritten, which is why the fee figures appear here at all: the card is meaningless
// without them, and paraphrasing a payment obligation is not a style decision this build gets to
// make. check-content allows these amounts on this route by name and nowhere else.
export const BRAWLEY_FINAL_PAYMENT = Object.freeze({
  heading: "Submit $900 Brawley Final Payment",
  body: "Congratulations on your upcoming order. In order for your reservation to move forward, you will be required to submit an additional non-refundable and non-transferrable $900 payment, which will be applied to the purchase of your vehicle. Your $100 pre-order fee will convert to an initial payment for a total payment of $1,000. Estimated delivery to the dealer is currently two to three weeks on legacy colors while supplies last and 30 to 60 days on new Specialty Colors. Please contact your selected dealer to arrange final payment.",
  notice: "Due to outsized demand, we are limiting foreseeable production to Brawley GTS models only. Your reservation is currently configured with another model, please modify your existing selection to proceed.",
  noticeLabel: "Brawley GTS",
  keepSelection: "If you wish to keep your original model selection, no action is necessary and you will be informed if that model goes into production.",
  // The portal lists the nine colors again here, in its own order and under its own spelling. These
  // read from the site's paint records instead, so the card and the swatch grid above it cannot name
  // one color two ways: the portal calls the metallic "Emerald Green" in this dropdown and the site
  // calls it Emerald Green Metallic everywhere, including on /brawley/gts/.
  colorOptions: modelBySlug.brawley.gts.paint.map((option) => [option.slug, option.name]),
});

// The two reservations. Both states the portal showed are represented: Brawley has a dealer and no
// model chosen yet, Santarosa has a model and a dealer that cannot receive it.
export const MOCK_RESERVATIONS = Object.freeze([
  Object.freeze({
    id: "mock-reservation-brawley",
    slug: "brawley",
    modelName: modelBySlug.brawley.name,
    // The portal titles a section by what has been chosen. With no model selected it asks for one.
    title: "Select your Brawley model",
    modelSelected: false,
    reservedAt: "2025-03-14",
    // One option, because production is limited to the GTS. That is the portal's own state and the
    // reason its payment card carries the notice below.
    modelOptions: Object.freeze([modelBySlug.brawley.gts.name]),
    // Swatches rather than a select, reading the same paint records /brawley/gts/ renders, so the
    // two surfaces cannot disagree about what a Brawley is painted.
    paint: modelBySlug.brawley.gts.paint,
    paintTiers: modelBySlug.brawley.gts.tiers,
    dealerState: "assigned",
    dealerSlug: "wasatch-motorworks",
    completedSteps: 2,
    finalPayment: BRAWLEY_FINAL_PAYMENT,
  }),
  Object.freeze({
    id: "mock-reservation-santarosa",
    slug: "santarosa",
    modelName: modelBySlug.santarosa.name,
    title: "Santarosa",
    modelSelected: true,
    reservedAt: "2024-11-02",
    modelOptions: SANTAROSA_RESERVATION_MODELS,
    colorOptions: SANTAROSA_RESERVATION_COLORS,
    dealerState: "unauthorized",
    dealerSlug: RESERVATION_UNAUTHORIZED_DEALER_SLUG,
    completedSteps: 2,
    finalPayment: null,
  }),
]);
