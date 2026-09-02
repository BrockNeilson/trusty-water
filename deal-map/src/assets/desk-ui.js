/* The deal desk UI. Data comes from window.STORE — the local store writes files
   through the dev server, the hosted store keeps state in the page and republishes
   it on Save. Everything below is identical in both. */
(function () {
  "use strict";
  var S = window.STORE;
  var cur = null, curBrand = "default", tab = "notes", timers = {};

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var plural = function (n, w) { return n + " " + w + (n === 1 ? "" : "s"); };
  function debounce(k, fn, ms) { clearTimeout(timers[k]); timers[k] = setTimeout(fn, ms || 600); }

  var toastT;
  function toast(msg, bad) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "toast on" + (bad ? " bad" : "");
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.className = "toast"; }, bad ? 6000 : 2200);
  }
  var fail = function (e) { toast(e && e.message ? e.message : String(e), true); };

  var ro = function () { return !S.canWrite; };

  /* ---------------- chrome ---------------- */

  function paintSaveState() {
    var b = $("#save");
    if (!b) return;
    b.hidden = !S.explicitSave || ro();
    b.disabled = !S.dirty;
    b.textContent = S.dirty ? "Save changes" : "Saved";
    b.classList.toggle("primary", S.dirty);
    var d = $("#dirty-dot");
    if (d) d.hidden = !S.dirty;
    var r = $("#ro-banner");
    if (r) r.hidden = !ro();
  }

  // Called after any mutation: refresh what is on screen and the save affordance.
  function after(repaintTab) {
    paintSaveState();
    if (cur) {
      $("#deal-name").textContent = (S.state.deals[cur].meta || {}).dealName || cur;
      if (repaintTab) setTab(tab);
      refreshPreview();
    } else renderDesk();
  }

  /* ---------------- desk ---------------- */

  function dealList() {
    return Object.keys(S.state.deals).map(function (slug) {
      var d = S.state.deals[slug], m = d.meta || {}, notes = S.state.notes[slug] || "";
      return {
        slug: slug, dealName: m.dealName || slug, oneLiner: m.oneLiner || m.industry || "",
        acv: m.acv || "", outcome: m.outcome || "", draft: !!m.draft, brand: m.brand || "default",
        steps: (d.steps || []).length, stakeholders: (d.stakeholders || []).length,
        notesWords: notes.trim() ? notes.trim().split(/\s+/).length : 0,
        errors: validateDeal(normalize(d)).filter(function (i) { return i.level === "error"; }).length
      };
    }).sort(function (a, b) { return a.dealName.localeCompare(b.dealName); });
  }

  function brandOf(id) {
    return S.state.brands[id] || S.state.brands["default"] ||
      { id: "default", accent: "#5B8DEF", bg: "#0B0E14", surface: "#141922", ink: "#E8EDF5" };
  }

  function renderDesk() {
    $("#desk").style.display = "";
    $("#deal").classList.remove("on");
    var list = dealList();
    $("#grid").innerHTML = list.map(function (d) {
      var b = brandOf(d.brand);
      var chip = d.draft ? '<span class="chip warn">Sample</span>'
        : d.errors ? '<span class="chip bad">' + plural(d.errors, "fix") + "</span>"
        : '<span class="chip ok">Ready</span>';
      return '<button class="card" data-open="' + esc(d.slug) + '"><div class="chips">' + chip +
        (d.outcome ? '<span class="chip">' + esc(d.outcome) + "</span>" : "") +
        (b.company ? '<span class="chip audience"><span class="dot" style="background:' + esc(b.accent) +
          '"></span>' + esc(b.company) + "</span>" : '<span class="chip">No audience</span>') +
        "</div><h2>" + esc(d.dealName) + '</h2><div class="one">' +
        esc(d.oneLiner || "No summary yet") + '</div><div class="figs">' +
        "<div><b>" + esc(d.acv || "—") + "</b>ACV</div><div><b>" + d.steps +
        "</b>steps</div><div><b>" + d.stakeholders + "</b>people</div><div><b>" +
        d.notesWords + "</b>words of notes</div></div></button>";
    }).join("") +
      (ro() ? "" : '<button class="card card-new" id="new-deal"><span class="plus">+</span><span>New deal</span></button>');
    $("#deskcount").textContent = plural(list.length, "deal");
    $("#who").textContent = S.state.presenter.name || "Deal desk";
    paintSaveState();
  }

  /* ---------------- deal ---------------- */

  function openDeal(slug) {
    if (!S.state.deals[slug]) return renderDesk();
    cur = slug;
    curBrand = (S.state.deals[slug].meta || {}).brand || "default";
    $("#desk").style.display = "none";
    $("#deal").classList.add("on");
    $("#deal-name").textContent = (S.state.deals[slug].meta || {}).dealName || slug;
    var pick = $("#audience-pick");
    pick.innerHTML = Object.keys(S.state.brands).map(function (id) {
      return '<option value="' + esc(id) + '"' + (id === curBrand ? " selected" : "") + ">" +
        esc(S.state.brands[id].company || id) + "</option>";
    }).join("");
    pick.disabled = ro();
    $("#delete").hidden = ro();
    setTab(tab);
    refreshPreview();
    writeHash();
    paintSaveState();          // write access can resolve after the first paint
  }

  function writeHash() {
    history.replaceState(null, "", cur ? "#" + cur + (tab === "notes" ? "" : "/" + tab) : "#");
  }

  function setTab(name) {
    tab = name;
    writeHash();
    $$(".tab").forEach(function (t) { t.classList.toggle("on", t.dataset.tab === name); });
    var body = $("#panel-body"), dis = ro() ? " disabled" : "";
    if (name === "notes") {
      body.innerHTML = '<div class="field"><label>Raw notes <span class="saving" id="notes-saved"></span></label>' +
        '<div class="hint">Prose, fragments, a pasted transcript — the source the deal is written from.</div>' +
        '<textarea class="notes" id="notes"' + dis + ">" + esc(S.state.notes[cur] || "") + "</textarea></div>";
    } else if (name === "story") {
      body.innerHTML = rawMode
        ? rawEditor()
        : '<div class="form-scroll"' + (ro() ? " data-ro" : "") + ">" +
          DESKFORMS.storyHtml(S.state.deals[cur]) + "</div>" + rawToggle();
    } else if (name === "map") {
      body.innerHTML = rawMode
        ? rawEditor()
        : '<div class="form-scroll"' + (ro() ? " data-ro" : "") + ">" +
          DESKFORMS.mapHtml(S.state.deals[cur]) + "</div>" + rawToggle();
    } else if (name === "audience") {
      body.innerHTML = audienceTab();
    } else {
      body.innerHTML = '<div class="empty">Running checks…</div>';
      S.check(cur, curBrand).then(renderChecks).catch(function (e) {
        body.innerHTML = '<div class="empty">' + esc(e.message) + "</div>";
      });
    }
    wireTab();
  }

  function audienceTab() {
    var b = brandOf(curBrand), dis = ro() ? " disabled" : "";
    var logoSrc = b.logoData || (b.hasLogoFile ? "/api/logo-preview?brand=" + encodeURIComponent(b.id) + "&t=" + Date.now() : null);
    var logo = logoSrc ? '<img src="' + esc(logoSrc) + '" alt="">'
      : "<span>Drop a logo here, or click to choose</span><span style=\"font-size:11px\">PNG, SVG, JPEG or WebP</span>";
    return '<div class="field"><label>Company <span class="saving" id="brand-saved"></span></label>' +
        '<input type="text" id="b-company" value="' + esc(b.company || "") + '" placeholder="Brex"' + dis + "></div>" +
      '<div class="row"><div class="field"><label>Wordmark</label><input type="text" id="b-wordmark" value="' +
        esc(b.wordmark || "") + '"' + dis + '></div><div class="field"><label>Label</label>' +
        '<input type="text" id="b-label" value="' + esc(b.preparedForLabel || "Prepared for") + '"' + dis + "></div></div>" +
      (ro() ? "" : '<div class="field"><label>Logo</label><div class="logo-drop" id="logo-drop">' + logo + "</div>" +
        (logoSrc ? '<button class="btn sm ghost" id="logo-clear" style="align-self:flex-start">Remove logo</button>' : "") +
        '<input type="file" id="logo-file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden></div>') +
      '<div class="field"><label>Colour scheme</label><div class="swatches">' +
      ["accent", "accent2", "bg", "surface", "ink"].map(function (k) {
        var name = { accent: "Accent", accent2: "Accent 2", bg: "Background", surface: "Card", ink: "Text" }[k];
        return '<div class="swatch"><label>' + name + '</label><div class="pick">' +
          '<input type="color" data-c="' + k + '" value="' + esc(b[k] || "#000000") + '"' + dis + ">" +
          '<input type="text" data-t="' + k + '" value="' + esc(b[k] || "") + '"' + dis + "></div></div>";
      }).join("") + '</div><div class="contrast" id="contrast"></div></div>' +
      (ro() ? "" : '<div class="modal-actions"><button class="btn" id="new-audience">New audience</button></div>');
  }

  function renderChecks(out) {
    $("#tab-checks-n").textContent = out.counts.error ? out.counts.error : "";
    $("#panel-body").innerHTML =
      '<div class="score"><span class="v">' + out.score + '</span><span class="of">/ 100</span>' +
      '<span class="counts"><span>' + plural(out.counts.error, "error") + "</span><span>" +
      plural(out.counts.warn, "warning") + "</span><span>" + plural(out.counts.info, "note") + "</span></span></div>" +
      out.results.map(function (r) {
        var head = '<div class="rh"><b>' + esc(r.id) + "</b><span>" + esc(r.about) + "</span></div>";
        if (!r.findings.length) return '<div class="rule">' + head + '<div class="finding info"><span class="mk">✓</span>clean</div></div>';
        return '<div class="rule">' + head + r.findings.map(function (f) {
          return '<div class="finding ' + f.level + '"><span class="mk">' +
            ({ error: "✕", warn: "!", info: "·" }[f.level]) + '</span><span>' +
            (f.at ? '<span class="at">' + esc(f.at) + "</span> " : "") + esc(f.msg) + "</span></div>";
        }).join("") + "</div>";
      }).join("");
  }

  var rawMode = false;

  function rawToggle() {
    return '<div class="modal-actions"><button class="btn sm ghost" id="raw-toggle">' +
      (rawMode ? "Back to the editor" : "Edit as JSON") + "</button></div>";
  }

  function rawEditor() {
    return '<div class="field"><label>Deal file <span class="saving" id="story-saved"></span></label>' +
      '<div class="hint">The escape hatch. Invalid JSON or a broken reference will not apply.</div>' +
      '<textarea class="json" id="story" spellcheck="false"' + (ro() ? " disabled" : "") + ">" +
      esc(JSON.stringify(S.state.deals[cur], null, 2)) + "</textarea>" +
      (ro() ? "" : '<div class="modal-actions"><button class="btn" id="story-revert">Revert</button>' +
        '<button class="btn primary" id="story-apply">Apply</button></div>') + "</div>" + rawToggle();
  }

  // Structured edits go straight into the deal, then through the store like any other change.
  function commitForm(rerender) {
    var deal = S.state.deals[cur];
    S.updateDeal(cur, deal).then(function () {
      paintSaveState();
      refreshPreview();
      if (rerender) setTab(tab);
    }).catch(fail);
  }

  function wireForms() {
    var scope = $(".form-scroll");
    if (!scope || ro()) return;
    scope.addEventListener("input", function (e) {
      if (DESKFORMS.apply(S.state.deals[cur], e)) debounce("form", function () { commitForm(false); }, 450);
    });
    scope.addEventListener("change", function (e) {
      if (DESKFORMS.apply(S.state.deals[cur], e)) commitForm(false);
    });
    scope.addEventListener("click", function (e) {
      if (DESKFORMS.click(S.state.deals[cur], e)) { e.preventDefault(); commitForm(true); }
    });
  }

  // Every pair the theme compiler checks, plus anything it had to repair.
  function contrastLine() {
    var b = brandOf(curBrand), el = $("#contrast");
    if (!el) return;
    var t;
    try { t = buildTheme(b); } catch (e) { el.textContent = ""; return; }
    var v = t.vars;
    var pairs = [
      ["body text", v["--ink"], v["--bg"], 7],
      ["muted text", v["--ink-muted"], v["--bg"], 4.5],
      ["accent as text", v["--accent-ink"], v["--bg"], 4.5],
      ["on an accent fill", v["--on-accent"], v["--accent"], 4.5],
      ["on track", v["--ok"], v["--bg"], 4.5],
      ["at risk", v["--warn"], v["--bg"], 4.5],
      ["behind", v["--risk"], v["--bg"], 4.5]
    ];
    el.innerHTML = pairs.map(function (p) {
      var r = contrast(p[1], p[2]), bad = r != null && r < p[3];
      return '<span class="m' + (bad ? " bad" : "") + '">' + esc(p[0]) + " <b>" + (r == null ? "?" : r) + ":1</b></span>";
    }).join("") +
      (t.report.length
        ? '<div class="theme-report">' + t.report.map(function (r) {
            return '<div class="' + (r.level === "error" ? "bad" : "warn") + '">' + esc(r.msg) + "</div>";
          }).join("") + "</div>"
        : '<div class="theme-report ok">Every pair is readable on this background.</div>');
  }

  function flash(sel) {
    var e = $(sel); if (!e) return;
    e.textContent = "saved"; e.className = "saving on";
    setTimeout(function () { e.textContent = ""; e.className = "saving"; }, 1400);
  }

  /* ---------------- preview ---------------- */

  var FRAME_W = 1280, FRAME_H = 720;
  function refreshPreview() {
    var f = $("#frame");
    if (!f) return;
    try {
      var src = S.deckSource(cur, curBrand);
      if (src.url) { f.removeAttribute("srcdoc"); f.src = src.url; }
      else { f.removeAttribute("src"); f.srcdoc = src.html; }
    } catch (e) { toast("Cannot render this deal: " + e.message, true); }
    fitFrame();
  }
  function fitFrame() {
    var wrap = $("#frame-wrap"), stage = $("#frame-stage");
    if (!wrap || !stage) return;
    var aw = wrap.clientWidth - 32, ah = wrap.clientHeight - 32;
    if (aw <= 0 || ah <= 0) return;
    var k = Math.min(aw / FRAME_W, ah / FRAME_H);
    stage.style.transform = "scale(" + k.toFixed(4) + ")";
    stage.style.left = Math.max(16, 16 + (aw - FRAME_W * k) / 2) + "px";
    stage.style.top = Math.max(16, 16 + (ah - FRAME_H * k) / 2) + "px";
    var s = $("#frame-size");
    if (s) s.textContent = FRAME_W + "×" + FRAME_H + " · " + Math.round(k * 100) + "%";
  }

  function present() {
    var o = $("#present");
    var src = S.deckSource(cur, curBrand);
    o.innerHTML = '<iframe id="present-frame" title="Deck"></iframe>' +
      '<button class="btn present-close" id="present-close">Close ✕</button>';
    o.classList.add("on");
    var f = $("#present-frame");
    if (src.url) f.src = src.url; else f.srcdoc = src.html;
  }
  function closePresent() { $("#present").classList.remove("on"); $("#present").innerHTML = ""; }

  /* ---------------- wiring ---------------- */

  function wireTab() {
    if ($("#raw-toggle")) {
      $("#raw-toggle").addEventListener("click", function () { rawMode = !rawMode; setTab(tab); });
    }
    wireForms();
    if (ro()) return;
    var n = $("#notes");
    if (n) {
      n.addEventListener("input", function () {
        debounce("notes", function () {
          S.saveNotes(cur, n.value).then(function () { flash("#notes-saved"); paintSaveState(); }).catch(fail);
        });
      });
    }
    var s = $("#story");
    if (s) {
      $("#story-revert").addEventListener("click", function () {
        s.value = JSON.stringify(S.state.deals[cur], null, 2);
      });
      $("#story-apply").addEventListener("click", function () {
        var parsed;
        try { parsed = JSON.parse(s.value); }
        catch (e) { return toast("Not valid JSON: " + e.message, true); }
        S.updateDeal(cur, parsed).then(function () {
          curBrand = (S.state.deals[cur].meta || {}).brand || curBrand;
          flash("#story-saved"); after(false); toast("Applied");
        }).catch(fail);
      });
    }
    if ($("#b-company")) {
      contrastLine();
      var patch = function (k, v) {
        debounce("brand", function () {
          S.updateBrand(curBrand, (function () { var o = {}; o[k] = v; return o; })())
            .then(function () { flash("#brand-saved"); contrastLine(); after(false); }).catch(fail);
        }, 450);
      };
      $("#b-company").addEventListener("input", function (e) { patch("company", e.target.value); });
      $("#b-wordmark").addEventListener("input", function (e) { patch("wordmark", e.target.value); });
      $("#b-label").addEventListener("input", function (e) { patch("preparedForLabel", e.target.value); });
      $$('input[type=color]').forEach(function (c) {
        c.addEventListener("input", function () {
          var t = $('input[data-t="' + c.dataset.c + '"]');
          if (t) t.value = c.value;
          patch(c.dataset.c, c.value);
        });
      });
      $$("input[data-t]").forEach(function (t) {
        t.addEventListener("change", function () {
          if (!/^#[0-9a-fA-F]{6}$/.test(t.value)) return toast("Use a 6-digit hex colour", true);
          var c = $('input[data-c="' + t.dataset.t + '"]');
          if (c) c.value = t.value;
          patch(t.dataset.t, t.value);
        });
      });
      var drop = $("#logo-drop"), file = $("#logo-file");
      drop.addEventListener("click", function () { file.click(); });
      ["dragenter", "dragover"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
      });
      ["dragleave", "drop"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); });
      });
      drop.addEventListener("drop", function (e) {
        if (e.dataTransfer.files && e.dataTransfer.files[0]) readLogo(e.dataTransfer.files[0]);
      });
      file.addEventListener("change", function () { if (file.files[0]) readLogo(file.files[0]); });
      if ($("#logo-clear")) {
        $("#logo-clear").addEventListener("click", function () {
          S.setLogo(curBrand, null).then(function () { after(true); toast("Logo removed"); }).catch(fail);
        });
      }
      $("#new-audience").addEventListener("click", newAudience);
    }
  }

  function readLogo(f) {
    if (f.size > 400 * 1024) return toast("Logo is over 400 KB", true);
    var r = new FileReader();
    r.onload = function () {
      S.setLogo(curBrand, r.result).then(function () { after(true); toast("Logo added"); }).catch(fail);
    };
    r.readAsDataURL(f);
  }

  /* ---------------- modals ---------------- */

  function modal(html) {
    var s = $("#scrim");
    s.innerHTML = '<div class="modal">' + html + "</div>";
    s.classList.add("on");
    return s;
  }
  function close() { $("#scrim").classList.remove("on"); $("#scrim").innerHTML = ""; }

  function slugField(nameEl, slugEl) {
    nameEl.addEventListener("input", function () {
      slugEl.value = nameEl.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    });
  }

  function newDeal() {
    modal('<h3>New deal</h3><p class="lede">Creates the deal and a notes file to write the story into.</p>' +
      '<div class="field"><label>Deal name</label><input type="text" id="nd-name" placeholder="Northwind Logistics"></div>' +
      '<div class="field"><label>Short id</label><input type="text" id="nd-slug" placeholder="northwind"></div>' +
      '<div class="modal-actions"><button class="btn" data-x>Cancel</button>' +
      '<button class="btn primary" id="nd-go">Create</button></div>');
    var name = $("#nd-name"), slug = $("#nd-slug");
    name.focus(); slugField(name, slug);
    $("#nd-go").addEventListener("click", function () {
      var id = slug.value.trim();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return toast("Use lowercase letters, numbers and dashes", true);
      S.createDeal(id, name.value || id).then(function () {
        close(); renderDesk(); openDeal(id); paintSaveState();
      }).catch(fail);
    });
  }

  function newAudience() {
    modal('<h3>New audience</h3><p class="lede">One per company you present to.</p>' +
      '<div class="field"><label>Company</label><input type="text" id="na-company" placeholder="Brex"></div>' +
      '<div class="field"><label>Short id</label><input type="text" id="na-id" placeholder="brex"></div>' +
      '<div class="modal-actions"><button class="btn" data-x>Cancel</button>' +
      '<button class="btn primary" id="na-go">Create</button></div>');
    var c = $("#na-company"), i = $("#na-id");
    c.focus(); slugField(c, i);
    $("#na-go").addEventListener("click", function () {
      var id = i.value.trim();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return toast("Use lowercase letters, numbers and dashes", true);
      S.createBrand(id, c.value).then(function () {
        var deal = S.state.deals[cur];
        deal.meta.brand = id;
        return S.updateDeal(cur, deal);
      }).then(function () {
        curBrand = id; close(); openDeal(cur);
      }).catch(fail);
    });
  }

  function confirmDelete() {
    modal("<h3>Delete this deal?</h3><p class=\"lede\">The deal file goes." +
      (S.mode === "local" ? " Your raw notes are kept." : " This cannot be undone once you save.") + "</p>" +
      '<div class="modal-actions"><button class="btn" data-x>Cancel</button>' +
      '<button class="btn primary" id="del-go" style="background:var(--bad);border-color:var(--bad);color:#fff">Delete</button></div>');
    $("#del-go").addEventListener("click", function () {
      S.deleteDeal(cur).then(function () {
        cur = null; close(); renderDesk(); writeHash(); toast("Deleted");
      }).catch(fail);
    });
  }

  function share() {
    var b = brandOf(curBrand);
    modal('<h3>Share this deal</h3><p class="lede">Prepared for <strong>' + esc(b.company || "no audience") +
      "</strong>. This deal only — no other deal travels with it.</p>" +
      '<div class="share-opt"><h4>Present it</h4><p>Full screen, keyboard driven. Escape returns here.</p>' +
      '<button class="btn primary" id="sh-present">Present</button></div>' +
      '<div class="share-opt"><h4>Send the file</h4><p>One self-contained HTML file that opens offline on any laptop.</p>' +
      '<button class="btn" id="sh-download">Download the deck</button></div>' +
      '<div class="share-opt"><h4>Back up everything</h4><p>All deals, notes and audiences as one JSON file — ' +
      "the shape <code>dealmap import</code> reads.</p>" +
      '<button class="btn" id="sh-export">Export all data</button></div>' +
      '<div class="modal-actions"><button class="btn" data-x>Done</button></div>');
    $("#sh-present").addEventListener("click", function () { close(); present(); });
    $("#sh-download").addEventListener("click", function () {
      var src = S.deckSource(cur, curBrand);
      var name = cur + (curBrand === "default" ? "" : "-" + curBrand) + ".html";
      if (src.html) S.download(name, src.html).then(function () { toast("Saved " + name); }).catch(fail);
      else window.open("/download/" + cur + "?brand=" + encodeURIComponent(curBrand), "_blank");
    });
    $("#sh-export").addEventListener("click", function () {
      S.download("deal-desk-export.json", S.exportAll())
        .then(function () { toast("Exported"); }).catch(fail);
    });
  }

  /* ---------------- events ---------------- */

  document.addEventListener("click", function (e) {
    var open = e.target.closest("[data-open]");
    if (open) return openDeal(open.dataset.open);
    if (e.target.closest("#new-deal")) return newDeal();
    if (e.target.closest("[data-x]")) return close();
    var t = e.target.closest(".tab");
    if (t) return setTab(t.dataset.tab);
    if (e.target.closest("#back")) { cur = null; renderDesk(); writeHash(); return; }
    if (e.target.closest("#share")) return share();
    if (e.target.closest("#delete")) return confirmDelete();
    if (e.target.closest("#save")) return S.save().then(paintSaveState).catch(fail);
    if (e.target.closest("#reload")) return refreshPreview();
    if (e.target.closest("#present-btn")) return present();
    if (e.target.closest("#present-close")) return closePresent();
  });

  document.addEventListener("change", function (e) {
    if (e.target.id === "audience-pick") {
      curBrand = e.target.value;
      var deal = S.state.deals[cur];
      deal.meta = deal.meta || {};
      deal.meta.brand = curBrand;
      S.updateDeal(cur, deal).then(function () { after(tab === "audience"); }).catch(fail);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if ($("#present").classList.contains("on")) return closePresent();
      if ($("#scrim").classList.contains("on")) return close();
      if (cur) { cur = null; renderDesk(); writeHash(); }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "s" && S.explicitSave) {
      e.preventDefault();
      S.save().then(paintSaveState).catch(fail);
    }
  });

  window.addEventListener("beforeunload", function (e) {
    if (S.explicitSave && S.dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  var ft;
  window.addEventListener("resize", function () { clearTimeout(ft); ft = setTimeout(fitFrame, 80); });

  /* ---------------- boot ---------------- */

  S.init().then(function () {
    if (S.pendingDraft) {
      var draft = S.pendingDraft();
      if (draft) {
        $("#draft-bar").hidden = false;
        $("#draft-when").textContent = new Date(draft.at).toLocaleString();
        $("#draft-restore").addEventListener("click", function () {
          S.applyDraft(draft); $("#draft-bar").hidden = true; renderDesk(); toast("Draft restored — save to keep it");
        });
        $("#draft-discard").addEventListener("click", function () {
          S.discardDraft(); $("#draft-bar").hidden = true;
        });
      }
    }
    var parts = (location.hash || "").slice(1).split("/");
    if (parts[1] && ["notes", "story", "map", "audience", "checks"].indexOf(parts[1]) > -1) tab = parts[1];
    renderDesk();
    if (parts[0] && S.state.deals[parts[0]]) openDeal(parts[0]);
    // Write access can resolve after boot; re-render when it does.
    S.onReady = function () { if (cur) openDeal(cur); else renderDesk(); };
  }).catch(fail);
})();
