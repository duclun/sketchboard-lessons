/*
 * Sketchboard engine: turns lesson JSON into a pencil-on-paper GSAP timeline.
 *
 * Requires GSAP 3 core (window.gsap) and the DOM from player/index.html
 * (ids: svg, world, pencil, pBody, pTip, cap, play, replay, speed, scrub,
 * chapters, tabs, json, run, reset, err).
 *
 * Usage:  Sketchboard.init({ lessons: [lessonObj, ...], start: "lesson-id" })
 * Inspect: window.sketchboard -> { lesson, timeline, duration(), chapters, load(id|obj), seek(sec) }
 *
 * Lesson format and every action: docs/lesson-format.md
 */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const $ = id => document.getElementById(id);

  // Named colors usable in any "color" field. Any CSS hex also works.
  const COL = {
    ink: "#1d1d1f", blue: "#2f5fd0", orange: "#e2673f", green: "#2e8b57", grey: "#5b5b5b",
    red: "#c0392b", soft: "#8a8780", paper: "#f7f5f0", yellow: "#f2b630", brown: "#8a5a3b",
    purple: "#7a4fc4", teal: "#1f8a8a"
  };
  const col = c => COL[c] || c || COL.ink;
  const FONT = { display: "var(--display)", mono: "var(--mono)", hand: "var(--hand)" };
  const PER = 0.34; // seconds per spoken word; caption highlight and step length follow it

  let svg, defs, world, pencil, pBody, pTip, capEl, playB, scrub, speedB, chapEl, tabs, jsonEl, errEl;
  let tl = null, cam, pen, windows, colors, chapters, stops, lastT = 0, speed = 1, current = null, lastWin = -1;
  let LESSONS = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  }
  // Hand-drawn segment: a slightly bent quadratic with jittered ends.
  function rough(x1, y1, x2, y2) {
    const j = () => (rnd() - .5) * 1.6;
    return `M${x1 + j()},${y1 + j()} Q${(x1 + x2) / 2 + j() * 2},${(y1 + y2) / 2 + j() * 2} ${x2 + j()},${y2 + j()}`;
  }
  function polyPath(pts, close) {
    let d = "";
    const n = close ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const s = rough(a[0], a[1], b[0], b[1]);
      d += i ? s.replace("M", "L") : s;
    }
    return d;
  }
  function circlePath(cx, cy, r) {
    const j = () => (rnd() - .5) * 1.4;
    return `M${cx - r + j()},${cy + j()} a${r},${r} 0 1 1 ${2 * r},0 a${r},${r} 0 1 1 ${-2 * r + j()},${j()}`;
  }
  function applyCam() { world.setAttribute("transform", `translate(${200 - cam.s * cam.x},${250 - cam.s * cam.y}) scale(${cam.s})`); }
  function place() { pencil.setAttribute("transform", `translate(${200 - cam.s * cam.x + cam.s * pen.x},${250 - cam.s * cam.y + cam.s * pen.y})`); }

  function build(L) {
    if (tl) tl.kill();
    world.innerHTML = "";
    defs.querySelectorAll("clipPath").forEach(n => n.remove());
    seed = 7; cam = { x: 200, y: 250, s: 1 }; pen = { x: 200, y: 560 }; applyCam(); place();
    windows = []; colors = []; chapters = []; stops = []; lastWin = -1; lastT = 0;
    tl = gsap.timeline({ paused: true, onUpdate: onPlay, onComplete: () => { playB.textContent = "Play"; } });
    let T = 0, bg, fg, scene;
    const newScene = () => { scene = el("g", {}, world); bg = el("g", {}, scene); fg = el("g", {}, scene); };
    newScene();
    const travel = (x, y) => {
      const d = Math.min(.4, Math.max(.12, Math.hypot(x - pen.x0, y - pen.y0) / 600 + .1));
      tl.to(pen, { x, y, duration: d, ease: "power2.inOut", onUpdate: place }, T);
      T += d; pen.x0 = x; pen.y0 = y;
    };
    pen.x0 = pen.x; pen.y0 = pen.y;
    const tint = c => colors.push({ t: T, c });

    function stroke(d, c, w, dur) {
      tint(c);
      const p = el("path", { d, stroke: c, "stroke-width": w, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, fg);
      const len = p.getTotalLength() || 1;
      p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
      const s = p.getPointAtLength(0); travel(s.x, s.y);
      const o = { t: 0 };
      tl.to(o, { t: 1, duration: dur, ease: "power1.inOut", onUpdate() {
        p.style.strokeDashoffset = len * (1 - o.t);
        const q = p.getPointAtLength(len * o.t);
        pen.x = q.x; pen.y = q.y; pen.x0 = q.x; pen.y0 = q.y; place();
      } }, T);
      T += dur;
    }
    const lenDur = len => Math.min(1.1, Math.max(.35, len / 260));
    const polyLen = (pts, close) => {
      let l = 0; const n = close ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; l += Math.hypot(a[0] - b[0], a[1] - b[1]); }
      return l;
    };
    function shapeOf(o, kind) {
      kind = kind || o.op;
      if (kind === "rect") return { kind: "poly", pts: [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]], close: true };
      return { kind, pts: o.pts, close: o.close, cx: o.cx, cy: o.cy, r: o.r };
    }
    function bbox(s) {
      if (s.kind === "circle") return { x: s.cx - s.r, y: s.cy - s.r, w: 2 * s.r, h: 2 * s.r };
      const xs = s.pts.map(p => p[0]), ys = s.pts.map(p => p[1]);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    // Scribble fill: a zig-zag hatch sweeps left to right inside a clip of the shape.
    function fillShape(s, color, alpha, dur) {
      const b = bbox(s), id = "c" + Math.round(rnd() * 1e9);
      const clip = el("clipPath", { id }, defs);
      if (s.kind === "circle") el("circle", { cx: s.cx, cy: s.cy, r: s.r }, clip);
      else el("polygon", { points: s.pts.map(p => p.join(",")).join(" ") }, clip);
      const g = el("g", { "clip-path": `url(#${id})` }, bg);
      const solid = el("rect", { x: b.x, y: b.y, width: 0, height: b.h, fill: color, opacity: alpha }, g);
      let d = `M${b.x},${b.y}`;
      for (let xx = b.x, i = 0; xx <= b.x + b.w + 4; xx += 4, i++) d += ` L${xx + (rnd() - .5)},${i % 2 ? b.y : b.y + b.h}`;
      const hp = el("path", { d, stroke: "#fff", opacity: .3, "stroke-width": 1.2, fill: "none" }, g);
      const len = hp.getTotalLength() || 1;
      hp.style.strokeDasharray = len; hp.style.strokeDashoffset = len;
      tint(color); travel(b.x, b.y + b.h);
      const o = { t: 0 };
      tl.to(o, { t: 1, duration: dur, ease: "none", onUpdate() {
        hp.style.strokeDashoffset = len * (1 - o.t); solid.setAttribute("width", b.w * o.t);
        const q = hp.getPointAtLength(len * o.t);
        pen.x = q.x; pen.y = q.y; pen.x0 = q.x; pen.y0 = q.y; place();
      } }, T);
      T += dur;
    }
    function writeText(o) {
      const size = o.size || 14, c = col(o.color), str = String(o.t), anchor = o.anchor || "middle", fam = FONT[o.font] || FONT.display;
      const t = el("text", { x: o.x, y: o.y, "font-size": size, "text-anchor": anchor, fill: c, stroke: c,
        "stroke-width": o.font === "hand" || o.font === "mono" ? 0 : .9, style: `font-family:${fam};paint-order:stroke` }, fg);
      t.textContent = str; t.style.fillOpacity = 0; t.style.strokeDasharray = 1000; t.style.strokeDashoffset = 1000;
      const w = str.length * size * (o.font === "mono" ? .6 : o.font === "hand" ? .45 : .62);
      const x0 = anchor === "middle" ? o.x - w / 2 : anchor === "end" ? o.x - w : o.x;
      tint(c); travel(x0, o.y - size * .4);
      const dur = Math.min(1.1, .25 + str.length * .04), p = { t: 0 };
      tl.to(p, { t: 1, duration: dur, ease: "none", onUpdate() {
        t.style.strokeDashoffset = 1000 * (1 - p.t);
        pen.x = x0 + w * p.t; pen.y = o.y - size * .4 + Math.sin(p.t * 40) * size * .25;
        pen.x0 = pen.x; pen.y0 = pen.y; place();
      } }, T);
      tl.to(t, { fillOpacity: 1, duration: .25 }, T + dur * .6);
      T += dur;
    }

    (L.steps || []).forEach((st, i) => {
      const t0 = T, words = String(st.say || "").split(/\s+/).filter(Boolean);
      chapters.push({ title: st.title || `Step ${i + 1}`, t: t0 });
      windows.push({ t0, words });
      (st.do || []).forEach(o => {
        const c = col(o.color), w = o.lw || 2.2;
        switch (o.op) {
          case "line": stroke(rough(o.x1, o.y1, o.x2, o.y2), c, w, o.dur || lenDur(Math.hypot(o.x2 - o.x1, o.y2 - o.y1))); break;
          case "poly": stroke(polyPath(o.pts, o.close), c, w, o.dur || lenDur(polyLen(o.pts, o.close))); break;
          case "rect": { const pts = [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]]; stroke(polyPath(pts, true), c, w, o.dur || lenDur(polyLen(pts, true))); break; }
          case "circle": stroke(circlePath(o.cx, o.cy, o.r), c, w, o.dur || lenDur(2 * Math.PI * o.r)); break;
          case "path": stroke(o.d, c, w, o.dur || .8); break;
          case "text": writeText(o); break;
          case "fill": { const s = shapeOf(o, o.of); const b = bbox(s); fillShape(s, c, o.a ?? .55, o.dur || .4 + b.w / 320); break; }
          case "cam": { const dur = o.dur || 1; tl.to(cam, { x: o.x ?? 200, y: o.y ?? 250, s: o.s ?? 1, duration: dur, ease: "power3.inOut", onUpdate() { applyCam(); place(); } }, T); T += dur; break; }
          case "clear": { tl.to(scene, { opacity: 0, duration: .5 }, T); T += .5; newScene(); break; }
          case "hold": T += o.s || .5; break;
          default: console.warn(`Sketchboard: unknown op "${o.op}" in step ${i + 1}; skipped.`);
        }
      });
      const spoken = t0 + words.length * PER + .35;
      T = Math.max(T, spoken) + (st.hold ?? .25);
      // "pause": stop at the end of the step so the student can think, answer, or predict.
      if (st.pause) stops.push(T - .01);
    });
    T += .8;
    tl.to({}, { duration: 0 }, T); // pin the end
    tl.timeScale(speed);
    buildChapters();
    tick();
  }

  function buildChapters() {
    chapEl.innerHTML = "";
    chapters.forEach((c, i) => {
      const li = document.createElement("li"), b = document.createElement("button");
      const n = document.createElement("small"); n.textContent = i + 1;
      b.append(n, document.createTextNode(c.title));
      b.onclick = () => { tl.time(c.t + .001); if (tl.paused()) playB.textContent = "Play"; };
      li.appendChild(b); chapEl.appendChild(li);
    });
  }

  // While playing forward, stop at each "pause" step end. Seeks and scrubs pause first or jump
  // further than a frame, so they never trigger a stop.
  function onPlay() {
    const t = tl.time();
    if (!tl.paused() && t > lastT && t - lastT < .5 * Math.max(1, tl.timeScale())) {
      const s = stops.find(p => p > lastT + 1e-3 && p <= t); // GSAP rounds time(), so allow slack
      // Changing the playhead inside GSAP's own render can loop forever, so stop right after it.
      if (s !== undefined) { lastT = s; queueMicrotask(() => { tl.pause(); tl.time(s); playB.textContent = "Continue"; }); return; }
    }
    lastT = t;
    tick();
  }

  // Everything is derived from the playhead so scrubbing in either direction stays correct.
  function tick() {
    const t = tl.time();
    scrub.value = Math.round(tl.progress() * 1000);
    let wi = -1;
    for (let i = 0; i < windows.length; i++) { if (windows[i].t0 <= t + 1e-6) wi = i; else break; }
    if (wi !== lastWin) {
      capEl.textContent = "";
      if (wi >= 0) windows[wi].words.forEach(w => { const s = document.createElement("span"); s.textContent = w; capEl.appendChild(s); });
      lastWin = wi;
    }
    if (wi >= 0) {
      const w = windows[wi], idx = Math.floor((t - w.t0) / PER);
      [...capEl.children].forEach((s, j) => { s.className = j < idx ? "said" : j === idx ? "on" : ""; });
    }
    let c = COL.ink;
    for (const k of colors) { if (k.t <= t + 1e-6) c = k.c; else break; }
    pBody.setAttribute("fill", c); pTip.setAttribute("fill", c);
    [...chapEl.children].forEach((li, i) => li.firstChild.classList.toggle("now", i === wi));
  }

  function addTab(L) {
    const b = document.createElement("button");
    b.textContent = L.title || "My lesson"; b.dataset.id = L.id;
    b.onclick = () => load(L);
    tabs.appendChild(b);
  }

  function load(L) {
    if (typeof L === "string") L = LESSONS.find(x => x.id === L) || LESSONS[0];
    current = L;
    [...tabs.children].forEach(b => b.setAttribute("aria-pressed", String(b.dataset.id === L.id)));
    jsonEl.value = JSON.stringify(L, null, 1); errEl.textContent = "";
    document.title = (L.title ? L.title + " · " : "") + "Sketchboard";
    build(L);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const still = new URLSearchParams(location.search).has("still");
    if (reduce || still) { tl.progress(1); playB.textContent = "Play"; } else { tl.play(); playB.textContent = "Pause"; }
  }

  function init(opts) {
    svg = $("svg"); defs = svg.querySelector("defs"); world = $("world"); pencil = $("pencil"); pBody = $("pBody"); pTip = $("pTip");
    capEl = $("cap"); playB = $("play"); scrub = $("scrub"); speedB = $("speed"); chapEl = $("chapters");
    tabs = $("tabs"); jsonEl = $("json"); errEl = $("err");
    LESSONS = (opts.lessons || []).map((L, i) => ({ ...L, id: L.id || "lesson" + (i + 1) }));
    tabs.innerHTML = "";
    LESSONS.forEach(addTab);

    playB.onclick = () => {
      if (tl.progress() === 1) tl.restart(); else tl.paused(!tl.paused());
      playB.textContent = tl.paused() ? "Play" : "Pause";
    };
    $("replay").onclick = () => { tl.restart(); playB.textContent = "Pause"; };
    const speeds = [1, .5, 2]; let si = 0;
    speedB.onclick = () => { si = (si + 1) % 3; speed = speeds[si]; tl.timeScale(speed); speedB.textContent = `Speed ${speed}×`; };
    scrub.oninput = () => { tl.pause(); tl.progress(scrub.value / 1000); playB.textContent = "Play"; };
    $("run").onclick = () => {
      try {
        const L = JSON.parse(jsonEl.value);
        if (!Array.isArray(L.steps)) throw new Error('Lesson needs a "steps" array.');
        L.id = L.id || "custom";
        const i = LESSONS.findIndex(x => x.id === L.id);
        if (i >= 0) LESSONS[i] = L; else { LESSONS.push(L); addTab(L); }
        const keep = jsonEl.value; load(L); jsonEl.value = keep;
      } catch (e) { errEl.textContent = "Could not run: " + e.message; }
    };
    $("reset").onclick = () => load(current);

    window.sketchboard = {
      get lesson() { return current; },
      get timeline() { return tl; },
      get chapters() { return chapters.slice(); },
      duration: () => tl.duration(),
      load, seek: s => { tl.pause(); tl.time(s); playB.textContent = "Play"; },
      colors: { ...COL }, secondsPerWord: PER
    };

    if (!LESSONS.length) { errEl.textContent = "No lessons loaded. Paste lesson JSON in the editor and press Run."; $("editor").open = true; return; }
    load(opts.start || new URLSearchParams(location.search).get("lesson") || LESSONS[0].id);
  }

  window.Sketchboard = { init, COLORS: COL, SECONDS_PER_WORD: PER };
})();
