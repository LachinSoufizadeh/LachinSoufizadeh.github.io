/* Recording strip at the top of the page.
   It is an illustration built from synthetic signals, not real data:
   each trace is a sum of band-limited oscillations (delta to gamma), so the
   "Frequency bands" view shows the exact components of the prefrontal trace.
   The band mix changes inside the freezing window only so the two states look different. */
(function () {
  "use strict";

  var plot = document.querySelector("[data-recording]");
  if (!plot) return;

  var figure = plot.closest("figure");
  var caption = figure.querySelector("[data-recording-caption]");
  var buttons = Array.prototype.slice.call(figure.querySelectorAll("[data-view]"));
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var SVG_NS = "http://www.w3.org/2000/svg";

  var CUE = 4.0;
  var FREEZE_ON = 5.0;
  var FREEZE_OFF = 10.0;
  var HEIGHT = 292;
  var TOP = 30;
  var BOTTOM = 34;

  var BANDS = [
    { sym: "δ", range: "1–4 Hz", lo: 1, hi: 4 },
    { sym: "θ", range: "4–8 Hz", lo: 4, hi: 8 },
    { sym: "α", range: "8–12 Hz", lo: 8, hi: 12 },
    { sym: "β", range: "12–30 Hz", lo: 12, hi: 30 },
    { sym: "γ", range: "30–48 Hz", lo: 30, hi: 48 }
  ];

  // Per-region band weights at rest, and the multiplier applied while freezing.
  var REGIONS = [
    { name: "olfactory bulb", base: [1.0, 1.5, 0.7, 0.8, 1.2], freeze: [1.3, 0.7, 0.85, 0.6, 0.5] },
    { name: "prefrontal cortex", base: [1.0, 0.9, 0.6, 0.7, 0.7], freeze: [1.9, 1.15, 0.9, 0.55, 0.45] },
    { name: "amygdala", base: [1.0, 1.1, 0.5, 0.6, 0.7], freeze: [1.7, 1.3, 0.9, 0.6, 0.5] }
  ];
  var PREFRONTAL = 1;

  var VIEWS = {
    regions: {
      label: "Illustration of three brain recordings, olfactory bulb, prefrontal cortex and amygdala, with a cue followed by a shaded five-second freezing window.",
      caption: "Illustration with synthetic signals: three brain regions recorded together during fear conditioning. The red line marks the cue, and the shaded window is a 5-second freezing epoch, the kind of labelled slice my models learn from."
    },
    bands: {
      label: "Illustration of the prefrontal trace split into five frequency bands, delta, theta, alpha, beta and gamma.",
      caption: "The same illustration, with the prefrontal trace split into the five frequency bands I compute features from."
    }
  };

  // Small seeded random number generator so the drawing is the same on every visit.
  function seeded(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var random = seeded(20251);
  var oscillators = REGIONS.map(function () {
    return BANDS.map(function (band) {
      var waves = [];
      var count = band.hi - band.lo > 10 ? 9 : 6;
      for (var k = 0; k < count; k++) {
        var f = band.lo + random() * (band.hi - band.lo);
        waves.push({ f: f, a: (0.6 + 0.4 * random()) / Math.pow(f, 0.85), p: random() * Math.PI * 2 });
      }
      return { waves: waves, envF: 0.12 + random() * 0.3, envP: random() * Math.PI * 2 };
    });
  });

  function logistic(x) {
    return 1 / (1 + Math.exp(-x));
  }

  function freezing(t) {
    return logistic((t - FREEZE_ON) / 0.08) - logistic((t - FREEZE_OFF) / 0.08);
  }

  function bandValue(region, band, t) {
    var osc = oscillators[region][band];
    var sum = 0;
    for (var i = 0; i < osc.waves.length; i++) {
      var w = osc.waves[i];
      sum += w.a * Math.sin(2 * Math.PI * w.f * t + w.p);
    }
    var envelope = 1 + 0.35 * Math.sin(2 * Math.PI * osc.envF * t + osc.envP);
    var spec = REGIONS[region];
    var gain = spec.base[band] * (1 + freezing(t) * (spec.freeze[band] - 1));
    return sum * envelope * gain;
  }

  function regionValue(region, t) {
    var sum = 0;
    for (var b = 0; b < BANDS.length; b++) sum += bandValue(region, b, t);
    return sum;
  }

  function node(name, attrs, parent) {
    var el = document.createElementNS(SVG_NS, name);
    for (var key in attrs) el.setAttribute(key, attrs[key]);
    if (parent) parent.appendChild(el);
    return el;
  }

  // Samples fn between times tA and tB and returns an SVG path, scaled so the
  // largest deflection in view reaches amp pixels either side of yMid.
  function tracePath(fn, tA, tB, xOf, yMid, amp, n) {
    var times = new Array(n + 1);
    var values = new Array(n + 1);
    var peak = 1e-9;
    for (var i = 0; i <= n; i++) {
      var t = tA + ((tB - tA) * i) / n;
      var v = fn(t);
      times[i] = t;
      values[i] = v;
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }
    var d = "";
    for (var j = 0; j <= n; j++) {
      var y = yMid - (values[j] / peak) * amp;
      d += (j ? "L" : "M") + xOf(times[j]).toFixed(1) + " " + y.toFixed(1);
    }
    return d;
  }

  function label(parent, x, y, text, extraClass, symbol) {
    var el = node("text", { x: x, y: y, class: "rec-text" + (extraClass ? " " + extraClass : "") }, parent);
    if (symbol) {
      var sym = node("tspan", { class: "sym" }, el);
      sym.textContent = symbol + " ";
    }
    el.appendChild(document.createTextNode(text));
    return el;
  }

  var state = { view: "regions", width: 0, drawn: false };

  function render(animate) {
    var width = Math.round(plot.clientWidth);
    if (!width) return;
    state.width = width;

    var narrow = width < 640;
    var t0 = narrow ? 2.5 : 0;
    var t1 = narrow ? 11.5 : 12;
    var labelWidth = narrow ? 0 : 132;
    var x0 = labelWidth;
    var x1 = width - 6;
    var plotHeight = HEIGHT - TOP - BOTTOM;
    var pxPerSecond = (x1 - x0) / (t1 - t0);
    var points = Math.min(2400, Math.round((x1 - x0) * 2));
    function x(t) {
      return x0 + (t - t0) * pxPerSecond;
    }

    var svg = node("svg", {
      viewBox: "0 0 " + width + " " + HEIGHT,
      width: width,
      height: HEIGHT,
      role: "img",
      focusable: "false",
      "aria-label": VIEWS[state.view].label
    });

    // Shaded freezing window and chart-paper grid.
    var paper = node("g", {}, svg);
    node("rect", { class: "rec-epoch", x: x(FREEZE_ON), y: 0, width: x(FREEZE_OFF) - x(FREEZE_ON), height: TOP + plotHeight }, paper);
    var minorStep = pxPerSecond * 0.2 >= 12 ? 0.2 : 1;
    for (var s = Math.ceil(t0 / minorStep) * minorStep; s <= t1 + 1e-6; s += minorStep) {
      var major = Math.abs(s - Math.round(s)) < 1e-6;
      var gx = Math.round(x(s)) + 0.5;
      node("line", { class: "rec-grid" + (major ? " is-major" : ""), x1: gx, x2: gx, y1: TOP, y2: TOP + plotHeight }, paper);
    }
    node("line", { class: "rec-grid is-major", x1: x0, x2: x1, y1: TOP + 0.5, y2: TOP + 0.5 }, paper);
    node("line", { class: "rec-grid is-major", x1: x0, x2: x1, y1: TOP + plotHeight + 0.5, y2: TOP + plotHeight + 0.5 }, paper);

    // Two views share the same time axis.
    var layers = {
      regions: node("g", { class: "layer" + (state.view === "regions" ? "" : " is-off") }, svg),
      bands: node("g", { class: "layer" + (state.view === "bands" ? "" : " is-off") }, svg)
    };

    var rowH = plotHeight / REGIONS.length;
    REGIONS.forEach(function (region, r) {
      var mid = TOP + rowH * (r + 0.5);
      var path = node("path", {
        class: "trace",
        d: tracePath(function (t) { return regionValue(r, t); }, t0, t1, x, mid, rowH * 0.4, points)
      }, layers.regions);
      path.style.setProperty("--i", r);
      if (r > 0) {
        var gy = Math.round(TOP + rowH * r) + 0.5;
        node("line", { class: "rec-grid", x1: x0, x2: x1, y1: gy, y2: gy }, layers.regions);
      }
      if (narrow) label(layers.regions, 4, mid - rowH * 0.3, region.name);
      else label(layers.regions, 0, mid + 4, region.name);
    });

    var bandRows = BANDS.length + 1;
    var bandH = plotHeight / bandRows;
    // On narrow screens the band labels need their own space, so those traces start a little later.
    var bandStart = narrow ? t0 + 58 / pxPerSecond : t0;
    for (var b = -1; b < BANDS.length; b++) {
      var row = b + 1;
      var bandMid = TOP + bandH * (row + 0.5);
      var fn = b < 0
        ? function (t) { return regionValue(PREFRONTAL, t); }
        : (function (band) { return function (t) { return bandValue(PREFRONTAL, band, t); }; })(b);
      var bandPath = node("path", {
        class: "trace",
        d: tracePath(fn, bandStart, t1, x, bandMid, bandH * 0.38, points)
      }, layers.bands);
      bandPath.style.setProperty("--i", row);
      if (b < 0) label(layers.bands, 0, bandMid + 4, narrow ? "raw" : "prefrontal, raw");
      else label(layers.bands, 0, bandMid + 4, BANDS[b].range.replace(" Hz", ""), "", BANDS[b].sym);
    }

    // Cue, freezing label and a 1-second scale bar sit on top of both views.
    var marks = node("g", {}, svg);
    node("line", { class: "rec-cue", x1: x(CUE), x2: x(CUE), y1: 6, y2: TOP + plotHeight }, marks);
    var cueText = label(marks, x(CUE) - 6, 20, "cue", "is-cue");
    cueText.setAttribute("text-anchor", "end");
    label(marks, x(FREEZE_ON) + 7, 20, "freezing");
    var barY = HEIGHT - 12;
    node("line", { class: "rec-scale", x1: x1 - pxPerSecond, x2: x1, y1: barY, y2: barY }, marks);
    var scaleText = label(marks, x1 - pxPerSecond - 8, barY + 4, "1 s");
    scaleText.setAttribute("text-anchor", "end");

    plot.replaceChildren(svg);

    if (animate && !reduceMotion.matches) {
      var paths = layers[state.view].querySelectorAll(".trace");
      Array.prototype.forEach.call(paths, function (p) {
        p.style.setProperty("--len", Math.ceil(p.getTotalLength()));
      });
      figure.classList.add("is-drawing");
      window.setTimeout(function () {
        figure.classList.remove("is-drawing");
      }, 3200);
    }
  }

  function setView(view) {
    if (view === state.view) return;
    state.view = view;
    var svg = plot.querySelector("svg");
    if (svg) {
      var layers = svg.querySelectorAll(".layer");
      layers[0].classList.toggle("is-off", view !== "regions");
      layers[1].classList.toggle("is-off", view !== "bands");
      svg.setAttribute("aria-label", VIEWS[view].label);
    }
    buttons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-view") === view));
    });
    caption.textContent = VIEWS[view].caption;
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      figure.classList.remove("is-drawing");
      setView(btn.getAttribute("data-view"));
    });
  });

  caption.textContent = VIEWS.regions.caption;
  render(true);

  var resizeTimer = null;
  if ("ResizeObserver" in window) {
    new ResizeObserver(function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        if (Math.abs(Math.round(plot.clientWidth) - state.width) > 2) {
          figure.classList.remove("is-drawing");
          render(false);
        }
      }, 120);
    }).observe(plot);
  }
})();
