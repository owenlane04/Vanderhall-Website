// The Contact request taxonomy. Two of the three top-level categories are the legacy form's own,
// inspected on the legacy dealer host on 2026-08-06 without submitting a request; the third is a new
// business route Owen approved in Q-V13-5.
//
// The `legacy` field on each option is the routing value the old system used. It is recorded here and
// mapped in INTEGRATION.md so John can connect this UI to the same workflow, and it is deliberately NOT
// sent from the browser: the legacy flow posts to the dealer host and creates a server-side request ID
// between stages, so reproducing it from a static page would mean writing records into a production
// system from a design prototype.
//
// Field names are semantic and API-neutral. The legacy names (`request_first_name` and the rest) belong
// in the mapping document, not in this form's markup.
import { models } from "../models.mjs";

// Derived from the model data rather than typed out, which is the whole point: the legacy form offered
// Venice, Carmel and Brawley, so a hand-maintained list here would have silently omitted Santarosa and
// would omit whatever comes after it.
const modelOptions = models.map((model) => ({ value: model.slug, label: model.name, pastModel: Boolean(model.pastModel) }));

export const CONTACT_CATEGORIES = Object.freeze([
  {
    value: "dealer-experience",
    label: "Dealer Experience",
    legacy: "DEALER",
    help: "Questions about a dealer, a service visit, or parts.",
    fields: ["subcategory", "dealer", "vin"],
    subcategories: [
      { value: "parts", label: "Parts", legacy: "Parts" },
      { value: "service", label: "Service", legacy: "Service" },
      { value: "sales", label: "Sales", legacy: "Sales" },
    ],
    // VIN appears only for Service, and only because the legacy flow requires a VIN lookup there. The
    // lookup contract itself is John's to supply, so the prototype asks for the number and validates
    // nothing about it beyond its presence.
    vinWhen: "service",
  },
  {
    value: "product-information",
    label: "Product Information",
    legacy: "PRODUCT",
    help: "Questions about a Vanderhall model.",
    fields: ["model", "timeframe", "postalCode", "message"],
    models: modelOptions,
  },
  {
    // New in V13. Owen approved it in Q-V13-5 as an intentional new business route: the legacy form sent
    // every support question through a sales taxonomy, so an owner with a documentation question had to
    // pretend to be a prospect. The ownership fields are conditional for the same reason.
    value: "customer-service",
    label: "Customer Service",
    legacy: null,
    help: "Support for an owned vehicle, documentation, or a warranty question.",
    fields: ["topic", "model", "ownership", "vin", "dealerOfPurchase", "purchaseDate", "message"],
    topics: [
      { value: "vehicle-support", label: "Vehicle support" },
      { value: "owner-documentation", label: "Owner documentation" },
      { value: "warranty-question", label: "Warranty question" },
      { value: "other", label: "Something else" },
    ],
    models: modelOptions,
    // Ownership fields appear only once the visitor says they own the vehicle. A general website or
    // documentation question must never be blocked behind a VIN.
    ownershipWhen: "yes",
  },
]);

export const CONTACT_TIMEFRAMES = Object.freeze(["Ready now", "1 to 3 months", "3 to 6 months", "Just looking"]);

// Category values that may arrive in a query string. Anything else renders no selection at all and
// never throws, which is what section 6.3 requires of a stale link.
export const CONTACT_CATEGORY_VALUES = Object.freeze(CONTACT_CATEGORIES.map((category) => category.value));

export const CONTACT_PROTOTYPE_RESULT = "This is a design preview. Your information was not sent.";
