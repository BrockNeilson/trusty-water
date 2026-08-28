/* Hosted store: the page is the database. Edits are held in memory and mirrored to
   this device, then Save republishes the whole document with the data inside it. */
window.STORE = (function () {
  "use strict";
  var state = window.__DESK_STATE__ || { presenter: {}, deals: {}, brands: {}, notes: {} };
  var DRAFT_KEY = "dealdesk:draft";
  var artifact = null, downloads = null, SHELL = null;
  var MARK = { shell: "%%" + "SHELL" + "%%", state: "%%" + "STATE" + "%%" };

  var api = {
    mode: "hosted",
    explicitSave: true,
    canWrite: false,          // until a writable capability answers
    dirty: false,
    state: state,
    onReady: null,

    init: function () {
      SHELL = decodeURIComponent(escape(atob(window.__SHELL_B64__)));
      if (window.claude && window.claude.use) {
        window.claude.use("artifact").then(function (a) {
          artifact = a; api.canWrite = !!a;
          if (api.onReady) api.onReady();
        }).catch(function () { if (api.onReady) api.onReady(); });
        window.claude.use("downloads").then(function (d) { downloads = d; }).catch(function () {});
      }
      return Promise.resolve();
    },

    // An unsaved draft is offered back, never applied silently.
    pendingDraft: function () {
      try {
        var raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        var d = JSON.parse(raw);
        return d && d.state && d.at > Date.parse(state.updatedAt || 0) ? d : null;
      } catch (e) { return null; }
    },
    applyDraft: function (d) { state = api.state = d.state; api.dirty = true; },
    discardDraft: function () { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} },

    createDeal: function (slug, name) {
      if (state.deals[slug]) return Promise.reject(new Error('A deal called "' + slug + '" already exists'));
      state.deals[slug] = blank(slug, name);
      state.notes[slug] = (window.__NOTES_TEMPLATE__ || "").replace("<Customer>", name || slug);
      return touch();
    },
    updateDeal: function (slug, deal) {
      var errs = validateDeal(normalize(deal)).filter(function (i) { return i.level === "error"; });
      if (errs.length) return Promise.reject(new Error((errs[0].where || "") + " " + errs[0].msg));
      deal.meta = deal.meta || {};
      deal.meta.slug = slug;
      state.deals[slug] = deal;
      return touch();
    },
    deleteDeal: function (slug) {
      delete state.deals[slug]; delete state.notes[slug];
      return touch();
    },
    saveNotes: function (slug, text) { state.notes[slug] = text; return touch(); },
    createBrand: function (id, company) {
      if (state.brands[id]) return Promise.reject(new Error("That audience already exists"));
      state.brands[id] = { id: id, company: company, wordmark: company, preparedForLabel: "Prepared for",
        accent: "#5B8DEF", accent2: "#9B7BF0", bg: "#0B0E14", surface: "#141922", ink: "#E8EDF5", font: "Inter" };
      return touch();
    },
    updateBrand: function (id, patch) {
      state.brands[id] = state.brands[id] || { id: id };
      for (var k in patch) state.brands[id][k] = patch[k];
      return touch();
    },
    setLogo: function (id, dataUrl) {
      if (dataUrl) state.brands[id].logoData = dataUrl;
      else delete state.brands[id].logoData;
      return touch();
    },

    check: function (slug, brandId) {
      var deal = normalize(state.deals[slug]);
      var ctx = { brand: api.renderBrand(brandId), presenter: state.presenter };
      var results = [{ id: "schema", about: "Structure the renderer requires.",
        findings: validateDeal(deal).map(function (i) { return { level: i.level, at: i.where, msg: i.msg }; }) }];
      RULES.forEach(function (r) {
        var f = [];
        try { f = r.run(deal, ctx) || []; }
        catch (e) { f = [{ level: "error", at: r.id, msg: "rule threw: " + e.message }]; }
        results.push({ id: r.id, about: r.about, findings: f });
      });
      var counts = { error: 0, warn: 0, info: 0 };
      results.forEach(function (r) { r.findings.forEach(function (f) { counts[f.level] = (counts[f.level] || 0) + 1; }); });
      return Promise.resolve({ results: results, counts: counts,
        score: Math.max(0, 100 - counts.error * 8 - counts.warn * 2) });
    },

    renderBrand: function (id) {
      var b = JSON.parse(JSON.stringify(state.brands[id] || state.brands["default"] || { id: "default" }));
      if (b.logoData) b._logoData = b.logoData;
      return b;
    },
    deckHtml: function (slug, brandId) {
      return render({ deal: normalize(state.deals[slug]), brand: api.renderBrand(brandId),
        presenter: state.presenter, assets: window.__DECK_ASSETS__ });
    },
    deckSource: function (slug, brandId) { return { html: api.deckHtml(slug, brandId) }; },

    save: function () {
      if (!artifact) return Promise.reject(new Error("This is a read-only view"));
      state.updatedAt = new Date().toISOString();
      var json = JSON.stringify(state).replace(/</g, "\\u003c");
      var doc = SHELL.replace(MARK.shell, window.__SHELL_B64__).replace(MARK.state, json);
      if (doc.indexOf(MARK.shell) > -1 || doc.indexOf(MARK.state) > -1) {
        return Promise.reject(new Error("template did not fill cleanly"));
      }
      return artifact.publish(doc).then(function () {
        api.dirty = false;
        api.discardDraft();
      });
    },
    download: function (filename, data) {
      if (!downloads) return Promise.reject(new Error("Downloads are not available in this view"));
      return downloads.save({ filename: filename, data: data });
    },
    exportAll: function () { return JSON.stringify(state, null, 2); }
  };

  function touch() {
    api.dirty = true;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), state: state })); } catch (e) {}
    return Promise.resolve();
  }

  function blank(slug, name) {
    return {
      meta: { slug: slug, draft: true, dealName: name, customer: name, industry: "", acv: "",
              cycleDays: null, outcome: "", oneLiner: "", targetMinutes: 6, brand: "default" },
      metrics: [], stakeholders: [], obstacles: [], meddpicc: {}, timeline: [],
      steps: [{ id: "s1", beat: "setup", kicker: "The account", title: "Start here",
                bullets: ["Write your notes first", "Then generate this deal"], spotlight: {},
                notes: "Replace this once the notes are written." }]
    };
  }

  return api;
})();
