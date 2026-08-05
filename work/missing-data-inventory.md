# Internal missing-data inventory

Status: current as of the V5 refinement pass, 2026-08-04.

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

| Item | Affected routes | Required source |
|---|---|---|
| Venice and Carmel specifications (power, torque, 0 to 60, weight, dimensions) | `/venice/`, `/carmel/` | Vanderhall spec sheets as text. Nothing verified exists today. |
| Curb weight for all four vehicles | all four model pages | Vanderhall engineering data. |
| Remainder of the Santarosa and Brawley spec tables (chassis, wheels, brakes, interior, technology) | `/santarosa/`, `/brawley/` | Vanderhall spec sheets as text. |
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

Owen confirmed on 2026-08-04 that losing the five FAQ answers is acceptable.

## Media that must not be used

| File | Problem |
|---|---|
| `Assets/Legacy Website Selection/Santarosa/santarosa-action-winding-road.jpg` | Appears to carry a tiled stock-agency watermark across the sky. Not delivered anywhere. Must not be used until rights are confirmed. |

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
