// Four rungs, not three. The 640 to 960 jump made a mid-density phone fetch 960 for a slot that
// needed roughly 700, so an 800 rung cuts the over-fetch without touching WebP q80.
// The rung list is a parameter because one delivery cannot fill it. Every source here is wide enough
// for 1280 except the Brawley chassis crop, which is a tight window on a 1640px frame, and this
// project does not upscale. Declaring the shorter srcset here is what keeps the page from asking for
// a rung the pipeline never wrote: check-links would fail the build if it did.
const FEATURE_WIDTHS = [640, 800, 960, 1280];
const feature = (root, name, widths = FEATURE_WIDTHS) => ({
  src: `${root}/${name}-${widths.includes(960) ? 960 : widths.at(-1)}.webp`,
  srcset: widths.map((width) => `${root}/${name}-${width}.webp ${width}w`).join(", "),
});

// V8: a photo module is one photograph, a label in the caps register, and the specification group
// that photograph shows. The prose descriptions are gone: they described where the vehicle was
// parked, which is the weakest copy the site had, and verified figures are better content in the
// same space. Every group must be paired with exactly one photograph, and the checks below throw
// at import time rather than letting a page ship with an orphaned group.
const modules = (root, specGroups, entries) => {
  const byName = new Map(specGroups.map((group) => [group.name, group]));
  return entries.map(([name, label, alt, groupName = null, widths = FEATURE_WIDTHS]) => {
    if (groupName === null) return { ...feature(root, name, widths), label, alt, specs: null };
    const group = byName.get(groupName);
    if (!group) throw new Error(`${root}/${name}: no specification group named "${groupName}"`);
    return { ...feature(root, name, widths), label, alt, specs: group };
  });
};

// Completeness is checked per model rather than per modules() call, because Brawley draws its
// photographs from two image roots and each call can only see its own batch. Run over the whole
// module list, every group must be claimed exactly once.
const assertPairings = (model) => {
  const counts = new Map(model.specGroups.map((group) => [group.name, 0]));
  for (const item of model.images.modules) {
    if (!item.specs) continue;
    counts.set(item.specs.name, (counts.get(item.specs.name) ?? 0) + 1);
  }
  for (const [name, count] of counts) {
    if (count === 0) throw new Error(`${model.slug}: specification group "${name}" is paired with no photograph`);
    if (count > 1) throw new Error(`${model.slug}: specification group "${name}" is paired with ${count} photographs`);
  }
};

const VENICE_FEATURES = "/assets/images/v2/features/venice";
const CARMEL_FEATURES = "/assets/images/v2/features/carmel";
const SANTAROSA_FEATURES = "/assets/images/v2/features/santarosa";
const BRAWLEY_LIFESTYLE = "/assets/images/brawley/lifestyle";
const BRAWLEY_FEATURES = "/assets/images/v2/features/brawley";

// Published verbatim from the live vanderhallusa.com Brawley GTS page, read 2026-08-05 and
// approved by Owen the same day. Model pages publish figures now, so the estimate sentence rides
// on all of them rather than on the purchase page alone.
export const SPEC_DISCLAIMER = "Features and specifications are estimated and subject to change without notice.";

// Brawley GTS purchase page. The price, the three paint tiers, and the disclosure blocks were
// read from the live vanderhallusa.com configurator on 2026-08-05 and approved by Owen in chat
// the same day, which is the first price this site has ever published. Every performance figure
// below is already carried by the Brawley specification table, so nothing new is asserted here.
// Swatch values are the sampled hex values this viewer shipped with in V3.
const WALKAROUND_ROOT = "/assets/images/brawley/walkaround";
const WALKAROUND_WIDTHS = [960, 1600];

// Rotation order, not alphabetical: this is the sequence a camera walks around the vehicle, and
// getting it wrong is what makes a turntable read as broken.
const WALKAROUND_ANGLES = [
  ["front", "front view"],
  ["front-side-driver", "front three-quarter from the driver side"],
  ["side", "driver side profile"],
  ["side-rear-driver", "rear three-quarter from the driver side"],
  ["rear", "rear view"],
  ["side-rear-passenger", "rear three-quarter from the passenger side"],
  ["side-reverse", "passenger side profile"],
  ["front-side-passenger", "front three-quarter from the passenger side"],
];

const PAINT_TIERS = {
  standard: { label: "Standard", price: "$0" },
  specialty: { label: "Specialty", price: "$750" },
  metallic: { label: "Metallic", price: "$1,050" },
};

