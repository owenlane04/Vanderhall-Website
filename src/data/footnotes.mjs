// V13-F. Semantic footnotes, replacing the flat specification-estimate paragraph.
//
// The legacy site marks specification values with `*`, `**` and `***` and then prints the notes after
// the relevant block. V13 adopts that reference pattern and refuses its inconsistency: the old pages
// reuse `*` for different text between Santarosa and Brawley, and at least one of them publishes a
// range note where no marked range figure appears. So nothing here is a hand-authored star. A row or
// a prose figure carries a stable note ID, and the renderer assigns symbols in first-use order, per
// page. See Plans/V13-plan.md section 7.5 for the source snapshots.
//
// Two notes, and the registry is deliberately small. The production check rejects an unreferenced
// note, which is why the two notes V13 removed are NOT here:
//
// - Santarosa's range note ("*Features and specifications are estimated and subject to change", with
//   `**Available only on Santarosa GTS+` on the optional range row) went with the range figures
//   themselves in section 7.2. A note whose only referent has been deleted is an orphan, and an
//   orphan note is how a page ends up telling a visitor about a figure it no longer publishes.
// - The legacy `*** Available only on Santarosa GT, Santarosa GTS, Santarosa GTS+` note was read on
//   the live page on 2026-08-06, which corrects the older research record that called it unreadable.
//   Correcting the record does not approve the rows it qualified: the wiper system and the removable
//   capshade stay excluded from SANTAROSA_SPECS until their exact figure, mark, applicable trims and
//   wording are all deliberately approved together.
//
// The strings below are normalized copy and require Owen's approval (Q-V13-6 and Q-V13-7). They are
// normalizations of visible legacy text, not new claims: sentence punctuation is completed and the
// trim list is written as a sentence.
export const FOOTNOTES = Object.freeze({
  "spec-estimate": {
    // Legacy source, verbatim: "*Features and specifications are estimated and subject to change".
    // The V12 site already published this sentence, with the full stop, as SPEC_DISCLAIMER.
    text: "Features and specifications are estimated and subject to change without notice.",
  },
  "brawley-gts-availability": {
    // Legacy source, verbatim: "**Available only on Brawley GTS, Brawley GTS+".
    text: "Available only on Brawley GTS and Brawley GTS+.",
  },
});

// One to three asterisks, in first-use order. A page needing a fourth note uses numbers instead: the
// renderer throws rather than printing `****`, which nobody can count at a glance.
export const FOOTNOTE_SYMBOLS = Object.freeze(["*", "**", "***"]);

export const footnoteText = (id) => {
  const note = FOOTNOTES[id];
  if (!note) throw new Error(`Unknown footnote: ${id}`);
  return note.text;
};
