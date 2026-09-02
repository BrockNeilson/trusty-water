/* Deal Map runtime. DEAL / BRAND / PRESENTER are injected above this script. */
(function () {
  "use strict";
  var steps = DEAL.steps || [];
  var i = 0, notesOn = false, ovOn = false;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var elNarr = $("#narrative"), elMap = $("#map"), elInner = $("#map-inner"),
      elScroll = $("#map-scroll"), elSteps = $("#steps"), elCount = $("#counter"),
      elMetrics = $("#metrics"), elOv = $("#overview"), elBeat = $("#beatmap"), wires = $("#wires");
  var fit = 1;            // 1 unless Z has pulled back to show the whole map
  var zoomedOut = false;
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- narrative ---------- */
  function paintNarrative() {
    var s = steps[i];
    var html = '<div class="kicker">' + esc(s.kicker || s.beat || "") + "</div>" +
      '<h1 class="step-title">' + esc(s.title) + "</h1>" +
      '<ul class="bullets">' + (s.bullets || []).map(function (b) {
        return "<li>" + esc(b) + "</li>";
      }).join("") + "</ul>" +
      '<div class="notes" id="notes"' + (notesOn ? "" : " hidden") + ">" +
        (s.notes ? "Note — " + esc(s.notes) : "") + "</div>";
    elNarr.classList.remove("anim-in");
    elNarr.innerHTML = html;
    void elNarr.offsetWidth;
    elNarr.classList.add("anim-in");
  }

  /* ---------- spotlight ---------- */
  // Driven by the zone map the renderer injected, so it works for any map.
  function applySpotlight(step) {
    var sp = step.spotlight || {};
    var any = ZONES.some(function (z) { return (sp[z[1]] || []).length > 0; });
    elMap.classList.toggle("focused", any);
    $$(ZONES.map(function (z) { return z[0]; }).join(","), elInner)
      .forEach(function (n) { n.classList.remove("hot"); });
    ZONES.forEach(function (z) {
      (sp[z[1]] || []).forEach(function (id) { mark(z[0] + '[data-id="' + cssEsc(id) + '"]'); });
    });
    return sp;
  }

  function cssEsc(s) { return String(s).replace(/["\\]/g, "\\$&"); }

  function paintSpotlight() {
    var sp = applySpotlight(steps[i]);
    if (elMetrics) elMetrics.classList.toggle("show", !!sp.metrics);
    scrollToSpotlight();
    drawWires();
  }

  /* Bring what this step lit up into view. The audience cannot scroll — only the
     presenter — so every step has to land on its own content. When a step lights
     elements across more zones than fit on one screen, centre its primary zone:
     spotlight.focus if the deal names one, otherwise whichever zone it lit most. */
  // Supplied by whichever map rendered this deck.
  var ZONES = (DEAL._zones || []).map(function (z) { return [z[0], z[1]]; });

  function boxOf(list, base) {
    var t = Infinity, b = -Infinity;
    list.forEach(function (el) {
      var r = el.getBoundingClientRect();
      t = Math.min(t, r.top - base);
      b = Math.max(b, r.bottom - base);
    });
    return { t: t, b: b, h: b - t };
  }

  function scrollToSpotlight() {
    if (!elScroll || zoomedOut) return;
    var hot = $$(".hot", elInner);
    if (!hot.length) { setScroll(0); return; }
    var view = elScroll.clientHeight;
    var base = elInner.getBoundingClientRect().top;
    var pick = boxOf(hot, base);

    if (pick.h > view) {
      var sp = steps[i].spotlight || {};
      var groups = {};
      ZONES.forEach(function (z) {
        groups[z[1]] = hot.filter(function (el) { return el.matches(z[0]); });
      });
      var chosen = sp.focus && groups[sp.focus] && groups[sp.focus].length ? groups[sp.focus] : null;
      if (!chosen) {
        ZONES.forEach(function (z) {
          var g = groups[z[1]];
          if (g.length && (!chosen || g.length > chosen.length)) chosen = g;
        });
      }
      if (chosen && chosen.length) pick = boxOf(chosen, base);
    }

    // A tall block lands under the top edge so it reads as one unit; a short one centres.
    var target = pick.h > view * 0.55
      ? pick.t - 46
      : (pick.t + pick.b) / 2 - view / 2;
    setScroll(Math.max(0, Math.min(target, elScroll.scrollHeight - view)));
  }

  function setScroll(top) {
    // "auto" defers to the CSS scroll-behavior (smooth) — "instant" is the jump.
    if (elScroll.scrollTo) elScroll.scrollTo({ top: top, behavior: reduced ? "instant" : "smooth" });
    else elScroll.scrollTop = top;
  }

  function edges() {
    if (!elScroll) return;
    var t = $("#edge-top"), b = $("#edge-bottom");
    var more = elScroll.scrollHeight - elScroll.clientHeight;
    if (t) t.classList.toggle("on", !zoomedOut && elScroll.scrollTop > 6);
    if (b) b.classList.toggle("on", !zoomedOut && more > 6 && elScroll.scrollTop < more - 6);
  }

  /* Z: pull back so the whole map is visible for a beat, then return to reading size. */
  function toggleZoomOut(v) {
    zoomedOut = v === undefined ? !zoomedOut : v;
    elMap.classList.toggle("zoomed-out", zoomedOut);
    if (zoomedOut) {
      elScroll.scrollTop = 0;
      var natural = elInner.scrollHeight;
      var avail = elScroll.clientHeight - 12;
      fit = natural > avail && natural > 0 ? avail / natural : 1;
      elInner.style.width = (100 / fit).toFixed(3) + "%";
      elInner.style.transform = "scale(" + fit.toFixed(4) + ")";
    } else {
      fit = 1;
      elInner.style.width = "";
      elInner.style.transform = "";
      scrollToSpotlight();
    }
    setTimeout(function () { drawWires(); edges(); }, reduced ? 0 : 380);
  }
  function mark(sel) { var e = $(sel, elInner); if (e) e.classList.add("hot"); }

  /* ---------- wires ---------- */
  function drawWires() {
    if (!wires || window.innerWidth < 900) return;
    var box = elInner.getBoundingClientRect();
    wires.setAttribute("viewBox", "0 0 " + box.width / fit + " " + box.height / fit);
    var out = "";
    (DEAL._edges || []).forEach(function (e) {
      var a = $('[data-id="' + e.from + '"]', elInner), b = $('[data-id="' + e.to + '"]', elInner);
      if (!a || !b) return;
      var live = a.classList.contains("hot") && b.classList.contains("hot");
      if (e.kind === "owns" && !live) return;
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      var x1 = (ra.left - box.left + ra.width / 2) / fit, y1 = (ra.top - box.top + ra.height) / fit;
      var x2 = (rb.left - box.left + rb.width / 2) / fit, y2 = (rb.top - box.top) / fit;
      var d;
      if (Math.abs(x1 - x2) < 24) {
        d = "M" + x1 + "," + y1 + " L" + x2 + "," + y2;
      } else {
        var my = (y1 + y2) / 2;
        d = "M" + x1 + "," + y1 + " C" + x1 + "," + my + " " + x2 + "," + my + " " + x2 + "," + y2;
      }
      var stroke = live ? "var(--accent)" : "var(--line)";
      var op = live ? .9 : (elMap.classList.contains("focused") ? .18 : .45);
      out += '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' +
        (live ? 1.4 : 1) + '" opacity="' + op + '"' +
        (e.kind === "owns" ? ' stroke-dasharray="3 3"' : "") + "/>";
    });
    wires.innerHTML = out;
  }

  /* ---------- chrome ---------- */
  function paintChrome() {
    $$(".stepbtn", elSteps).forEach(function (b, n) { b.classList.toggle("on", n === i); });
    elCount.textContent = String(i + 1).padStart(2, "0") + " / " + String(steps.length).padStart(2, "0");
    $$("i", elBeat).forEach(function (b, n) {
      b.className = n < i ? "done" : (n === i ? "now" : "");
    });
    // Scroll the rail itself — scrollIntoView would scroll the document sideways.
    var on = $(".stepbtn.on", elSteps);
    if (on && elSteps.scrollWidth > elSteps.clientWidth + 1) {
      var left = on.offsetLeft - (elSteps.clientWidth - on.offsetWidth) / 2;
      if (elSteps.scrollTo) elSteps.scrollTo({ left: left, behavior: "smooth" });
      else elSteps.scrollLeft = left;
    }
  }

  function go(n) {
    i = Math.max(0, Math.min(steps.length - 1, n));
    paintNarrative(); paintSpotlight(); paintChrome();
    if (history.replaceState) history.replaceState(null, "", "#" + (i + 1));
  }

  /* ---------- overview ---------- */
  function buildOverview() {
    elOv.innerHTML = '<div class="ov-head"><h2>' + esc(DEAL.meta.dealName) + "</h2><span>" +
      esc(DEAL.meta.oneLiner || "") + '</span></div><div class="ov-grid">' +
      steps.map(function (s, n) {
        return '<button class="ov-card" data-go="' + n + '"><div class="n">' +
          String(n + 1).padStart(2, "0") + " · " + esc(s.beat || "") + '</div><div class="t">' +
          esc(s.title) + '</div><div class="b">' + esc((s.bullets || [])[0] || "") + "</div></button>";
      }).join("") + "</div>";
    elOv.addEventListener("click", function (e) {
      var c = e.target.closest("[data-go]");
      if (c) { toggleOverview(false); go(+c.dataset.go); }
    });
  }
  function toggleOverview(v) {
    ovOn = v === undefined ? !ovOn : v;
    elOv.classList.toggle("show", ovOn);
  }

  /* ---------- input ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    if (k === "ArrowRight" || k === " " || k === "PageDown" || k === "j") { e.preventDefault(); go(i + 1); }
    else if (k === "ArrowLeft" || k === "PageUp" || k === "k") { e.preventDefault(); go(i - 1); }
    else if (k === "Home") go(0);
    else if (k === "End") go(steps.length - 1);
    else if (k === "o") toggleOverview();
    else if (k === "z") toggleZoomOut();
    else if (k === "Escape") { toggleOverview(false); if (zoomedOut) toggleZoomOut(false); }
    else if (k === "n") { notesOn = !notesOn; var nt = $("#notes"); if (nt) nt.hidden = !notesOn; }
    else if (k === "f") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }
    else if (/^[1-9]$/.test(k)) go(+k - 1);
  });

  elSteps.addEventListener("click", function (e) {
    var b = e.target.closest(".stepbtn"); if (b) go(+b.dataset.n);
  });
  $("#prev").addEventListener("click", function () { go(i - 1); });
  $("#next").addEventListener("click", function () { go(i + 1); });
  $("#ovbtn").addEventListener("click", function () { toggleOverview(); });

  var tx = 0;
  document.addEventListener("touchstart", function (e) { tx = e.changedTouches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", function (e) {
    var d = e.changedTouches[0].clientX - tx;
    if (Math.abs(d) > 60) go(i + (d < 0 ? 1 : -1));
  }, { passive: true });

  var rt;
  function relayout() {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (zoomedOut) toggleZoomOut(true); else scrollToSpotlight();
      drawWires(); edges();
    }, 90);
  }
  window.addEventListener("resize", relayout);
  // The deck is often rendered inside a preview frame that resizes after load.
  if (window.ResizeObserver && elMap) new ResizeObserver(relayout).observe(elMap);
  if (elScroll) elScroll.addEventListener("scroll", function () { edges(); drawWires(); }, { passive: true });

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  buildOverview();
  var start = parseInt((location.hash || "").slice(1), 10);
  go(isFinite(start) && start > 0 ? start - 1 : 0);
  var settle = function () { scrollToSpotlight(); drawWires(); edges(); };
  window.addEventListener("load", settle);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
  setTimeout(settle, 400);
})();
