/* Hosted deal desk. State lives in the published page: saving republishes this
   document with the data embedded, so it persists and follows you between devices. */
(function () {
  "use strict";

  var STATE = window.__DESK_STATE__ || { presenter: {}, deals: {}, brands: {}, notes: {} };
  var SHELL = null, artifact = null, downloads = null;
  var readOnly = true;          // until a writable artifact capability answers
  var dirty = false, cur = null, curBrand = "default", tab = "notes";
  var DRAFT_KEY = "dealdesk:draft";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var plural = function (n, w) { return n + " " + w + (n === 1 ? "" : "s"); };

  var toastT;
  function toast(msg, bad) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "toast on" + (bad ? " bad" : "");
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.className = "toast"; }, bad ? 6000 : 2200);
  }

  /* ---------------- persistence ---------------- */

  function markDirty() {
    dirty = true;
    paintSaveState();
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), state: STATE })); } catch (e) {}
  }

  function paintSaveState() {
    var b = $("#save");
    if (!b) return;
    b.hidden = readOnly;
    b.disabled = !dirty;
    b.textContent = dirty ? "Save changes" : "Saved";
    b.classList.toggle("primary", dirty);
    var d = $("#dirty-dot");
    if (d) d.hidden = !dirty;
  }

  // Built at runtime so this source does not itself contain the markers — otherwise
  // the page would hold three copies and substitution would depend on their order.
  var MARK = { shell: "%%" + "SHELL" + "%%", state: "%%" + "STATE" + "%%" };

  function buildDocument() {
    var json = JSON.stringify(STATE).replace(/</g, "\\u003c");
    var doc = SHELL.replace(MARK.shell, window.__SHELL_B64__).replace(MARK.state, json);
    if (doc.indexOf(MARK.shell) > -1 || doc.indexOf(MARK.state) > -1) {
      throw new Error("template did not fill cleanly");
    }
    return doc;
  }

  function save() {
    if (readOnly || !artifact) { toast("This is a read-only view", true); return; }
    if (!dirty) return;
    var b = $("#save");
    b.disabled = true; b.textContent = "Saving…";
    STATE.updatedAt = new Date().toISOString();
    artifact.publish(buildDocument()).then(function () {
      dirty = false;
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
      // Every open view, including this one, reloads to the new version.
    }).catch(function (err) {
      var code = err && err.code;
      if (code === "conflict") {
        toast("Someone saved a newer version — this view will reload; re-apply your edit", true);
      } else if (code === "not_granted" || code === "not_writer") {
        readOnly = true;
        toast("You can view this desk but not save to it", true);
      } else {
        toast("Could not save: " + ((err && err.message) || code || "unknown"), true);
      }
      dirty = true; paintSaveState();
    });
  }

  /* ---------------- derived ---------------- */

  function dealList() {
    return Object.keys(STATE.deals).map(function (slug) {
      var d = STATE.deals[slug], m = d.meta || {};
      var notes = STATE.notes[slug] || "";
      return {
        slug: slug, dealName: m.dealName || slug, oneLiner: m.oneLiner || m.industry || "",
        acv: m.acv || "", outcome: m.outcome || "", draft: !!m.draft, brand: m.brand || "default",
        steps: (d.steps || []).length, stakeholders: (d.stakeholders || []).length,
        notesWords: notes.trim() ? notes.trim().split(/\s+/).length : 0,
        errors: validateDeal(normalize(d)).filter(function (i) { return i.level === "error"; }).length
      };
    }).sort(function (a, b) { return a.dealName.localeCompare(b.dealName); });
  }

  function brandOf(id) { return STATE.brands[id] || STATE.brands["default"] || { id: "default", accent: "#5B8DEF", bg: "#0B0E14", surface: "#141922", ink: "#E8EDF5" }; }

  function renderableBrand(id) {
    var b = JSON.parse(JSON.stringify(brandOf(id)));
    if (b.logoData) b._logoData = b.logoData;
    return b;
  }

  function deckHtml(slug, brandId) {
    return render({
      deal: normalize(STATE.deals[slug]),
      brand: renderableBrand(brandId),
      presenter: STATE.presenter,
      assets: window.__DECK_ASSETS__
    });
  }

  /* ---------------- desk ---------------- */

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
      (readOnly ? "" : '<button class="card card-new" id="new-deal"><span class="plus">+</span><span>New deal</span></button>');
    $("#deskcount").textContent = plural(list.length, "deal");
  }

  /* ---------------- deal view ---------------- */

  function openDeal(slug) {
    if (!STATE.deals[slug]) return renderDesk();
    cur = slug;
    curBrand = (STATE.deals[slug].meta || {}).brand || "default";
    $("#desk").style.display = "none";
    $("#deal").classList.add("on");
    $("#deal-name").textContent = (STATE.deals[slug].meta || {}).dealName || slug;
    $("#audience-pick").innerHTML = Object.keys(STATE.brands).map(function (id) {
      return '<option value="' + esc(id) + '"' + (id === curBrand ? " selected" : "") + ">" +
        esc(STATE.brands[id].company || id) + "</option>";
    }).join("");
    $("#audience-pick").disabled = readOnly;
    setTab(tab);
    refreshPreview();
    writeHash();
  }

  function writeHash() {
    history.replaceState(null, "", cur ? "#" + cur + (tab === "notes" ? "" : "/" + tab) : "#");
  }

  function setTab(name) {
    tab = name;
    writeHash();
    $$(".tab").forEach(function (t) { t.classList.toggle("on", t.dataset.tab === name); });
    var body = $("#panel-body");
    var ro = readOnly ? " disabled" : "";
    if (name === "notes") {
      body.innerHTML = '<div class="field"><label>Raw notes</label>' +
        '<div class="hint">Prose, fragments, a pasted transcript — the source the deal is written from.</div>' +
        '<textarea class="notes" id="notes"' + ro + ">" + esc(STATE.notes[cur] || "") + "</textarea></div>";
    } else if (name === "story") {
      body.innerHTML = '<div class="field"><label>Deal file</label>' +
        '<div class="hint">Invalid JSON or a broken reference will not apply — the error says which.</div>' +
        '<textarea class="json" id="story" spellcheck="false"' + ro + ">" +
        esc(JSON.stringify(STATE.deals[cur], null, 2)) + "</textarea>" +
        (readOnly ? "" : '<div class="modal-actions"><button class="btn" id="story-revert">Revert</button>' +
          '<button class="btn primary" id="story-apply">Apply</button></div>') + "</div>";
    } else if (name === "audience") {
      body.innerHTML = audienceTab();
    } else {
      body.innerHTML = checksTab();
    }
    wireTab();
  }

  function audienceTab() {
    var b = brandOf(curBrand);
    var ro = readOnly ? " disabled" : "";
    var logo = b.logoData
      ? '<img src="' + esc(b.logoData) + '" alt="">'
      : "<span>Drop a logo here, or click to choose</span><span style=\"font-size:11px\">PNG, SVG, JPEG or WebP</span>";
    return '<div class="field"><label>Company</label><input type="text" id="b-company" value="' +
        esc(b.company || "") + '" placeholder="Brex"' + ro + "></div>" +
      '<div class="row"><div class="field"><label>Wordmark</label><input type="text" id="b-wordmark" value="' +
        esc(b.wordmark || "") + '"' + ro + '></div><div class="field"><label>Label</label>' +
        '<input type="text" id="b-label" value="' + esc(b.preparedForLabel || "Prepared for") + '"' + ro + "></div></div>" +
      (readOnly ? "" : '<div class="field"><label>Logo</label><div class="logo-drop" id="logo-drop">' + logo + "</div>" +
        (b.logoData ? '<button class="btn sm ghost" id="logo-clear" style="align-self:flex-start">Remove logo</button>' : "") +
        '<input type="file" id="logo-file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden></div>') +
      '<div class="field"><label>Colour scheme</label><div class="swatches">' +
      ["accent", "accent2", "bg", "surface", "ink"].map(function (k) {
        var name = { accent: "Accent", accent2: "Accent 2", bg: "Background", surface: "Card", ink: "Text" }[k];
        return '<div class="swatch"><label>' + name + '</label><div class="pick">' +
          '<input type="color" data-c="' + k + '" value="' + esc(b[k] || "#000000") + '"' + ro + ">" +
          '<input type="text" data-t="' + k + '" value="' + esc(b[k] || "") + '"' + ro + "></div></div>";
      }).join("") + '</div><div class="contrast" id="contrast"></div></div>' +
      (readOnly ? "" : '<div class="modal-actions"><button class="btn" id="new-audience">New audience</button></div>');
  }

  function checksTab() {
    var deal = normalize(STATE.deals[cur]);
    var ctx = { brand: renderableBrand(curBrand), presenter: STATE.presenter };
    var results = [{ id: "schema", about: "Structure the renderer requires.",
      findings: validateDeal(deal).map(function (i) { return { level: i.level, at: i.where, msg: i.msg }; }) }];
    RULES.forEach(function (r) {
      var findings = [];
      try { findings = r.run(deal, ctx) || []; }
      catch (e) { findings = [{ level: "error", at: r.id, msg: "rule threw: " + e.message }]; }
      results.push({ id: r.id, about: r.about, findings: findings });
    });
    var counts = { error: 0, warn: 0, info: 0 };
    results.forEach(function (r) { r.findings.forEach(function (f) { counts[f.level] = (counts[f.level] || 0) + 1; }); });
    var score = Math.max(0, 100 - counts.error * 8 - counts.warn * 2);
    $("#tab-checks-n").textContent = counts.error ? counts.error : "";
    return '<div class="score"><span class="v">' + score + '</span><span class="of">/ 100</span>' +
      '<span class="counts"><span>' + plural(counts.error, "error") + "</span><span>" +
      plural(counts.warn, "warning") + "</span><span>" + plural(counts.info, "note") + "</span></span></div>" +
      results.map(function (r) {
        var head = '<div class="rh"><b>' + esc(r.id) + "</b><span>" + esc(r.about) + "</span></div>";
        if (!r.findings.length) return '<div class="rule">' + head + '<div class="finding info"><span class="mk">✓</span>clean</div></div>';
        return '<div class="rule">' + head + r.findings.map(function (f) {
          return '<div class="finding ' + f.level + '"><span class="mk">' +
            ({ error: "✕", warn: "!", info: "·" }[f.level]) + '</span><span>' +
            (f.at ? '<span class="at">' + esc(f.at) + "</span> " : "") + esc(f.msg) + "</span></div>";
        }).join("") + "</div>";
      }).join("");
  }

  function contrastLine() {
    var b = brandOf(curBrand), el = $("#contrast");
    if (!el) return;
    var ca = contrast(b.accent, b.bg), ci = contrast(b.ink, b.bg);
    var warn = function (v, min) { return v != null && v < min ? ' style="color:var(--warn)"' : ""; };
    el.innerHTML = '<span class="m"' + warn(ca, 4.5) + ">accent on background <b>" + (ca || "?") +
      ":1</b> (want 4.5+)</span><span class=\"m\"" + warn(ci, 7) + ">text on background <b>" +
      (ci || "?") + ":1</b> (want 7+)</span>";
  }

  function refreshPreview() {
    var f = $("#frame");
    try { f.srcdoc = deckHtml(cur, curBrand); }
    catch (e) { toast("Cannot render this deal: " + e.message, true); }
    fitFrame();
  }

  var FRAME_W = 1280, FRAME_H = 720;
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

  /* ---------------- editing ---------------- */

  function wireTab() {
    var n = $("#notes");
    if (n && !readOnly) {
      n.addEventListener("input", function () { STATE.notes[cur] = n.value; markDirty(); });
    }
    var s = $("#story");
    if (s && !readOnly) {
      $("#story-revert").addEventListener("click", function () { s.value = JSON.stringify(STATE.deals[cur], null, 2); });
      $("#story-apply").addEventListener("click", function () {
        var parsed;
        try { parsed = JSON.parse(s.value); }
        catch (e) { return toast("Not valid JSON: " + e.message, true); }
        var errs = validateDeal(normalize(parsed)).filter(function (i) { return i.level === "error"; });
        if (errs.length) return toast(errs[0].where + " " + errs[0].msg, true);
        parsed.meta = parsed.meta || {};
        parsed.meta.slug = cur;
        STATE.deals[cur] = parsed;
        curBrand = parsed.meta.brand || curBrand;
        $("#deal-name").textContent = parsed.meta.dealName || cur;
        markDirty(); refreshPreview();
        toast("Applied — remember to save");
      });
    }
    if ($("#b-company") && !readOnly) {
      contrastLine();
      var patch = function (k, v) {
        STATE.brands[curBrand] = STATE.brands[curBrand] || { id: curBrand };
        STATE.brands[curBrand][k] = v;
        markDirty(); contrastLine(); refreshPreview();
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
          delete STATE.brands[curBrand].logoData;
          markDirty(); setTab("audience"); refreshPreview();
        });
      }
      $("#new-audience").addEventListener("click", newAudience);
    }
  }

  function readLogo(f) {
    if (f.size > 400 * 1024) return toast("Logo is over 400 KB — it is stored inside this page", true);
    var r = new FileReader();
    r.onload = function () {
      STATE.brands[curBrand].logoData = r.result;
      markDirty(); setTab("audience"); refreshPreview(); toast("Logo added");
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

  function newDeal() {
    modal('<h3>New deal</h3><p class="lede">Creates the deal and a notes file to write the story into.</p>' +
      '<div class="field"><label>Deal name</label><input type="text" id="nd-name" placeholder="Northwind Logistics"></div>' +
      '<div class="field"><label>Short id</label><input type="text" id="nd-slug" placeholder="northwind"></div>' +
      '<div class="modal-actions"><button class="btn" data-x>Cancel</button>' +
      '<button class="btn primary" id="nd-go">Create</button></div>');
    var name = $("#nd-name"), slug = $("#nd-slug");
    name.focus();
    name.addEventListener("input", function () {
      slug.value = name.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    });
    $("#nd-go").addEventListener("click", function () {
      var id = slug.value.trim();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return toast("Use lowercase letters, numbers and dashes", true);
      if (STATE.deals[id]) return toast('A deal called "' + id + '" already exists', true);
      STATE.deals[id] = blankDeal(id, name.value || id);
      STATE.notes[id] = window.__NOTES_TEMPLATE__.replace("<Customer>", name.value || id);
      markDirty(); close(); renderDesk(); openDeal(id);
      toast("Created — write the notes, then save");
    });
  }

  function blankDeal(slug, name) {
    return {
      meta: { slug: slug, draft: true, dealName: name, customer: name, industry: "", acv: "",
              cycleDays: null, outcome: "", oneLiner: "", targetMinutes: 6, brand: "default" },
      metrics: [], stakeholders: [], obstacles: [], meddpicc: {}, timeline: [],
      steps: [{ id: "s1", beat: "setup", kicker: "The account", title: "Start here",
                bullets: ["Write your notes first", "Then generate this deal"], spotlight: {},
                notes: "Replace this once the notes are written." }]
    };
  }

  function newAudience() {
    modal('<h3>New audience</h3><p class="lede">One per company you present to.</p>' +
      '<div class="field"><label>Company</label><input type="text" id="na-company" placeholder="Brex"></div>' +
      '<div class="field"><label>Short id</label><input type="text" id="na-id" placeholder="brex"></div>' +
      '<div class="modal-actions"><button class="btn" data-x>Cancel</button>' +
      '<button class="btn primary" id="na-go">Create</button></div>');
    var c = $("#na-company"), i = $("#na-id");
    c.focus();
    c.addEventListener("input", function () {
      i.value = c.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    });
    $("#na-go").addEventListener("click", function () {
      var id = i.value.trim();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) return toast("Use lowercase letters, numbers and dashes", true);
      if (STATE.brands[id]) return toast("That audience already exists", true);
      STATE.brands[id] = { id: id, company: c.value, wordmark: c.value, preparedForLabel: "Prepared for",
        accent: "#5B8DEF", accent2: "#9B7BF0", bg: "#0B0E14", surface: "#141922", ink: "#E8EDF5", font: "Inter" };
      STATE.deals[cur].meta.brand = id;
      curBrand = id;
      markDirty(); close(); openDeal(cur);
    });
  }

  function confirmDelete() {
    modal("<h3>Delete this deal?</h3><p class=\"lede\">The deal and its notes go. This cannot be undone once you save.</p>" +
      '<div class="modal-actions"><button class="btn" data-x>Cancel</button>' +
      '<button class="btn primary" id="del-go" style="background:var(--bad);border-color:var(--bad);color:#fff">Delete</button></div>');
    $("#del-go").addEventListener("click", function () {
      delete STATE.deals[cur]; delete STATE.notes[cur];
      cur = null; markDirty(); close(); renderDesk(); writeHash();
      toast("Deleted — remember to save");
    });
  }

  function share() {
    var b = brandOf(curBrand);
    modal('<h3>Share this deal</h3><p class="lede">Prepared for <strong>' + esc(b.company || "no audience") +
      "</strong>.</p>" +
      '<div class="share-opt"><h4>Present it</h4><p>Full screen, keyboard driven. Escape returns here.</p>' +
      '<button class="btn primary" id="sh-present">Present</button></div>' +
      '<div class="share-opt"><h4>Send the file</h4><p>One self-contained HTML file that opens offline on any laptop.</p>' +
      '<button class="btn" id="sh-download">Download the deck</button></div>' +
      '<div class="share-opt"><h4>Back up everything</h4><p>All deals, notes and audiences as one JSON file — the same shape as the ' +
      "repo's <code>data/</code> folder, so <code>dealmap import</code> reads it.</p>" +
      '<button class="btn" id="sh-export">Export all data</button></div>' +
      '<div class="modal-actions"><button class="btn" data-x>Done</button></div>');
    $("#sh-present").addEventListener("click", function () { close(); present(); });
    $("#sh-download").addEventListener("click", function () {
      saveFile(cur + (curBrand === "default" ? "" : "-" + curBrand) + ".html", deckHtml(cur, curBrand));
    });
    $("#sh-export").addEventListener("click", function () {
      saveFile("deal-desk-export.json", JSON.stringify(STATE, null, 2));
    });
  }

  function saveFile(filename, data) {
    if (!downloads) return toast("Downloads are not available in this view", true);
    downloads.save({ filename: filename, data: data })
      .then(function () { toast("Saved " + filename); })
      .catch(function (e) { toast("Not saved: " + ((e && e.code) || "declined"), true); });
  }

  function present() {
    var o = $("#present");
    o.innerHTML = '<iframe id="present-frame" title="Deck"></iframe>' +
      '<button class="btn present-close" id="present-close">Close ✕</button>';
    o.classList.add("on");
    $("#present-frame").srcdoc = deckHtml(cur, curBrand);
    $("#present-close").addEventListener("click", closePresent);
  }
  function closePresent() { $("#present").classList.remove("on"); $("#present").innerHTML = ""; }

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
    if (e.target.closest("#save")) return save();
    if (e.target.closest("#reload")) return refreshPreview();
    if (e.target.closest("#present-btn")) return present();
  });

  document.addEventListener("change", function (e) {
    if (e.target.id === "audience-pick") {
      curBrand = e.target.value;
      STATE.deals[cur].meta.brand = curBrand;
      markDirty();
      if (tab === "audience") setTab("audience");
      refreshPreview();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if ($("#present").classList.contains("on")) return closePresent();
      if ($("#scrim").classList.contains("on")) return close();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); }
  });

  window.addEventListener("beforeunload", function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  var ft;
  window.addEventListener("resize", function () { clearTimeout(ft); ft = setTimeout(fitFrame, 80); });

  /* ---------------- boot ---------------- */

  function boot() {
    SHELL = decodeURIComponent(escape(atob(window.__SHELL_B64__)));
    $("#who").textContent = STATE.presenter.name || "Deal desk";

    // An unsaved draft from a previous visit outranks nothing — offer it, never apply it silently.
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        var draft = JSON.parse(raw);
        if (draft && draft.state && draft.at > Date.parse(STATE.updatedAt || 0)) {
          $("#draft-bar").hidden = false;
          $("#draft-when").textContent = new Date(draft.at).toLocaleString();
          $("#draft-restore").addEventListener("click", function () {
            STATE = draft.state; $("#draft-bar").hidden = true;
            markDirty(); renderDesk(); toast("Draft restored — save to keep it");
          });
          $("#draft-discard").addEventListener("click", function () {
            localStorage.removeItem(DRAFT_KEY); $("#draft-bar").hidden = true;
          });
        }
      }
    } catch (e) {}

    var parts = (location.hash || "").slice(1).split("/");
    if (parts[1] && ["notes", "story", "audience", "checks"].indexOf(parts[1]) > -1) tab = parts[1];
    renderDesk();
    if (parts[0] && STATE.deals[parts[0]]) openDeal(parts[0]);
    paintSaveState();
  }

  boot();

  // Capabilities answer later, and may not answer at all — the desk works read-only without them.
  if (window.claude && window.claude.use) {
    window.claude.use("artifact").then(function (a) {
      artifact = a;
      readOnly = !a;
      $("#ro-banner").hidden = !readOnly;
      paintSaveState();
      if (cur) setTab(tab); else renderDesk();
    }).catch(function () { $("#ro-banner").hidden = false; });
    window.claude.use("downloads").then(function (d) { downloads = d; }).catch(function () {});
  } else {
    $("#ro-banner").hidden = false;
  }
})();
