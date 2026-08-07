// The one ambient film. V10 shipped three loops; V11-A kept the rock-ledge montage; V13 planned its
// replacement (Plans/V13-plan.md 7.7 and 7.8) and held it back behind publication rights. Owen
// instructed delivery in chat on 2026-08-06, so the montage is retired and the homepage carries one
// play-once film cut from the new Brawley master. /brawley/ and /brawley/gts/ still ship no motion
// footage at all, per D-V11-2 and D-V11-3.
//
// Provenance: cut from Assets/Source Video/Brawley/brawley-final-master.mp4, the 62.059-second
// 3840x2160 master inspected for V13 planning on 2026-08-06. The trim starts at exactly 25.000
// seconds, which is Owen's approved cut past the studio reveal, and ends at 59.500 seconds rather
// than the master's end: the master fades to full black across its final two seconds, and holding a
// black panel behind the homepage h1 is not what "hold on the final frame" was for. Owen approved
// "up until the minute" in chat on 2026-08-06; 59.500 is the last clean moment of the close front
// view before the fade begins. Do not re-derive either timestamp from scene detection.
//
// Provenance is not written publication permission: rights, likeness and location status for this
// footage remain unconfirmed and stay on the open-items list (INTEGRATION.md `brawley-film`).
// Delivery happened on Owen's instruction; the paperwork is still a Vanderhall ask.
//
// Both files are re-encoded from the master (1920x1080, one video stream each) and the audio stream
// was removed deliberately, not omitted by accident: the page offers no volume control and no
// unmute affordance, so a track nobody can reach must not ship. scripts/check-video.mjs re-proves
// stream counts, codecs, the byte budget, and the start and final frames with ffprobe/ffmpeg on
// every check run rather than trusting this note.
//
// These are Brawley files. D-VIP-6 said they may appear on Brawley surfaces only; the homepage is
// not a vehicle page and makes no claim about a machine, so the lineup's own flagship opening the
// site is the one placement outside /brawley/ that says nothing a photograph would not.

const BASE = "/assets/video/brawley";

// Every delivered frame and poster is 1920 by 1080, the master's own aspect at half scale. Declared
// once: the poster and the video must share one box exactly, or the switch from one to the other
// moves the layout.
export const AMBIENT_WIDTH = 1920;
export const AMBIENT_HEIGHT = 1080;
const POSTER_RUNGS = [960, 1280, 1920];

// src is the widest rung, because this poster is eagerly fetched and is meant to be the LCP element.
const poster = (stem, alt, { src = 1920 } = {}) => ({
  src: `${BASE}/${stem}-${src}.webp`,
  srcset: POSTER_RUNGS.map((width) => `${BASE}/${stem}-${width}.webp ${width}w`).join(", "),
  width: AMBIENT_WIDTH,
  height: AMBIENT_HEIGHT,
  alt,
});

// Alt text describes only what is in the frame. No terrain, weather, location, model year, trim or
// performance claim is inferred from footage, which is the video plan's section 8 rule. The one
// alt below serves both delivered frames (the picture element switches sources at 768px but an img
// carries a single alt), so it states only what is true in both: a dark Vanderhall Brawley in open
// desert terrain.
//
// The poster is the film's own first frame, the 25.000-second action start, so the crossfade from
// poster to motion is a moment of the same scene rather than a scene change.
//
// V16-D, Owen on 2026-08-06: below 768px the homepage carries no video experience at all, so the
// phone hero is a designed still rather than the film's opening frame. The wide 16:9 poster
// cover-cropped into the tall mobile hero upscaled roughly 2x and read as a stalled player; these
// tall rungs are cut at full quality from the master's frame 1426 (~59.476s, extracted at 59.49s,
// mid-frame), the same clean close front view the delivered cut ends on, centered 1728x2160 from
// the 3840x2160 frame. That frame carries no burned-in caption band, which every earlier frame
// does; a still that clips the caption mid-line was not an option, and every static photograph on
// this site ships without one. Do not re-derive the timestamp from scene detection, and reproduce
// the rungs with `npm run images` (the film-stills section of scripts/process-images.mjs).
const TALL_RUNGS = [480, 720, 800, 960];
export const heroFilm = {
  webm: `${BASE}/brawley-film-25-60.webm`,
  mp4: `${BASE}/brawley-film-25-60.mp4`,
  focal: "50% 50%",
  poster: poster("brawley-film-25-60-poster", "Dark Vanderhall Brawley in open desert terrain"),
  tallSrcset: TALL_RUNGS.map((width) => `${BASE}/brawley-film-25-60-final-tall-${width}.webp ${width}w`).join(", "),
};

// One list, so the check scripts can assert the delivered set against the same source the pages
// render from rather than against a second copy of the filenames. One item now, and the shape is
// kept rather than collapsed: the check that walks it is the check that would catch a second film
// arriving without a placement decision.
export const ambientVideos = [heroFilm];
