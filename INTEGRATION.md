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

In prototype mode the build additionally adds `<meta name="robots" content="noindex, follow">` to the
routes whose records are fictional (`/dealers/`, `/careers/` and its detail pages, `/safety/`, and
`/santarosa/launch-edition/`). `robots.txt` still allows crawling, deliberately: a `Disallow` rule would
stop a crawler before it could read the tag.

V15 removed the visible `Sample content` markers sitewide on Owen's instruction, so **the page no longer
tells a visitor which records are fictional**. The honesty contract is now carried entirely by this
document, the production gate, the noindex above, and fixtures that are provably fictional by construction
(reserved 555-01xx numbers, example.com hosts). `/experience/` and `/blog/` left the noindex set because
their records are now the two real, previously published Vanderhall articles.

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

`FORM_ENDPOINTS.contact` is `null`, and `site.js` refuses to send when it is. V15 removed the pre-submit
"not connected" note; on submit the visitor sees one true sentence directing them to the inquiry address,
and nothing is transmitted or stored.

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

### `article-claim-review` (Vanderhall content/legal)

The `article-records` blocker is resolved: `src/data/articles.mjs` now holds the **two real Vanderhall
articles** migrated from vanderhallusa.com on Owen's instruction (the side-by-side explainer of 2025-11-12
and the electric off-road piece of 2025-10-25), published source-faithfully under their original dates with
their original featured images (archived with hashes in `Assets/Blog/README.md`). A CMS replaces only
`getPosts()`/`getPost()`/`getPostRoutes()` in the adapter; the same IDs and slugs carry over.

What this blocker holds open is a **content and legal review of the migrated copy**, because it states
claims the current product pages deliberately do not:

- "Up to 140 miles" of range, in both articles. V13 removed that figure from every product surface as
  unverified.
- "Dual electric motors generate 404 horsepower", which conflicts with the site's own quad-motor
  description (the other article says four motors).
- 35-inch tires versus the published 18-inch wheels row, cabin dimensions, eCrab/eCrawl/eSteer operation up
  to 15 mph, charging-network practicality, competitor comparisons, delivery in UT/AZ/MT/WY, and broad
  maintenance/sustainability statements.

The automated claim ban still proves the banned figures appear nowhere outside these two named editorial
routes and never in Product JSON-LD. The articles are dated editorial, not the source of truth for the
specification table; review before treating them as current marketing.

Record contract (unchanged):

```js
{
  id, slug, title, standfirst, excerpt, category, tags, author,
  publishedAt, updatedAt, readingMinutes, hero, bodyBlocks, relatedSlugs, seo
}
```

Each article route emits `BlogPosting` JSON-LD with its real title, dates, author, description, URL, and
image, asserted by `check-content.mjs`. Paragraphs and list items may carry allowlisted inline segments
(plain text, safe links, strong, emphasis); raw CMS HTML is still rejected.

### `career-records` (Content owner)

`src/data/mock/careers.mjs` holds **three fictional openings**, two with detail sections. The live Paralegal
and Welding Operator postings are deliberately not copied: they are current operational records that may be
filled or withdrawn, and `check-content.mjs` fails if either title appears.

`applyUrl` is `null` on every record, so the apply action renders disabled with "Applications for this
role are not open yet." **The prototype collects no applicant data at all** and must not start doing so
before a real destination exists. V15 removed the visible sample labels, so these three fictional openings
now read as ordinary postings; their visible copy is deliberately generic to any vehicle manufacturer and
promises no compensation, benefit, or legal term. Replacing them with the real feed is what closes this row.

`EQUAL_OPPORTUNITY_STATEMENT` is `null`. It is a legal statement, so Vanderhall supplies the sentence rather
than this project drafting one; the detail template prints it only when it exists.

`JobPosting` structured data is allowed only for real, active records with working apply URLs and dates.

### `safety-records` (Vanderhall safety)

