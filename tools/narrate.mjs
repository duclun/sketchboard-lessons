#!/usr/bin/env node
// Synthesize per-step narration audio for a lesson with the tts CLI.
//
// Usage:
//   node tools/narrate.mjs lessons/my-lesson.json [--voice ID] [--speed N] [--force]
//
// For every step with a non-empty "say", writes audio/<id>/step-NN.mp3,
// measures its duration, and stamps "audio": {"src", "dur", "hash"} onto the
// step. The hash covers the normalized text, voice and speed, so a re-run
// regenerates a step whose "say" changed (or was reordered) instead of
// silently reusing a stale recording. Steps without narration are skipped.
// The lesson file is rewritten with the canonical formatting from
// tools/format.mjs.
//
// TTS backend contract. Needs a `tts` CLI honoring:
//   tts speak --voice ID --speed N --format mp3 --output FILE --text-stdin
//   (reads the narration text from stdin, writes an MP3 file)
// Looked up as: $SKETCHBOARD_TTS, then /opt/hatch/bin/tts, then `tts` on
// PATH. Point SKETCHBOARD_TTS at a wrapper script to plug in another engine.
// ffprobe is used for durations; without it the tool warns loudly and falls
// back to the 0.34 s/word estimate.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatLesson } from "./format.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_VOICE = "avocado_v2:MAI_01"; // Meta AI "Warm"
const PER = 0.34; // fallback seconds per word, matches the player estimate

// Make caption text speakable: the pedagogy guide already asks for plain
// sentences, but symbols sneak in ("3 ÷ 6", "90°").
const normalize = s => String(s)
  .replace(/÷/g, " divided by ")
  .replace(/×/g, " times ")
  .replace(/→/g, " then ")
  .replace(/°/g, " degrees ")
  .replace(/&/g, " and ")
  .replace(/=/g, " equals ")
  .replace(/\s+/g, " ")
  .trim();

function findTts() {
  if (process.env.SKETCHBOARD_TTS) return process.env.SKETCHBOARD_TTS;
  for (const p of ["/opt/hatch/bin/tts", "/usr/local/bin/tts"]) {
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* next */ }
  }
  try { execFileSync("which", ["tts"], { stdio: "pipe" }); return "tts"; }
  catch { return null; }
}

const hashOf = (text, voice, speed) =>
  createHash("sha256").update(`${voice}|${speed}|${text}`).digest("hex").slice(0, 12);

// Exported for tools/validate.mjs, which recomputes the hash to catch a
// "say" edited after narrating.
export { normalize, hashOf };

let warnedNoFfprobe = false;
function measure(file, words) {
  try {
    const out = execFileSync("ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const d = parseFloat(out);
    if (Number.isFinite(d) && d > 0) return Math.round(d * 100) / 100;
  } catch { /* fall through to the estimate below */ }
  if (!warnedNoFfprobe) {
    warnedNoFfprobe = true;
    console.error("WARNING: ffprobe not found — stamping word-estimate durations, not measured audio.");
    console.error("         Step timing may not match the recordings (clipped clips or dead air). Install ffprobe and re-run with --force.");
  }
  return Math.round(words * PER * 100) / 100;
}

function main() {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith("--"));
  let voice = DEFAULT_VOICE, speed = 100, force = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--voice") voice = args[++i];
    if (args[i] === "--speed") speed = Number(args[++i]) || 100;
    if (args[i] === "--force") force = true;
  }
  if (!file) { console.error("usage: node tools/narrate.mjs lessons/<id>.json [--voice ID] [--speed N] [--force]"); process.exit(2); }

  const tts = findTts();
  if (!tts) {
    console.error("narrate: no TTS backend found (looked for $SKETCHBOARD_TTS, /opt/hatch/bin/tts and `tts` on PATH).");
    process.exit(1);
  }

  const lessonPath = path.resolve(process.cwd(), file);
  const L = JSON.parse(fs.readFileSync(lessonPath, "utf8"));
  if (!L.id) { console.error("narrate: lesson needs an \"id\" (used for the audio directory)."); process.exit(1); }
  const outDir = path.join(root, "audio", L.id);
  fs.mkdirSync(outDir, { recursive: true });

  let done = 0, skipped = 0;
  L.steps.forEach((st, i) => {
    const words = String(st.say || "").split(/\s+/).filter(Boolean);
    if (!words.length) { console.log(`  step ${i + 1}: no "say", skipped`); skipped++; return; }
    const norm = normalize(st.say);
    const hash = hashOf(norm, voice, speed);
    const nn = String(i + 1).padStart(2, "0");
    const out = path.join(outDir, `step-${nn}.mp3`);
    // Regenerate when forced, when the file is missing, or when the recorded
    // text/voice/speed no longer matches the hash (edited or reordered steps).
    const stale = !st.audio || st.audio.hash !== hash;
    if (fs.existsSync(out) && !force && !stale) {
      console.log(`  step ${i + 1}: up to date, skipped`);
    } else {
      if (stale && fs.existsSync(out) && !force)
        console.log(`  step ${i + 1}: text/voice/speed changed, re-synthesizing`);
      execFileSync(tts,
        ["speak", "--voice", voice, "--speed", String(speed), "--format", "mp3", "--output", out, "--text-stdin"],
        { input: norm, stdio: ["pipe", "pipe", "pipe"] });
      console.log(`  step ${i + 1}: synthesized ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
    }
    const dur = measure(out, words.length);
    st.audio = { src: `audio/${L.id}/step-${nn}.mp3`, dur, hash };
    done++;
  });

  L.narration = { voice, speed };
  fs.writeFileSync(lessonPath, formatLesson(L));
  console.log(`narrated ${done} step${done === 1 ? "" : "s"} (${skipped} skipped) -> ${path.relative(process.cwd(), lessonPath)}`);
  console.log("run tools/format.mjs if you hand-edited the file afterwards, then tools/validate.mjs.");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
