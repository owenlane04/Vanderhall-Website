// THREE FICTIONAL OPENINGS. Vanderhall is not hiring for any of these.
//
// The live Paralegal and Welding Operator postings on the legacy careers host are deliberately NOT
// copied. They are current operational records: they carry real compensation, they may be filled or
// withdrawn tomorrow, and a copy of one sitting in a fixture file is a job advertisement this project
// has no authority to publish. Plans/V13-plan.md section 9 makes that explicit.
//
// V15-F: the visible sample labels are retired sitewide, so these records now read as ordinary
// postings. What keeps them honest without a label: the roles are generic to any vehicle
// manufacturer and promise nothing specific (no compensation, no benefits, no legal statement),
// applyUrl is null on every record so the apply action stays disabled and no applicant data is
// collected, the route keeps its noindex, and the career-records production blocker still holds the
// release gate until Vanderhall's own feed replaces this file.
const section = (heading, items) => ({ heading, items });

export const MOCK_JOBS = Object.freeze([
  {
    id: "mock-job-1",
    slug: "assembly-technician",
    title: "Assembly Technician",
    department: "Manufacturing",
    location: "Provo, Utah",
    workMode: "On site",
    employmentType: "Full time",
    compensation: null,
    postedAt: "2026-07-30",
    summary: "Build Vanderhall vehicles by hand on the Provo line, from subassembly to final quality checks.",
    sections: [
      section("Overview", ["Assembly Technicians build Vanderhall vehicles by hand in Provo, Utah, working across stations from chassis subassembly to final trim and quality verification."]),
      section("Responsibilities", ["Assemble mechanical and electrical subsystems to specification", "Verify torque, fit, and finish at each station", "Document completed work in the production system"]),
      section("Qualifications", ["Hands-on mechanical experience in manufacturing, automotive, or powersports", "Comfortable reading engineering drawings and using calibrated tools"]),
    ],
    applyUrl: null,
    status: "open",
  },
  {
    id: "mock-job-2",
    slug: "customer-experience-specialist",
    title: "Customer Experience Specialist",
    department: "Customer Experience",
    location: "Provo, Utah",
    workMode: "Hybrid",
    employmentType: "Full time",
    compensation: null,
    postedAt: "2026-07-18",
    summary: "Guide Vanderhall owners and prospective customers through questions about vehicles, orders, and service.",
    sections: [
      section("Overview", ["Customer Experience Specialists are the first voice of Vanderhall, guiding owners and prospective customers through questions about vehicles, orders, and service."]),
      section("Responsibilities", ["Answer owner and customer questions by phone and email", "Coordinate with dealers and service teams to resolve open cases"]),
      section("Qualifications", ["Experience in customer-facing support, retail, or hospitality"]),
    ],
    applyUrl: null,
    status: "open",
  },
  {
    // Card only, no detail route. A real archive always has a record somebody has not finished, and the
    // index has to be reviewable with one in it.
    id: "mock-job-3",
    slug: "mechanical-design-engineer",
    title: "Mechanical Design Engineer",
    department: "Engineering",
    location: "Provo, Utah",
    workMode: "On site",
    employmentType: "Full time",
    compensation: null,
    postedAt: "2026-06-24",
    summary: "Design, prototype, and iterate vehicle systems alongside the Provo engineering team.",
    sections: [],
    applyUrl: null,
    status: "open",
  },
]);

// Equal-opportunity copy is a legal statement, so the prototype states that it is missing rather than
// drafting one. Vanderhall supplies the real sentence before production.
export const EQUAL_OPPORTUNITY_STATEMENT = null;
