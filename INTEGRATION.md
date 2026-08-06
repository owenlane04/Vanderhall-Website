# V13 integration handoff

For John. This document is the complete list of everything in the V13 build that is fake, unconnected, or
unapproved, and what has to be supplied before the site can be released.

Written 2026-08-06 against the V13 build. `scripts/check-content.mjs` asserts that every blocker ID in
`src/data/prototype.mjs` appears in this file, so the two cannot drift apart: a blocker with no entry here
fails the build.

## 0. How to read the build

The build runs in one of two modes.

```bash
npm run build             # prototype mode, the default
npm run build:production  # production mode, expected to fail today
```

`npm run build:production` refuses to run while any row of `PRODUCTION_BLOCKERS` in
`src/data/prototype.mjs` is open, and prints the whole list with its owner. That is the release gate. It also
runs a stale-date check on the two campaign statements described in section 6.

In prototype mode the build additionally:

- renders a visible `Sample content` marker on every page carrying fictional records;
- adds `<meta name="robots" content="noindex, follow">` to the six routes whose records are fictional
  (`/dealers/`, `/experience/`, `/blog/`, `/careers/`, `/safety/`, `/santarosa/launch-edition/`, and their
  detail pages). `robots.txt` still allows crawling, deliberately: a `Disallow` rule would stop a crawler
  before it could read the tag.

## 1. The data boundary

Every page builder reads its records through `src/data/adapters.mjs` and through nothing else. No template
imports a fixture and no template imports an endpoint. **Replace the adapter, not the templates.**

| Adapter function | Returns | Replace with |
|---|---|---|
| `getDealers()` | Array of dealer records | The dealer database or API |
| `getDealerFilters()` | Filter options | Keep, or extend if the real data has more capability fields |
| `getPosts()` / `getPost(slug)` | Articles, newest first | CMS or database |
| `getPostRoutes()` | Only posts with a body | Same rule: a record with no body gets no route |
| `getExperienceModules()` | Ordered, allowlisted hub modules | Add a module type when a real one exists |
| `getJobs()` / `getJob(slug)` / `getJobRoutes()` | Open postings | Careers feed |
| `getSafetyNotices()` / `getSafetyNotice(slug)` / `getSafetyNoticeRoutes()` | Notices, newest first | Authoritative safety system |
| `getPrivacyPolicy()` | Document record | Keep the shape; replace the copy |
| `getSantarosaLaunchCampaign()` / `getBrawleyDeliveryStatus()` | Campaign state | An owner-editable source |
| `submitContact()` / `submitSantarosaLaunchInterest()` | `{ transport: null, sends: false }` | The real transport |
| `formatDate(iso)` | One display format for the whole site | Keep |

Rules the shapes enforce:

- **Stable IDs and slugs are separate, and neither is an array position.** The featured article is selected by
  ID, so reordering the records cannot change which story leads.
- **A missing optional field disappears; a missing required field throws** at build time with the record
  named. `required()` in the adapter file lists which fields are required per record type.
- **Dates are ISO 8601 in data**, formatted for display in one place.
- **Rich text is an allowlisted block model**, never an HTML string. `prose()` in `src/components.mjs`
  supports `p`, `h2`, `h3`, `ul`, `quote`, and `image`, and throws on anything else. Do not pipe a CMS field
  through as HTML.
- **Every string is escaped** on the way out. External URLs are output as-is in `href` and must be validated
  by the adapter.

## 2. Production blockers

Each ID below is a row in `PRODUCTION_BLOCKERS`. Clearing a row means deleting it from that array once the
thing it names actually exists.

### `dealer-records` (John)

`src/data/mock/dealers.mjs` holds **six fictional dealers**. They are provably fake by construction: reserved
`555-01xx` telephone numbers, `example.com` websites, invented street addresses. The cities and coordinates
are real, because the locator sorts by distance and fits map bounds and cannot be reviewed otherwise.

Record contract:

```js
{
  id, slug, name, address1, address2, city, region, postalCode, country,
  latitude, longitude, phone, websiteUrl,
  capabilities: { ev, gas, service },
  models, hours, status
}
```

Required: `id`, `slug`, `name`, `address1`, `city`, `region`, `postalCode`, `latitude`, `longitude`, `phone`.
Optional and safe to omit: `address2`, `country`, `models`, `hours`, `status`, and any capability.

The `Service` filter is offered because the mock records carry a service capability. If the real dealer data
has no service field, remove the filter rather than defaulting every dealer to true.

### `google-maps-key` (John)

Two environment values, read at build time and **never committed**:

```bash
VHW_GOOGLE_MAPS_KEY=...   # website-restricted browser key
VHW_GOOGLE_MAP_ID=...     # map ID for Advanced Markers
```

- Restrict the key by allowed website (`vanderhall-website.vercel.app` and the production domain) and by API
  in Google Cloud. See https://developers.google.com/maps/api-security-best-practices.
- APIs required: Maps JavaScript API, Places API, Geocoding API.
- The SDK loads **only on `/dealers/`**, and only when the map area comes near the viewport or the visitor
  opens the mobile Map view. It must never become the LCP element.
- `check-content.mjs` fails if a key reaches built output.
- **Without a key the locator still works**: the full dealer list, search by city or postal text, the
  capability filters, and every phone, website, and directions link. The map panel says it is unavailable
  rather than pretending to load. Distances and distance sorting need the geocoder, so they appear only once a
  key is present.
- Vanderhall's own data supplies the dealers. Google is used only to resolve the visitor's location and to
  draw markers. **Do not call Google Places to find Vanderhall dealers.**
- Directions use the official URL with the record's coordinates:
  `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`.

### `contact-endpoint` (John)

`FORM_ENDPOINTS.contact` is `null`, and `site.js` refuses to send when it is. The page says so in visible copy.

The form is `id="contact-form"`, `data-form-id="contact"`. Field names are semantic and API-neutral. The
legacy identifiers, inspected on the legacy dealer host on 2026-08-06 **without submitting a request**, map
like this:

| New name | Legacy field | Notes |
|---|---|---|
| `firstName` | `request_first_name` | required |
| `lastName` | `request_last_name` | required |
| `email` | `request_email` | required |
| `phone` | `request_phone` | **Required in this prototype; confirm.** The legacy screen says contact information is required but publishes no HTML `required` attribute anywhere, so the real rule cannot be proven from the public UI. (Q-V13-4) |
| `category` | the stage-two select | `dealer-experience` → legacy `DEALER`, `product-information` → legacy `PRODUCT`, `customer-service` → **new, no legacy value** |
| `subcategory` | Dealer Experience choices | `parts` / `service` / `sales` → legacy `Parts` / `Service` / `Sales` |
| `topic` | none | Customer Service only. Prototype values `vehicle-support`, `owner-documentation`, `warranty-question`, `other` are **mock routing codes and need approval** |
| `model` | the Product Information model select | Derived from `src/data/models.mjs`, so Santarosa and future models cannot be omitted. The legacy list was Venice, Carmel, Brawley only |
| `vin` | `vehicle_vin` | Shown for Dealer Experience → Service, and for Customer Service only once the visitor says they own the vehicle |
| `dealerId` | server-driven on the legacy form | Free text in the prototype |
| `purchaseDate`, `dealerOfPurchase` | none | Customer Service, ownership-gated |
| `postalCode`, `timeframe`, `message` | none on the legacy first step | Product Information |

Still needed: the endpoint, the production category and subcategory codes, recipients and queues,
territory/dealer routing, the **VIN lookup contract**, consent and privacy language, spam controls, analytics
event names, the real success text, any response-time promise, and confirmation-email behaviour.

Do not send the legacy `create_request` action or update URLs from the browser, and do not use the old dealer
host as a temporary endpoint.