// Jean Grey has four of the eight studio angles on disk, so it ships as one still frame and the
// viewer says so, rather than rotating through gaps. Concrete Grey is not offered by Vanderhall
// and is not delivered at all.
const PAINT = [
  ["Ivory White", "ivory-white", "#afaca7", "standard"],
  ["Obsidian Black", "obsidian-black", "#202328", "standard"],
  ["Royal Blue", "royal-blue", "#22456f", "standard"],
  ["Ida Rose", "ida-rose", "#701212", "standard"],
  ["Bosco Blue", "bosco-blue", "#017be0", "specialty"],
  ["Atomic Green", "atomic-green", "#8cbe27", "specialty"],
  ["Rossa", "rossa", "#da0602", "specialty"],
  ["Jean Grey", "jean-grey", "#696969", "specialty", "front"],
  ["Emerald Green Metallic", "emerald-green", "#6f954c", "metallic"],
];

const frameSrcset = (slug, angle) => WALKAROUND_WIDTHS
  .map((width) => `${WALKAROUND_ROOT}/${slug}/${angle}-${width}.webp`)
  .map((src, index) => `${src} ${WALKAROUND_WIDTHS[index]}w`)
  .join(", ");

const paint = PAINT.map(([name, slug, hex, tier, stillAngle = null]) => ({
  name,
  slug,
  hex,
  tier,
  tierLabel: PAINT_TIERS[tier].label,
  tierPrice: PAINT_TIERS[tier].price,
  complete: !stillAngle,
  // Every frame URL is written into the page so the build can see it. That makes the HTML the one
  // source for both the viewer and the orphan-image check, instead of a path template the
  // checker cannot follow.
  frames: stillAngle ? [frameSrcset(slug, stillAngle)] : WALKAROUND_ANGLES.map(([angle]) => frameSrcset(slug, angle)),
}));

// ---------------------------------------------------------------------------------------------
// Specification groups. V8 drops metric: every row is a single value now. Vanderhall's own
// feature pages carry broken conversions (Santarosa's wheelbase reads "101.4 in. (365 cm)"), so
// maintaining a second unit system would mean deriving it here, which is exactly the kind of
// invented figure this project refuses to publish.
//
// Every row carries its source. Where a row is not from Vanderhall, the comment says so.
//
// V11-C rewrites the shape of these groups without touching a single figure. Owen, on 2026-08-05,
// looking at the Brawley page: "Some of them only have two, some of them have eight, so how can we
// even them out? I'll have four to five." Two mechanisms answer that, and both are constrained:
//
// 1. COMPOUND VALUES ARE SPLIT INTO LABELLED ROWS. Owen approved this on 2026-08-05 (Q-V11-2). The
//    values stay verbatim fragments of already-approved copy and only the first letter of a fragment
//    is capitalised; the labels are ours. Nothing is invented, converted, or re-derived. Brawley's
//    "Lighting" was one row carrying three facts and is now three rows; the same is true of its
//    "Protection" and its shock row, and of Venice's climate row. Rows marked SPLIT below name the
//    approved row they came out of, so the original is always recoverable from this file.
//    A short label over a short value reads as a specification. A short label over a 20-word
//    sentence reads as a paragraph with a heading, which is what the premium treatment in site.css
//    would otherwise have made worse rather than better.
//
// 2. ROWS MOVED TO THE PHOTOGRAPH THAT SHOWS THEM. The V8 rule is unchanged and assertPairings still
//    enforces it: one group per photograph, no orphans, no double claims. What moved, moved because
//    the frame was checked. The clearest case: Brawley's tail lights sat in a group paired with the
//    head-on photograph, where no tail light is visible. The desert frame is a rear three-quarter and
//    shows both of them, so that is where the row went. Several others followed the same check.
//
// Result: every module that carries figures carries 4 to 6 of them instead of 1 to 9. The two
// deliberate deviations from four-to-five are stated in the V11 plan, section 4.2: Santarosa
// publishes 28 verified rows across five photographs and no other page publishes them, so the
// choice is five or six per module or deleting verified figures; and Carmel has 15 rows for six
// photographs, so three go label-only rather than being padded with content that does not exist.
// ---------------------------------------------------------------------------------------------

