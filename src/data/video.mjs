// The three ambient loops, delivered by Plans/video-image-plan.md and shipped as part of V10.
//
// Provenance: every file was cut from one clip in Vanderhall's own media library,
// vanderhallusa.com/wp-content/uploads/2025/03/Brawley-sequence-001.mp4. The exact source URL, trim,
// codec, byte size and full-resolution burned-text review for all fifteen delivered files are in
// Assets/Video Image Plan/video-asset-manifest.csv, and the evidence behind the selection is in
// Research/video-image-harvest.md. Provenance is not written publication permission: rights,
// likeness and location status remain unconfirmed and are on the open-items list.
//
// Filenames are the source package's basenames, unchanged, so any row in that manifest can be
// matched to a delivered file by name alone. That is worth more than tidier names.
//
// Nothing here is re-encoded. All six videos carry a video stream and no audio stream, which
// scripts/check-video.mjs re-proves with ffprobe on every check run rather than trusting this note.
//
// These are Brawley files and they appear on Brawley surfaces only. D-VIP-6: no clean footage exists
// for Santarosa, Venice, Carmel or the concepts, and borrowing one vehicle's footage for another
// page would be a claim about a machine that is not in the frame.

const BASE = "/assets/video/brawley";

// Every delivered frame and poster is 1900 by 900, which is the source clip's own size. Declared
// once: the poster and the video must share one box exactly, or the switch from one to the other
// moves the layout.
export const AMBIENT_WIDTH = 1900;
export const AMBIENT_HEIGHT = 900;
const POSTER_RUNGS = [960, 1280, 1900];

// src is the widest rung for the hero, which is eagerly fetched and is meant to be the LCP element,
// and the middle rung for the two below-fold blocks, which is what a browser with no srcset support
// would land on there.
const poster = (stem, alt, { src = 1280 } = {}) => ({
  src: `${BASE}/${stem}-${src}.webp`,
  srcset: POSTER_RUNGS.map((width) => `${BASE}/${stem}-${width}.webp ${width}w`).join(", "),
  width: AMBIENT_WIDTH,
  height: AMBIENT_HEIGHT,
  alt,
});

// Alt text describes only what is in the frame. No terrain, weather, location, model year, trim or
// performance claim is inferred from footage, which is the video plan's section 8 rule.
export const heroLoop = {
  webm: `${BASE}/brawley-canyon-hero-36-46.webm`,
  mp4: `${BASE}/brawley-canyon-hero-36-46.mp4`,
  // The vehicle sits right of centre and a little above the middle of the frame, so the focal point
  // holds it in the window at every width, including the tall crop a phone takes.
  focal: "58% 45%",
  poster: poster("brawley-canyon-hero-poster", "Red Vanderhall Brawley driving head-on through dust on a canyon trail at sunrise", { src: 1900 }),
};

export const brawleyMontage = {
  webm: `${BASE}/brawley-canyon-montage-00-12.webm`,
  mp4: `${BASE}/brawley-canyon-montage-00-12.mp4`,
  focal: "50% 45%",
  label: "BRAWLEY IN MOTION",
  poster: poster("brawley-canyon-montage-00-12-poster", "Dark Vanderhall Brawley driving away along a rocky ledge, trailing dust"),
};

export const gtsAction = {
  webm: `${BASE}/brawley-canyon-action-13-23.webm`,
  mp4: `${BASE}/brawley-canyon-action-13-23.mp4`,
  focal: "45% 45%",
  label: "BRAWLEY GTS IN MOTION",
  // The GTS badge is legible on the door in this frame, so naming the trim here restates something
  // visible rather than inferring it from the footage.
  poster: poster("brawley-canyon-action-13-23-poster", "Dark Vanderhall Brawley GTS in profile, climbing a dirt slope"),
};

// One list, so the check scripts can assert the delivered set against the same source the pages
// render from rather than against a second copy of the filenames.
export const ambientVideos = [heroLoop, brawleyMontage, gtsAction];
