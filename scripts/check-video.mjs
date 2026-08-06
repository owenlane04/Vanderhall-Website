// Proves, on every check run, the properties of the delivered film that cannot be read from the
// markup. The original reason stands from V10: no file may carry an audio stream, because the film
// is never offered a volume control or an unmute affordance, so a file that arrived with audio would
// either play sound nobody asked for or ship a silent track the visitor has no way to reach. The
// master's audio was removed deliberately at encode time, not omitted by accident, and this is the
// check that keeps that true.
//
// The V13 film adds the contract Plans/V13-plan.md 7.8 and INTEGRATION.md `brawley-film` ask for:
// the exact delivered pair, duration within a frame-accurate tolerance, an explicit byte budget,
// codecs, dimensions, frame rate, MP4 fast start, and start- and final-frame fingerprints, so a
// derivative cut from the wrong part of the master fails here rather than shipping.
//
// The fingerprints are 64 by 36 grayscale renders of the master's own frames, stored in
// scripts/lib/film-refs/ and generated on 2026-08-06:
//   - start: the first master frame at or after 25.000 seconds, which is Owen's approved cut past
//     the studio reveal;
//   - final: master frame 1426 (~59.476 seconds), the last frame of the delivered cut, the clean
//     close front view before the master's fade to black begins.
// A delivered frame is compared by mean absolute pixel difference. Calibration against the master:
// the delivered files measure 0.08 to 0.42 and the poster 1.83, while a cut one frame off measures
// 3.06 and the studio reveal 97.4, so the 2.5 threshold sits between everything legitimate and the
// nearest possible mistake. The tolerance deliberately spans an encoder's noise, not a re-cut:
// catching a wrong segment is the job, not proving bit-identity.
//
// This does not trust the delivery note in src/data/video.mjs; it re-derives every fact from the
// files. ffprobe and ffmpeg are real dependencies of `npm run check` and this script fails rather
// than skipping when they are absent, because a check that quietly passes when it cannot run is
// worse than no check.
import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const videoDir = resolve(root, "assets/video/brawley");
const refsDir = resolve(root, "scripts/lib/film-refs");
const failures = [];

for (const tool of ["ffprobe", "ffmpeg"]) {
  try {
    await run(tool, ["-version"]);
  } catch {
    console.error(`Video checks failed: ${tool} is not on PATH. Install it with \`brew install ffmpeg\`, then run \`npm run check\` again.`);
    process.exit(1);
  }
}

const STEM = "brawley-film-25-60";
// Two files, and they are named. The count alone would pass if the film were swapped for a stray
// re-encode under another name, which is the mistake worth catching: the placement decision is per
// clip, not per file count.
const entries = (await readdir(videoDir)).filter((name) => /\.(?:webm|mp4)$/.test(name)).sort();
const EXPECTED_VIDEO_FILES = [`${STEM}.mp4`, `${STEM}.webm`];
if (JSON.stringify(entries) !== JSON.stringify(EXPECTED_VIDEO_FILES)) {
  failures.push(`Expected exactly ${EXPECTED_VIDEO_FILES.join(" and ")}, found ${entries.join(", ") || "none"}`);
}

// The delivered cut is 827 frames at 24000/1001 fps, 34.4928 seconds of stream time. The two
// containers legitimately report it slightly differently (the MP4 reports 34.4928, the WebM rounds
// its last frame out to 34.535), so the window spans both and still rejects a cut that gained or
// lost even a handful of frames.
const DURATION_RANGE = [34.45, 34.58];
// Measured on 2026-08-06: the WebM is 7,842,968 bytes and the MP4 12,950,302. The budgets sit just
// above the delivered sizes; a re-encode that blows through one is a decision to make deliberately,
// not a diff to wave through.
const PER_FILE = {
  [`${STEM}.webm`]: { codec: "vp9", budget: 9_000_000 },
  [`${STEM}.mp4`]: { codec: "h264", budget: 14_000_000 },
};

