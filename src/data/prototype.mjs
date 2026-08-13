// V13. The boundary between a design prototype and a production release, in one place.
//
// Every V13 route that carries mock operational content, a null submission endpoint, or copy nobody
// has approved is named here. The build reads MODE from the environment: in the default `prototype`
// mode it renders the sample markers and builds normally, and in `production` mode it refuses to
// build at all while any blocker below is still open.
//
// This is not a warning and it is not a comment. It is the mechanism that keeps a fictional dealer
// list, a fictional job posting, a fictional safety notice, or an unapproved privacy policy from
// being published by somebody who did not know they were fictional. `npm run build:production` is
// the command that proves the site is ready, and today it is expected to fail.
export const MODE = process.env.VHW_MODE === "production" ? "production" : "prototype";
export const IS_PROTOTYPE = MODE !== "production";

// V15-F, Owen on 2026-08-06: the visible sample markers are retired sitewide. What remains of the
// honesty contract is this file's production gate, the per-route noindex, and fixtures that stay
// provably fictional by construction (reserved 555-01xx numbers, example.com hosts). check-content
// now asserts the marker classes and their sentences appear in zero delivered files.

// Each row is one thing a person has to supply before this site may be released. `owner` is who, not
// what team: John owns the integrations, the content owners own the words, legal owns the legal
// sentence. INTEGRATION.md is generated from nothing; it is written by hand and cross-checked against
// this list by check-content, so neither can drift alone.
export const PRODUCTION_BLOCKERS = Object.freeze([
  { id: "dealer-records", owner: "John", detail: "Six fictional dealer records stand in for the dealer database. Replace getDealers() with the real adapter." },
  { id: "google-maps-key", owner: "John", detail: "A website-restricted Google Maps browser key and a map ID. Never commit either; supply VHW_GOOGLE_MAPS_KEY and VHW_GOOGLE_MAP_ID at build time." },
  { id: "contact-endpoint", owner: "John", detail: "The Contact submission endpoint, category and subcategory routing codes, VIN lookup contract, and confirmation behaviour. FORM_ENDPOINTS.contact is null." },
  { id: "launch-interest-endpoint", owner: "John", detail: "The Santarosa Launch Edition interest endpoint and CRM mapping. FORM_ENDPOINTS['santarosa-launch-interest'] is null." },
  { id: "brawley-order-endpoint", owner: "John", detail: "The Brawley order form is now the site's only order path, and FORM_ENDPOINTS['brawley-order'] is null, so it sends nothing. Its five fields carry the legacy reservation form's own names; INTEGRATION.md holds the map and the destination." },
  { id: "reservation-status-hookup", owner: "John", detail: "The two reservation status pages render one fictional customer and two fictional reservations. Five contracts are missing: the tokenized read that resolves a link to a customer and their reservations, and the four writes behind Update contact, Confirm selection, Assign or confirm dealer, and Update payment color. FORM_ENDPOINTS['reservation-contact'], ['reservation-selection'], ['reservation-dealer'] and ['reservation-payment'] are all null." },
  { id: "launch-consent", owner: "Legal", detail: "Approved email and SMS marketing consent wording and privacy linkage for the Launch Edition interest form. No checkbox text may be invented." },
  { id: "launch-copy", owner: "Owen's boss", detail: "The Launch Edition landing copy in Plans/V13-plan.md section 7.12 is drafted from supplied facts and is not approved production wording." },
  { id: "article-claim-review", owner: "Vanderhall content/legal", detail: "The two migrated editorial articles are published source-faithfully and carry claims the current product pages do not (140-mile range, dual-motor wording, 35-inch tires). Review before treating them as current marketing; see INTEGRATION.md." },
  { id: "career-records", owner: "Content owner", detail: "Three fictional openings stand in for the careers feed. The live Paralegal and Welding Operator postings are deliberately not copied." },
  { id: "safety-records", owner: "Vanderhall safety", detail: "The three real notices are static transcriptions taken from the portal on 2026-08-07. Nothing here learns of a revision or a fourth notice, so the page must be connected to the authoritative source; the contract needs a freshness timestamp, a stable ID, a status, revision handling, and a source URL." },
  { id: "privacy-copy", owner: "Vanderhall legal", detail: "The privacy policy still describes the old WordPress site. Approved replacement copy is required before publication." },
  { id: "brawley-trademark-clause", owner: "Vanderhall legal", detail: "Approved Vanderhall-only wording for the Brawley trademark attribution. The old corporate-name sentence is withheld from public output and must not be paraphrased." },
  { id: "inquiry-mailbox", owner: "John", detail: "Confirm ownership, monitoring, and response responsibility for inquiry@vanderhall.com before launch." },
  { id: "brawley-film", owner: "Vanderhall", detail: "Written publication rights for the new Brawley master and a decision on its burned-in safety warning. The film is on the homepage per Owen's 2026-08-06 instruction; the rights paperwork is still outstanding and keeps this blocker open." },
  { id: "campaign-state-owner", owner: "Owen", detail: "A named owner for the Santarosa campaign phase and the Brawley delivery status, plus the review dates both carry." },
  { id: "redirect-ownership", owner: "John", detail: "Redirect ownership across vanderhallusa.com, the dealer subdomain, and the portal subdomain." },
]);

export const assertProductionReady = () => {
  if (IS_PROTOTYPE) return;
  throw new Error([
    `Refusing to build in production mode: ${PRODUCTION_BLOCKERS.length} blockers are open.`,
    ...PRODUCTION_BLOCKERS.map((blocker) => `  ${blocker.id} (${blocker.owner}): ${blocker.detail}`),
    "Clear each row in src/data/prototype.mjs as its owner supplies the real thing. See INTEGRATION.md.",
  ].join("\n"));
};
