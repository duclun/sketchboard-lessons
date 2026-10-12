#!/usr/bin/env node
// Render a lesson in headless Chromium and save one PNG of the board at the end of every step,
// so an agent (or person) can look at the actual drawing and catch overlaps, clipping, or bad layout.
// Also reports real timeline length and any console errors.
//
// Usage: node tools/check.mjs lessons/my-lesson.json [--out checks/my-lesson]
// Needs Playwright: `npm install` (devDependency) or a global install; Chromium must be available.
// GSAP is served from node_modules/gsap if installed (or GSAP_PATH), otherwise from the CDN.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const oi = args.indexOf("--out");
const lessonFile = args.find((a, i) => !a.startsWith("--") && i !== oi + 1);
if (!lessonFile) { console.error("usage: node tools/check.mjs lessons/x.json [--out dir]"); process.exit(2); }
const L = JSON.parse(fs.readFileSync(lessonFile, "utf8"));
const outDir = oi >= 0 ? args[oi + 1] : path.join(root, "checks", L.id || path.basename(lessonFile, ".json"));

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { console.error("Playwright not found. Run `npm install` in the repo (or `npm i -g playwright`)."); process.exit(2); }

const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sketchboard-")), "lesson.html");
execFileSync(process.execPath, [path.join(root, "tools/build.mjs"), lessonFile, "-o", tmp], { stdio: "ignore" });
fs.mkdirSync(outDir, { recursive: true });

const launch = {};
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 1000, height: 820 }, deviceScaleFactor: 1 });
const problems = [];
page.on("console", m => { if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", e => problems.push("pageerror: " + e.message));
// Serve GSAP from node_modules when present, so checks also run offline or behind a strict proxy.
const localGsap = [path.join(root, "node_modules/gsap/dist/gsap.min.js"), process.env.GSAP_PATH].find(f => f && fs.existsSync(f));
if (localGsap) await page.route(/gsap(\.min)?\.js$/, r => r.fulfill({ path: localGsap, contentType: "text/javascript" }));
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.continue().catch(() => r.abort()));
await page.goto(pathToFileURL(tmp).href + "?still");
await page.waitForFunction(() => window.sketchboard && window.sketchboard.timeline, null, { timeout: 15000 });
await page.evaluate(() => document.fonts.ready);
const info = await page.evaluate(() => ({ duration: sketchboard.duration(), chapters: sketchboard.chapters }));
const ends = info.chapters.map((c, i) => (i + 1 < info.chapters.length ? info.chapters[i + 1].t - 0.05 : info.duration));
const stage = page.locator("#stageBox");
for (let i = 0; i < ends.length; i++) {
  await page.evaluate(t => sketchboard.seek(t), ends[i]);
  const f = path.join(outDir, `step-${String(i + 1).padStart(2, "0")}.png`);
  await stage.screenshot({ path: f });
}
await page.screenshot({ path: path.join(outDir, "full-page.png") });
await browser.close();

console.log(`${L.title}: ${info.chapters.length} steps, ${info.duration.toFixed(1)}s`);
info.chapters.forEach((c, i) => console.log(`  ${String(i + 1).padStart(2)}. ${c.title.padEnd(28)} starts ${c.t.toFixed(1)}s -> ${path.relative(process.cwd(), path.join(outDir, `step-${String(i + 1).padStart(2, "0")}.png`))}`));
if (problems.length) { console.log("console problems:"); problems.forEach(p => console.log("  " + p)); process.exitCode = 1; }
else console.log("no console errors");