V15 changed this page's shape. With the visible sample markers retired sitewide, an **unlabelled fictional
recall notice is the one thing on this site that could hurt someone if it were believed**, so `/safety/`
now publishes no notice at all: it is a portal page that directs visitors to the official safety notices
portal and to Contact. It makes no claim of absence in either direction, because only the authoritative
system can make that determination, and real live notices exist.

The three fictional records remain in `src/data/mock/safety.mjs` and the card, list, and detail templates
remain in the codebase, unreferenced. Connecting the real safety source through
`getSafetyNotices()`/`getSafetyNoticeRoutes()` and rendering the list again is what closes this row. The
old fixture rules still stand for that work: Vanderhall's live accelerator, tie-rod, rear-steer, and
electrical-shock notices are **not** adapted as placeholders (`check-content.mjs` fails on those subject
words), and the contract needs a **freshness timestamp**, a stable notice ID, a status, **revision
handling**, and a source URL.

The official portal (`https://portal.vanderhallusa.com/safety_notices`) is the page's primary action until
parity and working detail routes are verified. (Q-V13-10)

### `privacy-copy` (Vanderhall legal)

`/privacy/` reproduces Vanderhall's own legacy policy **verbatim**, typos included, as V10 decided. V13
redesigns the reading experience around it and changes not one word.

Several passages describe the old WordPress site: Google AdSense, cookies, a shopping cart, and card payments
this site does not have. V15 removed the visible prototype label, so nothing on the page itself warns that
the copy is stale; this row and the production gate are the only remaining record of that, which makes
supplying current approved copy more urgent, not less.

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

**The film is delivered.** Owen instructed delivery in chat on 2026-08-06 and the homepage hero now carries
one play-once film cut from `../Assets/Source Video/Brawley/brawley-final-master.mp4`. What keeps this
blocker open is the paperwork the delivery decision did not resolve: **written publication rights for
footage, people, locations, and vehicle treatment, and a documented decision on the master's burned-in
safety warning.** Until both exist this stays a production blocker, and the exposure now sits on the live
homepage rather than in a plan.

What shipped, so the next person does not have to re-derive it:

- The trim starts at **exactly 25.000 s**, Owen's approved cut past the studio reveal, and ends at
  **59.500 s** rather than the master's 62.059 s end: the master fades to full black across its final two
  seconds, and the play-once hold would have settled the hero on a black panel. Owen approved "up until the
  minute" in the same chat; 59.500 is the last clean moment of the close front view before the fade begins.
  Neither timestamp may be replaced with a scene-detection result.
- Delivered pair: `brawley-film-25-60.webm` (VP9, 7,842,968 bytes) and `brawley-film-25-60.mp4` (H.264,
  fast-started, 12,950,302 bytes), both 1920 by 1080 at 24000/1001 fps, one video stream each, **no audio
  stream** (removed deliberately at encode time, not omitted by accident; the page offers no volume
  control). Three poster rungs at 960, 1280, and 1920 from the film's own first frame, no upscaling.
- The film plays once and holds its final frame; the markup carries no `loop` attribute and site.js will not
  restart a finished film on scroll return or tab return. Only the visitor's press of the control replays it.
- The montage's five delivered files are deleted and their basenames sit in the retired-video list in
  `check-content.mjs`, so restoring them has to be a decision.
- `check-video.mjs` asserts the exact delivered pair, duration within a frame-accurate window, byte budgets,
  codecs, dimensions, frame rate, MP4 fast start, and start- and final-frame fingerprints against
  `scripts/lib/film-refs/`, so a derivative cut before or after 25.000 s fails. The poster is
  fingerprint-matched to the film's first frame.
- Every V11 gate is preserved: the 768 px mobile gate, Save-Data, reduced motion, no-JavaScript, pause
  offscreen, and the keyboard-operable pause control. Both Brawley routes stay video-free.
- The burned-in warning line near the lower edge is neither cropped away, replaced, nor relied on, and no
  legal wording was transcribed from video pixels. If approved legal guidance calls for an HTML safety
  disclosure, render the approved text independently.

To clear this: Vanderhall documents written publication rights for the master and confirms whether the
burned-in warning is required; both records land wherever the other rights records live, and this entry is
updated to point at them.

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
