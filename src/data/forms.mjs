// V13. The endpoint map, keyed on form identity.
//
// `request-info` is gone with the generic dealer lead form it identified. That key described a
// single-step schema with a ZIP, an interest checklist and a timeframe; the Contact route that replaces
// it is a materially different form with a category taxonomy and conditional ownership fields, and
// letting it inherit the old identity would mean a submission arriving at John's endpoint labelled as
// something it is not. New form, new key. Plans/V13-plan.md section 6.3.
//
// Every value is null, and null is load-bearing: site.js refuses to send when a form has no endpoint,
// and prints so on the page. A string here is a live destination.
export const FORM_ENDPOINTS = Object.freeze({
  contact: null,
  "recommend-dealer": null,
  "international-dealer-inquiry": null,
  "santarosa-launch-interest": null,
  // V17. The Brawley order form. Its field names are the legacy reservation form's own, read from
  // dealer.vanderhallusa.com/reserve/index/brawley on 2026-08-07 without submitting anything, so
  // connecting it is a destination change rather than a mapping exercise. INTEGRATION.md carries the map.
  "brawley-order": null,
});

// The one direct-inquiry address, declared once so the footer cannot drift between pages. It is a
// convenience route and not a form endpoint: no subject, no body, no tracking query, no script.
// Q-V13-26, Owen on 2026-08-06. Ownership and monitoring of the mailbox are a production blocker.
export const INQUIRY_EMAIL = "inquiry@vanderhall.com";

// US states and territories. Inclusive on purpose: Q-V13-22 is unresolved, so the Launch Edition form
// accepts DC, the territories, and the military posts rather than deciding eligibility on Vanderhall's
// behalf. The campaign owner defines the production list before submissions open.
export const US_REGIONS = Object.freeze([
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
  ["AS", "American Samoa"], ["GU", "Guam"], ["MP", "Northern Mariana Islands"], ["PR", "Puerto Rico"],
  ["VI", "US Virgin Islands"], ["AA", "Armed Forces Americas"], ["AE", "Armed Forces Europe"],
  ["AP", "Armed Forces Pacific"],
]);

