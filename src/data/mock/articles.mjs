// THREE SAMPLE ARTICLES. None of this is Vanderhall editorial.
//
// The two legacy Brawley posts are deliberately not carried over in any form. They contain unreviewed
// technical and market claims, which is exactly what a sample article must not have: a body that reads
// as plausible product copy is the kind of prototype content that survives into production because
// nobody could tell it apart. So these three say nothing about a vehicle at all. No specification, no
// availability, no price, no range, no competitor, no market claim, no safety instruction.
//
// The body is an allowlisted block model rather than an HTML string, for the reason the privacy
// renderer switches on a type and throws: a CMS field pasted straight into a page is an injection, and
// a silently dropped block is a document that lost a paragraph without telling anybody.
//
// Images reuse delivered frames whose subject genuinely matches the words beside them. Nothing here
// implies a product fact through a caption.
const p = (text) => ({ type: "p", text });
const h2 = (text) => ({ type: "h2", text });
const ul = (...items) => ({ type: "ul", items });
const quote = (text, attribution) => ({ type: "quote", text, attribution });

export const MOCK_POSTS = Object.freeze([
  {
    id: "mock-post-1",
    slug: "how-we-photograph-a-vehicle",
    title: "How we photograph a vehicle",
    standfirst: "A sample article about the studio, written to review the article template rather than to publish anything about a product.",
    excerpt: "Placeholder editorial copy for layout review. It describes the process of photographing a vehicle and makes no claim about any Vanderhall model.",
    category: "Behind the scenes",
    tags: ["prototype", "studio"],
    author: "Sample Author",
    publishedAt: "2026-07-28",
    updatedAt: null,
    readingMinutes: 4,
    hero: {
      src: "/assets/images/v2/features/santarosa/city-960.webp",
      srcset: "/assets/images/v2/features/santarosa/city-640.webp 640w, /assets/images/v2/features/santarosa/city-800.webp 800w, /assets/images/v2/features/santarosa/city-960.webp 960w, /assets/images/v2/features/santarosa/city-1280.webp 1280w",
      alt: "Santarosa with a hard roof on a rooftop deck at dusk",
    },
    bodyBlocks: [
      p("This is prototype body copy. It exists so that the article template can be reviewed at real length, with real paragraph rhythm, before Vanderhall's own editorial replaces it. Nothing in this article states a fact about a vehicle."),
      h2("A sample section heading"),
      p("A second paragraph, long enough to show how the measure behaves across a full column of running text. The article template supports paragraphs, subheadings, lists, and a pulled quote, and each of those appears once in this sample so that all four can be seen together rather than described."),
      ul("A sample list item", "A second sample list item", "A third sample list item"),
      p("Lists are used for genuinely enumerable things. A list of adjectives is a paragraph that has been broken up, and it reads as one."),
      quote("A sample pulled quote, included so that the treatment can be reviewed at the width it will actually be read at.", "Sample Author"),
      h2("A second sample section"),
      p("The last block of the sample. Below this the template offers two related stories and one way to carry on, which on a real article would be chosen for the piece rather than generated."),
    ],
    relatedSlugs: ["notes-from-the-design-studio", "what-to-expect-at-an-event"],
    seo: { description: "A sample Vanderhall article used to review the editorial template. Prototype content." },
  },
  {
    id: "mock-post-2",
    slug: "notes-from-the-design-studio",
    title: "Notes from the design studio",
    standfirst: "A second sample article, written so the index can be reviewed with more than one card in it.",
    excerpt: "Placeholder editorial copy for layout review. It describes how a design study becomes a drawing and makes no claim about any Vanderhall model.",
    category: "Design",
    tags: ["prototype", "design"],
    author: "Sample Author",
    publishedAt: "2026-07-14",
    updatedAt: "2026-07-21",
    readingMinutes: 3,
    hero: {
      src: "/assets/images/v2/features/venice/mountain-lake-960.webp",
      srcset: "/assets/images/v2/features/venice/mountain-lake-640.webp 640w, /assets/images/v2/features/venice/mountain-lake-800.webp 800w, /assets/images/v2/features/venice/mountain-lake-960.webp 960w, /assets/images/v2/features/venice/mountain-lake-1280.webp 1280w",
      alt: "Venice parked beside an alpine lake",
    },
    bodyBlocks: [
      p("Prototype body copy for the second sample article. It carries an updated date, which the first one does not, so that both states of the article header can be reviewed."),
      h2("Why this article has two dates"),
      p("An article that has been revised should say so, and it should say when. The template prints the publication date always and the revision date only when the record carries one, which is the same rule every optional field in this build follows."),
      p("Everything else on this page is the same template as the first sample."),
    ],
    relatedSlugs: ["how-we-photograph-a-vehicle", "what-to-expect-at-an-event"],
    seo: { description: "A second sample Vanderhall article used to review the editorial template. Prototype content." },
  },
  {
    // Deliberately excerpt-only: the index has to be reviewable with a card whose article is not yet
    // written, which is the ordinary state of a real archive mid-edit. Its detail route is not built,
    // and the index does not link to one, so there is no dead end.
    id: "mock-post-3",
    slug: "what-to-expect-at-an-event",
    title: "What to expect at an event",
    standfirst: "A third sample record, held as a card only.",
    excerpt: "Placeholder editorial copy for layout review. This record exists to show a card whose article has not been written yet.",
    category: "Events",
    tags: ["prototype"],
    author: "Sample Author",
    publishedAt: "2026-06-30",
    updatedAt: null,
    readingMinutes: 2,
    hero: null,
    bodyBlocks: [],
    relatedSlugs: [],
    seo: { description: "A third sample Vanderhall record used to review the editorial index. Prototype content." },
  },
]);

// The featured article on both /experience/ and /blog/, selected by stable ID rather than by array
// position, so reordering the fixtures cannot silently change which story leads.
export const FEATURED_POST_ID = "mock-post-1";