// Brawley. Rows without a source note were verified in V1 and are unchanged. Rows marked LIVE
// were read from vanderhallusa.com/brawley-gts-features-electric-ev-off-road-utv-side-by-side-vehicles/
// on 2026-08-05, a page which restates every V1 figure identically. Vanderhall's trademark
// symbols are dropped, matching the house style applied to the approved V1 copy.
const BRAWLEY_SPECS = [
  {
    // Paired with the head-on photograph on the two-track, which shows the halo headlights, the
    // roof-mounted light bar, the front skid plate and the roll cage through the windscreen. The
    // tail lights that used to sit in this group are not visible from the front and have moved to
    // the rear three-quarter frame below.
    name: "Lighting and protection",
    rows: [
      // SPLIT from the LIVE row "Lighting": "7 in high-performance LED halo headlights with
      // ultra-bright tail lights and a 32 in 5000 lumen LED lightbar".
      { label: "Headlights", value: "7 in high-performance LED halo" },
      { label: "Light bar", value: "32 in 5000 lumen LED" },
      // SPLIT from "Protection": "Front and rear removable skid plates, full roll cage, 4-point
      // harness safety belts".
      { label: "Skid plates", value: "Front and rear removable" },
      { label: "Roll cage", value: "Full" },
      { label: "Safety belts", value: "4-point harness" },
    ],
  },
  {
    // Paired with the desert photograph, a rear three-quarter: the tail lights, the white hard roof,
    // the rear skid plate and the receiver are all in this frame, and it is the one shot that gives
    // the whole vehicle's proportions.
    name: "Dimensions and capability",
    rows: [
      // SPLIT from the LIVE "Lighting" row. Moved here from the head-on frame, where no tail light
      // is visible, to the frame that shows both of them.
      { label: "Tail lights", value: "Ultra-bright" },
      { label: "Roof", value: "Full hard roof with fixed moonroof" }, // LIVE
      { label: "Estimated dry weight", value: "3,700 lb" }, // LIVE
      { label: "Length, width, height", value: "147.5 x 76 x 69.5 in" }, // LIVE
      { label: "Storage capacity", value: "5.1 sq ft" }, // LIVE
      { label: "Towing capacity", value: "1,500 lb, 300 lb tongue weight, front and rear 2 in receiver" }, // LIVE, extends the V1 row
    ],
  },
  {
    // The juniper photograph: the whole vehicle at rest, which is the page's signature frame and the
    // right place for the figures that describe what it is rather than what it is made of.
    name: "Output and powertrain",
    rows: [
      { label: "Range", value: "Up to 140 mi" },
      { label: "Torque", value: "488 lb-ft" },
      { label: "Power", value: "283 to 404 hp" },
      { label: "Motors", value: "Quad-electric with integrated cooling system" }, // LIVE
      { label: "Battery", value: "Lithium-ion battery pack" }, // LIVE
    ],
  },
  {
    name: "Cabin",
    rows: [
      { label: "Seating capacity", value: "4" },
      { label: "Gauges", value: "Twin-gauge display with digital inset screen" }, // LIVE
      { label: "Instrumentation", value: "USB A charging ports" }, // LIVE
      { label: "Climate control", value: "Heating, cooling, ventilation speed, circulation, and defrost" }, // LIVE
      { label: "Seats", value: "Heated with integrated 4-point harness" }, // LIVE
      { label: "Sound system", value: "Multi-channel amp Bluetooth" }, // LIVE
    ],
  },
  {
    // The control-arm close-up. It shows the arms, the coil-overs and the reservoir directly, and it
    // is the frame that shows how far the body sits off the ground, so the chassis construction and
    // the clearance figure moved here from the whole-vehicle group.
    name: "Chassis and suspension",
    rows: [
      { label: "Chassis", value: "Aluminum unibody construction" }, // LIVE
      { label: "Front and rear suspension", value: "Stamped steel control arms" }, // LIVE
      // SPLIT from the LIVE row "Shocks": "21 in travel with cooling reservoir and gas bump stop".
      // The travel figure is also the one the GTS figure band publishes, word for word.
      { label: "Suspension travel", value: "21 in" },
      { label: "Shocks", value: "Cooling reservoir and gas bump stop" },
      { label: "Ground clearance", value: "18 in" }, // LIVE
      // The distance between the axles is a chassis figure and this is the frame that shows an axle.
      { label: "Wheelbase", value: "112.5 in" }, // LIVE
    ],
  },
  {
    // The wheel and tire close-up. Drivetrain and drive modes moved here from the powertrain group:
    // this is the frame about how the vehicle puts power down, and every one of these rows is about
    // the corner in the photograph.
    name: "Wheels, tires, and drive",
    rows: [
      { label: "Drivetrain", value: "4-wheel drive with traction control" }, // LIVE
      { label: "Drive modes", value: "4x2, 4x4, eCrawl, eCrab, eSteer" },
      { label: "Tires", value: "Atlas Paraller M/T 35x12.50R18LT" }, // LIVE
      { label: "Wheels", value: "18x8 in aluminum" }, // LIVE
      { label: "Brakes", value: "Regenerative braking with 200 mm in-board discs and ceramic pads" }, // LIVE
    ],
  },
];

