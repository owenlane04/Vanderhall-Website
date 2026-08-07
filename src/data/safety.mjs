// THREE REAL SAFETY NOTICES, TRANSCRIBED FROM VANDERHALL'S OWN PORTAL ON 2026-08-07.
//
// This file replaces src/data/mock/safety.mjs, which held three deliberately fictional placeholders.
// V15 pulled those off the page rather than publish an unlabelled fake recall; V17 publishes the real
// ones instead, at Owen's instruction, and the fixture file is deleted rather than kept beside these.
// check-content asserts it stays deleted.
//
// The rule this file follows is the one the privacy policy already follows: the words are the source's
// words, typos and all. The renderer adds structure and nothing else. Three specific consequences,
// none of them accidental:
//
//   1. Em dashes appear inside CPSC's and Vanderhall's own sentences. The house style rule is scoped
//      to exempt this file and the notice detail pages. A recall notice is not copy to edit.
//   2. SN-00003 quotes a sale price and two notices quote CPSC's "$1 trillion" figure. The sitewide
//      price ban names those amounts as exceptions on those pages alone.
//   3. SN-00001 ends "Spanish: 301-504-780", a truncated number, and carries the doubled URL
//      "https://www.SaferProducts.govwww.SaferProducts.gov". Both are defects in the published notice
//      and both are reproduced. Correcting a safety document is not a copy edit.
//
// These records are a snapshot, not a feed. Nothing here learns that Vanderhall has revised a notice or
// posted a fourth. That is the open `safety-records` blocker, and adding a notice by hand until it
// closes means appending one object below: the adapter sorts by postedAt and derives the detail route
// from whether the record carries body blocks.
const p = (text) => ({ type: "p", text });
const h2 = (text) => ({ type: "h2", text });
const h3 = (text) => ({ type: "h3", text });
const ul = (items) => ({ type: "ul", items });

export const SAFETY_PORTAL_URL = "https://portal.vanderhallusa.com/safety_notices";

// Every notice below was read at this date. It prints on the page, because a visitor reading a recall
// is entitled to know how old the copy in front of them is.
export const SAFETY_RETRIEVED_AT = "2026-08-07";