`/recommend-dealer/` and `/dealer-inquiry/` are unchanged and keep their own routes and form IDs.

### `launch-interest-endpoint` (John)

`id="santarosa-launch-interest-form"`, `data-form-id="santarosa-launch-interest"`,
`FORM_ENDPOINTS["santarosa-launch-interest"]` is `null`. A distinct identity from Contact and from both dealer
forms.

All eight visible fields are required: `firstName`, `lastName`, `address`, `city`, `state`, `postalCode`,
`phone`, `email`.

Needed: endpoint, CRM and campaign field mapping, **deduplication against existing reservation holders**,
campaign phase source, state and territory eligibility, spam protection, analytics, confirmation email, error
handling, retention rules, and approved success and response copy.

### `launch-consent` (Legal)

Phone and email are both required and the introduction promises updates, announcements, and previews. That is
marketing contact and **no consent language was supplied**, so the form ships with no consent checkbox at all.
`check-content.mjs` fails if a checkbox appears on that page. Supply approved email and SMS consent wording,
the privacy-policy linkage, and retention terms.

### `launch-copy` (Owen's boss)

The page's facts came from Owen's boss on 2026-08-06 and are real: United States only, 50 individually
numbered vehicles, the badging, the specialty options package, a 40 kWh battery, the six carbon-fiber parts,
Q4 2026 initial deliveries, and the three-step reservation priority. The **polished wording** around them, in
`Plans/V13-plan.md` section 7.12, is not approved production copy.

Three qualifiers are load-bearing and the check suite asserts each one: `expected to begin`,
`anticipated by the end of August 2026`, and `subject to availability`. Removing any of them materially
changes the claim.

The page publishes no price, deposit, refundability term, delivery guarantee, allocation promise, or
Product/Offer schema, because none was supplied.

### `article-records` (Content owner)

`src/data/mock/articles.mjs` holds **three sample articles**, two with bodies. They deliberately say nothing
about a vehicle: no specification, availability, price, range, competitor, market, or safety claim. The two
legacy Brawley posts are **not** carried over in any form; their bodies contain unreviewed technical and
market claims.

Record contract:

```js
{
  id, slug, title, standfirst, excerpt, category, tags, author,
  publishedAt, updatedAt, readingMinutes, hero, bodyBlocks, relatedSlugs, seo
}
```

`BlogPosting` structured data may be emitted **only** once real records replace these. Mock records emit no
schema, which the zero-JSON-LD rule in `check-content.mjs` enforces for every route except the homepage and
the purchase page.

### `career-records` (Content owner)

`src/data/mock/careers.mjs` holds **three fictional openings**, two with detail sections. The live Paralegal
and Welding Operator postings are deliberately not copied: they are current operational records that may be
filled or withdrawn, and `check-content.mjs` fails if either title appears.

`applyUrl` is `null` on every record, so the apply action renders disabled and labelled as sample. **The
prototype collects no applicant data at all** and must not start doing so before a real destination exists.

`EQUAL_OPPORTUNITY_STATEMENT` is `null`. It is a legal statement, so Vanderhall supplies the sentence rather
than this project drafting one; the detail template prints it only when it exists.

`JobPosting` structured data is allowed only for real, active records with working apply URLs and dates.

### `safety-records` (Vanderhall safety)

`src/data/mock/safety.mjs` holds **three fictional notices**. This is the strictest fixture file in the build:

- Every record says `Sample notice` on the page and states in its own body that it describes no hazard.
- Subjects are deliberately uninformative. A sample notice should be useless as safety information.
- Vanderhall's live accelerator, tie-rod, rear-steer, and electrical-shock notices are **not** adapted,
  paraphrased, or used as templates. `check-content.mjs` fails on any of those subject words.
- The index does **not** say "no active recalls". It says no notices are available from the connected source,
  because only the authoritative system can make that determination.

Production must fetch from or be generated from the authoritative safety system. The contract needs a
**freshness timestamp**, a stable notice ID, a status, **revision handling**, and a source URL.