// Santarosa. LIVE rows read from vanderhallusa.com/santarosa-features-3-wheel-ev-electric-autocycle/
// on 2026-08-05. Two rows on that page are deliberately absent here: the wiper system and the
// removable capshade both carry a triple-asterisk footnote whose meaning is not stated anywhere
// readable, and a row whose qualifier is unknown could turn optional equipment into standard.
// The optional range row is kept because its own label states the condition.
//
// V11-C rebalances the nine-row chassis group across the frames that show it and fixes one pairing
// that was plainly wrong: the lighting row, which describes headlights, tail lights and a third
// brake light, sat in the cabin group paired with the dashboard close-up. It now sits with the
// street photograph, where the vehicle's lights are in frame. No value is split here. The one
// compound row that invites it, the lighting row, cannot be split cleanly: "and a third brake light"
// has no value of its own to carry, and inventing one is exactly what this file refuses to do.
const SANTAROSA_SPECS = [
  {
    // The street photograph, a full side view on cobblestones.
    name: "Chassis and lighting",
    rows: [
      { label: "Drivetrain", value: "Front-wheel drive with traction control" }, // LIVE
      { label: "Front suspension", value: "Cast aluminum double wishbone" }, // LIVE
      { label: "Rear suspension", value: "Cast aluminum trailing arm" }, // LIVE
      { label: "Shocks", value: "Coil-over adjustable" }, // LIVE
      { label: "Parking brake", value: "Electric auto-setting" }, // LIVE
      { label: "Lighting", value: "7 in high-performance LED halo headlights with ultra-bright tail lights and a third brake light" }, // LIVE
    ],
  },
  {
    // The mountain turnout, the whole vehicle at rest.
    name: "Output and range",
    rows: [
      { label: "Standard range", value: "150 mi" },
      { label: "Optional range", value: "300 mi" }, // LIVE
      { label: "Torque", value: "216 lb-ft" },
      { label: "Power", value: "180 hp" },
      { label: "Motors", value: "Twin-electric with integrated cooling system" }, // LIVE
      { label: "Battery", value: "Lithium-ion battery pack" }, // LIVE
    ],
  },
  {
    name: "Dimensions and weight",
    rows: [
      { label: "Curb weight", value: "1,539 to 1,749 lb" }, // LIVE
      { label: "Chassis", value: "Aluminum unibody" }, // LIVE
      { label: "Length, width, height", value: "143 x 68.9 x 50.2 in" }, // LIVE
      { label: "Wheelbase", value: "101.4 in" }, // LIVE
      { label: "Ground clearance", value: "4.9 in" }, // LIVE
      { label: "Storage capacity", value: "5.1 sq ft" }, // LIVE
    ],
  },
  {
    // The overhead frame, which is the one photograph on the site that shows all three wheels at
    // once, so it is the right home for the wheels, the tires and the brakes behind them.
    name: "Wheels, tires, and brakes",
    rows: [
      { label: "Front tires", value: "Atlas Force UHP 225/35R19" }, // LIVE
      { label: "Rear tires", value: "Atlas Force UHP 295/30R19" }, // LIVE
      { label: "Front wheels", value: "19x8 in aluminum" }, // LIVE
      { label: "Rear wheels", value: "19x11 in aluminum" }, // LIVE
      { label: "Brakes", value: "Adaptive regenerative braking with 200 mm in-board high-temp stainless rotors and ceramic pads" }, // LIVE
    ],
  },
  {
    name: "Cabin",
    rows: [
      { label: "Gauges", value: "Twin-gauge display with digital inset screen" }, // LIVE
      { label: "Instrumentation", value: "USB A charging ports" }, // LIVE
      { label: "Seats", value: "Heated manual reclining" }, // LIVE
      { label: "Seat belts", value: "Driver and passenger 3-point" }, // LIVE
      { label: "Sound system", value: "Multi-channel amp Bluetooth" }, // LIVE
    ],
  },
];

// Carmel, a past model. Source: the Vanderhall Carmel infocard Owen supplied on 2026-08-05,
// vanderhallusa.com/wp-content/uploads/2019/02/carmel-infocard-1.pdf, plus the dimensions from
// Vanderhall's own specs-menu-carmel.pdf. These figures describe the 2019 Carmel, which is why
// the page states that.
//
// Power is flagged: Vanderhall's 2020 Carmel line sheet publishes 194 hp for this same 1.5 liter
// engine. Owen chose the infocard's 200 hp on 2026-08-05. Settling it is on the Vanderhall list.
//
// Not published from those documents: the MSRP (only /brawley/gts/ may carry a price, and a past
// model's old price would mislead), the fuel capacity (the source row is mislabeled "DISPLACEMENT
// 10 Gallons" and cannot be published either way), and the performance claims, which the source
// footnotes with "Verification of these results should not be attempted".
//
// V11-C: 15 verified rows will not fill six photographs at four rows each, and padding them would
// mean inventing content. So Carmel publishes three groups of five and three photographs carry their
// label alone, which is the pattern Venice has used since V8 and which V8's own comment calls
// deliberate rather than unfinished. The six one-row and two-row groups are gone; nothing else is.
const CARMEL_SPECS = [
  {
    // The beach photograph, a three-quarter view: both doors and all three wheels are in frame.
    name: "Body, wheels, and tires",
    rows: [
      { label: "Doors", value: "Dual front entry doors with expanded interior width" },
      { label: "Front tires", value: "235/35 ZR19" },
      { label: "Rear tire", value: "275/35 ZR19" },
      { label: "Front wheels", value: "19x8.5 aluminum" },
      { label: "Rear wheel", value: "19x11 aluminum" },
    ],
  },
  {
    // The causeway side profile, which is the frame that shows the vehicle's length and stance.
    name: "Chassis and dimensions",
    rows: [
      { label: "Front suspension", value: "Pushrod front coil over" },
      { label: "Rear suspension", value: "Rear single-sided swing arm coil over" },
      { label: "Steering", value: "Electric power steering" },
      { label: "Length, width, height", value: "147 x 70 x 45 in" }, // specs-menu-carmel.pdf
      { label: "Curb weight", value: "1,595 lb" },
    ],
  },
  {
    // The cockpit: the gauges that read the engine's output and the toggle switches that are the
    // climate controls are both in this one frame, which is what makes it the honest home for both.
    name: "Powertrain and comfort",
    rows: [
      { label: "Engine", value: "1.5 L 4-cylinder turbo" },
      { label: "Power", value: "200 hp" },
      { label: "Torque", value: "203 lb-ft" },
      { label: "Transmission", value: "6-speed" },
      { label: "Climate control", value: "Heating control module, heated seats" },
    ],
  },
];

