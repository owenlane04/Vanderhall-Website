// Dimensions are not restated here. Hub cards are cut to the vehicle band in each source and
// centred on a fresh canvas, so their delivered size is read from the build manifest instead.
const card = (slug, alt) => ({ src: `/assets/images/v3/concepts/hub/${slug}-656.webp`, alt });

export const concepts = [
  {
    name: "Indio",
    slug: "indio",
    category: "Three-wheel electric autocycle concept",
    intro: "Indio is a Vanderhall design study for an open three-wheel roadster. The concept imagery pairs a low two-seat cockpit with a single rear wheel and bodywork finished in a high-visibility green.",
    card: card("indio", "Side profile of a green three-wheel roadster design study"),
    hero: { src: "/assets/images/v3/concepts/indio/hero-1440.webp", srcset: "/assets/images/v3/concepts/indio/hero-960.webp 960w, /assets/images/v3/concepts/indio/hero-1440.webp 1440w, /assets/images/v3/concepts/indio/hero-2560.webp 2560w", mobile: "/assets/images/v3/concepts/indio/mobile-704.webp", alt: "Green Vanderhall Indio concept side profile at the ocean at sunset" },
    gallery: [
      { src: "/assets/images/v3/concepts/indio/gallery-1-1280.webp", srcset: "/assets/images/v3/concepts/indio/gallery-1-960.webp 960w, /assets/images/v3/concepts/indio/gallery-1-1280.webp 1280w, /assets/images/v3/concepts/indio/gallery-1-1920.webp 1920w", alt: "Indio concept interior and front view study" },
      { src: "/assets/images/v3/concepts/indio/gallery-2-1280.webp", srcset: "/assets/images/v3/concepts/indio/gallery-2-960.webp 960w, /assets/images/v3/concepts/indio/gallery-2-1280.webp 1280w, /assets/images/v3/concepts/indio/gallery-2-1920.webp 1920w", alt: "Indio concept cockpit and front view study" },
      { src: "/assets/images/v3/concepts/indio/gallery-3-1280.webp", srcset: "/assets/images/v3/concepts/indio/gallery-3-960.webp 960w, /assets/images/v3/concepts/indio/gallery-3-1280.webp 1280w, /assets/images/v3/concepts/indio/gallery-3-1920.webp 1920w", alt: "Indio concept overhead study" },
      { src: "/assets/images/v3/concepts/indio/gallery-4-1280.webp", srcset: "/assets/images/v3/concepts/indio/gallery-4-960.webp 960w, /assets/images/v3/concepts/indio/gallery-4-1280.webp 1280w, /assets/images/v3/concepts/indio/gallery-4-1920.webp 1920w", alt: "Indio concept side profile study" },
    ],
    wordmark: { src: "/assets/images/v3/concepts/indio/wordmark.webp", width: 508, height: 146 },
  },
  {
    name: "Coachella",
    slug: "coachella",
    category: "Electric off-road concept",
    intro: "Coachella explores what a Vanderhall desert racer could look like. The study renders a high-clearance two-seat body on long-travel suspension, photographed front-on in blowing dust.",
    card: card("coachella", "Side profile of a silver two-seat off-road design study"),
    hero: { src: "/assets/images/v3/concepts/coachella/hero-1280.webp", srcset: "/assets/images/v3/concepts/coachella/hero-960.webp 960w, /assets/images/v3/concepts/coachella/hero-1280.webp 1280w, /assets/images/v3/concepts/coachella/hero-1920.webp 1920w", mobile: "/assets/images/v3/concepts/coachella/mobile-704.webp", alt: "Coachella concept facing forward in blowing dust" },
    gallery: [
      { src: "/assets/images/v3/concepts/coachella/gallery-1-1280.webp", srcset: "/assets/images/v3/concepts/coachella/gallery-1-960.webp 960w, /assets/images/v3/concepts/coachella/gallery-1-1280.webp 1280w, /assets/images/v3/concepts/coachella/gallery-1-1920.webp 1920w", alt: "Coachella concept rear and overhead study" },
      { src: "/assets/images/v3/concepts/coachella/gallery-2-1280.webp", srcset: "/assets/images/v3/concepts/coachella/gallery-2-960.webp 960w, /assets/images/v3/concepts/coachella/gallery-2-1280.webp 1280w, /assets/images/v3/concepts/coachella/gallery-2-1920.webp 1920w", alt: "Coachella concept interior and front study" },
      { src: "/assets/images/v3/concepts/coachella/gallery-3-1280.webp", srcset: "/assets/images/v3/concepts/coachella/gallery-3-960.webp 960w, /assets/images/v3/concepts/coachella/gallery-3-1280.webp 1280w, /assets/images/v3/concepts/coachella/gallery-3-1920.webp 1920w", alt: "Coachella concept side profile study" },
    ],
    wordmark: { src: "/assets/images/v3/concepts/coachella/wordmark.webp", width: 444, height: 96 },
  },
  {
    name: "Brawley R",
    slug: "brawley-r",
    category: "Electric off-road UTV concept",
    intro: "Brawley R is a design study that pushes the Brawley silhouette toward a harder trim: a white roof over deep-tint glass, exposed long-travel suspension, and interior renderings with four sport seats.",
    card: card("brawley-r", "Side profile of a magenta and grey off-road design study"),
    hero: { src: "/assets/images/v3/concepts/brawley-r/hero-1280.webp", srcset: "/assets/images/v3/concepts/brawley-r/hero-960.webp 960w, /assets/images/v3/concepts/brawley-r/hero-1280.webp 1280w, /assets/images/v3/concepts/brawley-r/hero-1920.webp 1920w", mobile: "/assets/images/v3/concepts/brawley-r/mobile-704.webp", alt: "Brawley R concept among desert rocks" },
    gallery: [
      { src: "/assets/images/v3/concepts/brawley-r/gallery-1-1280.webp", srcset: "/assets/images/v3/concepts/brawley-r/gallery-1-960.webp 960w, /assets/images/v3/concepts/brawley-r/gallery-1-1280.webp 1280w, /assets/images/v3/concepts/brawley-r/gallery-1-1920.webp 1920w", alt: "Brawley R concept interior and front study" },
      { src: "/assets/images/v3/concepts/brawley-r/gallery-2-1280.webp", srcset: "/assets/images/v3/concepts/brawley-r/gallery-2-960.webp 960w, /assets/images/v3/concepts/brawley-r/gallery-2-1280.webp 1280w, /assets/images/v3/concepts/brawley-r/gallery-2-1920.webp 1920w", alt: "Brawley R concept side profile study" },
    ],
    wordmark: { src: "/assets/images/v3/concepts/brawley-r/wordmark.webp", width: 444, height: 96 },
  },
  {
    name: "Santarosa R",
    slug: "santarosa-r",
    category: "Three-wheel electric autocycle concept",
    intro: "Santarosa R reimagines the Santarosa three-wheel silhouette as a darker, more aggressive study, rendered in a magenta and carbon scheme with a low windscreen and open cockpit.",
    card: card("santarosa-r", "Side profile of a magenta three-wheel roadster design study"),
    hero: { src: "/assets/images/v3/concepts/santarosa-r/hero-1280.webp", srcset: "/assets/images/v3/concepts/santarosa-r/hero-960.webp 960w, /assets/images/v3/concepts/santarosa-r/hero-1280.webp 1280w, /assets/images/v3/concepts/santarosa-r/hero-1920.webp 1920w", mobile: "/assets/images/v3/concepts/santarosa-r/mobile-704.webp", alt: "Santarosa R concept front and three-quarter study" },
    gallery: [
      { src: "/assets/images/v3/concepts/santarosa-r/gallery-1-1280.webp", srcset: "/assets/images/v3/concepts/santarosa-r/gallery-1-960.webp 960w, /assets/images/v3/concepts/santarosa-r/gallery-1-1280.webp 1280w, /assets/images/v3/concepts/santarosa-r/gallery-1-1920.webp 1920w", alt: "Santarosa R concept side profile study" },
    ],
    wordmark: { src: "/assets/images/v3/concepts/santarosa-r/wordmark.webp", width: 444, height: 96 },
  },
  {
    name: "Speedster",
    slug: "speedster",
    category: "Three-wheel electric autocycle concept",
    intro: "Speedster is a single-cockpit take on the Vanderhall three-wheel roadster. The study removes the windshield entirely and pairs white bodywork with gold striping and green upholstery.",
    card: card("speedster", "Side profile of a white single-cockpit three-wheel design study"),
    hero: { src: "/assets/images/v3/concepts/speedster/hero-1280.webp", srcset: "/assets/images/v3/concepts/speedster/hero-960.webp 960w, /assets/images/v3/concepts/speedster/hero-1280.webp 1280w, /assets/images/v3/concepts/speedster/hero-1920.webp 1920w", alt: "Speedster concept overhead and front three-quarter study" },
    gallery: [
      { src: "/assets/images/v3/concepts/speedster/gallery-1-1280.webp", srcset: "/assets/images/v3/concepts/speedster/gallery-1-960.webp 960w, /assets/images/v3/concepts/speedster/gallery-1-1280.webp 1280w, /assets/images/v3/concepts/speedster/gallery-1-1920.webp 1920w", alt: "Speedster concept side profile study" },
    ],
    wordmark: { src: "/assets/images/v3/concepts/speedster/wordmark.webp", width: 306, height: 96 },
  },
  {
    name: "Yuma",
    slug: "yuma",
    category: "Electric off-road utility concept",
    intro: "Yuma studies a compact electric pickup for Vanderhall. The renderings show a two-door cab, an integrated open bed, and a two-tone tan and black body on off-road tires.",
    card: card("yuma", "Side profile of a tan and black electric pickup design study"),
    hero: { src: "/assets/images/v3/concepts/yuma/hero-1280.webp", srcset: "/assets/images/v3/concepts/yuma/hero-960.webp 960w, /assets/images/v3/concepts/yuma/hero-1280.webp 1280w, /assets/images/v3/concepts/yuma/hero-1920.webp 1920w", mobile: "/assets/images/v3/concepts/yuma/mobile-704.webp", alt: "Yuma concept side profile on a black studio field" },
    gallery: [
      { src: "/assets/images/v3/concepts/yuma/gallery-1-1280.webp", srcset: "/assets/images/v3/concepts/yuma/gallery-1-960.webp 960w, /assets/images/v3/concepts/yuma/gallery-1-1280.webp 1280w, /assets/images/v3/concepts/yuma/gallery-1-1920.webp 1920w", alt: "Yuma concept interior and bed detail study" },
      { src: "/assets/images/v3/concepts/yuma/gallery-2-1280.webp", srcset: "/assets/images/v3/concepts/yuma/gallery-2-960.webp 960w, /assets/images/v3/concepts/yuma/gallery-2-1280.webp 1280w, /assets/images/v3/concepts/yuma/gallery-2-1920.webp 1920w", alt: "Yuma concept side profile study" },
    ],
    wordmark: { src: "/assets/images/v3/concepts/yuma/wordmark.webp", width: 508, height: 146 },
  },
  {
    name: "Yuma Defense",
    slug: "yuma-defense",
    category: "Electric off-road defense concept",
    intro: "Yuma Defense adapts the Yuma study for defense use: an open four-seat configuration with a full external roll cage, tow points, and a winch, rendered in a uniform tan.",
    card: card("yuma-defense", "Side profile of a tan open four-seat design study with a full roll cage"),
    hero: { src: "/assets/images/v3/concepts/yuma-defense/hero-1280.webp", srcset: "/assets/images/v3/concepts/yuma-defense/hero-960.webp 960w, /assets/images/v3/concepts/yuma-defense/hero-1280.webp 1280w, /assets/images/v3/concepts/yuma-defense/hero-1920.webp 1920w", alt: "Yuma Defense concept beach side profile and front study" },
    gallery: [
      { src: "/assets/images/v3/concepts/yuma-defense/gallery-2-1280.webp", srcset: "/assets/images/v3/concepts/yuma-defense/gallery-2-960.webp 960w, /assets/images/v3/concepts/yuma-defense/gallery-2-1280.webp 1280w", alt: "Yuma Defense concept side profile study" },
    ],
    wordmark: { src: "/assets/images/v3/concepts/yuma-defense/wordmark.webp", width: 713, height: 146 },
  },
  {
    name: "Laduna",
    slug: "laduna",
    category: "Electric off-road concept",
    intro: "Laduna is a compact open-cockpit off-road study in blue and black, shown with gold wheels, a visible roll structure, and gullwing-style doors in the interior renderings.",
    card: card("laduna", "Side profile of a blue and grey off-road design study with gold wheels"),
    hero: { src: "/assets/images/v3/concepts/laduna/hero-1280.webp", srcset: "/assets/images/v3/concepts/laduna/hero-960.webp 960w, /assets/images/v3/concepts/laduna/hero-1280.webp 1280w, /assets/images/v3/concepts/laduna/hero-1920.webp 1920w", alt: "Laduna concept side profile on a black studio field" },
    gallery: [
      { src: "/assets/images/v3/concepts/laduna/gallery-1-1280.webp", srcset: "/assets/images/v3/concepts/laduna/gallery-1-960.webp 960w, /assets/images/v3/concepts/laduna/gallery-1-1280.webp 1280w, /assets/images/v3/concepts/laduna/gallery-1-1920.webp 1920w", alt: "Laduna concept interior and gullwing front study" },
      { src: "/assets/images/v3/concepts/laduna/gallery-2-1280.webp", srcset: "/assets/images/v3/concepts/laduna/gallery-2-960.webp 960w, /assets/images/v3/concepts/laduna/gallery-2-1280.webp 1280w, /assets/images/v3/concepts/laduna/gallery-2-1920.webp 1920w", alt: "Laduna concept side profile study" },
    ],
    wordmark: { src: "/assets/images/v3/concepts/laduna/wordmark.webp", width: 508, height: 146 },
  },
  {
    name: "Balboa",
    slug: "balboa",
    category: "Electric motorcycle concept",
    intro: "Balboa is Vanderhall's electric motorcycle study: a low cafe-racer stance, a monolithic tank form with an integrated display, and minimal brightwork.",
    card: card("balboa", "Side profile of a dark electric motorcycle design study"),
    hero: { src: "/assets/images/v3/concepts/balboa/hero-1280.webp", srcset: "/assets/images/v3/concepts/balboa/hero-960.webp 960w, /assets/images/v3/concepts/balboa/hero-1280.webp 1280w, /assets/images/v3/concepts/balboa/hero-1920.webp 1920w", alt: "Balboa concept motorcycle side profile on a black studio field" },
    gallery: [
      { src: "/assets/images/v3/concepts/balboa/gallery-1-1280.webp", srcset: "/assets/images/v3/concepts/balboa/gallery-1-960.webp 960w, /assets/images/v3/concepts/balboa/gallery-1-1280.webp 1280w, /assets/images/v3/concepts/balboa/gallery-1-1920.webp 1920w", alt: "Balboa concept handlebar, tank, and front view study" },
    ],
    wordmark: { src: "/assets/images/v3/concepts/balboa/wordmark.webp", width: 508, height: 146 },
  },
];

export const conceptBySlug = Object.fromEntries(concepts.map((concept) => [concept.slug, concept]));
