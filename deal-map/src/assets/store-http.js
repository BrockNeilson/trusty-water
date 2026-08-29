/* Local store: the desk talks to the dev server, which writes real files under data/.
   Every mutation is written through immediately, so there is nothing to "save". */
window.STORE = (function () {
  "use strict";
  var state = { presenter: {}, deals: {}, brands: {}, notes: {} };

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

  // The server keeps the truth; re-read it after every write.
  function refresh() {
    return api("GET", "/api/state").then(function (s) {
      state.presenter = s.presenter;
      state.brands = {};
      s.brands.forEach(function (b) { state.brands[b.id] = b; });
      state.deals = {};
      state.notes = {};
      return Promise.all(s.deals.map(function (d) {
        return api("GET", "/api/deals/" + d.slug).then(function (full) {
          state.deals[d.slug] = full.deal;
          state.notes[d.slug] = full.notes;
        });
      }));
    });
  }

  return {
    mode: "local",
    explicitSave: false,
    canWrite: true,
    dirty: false,
    state: state,

    init: function () { return refresh(); },

    createDeal: function (slug, name) {
      return api("POST", "/api/deals", { slug: slug, dealName: name }).then(refresh);
    },
    updateDeal: function (slug, deal) {
      return api("PUT", "/api/deals/" + slug, { deal: deal }).then(refresh);
    },
    deleteDeal: function (slug) {
      return api("DELETE", "/api/deals/" + slug).then(refresh);
    },
    saveNotes: function (slug, text) {
      return api("PUT", "/api/notes/" + slug, { notes: text }).then(function () { state.notes[slug] = text; });
    },
    createBrand: function (id, company) {
      return api("POST", "/api/brands", { id: id, company: company }).then(refresh);
    },
    updateBrand: function (id, patch) {
      return api("PUT", "/api/brands/" + id, patch).then(refresh);
    },
    setLogo: function (id, dataUrl) {
      return api("POST", "/api/brands/" + id + "/logo",
        dataUrl ? { dataUrl: dataUrl } : { clear: true }).then(refresh);
    },
    check: function (slug, brandId) {
      return api("GET", "/api/check/" + slug + "?brand=" + encodeURIComponent(brandId));
    },
    deckSource: function (slug, brandId) {
      return { url: "/deck/" + slug + "?brand=" + encodeURIComponent(brandId) + "&t=" + Date.now() };
    },
    save: function () { return Promise.resolve(); },
    download: function (filename, data) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([data], { type: "text/html" }));
      a.download = filename;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      return Promise.resolve();
    },
    exportAll: function () { return JSON.stringify(state, null, 2); }
  };
})();
