/* Deal Map runtime. DEAL / BRAND / PRESENTER are injected above this script. */
(function () {
  "use strict";
  var steps = DEAL.steps || [];
  var i = 0, notesOn = false, ovOn = false;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var elNarr = $("#narrative"), elMap = $("#map"), elInner = $("#map-inner"),
      elSteps = $("#steps"), elCount = $("#counter"), elMetrics = $("#metrics"),
      elOv = $("#overview"), elBeat = $("#beatmap"), wires = $("#wires");
  var fit = 1;

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
  function applySpotlight(step) {
    var sp = step.spotlight || {};
    var any = !!(sp.stakeholders || sp.obstacles || sp.meddpicc || sp.timeline);
    elMap.classList.toggle("focused", any);
    $$(".node,.gate,.md,.tick", elInner).forEach(function (n) { n.classList.remove("hot"); });
    (sp.stakeholders || []).forEach(function (id) { mark('.node[data-id="' + id + '"]'); });
    (sp.obstacles || []).forEach(function (id) { mark('.gate[data-id="' + id + '"]'); });
    (sp.meddpicc || []).forEach(function (k) { mark('.md[data-id="' + k + '"]'); });
    (sp.timeline || []).forEach(function (id) { mark('.tick[data-id="' + id + '"]'); });
    return sp;
  }

  function paintSpotlight() {
    var sp = applySpotlight(steps[i]);
    if (elMetrics) elMetrics.classList.toggle("show", !!sp.metrics);
    drawWires();
  }
  function mark(sel) { var e = $(sel, elInner); if (e) e.classList.add("hot"); }

  /* ---------- fit to screen ----------
     Scale is derived from the tallest step, so the map never resizes mid-story
     and never spills off a smaller laptop screen. */
  function fitMap() {
    if (!elInner) return;
    elInner.style.transition = "none";
    elInner.style.transform = "";
    elInner.style.width = "";
    elInner.style.height = "";
    fit = 1;
    if (window.innerWidth < 900) { elInner.style.transition = ""; return; }

    elMap.classList.add("measuring");   // kills transitions so heights are exact
    var natural = 0;
    for (var n = 0; n < steps.length; n++) {
      applySpotlight(steps[n]);
      natural = Math.max(natural, elInner.scrollHeight);
    }
    applySpotlight(steps[i]);
    elMap.classList.remove("measuring");

    var avail = elMap.clientHeight - 2;
    if (natural > avail && natural > 0) {
      fit = Math.max(0.7, avail / natural);
      var pct = (100 / fit).toFixed(3) + "%";
      elInner.style.width = pct;
      elInner.style.height = pct;
      elInner.style.transform = "scale(" + fit.toFixed(4) + ")";
    }
    void elInner.offsetWidth;
    elInner.style.transition = "";
  }

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
    else if (k === "o" || k === "Escape") toggleOverview(k === "Escape" ? false : undefined);
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
  function relayout() { clearTimeout(rt); rt = setTimeout(function () { fitMap(); drawWires(); }, 90); }
  window.addEventListener("resize", relayout);
  // The deck is often rendered inside a preview frame that resizes after load.
  if (window.ResizeObserver && elMap) new ResizeObserver(relayout).observe(elMap);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  buildOverview();
  fitMap();
  var start = parseInt((location.hash || "").slice(1), 10);
  go(isFinite(start) && start > 0 ? start - 1 : 0);
  window.addEventListener("load", function () { fitMap(); drawWires(); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { fitMap(); drawWires(); });
  }
  setTimeout(function () { fitMap(); drawWires(); }, 400);
})();
