/* DURF Federation Day slides: navigation, content from the DURF sites, embeds.
   Next: → ↓ PageDown space (a presenter clicker sends one of these). Back: ← ↑ PageUp.
   Home / End: first / last slide. F: full screen. The mouse stays free for links and embeds. */
(function () {
  "use strict";
  var CFG = window.DURF_DAY || {};
  var PP = CFG.PROJECT_PAGE || "https://durf-project.github.io/project-page/";
  var root = document.documentElement;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function inline(s) { return window.marked && window.marked.parseInline ? window.marked.parseInline(s) : esc(s); }
  function text(url) { return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }); }
  function json(url) { return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function body(md) { return md.replace(/^---[\s\S]*?\n---\n/, "").replace(/<!--[\s\S]*?-->/g, ""); }
  function initials(n) { return (n.match(/\b[A-Z]/g) || ["?"]).slice(0, 2).join(""); }

  /* ---- participant page ---- */
  if (location.hash === "#quiz") {
    $("#deck").hidden = true; $(".deck-ui").hidden = true; $(".deck-progress").hidden = true;
    window.DurfQuiz.startParticipant();
    return;
  }
  /* The theme follows the DURF topbar button (light, dark, system); embeds follow along. */
  function themeNow() { return root.getAttribute("data-theme") || "auto"; }
  function tellEmbeds() {
    Array.prototype.forEach.call(document.querySelectorAll("iframe"), function (f) {
      try { f.contentWindow.postMessage({ type: "durf-embed-theme", theme: themeNow() }, "*"); } catch (e) {}
    });
  }
  new MutationObserver(tellEmbeds).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  document.addEventListener("fullscreenchange", function () { root.classList.toggle("is-full", !!document.fullscreenElement); setTimeout(scale, 60); });

  /* ---- content from the DURF sites (each has the text in the HTML as a fallback) ---- */
  /* name -> [photo in project-page/assets/people/, its source link]; tried in that order, then initials */
  var photos = {};
  Object.keys(CFG.EXTRA_PHOTOS || {}).forEach(function (n) { photos[n] = CFG.EXTRA_PHOTOS[n]; });
  function face(el, name) {
    var urls = (photos[name] || []).filter(Boolean);
    el.innerHTML = "";
    if (!urls.length) { el.textContent = name === "Vacant" ? "?" : initials(name); return; }
    var img = new Image(), k = 0;
    img.alt = ""; img.referrerPolicy = "no-referrer"; img.src = urls[0];
    img.onerror = function () { if (++k < urls.length) img.src = urls[k]; else el.textContent = initials(name); };
    el.appendChild(img);
  }
  var people = json(PP + "content/people.json").then(function (d) {
    Object.keys(d.groups || {}).forEach(function (k) { (d.groups[k].people || []).forEach(function (p) {
      if ((p.photo || p.photoSource) && !photos[p.name]) photos[p.name] = [p.photo && !/^https?:/.test(p.photo) ? PP + p.photo : p.photo, p.photoSource];
    }); });
  }).catch(function () {}).then(function () { $$("[data-person]").forEach(function (el) { face(el, el.dataset.person); }); });

  text(PP + "content/00-hero.md").then(function (md) {
    var m = /^#\s+(.+)$/m.exec(body(md));
    if (m) $$('[data-src="hero-title"]').forEach(function (h) { h.innerHTML = inline(m[1]); });
  }).catch(function () {});

  text(PP + "content/02-statement.md").then(function (md) {
    var p = body(md).trim().split(/\n\s*\n/)[0].trim();
    if (p && !/^</.test(p)) $('[data-src="statement"]').innerHTML = inline(p);
  }).catch(function () {});

  text(PP + "content/01-figures.md").then(function (md) {
    var items = [];
    body(md).split(/\n/).forEach(function (l) {
      var m = /^\s*-\s+(?:\{theme-(\d)\}\s*)?\*\*(.+?)\*\*\s*(.*)$/.exec(l);
      if (m) items.push({ n: m[1], value: m[2], label: m[3] });
    });
    $('[data-src="figures"]').innerHTML = items.map(function (it) {
      var unknown = /^unknown$/i.test(it.value);
      return '<li' + (unknown ? ' class="is-unknown"' : "") + ' style="--c:var(--durf-theme-' + (it.n || 3) + ')"><b>' + esc(it.value) + "</b>" + inline(it.label) +
        (unknown ? "<br><small>Not yet measured</small>" : "") + "</li>";
    }).join("");
  }).catch(function () {});

  var paper = text(CFG.POSITION_PAPER_MD).then(function (md) {
    var aim = /##\s+Central Aim[^\n]*\n+\*\*(.+?)\*\*/.exec(md);
    if (aim) $('[data-src="aim"]').innerHTML = inline(aim[1].trim());
    /* strategic commitment per theme: the bullet under *STRATEGIC:* in "## N. title" */
    var out = [];
    md.split(/\n(?=## \d\. )/).forEach(function (part) {
      var h = /^## (\d)\. (.+)/.exec(part);
      var s = /\*STRATEGIC:\*\s*\n+\s*\*\s+([\s\S]+?)(?:\n\s*\n|\n\*[A-Z])/.exec(part);
      if (h && s) out.push({ n: h[1], title: h[2].trim(), text: s[1].replace(/\s+/g, " ").trim() });
    });
    if (out.length) $('[data-src="commitments"]').innerHTML = out.map(function (c) {
      var th = window.DURF && window.DURF.theme && window.DURF.theme(c.n);
      return '<details style="--c:var(--durf-theme-' + c.n + ')"><summary><span class="durf-puzzle" data-theme-n="' + c.n + '">' + c.n + "</span>" +
        esc(th ? th.short + ": " : "") + esc(c.title) + "</summary><p>" + inline(c.text) + "</p></details>";
    }).join("");
  }).catch(function () {});

  /* theme leads, from the design system; photos from people.json */
  var leadsEl = $('[data-src="leads"]');
  if (leadsEl && window.DURF && window.DURF.themes) {
    leadsEl.innerHTML = window.DURF.themes.map(function (t) {
      var l = t.lead || {}, names = l.vacant ? ["Vacant"] : [l.name].concat(l.coLead ? [l.coLead.name] : []);
      var who = l.vacant ? "Vacant: the project team answers for now" :
        esc(l.name) + (l.coLead ? " and " + esc(l.coLead.name) : "");
      var inst = l.vacant ? "" : esc(l.institution) + (l.coLead && l.coLead.institution !== l.institution ? ", " + esc(l.coLead.institution) : "");
      return '<li><span class="faces">' + names.map(function (n) { return '<span class="face" data-person="' + esc(n) + '" style="--ring:var(--durf-theme-' + t.n + ')"></span>'; }).join("") +
        '</span><span><b style="color:var(--durf-theme-' + t.n + '-ink)">Theme ' + t.n + " · " + esc(t.short) + "</b><strong>" + who + "</strong><small>" + inst + "</small></span></li>";
    }).join("");
  }

  /* ---- the deck ---- */
  var slides = [], cur = 0, step = 0;
  var kinds = window.DeckKinds = window.DeckKinds || {};
  kinds.accordion = {
    steps: function (s) { return $$("details", s).length; },
    render: function (s, st) { $$("details", s).forEach(function (d, i) { d.open = i === st - 1; }); }
  };

  function stepsOf(s) {
    var k = kinds[s.dataset.kind];
    if (k) return k.steps(s);
    return $$("[data-step]", s).reduce(function (m, el) { return Math.max(m, +el.dataset.step || 0); }, 0);
  }

  function scale() {
    var d = document.getElementById("deck"), sc = Math.min(d.clientWidth / 1600, d.clientHeight / 900);
    slides.forEach(function (s) { s.style.setProperty("--scale", sc); });
  }

  function loadEmbeds(i) {
    [i - 1, i, i + 1].forEach(function (k) {
      var s = slides[k];
      if (!s) return;
      $$("iframe[data-embed]", s).forEach(function (f) {
        if (!f.src) {
          f.src = f.dataset.embed;
          f.addEventListener("load", function () { try { f.contentWindow.postMessage({ type: "durf-embed-theme", theme: themeNow() }, "*"); } catch (e) {} });
        }
      });
    });
  }

  function render() {
    var s = slides[cur];
    slides.forEach(function (x, i) { x.classList.toggle("is-current", i === cur); x.setAttribute("aria-hidden", String(i !== cur)); });
    $$("[data-step]", s).forEach(function (el) { el.classList.toggle("is-shown", +el.dataset.step <= step); });
    var k = kinds[s.dataset.kind];
    if (k) k.render(s, step);
    $$(".agenda li").forEach(function (li) { li.classList.toggle("is-now", li.dataset.a === "opening"); });
    loadEmbeds(cur);
    net.run(s.classList.contains("slide--hero") ? s : null);
    $(".deck-count").textContent = (cur + 1) + " / " + slides.length;
    $(".deck-progress i").style.width = ((cur + 1) / slides.length * 100) + "%";
    history.replaceState(null, "", "#" + (cur + 1));
  }

  function go(i, st) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    var leaving = slides[cur];
    if (i !== cur && leaving) {
      var k = kinds[leaving.dataset.kind];
      if (k && k.leave && !(slides[i].dataset.kind === leaving.dataset.kind)) k.leave(leaving);
    }
    cur = i; step = st === "end" ? stepsOf(slides[i]) : (st || 0);
    render();
  }
  function next() { if (step < stepsOf(slides[cur])) { step++; render(); } else go(cur + 1, 0); }
  function prev() { if (step > 0) { step--; render(); } else go(cur - 1, "end"); }
  function full() { if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen && root.requestFullscreen(); }

  function key(k, e) {
    if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " " || k === "Enter") { next(); return true; }
    if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") { prev(); return true; }
    if (k === "Home") { go(0); return true; }
    if (k === "End") { go(slides.length - 1); return true; }
    if (k === "f" || k === "F") { full(); return true; }
    return false;
  }
  document.addEventListener("keydown", function (e) {
    var t = e.target, tag = t && t.tagName;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
    if (document.querySelector("dialog[open]")) return;
    if ((e.key === " " || e.key === "Enter") && (tag === "A" || tag === "BUTTON" || tag === "SUMMARY")) return;   // keep keyboard use of controls
    if (key(e.key, e)) e.preventDefault();
  });
  /* keys pressed inside an embedded DURF page come back as messages (design system 1.1.10) */
  window.addEventListener("message", function (e) { if (e.data && e.data.type === "durf-embed-key") key(e.data.key); });
  $$(".deck-ui [data-go]").forEach(function (b) {
    b.addEventListener("click", function () { ({ prev: prev, next: next, full: full })[b.dataset.go](); b.blur(); });
  });
  window.addEventListener("resize", scale);
  /* a typed or linked #number jumps to that slide */
  window.addEventListener("hashchange", function () {
    var n = parseInt(location.hash.slice(1), 10);
    if (n > 0 && slides.length && n - 1 !== cur) go(n - 1, 0);
  });

  /* ---- moving dots and lines on the hero slides ---- */
  var net = (function () {
    var COLS = ["#EE7628", "#F6DA44", "#177ABF", "#17A95D", "#5C1B61", "#83201B"];
    var host = null, cv = null, ctx, dots = [], raf = 0;
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function setup(s) {
      cv = $("canvas.net", s); ctx = cv.getContext("2d");
      cv.width = 1600; cv.height = 900;
      if (!dots.length) for (var i = 0; i < 70; i++) dots.push({ x: Math.random() * 1600, y: Math.random() * 900, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: 5 + Math.random() * 7, c: COLS[i % 6] });
    }
    function frame() {
      ctx.clearRect(0, 0, 1600, 900);
      dots.forEach(function (d) {
        if (!still) { d.x += d.vx; d.y += d.vy; if (d.x < 0 || d.x > 1600) d.vx *= -1; if (d.y < 0 || d.y > 900) d.vy *= -1; }
      });
      ctx.lineWidth = 2;
      for (var i = 0; i < dots.length; i++) for (var j = i + 1; j < dots.length; j++) {
        var a = dots[i], b = dots[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < 190 * 190) { ctx.strokeStyle = "rgba(23,122,191," + (0.28 * (1 - Math.sqrt(d2) / 190)) + ")"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      dots.forEach(function (d) { ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); });
      if (!still) raf = requestAnimationFrame(frame);
    }
    return { run: function (s) {
      cancelAnimationFrame(raf);
      if (!s) { host = null; return; }
      host = s; setup(s); frame();
    } };
  })();

  /* ---- start: quiz slides first, then show the slide from the URL ---- */
  window.DurfQuiz.ready.then(function () {
    window.DurfQuiz.buildSlides($("#quiz-slot"));
    $$("[data-quiz-status]").forEach(function (p) { p.textContent = window.DurfQuiz.status(); });
    slides = $$("#deck > .slide");
    $$(".embed-box[data-zoom]").forEach(function (b) { b.style.setProperty("--zoom", b.dataset.zoom); });
    scale();
    var n = parseInt(location.hash.slice(1), 10);
    cur = n > 0 ? n - 1 : 0;
    go(cur, 0);
    people.then(function () {});
  });
})();