const FRAME_BYTES = 64 * 36;
const MAD_MAX = 2.5;
const refs = {};
for (const which of ["start", "final"]) {
  refs[which] = await readFile(resolve(refsDir, `${STEM}-${which}-64x36.gray`));
  if (refs[which].length !== FRAME_BYTES) failures.push(`Reference fingerprint ${which} is ${refs[which].length} bytes, expected ${FRAME_BYTES}`);
}
const mad = (a, b) => {
  let sum = 0;
  for (let i = 0; i < FRAME_BYTES; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum / FRAME_BYTES;
};
// One 64x36 grayscale frame from anywhere ffmpeg can decode. From the start that is the first frame;
// from the end it is the last frame that decodes after a seek near the tail, so the same helper
// cannot quietly compare the wrong end of the file.
const grayFrame = async (path, { fromEnd = false } = {}) => {
  const args = fromEnd
    ? ["-v", "error", "-ss", "34.2", "-i", path, "-vf", "scale=64:36,format=gray", "-f", "rawvideo", "-"]
    : ["-v", "error", "-i", path, "-frames:v", "1", "-vf", "scale=64:36,format=gray", "-f", "rawvideo", "-"];
  const { stdout } = await run("ffmpeg", args, { encoding: "buffer", maxBuffer: 1 << 25 });
  if (stdout.length < FRAME_BYTES) return null;
  return fromEnd ? stdout.subarray(stdout.length - FRAME_BYTES) : stdout.subarray(0, FRAME_BYTES);
};

// MP4 fast start: the moov box must precede the mdat box, or every visitor streams the whole file
// before the first frame can be decoded. Read from the container's own top-level boxes rather than
// trusting that the encode flag was present.
const moovBeforeMdat = (buffer) => {
  const offsets = {};
  let cursor = 0;
  while (cursor + 8 <= buffer.length) {
    let size = buffer.readUInt32BE(cursor);
    const type = buffer.toString("latin1", cursor + 4, cursor + 8);
    if (size === 1) size = Number(buffer.readBigUInt64BE(cursor + 8));
    else if (size === 0) size = buffer.length - cursor;
    if (offsets[type] === undefined) offsets[type] = cursor;
    if (size < 8) return false;
    cursor += size;
  }
  return offsets.moov !== undefined && offsets.mdat !== undefined && offsets.moov < offsets.mdat;
};

const report = [];
for (const name of entries) {
  const path = resolve(videoDir, name);
  const expected = PER_FILE[name];
  if (!expected) continue;
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate",
    "-show_entries", "format=duration,size",
    "-of", "json",
    path,
  ]);
  const probed = JSON.parse(stdout);
  const streams = probed.streams || [];
  const audio = streams.filter((stream) => stream.codec_type === "audio");
  const video = streams.filter((stream) => stream.codec_type === "video");
  const duration = Number(probed.format?.duration);
  const size = Number(probed.format?.size);
  if (audio.length) failures.push(`${name}: carries ${audio.length} audio stream(s), and nothing on the page can control sound`);
  // One stream, not merely one video stream: the first MP4 encode of this film arrived with the
  // master's tmcd timecode track riding along, which is exactly the kind of passenger this catches.
  if (streams.length !== 1 || video.length !== 1) failures.push(`${name}: expected exactly one stream, a video stream, found ${streams.map((stream) => stream.codec_type).join(", ")}`);
  // Both codecs are asserted by extension, because the source order in the markup promises the
  // browser a specific one: a WebM that turned out to hold H.264 would be offered to a browser that
  // cannot decode it, and it would silently fall through to nothing.
  if (video[0]?.codec_name !== expected.codec) failures.push(`${name}: expected ${expected.codec}, found ${video[0]?.codec_name}`);
  // The poster and the video have to be the same box, and the poster's declared box is asserted in
  // check-content. This is the other half of that claim.
  if (video[0]?.width !== 1920 || video[0]?.height !== 1080) failures.push(`${name}: expected 1920 by 1080, found ${video[0]?.width} by ${video[0]?.height}`);
  if (video[0]?.r_frame_rate !== "24000/1001") failures.push(`${name}: expected 24000/1001 fps, found ${video[0]?.r_frame_rate}`);
  if (!(duration >= DURATION_RANGE[0] && duration <= DURATION_RANGE[1])) failures.push(`${name}: duration ${duration}s is outside ${DURATION_RANGE.join(" to ")}s, so the cut gained or lost frames`);
  if (!(size <= expected.budget)) failures.push(`${name}: ${size} bytes is over the ${expected.budget} byte budget`);
  const start = await grayFrame(path);
  const final = await grayFrame(path, { fromEnd: true });
  const startMad = start && refs.start.length === FRAME_BYTES ? mad(start, refs.start) : Infinity;
  const finalMad = final && refs.final.length === FRAME_BYTES ? mad(final, refs.final) : Infinity;
  if (startMad > MAD_MAX) failures.push(`${name}: the first frame does not match the approved 25.000s cut (difference ${startMad === Infinity ? "undecodable" : startMad.toFixed(2)}, limit ${MAD_MAX})`);
  if (finalMad > MAD_MAX) failures.push(`${name}: the final frame does not match the approved close front view (difference ${finalMad === Infinity ? "undecodable" : finalMad.toFixed(2)}, limit ${MAD_MAX})`);
  if (name.endsWith(".mp4") && !moovBeforeMdat(await readFile(path))) failures.push(`${name}: moov does not precede mdat, so playback cannot start until the whole file arrives`);
  report.push({ name, codec: video[0]?.codec_name, duration: duration?.toFixed(3), size, startMad: startMad.toFixed(2), finalMad: finalMad.toFixed(2) });
}

// The poster must be the film's own first frame, not a related still: the crossfade from poster to
// motion is designed to be a moment of the same scene, and below the 768px gate the poster IS the
// film. The widest rung carries the fingerprint for all three, because the three rungs are one
// resize pipeline apart, not three editorial decisions.
const posterPath = resolve(videoDir, `${STEM}-poster-1920.webp`);
try {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "json", posterPath]);
  const posterStream = (JSON.parse(stdout).streams || [])[0] || {};
  if (posterStream.width !== 1920 || posterStream.height !== 1080) failures.push(`poster-1920: expected 1920 by 1080, found ${posterStream.width} by ${posterStream.height}`);
  const posterFrame = await grayFrame(posterPath);
  const posterMad = posterFrame ? mad(posterFrame, refs.start) : Infinity;
  if (posterMad > MAD_MAX) failures.push(`poster-1920: the poster is not the film's first frame (difference ${posterMad === Infinity ? "undecodable" : posterMad.toFixed(2)}, limit ${MAD_MAX})`);
} catch {
  failures.push("poster-1920: missing or unreadable, and the poster is the film's whole below-768px experience");
}

if (failures.length) {
  console.error(`Video checks failed (${failures.length}):\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`Video checks passed. ${entries.length} files, every one 1920 by 1080 at 24000/1001 with a single video stream, no audio, within budget, fast-started, and fingerprint-matched to the approved 25.000s cut:\n${report.map((row) => `  ${row.name}: ${row.codec} ${row.duration}s ${row.size} bytes, start ${row.startMad}, final ${row.finalMad}`).join("\n")}`);