// Venice, a past model. Rows are from Vanderhall's own 2020-Venice-GT-infocard.pdf unless noted:
// LINE means the 2020 Venice line comparison sheet, MANUAL means the Venice owner's manual in
// this project's library, and CRUISER means the Motorcycle Cruiser 2020 Venice GT review Owen
// supplied on 2026-08-05. The two CRUISER rows are third-party and are the only ones on this
// site that are: no Vanderhall document states a Venice wheelbase or a brake specification.
//
// These figures describe the 2020 Venice GT, which is why the page states that. Venice ran across
// many model years with two different engines (Vanderhall's 2018 menu publishes 180 hp from a 1.4
// liter), so an unqualified figure set would be false about most Venices built.
//
// Not published: the $33,950 price (one-price rule), the review's 8.5 gal fuel capacity (the
// manufacturer's own manual says 9), the review's 1,465 lb claimed curb weight (mixing a
// third-party curb weight with a first-party dry weight invites a false comparison), torque, 0 to
// 60, and top speed (Vanderhall publishes those only for the earlier 1.4 liter car), and the
// interior material (the infocard says Tan V-Tex, the line sheet says Tan Leather, and two
// first-party sources disagreeing means neither ships).
const VENICE_SPECS = [
  {
    name: "Powertrain and capacities",
    rows: [
      { label: "Engine", value: "1.5 L turbocharged" },
      { label: "Power", value: "194 hp" }, // LINE
      { label: "Transmission", value: "6-speed automatic with bump shifter" },
      { label: "Fuel capacity", value: "9 gal" }, // MANUAL, capacities and specifications section
      { label: "Dry weight", value: "1,390 lb" },
    ],
  },
  {
    name: "Chassis and suspension",
    rows: [
      { label: "Frame", value: "Aluminum" },
      { label: "Body", value: "Composite" },
      { label: "Front suspension", value: "Pushrod, coil-over hydraulic shocks" },
      { label: "Rear suspension", value: "Single-sided swingarm, coil-over hydraulic shock" },
      { label: "Wheelbase", value: "100.2 in" }, // CRUISER, third-party
    ],
  },
  {
    name: "Wheels, tires, and brakes",
    rows: [
      { label: "Front tires", value: "225/40-18" },
      { label: "Rear tire", value: "285/30-18" },
      { label: "Front wheels", value: "18x8.5" },
      { label: "Rear wheel", value: "18x10.5" },
      { label: "Front brakes", value: "1-piston calipers, 296 mm discs" }, // CRUISER, third-party
      { label: "Rear brake", value: "1-piston caliper, 278 mm disc" }, // CRUISER, third-party
    ],
  },
  {
    // Paired with the seats photograph, which carries the wood-rimmed steering wheel as well as the
    // upholstery. That is why the steering row moved here from the chassis group: this is the frame
    // that shows it. Two rows became four without a new fact between them.
    name: "Comfort and controls",
    rows: [
      // SPLIT from the approved row "Climate control": "Heat, heated seats".
      { label: "Climate control", value: "Heat" },
      { label: "Seats", value: "Heated" },
      { label: "Sound system", value: "Bluetooth" },
      { label: "Steering", value: "Rack-and-pinion, electronic assist" },
    ],
  },
];

