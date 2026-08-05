# Internal missing-data inventory

Status: current as of V8, 2026-08-05.

## Resolved in V8

**Specifications for all four models.** Every model page now publishes figures, paired with the
photographs that show them. Sources, per model:

| Model | Source | Note |
|---|---|---|
| Brawley | Existing V1-verified data, extended from `vanderhallusa.com/brawley-gts-features-...`, read 2026-08-05 | The live page restates every V1 figure identically, which independently confirms the V1 data |
| Santarosa | Existing V1-verified data, extended from `vanderhallusa.com/santarosa-features-...`, read 2026-08-05 | |
| Carmel | Vanderhall's Carmel infocard, `wp-content/uploads/2019/02/carmel-infocard-1.pdf`, supplied by Owen, plus dimensions from their `specs-menu-carmel.pdf` | Describes the 2019 Carmel, stated on the page |
| Venice | Vanderhall's `2020-Venice-GT-infocard.pdf`, their 2020 line sheet, and the owner's manual already in this library | Describes the 2020 Venice GT, stated on the page. Two rows, wheelbase and brakes, come from the Motorcycle Cruiser review Owen approved, because no Vanderhall document states either |

Every page that publishes figures now also carries the manufacturer's estimate sentence, and the
two past models state which model year their figures describe. That qualifier is a correctness
requirement, not decoration: Venice ran with two different engines across its life, so an
unqualified figure set would be false about most Venices built.

**Production status.** Owen confirmed in chat on 2026-08-05 that Venice and Carmel are past models
and that Brawley and Santarosa are current and selling. The two past models carry a "Past model"
tag on their cards and page heroes. This closes the row that had been open since V4 deleted the
status chips.

**Warranty for the current models.** Brawley: 6-month limited, 36-month battery. Santarosa:
1-year limited, 36-month battery. Both read from the live feature pages, 2026-08-05. The past
models publish no warranty, deliberately.

## Opened in V8: two conflicts inside Vanderhall's own material

| Conflict | Detail | Why it is not resolved here |
|---|---|---|
| Brawley minimum driver age | Their Brawley features page says a driver must be at least **16**. Their Brawley GTS page, which this site quotes verbatim under D-V6-1, says at least **18**. | A minimum age is a safety requirement and is not something to settle by choosing the more convenient number. The approved 18 text stands unchanged until Vanderhall says which is correct. |
| Carmel horsepower | The 2019 infocard says **200 hp** with 203 lb-ft. Their 2020 Carmel line sheet says **194 hp** for the same 1.5 liter engine. | Owen chose the infocard figure on 2026-08-05. Both numbers are recorded in the data comment so the choice is visible, and the question is on the Vanderhall list. |

## Found in V8: a corpus of Vanderhall spec documents nobody had catalogued

Vanderhall's media library serves **18 infocard PDFs and 17 specification sheets** covering Venice,
Carmel, Speedster, and their trim lines, dated 2018 to 2020. No page on their current site links
any of them; they are orphaned uploads still served at their direct URLs. None of this project's
four prior audits recorded them, because each audit walked the page tree rather than the media
library. The V3 note that "current Venice and Carmel specification pages could not be recovered"
was drawn from the page tree and is superseded.

Two defects to know about if these are cited again: the line sheets are headed "MRSP", a typo for
MSRP, and `specs-menu-carmel.pdf` labels its fuel capacity row "DISPLACEMENT 10 Gallons". The
Carmel fuel capacity is unpublished for exactly that reason.

There is **no** infocard or specification sheet for Santarosa or Brawley. The whole PDF program
ended in March 2020, before either launched. What those two have instead is specification content
baked into images on their live pages, plus the HTML tables this version read.

## Still missing after V8

| Item | Affected routes | Required source |
|---|---|---|
| Venice torque, 0 to 60, top speed, curb weight | `/venice/` | Vanderhall figures for the 1.5 liter car. The only ones they publish describe the earlier 1.4 liter 180 hp Venice and would be wrong beside a 194 hp engine. |
| Venice interior material | `/venice/` | Their GT infocard says Tan V-Tex and their line sheet says Tan Leather for the same trim. Two first-party sources disagree, so neither ships. |
| Carmel fuel capacity | `/carmel/` | A correctly labeled figure. See the mislabeled source row above. |
| Santarosa wiper system and removable capshade | `/santarosa/` | What the triple-asterisk footnote on their features page means. A row whose qualifier is unknown could turn optional equipment into standard. |
| A Santarosa owner's manual | `/owners/` | The library holds 19 manuals covering Venice, Carmel, Brawley, Speedster, and Laguna. There is no Santarosa manual. Ask whether one exists. |
| Speedster and Laguna photography | `/owners/` | No photograph of either retired roadster exists in `Assets/`, so their groups stay typographic. The concept named Speedster is a different vehicle and must not stand in for it. |

