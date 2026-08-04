const missingStats = {
  power: null,
  weight: null,
  signature: null,
};

const brawleyAngles = [
  "front",
  "front-side-driver",
  "side",
  "side-rear-driver",
  "rear",
  "side-rear-passenger",
  "side-reverse",
  "front-side-passenger",
];

const completeBrawleyColorways = [
  ["Atomic Green", "atomic-green", "#8cbe27"],
  ["Bosco Blue", "bosco-blue", "#017be0"],
  ["Emerald Green Metallic", "emerald-green", "#6f954c"],
  ["Ida Rose", "ida-rose", "#701212"],
  ["Ivory White", "ivory-white", "#afaca7"],
  ["Obsidian Black", "obsidian-black", "#202328"],
  ["Rossa", "rossa", "#da0602"],
  ["Royal Blue", "royal-blue", "#22456f"],
];

const partialBrawleyColorways = [
  ["Jean Grey", "jean-grey", "#696969", "front-side-driver"],
  ["Concrete Grey", "concrete-grey", "#7c8a8d", "side"],
];

export const brawleyColorways = [
  ...completeBrawleyColorways.map(([name, slug, swatch]) => ({
    name,
    slug,
    swatch,
    complete: true,
    frames: Object.fromEntries(
      brawleyAngles.map((angle) => [angle, `/assets/images/brawley/walkaround/${slug}/${angle}.webp`]),
    ),
  })),
  ...partialBrawleyColorways.map(([name, slug, swatch, stillAngle]) => ({
    name,
    slug,
    swatch,
    complete: false,
    still: `/assets/images/brawley/walkaround/${slug}/${stillAngle}.webp`,
    frames: null,
  })),
];

export const models = [
  {
    slug: "venice",
    name: "Venice",
    powertrain: { fuel: "gas", layout: "3-wheel" },
    descriptor: "Three-wheel gas roadster.",
    fromPriceUsd: null,
    status: null,
    stats: missingStats,
    overallLengthMm: null,
    colorways: [],
    specGroups: [],
    images: {},
    verifiedStatement: "Venice is a three-wheel gas roadster.",
  },
  {
    slug: "carmel",
    name: "Carmel",
    powertrain: { fuel: "gas", layout: "3-wheel" },
    descriptor: "Three-wheel gas roadster.",
    fromPriceUsd: null,
    status: null,
    stats: missingStats,
    overallLengthMm: null,
    colorways: [],
    specGroups: [],
    images: {},
    verifiedStatement: "Carmel is a three-wheel gas roadster.",
  },
  {
    slug: "santarosa",
    name: "Santarosa",
    powertrain: { fuel: "electric", layout: "3-wheel" },
    descriptor: "Three-wheel electric autocycle.",
    fromPriceUsd: null,
    status: "reserve",
    stats: {
      power: { value: "180", unit: "hp" },
      weight: null,
      signature: { label: "Range", value: "150", unit: "mi", qualifier: "Standard range" },
    },
    overallLengthMm: null,
    colorways: [],
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
    images: {},
    verifiedStatement: "Santarosa pairs twin-motor front-wheel drive with a published standard range of 150 mi.",
  },
  {
    slug: "brawley",
    name: "Brawley",
    powertrain: { fuel: "electric", layout: "4x4" },
    descriptor: "Quad-motor electric off-road UTV.",
    fromPriceUsd: null,
    status: "delivering",
    stats: {
      power: { value: "404", unit: "hp", qualifier: "Maximum verified output" },
      weight: null,
      signature: { label: "Torque", value: "488", unit: "lb-ft" },
    },
    overallLengthMm: null,
    colorways: brawleyColorways,
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
        name: "Chassis & suspension",
        rows: [{ label: "Suspension travel", imp: "21 in", met: "533 mm" }],
      },
      {
        name: "Dimensions & weight",
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
      hero: "/assets/images/brawley/lifestyle/easter-sunset-1600.webp",
      heroSmall: "/assets/images/brawley/lifestyle/easter-sunset-960.webp",
      heroLarge: "/assets/images/brawley/lifestyle/easter-sunset-2400.webp",
      heroTall: "/assets/images/brawley/lifestyle/easter-sunset-tall-480.webp",
      heroTallMedium: "/assets/images/brawley/lifestyle/easter-sunset-tall-960.webp",
      heroTallLarge: "/assets/images/brawley/lifestyle/easter-sunset-tall-1440.webp",
      desert: "/assets/images/brawley/lifestyle/desert-1280.webp",
      interior: "/assets/images/brawley/lifestyle/interior-1280.webp",
      offRoad: "/assets/images/brawley/lifestyle/off-road-1280.webp",
      mountainRoad: "/assets/images/brawley/lifestyle/mountain-road-1280.webp",
      mountain: "/assets/images/brawley/lifestyle/mountain-1280.webp",
      juniper: "/assets/images/brawley/lifestyle/juniper-1280.webp",
      steering: "/assets/images/brawley/lifestyle/steering-1280.webp",
      cutout: "/assets/images/brawley/walkaround/ivory-white/side.webp",
    },
    verifiedStatement: "Four motors, four seats, and up to 140 mi of published range.",
  },
];

export const modelBySlug = Object.fromEntries(models.map((model) => [model.slug, model]));
