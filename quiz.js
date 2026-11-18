/* The pub quiz: questions from quiz/questions.md, one slide per question, leaderboards, and the
   #quiz page for phones. Answers travel over a "bus" (see config.js): the slides publish which
   question is open, phones send their answer and how long they took, the slides count them.

   Points: a right answer scores 1,000 for the fastest, 25 fewer for each next one, at least 500.
   The last question counts double. Leaderboards follow question 1, the one but last question
   and (the final score) the last question. */
(function () {
  "use strict";
  var CFG = window.DURF_DAY || {};
  var COLOURS = ["var(--durf-theme-3)", "var(--durf-theme-1)", "var(--durf-theme-4)", "var(--durf-theme-5)", "var(--durf-theme-6)", "var(--durf-theme-2)"];
  var KEYS = "ABCDEF";
  var TOP = 1000, STEP = 25, FLOOR = 500;
  var SECONDS = +CFG.QUIZ_SECONDS || 30;      // how long a question stays open

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function inline(s) { return window.marked && window.marked.parseInline ? window.marked.parseInline(s) : esc(s); }
  function fmt(n) { return Math.round(n).toLocaleString("en"); }

  /* "### question", optional "theme: 4", then "- [x] right" / "- [ ] wrong" / "- wrong" */
  function parse(md) {
    var qs = [], cur = null;
    md.replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/).forEach(function (line) {
      var h = /^###\s+(.+?)\s*$/.exec(line);
      if (h) { cur = { text: h[1], choices: [], right: -1, theme: 0 }; qs.push(cur); return; }
      var t = /^\s*theme:\s*(\d+)\s*$/i.exec(line);
      if (t && cur) { cur.theme = +t[1]; return; }
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
  /* Live: ntfy (https://docs.ntfy.sh). Two topics: <topic>-state (slides -> phones) and
     <topic>-answers (phones -> slides). Each side only listens to the topic it needs; a phone that
     opens the page late gets the last state from the server's cache (since=latest). */
  function ntfyBus(server, topic, presenter) {
    var base = String(server || "https://ntfy.sh").replace(/\/+$/, "") + "/", subs = [], status = "connecting";
    var tState = topic + "-state", tAnswers = topic + "-answers";
    var listenTo = presenter ? tAnswers : tState;
    function connect() {
      var es = new EventSource(base + listenTo + "/sse" + (presenter ? "" : "?since=latest"));
      es.onopen = function () { status = "connected"; };
      es.onmessage = function (e) {
        try {
          var m = JSON.parse(e.data);
          if (m.event && m.event !== "message") return;
          var d = JSON.parse(m.message);
          subs.forEach(function (f) { f(d); });
        } catch (x) {}
      };
      es.onerror = function () { status = "reconnecting"; };   // EventSource reconnects by itself
    }
    connect();
    return {
      live: true,
      state: function () { return status; },
      publish: function (m) {
        var t = m.t === "state" ? tState : tAnswers;
        if (m.t === "hello") return;                    // not needed: the last state comes from the cache
        if (presenter !== (m.t === "state")) return;    // each side only publishes its own kind
        /* retry a few times: a busy or rate-limited server (HTTP 429) should not lose a question or an answer */
        (function send(tries) {
          fetch(base + t, { method: "POST", body: JSON.stringify(m) })
            .then(function (r) { if (!r.ok && tries < 4) setTimeout(function () { send(tries + 1); }, 1500 * (tries + 1)); })
            .catch(function () { if (tries < 4) setTimeout(function () { send(tries + 1); }, 1500 * (tries + 1)); });
        })(0);
      },
      subscribe: function (f) { subs.push(f); }
    };
  }
  var mode = (new URLSearchParams(location.search).get("quiz") || CFG.QUIZ_BACKEND || "demo").toLowerCase();
  var isPresenter = location.hash !== "#quiz";
  var bus = window.DURF_DAY_BUS ||
    (mode === "ntfy" && CFG.NTFY_TOPIC && "EventSource" in window ? ntfyBus(CFG.NTFY_SERVER, CFG.NTFY_TOPIC, isPresenter) : demoBus());

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  var questions = [];
  var ready = fetch(CFG.QUIZ_SOURCE || "quiz/questions.md", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (md) { questions = parse(md); return questions; })
    .catch(function () { questions = []; return questions; });
  function isLast(q) { return q === questions.length - 1; }

  /* ---- presenter side: answers and points ---- */
  var answers = store.get("durf-day-answers", {});   // { q: { participant: [choice, ms] } }
  var names = store.get("durf-day-names", {});       // { participant: name }
  var state = { t: "state", q: null, open: false };
  var openedAt = 0;
  var timedOut = {};                                  // questions whose 30 seconds are over
  var timer = null;

  function entry(v) { return Array.isArray(v) ? v : [v, 0]; }   // older rehearsal data: just the choice
  function nameOf(p) { return names[p] || "Player " + String(p).replace(/^p-/, "").slice(0, 4).toUpperCase(); }

  /* points per participant for question q: right answers ranked by response time */
  function points(q) {
    var a = answers[q] || {}, right = questions[q] ? questions[q].right : -1, list = [], out = {};
    Object.keys(a).forEach(function (p) { var e = entry(a[p]); if (e[0] === right) list.push([p, e[1]]); });
    list.sort(function (x, y) { return x[1] - y[1]; });
    list.forEach(function (e, i) { out[e[0]] = Math.max(FLOOR, TOP - STEP * i) * (isLast(q) ? 2 : 1); });
    return out;
  }
  function totals(upto) {
    var t = {};
    for (var q = 0; q <= upto; q++) { var pts = points(q); Object.keys(pts).forEach(function (p) { t[p] = (t[p] || 0) + pts[p]; }); }
    return t;
  }
  function playersUpTo(upto) {
    var s = {};
    for (var q = 0; q <= upto; q++) Object.keys(answers[q] || {}).forEach(function (p) { s[p] = 1; });
    return Object.keys(s);
  }
  function ranked(ps, tot) {
    return ps.slice().sort(function (a, b) { return (tot[b] || 0) - (tot[a] || 0) || nameOf(a).localeCompare(nameOf(b)); });
  }

  function tally(q) {
    var n = questions[q].choices.map(function () { return 0; }), a = answers[q] || {}, total = 0;
    Object.keys(a).forEach(function (p) { var c = entry(a[p])[0]; if (n[c] != null) { n[c]++; total++; } });
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
  function save() { store.set("durf-day-answers", answers); store.set("durf-day-names", names); }

  function setState(q, open, done) {
    state = { t: "state", q: q, open: open };
    if (open) { openedAt = Date.now(); state.sec = SECONDS; }
    if (done && q != null) {
      /* tell each phone how it did: [points for this question, total, place] */
      var tot = totals(q), pts = points(q), order = ranked(playersUpTo(q), tot), res = {};
      order.forEach(function (p, i) { res[p] = [pts[p] || 0, tot[p] || 0, i + 1]; });
      state.done = true;
      if (JSON.stringify(res).length < 3500) state.res = res;   // ntfy messages are at most 4 KB
    }
    bus.publish(state);
    if (q != null) save();
  }

  function piece(n, size) {
    return '<span class="quiz-piece" style="--c:var(--durf-theme-' + n + ');--s:' + size + 'px"><span class="durf-piece" data-theme-n="' + n + '"></span><b>' + n + "</b></span>";
  }
  function themeOf(n) { return n >= 1 && n <= 6 && window.DURF && window.DURF.theme ? window.DURF.theme(n) : null; }

  function buildSlides(slot) {
    var frag = document.createDocumentFragment(), N = questions.length;
    var boards = {};                                   // after question index -> previous board index
    if (N) {
      var at = [0, N - 2, N - 1].filter(function (q, i, a) { return q >= 0 && a.indexOf(q) === i; });
      at.forEach(function (q, i) { boards[q] = i ? at[i - 1] : -1; });
    }
    questions.forEach(function (q, i) {
      var th = themeOf(q.theme), last = isLast(i) && N > 1;
      var s = document.createElement("section");
      s.className = "slide slide--quiz" + (last ? " slide--double" : ""); s.id = "quiz-" + (i + 1);
      s.dataset.kind = "quiz"; s.dataset.q = i; s.dataset.agenda = "opening";
      if (th) s.style.setProperty("--tc", "var(--durf-theme-" + th.n + ")");
      var extra = th ? "Theme " + th.n + " " + esc(th.short) : q.theme === 0 ? "Warm-up" : "";
      s.innerHTML = '<p class="eyebrow quiz-eyebrow">' + (th ? piece(th.n, 76) : '<img class="quiz-mark" src="https://durf-project.github.io/durf-design-system/assets/durf-logo.svg" alt="">') +
        "<span>" + (last ? "Last question · double points" : "Pub quiz · question " + (i + 1) + " of " + N) +
        (extra ? ' · <span class="quiz-theme">' + extra + "</span>" : "") + "</span></p>" +
        '<div class="quiz-timer" aria-live="off"><b>' + SECONDS + '</b><small>seconds</small></div>' +
        (last ? '<span class="x2" aria-label="double points">2×</span>' : "") +
        "<h2>" + inline(q.text) + "</h2>" +
        '<ol class="bars' + (q.choices.some(function (c) { return c.length > 44; }) ? " is-long" : "") + '">' + q.choices.map(function (c, k) {
          return '<li style="--c:' + COLOURS[k % COLOURS.length] + '"' + (k === q.right ? ' class="is-right"' : "") + '><span class="key">' + KEYS[k] +
            '</span><span class="track"><span class="fill"></span><span class="label">' + inline(c) + '</span></span><span class="n">0</span></li>';
        }).join("") + "</ol>" +
        '<p class="quiz-count"><b>0</b> answered</p>' + (bus.live ? "" : '<p class="quiz-demo">Demo mode: press D for demo answers</p>');
      frag.appendChild(s);
      if (i in boards) frag.appendChild(boardSlide(i, boards[i]));
    });
    slot.replaceWith(frag);
    questions.forEach(function (q, i) { updateSlide(i); });
  }

  /* ---- leaderboards ---- */
  var ROWS = 10, ROW_H = 60;
  function boardSlide(to, from) {
    var s = document.createElement("section"), fin = isLast(to);
    s.className = "slide slide--board" + (fin ? " slide--final" : "");
    s.id = fin ? "final-score" : "leaderboard-" + (to + 1);
    s.dataset.kind = "board"; s.dataset.to = to; s.dataset.from = from; s.dataset.agenda = "opening";
    s.innerHTML = '<p class="eyebrow">Pub quiz · ' + (fin ? "after the last question" : "leaderboard after question " + (to + 1)) + "</p>" +
      "<h2>" + (fin ? "Final score" : from < 0 ? "Who is ahead?" : "Leaderboard") + "</h2>" +
      '<ol class="board" style="height:' + ROWS * ROW_H + 'px"></ol><p class="board-empty">No answers yet.</p>' +
      (fin ? '<div class="confetti" aria-hidden="true"></div>' : "");
    return s;
  }
  function count(el, to, instant) {
    var from = +el.dataset.v || 0;
    el.dataset.v = to;
    if (instant || from === to) { el.textContent = fmt(to); return; }
    var t0 = performance.now();
    (function tick(t) {
      var k = Math.min(1, (t - t0) / 1400); k = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * k);
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }
  function hue(p) { var h = 0; for (var i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0; return "var(--durf-theme-" + (h % 6 + 1) + ")"; }
  function draw(slide, ps, tot, instant) {
    var ol = slide.querySelector(".board"), order = ranked(ps, tot), max = Math.max(1, tot[order[0]] || 0);
    slide.querySelector(".board-empty").hidden = order.length > 0;
    ol.classList.toggle("is-instant", !!instant);
    Array.prototype.forEach.call(ol.children, function (li) { if (ps.indexOf(li.dataset.p) < 0) li.remove(); });
    order.forEach(function (p, r) {
      var li = null;
      Array.prototype.some.call(ol.children, function (x) { if (x.dataset.p === p) { li = x; return true; } });
      if (!li) {
        li = document.createElement("li"); li.dataset.p = p; li.style.setProperty("--c", hue(p));
        li.innerHTML = '<span class="rank"></span><span class="who"></span><span class="bar"><i></i></span><span class="pts">0</span>';
        li.style.top = ROWS * ROW_H + "px"; li.style.opacity = 0;
        ol.appendChild(li); li.getBoundingClientRect();     // start below the list, then move in
      }
      li.dataset.rank = r + 1;
      li.querySelector(".rank").textContent = r + 1;
      li.querySelector(".who").textContent = nameOf(p);
      li.style.top = Math.min(r, ROWS) * ROW_H + "px";
      li.style.opacity = r < ROWS ? 1 : 0;
      li.querySelector(".bar i").style.width = ((tot[p] || 0) / max * 100) + "%";
      count(li.querySelector(".pts"), tot[p] || 0, instant);
    });
  }
  function confetti(slide) {
    var box = slide.querySelector(".confetti");
    if (!box || box.childElementCount) return;
    for (var i = 0; i < 120; i++) {
      var c = document.createElement("i");
      c.style.cssText = "left:" + (Math.random() * 100) + "%;--c:var(--durf-theme-" + (i % 6 + 1) + ");animation-delay:" + (Math.random() * 1.6) + "s;" +
        "animation-duration:" + (2.6 + Math.random() * 2) + "s;--r:" + (Math.random() * 720 - 360) + "deg;--x:" + (Math.random() * 160 - 80) + "px";
      box.appendChild(c);
    }
  }

  window.DeckKinds = window.DeckKinds || {};
  window.DeckKinds.quiz = {
    steps: function () { return 2; },
    render: function (slide, step) {
      var q = +slide.dataset.q;
      slide.classList.toggle("is-revealed", step >= 1);
      slide.classList.toggle("is-answered", step >= 2);
      var open = step === 0 && !timedOut[q], done = step === 2;
      if (state.q !== q || state.open !== open || !!state.done !== done) setState(q, open, done);
      if (open) startTimer(slide, q); else stopTimer(slide, q);
      updateSlide(q);
    },
    /* leaving a question that is still open closes it; after the answer, phones keep their result */
    leave: function (slide) { stopTimer(slide); if (state.q != null && !state.done) setState(null, false); }
  };
  /* the "Take out your phone" slide: clear what phones see, such as the last question of a rehearsal */
  window.DeckKinds.quizintro = {
    steps: function () { return 0; },
    render: function () { if (state.q != null || !state.cleared) { setState(null, false); state.cleared = true; } }
  };
  /* the countdown: SECONDS after a question opens, nobody can answer any more */
  function paintTimer(slide, left) {
    var el = slide && slide.querySelector(".quiz-timer");
    if (!el) return;
    el.querySelector("b").textContent = Math.ceil(left);
    el.style.setProperty("--p", String(left / SECONDS));
    el.classList.toggle("is-low", left <= 5);
    slide.classList.toggle("is-timeup", left <= 0);
  }
  function startTimer(slide, q) {
    if (timer && timer.q === q) return;
    stopTimer();
    var end = openedAt + SECONDS * 1000;
    timer = { q: q, slide: slide, id: setInterval(tick, 100) };
    function tick() {
      var left = Math.max(0, (end - Date.now()) / 1000);
      paintTimer(slide, left);
      if (left > 0) return;
      if (timer && timer.q === q) { clearInterval(timer.id); timer = null; }
      timedOut[q] = true;
      /* a short grace period for answers that are still on their way */
      setTimeout(function () { if (state.q === q && state.open) setState(q, false, false); }, 1500);
    }
    tick();
  }
  function stopTimer(slide, q) {
    if (timer) { clearInterval(timer.id); timer = null; }
    if (slide && slide.querySelector(".quiz-timer")) paintTimer(slide, q != null && timedOut[q] ? 0 : SECONDS);
  }

  window.DeckKinds.board = {
    steps: function (s) { return +s.dataset.from < 0 ? 0 : s.classList.contains("slide--final") ? 2 : 1; },
    render: function (slide, step) {
      var to = +slide.dataset.to, from = +slide.dataset.from, ps = playersUpTo(to);
      slide.classList.toggle("is-crowned", step >= 2);
      if (from < 0) {                                   // first board: grow from zero
        draw(slide, ps, {}, true);
        setTimeout(function () { draw(slide, ps, totals(to), false); }, 120);
      } else if (step === 0) {
        draw(slide, ps, totals(from), true);
      } else {
        draw(slide, ps, totals(to), step > 1);
        if (step >= 2) confetti(slide);
      }
    }
  };

  bus.subscribe(function (m) {
    if (!m || !m.t) return;
    if (m.t === "answer" && isPresenter) {
      if (state.q !== m.q || !state.open) return;           // only the open question counts
      var ms = typeof m.ms === "number" && m.ms >= 0 && m.ms < 3600000 ? m.ms : Date.now() - openedAt;
      if (ms > SECONDS * 1000 + 500) return;                // too late
      (answers[m.q] = answers[m.q] || {})[m.p] = [m.c, Math.round(ms)];
      if (m.name) names[m.p] = String(m.name).slice(0, 40);
      save();
      updateSlide(m.q);
    } else if (m.t === "hello" && isPresenter) {
      bus.publish(state);
    } else if (m.t === "state" && !isPresenter) {
      participant.show(m);
    }
  });

  document.addEventListener("keydown", function (e) {
    var onQuiz = state.q != null || /slide--board/.test((document.querySelector(".slide.is-current") || {}).className || "");
    /* Shift+R on a quiz slide or leaderboard: clear all answers and names (e.g. after a rehearsal) */
    if (e.key === "R" && e.shiftKey && onQuiz) { reset(); return; }
    if ((e.key === "d" || e.key === "D") && !e.shiftKey && !bus.live && state.q != null && state.open) {
      var n = questions[state.q].choices.length, demo = ["Ada", "Bas", "Chen", "Daan", "Eva", "Femke", "Gijs", "Hilde", "Ilse", "Joost", "Kim", "Lotte"];
      demo.forEach(function (nm, i) {
        var p = "demo-" + i;
        if (Math.random() < .25) return;
        names[p] = nm;
        (answers[state.q] = answers[state.q] || {})[p] = [Math.random() < .55 ? questions[state.q].right : Math.floor(Math.random() * n), Math.round(1500 + Math.random() * 12000)];
      });
      save(); updateSlide(state.q);
    }
  });

  /* ---- settings dialog: count, download and reset the answers ---- */
  function reset() {
    if (!window.confirm("Clear all quiz answers and scores in this browser?")) return false;
    answers = {}; names = {}; timedOut = {}; save();
    questions.forEach(function (q, i) { updateSlide(i); });
    document.querySelectorAll(".slide--board .board").forEach(function (ol) { ol.innerHTML = ""; });
    return true;
  }
  function summary() {
    var n = 0, qs = 0, ps = {};
    Object.keys(answers).forEach(function (q) { var k = Object.keys(answers[q] || {}); if (k.length) qs++; n += k.length; k.forEach(function (p) { ps[p] = 1; }); });
    return { answers: n, players: Object.keys(ps).length, questions: qs, of: questions.length, live: bus.live };
  }
  function csvCell(v) { v = String(v == null ? "" : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function download() {
    var last = questions.length - 1, tot = totals(last), order = ranked(playersUpTo(last), tot), pts = questions.map(function (q, i) { return points(i); });
    var head = ["place", "name", "participant", "total"];
    questions.forEach(function (q, i) { head.push("q" + (i + 1) + " answer", "q" + (i + 1) + " right", "q" + (i + 1) + " seconds", "q" + (i + 1) + " points"); });
    var rows = [head];
    order.forEach(function (p, r) {
      var row = [r + 1, nameOf(p), p, tot[p] || 0];
      questions.forEach(function (q, i) {
        var a = (answers[i] || {})[p];
        if (a == null) { row.push("", "", "", ""); return; }
        var e = entry(a);
        row.push(KEYS[e[0]] || "", e[0] === q.right ? "yes" : "no", (e[1] / 1000).toFixed(1), pts[i][p] || 0);
      });
      rows.push(row);
    });
    var csv = rows.map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "durf-pubquiz-results-" + new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-") + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  /* ---- participant side: #quiz ---- */
  var me = store.get("durf-day-me", null) || { id: "p-" + Math.random().toString(36).slice(2, 10), name: "", picks: {} };
  store.set("durf-day-me", me);
  var shownAt = {};                                     // question -> when this phone first showed it
  var participant = {
    init: function () {
      var page = document.getElementById("quiz-page");
      page.hidden = false;
      document.documentElement.classList.add("is-quiz-page");
      var name = page.querySelector("[data-quiz-name]");
      name.value = me.name || "";
      name.addEventListener("input", function () { me.name = name.value.trim(); store.set("durf-day-me", me); });
      page.querySelector("[data-quiz-note]").textContent = bus.live ?
        "Please use your own mobile data, not eduroam or the venue Wi-Fi. Your answer goes to the screen in the room through a public message service (ntfy). A first name or nickname is enough." :
        "The quiz is not live yet: answers only reach the screen in the room once the live connection is switched on.";
      bus.publish({ t: "hello" });
    },
    show: function (m) {
      var body = document.querySelector("[data-quiz-body]");
      if (m.q == null) { body.innerHTML = "<p>Waiting for the next question…</p>"; return; }
      var q = questions[m.q];
      if (!q) return;
      var head = (isLast(m.q) && questions.length > 1 ? '<p class="qp__x2">2× Double points!</p>' : "") + "<h2>" + inline(q.text) + "</h2>";
      if (!m.open) {
        var r = m.done && m.res ? m.res[me.id] : null, html = "";
        if (m.done) {
          var pick = me.picks[m.q], right = pick === q.right;
          html = pick == null ? "<p>You did not answer this one.</p>" :
            '<p class="qp__result ' + (right ? "is-right" : "is-wrong") + '">' + (right ? "✓ Right! +" + fmt(r ? r[0] : 0) + " points" : "✗ Not this time") + "</p>";
          if (r) html += "<p>Your score: <b>" + fmt(r[1]) + "</b> · place <b>" + r[2] + "</b></p>";
          html += "<p>The right answer: <b>" + KEYS[q.right] + "</b> " + inline(q.choices[q.right]) + "</p>";
        } else html = "<p>Answers are closed. Look at the screen!</p>";
        body.innerHTML = head + html;
        return;
      }
      if (!(m.q in shownAt)) shownAt[m.q] = performance.now();
      var sec = m.sec || SECONDS;
      body.innerHTML = head + '<p class="qp__timer"><b></b> seconds left</p><div class="qp__choices">' + q.choices.map(function (c, k) {
        return '<button type="button" class="outline" data-c="' + k + '" aria-pressed="' + (me.picks[m.q] === k) + '"><b>' + KEYS[k] + "</b>&nbsp; " + inline(c) + "</button>";
      }).join("") + "</div><p class=\"qp__note\">Be quick: the faster a right answer, the more points. You can change your answer, but then your time counts from the change.</p>";
      body.querySelectorAll("button").forEach(function (b) {
        b.addEventListener("click", function () {
          var c = +b.dataset.c;
          me.picks[m.q] = c; store.set("durf-day-me", me);
          body.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          bus.publish({ t: "answer", q: m.q, c: c, p: me.id, name: me.name || "", ms: Math.round(performance.now() - shownAt[m.q]) });
        });
      });
      clearInterval(participant.tick);
      participant.tick = setInterval(function () {
        var left = Math.max(0, sec - (performance.now() - shownAt[m.q]) / 1000), t = body.querySelector(".qp__timer");
        if (!t) { clearInterval(participant.tick); return; }
        t.querySelector("b").textContent = Math.ceil(left);
        if (left > 0) return;
        clearInterval(participant.tick);
        t.innerHTML = "<b>Time's up!</b> Look at the screen.";
        body.querySelectorAll(".qp__choices button").forEach(function (x) { x.disabled = true; });
      }, 200);
    }
  };

  window.DurfQuiz = {
    ready: ready,
    buildSlides: buildSlides,
    summary: summary,
    download: download,
    reset: reset,
    startParticipant: function () { ready.then(function () { participant.init(); }); },
    status: function () { return bus.live ? "Live: answers come in through " + String(CFG.NTFY_SERVER || "ntfy").replace(/^https?:\/\//, "") + ". Please use your own mobile data, not eduroam or the venue Wi-Fi." : "Demo mode: answers stay in this browser"; }
  };
})();
