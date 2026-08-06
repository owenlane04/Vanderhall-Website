// THREE FICTIONAL OPENINGS. Vanderhall is not hiring for any of these.
//
// The live Paralegal and Welding Operator postings on the legacy careers host are deliberately NOT
// copied. They are current operational records: they carry real compensation, they may be filled or
// withdrawn tomorrow, and a copy of one sitting in a fixture file is a job advertisement this project
// has no authority to publish. Plans/V13-plan.md section 9 makes that explicit.
//
// applyUrl is null on every record. A mock apply action is rendered as a disabled control labelled as
// sample, and the prototype collects no applicant data at all: a form that accepts a name and a
// resume and then discards them is worse than no form.
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
    summary: "A sample opening used to review the careers templates. Nothing about this posting is a real Vanderhall vacancy.",
    sections: [
      section("Overview", ["Prototype overview copy. This paragraph exists so the job detail template can be reviewed at realistic length before Vanderhall's own postings replace it."]),
      section("Responsibilities", ["A sample responsibility", "A second sample responsibility", "A third sample responsibility"]),
      section("Qualifications", ["A sample qualification", "A second sample qualification"]),
      section("Benefits", ["Placeholder benefits copy. No benefit, eligibility, or compensation term is promised by this prototype."]),
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
    // Present on exactly one record, so the card and the detail page can both be reviewed with the
    // field and without it. A real range comes from the record, never from the template.
    compensation: "Sample range, not a real offer",
    postedAt: "2026-07-18",
    summary: "A second sample opening, carrying a compensation field so both states of the card can be reviewed.",
    sections: [
      section("Overview", ["Prototype overview copy for the second sample opening."]),
      section("Responsibilities", ["A sample responsibility", "A second sample responsibility"]),
      section("Qualifications", ["A sample qualification"]),
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
    summary: "A third sample opening, held as a card only so the index can be reviewed with a record whose detail page is not written.",
    sections: [],
    applyUrl: null,
    status: "open",
  },
]);

// Equal-opportunity copy is a legal statement, so the prototype states that it is missing rather than
// drafting one. Vanderhall supplies the real sentence before production.
export const EQUAL_OPPORTUNITY_STATEMENT = null;
