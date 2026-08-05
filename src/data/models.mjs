// Four rungs, not three. The 640 to 960 jump made a mid-density phone fetch 960 for a slot that
// needed roughly 700, so an 800 rung cuts the over-fetch without touching WebP q80.
const feature = (root, name) => ({
  src: `${root}/${name}-960.webp`,
  srcset: [640, 800, 960, 1280].map((width) => `${root}/${name}-${width}.webp ${width}w`).join(", "),
});

// A photo module is one photograph with a label in the caps register and one or two sentences
// written from what the photograph shows. Labels and descriptions are Owen-approved copy.
const modules = (root, entries) => entries.map(([name, label, description, alt]) => ({
  ...feature(root, name),
  label,
  description,
  alt,
}));

const VENICE_FEATURES = "/assets/images/v2/features/venice";
const CARMEL_FEATURES = "/assets/images/v2/features/carmel";
const SANTAROSA_FEATURES = "/assets/images/v2/features/santarosa";
const BRAWLEY_LIFESTYLE = "/assets/images/brawley/lifestyle";
const BRAWLEY_FEATURES = "/assets/images/v2/features/brawley";

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
    { label: "POWER", imp: "283 to 404 hp", met: "211 to 301 kW" },
    { label: "TORQUE", imp: "488 lb-ft", met: "661 Nm" },
    { label: "RANGE", imp: "Up to 140 mi", met: "Up to 225 km" },
    { label: "SUSPENSION TRAVEL", imp: "21 in", met: "533 mm" },
  ],
  scene: { name: "desert", label: "OPEN DESERT", alt: "Brawley on packed sand under a clear sky" },
  priceDisclaimer: "Manufacturer's Suggested Retail Price. Excludes options; taxes; title; registration; delivery, processing and handling fee; dealer charges.",
  specDisclaimer: "Features and specifications are estimated and subject to change without notice.",
  // Verbatim from the live vanderhallusa.com Brawley GTS page, read 2026-08-05. Safety and legal
  // language is never paraphrased, reordered, or condensed.
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
    status: "delivering",
    // Brawley is the one model with somewhere further to go than the inquiry form, so its hero
    // and model bar point at the purchase page instead. The other three keep Request info.
    cta: { label: "See more info", href: "/brawley/gts/" },
    gts: brawleyGts,
    overview: "Brawley is a quad-motor electric off-road UTV with a seating capacity of four. Published output spans 283 to 404 hp with 488 lb-ft of torque and up to 140 mi of range.",
    summary: "Quad-motor electric off-road UTV with seating for four, 488 lb-ft of torque, and up to 140 mi of range.",
    intro: "Quad-motor electric off-road UTV with a seating capacity of four. Published output spans 283 to 404 hp with 488 lb-ft of torque, up to 140 mi of range, and 21 in of suspension travel.",
    specGroups: [
      {
        name: "Powertrain",
        rows: [
          { label: "Power", imp: "283 to 404 hp", met: "211 to 301 kW" },
          { label: "Torque", imp: "488 lb-ft", met: "661 Nm" },
          { label: "Drive", value: "Quad-motor 4WD" },
          { label: "Drive modes", value: "4x2, 4x4, eCrawl, eCrab, eSteer" },
        ],
      },
      {
        name: "Performance",
        rows: [{ label: "Range", imp: "Up to 140 mi", met: "Up to 225 km" }],
      },
      {
        name: "Chassis and suspension",
        rows: [{ label: "Suspension travel", imp: "21 in", met: "533 mm" }],
      },
      {
        name: "Dimensions and weight",
        rows: [
          { label: "Seating capacity", value: "4" },
          { label: "Towing capacity", imp: "1,500 lb", met: "680 kg" },
        ],
      },
      {
        name: "Warranty",
        rows: [
          { label: "Off-road limited warranty", value: "6 months" },
          { label: "Warranty entity", value: "Vanderhall North America, LLC (Vanderhall NA)" },
        ],
      },
    ],
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
        ...modules(BRAWLEY_LIFESTYLE, [
          ["mountain-road", "STRAIGHT ON", "Head on, climbing a gravel two-track through oak and juniper scrub, with a full-width light bar above the windshield.", "Brawley climbing a gravel two-track through scrub"],
          ["desert", "OPEN DESERT", "Rear three-quarter on packed sand under a clear sky, on knobby all-terrain tires with the rear coil-overs in plain sight.", "Brawley on packed sand under a clear sky"],
          ["juniper", "UNDER THE JUNIPER", "Parked in dry grassland with the low sun flaring through a juniper branch and snow-dusted peaks on the horizon.", "Brawley parked in dry grassland beneath a juniper"],
          ["interior", "THE CABIN", "A black cabin with a three-spoke wheel, two round gauges, a tinted glass roof panel, and seat backs embossed with the V shield.", "Brawley cabin with steering wheel, gauges, and embossed seat backs"],
        ]),
        ...modules(BRAWLEY_FEATURES, [
          ["suspension", "CONTROL ARMS", "Bare control arms and coil-over dampers behind the wheel, still carrying dried mud.", "Brawley control arms and coil-over dampers"],
          ["wheel", "WHEEL AND TIRE", "A satin black wheel carrying the Vanderhall Motor Works name across its face, a V shield center cap, and a mud-terrain tire.", "Brawley satin black wheel and mud-terrain tire"],
        ]),
      ],
    },
  },
  {
    slug: "santarosa",
    name: "Santarosa",
    powertrain: { fuel: "electric", layout: "3-wheel" },
    descriptor: "Three-wheel electric autocycle.",
    status: "reserve",
    overview: "Santarosa is a three-wheel electric autocycle. Twin-motor front-wheel drive produces 180 hp, with a published standard range of 150 mi.",
    summary: "Three-wheel electric autocycle. Twin motors drive the front wheels, with 180 hp and a published standard range of 150 mi.",
    intro: "Three-wheel electric autocycle. Twin motors drive the front wheels and produce 180 hp and 216 lb-ft, with a published standard range of 150 mi.",
    specGroups: [
      {
        name: "Powertrain",
        rows: [
          { label: "Power", imp: "180 hp", met: "134 kW" },
          { label: "Torque", imp: "216 lb-ft", met: "293 Nm" },
          { label: "Drive", value: "Twin-motor front-wheel drive" },
        ],
      },
      {
        name: "Performance",
        rows: [{ label: "Standard range", imp: "150 mi", met: "241 km" }],
      },
    ],
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
      modules: modules(SANTAROSA_FEATURES, [
        ["street", "COBBLESTONES", "Front three-quarter on a cobblestone street outside a coffee shop, in pearl white over charcoal with a tan interior.", "Santarosa on a cobblestone street outside a coffee shop"],
        ["sunset", "MOUNTAIN TURNOUT", "Parked at a turnout above layered ridges with the sun low behind it, in red over charcoal, two roll hoops standing behind the cockpit.", "Santarosa at a mountain turnout with the sun low behind it"],
        ["city", "ROOFTOP AT DUSK", "Rear three-quarter on a wet rooftop deck at blue hour, fitted with a hard roof, a lit skyline behind.", "Santarosa with a hard roof on a rooftop deck at dusk"],
        ["top-view", "FROM ABOVE", "Overhead on a concrete floor: a long creased hood, two quilted seats side by side, and a covered spare wheel carried at the left front.", "Santarosa seen from above on a concrete floor"],
        ["dashboard", "THE FASCIA", "A woven carbon-look fascia with two knurled chrome vents, a chrome Santarosa script, and a painted rail beneath it.", "Santarosa fascia with chrome vents and script"],
      ]),
    },
  },
  {
    slug: "carmel",
    name: "Carmel",
    powertrain: { fuel: "gas", layout: "3-wheel" },
    descriptor: "Three-wheel gas roadster.",
    status: null,
    overview: "Carmel is an open three-wheel gas roadster. Vanderhall builds it in Provo, Utah.",
    summary: "Open two-seat gas roadster on three wheels, shown here in red with a tan interior.",
    intro: "Open two-seat gas roadster on three wheels. The photographs show red bodywork, a leather-wrapped three-spoke wheel, four analog gauges, and tan contrast-stitched seats.",
    specGroups: [],
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
      modules: modules(CARMEL_FEATURES, [
        ["beach-reflection", "ON THE SAND", "Rear three-quarter on damp sand at first light, doubled in a tidal pool alongside it.", "Carmel on damp sand with its reflection in a tidal pool"],
        ["lake-reflection", "STILL WATER", "Side profile on a causeway between two flat sheets of water, with blue ridges layered behind.", "Carmel side profile on a causeway between two sheets of water"],
        ["downtown", "AFTER DARK", "Rear three-quarter on wet paving at night, the lit signage behind it thrown out of focus.", "Carmel on wet paving at night"],
        ["dashboard", "THE COCKPIT", "A leather-wrapped three-spoke wheel, four analog gauges, and a row of chrome toggle switches.", "Carmel steering wheel, gauges, and toggle switches"],
        ["seats", "TAN LEATHER", "Two contrast-stitched seats and matching door panels, seen from above.", "Carmel tan contrast-stitched seats from above"],
        ["shifter", "SHIFT BALL", "A black shift knob on a stitched leather boot, with a drilled alloy pedal alongside it.", "Carmel shift knob and drilled alloy pedal"],
      ]),
    },
  },
  {
    slug: "venice",
    name: "Venice",
    powertrain: { fuel: "gas", layout: "3-wheel" },
    descriptor: "Three-wheel gas roadster.",
    status: null,
    overview: "Venice is an open three-wheel gas roadster. Vanderhall builds it in Provo, Utah.",
    // Homepage section: one line. Vehicles page: the same line plus one more.
    summary: "Open two-seat gas roadster on three wheels, shown here in silver over black.",
    intro: "Open two-seat gas roadster on three wheels. The photographs show polished silver bodywork over a black lower body, a wood-rimmed steering wheel, and tan leather seats.",
    specGroups: [],
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
      modules: modules(VENICE_FEATURES, [
        ["forest-road", "FOREST ROAD", "Front three-quarter on a road cut through spruce, with the sun coming through the trees behind.", "Venice on a forest road at sunrise"],
        ["mountain-lake", "AT THE LAKE", "Parked on gravel beside a split-rail fence, an alpine lake and a snow-capped ridge behind it.", "Venice parked beside an alpine lake"],
        ["motion", "ON THE MOVE", "Photographed under a concrete underpass with the camera panning, which draws the overhead lights into streaks.", "Venice photographed in motion under an underpass"],
        ["seats", "TWO SEATS", "Tan leather seats with black belts, a wood-rimmed wheel, and a chrome shift ball between them.", "Venice tan leather seats and wood-rimmed steering wheel"],
        ["speedometer", "ONE DIAL", "A single analog speedometer set into tan leather, with the Vanderhall name printed on the face.", "Venice analog speedometer set into tan leather"],
        ["steering-wheel", "WOOD AND ALUMINUM", "A four-spoke wheel with a wooden rim, polished spokes, and a Venice horn button at the center.", "Venice four-spoke steering wheel with a wooden rim"],
      ]),
    },
  },
];

export const modelBySlug = Object.fromEntries(models.map((model) => [model.slug, model]));