---

Earlier status, retained for history: current as of the V5 refinement pass, 2026-08-04.

This file is the internal record of information the public site does not have. It is the
replacement for the visible MISSING gates that V1 to V3 rendered on the live site. The
public site now omits anything unverified rather than advertising the gap. Nothing in this
file renders anywhere on the website.

Rule that governs every row: do not invent, infer, or approximate. A page ships without the
component until the required source arrives.

## Pricing

| Item | Affected routes | Required source |
|---|---|---|
| From MSRP for Venice, Carmel, Santarosa | `/`, `/vehicles/`, those three model pages | Vanderhall current pricing, in writing. Press figures are stale and were never usable. |
| Reservation language for Santarosa | `/santarosa/` | Legal-approved reservation wording, if reservations are still the intended step. |
| Paint tier pricing for models other than Brawley GTS | the other three model pages | Vanderhall's current tier structure per model. |

Resolved in V6, on `/brawley/gts/` only:

| Item | Value published | Source |
|---|---|---|
| Brawley GTS MSRP | `$49,950` | vanderhallusa.com Brawley GTS configurator, read 2026-08-05, approved by Owen in chat the same day |
| Brawley GTS paint tiers | Standard `$0`, Specialty `$750`, Metallic `$1,050` | Same page and approval. Tier membership was read from the live configurator's own grouping. |
| Price disclaimer language | The manufacturer's own sentence, verbatim | Same page and approval. This replaces the two unreviewed drafts in `Plans/V1-design-system.md` section 5.9, which are now superseded and should not be used. |

Effect on the site: exactly one route publishes a price. A build check fails if a dollar
amount appears on any other page, or if any amount other than those four appears on
`/brawley/gts/`. The other three vehicles still ship with no price component of any kind.

## Specifications

Superseded by the V8 section at the top of this file. The three rows below were resolved there and
are kept so the history reads straight.

| Item | Affected routes | Status |
|---|---|---|
| ~~Venice and Carmel specifications~~ | `/venice/`, `/carmel/` | RESOLVED in V8 from Vanderhall's own infocards and line sheets, plus two third-party rows on Venice. Curb weight for Venice is still open; Carmel publishes 1,595 lb. |
| Curb weight for Venice | `/venice/` | Still open. Their 2020 documents give dry weight only. |
| ~~Remainder of the Santarosa and Brawley spec tables~~ | `/santarosa/`, `/brawley/` | RESOLVED in V8 from their live feature pages: suspension, wheels, tires, brakes, dimensions, wheelbase, ground clearance, storage, cabin equipment, and warranty. |
| Colorway mapping and paint values for Venice, Carmel, Santarosa | those three model pages | Which colorways apply to which vehicle and trim, plus paint chips or sampled values. Brawley GTS is resolved: nine colors ship on `/brawley/gts/` with sampled swatch values and studio frames. |
| The four missing Jean Grey studio angles | `/brawley/gts/` | A studio shoot covering side, side-rear-driver, side-rear-passenger, and rear in Jean Grey. Until then that color is shown as a single still and the viewer says so. |
| Whether Concrete Grey is still offered | `/brawley/gts/` | Vanderhall's current color list. It has studio frames for the four angles Jean Grey lacks but no page on the current Vanderhall site, so V6 does not ship it. |

Effect on the site: Venice and Carmel ship with no specification section at all. Santarosa
and Brawley show only the rows that are verified, with no note about what is absent.

## Dealers

| Item | Affected routes | Required source |
|---|---|---|
| Dealer directory (names, addresses, phones, hours) | `/dealers/` | An approved current dealer export. The legacy 71-record snapshot is reconciliation material, not production data. |
| Dealer routing rules for inbound requests | `/dealers/` | How a submitted request should reach the right dealer. |

Effect on the site: `/dealers/` explains that Vanderhall sells through dealers and now
carries the single Request Info form itself, plus links to the two dealer business forms.
There is no ZIP search, no dealer list, and no empty dealer component. The form does not ask
the visitor to choose a dealer, because there is no list to choose from.

## Forms