const brawleyGts = {
  name: "Brawley GTS",
  descriptor: "Quad-motor electric off-road UTV. Hand-built in Provo, Utah.",
  reserveUrl: "https://dealer.vanderhallusa.com/reserve/index/brawley",
  price: { label: "MSRP", value: "$49,950" },
  delivery: "Now delivering in select regions.",
  angles: WALKAROUND_ANGLES,
  tiers: ["standard", "specialty", "metallic"].map((key) => ({ key, ...PAINT_TIERS[key] })),
  paint,
  defaultPaint: "obsidian-black",
  figures: [
    { label: "POWER", value: "283 to 404 hp" },
    { label: "TORQUE", value: "488 lb-ft" },
    { label: "RANGE", value: "Up to 140 mi" },
    { label: "SUSPENSION TRAVEL", value: "21 in" },
  ],
  scene: { name: "desert", label: "OPEN DESERT", alt: "Brawley on packed sand under a clear sky" },
  priceDisclaimer: "Manufacturer's Suggested Retail Price. Excludes options; taxes; title; registration; delivery, processing and handling fee; dealer charges.",
  specDisclaimer: SPEC_DISCLAIMER,
  // Verbatim from the live vanderhallusa.com Brawley GTS page, read 2026-08-05. Safety and legal
  // language is never paraphrased, reordered, or condensed.
  //
  // Known conflict, recorded in work/missing-data-inventory.md and unresolved: Vanderhall's
  // Brawley features page says a driver must be at least 16 years old, while this page, the one
  // that was sourced and approved, says 18. The approved text stands unchanged until Vanderhall
  // settles which is correct. A minimum age is not something to resolve by choosing.
  safety: [
    "The Brawley is an off-road, electric vehicle not intended for on-road use and can be hazardous to operate. Driver must be at least 18 years old with a valid driver's license to operate.",
    "Some states may require additional training and certification. Riders should always wear helmets, eye protection, and footwear. Ride within your limits and never do stunt driving.",
    "Never ride under the influence of alcohol or drugs. All riders should take a safety training course. Vanderhall and Brawley are registered trademarks and the property of Vanderhall Motor Works, Inc. or its affiliates.",
    "Refer to the relevant owner's manual and all safety warnings before driving or riding.",
  ],
};

