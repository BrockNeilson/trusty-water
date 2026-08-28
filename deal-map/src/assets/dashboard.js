/* Deal desk — client. Talks to the local server; every edit writes a file in data/. */
(function () {
  "use strict";
  var S = { deals: [], brands: [], presenter: {} };
  var cur = null;          // { summary, deal, notes }
  var curBrand = "default";
  var tab = "notes";
  var timers = {};

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  function api(method, path, payload) {
    return fetch(path, {
      method: method,
      headers: payload ? { "content-type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || r.statusText);
        return j;
      });
    });
  }

  var toastT;
  function toast(msg, bad) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "toast on" + (bad ? " bad" : "");
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.className = "toast"; }, bad ? 5200 : 2100);
  }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  function debounce(key, fn, ms) {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(fn, ms || 700);
  }
  function flashSaved(sel) {
    var e = $(sel); if (!e) return;
    e.textContent = "saved"; e.className = "saving on";
    setTimeout(function () { e.textContent = ""; e.className = "saving"; }, 1400);
  }

  /* ---------------- desk ---------------- */

  function scoreChip(d) {
    if (d.draft) return '<span class="chip warn">Sample</span>';
    if (d.structuralErrors) return '<span class="chip bad">' + d.structuralErrors + ' to fix</span>';
    return '<span class="chip ok">Ready</span>';
  }

  function brandOf(id) {
    return S.brands.filter(function (b) { return b.id === id; })[0] || S.brands[0];
  }

  function renderDesk() {
    $("#desk").style.display = "";
    $("#deal").classList.remove("on");
    var cards = S.deals.map(function (d) {
      var b = brandOf(d.brand);
      return '<button class="card" data-open="' + esc(d.slug) + '">' +
        '<div class="chips">' + scoreChip(d) +
          (d.outcome ? '<span class="chip">' + esc(d.outcome) + "</span>" : "") +
          (b && b.company ? '<span class="chip audience"><span class="dot" style="background:' +
            esc(b.accent) + '"></span>' + esc(b.company) + "</span>"
            : '<span class="chip">No audience</span>') +
        "</div>" +
        "<h2>" + esc(d.dealName) + "</h2>" +
        '<div class="one">' + esc(d.oneLiner || d.industry || "No summary yet") + "</div>" +
        '<div class="figs">' +
          "<div>" + (d.acv ? "<b>" + esc(d.acv) + "</b>ACV" : "<b>—</b>ACV") + "</div>" +
          "<div><b>" + d.steps + "</b>steps</div>" +
          "<div><b>" + d.stakeholders + "</b>people</div>" +
          "<div><b>" + (d.notesWords || 0) + "</b>words of notes</div>" +
        "</div></button>";
    }).join("");
    $("#grid").innerHTML = cards +
      '<button class="card card-new" id="new-deal"><span class="plus">+</span><span>New deal</span></button>';
    $("#deskcount").textContent = plural(S.deals.length, "deal");
  }

  /* ---------------- deal view ---------------- */

  function openDeal(slug) {
    return api("GET", "/api/deals/" + slug).then(function (data) {
      cur = data;
      curBrand = data.deal.meta && data.deal.meta.brand ? data.deal.meta.brand : "default";
      $("#desk").style.display = "none";
      $("#deal").classList.add("on");
      $("#deal-name").textContent = data.summary.dealName;
      renderAudiencePicker();
      setTab(tab);
      refreshPreview();
      writeHash();
    });
  }

  function backToDesk() {
    cur = null;
    history.replaceState(null, "", "#");
    return refreshState().then(renderDesk);
  }

  function renderAudiencePicker() {
    $("#audience-pick").innerHTML = S.brands.map(function (b) {
      return '<option value="' + esc(b.id) + '"' + (b.id === curBrand ? " selected" : "") + ">" +
        esc(b.company || b.id) + "</option>";
    }).join("");
  }

  function writeHash() {
    if (!cur) { history.replaceState(null, "", "#"); return; }
    history.replaceState(null, "", "#" + cur.summary.slug + (tab === "notes" ? "" : "/" + tab));
  }

  function setTab(name) {
    tab = name;
    writeHash();
    $$(".tab").forEach(function (t) { t.classList.toggle("on", t.dataset.tab === name); });
    var body = $("#panel-body");
    if (name === "notes") body.innerHTML = notesTab();
    else if (name === "story") body.innerHTML = storyTab();
    else if (name === "audience") body.innerHTML = audienceTab();
    else if (name === "checks") { body.innerHTML = '<div class="empty">Running checks…</div>'; runChecks(); }
    wireTab();
  }

  function notesTab() {
    return '<div class="field"><label>Raw notes <span class="saving" id="notes-saved"></span></label>' +
      '<div class="hint">Prose, fragments, a pasted transcript. This is the source the deal is generated from — ' +
      'ask Claude to <em>"turn my ' + esc(cur.summary.slug) + ' notes into a deal"</em> when you are done.</div>' +
      '<textarea class="notes" id="notes">' + esc(cur.notes) + "</textarea></div>";
  }

  function storyTab() {
    return '<div class="field"><label>Deal file <span class="saving" id="story-saved"></span></label>' +
      '<div class="hint">The structured deal. Invalid JSON or a broken reference will not save — the error tells you which.</div>' +
      '<textarea class="json" id="story" spellcheck="false">' + esc(JSON.stringify(cur.deal, null, 2)) + "</textarea>" +
      '<div class="modal-actions"><button class="btn" id="story-revert">Revert</button>' +
      '<button class="btn primary" id="story-save">Save deal file</button></div></div>';
  }

  function audienceTab() {
    var b = brandOf(curBrand);
    if (!b) return '<div class="empty">No audience selected.</div>';
    var logo = b.hasLogoFile
      ? '<img src="/api/logo-preview?brand=' + esc(b.id) + "&t=" + Date.now() + '" alt="">'
      : "<span>Drop a logo here, or click to choose</span><span style=\"font-size:11px\">PNG, SVG, JPEG or WebP · inlined into every deck</span>";
    return '<div class="field"><label>Company <span class="saving" id="brand-saved"></span></label>' +
        '<input type="text" id="b-company" value="' + esc(b.company) + '" placeholder="Brex"></div>' +
      '<div class="row"><div class="field"><label>Wordmark</label>' +
        '<input type="text" id="b-wordmark" value="' + esc(b.wordmark) + '" placeholder="Shown when there is no logo"></div>' +
      '<div class="field"><label>Label</label>' +
        '<input type="text" id="b-label" value="' + esc(b.preparedForLabel) + '" placeholder="Prepared for"></div></div>' +
      '<div class="field"><label>Logo</label>' +
        '<div class="logo-drop" id="logo-drop">' + logo + "</div>" +
        (b.hasLogoFile ? '<button class="btn sm ghost" id="logo-clear" style="align-self:flex-start">Remove logo</button>' : "") +
        '<input type="file" id="logo-file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden></div>' +
      '<div class="field"><label>Colour scheme</label><div class="swatches">' +
        ["accent", "accent2", "bg", "surface", "ink"].map(function (k) {
          var name = { accent: "Accent", accent2: "Accent 2", bg: "Background", surface: "Card", ink: "Text" }[k];
          return '<div class="swatch"><label>' + name + "</label><div class=\"pick\">" +
            '<input type="color" data-c="' + k + '" value="' + esc(b[k]) + '">' +
            '<input type="text" data-t="' + k + '" value="' + esc(b[k]) + '"></div></div>';
        }).join("") + "</div>" +
        '<div class="contrast" id="contrast"></div></div>' +
      '<div class="modal-actions"><button class="btn" id="new-audience">New audience</button></div>';
  }

  function contrastLine() {
    var b = brandOf(curBrand); if (!b) return;
    var el = $("#contrast"); if (!el) return;
    var warn = function (v, min) { return v == null ? "" : (v < min ? ' style="color:var(--warn)"' : ""); };
    el.innerHTML =
      '<span class="m"' + warn(b.contrast.accent, 4.5) + ">accent on background <b>" + (b.contrast.accent || "?") + ":1</b> (want 4.5+)</span>" +
      '<span class="m"' + warn(b.contrast.ink, 7) + ">text on background <b>" + (b.contrast.ink || "?") + ":1</b> (want 7+)</span>";
  }

  function runChecks() {
    api("GET", "/api/check/" + cur.summary.slug + "?brand=" + encodeURIComponent(curBrand)).then(function (out) {
      var rules = out.results.map(function (r) {
        var shown = r.findings;
        var head = '<div class="rh"><b>' + esc(r.id) + "</b><span>" + esc(r.about) + "</span></div>";
        if (!shown.length) return '<div class="rule">' + head + '<div class="finding info"><span class="mk">✓</span>clean</div></div>';
        return '<div class="rule">' + head + shown.map(function (f) {
          var mk = { error: "✕", warn: "!", info: "·" }[f.level];
          return '<div class="finding ' + f.level + '"><span class="mk">' + mk + '</span><span>' +
            (f.at ? '<span class="at">' + esc(f.at) + "</span> " : "") + esc(f.msg) + "</span></div>";
        }).join("") + "</div>";
      }).join("");
      $("#panel-body").innerHTML =
        '<div class="score"><span class="v">' + out.score + '</span><span class="of">/ 100</span>' +
        '<span class="counts"><span>' + plural(out.counts.error, "error") + "</span><span>" +
        plural(out.counts.warn, "warning") + "</span><span>" + plural(out.counts.info, "note") + "</span></span></div>" +
        rules;
      $("#tab-checks-n").textContent = out.counts.error ? out.counts.error : "";
    }).catch(function (e) { $("#panel-body").innerHTML = '<div class="empty">' + esc(e.message) + "</div>"; });
  }

  var FRAME_W = 1440, FRAME_H = 900;

  function fitFrame() {
    var wrap = $("#frame-wrap"), stage = $("#frame-stage");
    if (!wrap || !stage) return;
    var availW = wrap.clientWidth - 32, availH = wrap.clientHeight - 32;
    if (availW <= 0 || availH <= 0) return;
    var k = Math.min(availW / FRAME_W, availH / FRAME_H);
    stage.style.transform = "scale(" + k.toFixed(4) + ")";
    stage.style.left = Math.max(16, 16 + (availW - FRAME_W * k) / 2) + "px";
    stage.style.top = Math.max(16, 16 + (availH - FRAME_H * k) / 2) + "px";
    var size = $("#frame-size");
    if (size) size.textContent = FRAME_W + "×" + FRAME_H + " · " + Math.round(k * 100) + "%";
  }

  function refreshPreview() {
    var f = $("#frame");
    f.src = "/deck/" + cur.summary.slug + "?brand=" + encodeURIComponent(curBrand) + "&t=" + Date.now();
    fitFrame();
  }

  /* ---------------- wiring ---------------- */

  function wireTab() {
    var n = $("#notes");
    if (n) {
      n.addEventListener("input", function () {
        debounce("notes", function () {
          api("PUT", "/api/notes/" + cur.summary.slug, { notes: n.value })
            .then(function (r) { cur.notes = n.value; flashSaved("#notes-saved"); })
            .catch(function (e) { toast(e.message, true); });
        });
      });
    }

    var s = $("#story");
    if (s) {
      $("#story-revert").addEventListener("click", function () { s.value = JSON.stringify(cur.deal, null, 2); });
      $("#story-save").addEventListener("click", function () {
        api("PUT", "/api/deals/" + cur.summary.slug, { deal: s.value }).then(function (r) {
          cur.deal = JSON.parse(s.value);
          cur.summary = r.summary;
          curBrand = cur.deal.meta.brand || curBrand;
          $("#deal-name").textContent = r.summary.dealName;
          flashSaved("#story-saved");
          toast(r.warnings.length ? "Saved — " + r.warnings.length + " warnings in Checks" : "Saved");
          refreshPreview();
        }).catch(function (e) { toast(e.message, true); });
      });
    }

    if ($("#b-company")) {
      contrastLine();
      var save = function (patch) {
        debounce("brand", function () {
          api("PUT", "/api/brands/" + curBrand, patch).then(function (b) {
            var i = S.brands.findIndex(function (x) { return x.id === b.id; });
            if (i > -1) S.brands[i] = b;
            flashSaved("#brand-saved");
            contrastLine();
            refreshPreview();
          }).catch(function (e) { toast(e.message, true); });
        }, 450);
      };
      $("#b-company").addEventListener("input", function (e) { save({ company: e.target.value }); });
      $("#b-wordmark").addEventListener("input", function (e) { save({ wordmark: e.target.value }); });
      $("#b-label").addEventListener("input", function (e) { save({ preparedForLabel: e.target.value }); });
      $$('input[type=color]').forEach(function (c) {
        c.addEventListener("input", function () {
          var t = $('input[data-t="' + c.dataset.c + '"]');
          if (t) t.value = c.value;
          var p = {}; p[c.dataset.c] = c.value; save(p);
        });
      });
      $$('input[data-t]').forEach(function (t) {
        t.addEventListener("change", function () {
          if (!/^#[0-9a-fA-F]{6}$/.test(t.value)) { toast("Use a 6-digit hex colour", true); return; }
          var c = $('input[data-c="' + t.dataset.t + '"]');
          if (c) c.value = t.value;
          var p = {}; p[t.dataset.t] = t.value; save(p);
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
        if (e.dataTransfer.files && e.dataTransfer.files[0]) uploadLogo(e.dataTransfer.files[0]);
      });
      file.addEventListener("change", function () { if (file.files[0]) uploadLogo(file.files[0]); });
      if ($("#logo-clear")) {
        $("#logo-clear").addEventListener("click", function () {
          api("POST", "/api/brands/" + curBrand + "/logo", { clear: true }).then(function (b) {
            var i = S.brands.findIndex(function (x) { return x.id === b.id; });
            if (i > -1) S.brands[i] = b;
            setTab("audience"); refreshPreview(); toast("Logo removed");
          }).catch(function (e) { toast(e.message, true); });
        });
      }
      $("#new-audience").addEventListener("click", newAudience);
    }
  }

  function uploadLogo(f) {
    var r = new FileReader();
    r.onload = function () {
      api("POST", "/api/brands/" + curBrand + "/logo", { dataUrl: r.result }).then(function (b) {
        var i = S.brands.findIndex(function (x) { return x.id === b.id; });
        if (i > -1) S.brands[i] = b;
        setTab("audience"); refreshPreview(); toast("Logo added");
      }).catch(function (e) { toast(e.message, true); });
    };
    r.readAsDataURL(f);
  }

  /* ---------------- modals ---------------- */

  function modal(html) {
    var s = $("#scrim");
    s.innerHTML = '<div class="modal">' + html + "</div>";
    s.classList.add("on");
    s.addEventListener("click", function (e) { if (e.target === s) close(); });
    return s;
  }
  function close() { $("#scrim").classList.remove("on"); $("#scrim").innerHTML = ""; }

  function newDeal() {
    modal('<h3>New deal</h3><p class="lede">This creates the deal file and a notes file to write the story into.</p>' +
      '<div class="field"><label>Deal name</label><input type="text" id="nd-name" placeholder="Northwind Logistics"></div>' +
      '<div class="field"><label>Short id</label><input type="text" id="nd-slug" placeholder="northwind">' +
      '<div class="hint">Lowercase, no spaces. Used for filenames.</div></div>' +
      '<div class="modal-actions"><button class="btn" data-x>Cancel</button>' +
      '<button class="btn primary" id="nd-go">Create</button></div>');
    var name = $("#nd-name"), slug = $("#nd-slug");
    name.focus();
    name.addEventListener("input", function () {
      slug.value = name.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    });
    $("#nd-go").addEventListener("click", function () {
      api("POST", "/api/deals", { slug: slug.value, dealName: name.value })
        .then(function (d) { close(); return refreshState().then(function () { return openDeal(d.slug); }); })
        .catch(function (e) { toast(e.message, true); });
    });
  }

  function newAudience() {
    modal('<h3>New audience</h3><p class="lede">One per company you present to. The deck header reads ' +
      "<em>your name · prepared for them</em>.</p>" +
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
      api("POST", "/api/brands", { id: i.value, company: c.value }).then(function (b) {
        return refreshState().then(function () {
          curBrand = b.id;
          close();
          return setBrandOnDeal(b.id).then(function () { renderAudiencePicker(); setTab("audience"); refreshPreview(); });
        });
      }).catch(function (e) { toast(e.message, true); });
    });
  }

  function setBrandOnDeal(id) {
    cur.deal.meta = cur.deal.meta || {};
    cur.deal.meta.brand = id;
    return api("PUT", "/api/deals/" + cur.summary.slug, { deal: cur.deal, force: true })
      .then(function (r) { cur.summary = r.summary; });
  }

  function confirmDelete() {
    var name = cur.summary.dealName;
    modal("<h3>Delete this deal?</h3><p class=\"lede\"><strong>" + esc(name) +
      "</strong> and its deal file go. Your raw notes in <code>data/notes/" + esc(cur.summary.slug) +
      ".md</code> are kept, so the story is recoverable.</p>" +
      '<div class="modal-actions"><button class="btn" data-x>Cancel</button>' +
      '<button class="btn primary" id="del-go" style="background:var(--bad);border-color:var(--bad);color:#fff">Delete deal</button></div>');
    $("#del-go").addEventListener("click", function () {
      api("DELETE", "/api/deals/" + cur.summary.slug).then(function () {
        close();
        toast("Deleted — the notes were kept");
        return backToDesk();
      }).catch(function (e) { toast(e.message, true); });
    });
  }

  function share() {
    var b = brandOf(curBrand);
    var slug = cur.summary.slug;
    var existing = (cur.deal.meta && cur.deal.meta.shareUrl) || "";
    modal('<h3>Share this deal</h3><p class="lede">Prepared for <strong>' + esc(b.company || "no audience") +
      "</strong>. Everything below is this deal only — no other deal travels with it.</p>" +
      '<div class="share-opt"><h4>Send the file</h4>' +
      "<p>One self-contained HTML file. Opens offline on any laptop, no install. Email it, or open it from a USB stick.</p>" +
      '<a class="btn primary" href="/download/' + esc(slug) + "?brand=" + encodeURIComponent(curBrand) +
      '" download>Download the deck</a></div>' +
      '<div class="share-opt"><h4>Publish a link</h4>' +
      "<p>Write both forms to <code>dist/</code>, then ask Claude to publish the <code>.artifact.html</code> " +
      "as an Artifact. Paste the URL back here and the desk keeps it with the deal.</p>" +
      '<button class="btn" id="sh-write">Write to dist/</button>' +
      '<div class="path" id="sh-paths" style="margin-top:9px"></div>' +
      '<div class="copyrow" style="margin-top:11px"><input type="text" id="sh-url" placeholder="https://claude.ai/code/artifact/…" value="' +
      esc(existing) + '"><button class="btn" id="sh-save">Save</button></div></div>' +
      '<div class="modal-actions"><button class="btn" data-x>Done</button></div>');

    $("#sh-write").addEventListener("click", function () {
      api("POST", "/api/share/" + slug, { brand: curBrand }).then(function (r) {
        $("#sh-paths").innerHTML = esc(r.standalone) + "<br>" + esc(r.artifact) +
          "<br>" + Math.round(r.bytes / 1024) + " KB";
        toast("Written to dist/");
      }).catch(function (e) { toast(e.message, true); });
    });
    $("#sh-save").addEventListener("click", function () {
      api("POST", "/api/share/" + slug, { brand: curBrand, shareUrl: $("#sh-url").value }).then(function () {
        cur.deal.meta.shareUrl = $("#sh-url").value;
        toast("Link saved with the deal");
      }).catch(function (e) { toast(e.message, true); });
    });
  }

  /* ---------------- boot ---------------- */

  function refreshState() {
    return api("GET", "/api/state").then(function (s) {
      S = s;
      $("#who").textContent = s.presenter.name || "Set your name";
      return s;
    });
  }

  document.addEventListener("click", function (e) {
    var open = e.target.closest("[data-open]");
    if (open) return openDeal(open.dataset.open);
    if (e.target.closest("#new-deal")) return newDeal();
    if (e.target.closest("[data-x]")) return close();
    var t = e.target.closest(".tab");
    if (t) return setTab(t.dataset.tab);
    if (e.target.closest("#back")) return backToDesk();
    if (e.target.closest("#share")) return share();
    if (e.target.closest("#delete")) return confirmDelete();
    if (e.target.closest("#reload")) return refreshPreview();
    if (e.target.closest("#openfull")) {
      window.open("/deck/" + cur.summary.slug + "?brand=" + encodeURIComponent(curBrand), "_blank");
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target.id === "audience-pick") {
      curBrand = e.target.value;
      setBrandOnDeal(curBrand).then(function () {
        if (tab === "audience") setTab("audience");
        refreshPreview();
        toast("Audience set to " + (brandOf(curBrand).company || curBrand));
      }).catch(function (err) { toast(err.message, true); });
    }
  });

  var ft;
  window.addEventListener("resize", function () { clearTimeout(ft); ft = setTimeout(fitFrame, 80); });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { if ($("#scrim").classList.contains("on")) close(); else if (cur) backToDesk(); }
  });

  refreshState().then(function () {
    var parts = (location.hash || "").slice(1).split("/");
    var slug = parts[0];
    if (parts[1] && ["notes", "story", "audience", "checks"].indexOf(parts[1]) > -1) tab = parts[1];
    if (slug && S.deals.some(function (d) { return d.slug === slug; })) { renderDesk(); openDeal(slug); }
    else renderDesk();
  });
})();
