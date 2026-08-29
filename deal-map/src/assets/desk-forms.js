/* Structured editors for the deal. One field spec per collection, one renderer,
   one change handler — adding a collection is config, not another form.
   Spotlights are picked from what exists, so a broken reference cannot be typed. */
window.DESKFORMS = (function () {
  "use strict";

  var ROLE_OPTS = ["economic_buyer", "champion", "coach", "technical_buyer", "user_buyer", "blocker", "influencer"];
  var TYPE_OPTS = ["technical", "political", "legal", "commercial", "competitive", "timing"];
  var BEAT_OPTS = ["setup", "stakes", "conflict", "turn", "proof", "close", "result", "lesson"];
  var MEDD = [["metrics","Metrics"],["economicBuyer","Economic Buyer"],["decisionCriteria","Decision Criteria"],
    ["decisionProcess","Decision Process"],["paperProcess","Paper Process"],["identifyPain","Identify Pain"],
    ["champion","Champion"],["competition","Competition"]];

  var SPECS = {
    stakeholders: {
      title: "People", add: "Add a person", labelOf: function (r) { return r.name || "New person"; },
      fields: [
        { k: "name", label: "Name", t: "text", ph: "Dana Okafor", span: 2 },
        { k: "title", label: "Title", t: "text", ph: "CFO", span: 2 },
        { k: "org", label: "Team", t: "text", ph: "Finance", span: 1 },
        { k: "role", label: "Role", t: "select", opts: ROLE_OPTS, span: 1 },
        { k: "influence", label: "Influence 1-3", t: "number", min: 1, max: 3, span: 1 },
        { k: "sentiment", label: "Sentiment -2..2", t: "number", min: -2, max: 2, span: 1 },
        { k: "reportsTo", label: "Reports to", t: "ref", of: "stakeholders", span: 2 },
        { k: "note", label: "What they cared about", t: "text", ph: "One line", span: 2 }
      ]
    },
    obstacles: {
      title: "Obstacles & technical hurdles", add: "Add an obstacle",
      labelOf: function (r) { return r.title || "New obstacle"; },
      fields: [
        { k: "title", label: "Title", t: "text", ph: "Security review", span: 2 },
        { k: "type", label: "Type", t: "select", opts: TYPE_OPTS, span: 1 },
        { k: "status", label: "Status", t: "select", opts: ["cleared", "open"], span: 1 },
        { k: "owner", label: "Owned by", t: "ref", of: "stakeholders", span: 2 },
        { k: "detail", label: "Why it was hard", t: "text", span: 2 },
        { k: "resolution", label: "How it cleared", t: "text", span: 4 }
      ]
    },
    timeline: {
      title: "Deal path", add: "Add a milestone",
      labelOf: function (r) { return r.label || "New milestone"; },
      fields: [
        { k: "date", label: "Date", t: "text", ph: "May 12", span: 1 },
        { k: "label", label: "What happened", t: "text", ph: "Cold outbound", span: 2 },
        { k: "stage", label: "Stage", t: "text", ph: "Discovery", span: 1 },
        { k: "flag", label: "Mark as the stall", t: "check", span: 2 },
        { k: "win", label: "Mark as the close", t: "check", span: 2 }
      ]
    },
    metrics: {
      title: "Result tiles", add: "Add a tile",
      labelOf: function (r) { return r.label || "New tile"; },
      fields: [
        { k: "label", label: "Label", t: "text", ph: "ACV", span: 1 },
        { k: "value", label: "Value", t: "text", ph: "$1.24M", span: 1 },
        { k: "sub", label: "Sub-line", t: "text", ph: "3-yr TCV $3.7M", span: 2 }
      ]
    }
  };

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var human = function (s) { return String(s || "").replace(/_/g, " "); };

  function idFor(deal, coll, seed) {
    var base = String(seed || coll.slice(0, 1)).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 10) || "x";
    var taken = {};
    (deal[coll] || []).forEach(function (r) { taken[r.id] = 1; });
    var id = base, n = 2;
    while (taken[id]) id = base + n++;
    return id;
  }

  function field(coll, idx, f, row, deal) {
    var v = row[f.k];
    var name = 'data-coll="' + coll + '" data-idx="' + idx + '" data-k="' + f.k + '"';
    var input;
    if (f.t === "select") {
      input = "<select " + name + ">" + [""].concat(f.opts).map(function (o) {
        return '<option value="' + esc(o) + '"' + (v === o ? " selected" : "") + ">" + esc(human(o) || "—") + "</option>";
      }).join("") + "</select>";
    } else if (f.t === "ref") {
      var opts = (deal[f.of] || []).filter(function (r) { return r.id !== row.id; });
      input = "<select " + name + '><option value="">—</option>' + opts.map(function (r) {
        return '<option value="' + esc(r.id) + '"' + (v === r.id ? " selected" : "") + ">" +
          esc(r.name || r.title || r.id) + "</option>";
      }).join("") + "</select>";
    } else if (f.t === "check") {
      input = '<label class="chk"><input type="checkbox" ' + name + (v ? " checked" : "") + "> " + esc(f.label) + "</label>";
      return '<div class="f" style="grid-column:span ' + f.span + '">' + input + "</div>";
    } else if (f.t === "number") {
      input = '<input type="number" ' + name + ' value="' + esc(v == null ? "" : v) +
        '" min="' + f.min + '" max="' + f.max + '">';
    } else {
      input = '<input type="text" ' + name + ' value="' + esc(v) + '" placeholder="' + esc(f.ph || "") + '">';
    }
    return '<div class="f" style="grid-column:span ' + f.span + '"><label>' + esc(f.label) + "</label>" + input + "</div>";
  }

  function rows(coll, deal) {
    var spec = SPECS[coll];
    var list = deal[coll] || [];
    if (!list.length) return '<p class="hint empty-row">Nothing here yet.</p>';
    return list.map(function (row, i) {
      return '<div class="row-card"><div class="row-head"><b>' + esc(spec.labelOf(row)) +
        '</b><code>' + esc(row.id || "") + '</code>' +
        '<button class="btn sm ghost danger" data-del="' + coll + '" data-idx="' + i + '">Remove</button></div>' +
        '<div class="row-grid">' + spec.fields.map(function (f) { return field(coll, i, f, row, deal); }).join("") +
        "</div></div>";
    }).join("");
  }

  function section(coll, deal) {
    var spec = SPECS[coll];
    return '<section class="form-block"><div class="zone-head"><h3>' + esc(spec.title) + "</h3>" +
      '<button class="btn sm" data-add="' + coll + '">' + esc(spec.add) + "</button></div>" +
      rows(coll, deal) + "</section>";
  }

  function meddSection(deal) {
    var m = deal.meddpicc || {};
    return '<section class="form-block"><div class="zone-head"><h3>MEDDPICC</h3>' +
      '<span class="hint">Score each 0-3. The proof line is what survives a follow-up question.</span></div>' +
      MEDD.map(function (pair) {
        var key = pair[0], v = m[key] || {};
        return '<div class="row-card"><div class="row-grid">' +
          '<div class="f" style="grid-column:span 1"><label>' + esc(pair[1]) + "</label>" +
          '<select data-medd="' + key + '" data-k="score">' + [0, 1, 2, 3].map(function (n) {
            return '<option value="' + n + '"' + ((v.score || 0) === n ? " selected" : "") + ">" + n + "</option>";
          }).join("") + "</select></div>" +
          '<div class="f" style="grid-column:span 1"><label>Headline</label>' +
          '<input type="text" data-medd="' + key + '" data-k="headline" value="' + esc(v.headline) + '"></div>' +
          '<div class="f" style="grid-column:span 2"><label>Proof</label>' +
          '<input type="text" data-medd="' + key + '" data-k="proof" value="' + esc(v.proof) + '"></div>' +
          "</div></div>";
      }).join("") + "</section>";
  }

  function chips(step, i, kind, list, labelOf) {
    var on = (step.spotlight && step.spotlight[kind]) || [];
    if (!list.length) return "";
    return '<div class="chip-row"><span class="chip-label">' + esc(kind) + "</span>" +
      list.map(function (item) {
        var id = item.id, sel = on.indexOf(id) > -1;
        return '<button class="pickchip' + (sel ? " on" : "") + '" data-spot="' + i +
          '" data-kind="' + kind + '" data-id="' + esc(id) + '">' + esc(labelOf(item)) + "</button>";
      }).join("") + "</div>";
  }

  function stepsSection(deal) {
    var steps = deal.steps || [];
    return '<section class="form-block"><div class="zone-head"><h3>Steps</h3>' +
      '<button class="btn sm" data-add="steps">Add a step</button></div>' +
      steps.map(function (s, i) {
        var b = s.bullets || [];
        return '<div class="row-card"><div class="row-head"><b>' + (i + 1) + ". " + esc(s.title || "Untitled") +
          '</b><code>' + esc(s.id || "") + "</code>" +
          '<button class="btn sm ghost" data-move="' + i + '" data-dir="-1"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
          '<button class="btn sm ghost" data-move="' + i + '" data-dir="1"' + (i === steps.length - 1 ? " disabled" : "") + ">↓</button>" +
          '<button class="btn sm ghost danger" data-del="steps" data-idx="' + i + '">Remove</button></div>' +
          '<div class="row-grid">' +
          '<div class="f" style="grid-column:span 1"><label>Beat</label><select data-coll="steps" data-idx="' + i +
            '" data-k="beat">' + [""].concat(BEAT_OPTS).map(function (o) {
              return '<option value="' + o + '"' + (s.beat === o ? " selected" : "") + ">" + (o || "—") + "</option>";
            }).join("") + "</select></div>" +
          '<div class="f" style="grid-column:span 1"><label>Kicker</label><input type="text" data-coll="steps" data-idx="' + i +
            '" data-k="kicker" value="' + esc(s.kicker) + '" placeholder="The turn"></div>' +
          '<div class="f" style="grid-column:span 2"><label>Title — 6 words max</label><input type="text" data-coll="steps" data-idx="' + i +
            '" data-k="title" value="' + esc(s.title) + '"></div>' +
          [0, 1, 2].map(function (n) {
            return '<div class="f" style="grid-column:span 4"><label>Bullet ' + (n + 1) +
              " — 10 words max</label><input type=\"text\" data-bullet=\"" + i + '" data-n="' + n +
              '" value="' + esc(b[n] || "") + '"></div>';
          }).join("") +
          '<div class="f" style="grid-column:span 4"><label>Presenter note — only you see this</label>' +
            '<input type="text" data-coll="steps" data-idx="' + i + '" data-k="notes" value="' + esc(s.notes) + '"></div>' +
          "</div>" +
          '<div class="spotlight-pick"><div class="hint">Light up on this step — click to toggle</div>' +
          chips(s, i, "stakeholders", deal.stakeholders || [], function (r) { return r.name; }) +
          chips(s, i, "obstacles", deal.obstacles || [], function (r) { return r.title; }) +
          chips(s, i, "timeline", deal.timeline || [], function (r) { return r.label; }) +
          chips(s, i, "meddpicc", MEDD.map(function (p) { return { id: p[0], label: p[1] }; }), function (r) { return r.label; }) +
          '<div class="chip-row"><span class="chip-label">focus</span><select data-focus="' + i + '">' +
            [["", "auto"], ["stakeholders", "people"], ["obstacles", "obstacles"], ["timeline", "deal path"], ["meddpicc", "MEDDPICC"]]
              .map(function (o) {
                var sel = ((s.spotlight || {}).focus || "") === o[0];
                return '<option value="' + o[0] + '"' + (sel ? " selected" : "") + ">" + o[1] + "</option>";
              }).join("") + "</select>" +
            '<label class="chk"><input type="checkbox" data-metrics="' + i + '"' +
              ((s.spotlight || {}).metrics ? " checked" : "") + "> show result tiles</label></div>" +
          "</div></div>";
      }).join("") + "</section>";
  }

  return {
    mapHtml: function (deal) {
      return section("stakeholders", deal) + section("obstacles", deal) +
             section("timeline", deal) + section("metrics", deal) + meddSection(deal);
    },
    storyHtml: function (deal) { return stepsSection(deal); },

    /* One delegated handler for every editor above. Returns true if it changed the deal. */
    apply: function (deal, e) {
      var t = e.target, k = t.dataset;
      var val = t.type === "checkbox" ? t.checked : (t.type === "number" ? (t.value === "" ? null : +t.value) : t.value);

      if (k.coll && k.idx != null && k.k) {
        deal[k.coll][+k.idx][k.k] = val === "" ? undefined : val;
        return true;
      }
      if (k.bullet != null) {
        var s = deal.steps[+k.bullet];
        s.bullets = s.bullets || [];
        s.bullets[+k.n] = val;
        s.bullets = s.bullets.filter(function (b) { return b && b.trim(); });
        return true;
      }
      if (k.medd) {
        deal.meddpicc = deal.meddpicc || {};
        deal.meddpicc[k.medd] = deal.meddpicc[k.medd] || {};
        deal.meddpicc[k.medd][k.k] = k.k === "score" ? +val : val;
        return true;
      }
      if (k.focus != null) {
        var st = deal.steps[+k.focus];
        st.spotlight = st.spotlight || {};
        if (val) st.spotlight.focus = val; else delete st.spotlight.focus;
        return true;
      }
      if (k.metrics != null) {
        var sm = deal.steps[+k.metrics];
        sm.spotlight = sm.spotlight || {};
        if (val) sm.spotlight.metrics = true; else delete sm.spotlight.metrics;
        return true;
      }
      return false;
    },

    /* Clicks: add, remove, reorder, toggle a spotlight chip. */
    click: function (deal, e) {
      var chip = e.target.closest("[data-spot]");
      if (chip) {
        var s = deal.steps[+chip.dataset.spot];
        s.spotlight = s.spotlight || {};
        var arr = s.spotlight[chip.dataset.kind] || [];
        var i = arr.indexOf(chip.dataset.id);
        if (i > -1) arr.splice(i, 1); else arr.push(chip.dataset.id);
        if (arr.length) s.spotlight[chip.dataset.kind] = arr;
        else delete s.spotlight[chip.dataset.kind];
        return true;
      }
      var add = e.target.closest("[data-add]");
      if (add) {
        var coll = add.dataset.add;
        deal[coll] = deal[coll] || [];
        if (coll === "steps") {
          deal.steps.push({ id: idFor(deal, "steps", "s" + (deal.steps.length + 1)), beat: "", kicker: "",
            title: "New step", bullets: [], spotlight: {}, notes: "" });
        } else if (coll === "metrics") {
          deal.metrics.push({ label: "", value: "", sub: "" });
        } else {
          deal[coll].push({ id: idFor(deal, coll, coll.slice(0, 1)) });
        }
        return true;
      }
      var del = e.target.closest("[data-del]");
      if (del) {
        var c = del.dataset.del, idx = +del.dataset.idx;
        var gone = deal[c][idx];
        deal[c].splice(idx, 1);
        if (gone && gone.id) cleanRefs(deal, c, gone.id);
        return true;
      }
      var mv = e.target.closest("[data-move]");
      if (mv) {
        var from = +mv.dataset.move, to = from + (+mv.dataset.dir);
        if (to < 0 || to >= deal.steps.length) return false;
        var row = deal.steps.splice(from, 1)[0];
        deal.steps.splice(to, 0, row);
        return true;
      }
      return false;
    },

    // Removing something must not leave a dangling reference behind.
    idOf: idFor
  };

  function cleanRefs(deal, coll, id) {
    (deal.steps || []).forEach(function (s) {
      var sp = s.spotlight || {};
      if (sp[coll]) {
        sp[coll] = sp[coll].filter(function (x) { return x !== id; });
        if (!sp[coll].length) delete sp[coll];
      }
    });
    if (coll === "stakeholders") {
      (deal.stakeholders || []).forEach(function (p) { if (p.reportsTo === id) delete p.reportsTo; });
      (deal.obstacles || []).forEach(function (o) { if (o.owner === id) delete o.owner; });
    }
  }
})();