The official portal (`https://portal.vanderhallusa.com/safety_notices`) stays linked from `/safety/` and from
each notice as a clearly labelled fallback until parity and working detail routes are verified. (Q-V13-10)

### `privacy-copy` (Vanderhall legal)

`/privacy/` reproduces Vanderhall's own legacy policy **verbatim**, typos included, as V10 decided. V13
redesigns the reading experience around it and changes not one word.

Several passages describe the old WordPress site: Google AdSense, cookies, a shopping cart, and card payments
this site does not have. The page states in visible copy that its structure is a prototype and that approved
legal copy is required before publication.

`effectiveAt` and `updatedAt` are `null` because Vanderhall's page publishes neither, and inventing a policy
date would be a legal claim. The header prints each only when the record carries one.

### `brawley-trademark-clause` (Vanderhall legal)

The Brawley safety block's third paragraph used to end with a trademark attribution naming the corporate
entity. Two rules collide there: Q-V13-25 bans the old public brand name from every delivered surface, and
Q-V13-27 forbids both a paraphrase and a public exception.

So **the clause is withheld**, and `gts.trademarkClause` is `null`. Both safety sentences from that paragraph
still ship verbatim; a trademark attribution is an ownership statement about marks, not a warning about
operating a vehicle, so removing it takes no safety information off the page. The withheld source sentence is
recorded in `../Research/V13-legal-pending.md`.

To clear this: legal supplies Vanderhall-only wording, it goes into `gts.trademarkClause`, the disclosures
block renders it, and the required-disclosure list in `check-content.mjs` is extended to assert it.

### `inquiry-mailbox` (John)

`inquiry@vanderhall.com` appears as visible, focusable text in the Connect column of every page footer, linked
as exactly `mailto:inquiry@vanderhall.com` with no subject, body, query, or script. Defined once in
`src/data/forms.mjs` so the footer cannot drift between pages.

Confirm **mailbox ownership, monitoring, and response responsibility** before launch. The visible-address
choice knowingly accepts ordinary address scraping in exchange for the access Owen asked for. It is a
convenience route and not a submission endpoint.

### `brawley-film` (Vanderhall)

**This is the one V13 item that was not built.** The plan's own answer to Q-V13-16 is that public delivery is
blocked until publication rights and the treatment of the master's burned-in safety warning are documented.
Neither has happened, so the homepage still carries the V11 canyon montage and `src/data/video.mjs` is
unchanged.

When rights and legal treatment are documented, the work is:

- Trim `../Assets/Source Video/Brawley/brawley-final-master.mp4` at **exactly 25.000 s** and use the remainder
  through 62.059 s, about 37.059 s. The 25-second point is deliberate; do not substitute a scene-detection
  result.
- Produce MP4 and WebM derivatives, one video stream each, **no audio stream** (document that the audio was
  removed deliberately rather than omitted by accident).
- Responsive posters from an approved frame, no upscaling. The poster stays the eager, high-priority LCP
  element and the video sources stay unresolved until after load.
- Retire the montage's five delivered files and add the retired basenames to the retired-video list in
  `check-content.mjs`.
- Migrate `check-video.mjs`: the exact delivered pair, duration within a frame-accurate tolerance, a byte
  budget, poster aspect and start-frame match, codecs, dimensions, frame rate, MP4 fast start, and a
  start-frame fingerprint so a derivative beginning before or after 25.000 s fails.
- Preserve every V11 gate: the 768 px mobile gate, Save-Data, reduced motion, no-JavaScript, pause offscreen,
  and the keyboard-operable pause control. Both Brawley routes stay video-free.
- Do **not** crop away, replace, or rely on the burned-in warning line, and do not transcribe legal wording
  from video pixels. If an HTML safety disclosure is required, render approved text independently.

### `campaign-state-owner` (Owen)

