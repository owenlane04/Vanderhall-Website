// THREE FICTIONAL SAFETY NOTICES. None of these describes a real hazard, and none may ever be
// published as though it did.
//
// This is the one fixture file in the build where the ordinary rules about placeholder content are not
// enough. A plausible-looking recall is worse than a plausible-looking job advertisement by a wide
// margin: a visitor who reads one and decides their vehicle is fine, or that it is not, has been given
// safety information by a prototype. Vanderhall's live portal carries real accelerator, tie-rod,
// rear-steer, and electrical-shock notices. Not one of them is adapted, paraphrased, or used as a
// template here. Plans/V13-plan.md section 10 makes that a rule rather than a preference.
//
// So each record below says, in its own visible text, that it is a sample. The subjects are neutral to
// the point of being uninformative, which is the correct failure mode for this page: a sample notice
// should be useless as safety information and useful only as layout.
//
// Production must generate these from the authoritative safety system. The integration contract needs a
// freshness timestamp, a stable notice ID, a status, revision handling, and a source URL, all of which
// the shape below reserves.
const p = (text) => ({ type: "p", text });

export const SAFETY_PORTAL_URL = "https://portal.vanderhallusa.com/safety_notices";

export const MOCK_SAFETY_NOTICES = Object.freeze([
  {
    id: "mock-notice-1",
    slug: "placeholder-notice-a",
    title: "Placeholder notice A",
    status: "Sample",
    postedAt: "2026-07-22",
    revisedAt: null,
    affectedProducts: ["Sample product record"],
    hazardSummary: "Placeholder hazard text for layout review. No hazard is described and no vehicle is affected.",
    remedySummary: "Placeholder remedy text for layout review. No remedy is offered.",
    consumerAction: "Placeholder action text. Take no action based on this sample record.",
    contact: null,
    bodyBlocks: [
      p("This is a sample notice. It exists so that the safety detail template can be reviewed before Vanderhall's authoritative safety source is connected. It describes no hazard, names no affected vehicle, and offers no remedy."),
      p("A real notice carries a summary, the affected products, the hazard, the remedy, the action a consumer should take, a contact, any documents, and a revision date. Every one of those fields is reserved in the record shape and rendered only when the record carries it."),
    ],
    documents: [],
    sourceUrl: null,
  },
  {
    id: "mock-notice-2",
    slug: "placeholder-notice-b",
    title: "Placeholder notice B",
    status: "Sample",
    postedAt: "2026-06-11",
    // The one revised record, so both states of the header can be reviewed.
    revisedAt: "2026-07-02",
    affectedProducts: ["Sample product record", "Second sample product record"],
    hazardSummary: "Placeholder hazard text for layout review. No hazard is described and no vehicle is affected.",
    remedySummary: "Placeholder remedy text for layout review. No remedy is offered.",
    consumerAction: "Placeholder action text. Take no action based on this sample record.",
    contact: null,
    bodyBlocks: [
      p("A second sample notice, carrying a revision date so that the revised state of the detail header can be reviewed alongside the unrevised one."),
      p("Revision handling is part of the integration contract rather than of this template: a notice that has been amended must show which version a visitor is reading, and the authoritative system is the only thing that knows."),
    ],
    documents: [],
    sourceUrl: null,
  },
  {
    // Card only. The index has to be reviewable with a record whose detail route is not built.
    id: "mock-notice-3",
    slug: "placeholder-notice-c",
    title: "Placeholder notice C",
    status: "Sample",
    postedAt: "2026-05-19",
    revisedAt: null,
    affectedProducts: ["Sample product record"],
    hazardSummary: "Placeholder hazard text for layout review. No hazard is described and no vehicle is affected.",
    remedySummary: "Placeholder remedy text for layout review. No remedy is offered.",
    consumerAction: "Placeholder action text. Take no action based on this sample record.",
    contact: null,
    bodyBlocks: [],
    documents: [],
    sourceUrl: null,
  },
]);
