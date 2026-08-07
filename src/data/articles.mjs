// V15, folding in the V14 editorial migration. Two real Vanderhall articles migrated from the
// WordPress pages supplied by Owen on 2026-08-06. Source URLs and the claim audit live in
// Plans/V15-plan.md section 5 and Research/V14-experience-blog-handoff.md; source media hashes live
// in Assets/Blog/README.md. These are editorial records, not current-specification records; the
// claim audit lists every product claim that needs a fresh review before the copy is treated as
// newly approved marketing.
//
// Body content remains an allowlisted block model. Inline segments add safe links/emphasis without
// accepting source HTML, WordPress shortcodes, or arbitrary CMS markup.
const p = (...segments) => (segments.length === 1 && typeof segments[0] === "string"
  ? { type: "p", text: segments[0] }
  : { type: "p", segments });
const h2 = (text) => ({ type: "h2", text });
const h3 = (text) => ({ type: "h3", text });
const ul = (...items) => ({ type: "ul", items });
const link = (text, href) => ({ text, href });
const strong = (text) => ({ text, strong: true });
const emphasis = (text) => ({ text, emphasis: true });
const item = (label, text) => [strong(label), ` ${text}`];

export const ARTICLES = Object.freeze([
  {
    id: "article-side-by-side-brawley",
    slug: "what-is-a-side-by-side-experience-the-future-with-the-vanderhall-brawley",
    title: "What Is a Side-by-Side? Experience the Future with the Vanderhall Brawley",
    standfirst: "What defines a side-by-side, and how the all-electric Vanderhall Brawley takes capability, comfort, and control into a new era.",
    excerpt: "A guide to the side-by-side category, the differences from an ATV, and the electric performance and comfort that distinguish the Vanderhall Brawley.",
    category: "Brawley",
    tags: ["Brawley", "Electric off-road", "Side-by-side"],
    author: "Vanderhall USA",
    publishedAt: "2025-11-12",
    updatedAt: null,
    readingMinutes: 5,
    sourceUrl: "https://vanderhallusa.com/what-is-a-side-by-side-experience-the-future-with-the-vanderhall-brawley/",
    hero: {
      src: "/assets/images/v3/editorial/side-by-side-brawley-618.webp",
      srcset: "/assets/images/v3/editorial/side-by-side-brawley-480.webp 480w, /assets/images/v3/editorial/side-by-side-brawley-618.webp 618w",
      alt: "A Vanderhall Brawley navigating a sunlit sandstone trail",
    },
    bodyBlocks: [
      p("When someone asks ", emphasis("what is a side-by-side"), ", they’re referring to a purpose-built, off-road vehicle designed for adventure. In essence, it’s a rugged machine engineered to carry more than one passenger across challenging terrain, combining capability, comfort, and control in equal measure."),
      p("At Vanderhall USA, we’ve reimagined this definition entirely. Our all-electric vehicles push the boundaries of what a side-by-side can be, blending precision engineering with sustainable performance. Let’s explore how these vehicles came to define modern adventure and how the electric Vanderhall Brawley takes it to the next level."),
      h2("What Is a Side-by-Side Vehicle?"),
      p("Also known as a UTV (Utility Task Vehicle) or SxS, a side-by-side is a compact, open-air vehicle built for performance and versatility. Featuring side-by-side seating for two or more passengers, a steering wheel, seat belts, and foot pedals, it combines the feel of a traditional automobile with the agility of an off-road machine."),
      p("Designed for rugged environments, from mountain trails to desert dunes, side-by-sides typically include roll cages, advanced suspension systems, and cargo beds for hauling gear. They strike the ideal balance between recreation and function, equally suited to outdoor exploration or heavy-duty work."),
      h2("The Difference Between ATVs and Side-by-Sides"),
      p("The distinction between an ATV and a side-by-side lies in both design and purpose. ATVs, or All-Terrain Vehicles, are built for single riders and use handlebar steering. Side-by-sides, on the other hand, offer enclosed seating, greater safety features, and a steering wheel for refined control."),
      p("Their versatility is another defining trait. UTVs can tackle trail riding, cargo hauling, towing, or even worksite transport. With larger frames and higher payload and towing capacities, they outperform standard ATVs in both endurance and capability."),
      h2("Why Off-Roaders Love Side-by-Sides"),
      p("Those who’ve experienced a side-by-side firsthand know it’s one of the most thrilling ways to connect with nature. Here’s why:"),
      ul(
        item("Power and Performance:", "Robust drivetrains deliver remarkable torque and acceleration."),
        item("Safety:", "Roll cages, seat belts, and reinforced frames enhance protection."),
        item("Comfort:", "Ergonomic seating and spacious cabins allow for long rides with ease."),
        item("Utility:", "Ample cargo space makes it easy to bring along tools, supplies, or gear."),
        item("Agility:", "Designed for tight trails, steep climbs, and unpredictable terrain."),
      ),
      p("They’re designed to make every adventure memorable, whether that’s climbing dunes, crossing creeks, or heading deep into forest trails."),
      h2("The Evolution of the Side-by-Side"),
      p("Early side-by-sides were primarily utilitarian, built for farms and job sites with durability and hauling capacity in mind. As the category evolved, brands like Polaris, Can-Am, and Yamaha refined the formula for recreation and performance."),
      p("Now, the future has arrived. With the demand for cleaner energy, quieter operation, and advanced technology, Vanderhall has ushered in a new era of the electric side-by-side."),
      h2("Enter the Vanderhall Brawley: The Electric Side-by-Side Redefined"),
      p("At Vanderhall, we’ve taken the essence of a side-by-side and elevated it with the ", link("Brawley", "/brawley/"), ", our all-electric off-road marvel."),
      ul(
        item("Unrivaled Power:", "Four independent electric motors, one at each wheel, provide instantaneous torque for unmatched control."),
        item("Extended Range:", "Up to 140 miles on a single charge keeps you exploring longer."),
        item("Precision Handling:", "Advanced torque vectoring adapts instantly to changing terrain."),
        item("Rugged Design:", "A reinforced roll cage, removable skid plates, and 18-inch wheels conquer mud, sand, snow, and stone."),
        item("Modern Comforts:", "Sealed cabins with bucket seating, heat, and air conditioning create a luxurious off-road experience."),
        item("Fast Charging:", "DC fast-charge capability minimizes downtime and maximizes adventure."),
      ),
      h2("Why Go Electric for Off-Road Adventures?"),
      p("Electric mobility is transforming every aspect of transportation, and off-roading is no exception. The benefits speak for themselves:"),
      ul(
        item("Instant Torque:", "Immediate power delivery for responsive climbing and maneuvering."),
        item("Quiet Operation:", "Immerse yourself in the natural world without engine noise."),
        item("Reduced Maintenance:", "Fewer moving parts mean less upkeep and greater reliability."),
        item("Sustainability:", "Zero emissions ensure the trails you love remain pristine."),
      ),
      h2("Choosing the Right Side-by-Side for You"),
      p("Before investing in a side-by-side, consider your intended use and environment:"),
      ul(
        item("Seating Configuration:", "Two- or four-seat setups for solo or shared adventures."),
        item("Cargo and Towing Needs:", "Match capacity to your lifestyle and terrain."),
        item("Terrain Type:", "Trail, desert, or mountain; each demands different specs."),
        item("Comfort Features:", "Options like enclosed cabins and climate control elevate the ride."),
      ),
      p("If your goal is to combine performance, sustainability, and sophistication, the Vanderhall Brawley is in a class of its own."),
      h2("Experience the Vanderhall Brawley"),
      p("A side-by-side represents freedom, capability, and the thrill of exploration. With the ", link("Vanderhall Brawley", "/brawley/"), ", that experience becomes electrified, literally and figuratively."),
      p("From the desert to the mountain pass, it’s a new era of off-road adventure: silent, sustainable, and uncompromising in power. ", link("Explore the Brawley GTS", "/brawley/gts/"), " and discover how Vanderhall is redefining the future of adventure mobility."),
    ],
    relatedSlugs: ["electric-off-road-vehicles-the-future-of-adventure-driving"],
    seo: { description: "Learn what a side-by-side is, how it differs from an ATV, and how the all-electric Vanderhall Brawley redefines off-road adventure." },
  },
  {
    id: "article-electric-off-road",
    slug: "electric-off-road-vehicles-the-future-of-adventure-driving",
    title: "Electric Off-Road Vehicles: The Future of Adventure Driving",
    standfirst: "Electric propulsion is changing the feel of off-road adventure through immediate power, precise control, and quieter performance.",
    excerpt: "Explore the rise of electric off-road vehicles and the Brawley features designed to bring power, control, and cabin comfort beyond the pavement.",
    category: "Brawley",
    tags: ["Brawley", "Vanderhall", "Electric off-road"],
    author: "Vanderhall USA",
    publishedAt: "2025-10-25",
    updatedAt: null,
    readingMinutes: 6,
    sourceUrl: "https://vanderhallusa.com/electric-off-road-vehicles-the-future-of-adventure-driving/",
    hero: {
      src: "/assets/images/v3/editorial/electric-off-road-617.webp",
      srcset: "/assets/images/v3/editorial/electric-off-road-480.webp 480w, /assets/images/v3/editorial/electric-off-road-617.webp 617w",
      alt: "A Vanderhall Brawley throwing sand while driving across desert dunes",
    },
    bodyBlocks: [
      p("The off-road world is evolving at full speed. For decades, gas-powered machines dominated the trails, thundering over rocks, splashing through mud, and leaving plumes of exhaust in their wake. But a new generation has arrived: the electric off-road vehicle. These machines are redefining what adventure driving feels like. Leading this revolution is the ", link("Vanderhall Brawley", "/brawley/"), ", an all-electric powerhouse engineered for uncompromising off-road performance."),
      p("For those who live for exploration beyond the pavement, it’s time to pay attention."),
      h2("The Rise of Electric Off-Road"),
      p("Adventure drivers increasingly seek experiences defined by precision, control, and endurance rather than noise and exhaust. Electric propulsion delivers those qualities with immediacy and finesse. Instant torque ensures that every ascent, crawl, or obstacle is met with smooth, uninterrupted power. Dual-motor systems provide balanced distribution, maintaining stability and traction across unpredictable landscapes."),
      p("Advancements in battery architecture now make extended exploration a reality. High-capacity battery packs provide generous range, and a growing network of charging access points makes remote travel more practical. The combination of endurance and responsiveness has made electric off-road performance not only viable but desirable."),
      p("Automakers such as Rivian and Tesla have accelerated public enthusiasm for electric capability with models like the R1T and Cybertruck. Yet the Vanderhall Brawley distinguishes itself through a singular purpose. It was conceived for adventure first, with design, technology, and craftsmanship serving that vision in every detail."),
      h2("The Vanderhall Brawley Advantage"),
      p("The electric off-road market continues to evolve as manufacturers adapt existing platforms or introduce hybrid concepts. Polaris, Jeep, and luxury innovators such as NIO and Polestar each bring their own interpretations of electric exploration. The Brawley, however, was born from a different philosophy."),
      p("Every component of the Brawley was engineered specifically for off-road mastery. Its enclosed cabin, uncompromising powertrain, and exceptional ground clearance reflect a complete devotion to the craft of adventure design. It delivers strength and sophistication in equal measure."),
      p("Here’s what sets it apart:"),
      ul(
        item("All-Electric Powertrain:", "Multiple high-output electric motors provide genuine all-wheel drive, instant torque, and uninterrupted acceleration."),
        item("Ground Clearance for Days:", "Elevated geometry and robust suspension allow the Brawley to traverse complex terrain with confidence and fluidity."),
        item("Unmatched Control:", "Locking differentials and proprietary traction management systems provide stability and command in every condition."),
        item("Enclosed Cab Comfort:", "A fully enclosed interior offers year-round comfort and shelter, crafted with both durability and refinement in mind."),
      ),
      p("Each of these elements contributes to a driving experience that is both exhilarating and meticulously controlled."),
      h2("How the Brawley Compares to the Competition"),
      p("The market is crowded and growing fast. Rivian R1S and R1T are impressive. Tesla has teased wild features like tank turns in the Cybertruck. Toyota and Nissan are adding new ideas to keep their off-road vehicles fresh. Porsche and Kia are lining up entries in the electric SUV space."),
      p("None of them carry the same DNA as the Vanderhall Brawley. Many competitors adapt designs from electric SUVs or electric cars. Their goal is appealing to commuters first, adventurers second. Vanderhall flipped that script."),
      p("The Brawley embodies adventure in its purest form. Each component, from its electric motors to its cabin design, serves a singular goal: to deliver unrelenting power, stability, and confidence across every environment."),
      h2("Features That Make a Difference on the Trail"),
      p("When you’re out in the wilderness, the details matter. Here’s how the Brawley delivers:"),
      h3("Range That Keeps You Moving"),
      p("With an estimated 140 miles (225 km) of range on a full charge, the Brawley offers the freedom to explore trails, scale rocks, and cross open terrain with assurance. Its long-range battery system is engineered for sustained adventure and dependable energy management."),
      h3("Power That Hits Hard"),
      p("Dual electric motors generate 404 horsepower (297 kW) and 488 lb-ft of torque (662 Nm). The result is immediate, measured acceleration that provides smooth climbing strength, responsive traction, and confident speed when conditions allow."),
      h3("Built to Grip and Climb"),
      p("Standard 35-inch tires, significant ground clearance, and electronic locking differentials enable the Brawley to maintain balance on uneven surfaces. Its Traction Control System (TCS) manages wheel spin effectively, ensuring grip through mud, sand, and wet conditions."),
      h3("Intelligent Driving Modes"),
      p("The Brawley integrates Vanderhall’s proprietary eCrab™, eCrawl™, and eSteer™ modes, allowing the vehicle to maneuver with extraordinary precision at speeds up to 15 mph (24 km/h). These features make tight navigation, lateral movement, and controlled crawling feel seamless."),
      h3("Comfort Inside the Cockpit"),
      p("Inside the cabin, form and function coexist. The front seats provide 41 inches of headroom and up to 52 inches of legroom, while the rear offers 38 inches of headroom and 32 inches of legroom. Bucket-style seats and tactile toggle controls reinforce a driver-first layout designed for comfort and control throughout extended journeys."),
      h2("Why Adventure Drivers Are Making the Switch"),
      p("Electric off-road technology provides advantages that traditional drivetrains cannot replicate. With fewer moving parts, maintenance demands are reduced, and the delivery of instant torque enhances traction and responsiveness. The result is a driving experience that feels more direct, composed, and capable across challenging terrain."),
      p("While brands such as Tesla, GMC, and BYD continue to focus on highway range and urban performance, the Vanderhall Brawley is built expressly for off-road mastery. It reflects the balance of modern innovation and mechanical strength that defines the next era of exploration."),
      h2("Real-World Adventure"),
      p("Every journey in the Brawley reveals its character. The electric motors respond instantly when the throttle engages, and the suspension absorbs rough terrain with ease. On open stretches, the chassis delivers composed handling and precise control, creating a sense of connection that feels both natural and deliberate."),
      p("The Brawley transforms technical performance into an intuitive experience, offering quiet power, remarkable agility, and the confidence to pursue any trail."),
      h2("The Future of Off-Road Driving Is Electric"),
      p("The move toward electric off-road is undeniable. PHEV and hybrid options are starting to show up as well, but the spotlight is shifting quickly toward full electric."),
      p("The Vanderhall Brawley embodies this momentum and establishes itself as a benchmark for what electric adventure can achieve."),
      h2("Ready to Take Control?"),
      p("If you’re ready to leave behind outdated rigs and step into the future, the Brawley is your answer. It’s powerful, capable, and unapologetically built for the dirt."),
      p("Now delivering in Utah, Arizona, Montana, and Wyoming. ", link("Explore the Brawley GTS", "/brawley/gts/"), " or locate an ", link("authorized retailer near you", "/dealers/"), "."),
    ],
    relatedSlugs: ["what-is-a-side-by-side-experience-the-future-with-the-vanderhall-brawley"],
    seo: { description: "Discover how electric off-road vehicles are reshaping adventure driving and explore the power, control, and comfort of the Vanderhall Brawley." },
  },
]);

export const FEATURED_ARTICLE_ID = "article-side-by-side-brawley";
