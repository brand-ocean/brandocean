// The injectable feedback widget, served verbatim by GET /feedback/widget.js
// (see convex/http.ts). Runs on the client's Shopify domain, cross-origin to
// Convex, talking only to the token-gated /feedback/* httpActions.
//
// Authored as a plain string (no build step). To keep this file a valid TS
// template literal, the widget code below uses NO backticks and NO ${...}.

export const FEEDBACK_WIDGET_SOURCE = `(function () {
  "use strict";
  var CFG = window.__FEEDBACK__;
  if (!CFG || !CFG.token || !CFG.base) return;
  if (window.__FEEDBACK_LOADED__) return;
  window.__FEEDBACK_LOADED__ = true;
  if (location.search.indexOf("feedback=0") !== -1) return;

  var BASE = CFG.base.replace(/\\/$/, "");
  var TOKEN = CFG.token;
  var BRAND = "#1570ef";
  var IDKEY = "bo_feedback_identity";
  var KINDS = [
    { k: "bug", label: "Bug", ico: "\\uD83D\\uDC1E" },
    { k: "idea", label: "Idea", ico: "\\uD83D\\uDCA1" },
    { k: "question", label: "Question", ico: "\\u2753" }
  ];

  function api(path, method, body) {
    var opts = { method: method, headers: { "X-Feedback-Token": TOKEN } };
    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(BASE + path, opts).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j && j.error ? j.error : "request_failed");
        return j;
      });
    });
  }

  function getIdentity() {
    try {
      var raw = localStorage.getItem(IDKEY);
      if (raw) { var p = JSON.parse(raw); if (p && p.name && p.email) return p; }
    } catch (e) {}
    return null;
  }
  function setIdentity(id) {
    try { localStorage.setItem(IDKEY, JSON.stringify(id)); } catch (e) {}
  }

  function uaInfo() {
    var ua = navigator.userAgent, b = "Unknown", o = "Unknown";
    if (/Edg\\//.test(ua)) b = "Edge";
    else if (/Chrome\\//.test(ua)) b = "Chrome";
    else if (/Safari\\//.test(ua)) b = "Safari";
    else if (/Firefox\\//.test(ua)) b = "Firefox";
    if (/Windows/.test(ua)) o = "Windows";
    else if (/Mac OS X/.test(ua)) o = "macOS";
    else if (/Android/.test(ua)) o = "Android";
    else if (/iPhone|iPad/.test(ua)) o = "iOS";
    else if (/Linux/.test(ua)) o = "Linux";
    return {
      userAgent: ua, browser: b, os: o,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1
    };
  }

  function ago(ts) {
    var s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return "just now";
    var m = Math.floor(s / 60);
    if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + "h ago";
    var d = Math.floor(h / 24);
    if (d < 7) return d + "d ago";
    return new Date(ts).toLocaleDateString();
  }

  function cssEsc(s) { return String(s).replace(/["\\\\\\]]/g, "\\\\$&"); }
  function cssPath(el) {
    if (!el || el.nodeType !== 1) return "body";
    var parts = [], node = el;
    while (node && node.nodeType === 1 && node !== document.body && parts.length < 12) {
      var seg = node.tagName.toLowerCase();
      if (node.id) { parts.unshift(seg + "#" + cssEsc(node.id)); break; }
      var i = 1, sib = node;
      while ((sib = sib.previousElementSibling)) {
        if (sib.tagName === node.tagName) i++;
      }
      parts.unshift(seg + ":nth-of-type(" + i + ")");
      node = node.parentElement;
    }
    return (node === document.body ? "body > " : "") + parts.join(" > ");
  }
  function xPath(el) {
    if (!el || el.nodeType !== 1) return "/html/body";
    var parts = [], node = el;
    while (node && node.nodeType === 1) {
      var i = 1, sib = node;
      while ((sib = sib.previousElementSibling)) {
        if (sib.tagName === node.tagName) i++;
      }
      parts.unshift(node.tagName.toLowerCase() + "[" + i + "]");
      if (node === document.documentElement) break;
      node = node.parentElement;
    }
    return "/" + parts.join("/");
  }
  function resolveEl(a) {
    var el = null;
    try { if (a.selector) el = document.querySelector(a.selector); } catch (e) {}
    if (!el && a.xpath) {
      try { el = document.evaluate(a.xpath, document, null, 9, null).singleNodeValue; } catch (e) {}
    }
    return el;
  }
  function makeAnchor(clientX, clientY, target) {
    var r = target.getBoundingClientRect();
    var w = r.width || 1, h = r.height || 1;
    return {
      selector: cssPath(target), xpath: xPath(target),
      nx: Math.min(1, Math.max(0, (clientX - r.left) / w)),
      ny: Math.min(1, Math.max(0, (clientY - r.top) / h)),
      scrollY: window.scrollY || 0, elementWidth: w, elementHeight: h
    };
  }

  // --- Shadow root + styles -------------------------------------------------
  var host = document.createElement("div");
  host.id = "bo-feedback-host";
  host.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;";
  document.documentElement.appendChild(host);
  var root = host.attachShadow({ mode: "open" });
  var st = document.createElement("style");
  st.textContent =
    "*{box-sizing:border-box}" +
    ".fb-fab{position:fixed;right:20px;bottom:20px;pointer-events:auto;display:flex;align-items:center;gap:8px;background:" + BRAND + ";color:#fff;border:none;border-radius:999px;padding:11px 18px;font:600 13px/1 -apple-system,system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 28px rgba(21,112,239,.4);transition:transform .15s,box-shadow .15s}" +
    ".fb-fab:hover{transform:translateY(-2px);box-shadow:0 12px 34px rgba(21,112,239,.5)}" +
    ".fb-fab .ct{background:#fff;color:" + BRAND + ";border-radius:999px;min-width:18px;height:18px;padding:0 5px;font:700 11px/18px -apple-system,system-ui,sans-serif}" +
    ".fb-bd{position:fixed;inset:0;pointer-events:auto;background:rgba(11,18,32,.04);z-index:12}" +
    ".fb-hlp{position:fixed;pointer-events:none;border:2px dashed " + BRAND + ";background:rgba(21,112,239,.07);border-radius:4px;z-index:11;transition:all .08s linear}" +
    ".fb-tip{position:fixed;pointer-events:none;max-width:240px;background:#0b1220;color:#fff;font:12px/1.45 -apple-system,system-ui,sans-serif;padding:8px 10px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.32);z-index:14}" +
    ".fb-tip b{display:block;margin-bottom:2px;font-size:11px;color:#9db6e6}" +
    ".fb-bar{position:fixed;right:20px;bottom:20px;pointer-events:auto;display:flex;align-items:center;gap:4px;background:#0b1220;padding:6px;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.35);font:600 12px/1 -apple-system,system-ui,sans-serif;animation:fbpop .18s ease-out}" +
    ".fb-bar button{background:transparent;color:#cbd5e1;border:none;border-radius:9px;padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .12s,color .12s}" +
    ".fb-bar button:hover{background:rgba(255,255,255,.08);color:#fff}" +
    ".fb-bar button.on{background:" + BRAND + ";color:#fff}" +
    ".fb-bar .sep{width:1px;height:20px;background:rgba(255,255,255,.12);margin:0 2px}" +
    ".fb-hl{position:fixed;pointer-events:none;border:2px solid " + BRAND + ";background:rgba(21,112,239,.10);border-radius:4px;z-index:10;transition:all .06s linear}" +
    ".fb-hl-lab{position:fixed;pointer-events:none;background:" + BRAND + ";color:#fff;font:600 11px/1 ui-monospace,monospace;padding:4px 7px;border-radius:5px;z-index:11;white-space:nowrap}" +
    ".fb-cap{position:fixed;inset:0;pointer-events:auto;cursor:crosshair;z-index:9}" +
    ".fb-rg{position:fixed;pointer-events:none;border:2px solid " + BRAND + ";background:rgba(21,112,239,.12);border-radius:4px;z-index:10}" +
    ".fb-pin{position:fixed;pointer-events:auto;width:28px;height:28px;border-radius:50% 50% 50% 2px;background:" + BRAND + ";color:#fff;font:700 12px/28px -apple-system,system-ui,sans-serif;text-align:center;transform:translate(-2px,-30px) rotate(0);cursor:grab;box-shadow:0 3px 10px rgba(0,0,0,.32);transition:transform .12s,opacity .15s;z-index:12}" +
    ".fb-pin:hover{transform:translate(-2px,-32px) scale(1.12)}" +
    ".fb-pin.res{background:#16a34a;opacity:.65}" +
    ".fb-pin.drag{cursor:grabbing;transform:translate(-2px,-30px) scale(1.18);box-shadow:0 8px 22px rgba(0,0,0,.4)}" +
    ".fb-card{position:fixed;pointer-events:auto;width:320px;background:#fff;color:#0b1220;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.28);font:13px/1.45 -apple-system,system-ui,sans-serif;z-index:13;overflow:hidden;animation:fbin .16s cubic-bezier(.2,.8,.2,1)}" +
    ".fb-cmp{position:fixed;pointer-events:auto;display:flex;align-items:center;gap:8px;z-index:13;animation:fbin .16s cubic-bezier(.2,.8,.2,1)}" +
    ".fb-cmp .dot{width:26px;height:26px;border-radius:50% 50% 50% 2px;background:" + BRAND + ";flex:none;box-shadow:0 3px 10px rgba(0,0,0,.3)}" +
    ".fb-box{background:#0b1220;border-radius:16px;box-shadow:0 16px 50px rgba(0,0,0,.32);width:320px;overflow:hidden;transition:width .18s}" +
    ".fb-row{display:flex;align-items:center;gap:8px;padding:8px 8px 8px 14px}" +
    ".fb-row .main{flex:1;background:transparent;border:none;outline:none;color:#fff;font:14px/1.4 -apple-system,system-ui,sans-serif;resize:none;max-height:120px;padding:4px 0;overflow-y:auto}" +
    ".fb-row .main::placeholder{color:#7c8aa3}" +
    ".fb-snd{width:30px;height:30px;border-radius:50%;border:none;background:#26334a;color:#fff;cursor:pointer;flex:none;font-size:15px;transition:background .12s,transform .12s}" +
    ".fb-snd:enabled:hover{background:" + BRAND + ";transform:scale(1.08)}" +
    ".fb-snd:disabled{opacity:.45;cursor:default}" +
    ".fb-exp{max-height:0;opacity:0;overflow:hidden;transition:max-height .22s ease,opacity .18s}" +
    ".fb-box.open .fb-exp{max-height:340px;opacity:1}" +
    ".fb-exp-in{padding:0 12px 12px}" +
    ".fb-kinds{display:flex;gap:6px;margin:2px 0 10px}" +
    ".fb-kind{flex:1;background:#1a2436;color:#aab6c8;border:1px solid transparent;border-radius:9px;padding:7px 4px;font:600 12px -apple-system,system-ui,sans-serif;cursor:pointer;transition:.12s}" +
    ".fb-kind:hover{color:#fff}" +
    ".fb-kind.on{background:rgba(21,112,239,.18);border-color:" + BRAND + ";color:#fff}" +
    ".fb-thumb{position:relative;border-radius:9px;overflow:hidden;margin-bottom:10px;border:1px solid #26334a}" +
    ".fb-thumb img{display:block;width:100%;max-height:140px;object-fit:cover}" +
    ".fb-thumb .x{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;border:none;cursor:pointer;font-size:13px;line-height:22px}" +
    ".fb-id{display:flex;gap:6px;margin-bottom:8px}" +
    ".fb-id input{flex:1;min-width:0;background:#1a2436;border:1px solid #26334a;border-radius:9px;padding:8px;color:#fff;font:12px -apple-system,system-ui,sans-serif;outline:none}" +
    ".fb-id input:focus{border-color:" + BRAND + "}" +
    ".fb-hint{color:#7c8aa3;font-size:11px;margin-bottom:6px}" +
    ".fb-ch{padding:14px 14px 10px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #eef1f6}" +
    ".fb-badge{font:700 10px/1 -apple-system,system-ui,sans-serif;padding:4px 7px;border-radius:6px;background:#eef1f6;color:#475569;text-transform:uppercase;letter-spacing:.04em}" +
    ".fb-msg{padding:12px 14px;border-bottom:1px solid #f1f3f8}" +
    ".fb-msg .who{font-weight:700;font-size:12px}" +
    ".fb-msg .tm{color:#94a3b8;font-size:11px;margin-left:6px}" +
    ".fb-msg p{margin:5px 0 0;white-space:pre-wrap}" +
    ".fb-foot{padding:10px 12px;display:flex;gap:6px;align-items:center}" +
    ".fb-foot input{flex:1;background:#f4f6fa;border:1px solid #e6e9f0;border-radius:9px;padding:8px;font:13px -apple-system,system-ui,sans-serif;outline:none}" +
    ".fb-foot input:focus{border-color:" + BRAND + "}" +
    ".fb-id2{display:none;gap:6px;padding:0 12px 10px}" +
    ".fb-id2.show{display:flex}" +
    ".fb-id2 input{flex:1;min-width:0;background:#f4f6fa;border:1px solid #e6e9f0;border-radius:9px;padding:8px;font:12px -apple-system,system-ui,sans-serif;outline:none}" +
    ".fb-id2 input:focus{border-color:" + BRAND + "}" +
    ".fb-foot button,.fb-res{background:" + BRAND + ";color:#fff;border:none;border-radius:9px;padding:8px 12px;font:600 12px -apple-system,system-ui,sans-serif;cursor:pointer}" +
    ".fb-res{background:#eef1f6;color:#0b1220;width:100%;margin-top:4px;padding:9px}" +
    "@keyframes fbpop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}" +
    "@keyframes fbin{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}";
  root.appendChild(st);

  var pinLayer = document.createElement("div");
  pinLayer.style.cssText = "position:fixed;inset:0;pointer-events:none;";
  root.appendChild(pinLayer);

  var fab = document.createElement("button");
  fab.className = "fb-fab";
  fab.innerHTML = "<span style=\\"font-size:15px\\">\\uD83D\\uDCAC</span><span>Feedback</span><span class=\\"ct\\" style=\\"display:none\\">0</span>";
  root.appendChild(fab);

  var S = {
    mode: null, comments: [], card: null, cmp: null,
    hl: null, hlLab: null, cap: null, bar: null, bd: null,
    hoverHL: null, hoverTip: null, pendPin: null, cmpHL: null,
    pendingAnchor: null, shotBlob: null, shotURL: null, kind: null,
    dragging: false, suppress: false
  };

  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function path() { return location.pathname; }
  function clamp(v, mn, mx) { return Math.min(mx, Math.max(mn, v)); }

  function clearHover() {
    if (S.hoverHL) { S.hoverHL.remove(); S.hoverHL = null; }
    if (S.hoverTip) { S.hoverTip.remove(); S.hoverTip = null; }
  }
  function showHover(c, pinEl) {
    clearHover();
    var t = resolveEl(c.anchor);
    if (t) {
      var r = t.getBoundingClientRect();
      var h = el("div", "fb-hlp");
      h.style.left = r.left + "px"; h.style.top = r.top + "px";
      h.style.width = r.width + "px"; h.style.height = r.height + "px";
      root.appendChild(h); S.hoverHL = h;
    }
    var tip = el("div", "fb-tip");
    var who = el("b"); who.textContent = c.authorName +
      (c.kind ? " \\u00B7 " + c.kind : "");
    var txt = document.createTextNode(
      c.content.length > 120 ? c.content.slice(0, 120) + "\\u2026" : c.content);
    tip.appendChild(who); tip.appendChild(txt);
    var pr = pinEl.getBoundingClientRect();
    tip.style.left = clamp(pr.left, 8, window.innerWidth - 256) + "px";
    tip.style.top = (pr.bottom + 6) + "px";
    root.appendChild(tip); S.hoverTip = tip;
  }

  function addBackdrop() {
    if (S.bd) return;
    var bd = el("div", "fb-bd");
    bd.addEventListener("pointerdown", function () {
      closeOverlays(); setMode(null);
    });
    root.appendChild(bd); S.bd = bd;
  }
  function closeOverlays(keepBar) {
    clearHover();
    if (S.cmpHL) { S.cmpHL.remove(); S.cmpHL = null; }
    if (S.pendPin) { S.pendPin.remove(); S.pendPin = null; }
    if (S.bd) { S.bd.remove(); S.bd = null; }
    if (S.card) { S.card.remove(); S.card = null; }
    if (S.cmp) { S.cmp.remove(); S.cmp = null; }
    if (S.hl) { S.hl.remove(); S.hl = null; }
    if (S.hlLab) { S.hlLab.remove(); S.hlLab = null; }
    if (S.cap) { S.cap.remove(); S.cap = null; }
    if (S.shotURL) { try { URL.revokeObjectURL(S.shotURL); } catch (e) {} }
    S.shotBlob = null; S.shotURL = null; S.kind = null; S.pendingAnchor = null;
    if (!keepBar && S.bar) { S.bar.remove(); S.bar = null; }
    S.suppress = false;
  }

  // --- Screenshot ----------------------------------------------------------
  function loadH2C() {
    return new Promise(function (res) {
      if (window.html2canvas) { res(window.html2canvas); return; }
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
      s.onload = function () { res(window.html2canvas || null); };
      s.onerror = function () { res(null); };
      document.head.appendChild(s);
      setTimeout(function () { if (!window.html2canvas) res(null); }, 6000);
    });
  }
  function shoot(opts) {
    return loadH2C().then(function (h2c) {
      if (!h2c) return null;
      var node = opts.el || document.body;
      var o = { logging: false, scale: 1, useCORS: true, backgroundColor: null };
      if (opts.rect) {
        o.x = opts.rect.x; o.y = opts.rect.y;
        o.width = opts.rect.w; o.height = opts.rect.h;
        node = document.body;
      }
      return h2c(node, o).then(function (cv) {
        return new Promise(function (r) {
          try { cv.toBlob(function (b) { r(b); }, "image/png", 0.92); }
          catch (e) { r(null); }
        });
      })["catch"](function () { return null; });
    })["catch"](function () { return null; });
  }
  function uploadShot(blob) {
    if (!blob) return Promise.resolve(undefined);
    return api("/feedback/screenshot-upload-url", "POST", { projectToken: TOKEN })
      .then(function (j) {
        return fetch(j.uploadUrl, { method: "POST", headers: { "Content-Type": "image/png" }, body: blob })
          .then(function (r) { return r.json(); });
      })
      .then(function (j) { return j.storageId; })["catch"](function () { return undefined; });
  }

  // --- Composer ------------------------------------------------------------
  function openComposer(px, py, anchor) {
    closeOverlays(true);
    addBackdrop();
    var pp = el("div", "fb-pin");
    pp.textContent = "+";
    var ppx = px - 14 < 0 ? px : px - 14;
    pp.style.left = ppx + "px";
    pp.style.top = py + "px";
    pp.style.pointerEvents = "none";
    root.appendChild(pp); S.pendPin = pp;
    S.pendingAnchor = anchor;
    var wrap = el("div", "fb-cmp");
    wrap.style.left = clamp(px, 12, window.innerWidth - 344) + "px";
    wrap.style.top = clamp(py, 12, window.innerHeight - 70) + "px";
    var dot = el("div", "dot");
    var box = el("div", "fb-box");
    var row = el("div", "fb-row");
    var inp = el("textarea", "main"); inp.placeholder = "Add a comment"; inp.rows = 1;
    var snd = el("button", "fb-snd"); snd.innerHTML = "\\u2191"; snd.disabled = true;
    row.appendChild(inp); row.appendChild(snd);
    var exp = el("div", "fb-exp");
    var inr = el("div", "fb-exp-in");
    var kinds = el("div", "fb-kinds");
    KINDS.forEach(function (kd) {
      var b = el("button", "fb-kind");
      b.innerHTML = kd.ico + " " + kd.label;
      b.onclick = function () {
        S.kind = S.kind === kd.k ? null : kd.k;
        Array.prototype.forEach.call(kinds.children, function (c, i) {
          c.className = "fb-kind" + (KINDS[i].k === S.kind ? " on" : "");
        });
      };
      kinds.appendChild(b);
    });
    inr.appendChild(kinds);
    var thumbWrap = el("div"); inr.appendChild(thumbWrap);
    var idWrap = el("div"); inr.appendChild(idWrap);
    var idGetter = null;
    if (!getIdentity()) {
      var hint = el("div", "fb-hint");
      hint.textContent = "First time \\u2014 tell us who you are (saved, asked once).";
      var idr = el("div", "fb-id");
      var nm = el("input"); nm.placeholder = "Name";
      var em = el("input"); em.placeholder = "Email"; em.type = "email";
      idr.appendChild(nm); idr.appendChild(em);
      idWrap.appendChild(hint); idWrap.appendChild(idr);
      idGetter = function () {
        var v = { name: (nm.value || "").trim(), email: (em.value || "").trim() };
        return v.name && v.email ? v : null;
      };
    }
    exp.appendChild(inr); box.appendChild(row); box.appendChild(exp);
    wrap.appendChild(dot); wrap.appendChild(box);
    root.appendChild(wrap);
    S.cmp = wrap;
    var anchEl = (anchor._shot && anchor._shot.el) || resolveEl(anchor);
    if (anchEl && anchEl.getBoundingClientRect) {
      var ar = anchEl.getBoundingClientRect();
      if (ar.width && ar.height) {
        var ahl = el("div", "fb-hlp");
        ahl.style.left = ar.left + "px"; ahl.style.top = ar.top + "px";
        ahl.style.width = ar.width + "px"; ahl.style.height = ar.height + "px";
        root.appendChild(ahl); S.cmpHL = ahl;
      }
    }
    setTimeout(function () { inp.focus(); }, 30);

    function expand() { box.classList.add("open"); }
    inp.addEventListener("focus", expand);
    inp.addEventListener("input", function () {
      snd.disabled = !inp.value.trim();
      inp.style.height = "auto";
      inp.style.height = Math.min(120, inp.scrollHeight) + "px";
    });

    // Capture screenshot in the background, show preview when ready.
    var shotOpts = anchor._shot || { el: resolveEl(anchor) || document.body };
    shoot(shotOpts).then(function (blob) {
      if (!blob || S.cmp !== wrap) return;
      S.shotBlob = blob;
      S.shotURL = URL.createObjectURL(blob);
      var tw = el("div", "fb-thumb");
      var im = el("img"); im.src = S.shotURL;
      var x = el("button", "x"); x.innerHTML = "\\u2715";
      x.onclick = function () {
        S.shotBlob = null;
        if (S.shotURL) { URL.revokeObjectURL(S.shotURL); S.shotURL = null; }
        tw.remove();
      };
      tw.appendChild(im); tw.appendChild(x);
      thumbWrap.appendChild(tw);
      expand();
    });

    function submit() {
      var content = (inp.value || "").trim();
      if (!content) return;
      var idv = getIdentity();
      if (!idv && idGetter) {
        idv = idGetter();
        if (!idv) { box.classList.add("open"); return; }
        setIdentity(idv);
      }
      if (!idv) return;
      snd.disabled = true; snd.innerHTML = "\\u22EF";
      uploadShot(S.shotBlob).then(function (sid) {
        return api("/feedback/comments", "POST", {
          projectToken: TOKEN, pageUrl: location.href, pagePath: path(),
          anchor: { selector: anchor.selector, xpath: anchor.xpath, nx: anchor.nx,
            ny: anchor.ny, scrollY: anchor.scrollY,
            elementWidth: anchor.elementWidth, elementHeight: anchor.elementHeight },
          content: content, kind: S.kind || undefined,
          authorName: idv.name, authorEmail: idv.email,
          metadata: uaInfo(), screenshotStorageId: sid
        });
      }).then(function () { closeOverlays(); setMode(null); refresh(); })
        ["catch"](function () { snd.disabled = false; snd.innerHTML = "\\u2191"; });
    }
    snd.onclick = submit;
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
      if (e.key === "Escape") { closeOverlays(); setMode(null); }
    });
  }

  // --- Thread --------------------------------------------------------------
  function openThread(c, px, py) {
    closeOverlays(true);
    addBackdrop();
    var card = el("div", "fb-card");
    card.style.left = clamp(px, 12, window.innerWidth - 332) + "px";
    card.style.top = clamp(py, 12, window.innerHeight - 360) + "px";
    var ch = el("div", "fb-ch");
    if (c.kind) {
      var bd = el("span", "fb-badge"); bd.textContent = c.kind; ch.appendChild(bd);
    }
    var tt = el("span"); tt.style.cssText = "font-weight:700;flex:1";
    tt.textContent = c.authorName;
    var stt = el("span", "fb-badge");
    stt.textContent = c.status;
    stt.style.background = c.status === "open" ? "rgba(21,112,239,.12)" : "#e7f6ec";
    ch.appendChild(tt); ch.appendChild(stt);
    card.appendChild(ch);
    var body = el("div"); body.style.maxHeight = "260px"; body.style.overflow = "auto";
    function msg(name, when, text) {
      var m = el("div", "fb-msg");
      m.innerHTML = "<div><span class=\\"who\\"></span><span class=\\"tm\\"></span></div><p></p>";
      m.querySelector(".who").textContent = name;
      m.querySelector(".tm").textContent = ago(when);
      m.querySelector("p").textContent = text;
      return m;
    }
    body.appendChild(msg(c.authorName, c.createdAt, c.content));
    (c.replies || []).forEach(function (r) {
      body.appendChild(msg(r.authorName, r.createdAt, r.content));
    });
    card.appendChild(body);
    var idRow = el("div", "fb-id2");
    var idN = el("input"); idN.placeholder = "Name";
    var idE = el("input"); idE.placeholder = "Email"; idE.type = "email";
    idRow.appendChild(idN); idRow.appendChild(idE);
    card.appendChild(idRow);
    var foot = el("div", "fb-foot");
    var ri = el("input"); ri.placeholder = "Reply\\u2026";
    var rb = el("button"); rb.textContent = "Send";
    foot.appendChild(ri); foot.appendChild(rb);
    card.appendChild(foot);
    var resB = el("button", "fb-res");
    resB.textContent = c.status === "open" ? "Mark resolved" : "Reopen";
    resB.style.margin = "0 12px 12px";
    resB.style.width = "calc(100% - 24px)";
    card.appendChild(resB);
    root.appendChild(card);
    S.card = card;

    function ident() {
      var idv = getIdentity();
      if (idv) return idv;
      if (!idRow.classList.contains("show")) {
        idRow.classList.add("show");
        setTimeout(function () { idN.focus(); }, 20);
        return null;
      }
      var n = (idN.value || "").trim(), e = (idE.value || "").trim();
      if (!n || !e) { idN.focus(); return null; }
      idv = { name: n, email: e }; setIdentity(idv);
      idRow.classList.remove("show");
      return idv;
    }
    rb.onclick = function () {
      var t = (ri.value || "").trim(); if (!t) return;
      var idv = ident(); if (!idv) return;
      rb.disabled = true;
      api("/feedback/replies", "POST", {
        projectToken: TOKEN, commentId: c.id, content: t,
        authorName: idv.name, authorEmail: idv.email
      }).then(function () { closeOverlays(); refresh(); })
        ["catch"](function () { rb.disabled = false; });
    };
    resB.onclick = function () {
      api("/feedback/resolve", "POST", {
        projectToken: TOKEN, commentId: c.id,
        status: c.status === "open" ? "resolved" : "open"
      }).then(function () { closeOverlays(); refresh(); });
    };
  }

  // --- Pins (render + drag) ------------------------------------------------
  function pinXY(c) {
    var t = resolveEl(c.anchor), x, y;
    if (t) {
      var r = t.getBoundingClientRect();
      x = r.left + (c.anchor.nx == null ? 0.5 : c.anchor.nx) * r.width;
      y = r.top + (c.anchor.ny == null ? 0.5 : c.anchor.ny) * r.height;
    } else {
      x = 24; y = (c.anchor.scrollY || 0) - (window.scrollY || 0) + 90;
    }
    return { x: x, y: y };
  }
  function renderPins() {
    if (S.dragging || S.suppress) return;
    clearHover();
    pinLayer.innerHTML = "";
    S.comments.forEach(function (c, i) {
      var p = pinXY(c);
      if (p.y < -50 || p.y > window.innerHeight + 50) return;
      var pin = el("div", "fb-pin" + (c.status === "resolved" ? " res" : ""));
      pin.textContent = String(i + 1);
      pin.style.left = p.x + "px";
      pin.style.top = p.y + "px";
      pin.addEventListener("mouseenter", function () {
        if (!S.dragging) showHover(c, pin);
      });
      pin.addEventListener("mouseleave", clearHover);
      attachDrag(pin, c);
      pinLayer.appendChild(pin);
    });
  }
  function attachDrag(pin, c) {
    var sx, sy, moved, ox, oy;
    pin.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      sx = e.clientX; sy = e.clientY; moved = false;
      var r = pin.getBoundingClientRect();
      ox = e.clientX - r.left; oy = e.clientY - r.top;
      pin.setPointerCapture(e.pointerId);
      pin.classList.add("drag"); S.dragging = true;
      function mv(ev) {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) moved = true;
        pin.style.left = (ev.clientX - ox + 2) + "px";
        pin.style.top = (ev.clientY - oy + 30) + "px";
      }
      function up(ev) {
        pin.removeEventListener("pointermove", mv);
        pin.removeEventListener("pointerup", up);
        pin.classList.remove("drag"); S.dragging = false;
        if (!moved) { renderPins(); openThread(c, ev.clientX, ev.clientY); return; }
        pin.style.display = "none";
        var tgt = document.elementFromPoint(
          clamp(ev.clientX, 0, window.innerWidth - 1),
          clamp(ev.clientY, 0, window.innerHeight - 1));
        pin.style.display = "";
        if (!tgt || tgt === host) { renderPins(); return; }
        var a = makeAnchor(ev.clientX, ev.clientY, tgt);
        var idx = S.comments.indexOf(c);
        if (idx >= 0) S.comments[idx].anchor = a;
        renderPins();
        api("/feedback/move", "POST", {
          projectToken: TOKEN, commentId: c.id,
          selector: a.selector, xpath: a.xpath, nx: a.nx, ny: a.ny,
          scrollY: a.scrollY, elementWidth: a.elementWidth,
          elementHeight: a.elementHeight,
          anchor: a
        })["catch"](function () { refresh(); });
      }
      pin.addEventListener("pointermove", mv);
      pin.addEventListener("pointerup", up);
    });
  }

  function updateFab() {
    var open = 0;
    S.comments.forEach(function (c) { if (c.status !== "resolved") open++; });
    var ct = fab.querySelector(".ct");
    if (ct) {
      ct.textContent = open > 99 ? "99+" : String(open);
      ct.style.display = open > 0 ? "" : "none";
    }
  }
  function refresh() {
    if (S.dragging) return;
    api("/feedback/comments?token=" + encodeURIComponent(TOKEN) +
        "&pagePath=" + encodeURIComponent(path()), "GET")
      .then(function (j) {
        S.comments = (j && j.comments) || [];
        renderPins(); updateFab();
      })
      ["catch"](function () {});
  }

  // --- Selection modes -----------------------------------------------------
  function buildBar() {
    var bar = el("div", "fb-bar");
    var be = el("button"); be.innerHTML = "\\u25A3 Element";
    var br = el("button"); br.innerHTML = "\\u2B1A Region";
    var sep = el("div", "sep");
    var bx = el("button"); bx.innerHTML = "\\u2715";
    be.onclick = function () { setMode("element"); };
    br.onclick = function () { setMode("region"); };
    bx.onclick = function () { closeOverlays(); setMode(null); };
    bar.appendChild(be); bar.appendChild(br);
    bar.appendChild(sep); bar.appendChild(bx);
    bar._be = be; bar._br = br;
    return bar;
  }
  function syncBar() {
    if (!S.bar) return;
    S.bar._be.className = S.mode === "element" ? "on" : "";
    S.bar._br.className = S.mode === "region" ? "on" : "";
  }

  function startElement() {
    S.suppress = true; clearHover(); pinLayer.innerHTML = "";
    var hl = el("div", "fb-hl"); hl.style.display = "none";
    var lab = el("div", "fb-hl-lab"); lab.style.display = "none";
    root.appendChild(hl); root.appendChild(lab);
    S.hl = hl; S.hlLab = lab;
    var raf = 0, last = null;
    function move(e) {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var t = document.elementFromPoint(e.clientX, e.clientY);
        if (!t || t === host || (S.bar && S.bar.contains(t))) {
          hl.style.display = "none"; lab.style.display = "none"; return;
        }
        last = t;
        var r = t.getBoundingClientRect();
        hl.style.display = ""; lab.style.display = "";
        hl.style.left = r.left + "px"; hl.style.top = r.top + "px";
        hl.style.width = r.width + "px"; hl.style.height = r.height + "px";
        lab.textContent = t.tagName.toLowerCase() +
          " \\u00B7 " + Math.round(r.width) + "\\u00D7" + Math.round(r.height);
        lab.style.left = r.left + "px";
        lab.style.top = Math.max(0, r.top - 24) + "px";
      });
    }
    function click(e) {
      var t = document.elementFromPoint(e.clientX, e.clientY);
      if (!t || t === host || (S.bar && S.bar.contains(t))) return;
      e.preventDefault(); e.stopPropagation();
      document.removeEventListener("mousemove", move, true);
      document.removeEventListener("click", click, true);
      hl.remove(); lab.remove(); S.hl = null; S.hlLab = null;
      var a = makeAnchor(e.clientX, e.clientY, t);
      a._shot = { el: t };
      openComposer(e.clientX + 14, e.clientY, a);
    }
    document.addEventListener("mousemove", move, true);
    document.addEventListener("click", click, true);
    S._teardown = function () {
      document.removeEventListener("mousemove", move, true);
      document.removeEventListener("click", click, true);
      if (S.hl) { S.hl.remove(); S.hl = null; }
      if (S.hlLab) { S.hlLab.remove(); S.hlLab = null; }
    };
  }

  function startRegion() {
    S.suppress = true; clearHover(); pinLayer.innerHTML = "";
    var cap = el("div", "fb-cap"); root.appendChild(cap); S.cap = cap;
    var rg = null, sx, sy;
    cap.addEventListener("pointerdown", function (e) {
      sx = e.clientX; sy = e.clientY;
      rg = el("div", "fb-rg"); root.appendChild(rg);
    });
    cap.addEventListener("pointermove", function (e) {
      if (!rg) return;
      var x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
      rg.style.left = x + "px"; rg.style.top = y + "px";
      rg.style.width = Math.abs(e.clientX - sx) + "px";
      rg.style.height = Math.abs(e.clientY - sy) + "px";
    });
    cap.addEventListener("pointerup", function (e) {
      if (!rg) return;
      var x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY);
      var w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
      rg.remove(); rg = null;
      if (w < 8 || h < 8) return;
      var cx = x + w / 2, cy = y + h / 2;
      cap.style.display = "none";
      var t = document.elementFromPoint(cx, cy) || document.body;
      cap.style.display = "";
      var a = makeAnchor(cx, cy, t);
      a._shot = { rect: { x: x + (window.scrollX || 0), y: y + (window.scrollY || 0), w: w, h: h } };
      cap.remove(); S.cap = null;
      openComposer(x + w + 14, y, a);
    });
    S._teardown = function () {
      if (S.cap) { S.cap.remove(); S.cap = null; }
    };
  }

  function setMode(m) {
    if (S._teardown) { S._teardown(); S._teardown = null; }
    S.mode = m;
    if (!m) {
      S.suppress = false;
      if (S.bar) { S.bar.remove(); S.bar = null; }
      fab.style.display = "";
      renderPins();
      return;
    }
    fab.style.display = "none";
    if (!S.bar) { S.bar = buildBar(); root.appendChild(S.bar); }
    syncBar();
    if (m === "element") startElement();
    else startRegion();
  }

  fab.onclick = function () { setMode("element"); };
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && (S.mode || S.card || S.cmp)) {
      closeOverlays(); setMode(null); return;
    }
    var tag = (e.target && e.target.tagName) || "";
    var typing = tag === "INPUT" || tag === "TEXTAREA" ||
      (e.target && e.target.isContentEditable);
    if ((e.key === "c" || e.key === "C") && !typing &&
        !S.mode && !S.card && !S.cmp) {
      setMode("element");
    }
  });
  window.addEventListener("scroll", function () { renderPins(); }, { passive: true });
  window.addEventListener("resize", function () { renderPins(); });
  window.addEventListener("focus", function () { refresh(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") refresh();
  });
  refresh();
  setInterval(refresh, 10000);
})();`;