export const models = [
  {
    slug: "brawley",
    name: "Brawley",
    powertrain: { fuel: "electric", layout: "4x4" },
    descriptor: "Quad-motor electric off-road UTV.",
    // Brawley is the one model with somewhere further to go than the inquiry form, so its hero
    // and model bar point at the purchase page instead. The other three keep Request info.
    cta: { label: "Pricing and colors", href: "/brawley/gts/" },
    gts: brawleyGts,
    // Warranty rides in the page's disclosure line rather than as a paired row: it belongs with
    // the estimate sentence, and no photograph shows a warranty. Read from the live feature page
    // 2026-08-05; the entity was verified in V1.
    warranty: "6-month Vanderhall limited warranty. 36-month battery pack warranty. Warranty entity: Vanderhall North America, LLC (Vanderhall NA).",
    summary: "Quad-motor electric off-road UTV with seating for four, 488 lb-ft of torque, and up to 140 mi of range.",
    intro: "Quad-motor electric off-road UTV with a seating capacity of four. Published output spans 283 to 404 hp with 488 lb-ft of torque, up to 140 mi of range, and 21 in of suspension travel.",
    specGroups: BRAWLEY_SPECS,
    images: {
      focal: "50% 55%",
      hero: "/assets/images/v3/heroes/brawley/brawley-wide-1920.webp",
      heroSrcset: "/assets/images/v3/heroes/brawley/brawley-wide-960.webp 960w, /assets/images/v3/heroes/brawley/brawley-wide-1280.webp 1280w, /assets/images/v3/heroes/brawley/brawley-wide-1920.webp 1920w, /assets/images/v3/heroes/brawley/brawley-wide-2560.webp 2560w",
      heroTallSrcset: "/assets/images/v3/heroes/brawley/brawley-tall-480.webp 480w, /assets/images/v3/heroes/brawley/brawley-tall-720.webp 720w, /assets/images/v3/heroes/brawley/brawley-tall-800.webp 800w, /assets/images/v3/heroes/brawley/brawley-tall-960.webp 960w",
      heroAlt: "Red and white Vanderhall Brawley parked among desert rock formations",
      lead: { ...feature(BRAWLEY_LIFESTYLE, "juniper"), alt: "Green Vanderhall Brawley beneath a juniper with snow-dusted peaks behind" },
      support: [
        { ...feature(BRAWLEY_LIFESTYLE, "mountain-road"), alt: "White Vanderhall Brawley climbing a gravel two-track" },
        { ...feature(BRAWLEY_LIFESTYLE, "interior"), alt: "Vanderhall Brawley cabin with steering wheel and gauges" },
      ],
      modules: [
        ...modules(BRAWLEY_LIFESTYLE, BRAWLEY_SPECS, [
          ["mountain-road", "STRAIGHT ON", "Brawley climbing a gravel two-track through scrub", "Lighting and protection"],
          ["desert", "OPEN DESERT", "Brawley on packed sand under a clear sky", "Dimensions and capability"],
          ["juniper", "UNDER THE JUNIPER", "Brawley parked in dry grassland beneath a juniper", "Output and powertrain"],
          ["interior", "THE CABIN", "Brawley cabin with steering wheel, gauges, and embossed seat backs", "Cabin"],
          // V11 amendment. This replaces the legacy control-arm close-up, which showed a used vehicle
          // with dried mud packed into the arms. Owen, on the live page: "the stuff is dirty." The
          // replacement is the same hardware clean, and it is a better pairing besides: the skid
          // plate, both lower control arms, the coil-over shocks and the ride height are all in one
          // frame, where the old photograph showed the arms alone. Three rungs, not four, because the
          // source is 1640px wide and the window is tight; see FEATURE_WIDTHS above.
          ["chassis", "OFF THE GROUND", "Brawley front skid plate, lower control arms, and coil-over shocks between deep-tread tires", "Chassis and suspension", [640, 800, 960]],
        ]),
        ...modules(BRAWLEY_FEATURES, BRAWLEY_SPECS, [
          ["wheel", "WHEEL AND TIRE", "Brawley satin black wheel and mud-terrain tire", "Wheels, tires, and drive"],
        ]),
      ],
    },
  },
  {
    slug: "santarosa",
    name: "Santarosa",
    powertrain: { fuel: "electric", layout: "3-wheel" },
    descriptor: "Three-wheel electric autocycle.",
    warranty: "1-year Vanderhall limited warranty. 36-month battery pack warranty.",
    summary: "Three-wheel electric autocycle. Twin motors drive the front wheels, with 180 hp and a published standard range of 150 mi.",
    intro: "Three-wheel electric autocycle. Twin motors drive the front wheels and produce 180 hp and 216 lb-ft, with a published standard range of 150 mi.",
    specGroups: SANTAROSA_SPECS,
    images: {
      focal: "34% 49%",
      hero: "/assets/images/v3/heroes/santarosa/santarosa-wide-1920.webp",
      heroSrcset: "/assets/images/v3/heroes/santarosa/santarosa-wide-960.webp 960w, /assets/images/v3/heroes/santarosa/santarosa-wide-1280.webp 1280w, /assets/images/v3/heroes/santarosa/santarosa-wide-1920.webp 1920w, /assets/images/v3/heroes/santarosa/santarosa-wide-2560.webp 2560w",
      heroTallSrcset: "/assets/images/v3/heroes/santarosa/santarosa-tall-480.webp 480w, /assets/images/v3/heroes/santarosa/santarosa-tall-720.webp 720w, /assets/images/v3/heroes/santarosa/santarosa-tall-800.webp 800w, /assets/images/v3/heroes/santarosa/santarosa-tall-960.webp 960w",
      heroAlt: "Blue Vanderhall Santarosa parked in an aircraft hangar",
      heroAlign: "end",
      lead: { ...feature(SANTAROSA_FEATURES, "sunset"), alt: "Red Vanderhall Santarosa at a mountain turnout at sunset" },
      support: [
        { ...feature(SANTAROSA_FEATURES, "street"), alt: "Santarosa on a cobblestone street" },
        { ...feature(SANTAROSA_FEATURES, "top-view"), alt: "Santarosa seen from above" },
      ],
      modules: modules(SANTAROSA_FEATURES, SANTAROSA_SPECS, [
        ["street", "COBBLESTONES", "Santarosa on a cobblestone street outside a coffee shop", "Chassis and lighting"],
        ["sunset", "MOUNTAIN TURNOUT", "Santarosa at a mountain turnout with the sun low behind it", "Output and range"],
        ["city", "ROOFTOP AT DUSK", "Santarosa with a hard roof on a rooftop deck at dusk", "Dimensions and weight"],
        ["top-view", "FROM ABOVE", "Santarosa seen from above on a concrete floor", "Wheels, tires, and brakes"],
        ["dashboard", "THE FASCIA", "Santarosa fascia with chrome vents and script", "Cabin"],
      ]),
    },
  },
  {
    slug: "carmel",
    name: "Carmel",
    powertrain: { fuel: "gas", layout: "3-wheel" },
    descriptor: "Three-wheel gas roadster.",
    pastModel: true,
    // Stated on the page because the figures describe one model year. Source documents and the
    // reasoning are in the CARMEL_SPECS comment above.
    specNote: "Specifications shown are for the 2019 Carmel.",
    summary: "Open two-seat gas roadster on three wheels, shown here in red with a tan interior.",
    intro: "Open two-seat gas roadster on three wheels. The photographs show red bodywork, a leather-wrapped three-spoke wheel, four analog gauges, and tan contrast-stitched seats.",
    specGroups: CARMEL_SPECS,
    images: {
      focal: "52% 60%",
      hero: "/assets/images/v2/heroes/carmel/carmel-wide-1920.webp",
      heroSrcset: "/assets/images/v2/heroes/carmel/carmel-wide-960.webp 960w, /assets/images/v2/heroes/carmel/carmel-wide-1280.webp 1280w, /assets/images/v2/heroes/carmel/carmel-wide-1920.webp 1920w",
      heroTallSrcset: "/assets/images/v2/heroes/carmel/carmel-tall-480.webp 480w, /assets/images/v2/heroes/carmel/carmel-tall-720.webp 720w, /assets/images/v2/heroes/carmel/carmel-tall-800.webp 800w, /assets/images/v2/heroes/carmel/carmel-tall-960.webp 960w",
      heroAlt: "Red Vanderhall Carmel at sunset",
      lead: { ...feature(CARMEL_FEATURES, "beach-reflection"), alt: "Red Vanderhall Carmel on damp sand at first light" },
      support: [
        { ...feature(CARMEL_FEATURES, "dashboard"), alt: "Carmel dashboard and analog gauges" },
        { ...feature(CARMEL_FEATURES, "lake-reflection"), alt: "Carmel side profile on a causeway between two sheets of water" },
      ],
      // Three photographs carry figures and three carry their label alone. See the CARMEL_SPECS
      // comment: 15 verified rows cannot fill six modules at four, and the alternative to a
      // label-only frame is an invented one.
      modules: modules(CARMEL_FEATURES, CARMEL_SPECS, [
        ["beach-reflection", "ON THE SAND", "Carmel on damp sand with its reflection in a tidal pool", "Body, wheels, and tires"],
        ["lake-reflection", "STILL WATER", "Carmel side profile on a causeway between two sheets of water", "Chassis and dimensions"],
        ["downtown", "AFTER DARK", "Carmel on wet paving at night"],
        ["dashboard", "THE COCKPIT", "Carmel steering wheel, gauges, and toggle switches", "Powertrain and comfort"],
        ["seats", "TAN LEATHER", "Carmel tan contrast-stitched seats from above"],
        ["shifter", "SHIFT BALL", "Carmel shift knob and drilled alloy pedal"],
      ]),
    },
  },
  {
    slug: "venice",
    name: "Venice",
    powertrain: { fuel: "gas", layout: "3-wheel" },
    descriptor: "Three-wheel gas roadster.",
    pastModel: true,
    specNote: "Specifications shown are for the 2020 Venice GT.",
    // Homepage section: one line. Vehicles page: the same line plus one more.
    summary: "Open two-seat gas roadster on three wheels, shown here in silver over black.",
    intro: "Open two-seat gas roadster on three wheels. The photographs show polished silver bodywork over a black lower body, a wood-rimmed steering wheel, and tan leather seats.",
    specGroups: VENICE_SPECS,
    images: {
      focal: "45% 55%",
      hero: "/assets/images/v2/heroes/venice/venice-wide-1920.webp",
      heroSrcset: "/assets/images/v2/heroes/venice/venice-wide-960.webp 960w, /assets/images/v2/heroes/venice/venice-wide-1280.webp 1280w, /assets/images/v2/heroes/venice/venice-wide-1920.webp 1920w, /assets/images/v2/heroes/venice/venice-wide-2560.webp 2560w",
      heroTallSrcset: "/assets/images/v2/heroes/venice/venice-tall-480.webp 480w, /assets/images/v2/heroes/venice/venice-tall-720.webp 720w, /assets/images/v2/heroes/venice/venice-tall-800.webp 800w, /assets/images/v2/heroes/venice/venice-tall-960.webp 960w",
      heroAlt: "Silver Vanderhall Venice side view with motion light streaks",
      // The lead frame is shared by the homepage and the vehicles page, and is never the model
      // page hero, so every click forward shows the visitor a photograph they have not seen.
      lead: { ...feature(VENICE_FEATURES, "seaside"), alt: "Silver Vanderhall Venice side profile by the sea" },
      support: [
        { ...feature(VENICE_FEATURES, "forest-road"), alt: "Venice on a forest road" },
        { ...feature(VENICE_FEATURES, "seats"), alt: "Venice seats in tan leather" },
      ],
      // Two interior details stay label-only: Venice has four specification groups and six
      // photographs, and a detail photograph carrying its label alone reads as deliberate.
      modules: modules(VENICE_FEATURES, VENICE_SPECS, [
        ["forest-road", "FOREST ROAD", "Venice on a forest road at sunrise", "Chassis and suspension"],
        ["mountain-lake", "AT THE LAKE", "Venice parked beside an alpine lake", "Wheels, tires, and brakes"],
        ["motion", "ON THE MOVE", "Venice photographed in motion under an underpass", "Powertrain and capacities"],
        ["seats", "TWO SEATS", "Venice tan leather seats and wood-rimmed steering wheel", "Comfort and controls"],
        ["speedometer", "ONE DIAL", "Venice analog speedometer set into tan leather"],
        ["steering-wheel", "WOOD AND ALUMINUM", "Venice four-spoke steering wheel with a wooden rim"],
      ]),
    },
  },
];

models.forEach(assertPairings);

export const modelBySlug = Object.fromEntries(models.map((model) => [model.slug, model]));