export const SAFETY_NOTICES = Object.freeze([
  {
    id: "SN-00003",
    slug: "sn-00003",
    title: "Vanderhall North America Recalls Brawley GTS Electric Recreational Off Highway Vehicles (ROVs) Due to Risk of Serious Injury or Death from Crash Hazard",
    status: "RCL",
    postedAt: "2026-08-06",
    revisedAt: null,
    affectedProducts: ["Vanderhall Brawley GTS electric recreational off highway vehicles"],
    hazardSummary: "The recalled recreational off highway vehicle can maintain speed or accelerate when the accelerator pedal is released, posing a risk of serious injury or death from a crash hazard.",
    remedySummary: "Repair",
    consumerAction: "Consumers should stop using their vehicles immediately and contact Vanderhall North America for instructions on how to update their vehicles to at least firmware version 7.1.0 through the Vanderhall customer mobile app. The updated software was released on April 15, 2026, and can be identified by the Vanderhall logo. Owners requiring assistance updating their firmware should contact their dealer or Vanderhall directly for assistance.",
    contact: "inquiry@vanderhallusa.com",
    bodyBlocks: [
      h2("Consumer Contact"),
      p("Vanderhall North America, LLC"),
      p("Email: inquiry@vanderhallusa.com"),
      { type: "p", segments: ["Contact: ", { text: "https://dealer.vanderhallusa.com/contact", href: "https://dealer.vanderhallusa.com/contact" }] },
      { type: "p", segments: ["Safety Notices: ", { text: "https://portal.vanderhallusa.com/safety_notices", href: "https://portal.vanderhallusa.com/safety_notices" }] },
      p("Look for: \"Vanderhall North America, LLC Recalls Motor Software Update\" for more information."),
      h2("Recall Details"),
      p("Units: About 210"),
      p("Description:"),
      p("This recall involves all Vanderhall model years 2024, 2025, and 2026 Brawley GTS electric recreational off-highway vehicles. The vehicles come in Emerald Green, Ida Rose, Ivory White, Jean Grey, Obsidian Black, and Royal Blue. The VIN numbers for the affected vehicles range from XXXXXXXXXXXXX4933 to XXXXXXXXXXXXX6153 and can be found under the dashboard on the driver's side of the vehicle."),
      p("Incidents/Injuries:"),
      p("The firm has received one report of a vehicle unexpectedly accelerating. No injuries have been reported."),
      p("Sold at:"),
      p("Vanderhall North America dealers in Utah, Ohio, Michigan, Texas, Montana, North Carolina, Oklahoma, and Arizona, from April 2024 through June 2026 for about $50,000."),
      p("Manufacturer: Vanderhall North America, LLC, of Provo, Utah"),
      p("Manufactured in: United States"),
      p("Fast Track Recall"),
      h2("About CPSC"),
      p("CPSC is the federal agency charged with protecting the public from unreasonable risks of injury associated with thousands of types of consumer products. Deaths, injuries, and property damage from consumer product-related incidents cost the nation more than $1 trillion annually. Since the agency was established more than 50 years ago, CPSC has worked to ensure the safety of consumer products, contributing to a decline in related injuries."),
      p("Federal law prohibits any person from selling products subject to a Commission-ordered recall or to a voluntary recall undertaken in consultation with CPSC."),
      h3("For Lifesaving Information"),
      ul([
        "Visit CPSC.gov.",
        "Sign up to receive CPSC email alerts.",
        "Follow CPSC on Facebook, Instagram, X, BlueSky, Threads, LinkedIn, and Truth Social.",
        "Report a dangerous product or a product-related injury at www.SaferProducts.gov .",
        "Call CPSC's Hotline at 800-638-2772 (TTY: 800-638-8270).",
        "Contact a media specialist.",
      ]),
    ],
    documents: [],
    sourceUrl: "https://portal.vanderhallusa.com/safety_notices/3",
  },
  {
    id: "SN-00001",
    slug: "sn-00001",
    title: "Vanderhall North America LLC recalls all 2024, 2025, 2026 Brawley electric recreational off highway vehicles (ROV) due to tie rods breaking.",
    status: "RCL",
    postedAt: "2026-02-02",
    revisedAt: null,
    affectedProducts: ["All 2024, 2025, and 2026 Brawley models"],
    hazardSummary: "The tie rods on affected Brawley models may break during certain off-road driving situations, which can lead to a sudden loss of steering control. These tie rods can fail when a strong sideways force is applied to the tire, increasing the risk of a crash.",
    remedySummary: "Affected Brawley vehicles should not be used or operated until all four tie rods have been replaced. Vanderhall will provide the tie rod replacement free of charge through authorized Vanderhall dealers.",
    consumerAction: "Customers should contact their nearest authorized Vanderhall dealer for assistance with this recall or for assistance updating their Brawley vehicle’s software. To locate the nearest Vanderhall dealer, please visit www.vanderhallusa.com and select “Find a Store” from the drop-down menu. Customers needing additional assistance may contact Vanderhall by visiting www.vanderhallusa.com, selecting “Contact,” then “Dealer Experience,” and then “Service.”",
    contact: null,
    bodyBlocks: [
      // Title case, not the ALL CAPS the portal displays: that is a CSS text-transform on a 12px label,
      // and baking a presentation rule into republished text is exactly the drift this file forbids.
      h2("U.S. Consumer Product Safety Commission – Fast-Track Recall"),
      p("Recall Notice"),
      p("Release Date: February 9, 2026"),
      p("Release Number: 2026-001"),
      p("Vanderhall North America LLC recalls all 2024, 2025, and 2026 Brawley electric recreational off-highway vehicles (ROV) due to tie rods breaking."),
      p("Please review the information below carefully. Out of an abundance of caution, Vanderhall is advising owners not to operate affected vehicles until the recall repair has been completed by an authorized Vanderhall dealer."),
      h2("Recall Details"),
      ul([
        "Number of affected vehicles: 180",
        "Description: All 2024, 2025, and 2026 Brawley electric ROVs",
        "Incidents/Injuries: None",
        "Sold at: Vanderhall of Catawba Island, Draper, Kalamazoo, Lake Conroe, Missoula, Newland, Oklahoma City, Tempe, Tulsa, Fairview, St. George",
        "Manufacturer: Vanderhall North America, LLC",
        "Manufactured in: United States",
      ]),
      p("This recall was conducted voluntarily by the company under CPSC’s Fast-Track Recall process. Fast-Track recalls are initiated by firms that commit to work with CPSC to quickly announce the recall and remedy to protect consumers."),
      p("© 2026 Vanderhall North America, LLC. All rights reserved."),
      h2("About U.S. CPSC"),
      p("The U.S. Consumer Product Safety Commission is charged with protecting the public from unreasonable risks of injury or death associated with the use of thousands of types of consumer products under the agency’s jurisdiction. Deaths, injuries, and property damage from consumer product incidents cost the nation more than $1 trillion annually."),
      p("CPSC is committed to protecting consumers and families from products that pose a fire, electrical, chemical, or mechanical hazard. CPSC’s work to ensure the safety of consumer products—such as toys, cribs, power tools, cigarette lighters, and household chemicals— contributed to a decline in the rate of deaths and injuries associated with consumer products over the past 40 years."),
      p("Federal law bars any person from selling products subject to a publicly announced voluntary recall by a manufacturer or a mandatory recall ordered by the Commission."),
      p("For more lifesaving information, follow us on https://www.facebook.com/USCPSC, Instagram @USCPSC, and Twitter @USCPSC or sign up to receive our e-mail alerts. To report a dangerous product or a product-related injury, go online to https://www.SaferProducts.govwww.SaferProducts.gov or call CPSC’s Hotline at 800-638-2772 or teletypewriter at 301-595-7054 for the hearing impaired."),
      h3("CPSC Consumer Information Hotline"),
      p("Contact us at this toll-free number if you have questions about a recall:"),
      p("800-638-2772 (TTY 301-595-7054)"),
      p("Times: 8 a.m. – 5:30 p.m. ET; Messages can be left anytime"),
      p("Call to get product safety and other agency information and to report unsafe products."),
      h3("Media Contact"),
      p("Please use the phone numbers below for all media requests:"),
      p("Phone: 301-504-7908"),
      p("Spanish: 301-504-780"),
    ],
    documents: [],
    sourceUrl: "https://portal.vanderhallusa.com/safety_notices/1",
  },
  {
    id: "SN-00002",
    slug: "sn-00002",
    title: "Vanderhall North America LLC recalls all 2024 Brawley electric recreational off highway vehicles (ROV) due to potential loss of stability and electric shock hazards",
    status: "RCL",
    postedAt: "2025-03-03",
    revisedAt: null,
    affectedProducts: ["All 2024 Brawley models"],
    // The portal's own one-line card summary. The two full hazard paragraphs are in the body below,
    // where the notice puts them.
    hazardSummary: "Software faults for rear steer mode and electrical shock risk.",
    remedySummary: "Affected Brawley vehicles should not be used or operated until the software has been updated. Vanderhall will provide a software update for customer download using the Vanderhall customer app.",
    consumerAction: "Customers should contact their nearest authorized Vanderhall dealer for assistance with this recall or for help updating their Brawley vehicle’s software.",
    contact: null,
    bodyBlocks: [
      h2("Recall Summary"),
      p("All 2024 Brawley models"),
      h3("Hazard"),
      p("A software fault was found that will allow affected Brawley vehicles to operate with the rear steering unlocked if the rear steering was unable to reach the home position when returning to 4x4 drive mode. Driving with the rear steering unlocked may cause instability when driving at high speeds."),
      p("A software fault was also found that, in some rare instances—such as if the inside of the vehicle becomes wet or if the vehicle becomes partially or fully submerged in water—would allow affected Brawley vehicles to operate outside of the allowable high-voltage isolation range. This could present a risk of electrical shock to the occupants of the vehicle."),
      h3("Remedy"),
      p("Affected Brawley vehicles should not be used or operated until the software has been updated. Vanderhall will provide a software update for customer download using the Vanderhall customer app."),
      p("While awaiting the software update, the Brawley vehicle’s battery should be maintained at 50% state-of-charge or higher to avoid the electric shock hazard. The vehicle is safe to charge even if it has not received the software update."),
      h3("Customer Contact"),
      p("Customers should contact their nearest authorized Vanderhall dealer for assistance with this recall or for help updating their Brawley vehicle’s software."),
      p("To locate the nearest Vanderhall dealer, please visit www.vanderhallusa.com and select “Find a Store” from the menu."),
      p("Customers needing additional assistance may contact Vanderhall by visiting www.vanderhallusa.com and selecting “Contact.”"),
      h2("Recall Details"),
      ul([
        "Number of Affected Vehicles: 59",
        "Description: All 2024 Brawley electric ROVs",
        "Incidents/Injuries: None reported",
      ]),
      p("Sold At:"),
      ul([
        "Big Pine Sports, dba Vanderhall of Fairview, Utah",
        "Edge Powersports, dba Vanderhall of Draper, Utah",
      ]),
    ],
    documents: [],
    sourceUrl: "https://portal.vanderhallusa.com/safety_notices/2",
  },
]);
