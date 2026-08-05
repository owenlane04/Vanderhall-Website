// Proves, on every check run, the one property of the delivered video that cannot be read from the
// markup: no file carries an audio stream. It matters because none of the three loops is ever offered
// a volume control or an unmute affordance, so a file that arrived with audio would either play sound
// nobody asked for or ship a silent track the visitor has no way to reach. The video plan's section 6
// asks for exactly this step.
//
// This does not trust the delivery note in src/data/video.mjs; it re-derives the fact from the files.
//
// ffprobe is a real dependency of `npm run check` and this script fails rather than skipping when it
// is absent, because a check that quietly passes when it cannot run is worse than no check.
import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const videoDir = resolve(root, "assets/video/brawley");
const failures = [];

try {
  await run("ffprobe", ["-version"]);
} catch {
  console.error("Video checks failed: ffprobe is not on PATH. Install it with `brew install ffmpeg`, then run `npm run check` again.");
  process.exit(1);
}

const entries = (await readdir(videoDir)).filter((name) => /\.(?:webm|mp4)$/.test(name)).sort();
if (entries.length !== 6) failures.push(`Expected six delivered video files, found ${entries.length}`);

const report = [];
for (const name of entries) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,codec_name,width,height",
    "-of", "json",
    resolve(videoDir, name),
  ]);
  const streams = JSON.parse(stdout).streams || [];
  const audio = streams.filter((stream) => stream.codec_type === "audio");
  const video = streams.filter((stream) => stream.codec_type === "video");
  report.push({ name, streams: streams.length, video: video[0]?.codec_name, width: video[0]?.width, height: video[0]?.height });
  if (audio.length) failures.push(`${name}: carries ${audio.length} audio stream(s), and nothing on the page can control sound`);
  if (video.length !== 1) failures.push(`${name}: expected one video stream, found ${video.length}`);
  // Both codecs are asserted by extension, because the source order in the markup promises the
  // browser a specific one: a WebM that turned out to hold H.264 would be offered to a browser that
  // cannot decode it, and it would silently fall through to nothing.
  const expected = name.endsWith(".webm") ? "vp9" : "h264";
  if (video[0]?.codec_name !== expected) failures.push(`${name}: expected ${expected}, found ${video[0]?.codec_name}`);
  // The poster and the video have to be the same box, and the poster's declared box is asserted in
  // check-content. This is the other half of that claim.
  if (video[0]?.width !== 1900 || video[0]?.height !== 900) failures.push(`${name}: expected 1900 by 900, found ${video[0]?.width} by ${video[0]?.height}`);
}

if (failures.length) {
  console.error(`Video checks failed (${failures.length}):\n${failures.join("\n")}`);
  process.exit(1);
}

console.log(`Video checks passed. ${entries.length} files, every one 1900 by 900 with a single video stream and no audio:\n${report.map((row) => `  ${row.name}: ${row.video} ${row.width}x${row.height}, ${row.streams} stream`).join("\n")}`);
