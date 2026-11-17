/* The pub quiz: questions from quiz/questions.md, one slide per question, and the #quiz page
   for phones. Answers travel over a "bus" (see config.js): the slides publish which question
   is open, phones send their answer, the slides count them. */
(function () {
  "use strict";
  var CFG = window.DURF_DAY || {};
  var COLOURS = ["var(--durf-theme-3)", "var(--durf-theme-1)", "var(--durf-theme-4)", "var(--durf-theme-5)", "var(--durf-theme-6)", "var(--durf-theme-2)"];
  var KEYS = "ABCDEF";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function inline(s) { return window.marked && window.marked.parseInline ? window.marked.parseInline(s) : esc(s); }

  /* "### question" then "- [x] right" / "- [ ] wrong" / "- wrong" */
  function parse(md) {
    var qs = [], cur = null;
    md.replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/).forEach(function (line) {
      var h = /^###\s+(.+?)\s*$/.exec(line);
      if (h) { cur = { text: h[1], choices: [], right: -1 }; qs.push(cur); return; }
      var c = /^\s*[-*]\s+(?:\[( |x|X)\]\s+)?(.+?)\s*$/.exec(line);
      if (c && cur) { if (c[1] && c[1].toLowerCase() === "x") cur.right = cur.choices.length; cur.choices.push(c[2]); }
    });
    return qs.filter(function (q) { return q.choices.length; });
  }

  /* ---- the bus ---- */
  function demoBus() {
    var ch = "BroadcastChannel" in window ? new BroadcastChannel("durf-day-2026-quiz") : null, subs = [];
    if (ch) ch.onmessage = function (e) { subs.forEach(function (f) { f(e.data); }); };
    return { live: false, publish: function (m) { if (ch) ch.postMessage(m); }, subscribe: function (f) { subs.push(f); } };
  }
  var bus = (window.DURF_DAY_BUS) || demoBus();   // a live bus can be set as window.DURF_DAY_BUS before quiz.js

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  var questions = [];
  var ready = fetch(CFG.QUIZ_SOURCE || "quiz/questions.md", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (md) { questions = parse(md); return questions; })
    .catch(function () { questions = []; return questions; });

  /* ---- presenter side ---- */
  var answers = store.get("durf-day-answers", {});   // { q: { participant: choice } }
  var state = { t: "state", q: null, open: false };

  function tally(q) {
    var n = questions[q].choices.map(function () { return 0; }), a = answers[q] || {}, total = 0;
    Object.keys(a).forEach(function (p) { if (n[a[p]] != null) { n[a[p]]++; total++; } });
    return { n: n, total: total };
  }
  function updateSlide(q) {
    var slide = document.querySelector('.slide--quiz[data-q="' + q + '"]');
    if (!slide) return;
    var t = tally(q), max = Math.max.apply(null, t.n.concat([1]));
    slide.querySelector(".quiz-count b").textContent = t.total;
    slide.querySelectorAll(".bars li").forEach(function (li, i) {
      li.querySelector(".n").textContent = t.n[i];
      li.querySelector(".fill").style.width = slide.classList.contains("is-revealed") ? (t.n[i] / max * 100) + "%" : "0";
    });
  }
  function setState(q, open) {
    state = { t: "state", q: q, open: open };
    bus.publish(state);
    if (q != null) store.set("durf-day-answers", answers);
  }

  function buildSlides(slot) {
    var frag = document.createDocumentFragment();
    questions.forEach(function (q, i) {
      var s = document.createElement("section");
      s.className = "slide slide--quiz"; s.id = "quiz-" + (i + 1); s.dataset.kind = "quiz"; s.dataset.q = i; s.dataset.agenda = "opening";
      s.innerHTML = '<p class="eyebrow">Pub quiz · question ' + (i + 1) + " of " + questions.length + "</p><h2>" + inline(q.text) + "</h2>" +
        '<ol class="bars">' + q.choices.map(function (c, k) {
          return '<li style="--c:' + COLOURS[k % COLOURS.length] + '"' + (k === q.right ? ' class="is-right"' : "") + '><span class="key">' + KEYS[k] +
            '</span><span class="track"><span class="fill"></span><span class="label">' + inline(c) + '</span></span><span class="n">0</span></li>';
        }).join("") + "</ol>" +
        '<p class="quiz-count"><b>0</b> answered</p>' + (bus.live ? "" : '<p class="quiz-demo">Demo mode: press D for demo answers</p>');
      frag.appendChild(s);
    });
    slot.replaceWith(frag);
    questions.forEach(function (q, i) { updateSlide(i); });
  }

  bus.subscribe(function (m) {
    if (!m || !m.t) return;
    if (m.t === "answer" && isPresenter) {
      if (state.q !== m.q || !state.open) return;           // only the open question counts
      (answers[m.q] = answers[m.q] || {})[m.p] = m.c;
      store.set("durf-day-answers", answers);
      updateSlide(m.q);
    } else if (m.t === "hello" && isPresenter) {
      bus.publish(state);
    } else if (m.t === "state" && !isPresenter) {
      participant.show(m);
    }
  });

  /* Deck hooks: called by deck.js on every change of slide or step. */
  var isPresenter = location.hash !== "#quiz";
  window.DeckKinds = window.DeckKinds || {};
  window.DeckKinds.quiz = {
    steps: function () { return 2; },
    render: function (slide, step) {
      var q = +slide.dataset.q;
      slide.classList.toggle("is-revealed", step >= 1);
      slide.classList.toggle("is-answered", step >= 2);
      if (state.q !== q || state.open !== (step === 0)) setState(q, step === 0);
      updateSlide(q);
    },
    leave: function () { if (state.q != null) setState(null, false); }
  };
  document.addEventListener("keydown", function (e) {
    if ((e.key === "d" || e.key === "D") && !bus.live && state.q != null && state.open) {
      var n = questions[state.q].choices.length;
      for (var i = 0; i < 7; i++) (answers[state.q] = answers[state.q] || {})["demo-" + Math.random().toString(36).slice(2, 8)] = Math.floor(Math.random() * n);
      updateSlide(state.q);
    }
  });

  /* ---- participant side: #quiz ---- */
  var me = store.get("durf-day-me", null) || { id: "p-" + Math.random().toString(36).slice(2, 10), name: "", picks: {} };
  store.set("durf-day-me", me);
  var participant = {
    q: null,
    init: function () {
      var page = document.getElementById("quiz-page");
      page.hidden = false;
      document.documentElement.classList.add("is-quiz-page");
      var name = page.querySelector("[data-quiz-name]");
      name.value = me.name || "";
      name.addEventListener("input", function () { me.name = name.value.trim(); store.set("durf-day-me", me); });
      page.querySelector("[data-quiz-note]").textContent = bus.live ? "" :
        "The quiz is not live yet: answers only reach the screen in the room once the live connection is switched on.";
      bus.publish({ t: "hello" });
    },
    show: function (m) {
      var body = document.querySelector("[data-quiz-body]");
      if (m.q == null) { body.innerHTML = "<p>Waiting for the next question…</p>"; return; }
      var q = questions[m.q];
      if (!q) return;
      if (!m.open) { body.innerHTML = "<h2>" + inline(q.text) + "</h2><p>Answers are closed. Look at the screen!</p>"; return; }
      body.innerHTML = '<h2>' + inline(q.text) + '</h2><div class="qp__choices">' + q.choices.map(function (c, k) {
        return '<button type="button" class="outline" data-c="' + k + '" aria-pressed="' + (me.picks[m.q] === k) + '"><b>' + KEYS[k] + "</b>&nbsp; " + inline(c) + "</button>";
      }).join("") + "</div><p class=\"qp__note\">You can change your answer until the results are shown.</p>";
      body.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          var c = +b.dataset.c;
          me.picks[m.q] = c; store.set("durf-day-me", me);
          body.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          bus.publish({ t: "answer", q: m.q, c: c, p: me.id, name: me.name || "" });
        });
      });
    }
  };

  window.DurfQuiz = {
    ready: ready,
    buildSlides: buildSlides,
    startParticipant: function () { ready.then(function () { participant.init(); }); },
    status: function () { return bus.live ? "Live" : "Demo mode: answers stay in this browser"; }
  };
})();