| Item | Affected routes | Required source |
|---|---|---|
| Submission destination for Request Info | `/dealers/` | Endpoint, recipient, and field mapping. `FORM_ENDPOINTS` in `src/data/forms.mjs` stays null until then. |
| Submission destination for Recommend a Dealer | `/recommend-dealer/` | Same. |
| Submission destination for International Dealer Inquiry | `/dealer-inquiry/` | Same. |
| Email and SMS consent language | `/dealers/` | Legal-approved consent wording. |
| Success copy and response-time commitment | all three forms | Approved copy plus whatever response time Vanderhall will stand behind. |
| Submitter confirmation email | all three forms | Whether one is sent, and its copy. |
| Final spam protection | all three forms | Decided together with the endpoint platform. The honeypot and render-timestamp checks are in place already. |

Effect on the site: all three forms are complete, labeled, and keyboard operable, and each
carries one plain sentence saying it is not connected yet. The consent checkbox is removed
rather than shown with placeholder legal text. No endpoint gate blocks are rendered.

## Legal and safety

| Item | Affected routes | Required source |
|---|---|---|
| Safety notice for Venice, Carmel, and Santarosa | those three model pages | Vanderhall's own safety language for those vehicles. The Brawley notice is specific to an off-road vehicle and must not be copied across. Now the highest-priority item on this list. |
| Licensing and endorsement guidance | no public home since V5 retired `/faq/` | Legal-approved answer on helmet requirements and motorcycle endorsements. |
| Privacy policy, terms, accessibility statement | footer | Approved documents. No footer links to them exist today. |

Resolved in V6, on `/brawley/gts/` only: the off-road safety notice, published verbatim in four
paragraphs as the manufacturer writes it on vanderhallusa.com, read 2026-08-05 and approved by
Owen in chat the same day. This closes the gap that had been the highest-priority row on this
list since V4 removed an unapproved version. It is published only where it was sourced.

| Media provenance | Note |
|---|---|
| `Assets/Brawley Icons` studio set | 74 frames, no rights manifest, predating the V2 curation and its `candidate - verify rights` labeling. Owen approved use for V6 on the basis that these are Vanderhall's own studio renders and the same frames the current Vanderhall site serves on its own configurator. Worth a written confirmation from Vanderhall alongside the rest of the media library. |

## Brand and media

| Item | Affected routes | Required source |
|---|---|---|
| Provo factory photography | homepage, any company section | Approved factory images. |
| Steve Hall portrait and approved founder biography | any company section | Approved portrait plus copy. |
| Manufacturing process photography and copy | any company section | Approved images plus verified process copy. |
| Three brand-level numbers | homepage | Verified figures (for example years in production, models, units built). |
| Studio side-profile cutouts for all four vehicles | vehicle cards | The shoot specified in `Plans/V1-design-system.md` section 7.2. Photographic cards are used instead and work well. |
| Night or dusk photography for Venice, Carmel, Santarosa | model pages | Approved images. |

Effect on the site: the About page is removed entirely (`/about/` redirects to the
homepage), and the homepage carries no company narrative section. Of the verified company
facts, only Provo as the place of manufacture and 2010 as a continuity date still appear
publicly, both in the homepage hero copy. The rest moved to the section below when V5
retired `/faq/`.

## Verified facts no longer published

These are not missing. Each was verified and was published on the live site until V5 retired
the page or component that carried it. They are recorded here so a later version can restore
them deliberately instead of rediscovering them.

| Fact | Where it used to appear | Why it left |
|---|---|---|
| Steve Hall founded Vanderhall | `/faq/` | The only occurrence of the name anywhere in `src/`. The site now says "built by Vanderhall since 2010" and names no founder. |
| Vanderhall was founded in 2010 | `/faq/` | "Founded in 2010" is now "since 2010" in the hero, which is a continuity claim rather than a founding claim. |
| The Laguna entered production in 2016 | `/faq/` | Nothing else on the site states this. Laguna survives only as a 2016 owner's manual row on `/owners/`. |
| Provo is the headquarters | `/faq/` | The site elsewhere says hand-built in Provo, which is manufacturing. Only the FAQ called it headquarters. |
| Brawley is now delivering | Republished in V6 | Appears on `/brawley/gts/` as "Now delivering in select regions.", the manufacturer's own wording, read from the live site 2026-08-05. |
| Santarosa is at reservation stage | vehicle card status chip | Same. Note the reservation wording itself was never legally approved, which is a separate open item under Pricing. |
| Vanderhall has built vehicles since 2010 | homepage hero, until V9 | V9 replaced the Provo and since-2010 hero with Owen's own copy, so 2010 is no longer visible text anywhere on the site. The `foundingDate` field left `organizationSchema()` with it, because this project's rule is that structured data may only restate what a visitor can read. A build check now fails if either returns. |
| Provo as the place of manufacture, in the hero | homepage hero, until V9 | Provo itself is NOT lost: the footer's "Hand-built in Provo, Utah." line appears on every page, and `/vehicles/` and the Brawley GTS copy still say it. That footer line is what keeps the schema's Provo address legitimate, so a check asserts it on all 23 pages. |

