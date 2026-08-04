# Internal missing-data inventory

Status: current as of the V4 simplification pass, 2026-08-04.

This file is the internal record of information the public site does not have. It is the
replacement for the visible MISSING gates that V1 to V3 rendered on the live site. The
public site now omits anything unverified rather than advertising the gap. Nothing in this
file renders anywhere on the website.

Rule that governs every row: do not invent, infer, or approximate. A page ships without the
component until the required source arrives.

## Pricing

| Item | Affected routes | Required source |
|---|---|---|
| From MSRP for Venice, Carmel, Santarosa, Brawley | `/`, `/vehicles/`, all four model pages | Vanderhall current pricing, in writing. Press figures are stale and were never usable. |
| Price disclaimer language | anywhere a price would appear | Legal-approved disclaimer text. Two drafts exist in `Plans/V1-design-system.md` section 5.9 and both need review. |
| Reservation language for Santarosa | `/santarosa/` | Legal-approved reservation wording, if reservations are still the intended step. |

Effect on the site: no price component exists anywhere. The Santarosa RESERVATION STAGE and
Brawley NOW DELIVERING chips remain because both are verified status facts, not prices.

## Specifications

| Item | Affected routes | Required source |
|---|---|---|
| Venice and Carmel specifications (power, torque, 0 to 60, weight, dimensions) | `/venice/`, `/carmel/` | Vanderhall spec sheets as text. Nothing verified exists today. |
| Curb weight for all four vehicles | all four model pages | Vanderhall engineering data. |
| Remainder of the Santarosa and Brawley spec tables (chassis, wheels, brakes, interior, technology) | `/santarosa/`, `/brawley/` | Vanderhall spec sheets as text. |
| Colorway mapping and paint values per model and trim | all four model pages | Which colorways apply to which vehicle and trim, plus paint chips or sampled values. |

Effect on the site: Venice and Carmel ship with no specification section at all. Santarosa
and Brawley show only the rows that are verified, with no note about what is absent.

## Dealers

| Item | Affected routes | Required source |
|---|---|---|
| Dealer directory (names, addresses, phones, hours) | `/dealers/`, `/contact/` | An approved current dealer export. The legacy 71-record snapshot is reconciliation material, not production data. |
| Dealer routing rules for inbound requests | `/contact/` | How a submitted request should reach the right dealer. |

Effect on the site: `/dealers/` is a short honest page that explains Vanderhall sells
through dealers and routes visitors to the contact form, plus the two dealer business
forms. There is no ZIP search, no dealer list, and no empty dealer component. The contact
form no longer asks the visitor to choose a dealer, because there is no list to choose from.

## Forms

| Item | Affected routes | Required source |
|---|---|---|
| Submission destination for Request Info | `/contact/` | Endpoint, recipient, and field mapping. `FORM_ENDPOINTS` in `src/data/forms.mjs` stays null until then. |
| Submission destination for Recommend a Dealer | `/recommend-dealer/` | Same. |
| Submission destination for International Dealer Inquiry | `/dealer-inquiry/` | Same. |
| Email and SMS consent language | `/contact/` | Legal-approved consent wording. |
| Success copy and response-time commitment | all three forms | Approved copy plus whatever response time Vanderhall will stand behind. |
| Submitter confirmation email | all three forms | Whether one is sent, and its copy. |
| Final spam protection | all three forms | Decided together with the endpoint platform. The honeypot and render-timestamp checks are in place already. |

Effect on the site: all three forms are complete, labeled, and keyboard operable, and each
carries one plain sentence saying it is not connected yet. The consent checkbox is removed
rather than shown with placeholder legal text. No endpoint gate blocks are rendered.

## Legal and safety

| Item | Affected routes | Required source |
|---|---|---|
| Site-wide safety boilerplate (helmet, seatbelt, training) | `/brawley/` and any vehicle page | Legal-approved language. The V3 site shipped a helmet and training notice that was never approved; V4 removed it. This is the highest-priority item on this list for a vehicle site. |
| Licensing and endorsement guidance | `/faq/` | Legal-approved answer on helmet requirements and motorcycle endorsements. |
| Privacy policy, terms, accessibility statement | footer | Approved documents. No footer links to them exist today. |

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
homepage), and the homepage carries no company narrative section. Company facts that are
verified (founded 2010 by Steve Hall, headquarters and manufacturing in Provo, Utah, Laguna
production from 2016) appear on `/faq/` and in the homepage hero copy.

## Deferred by decision, not missing

- The 102 service manuals: public exposure needs explicit Vanderhall approval.
- The 10 Brawley ride-guide videos and 43 gallery videos: need re-encoding, poster frames,
  and a hosting decision.
- Legacy accessory catalogs: research material only.
- Brawley walkaround viewer: removed in V4 to match the other model pages. The 8-angle
  studio matrix still exists in `Assets/Brawley Icons/` if it is ever wanted back.