// V17. The Brawley order form's country list, and deliberately not the one below it.
//
// The legacy reservation form submits ISO 3166 alpha-2 codes under `customer_country`, so the codes are
// the wiring contract and the values here match it exactly. The names are display only, which is what
// makes the two edits below safe: `COUNTRIES` submits names and belongs to the international dealer
// inquiry, a different form with a different backend, and merging the two lists would change what that
// form sends.
//
// The legacy select was a raw CLDR dump of 266 options. Twenty are gone: the duplicate United States,
// an option labelled "Unknown or Invalid Region", and eighteen states that have not existed for years,
// among them East Germany, the Union of Soviet Socialist Republics, North Vietnam, the Netherlands
// Antilles, Serbia and Montenegro, the Panama Canal Zone and the Neutral Zone. Four names are current
// rather than the source's: Czechia, North Macedonia, Eswatini, Myanmar. Nothing else was touched, and
// no code changed, so a submission still means to the old backend exactly what it meant before.
// United States leads the list as it did on the legacy page; the rest stay alphabetical.
export const ORDER_COUNTRIES = Object.freeze([
  ["US", "United States"], ["AF", "Afghanistan"], ["AL", "Albania"], ["DZ", "Algeria"],
  ["AS", "American Samoa"], ["AD", "Andorra"], ["AO", "Angola"], ["AI", "Anguilla"],
  ["AQ", "Antarctica"], ["AG", "Antigua and Barbuda"], ["AR", "Argentina"], ["AM", "Armenia"],
  ["AW", "Aruba"], ["AU", "Australia"], ["AT", "Austria"], ["AZ", "Azerbaijan"],
  ["BS", "Bahamas"], ["BH", "Bahrain"], ["BD", "Bangladesh"], ["BB", "Barbados"],
  ["BY", "Belarus"], ["BE", "Belgium"], ["BZ", "Belize"], ["BJ", "Benin"],
  ["BM", "Bermuda"], ["BT", "Bhutan"], ["BO", "Bolivia"], ["BA", "Bosnia and Herzegovina"],
  ["BW", "Botswana"], ["BV", "Bouvet Island"], ["BR", "Brazil"], ["IO", "British Indian Ocean Territory"],
  ["VG", "British Virgin Islands"], ["BN", "Brunei"], ["BG", "Bulgaria"], ["BF", "Burkina Faso"],
  ["BI", "Burundi"], ["KH", "Cambodia"], ["CM", "Cameroon"], ["CA", "Canada"],
  ["CV", "Cape Verde"], ["KY", "Cayman Islands"], ["CF", "Central African Republic"], ["TD", "Chad"],
  ["CL", "Chile"], ["CN", "China"], ["CX", "Christmas Island"], ["CC", "Cocos (Keeling) Islands"],
  ["CO", "Colombia"], ["KM", "Comoros"], ["CG", "Congo - Brazzaville"], ["CD", "Congo - Kinshasa"],
  ["CK", "Cook Islands"], ["CR", "Costa Rica"], ["HR", "Croatia"], ["CU", "Cuba"],
  ["CY", "Cyprus"], ["CZ", "Czechia"], ["CI", "Côte d’Ivoire"], ["DK", "Denmark"],
  ["DJ", "Djibouti"], ["DM", "Dominica"], ["DO", "Dominican Republic"], ["EC", "Ecuador"],
  ["EG", "Egypt"], ["SV", "El Salvador"], ["GQ", "Equatorial Guinea"], ["ER", "Eritrea"],
  ["EE", "Estonia"], ["SZ", "Eswatini"], ["ET", "Ethiopia"], ["FK", "Falkland Islands"],
  ["FO", "Faroe Islands"], ["FJ", "Fiji"], ["FI", "Finland"], ["FR", "France"],
  ["GF", "French Guiana"], ["PF", "French Polynesia"], ["TF", "French Southern Territories"], ["GA", "Gabon"],
  ["GM", "Gambia"], ["GE", "Georgia"], ["DE", "Germany"], ["GH", "Ghana"],
  ["GI", "Gibraltar"], ["GR", "Greece"], ["GL", "Greenland"], ["GD", "Grenada"],
  ["GP", "Guadeloupe"], ["GU", "Guam"], ["GT", "Guatemala"], ["GG", "Guernsey"],
  ["GN", "Guinea"], ["GW", "Guinea-Bissau"], ["GY", "Guyana"], ["HT", "Haiti"],
  ["HM", "Heard Island and McDonald Islands"], ["HN", "Honduras"], ["HK", "Hong Kong SAR China"], ["HU", "Hungary"],
  ["IS", "Iceland"], ["IN", "India"], ["ID", "Indonesia"], ["IR", "Iran"],
  ["IQ", "Iraq"], ["IE", "Ireland"], ["IM", "Isle of Man"], ["IL", "Israel"],
  ["IT", "Italy"], ["JM", "Jamaica"], ["JP", "Japan"], ["JE", "Jersey"],
  ["JO", "Jordan"], ["KZ", "Kazakhstan"], ["KE", "Kenya"], ["KI", "Kiribati"],
  ["KW", "Kuwait"], ["KG", "Kyrgyzstan"], ["LA", "Laos"], ["LV", "Latvia"],
  ["LB", "Lebanon"], ["LS", "Lesotho"], ["LR", "Liberia"], ["LY", "Libya"],
  ["LI", "Liechtenstein"], ["LT", "Lithuania"], ["LU", "Luxembourg"], ["MO", "Macau SAR China"],
  ["MG", "Madagascar"], ["MW", "Malawi"], ["MY", "Malaysia"], ["MV", "Maldives"],
  ["ML", "Mali"], ["MT", "Malta"], ["MH", "Marshall Islands"], ["MQ", "Martinique"],
  ["MR", "Mauritania"], ["MU", "Mauritius"], ["YT", "Mayotte"], ["MX", "Mexico"],
  ["FM", "Micronesia"], ["MD", "Moldova"], ["MC", "Monaco"], ["MN", "Mongolia"],
  ["ME", "Montenegro"], ["MS", "Montserrat"], ["MA", "Morocco"], ["MZ", "Mozambique"],
  ["MM", "Myanmar"], ["NA", "Namibia"], ["NR", "Nauru"], ["NP", "Nepal"],
  ["NL", "Netherlands"], ["NC", "New Caledonia"], ["NZ", "New Zealand"], ["NI", "Nicaragua"],
  ["NE", "Niger"], ["NG", "Nigeria"], ["NU", "Niue"], ["NF", "Norfolk Island"],
  ["KP", "North Korea"], ["MK", "North Macedonia"], ["MP", "Northern Mariana Islands"], ["NO", "Norway"],
  ["OM", "Oman"], ["PK", "Pakistan"], ["PW", "Palau"], ["PS", "Palestinian Territories"],
  ["PA", "Panama"], ["PG", "Papua New Guinea"], ["PY", "Paraguay"], ["PE", "Peru"],
  ["PH", "Philippines"], ["PN", "Pitcairn Islands"], ["PL", "Poland"], ["PT", "Portugal"],
  ["PR", "Puerto Rico"], ["QA", "Qatar"], ["RO", "Romania"], ["RU", "Russia"],
  ["RW", "Rwanda"], ["RE", "Réunion"], ["BL", "Saint Barthélemy"], ["SH", "Saint Helena"],
  ["KN", "Saint Kitts and Nevis"], ["LC", "Saint Lucia"], ["MF", "Saint Martin"], ["PM", "Saint Pierre and Miquelon"],
  ["VC", "Saint Vincent and the Grenadines"], ["WS", "Samoa"], ["SM", "San Marino"], ["SA", "Saudi Arabia"],
  ["SN", "Senegal"], ["RS", "Serbia"], ["SC", "Seychelles"], ["SL", "Sierra Leone"],
  ["SG", "Singapore"], ["SK", "Slovakia"], ["SI", "Slovenia"], ["SB", "Solomon Islands"],
  ["SO", "Somalia"], ["ZA", "South Africa"], ["GS", "South Georgia and the South Sandwich Islands"], ["KR", "South Korea"],
  ["ES", "Spain"], ["LK", "Sri Lanka"], ["SD", "Sudan"], ["SR", "Suriname"],
  ["SJ", "Svalbard and Jan Mayen"], ["SE", "Sweden"], ["CH", "Switzerland"], ["SY", "Syria"],
  ["ST", "São Tomé and Príncipe"], ["TW", "Taiwan"], ["TJ", "Tajikistan"], ["TZ", "Tanzania"],
  ["TH", "Thailand"], ["TL", "Timor-Leste"], ["TG", "Togo"], ["TK", "Tokelau"],
  ["TO", "Tonga"], ["TT", "Trinidad and Tobago"], ["TN", "Tunisia"], ["TR", "Turkey"],
  ["TM", "Turkmenistan"], ["TC", "Turks and Caicos Islands"], ["TV", "Tuvalu"], ["UM", "U.S. Minor Outlying Islands"],
  ["VI", "U.S. Virgin Islands"], ["UG", "Uganda"], ["UA", "Ukraine"], ["AE", "United Arab Emirates"],
  ["GB", "United Kingdom"], ["UY", "Uruguay"], ["UZ", "Uzbekistan"], ["VU", "Vanuatu"],
  ["VA", "Vatican City"], ["VE", "Venezuela"], ["VN", "Vietnam"], ["WF", "Wallis and Futuna"],
  ["EH", "Western Sahara"], ["YE", "Yemen"], ["ZM", "Zambia"], ["ZW", "Zimbabwe"],
  ["AX", "Åland Islands"],
]);

export const COUNTRIES = Object.freeze([
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cambodia", "Cameroon", "Canada", "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia",
  "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar", "Republic of the Congo", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
]);
