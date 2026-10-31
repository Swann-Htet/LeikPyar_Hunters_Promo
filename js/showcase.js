/* Leikpyar Hunters - the showcase page (art, credits and rights). A static page: no server, no accounts. */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  // The models are plain files in /models (models.json lists them). api() gives the list in the shape the code below expects.
  var fileOf = {};
  var listPromise = null;
  function api(path) {
    if (path !== "models") return Promise.resolve({ ok: false });
    if (!listPromise) {
      listPromise = fetch("/models/models.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (list) {
        list.forEach(function (m) { fileOf[m.id] = m.file; });
        return { ok: true, models: list };
      }).catch(function () { return { ok: false }; });
    }
    return listPromise;
  }
  function loadModel(el, id) {
    return api("models").then(function () { el.src = "/models/" + fileOf[id]; });
  }
  function guard(el) {
    ["contextmenu", "dragstart", "copy", "cut"].forEach(function (ev) { el.addEventListener(ev, function (e) { e.preventDefault(); }); });
  }

  // ------------------------------------------------------------------------------------------ header, menu, reveal
  var header = $("#top");
  function onScroll() { header.classList.toggle("solid", window.scrollY > 24); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var nav = $("#nav"), menuBtn = $("#menuBtn");
  function closeMenu() {
    nav.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.querySelector("use").setAttribute("href", "#i-menu");
  }
  menuBtn.addEventListener("click", function () {
    var open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.querySelector("use").setAttribute("href", open ? "#i-x" : "#i-menu");
  });
  $$("a", nav).forEach(function (a) { a.addEventListener("click", closeMenu); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    $$(".reveal").forEach(function (el) { io.observe(el); });

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        $$("a", nav).forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id); });
      });
    }, { threshold: 0.45 });
    $$("main section[id]").forEach(function (s) { spy.observe(s); });
  } else {
    $$(".reveal").forEach(function (el) { el.classList.add("in"); });
  }


  // ------------------------------------------------------------------------------------------ dust (little squares)
  (function dust() {
    var canvas = $("#dust");
    if (!canvas || reduceMotion) return;
    var ctx = canvas.getContext("2d");
    var w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2), specks = [], running = true;

    function resize() {
      var r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.round(Math.min(70, Math.max(24, w * h / 26000)));
      specks = [];
      for (var i = 0; i < count; i++) specks.push(make(true));
    }
    function make(anywhere) {
      return { x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10, s: 1 + Math.random() * 2.6, v: 6 + Math.random() * 16, a: 0.12 + Math.random() * 0.34, p: Math.random() * 6.28, sw: 8 + Math.random() * 26 };
    }
    var last = 0;
    function frame(t) {
      if (!running) return;
      var dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < specks.length; i++) {
        var p = specks[i];
        p.y -= p.v * dt;
        if (p.y < -10) specks[i] = p = make(false);
        var x = p.x + Math.sin(t / 2600 + p.p) * p.sw;
        ctx.fillStyle = "rgba(255, 214, 166, " + p.a + ")";
        ctx.fillRect(x, p.y, p.s, p.s);
      }
      requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", function () {
      running = !document.hidden;
      if (running) requestAnimationFrame(frame);
    });
    requestAnimationFrame(frame);
  })();


  // the exported files lose the -90 degree turn of the Unity prefabs: this puts every model back as it is in the game
  var UPRIGHT = "0deg -90deg 0deg";

  // The big frame at the top: the models of the game one after the other (a carousel). It can not be touched: it only turns, and
  // after a few seconds the next model fades in. Two viewers take turns, so the next model is ready before it shows.
  var hero = $("#heroOrb");
  function startHeroCarousel(first, models) {
    var frame = first.parentNode;
    var tag = $(".frame-tag", frame), credit = $(".frame-credit", frame), dots = $("#heroDots");
    var second = first.cloneNode(false);
    second.removeAttribute("id");
    second.classList.remove("on");
    frame.insertBefore(second, first.nextSibling);
    var views = [first, second], front = 0, next = 0;
    var SECONDS = 7;

    dots.innerHTML = models.map(function () { return "<i></i>"; }).join("");
    function mark(i) { Array.prototype.forEach.call(dots.children, function (d, k) { d.classList.toggle("on", k === i); }); }

    function step() {
      var m = models[next % models.length], idx = next % models.length;
      var back = views[front ^ 1], shown = views[front];
      var done = false;
      function show() {
        if (done) return;
        done = true;
        back.classList.add("on");
        shown.classList.remove("on");
        front ^= 1;
        var textNode = tag.lastChild;
        if (textNode) textNode.nodeValue = m.title;
        credit.textContent = "Model by " + (m.author || "May Thinzar Khin");
        mark(idx);
        next++;
        setTimeout(step, SECONDS * 1000);
      }
      back.addEventListener("load", show, { once: true });
      // an invisible viewer may not send "load": once the file is handed to it, it is also checked by itself
      // (and the model is shown anyway after 20 seconds)
      var handedAt = 0, started = Date.now();
      var watch = setInterval(function () {
        if (done) { clearInterval(watch); return; }
        var ready = handedAt && Date.now() - handedAt > 500 && back.loaded;
        if (ready || Date.now() - started > 20000) { clearInterval(watch); show(); }
      }, 250);
      loadModel(back, m.id).then(function () { handedAt = Date.now(); }).catch(function () {
        clearInterval(watch);
        if (done) return;
        done = true; next++;                       // this one did not load: the next one
        setTimeout(step, 1500);
      });
    }
    step();
  }
  if (hero) {
    guard(hero.parentNode);
    api("models").then(function (r) {
      if (!r.ok || !r.models || !r.models.length) { hero.parentNode.style.display = "none"; return; }
      startHeroCarousel(hero, r.models);
    });
  }

  var soon = '<div class="model-soon reveal in"><div><svg class="ico" aria-hidden="true"><use href="#i-cube"/></svg><p>More models are coming.</p></div></div>';
  api("models").then(function (r) {
    var grid = $("#gallery-grid");
    if (!r.ok || !r.models || !r.models.length) { grid.innerHTML = soon; return; }
    var html = "";
    r.models.forEach(function (m) {
      html += '<article class="model-card reveal"><div class="model-stage" data-id="' + esc(m.id) + '">' +
        '<div class="model-load">Loading the model</div>' +
        '<div class="watermark"><svg class="ico" aria-hidden="true"><use href="#i-lock"/></svg>&copy; ' + esc(m.year || 2026) + " " + esc(m.author || "May Thinzar Khin") + "</div></div>" +
        '<div class="model-info"><h3>' + esc(m.title) + "</h3><p>" + esc(m.description || "") + '</p><div class="tags">' +
        (m.tags || []).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") +
        '</div><div class="model-by"><svg class="ico" aria-hidden="true"><use href="#i-user"/></svg>Art by ' + esc(m.author || "May Thinzar Khin") + "</div></div></article>";
    });
    html += soon;
    grid.innerHTML = html;
    $$(".model-card", grid).forEach(function (card) { if (io) io.observe(card); else card.classList.add("in"); });

    // each viewer loads when it comes near the screen
    var lazy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        lazy.unobserve(en.target);
        var stage = en.target, id = stage.dataset.id;
        var mv = document.createElement("model-viewer");
        mv.setAttribute("alt", "A 3D model");
        mv.setAttribute("camera-controls", "");
        mv.setAttribute("auto-rotate", "");
        mv.setAttribute("rotation-per-second", "18deg");
        mv.setAttribute("interaction-prompt", "none");
        mv.setAttribute("touch-action", "pan-y");
        mv.setAttribute("shadow-intensity", "1");
        mv.setAttribute("exposure", "0.38");
        mv.setAttribute("environment-image", "neutral");
        mv.setAttribute("camera-orbit", "25deg 72deg auto");
        mv.setAttribute("orientation", UPRIGHT);
        mv.setAttribute("disable-pan", "");
        stage.insertBefore(mv, stage.firstChild);
        guard(stage);
        mv.addEventListener("load", function () { var l = $(".model-load", stage); if (l) l.remove(); });
        loadModel(mv, id).catch(function () { var l = $(".model-load", stage); if (l) l.textContent = "The model could not be loaded"; });
      });
    }, { rootMargin: "200px" });
    $$(".model-stage", grid).forEach(function (s) { lazy.observe(s); });
  });

  
})();
