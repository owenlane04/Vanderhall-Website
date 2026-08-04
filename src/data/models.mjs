const gallery = (root, entries) => entries.map(([name, alt]) => ({
  src: `${root}/${name}-960.webp`,
  srcset: `${root}/${name}-640.webp 640w, ${root}/${name}-960.webp 960w, ${root}/${name}-1280.webp 1280w`,
  alt,
}));

export const models = [
  {
    slug: "venice",
    name: "Venice",
    powertrain: { fuel: "gas", layout: "3-wheel" },
    descriptor: "Three-wheel gas roadster.",
    status: null,
    overview: "Venice is an open three-wheel gas roadster. Vanderhall builds it in Provo, Utah.",
    specGroups: [],
    images: {
      focal: "45% 55%",
      hero: "/assets/images/v2/heroes/venice/venice-wide-1920.webp",
      heroSrcset: "/assets/images/v2/heroes/venice/venice-wide-960.webp 960w, /assets/images/v2/heroes/venice/venice-wide-1280.webp 1280w, /assets/images/v2/heroes/venice/venice-wide-1920.webp 1920w, /assets/images/v2/heroes/venice/venice-wide-2560.webp 2560w",
      heroTallSrcset: "/assets/images/v2/heroes/venice/venice-tall-480.webp 480w, /assets/images/v2/heroes/venice/venice-tall-720.webp 720w, /assets/images/v2/heroes/venice/venice-tall-960.webp 960w",
      heroAlt: "Silver Vanderhall Venice side view with motion light streaks",
      card: "/assets/images/v2/cards/venice/venice-800.webp",
      cardSrcset: "/assets/images/v2/cards/venice/venice-500.webp 500w, /assets/images/v2/cards/venice/venice-800.webp 800w",
      cardFocal: "50% 55%",
      cardAlt: "Silver Vanderhall Venice side profile by the sea",
      gallery: gallery("/assets/images/v2/features/venice", [
        ["motion", "Venice driving through a tunnel"],
        ["forest-road", "Venice on a forest road"],
        ["mountain-lake", "Venice parked at a mountain lake"],
        ["seats", "Venice seats in white and tan"],
        ["speedometer", "Venice speedometer detail"],
        ["steering-wheel", "Venice steering wheel detail"],
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
    specGroups: [],
    images: {
      focal: "52% 60%",
      hero: "/assets/images/v2/heroes/carmel/carmel-wide-1920.webp",
      heroSrcset: "/assets/images/v2/heroes/carmel/carmel-wide-960.webp 960w, /assets/images/v2/heroes/carmel/carmel-wide-1280.webp 1280w, /assets/images/v2/heroes/carmel/carmel-wide-1920.webp 1920w",
      heroTallSrcset: "/assets/images/v2/heroes/carmel/carmel-tall-480.webp 480w, /assets/images/v2/heroes/carmel/carmel-tall-720.webp 720w, /assets/images/v2/heroes/carmel/carmel-tall-960.webp 960w",
      heroAlt: "Red Vanderhall Carmel at sunset",
      card: "/assets/images/v2/cards/carmel/carmel-800.webp",
      cardSrcset: "/assets/images/v2/cards/carmel/carmel-500.webp 500w, /assets/images/v2/cards/carmel/carmel-800.webp 800w",
      cardFocal: "52% 60%",
      cardAlt: "Red Vanderhall Carmel three-quarter front at sunset",
      gallery: gallery("/assets/images/v2/features/carmel", [
        ["downtown", "Carmel parked downtown"],
        ["beach-reflection", "Carmel with beach reflection"],
        ["lake-reflection", "Carmel beside a lake"],
        ["dashboard", "Carmel interior and dashboard"],
        ["shifter", "Carmel shifter detail"],
        ["seats", "Carmel seats"],
      ]),
    },
  },
  {
    slug: "santarosa",
    name: "Santarosa",
    powertrain: { fuel: "electric", layout: "3-wheel" },
    descriptor: "Three-wheel electric autocycle.",
    status: "reserve",
    overview: "Santarosa is a three-wheel electric autocycle. Twin-motor front-wheel drive produces 180 hp, with a published standard range of 150 mi.",
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
      heroTallSrcset: "/assets/images/v3/heroes/santarosa/santarosa-tall-480.webp 480w, /assets/images/v3/heroes/santarosa/santarosa-tall-720.webp 720w, /assets/images/v3/heroes/santarosa/santarosa-tall-960.webp 960w",
      heroAlt: "Blue Vanderhall Santarosa parked in an aircraft hangar",
      heroAlign: "end",
      card: "/assets/images/v3/cards/santarosa-800.webp",
      cardSrcset: "/assets/images/v3/cards/santarosa-500.webp 500w, /assets/images/v3/cards/santarosa-800.webp 800w",
      cardFocal: "50% 50%",
      cardAlt: "Blue Vanderhall Santarosa parked in an aircraft hangar",
      gallery: gallery("/assets/images/v2/features/santarosa", [
        ["sunset", "Santarosa at sunset"],
        ["city", "Santarosa in the city"],
        ["street", "Santarosa street side"],
        ["top-view", "Santarosa from above"],
        ["dashboard", "Santarosa dashboard"],
      ]),
    },
  },
  {
    slug: "brawley",
    name: "Brawley",
    powertrain: { fuel: "electric", layout: "4x4" },
    descriptor: "Quad-motor electric off-road UTV.",
    status: "delivering",
    overview: "Brawley is a quad-motor electric off-road UTV with a seating capacity of four. Published output spans 283 to 404 hp with 488 lb-ft of torque and up to 140 mi of range.",
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
      heroTallSrcset: "/assets/images/v3/heroes/brawley/brawley-tall-480.webp 480w, /assets/images/v3/heroes/brawley/brawley-tall-720.webp 720w, /assets/images/v3/heroes/brawley/brawley-tall-960.webp 960w",
      heroAlt: "Red and white Vanderhall Brawley parked among desert rock formations",
      card: "/assets/images/v3/cards/brawley-800.webp",
      cardSrcset: "/assets/images/v3/cards/brawley-500.webp 500w, /assets/images/v3/cards/brawley-800.webp 800w",
      cardFocal: "50% 50%",
      cardAlt: "Red and white Vanderhall Brawley parked among desert rock formations",
      gallery: [
        ...gallery("/assets/images/brawley/lifestyle", [
          ["desert", "Green Vanderhall Brawley in the desert"],
          ["mountain-road", "White Vanderhall Brawley on a mountain road"],
          ["juniper", "Atomic Green Vanderhall Brawley beneath a juniper tree"],
          ["interior", "Vanderhall Brawley cabin with steering wheel and passenger seats"],
        ]),
        ...gallery("/assets/images/v2/features/brawley", [
          ["suspension", "Brawley suspension detail"],
          ["wheel", "Brawley wheel close-up"],
        ]),
      ],
    },
  },
];

export const modelBySlug = Object.fromEntries(models.map((model) => [model.slug, model]));