`src/data/mock/campaign.mjs` holds the campaign phase and the Brawley delivery status, each with a
`contentOwner`, a `verifiedAt`, and a review date. A production build fails past a review date until somebody
reconfirms.

- Santarosa phase: `interest-open`. Valid values are `interest-open`, `priority-reservations`,
  `public-reservations`, `closed`.
- `reviewAt` `2026-08-31`, the public-reservation target.
- `deliveryReviewAt` `2026-12-31`, for the Q4 2026 statement.
- Brawley delivery status `reviewAt` `2026-11-30`.

**Q-V13-20 is unresolved.** Owen said reservations have started; the supplied schedule says public
reservations are anticipated by the end of August. Those are only compatible if what started is the priority
process, so the campaign stays in the phase making the weaker claim and the public action is a registration of
interest. A public `Reserve` action requires **both** `phase: "public-reservations"` and a non-null
`reservationUrl`; without the URL the page keeps the weaker claim rather than pointing a reservation button at
nothing. The homepage band and the landing page read the same field and cannot disagree.

### `redirect-ownership` (John)

Owned by whoever controls the domains, not by this build.

- Legacy dealer-locator aliases → `/dealers/`.
- Legacy `/blog/` stays `/blog/`. The two old article slugs map to new routes **only if** approved
  replacement articles exist.
- `/owners/` does **not** redirect. Existing manual links and bookmarks stay valid; only the navigation
  placement and the page title changed.
- Legacy privacy aliases → `/privacy/`.
- The `/contact` redirect pair was **removed** from `vercel.json`, because `/contact/` is a real route now.
  The `/about` pair remains.
- The old contact, careers, and safety subdomains **cannot be retired** until these routes are connected to
  their authoritative data and submission systems.

## 3. The Experience hub and Events

`getExperienceModules()` returns an ordered, allowlisted module description. V13 has exactly one type,
`blog`, and an unknown type throws at build time rather than rendering unsafe HTML.

**Events has no V13 route, no records, no registration destination, and no schema.** The hub renders no
Events heading, no empty calendar, no coming-soon card, and no `Event` structured data, and the check suite
asserts each of those absences. When real event data, fields, ownership, and a route exist, a second entry
joins the module list and the hub renders it in place: no second hub redesign.

Experience takes the current primary-navigation state on `/experience/`, `/blog/`, and every article route. An
eventual `/events/` joins that prefix list in `src/components.mjs` when the route exists.

## 4. What else changed that an integrator should know

- **The public brand name is `Vanderhall` everywhere.** Adapters, CMS fields, metadata, schema, and imported
  legacy records must not reintroduce the old name into built output. `check-content.mjs` scans every
  delivered file case-insensitively.
- **`request-info` is retired**, including the form ID, the `#request-info` anchor, and the endpoint key.
  Submissions from `/contact/` must not arrive under it.
- **Carmel and Venice publish no specifications.** `HISTORICAL_SPECS` in `src/data/models.mjs` retains every
  researched figure with its source notes, and nothing that renders a page can reach it. The check suite
  asserts the inverse: no retained value may appear in built HTML.
- **Removed product claims.** Brawley's 140-mile range and Santarosa's 150-mile, 300-mile, and 180 hp figures
  are gone from copy, metadata, and JSON-LD. Do not let a connected CMS reintroduce them.
- **Footnotes are semantic.** A row or figure carries `noteIds`; the renderer assigns `*`, `**`, `***` in
  first-use order per page and throws rather than printing a fourth asterisk. Notes live in
  `src/data/footnotes.mjs`, and the production check rejects an unreferenced note.

## 5. Verification

```bash
npm run build && npm run check && npm run verify:browser
```

`check:links` resolves every internal reference. `check:content` asserts structure, copy, counts, the brand
rule, the production gate, and the noindex set. `check:video` re-derives the delivered video's properties with
`ffprobe`. `verify:browser` drives a real Chrome over every route.

Staging deployments carrying mock data must stay `noindex`.