Owen confirmed on 2026-08-04 that losing the five FAQ answers is acceptable.

## Media that must not be used

| File | Problem |
|---|---|
| `Assets/Legacy Website Selection/Santarosa/santarosa-action-winding-road.jpg` | Appears to carry a tiled stock-agency watermark across the sky. Not delivered anywhere. Must not be used until rights are confirmed. |

## Studio frames keyed onto the dark page. NEW, from V9

V9 made the site dark only, which turned the studio backdrop into a problem: 130 delivered
walkaround frames were photographed on white, and a white rectangle behind a vehicle on a dark page
is a plate. They are now keyed onto the page paper (`#0E0E10`) by
`scripts/lib/key-studio-frame.mjs`, and the nine concept hub cards are keyed the same way.

This is a derived image, so its provenance matters. What the keying does and does not do:

- It never deletes and never introduces an alpha channel. Backdrop pixels are multiplied by their own
  luminance against the paper, so pure white lands exactly on the paper and the contact shadow becomes
  a darker pool, which is what a shadow does. Nothing is invented and no pixel of the vehicle is
  repainted.
- The backdrop is identified by connectivity to the frame edge, not by color, because every one of the
  130 frames has a roof at exactly `rgb(255,255,255)`, pixel identical to the backdrop behind it. A
  key by color alone punches a hole through the roof on all nine paint colors.
- Every frame passes an automated gate before delivery: its vehicle ink box must sit within 24px of
  the per-angle median measured across all nine colors, no keyed region may be enclosed above the
  vehicle's midline, and the vehicle region must exceed a million pixels. Measured worst cases across
  the set were 13px of drift and zero enclosed regions. A color that fails ships all eight of its
  angles on the white stage instead, and `assets/build-manifest.json` records which happened per file.
  No color needed the fallback.

**Vanderhall's original renders with an alpha channel would make this obsolete.** That ask is on the
visit list (section C, item 6). If they arrive, delete the keying rather than keep both.

**Known residual, concept detail slides.** The sheet-style concept slides had their white canvas keyed
too, which removed the plate. What remains on some of them is white studio floor enclosed under the
vehicle, which the border-seeded pass cannot reach because the shadow ring seals it off. On the hub
cards this was solved with the full studio keying; on the composite slides it is not, because those
slides put dark render panels beside light ones and a bright region there is sometimes real content: a
sunlit window in the Brawley R interior render measures 89 percent pure white, and the enclosed floor
beside it measures 87 percent, so no threshold separates them. Choosing between them is a design call,
not a measurement. Affected: `brawley-r/gallery-1`, `coachella/gallery-1`, `coachella/gallery-2`,
`indio/gallery-1`, `laduna/gallery-1`, `yuma/gallery-1`, `balboa/gallery-1`.

## Baked disclaimer text in source photography

Thirteen source photographs carry the legacy helmet and training paragraph burned into their
pixels. V4 removed that paragraph from the site as unapproved legal language but six delivered
photographs still shipped it as pixels, on four pages including Brawley itself, while the build
manifest recorded `verified_clean: yes` for all six.

V5 fixed this. `scripts/process-images.mjs` now holds the measured band for each affected
source in `BAKED_TEXT_BANDS`, every delivered crop is checked against that band, and
`verified_clean` is derived from whether the delivered window excludes it rather than asserted.
`clean_basis` in `assets/build-manifest.json` records the arithmetic per file, and
`scripts/check-content.mjs` fails the build if any delivered crop overlaps a band or if a
corrected delivery stops recording its derivation. If a new placement needs one of these
sources, give it an explicit extract window; do not trust the flag without the basis.

## Deferred by decision, not missing

- The 102 service manuals: public exposure needs explicit Vanderhall approval.
- The 10 Brawley ride-guide videos and 43 gallery videos: need re-encoding, poster frames,
  and a hosting decision.
- Legacy accessory catalogs: research material only.
- Brawley walkaround viewer: removed in V4 to match the other model pages. The 8-angle
  studio matrix still exists in `Assets/Brawley Icons/` if it is ever wanted back.
