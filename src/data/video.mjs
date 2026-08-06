// The one ambient loop. V10 shipped three, delivered by Plans/video-image-plan.md; V11-A keeps the
// rock-ledge montage and deletes the other two, per D-V11-2 and D-V11-3. The montage moves from
// /brawley/ to the homepage hero, which is also where vanderhallusa.com runs it, and /brawley/ and
// /brawley/gts/ ship no motion footage at all.
//
// Provenance: this file was cut from one clip in Vanderhall's own media library,
// vanderhallusa.com/wp-content/uploads/2025/03/Brawley-sequence-001.mp4. The exact source URL, trim,
// codec, byte size and full-resolution burned-text review are in
// Assets/Video Image Plan/video-asset-manifest.csv, and the evidence behind the selection is in
// Research/video-image-harvest.md. Provenance is not written publication permission: rights,
// likeness and location status remain unconfirmed and are on the open-items list. V11 reduces the
// exposure from three clips to one; it does not resolve it.
//
// Filenames are the source package's basenames, unchanged, so any row in that manifest can be
// matched to a delivered file by name alone. That is worth more than tidier names. The ten retired
// files are deleted from the build rather than left unreferenced, and the source package is
// untouched, so restoring either loop is a copy rather than a re-encode.
//
// Nothing here is re-encoded. Both files carry a video stream and no audio stream, which
// scripts/check-video.mjs re-proves with ffprobe on every check run rather than trusting this note.
//
// These are Brawley files. D-VIP-6 said they may appear on Brawley surfaces only; the homepage is
// not a vehicle page and makes no claim about a machine, so the lineup's own flagship opening the
// site is the one placement outside /brawley/ that says nothing a photograph would not.

const BASE = "/assets/video/brawley";

// Every delivered frame and poster is 1900 by 900, which is the source clip's own size. Declared
// once: the poster and the video must share one box exactly, or the switch from one to the other
// moves the layout.
export const AMBIENT_WIDTH = 1900;
export const AMBIENT_HEIGHT = 900;
const POSTER_RUNGS = [960, 1280, 1900];

// src is the widest rung, because this poster is eagerly fetched and is meant to be the LCP element.
const poster = (stem, alt, { src = 1900 } = {}) => ({
  src: `${BASE}/${stem}-${src}.webp`,
  srcset: POSTER_RUNGS.map((width) => `${BASE}/${stem}-${width}.webp ${width}w`).join(", "),
  width: AMBIENT_WIDTH,
  height: AMBIENT_HEIGHT,
  alt,
});

// Alt text describes only what is in the frame. No terrain, weather, location, model year, trim or
// performance claim is inferred from footage, which is the video plan's section 8 rule.
//
// The poster frame carries a green lens flare across its lower right, inherent to the source at
// 00:02.5. It read as a light leak rather than a defect below the fold on /brawley/, and Owen
// accepted it at the front of the page on 2026-08-05. Re-cutting means re-encoding, which the video
// plan forbids.
export const heroLoop = {
  webm: `${BASE}/brawley-canyon-montage-00-12.webm`,
  mp4: `${BASE}/brawley-canyon-montage-00-12.mp4`,
  focal: "50% 45%",
  poster: poster("brawley-canyon-montage-00-12-poster", "Dark Vanderhall Brawley driving away along a rocky ledge, trailing dust"),
};

// One list, so the check scripts can assert the delivered set against the same source the pages
// render from rather than against a second copy of the filenames. One item now, and the shape is
// kept rather than collapsed: the check that walks it is the check that would catch a second loop
// arriving without a placement decision.
export const ambientVideos = [heroLoop];
