// SIX FICTIONAL DEALERS. Not one of these is a Vanderhall dealer.
//
// Every value here is chosen so that it cannot be mistaken for a real record even out of context, and
// that is a deliberate design constraint rather than laziness:
//
// - Telephone numbers use the 555-01xx block, which is reserved for fiction and is not routable.
// - Websites are subdomains of example.com, which IANA reserves for documentation and which resolves
//   to nothing.
// - Street addresses are invented. The cities and their coordinates are real, because the locator's
//   own job is to sort by distance and fit a map to bounds, and it cannot be reviewed against
//   coordinates in the middle of the ocean.
//
// The record shape is the contract in Plans/V13-plan.md section 4.4. John replaces getDealers() in
// src/data/adapters.mjs with a database or API adapter; nothing in the page templates reads this file.
// Fields the production source cannot fill (hours, status) are optional and disappear cleanly.
export const MOCK_DEALERS = Object.freeze([
  {
    id: "mock-dealer-1",
    slug: "wasatch-motorworks",
    name: "Wasatch Motorworks",
    address1: "1420 Foundry Way",
    address2: "Suite 200",
    city: "Provo",
    region: "UT",
    postalCode: "84601",
    country: "US",
    latitude: 40.2338,
    longitude: -111.6585,
    phone: "+1-555-0142",
    websiteUrl: "https://wasatch-motorworks.example.com/",
    capabilities: { ev: true, gas: true, service: true },
    models: ["Brawley", "Santarosa"],
    hours: "Monday to Friday, 9 to 6",
    status: "Open today",
  },
  {
    id: "mock-dealer-2",
    slug: "high-desert-electric",
    name: "High Desert Electric",
    address1: "8 Mesa Road",
    city: "Phoenix",
    region: "AZ",
    postalCode: "85004",
    country: "US",
    latitude: 33.4484,
    longitude: -112.0740,
    phone: "+1-555-0163",
    websiteUrl: "https://high-desert-electric.example.com/",
    capabilities: { ev: true, gas: false, service: true },
    models: ["Brawley"],
    hours: "Monday to Saturday, 10 to 7",
  },
  {
    id: "mock-dealer-3",
    slug: "silver-state-roadsters",
    name: "Silver State Roadsters",
    address1: "3301 Canyon Parkway",
    city: "Las Vegas",
    region: "NV",
    postalCode: "89109",
    country: "US",
    latitude: 36.1147,
    longitude: -115.1728,
    phone: "+1-555-0117",
    websiteUrl: "https://silver-state-roadsters.example.com/",
    capabilities: { ev: false, gas: true, service: false },
    models: ["Venice", "Carmel"],
  },
  {
    id: "mock-dealer-4",
    slug: "front-range-autocycle",
    name: "Front Range Autocycle",
    address1: "77 Union Street",
    city: "Denver",
    region: "CO",
    postalCode: "80202",
    country: "US",
    latitude: 39.7392,
    longitude: -104.9903,
    phone: "+1-555-0198",
    websiteUrl: "https://front-range-autocycle.example.com/",
    capabilities: { ev: true, gas: true, service: true },
    models: ["Santarosa", "Brawley", "Carmel"],
    hours: "Tuesday to Saturday, 9 to 5",
    status: "Closed today",
  },
  {
    id: "mock-dealer-5",
    slug: "treasure-valley-powersports",
    name: "Treasure Valley Powersports",
    address1: "512 Orchard Avenue",
    city: "Boise",
    region: "ID",
    postalCode: "83702",
    country: "US",
    latitude: 43.6150,
    longitude: -116.2023,
    phone: "+1-555-0126",
    websiteUrl: "https://treasure-valley-powersports.example.com/",
    capabilities: { ev: true, gas: false, service: false },
    models: ["Brawley"],
  },
  {
    id: "mock-dealer-6",
    slug: "valley-electric-sport",
    name: "Valley Electric Sport",
    address1: "2044 Levee Drive",
    city: "Sacramento",
    region: "CA",
    postalCode: "95814",
    country: "US",
    latitude: 38.5816,
    longitude: -121.4944,
    phone: "+1-555-0171",
    websiteUrl: "https://valley-electric-sport.example.com/",
    capabilities: { ev: true, gas: true, service: true },
    models: ["Santarosa", "Venice"],
    hours: "Monday to Friday, 8 to 5",
  },
]);

// The locator's filters. `all` is not a capability, it is the absence of one, which is why it is not
// a key on the record.
export const DEALER_FILTERS = Object.freeze([
  { value: "all", label: "All" },
  { value: "ev", label: "Electric" },
  { value: "gas", label: "Gas" },
  { value: "service", label: "Service" },
]);
