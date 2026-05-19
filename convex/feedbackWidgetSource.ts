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
    // Fail fast on hung networks so the UI never stays stuck.
    var ctrl = null, timer = null;
    if (typeof AbortController !== "undefined") {
      ctrl = new AbortController();
      opts.signal = ctrl.signal;
      timer = setTimeout(function () {
        try { ctrl.abort(); } catch (e) {}
      }, 15000);
    }
    return fetch(BASE + path, opts).then(function (r) {
      if (timer) clearTimeout(timer);
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j && j.error ? j.error : "request_failed");
        return j;
      });
    })["catch"](function (e) {
      if (timer) clearTimeout(timer);
      throw new Error(
        e && e.name === "AbortError" ? "request_timeout"
          : (e && e.message) || "network_error"
      );
    });
  }

  // Comment ids created from this browser — lets the client delete own notes.
  function getMine() {
    try {
      var a = JSON.parse(localStorage.getItem("bo_fb_mine") || "[]");
      return a && a.length ? a : [];
    } catch (e) { return []; }
  }
  function addMine(id) {
    try {
      var a = getMine();
      a.push(id);
      if (a.length > 300) a = a.slice(-300);
      localStorage.setItem("bo_fb_mine", JSON.stringify(a));
    } catch (e) {}
  }
  function isMine(id) { return getMine().indexOf(id) !== -1; }
  // Track seen reply counts so a new agency reply flags the pin.
  function getSeen() {
    try { return JSON.parse(localStorage.getItem("bo_fb_seen_r") || "{}") || {}; }
    catch (e) { return {}; }
  }
  function markSeen(id, count) {
    try {
      var m = getSeen();
      m[id] = count;
      localStorage.setItem("bo_fb_seen_r", JSON.stringify(m));
    } catch (e) {}
  }
  function hasNewReplies(c) {
    var rc = (c.replies && c.replies.length) || 0;
    if (!rc) return false;
    var seen = getSeen()[c.id];
    return typeof seen !== "number" || rc > seen;
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
      scrollY: window.scrollY || 0, elementWidth: w, elementHeight: h,
      // Absolute document coords at click — pin renders from these so it
      // stays put even if images/content reflow the page afterwards.
      px: clientX + (window.scrollX || 0),
      py: clientY + (window.scrollY || 0)
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
    // Clean SaaS theme — matches the app kanban: white surfaces,
    // #e4e7ec borders, #1a2433 / #667085 text, soft shadows, brand accent.
    ".fb-panel{position:fixed;right:20px;bottom:20px;pointer-events:auto;width:212px;max-width:calc(100vw - 24px);background:#fff;border:1px solid #e4e7ec;border-radius:14px;box-shadow:0 12px 32px rgba(16,24,40,.16);font:600 12px/1 -apple-system,system-ui,sans-serif;overflow:hidden;animation:fbpop .18s ease-out;user-select:none}" +
    ".fb-phead{display:flex;align-items:center;gap:8px;padding:10px 10px 10px 12px;cursor:grab;background:#fff;border-bottom:1px solid #f1f3f7}" +
    ".fb-phead:active{cursor:grabbing}" +
    ".fb-phead .dotb{width:8px;height:8px;border-radius:50%;background:" + BRAND + "}" +
    ".fb-pttl{flex:1;color:#1a2433;font-weight:700}" +
    ".fb-pct{background:rgba(21,112,239,.10);color:" + BRAND + ";border-radius:999px;min-width:18px;height:18px;padding:0 5px;font:700 11px/18px -apple-system,system-ui,sans-serif;text-align:center}" +
    ".fb-pmin{width:22px;height:22px;border:none;background:#f2f4f7;color:#667085;border-radius:6px;cursor:pointer;font-size:13px;line-height:22px}" +
    ".fb-pmin:hover{background:#e4e7ec;color:#1a2433}" +
    ".fb-pbody{display:flex;flex-direction:column;gap:6px;padding:10px}" +
    ".fb-pbtn{display:flex;align-items:center;gap:8px;background:#f8fafc;color:#1a2433;border:1px solid #e4e7ec;border-radius:9px;padding:9px 11px;cursor:pointer;font:600 12px -apple-system,system-ui,sans-serif;transition:.12s;text-align:left}" +
    ".fb-pbtn:hover{border-color:" + BRAND + ";background:#fff}" +
    ".fb-pbtn.on{background:" + BRAND + ";border-color:" + BRAND + ";color:#fff}" +
    ".fb-pbtn .k{margin-left:auto;font:600 10px ui-monospace,monospace;color:#98a2b3}" +
    ".fb-pbtn.on .k{color:rgba(255,255,255,.7)}" +
    ".fb-pcancel{background:none;border:none;color:#98a2b3;font:600 11px -apple-system,system-ui,sans-serif;cursor:pointer;padding:4px;text-align:center}" +
    ".fb-pcancel:hover{color:#1a2433}" +
    ".fb-ptools{display:flex;gap:6px;padding:2px 0}" +
    ".fb-ptog{flex:1;background:#f8fafc;color:#667085;border:1px solid #e4e7ec;border-radius:8px;padding:6px 4px;font:600 11px -apple-system,system-ui,sans-serif;cursor:pointer;transition:.12s}" +
    ".fb-ptog:hover{color:#1a2433}" +
    ".fb-ptog.on{background:rgba(21,112,239,.10);border-color:" + BRAND + ";color:" + BRAND + "}" +
    ".fb-plist{margin-top:4px;max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:4px}" +
    ".fb-pli{display:flex;align-items:center;gap:7px;padding:7px 8px;border:1px solid #eef1f7;border-radius:8px;background:#fff;cursor:pointer;transition:.12s}" +
    ".fb-pli:hover{border-color:" + BRAND + ";background:#f8fafc}" +
    ".fb-pli .n{flex:none;width:18px;height:18px;border-radius:50%;background:" + BRAND + ";color:#fff;font:700 10px/18px ui-monospace,monospace;text-align:center}" +
    ".fb-pli.res .n{background:#12b76a}" +
    ".fb-pli .c{flex:1;min-width:0;color:#1a2433;font:500 11px/1.35 -apple-system,system-ui,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".fb-pli .s{flex:none;font:700 9px -apple-system,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.03em;color:#98a2b3}" +
    ".fb-pli.res .s{color:#12b76a}" +
    ".fb-pli.res .c{color:#98a2b3;text-decoration:line-through}" +
    ".fb-pli.res{opacity:.75}" +
    ".fb-pempty{padding:10px 4px;text-align:center;color:#98a2b3;font:500 11px -apple-system,system-ui,sans-serif}" +
    ".fb-panel.min{width:auto}" +
    ".fb-panel.min .fb-phead{border-bottom:none;cursor:grab;padding:9px 11px}" +
    ".fb-panel.min .fb-pbody{display:none}" +
    ".fb-bd{position:fixed;inset:0;pointer-events:auto;background:rgba(16,24,40,.05);z-index:12}" +
    ".fb-hlp{position:fixed;pointer-events:none;border:2px dashed " + BRAND + ";background:rgba(21,112,239,.06);border-radius:6px;z-index:11;transition:all .08s linear}" +
    ".fb-tip{position:fixed;pointer-events:none;max-width:248px;background:#fff;color:#1a2433;font:12px/1.45 -apple-system,system-ui,sans-serif;padding:9px 11px;border-radius:10px;border:1px solid #e4e7ec;box-shadow:0 12px 32px rgba(16,24,40,.14);z-index:14}" +
    ".fb-tip b{display:block;margin-bottom:2px;font-size:11px;color:#667085}" +
    ".fb-hl{position:fixed;pointer-events:none;border:2px solid " + BRAND + ";background:rgba(21,112,239,.08);border-radius:6px;z-index:10;transition:all .06s linear}" +
    ".fb-hl-lab{position:fixed;pointer-events:none;background:" + BRAND + ";color:#fff;font:600 11px/1 ui-monospace,monospace;padding:4px 7px;border-radius:5px;z-index:11;white-space:nowrap}" +
    ".fb-cap{position:fixed;inset:0;pointer-events:auto;cursor:crosshair;z-index:9}" +
    ".fb-rg{position:fixed;pointer-events:none;border:2px solid " + BRAND + ";background:rgba(21,112,239,.10);border-radius:6px;z-index:10}" +
    ".fb-pin{position:fixed;pointer-events:auto;touch-action:none;width:28px;height:28px;border-radius:50% 50% 50% 2px;background:" + BRAND + ";color:#fff;font:700 12px/28px -apple-system,system-ui,sans-serif;text-align:center;cursor:grab;box-shadow:0 3px 10px rgba(16,24,40,.22);transition:box-shadow .12s,opacity .15s;z-index:12}" +
    ".fb-pin.res{background:#12b76a;opacity:.7}" +
    ".fb-pin.new::after{content:'';position:absolute;top:-3px;right:-3px;width:10px;height:10px;border-radius:50%;background:#f79009;border:2px solid #fff;box-shadow:0 1px 3px rgba(16,24,40,.3)}" +
    ".fb-pin.drag{cursor:grabbing;box-shadow:0 10px 24px rgba(16,24,40,.30)}" +
    ".fb-card{position:fixed;pointer-events:auto;width:320px;max-width:calc(100vw - 24px);background:#fff;color:#1a2433;border-radius:14px;border:1px solid #e4e7ec;box-shadow:0 16px 44px rgba(16,24,40,.16);font:13px/1.45 -apple-system,system-ui,sans-serif;z-index:13;overflow:hidden;animation:fbin .16s cubic-bezier(.2,.8,.2,1)}" +
    ".fb-cmp{position:fixed;pointer-events:auto;display:flex;align-items:center;gap:8px;z-index:13;max-width:calc(100vw - 16px);animation:fbin .16s cubic-bezier(.2,.8,.2,1)}" +
    ".fb-cmp .dot{width:26px;height:26px;border-radius:50% 50% 50% 2px;background:" + BRAND + ";flex:none;box-shadow:0 3px 10px rgba(16,24,40,.22)}" +
    ".fb-box{background:#fff;border-radius:14px;border:1px solid #e4e7ec;box-shadow:0 16px 44px rgba(16,24,40,.16);width:320px;max-width:calc(100vw - 48px);overflow:hidden;transition:width .18s}" +
    ".fb-row{display:flex;align-items:center;gap:8px;padding:8px 8px 8px 14px}" +
    ".fb-row .main{flex:1;background:transparent;border:none;outline:none;color:#1a2433;font:14px/1.4 -apple-system,system-ui,sans-serif;resize:none;max-height:120px;padding:4px 0;overflow-y:auto}" +
    ".fb-row .main::placeholder{color:#98a2b3}" +
    ".fb-snd{width:30px;height:30px;border-radius:50%;border:none;background:#f2f4f7;color:#475467;cursor:pointer;flex:none;font-size:15px;transition:background .12s,color .12s,transform .12s}" +
    ".fb-snd:enabled:hover{background:" + BRAND + ";color:#fff;transform:scale(1.08)}" +
    ".fb-snd:disabled{opacity:.5;cursor:default}" +
    ".fb-exp{max-height:0;opacity:0;overflow:hidden;transition:max-height .22s ease,opacity .18s}" +
    ".fb-box.open .fb-exp{max-height:360px;opacity:1}" +
    ".fb-exp-in{padding:0 12px 12px;border-top:1px solid #f1f3f7}" +
    ".fb-kinds{display:flex;gap:6px;margin:10px 0}" +
    ".fb-kind{flex:1;background:#f2f4f7;color:#667085;border:1px solid transparent;border-radius:9px;padding:7px 4px;font:600 12px -apple-system,system-ui,sans-serif;cursor:pointer;transition:.12s}" +
    ".fb-kind:hover{color:#1a2433}" +
    ".fb-kind.on{background:rgba(21,112,239,.10);border-color:" + BRAND + ";color:" + BRAND + "}" +
    ".fb-thumb{position:relative;border-radius:10px;overflow:hidden;margin-bottom:10px;border:1px solid #e4e7ec}" +
    ".fb-thumb img{display:block;width:100%;max-height:140px;object-fit:cover}" +
    ".fb-thumb .x{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:rgba(16,24,40,.55);color:#fff;border:none;cursor:pointer;font-size:13px;line-height:22px}" +
    ".fb-ch{padding:14px 14px 10px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #f1f3f7}" +
    ".fb-badge{font:700 10px/1 -apple-system,system-ui,sans-serif;padding:4px 7px;border-radius:6px;background:#f2f4f7;color:#475467;text-transform:uppercase;letter-spacing:.04em}" +
    ".fb-msg{padding:12px 14px;border-bottom:1px solid #f1f3f7}" +
    ".fb-msg .who{font-weight:700;font-size:12px;color:#1a2433}" +
    ".fb-msg .tm{color:#98a2b3;font-size:11px;margin-left:6px}" +
    ".fb-msg p{margin:5px 0 0;white-space:pre-wrap;color:#344054}" +
    ".fb-foot{padding:10px 12px;display:flex;gap:6px;align-items:center}" +
    ".fb-foot input{flex:1;background:#f9fafb;border:1px solid #e4e7ec;border-radius:9px;padding:8px;color:#1a2433;font:13px -apple-system,system-ui,sans-serif;outline:none}" +
    ".fb-foot input:focus{border-color:" + BRAND + ";background:#fff}" +
    ".fb-foot button,.fb-res{background:" + BRAND + ";color:#fff;border:none;border-radius:9px;padding:8px 12px;font:600 12px -apple-system,system-ui,sans-serif;cursor:pointer}" +
    ".fb-res{background:#f2f4f7;color:#1a2433;width:calc(100% - 24px);margin:0 12px 12px;padding:9px}" +
    ".fb-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(8px);background:#0b1220;color:#fff;font:600 12px -apple-system,system-ui,sans-serif;padding:10px 16px;border-radius:999px;box-shadow:0 8px 24px rgba(16,24,40,.28);z-index:2147483647;opacity:0;transition:opacity .2s,transform .2s;pointer-events:none}" +
    ".fb-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}" +
    ".fb-toast.err{background:#b42318}" +
    ".fb-coach{position:fixed;right:20px;bottom:88px;pointer-events:auto;max-width:236px;background:#fff;color:#1a2433;border:1px solid #e4e7ec;border-radius:12px;box-shadow:0 16px 40px rgba(16,24,40,.18);padding:12px 14px;font:500 12px/1.5 -apple-system,system-ui,sans-serif;z-index:14;animation:fbpop .2s ease-out}" +
    ".fb-coach b{display:block;margin-bottom:3px;font-size:13px;color:#0b1220}" +
    ".fb-coach button{margin-top:9px;background:" + BRAND + ";color:#fff;border:none;border-radius:8px;padding:6px 12px;font:600 11px -apple-system,system-ui,sans-serif;cursor:pointer}" +
    "@keyframes fbpop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}" +
    ".fb-hlp.pulse{animation:fbpulse .9s ease-out 2}" +
    "@keyframes fbpulse{0%{box-shadow:0 0 0 0 rgba(21,112,239,.45)}70%{box-shadow:0 0 0 10px rgba(21,112,239,0)}100%{box-shadow:0 0 0 0 rgba(21,112,239,0)}}" +
    "@keyframes fbin{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}";
  root.appendChild(st);

  var pinLayer = document.createElement("div");
  pinLayer.style.cssText = "position:fixed;inset:0;pointer-events:none;";
  root.appendChild(pinLayer);

  var S = {
    mode: null, comments: [], card: null, cmp: null,
    hl: null, hlLab: null, cap: null, bar: null, bd: null,
    hoverHL: null, hoverTip: null, cmpHL: null,
    pendingAnchor: null, shotBlob: null, shotURL: null, kind: null,
    dragging: false, suppress: false, coach: null, listHL: null,
    allComments: []
  };

  function el(t, c) { var e = document.createElement(t); if (c) e.className = c; return e; }
  function path() { return location.pathname; }
  function clamp(v, mn, mx) { return Math.min(mx, Math.max(mn, v)); }

  // --- Persistent draggable control panel ----------------------------------
  var PKEY = "bo_fb_panel";
  function loadPanelState() {
    try { return JSON.parse(localStorage.getItem(PKEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function savePanelState(s) {
    try { localStorage.setItem(PKEY, JSON.stringify(s)); } catch (e) {}
  }
  var pstate = loadPanelState();

  // Default to minimized on small screens (still present, out of the way);
  // expanded on desktop. An explicit user choice always wins.
  var startMin = pstate.min === true ||
    (typeof pstate.min !== "boolean" && window.innerWidth < 640);
  var panel = el("div", "fb-panel" + (startMin ? " min" : ""));
  var phead = el("div", "fb-phead");
  var pdot = el("span", "dotb");
  var pgrip = el("span");
  pgrip.textContent = "\\u2059";
  pgrip.title = "Drag to move";
  pgrip.style.cssText =
    "color:#cbd5e1;font-size:13px;line-height:1;letter-spacing:1px;" +
    "margin-right:2px;cursor:grab";
  var pttl = el("span", "fb-pttl"); pttl.textContent = "Feedback";
  var pct = el("span", "fb-pct"); pct.style.display = "none"; pct.textContent = "0";
  var pmin = el("button", "fb-pmin");
  pmin.textContent = startMin ? "\\u2197" : "\\u2013";
  phead.appendChild(pgrip); phead.appendChild(pdot); phead.appendChild(pttl);
  phead.appendChild(pct); phead.appendChild(pmin);
  var pbody = el("div", "fb-pbody");
  var pEl = el("button", "fb-pbtn");
  pEl.innerHTML = "\\uD83D\\uDCAC <span>Comment an element</span><span class=\\"k\\">C</span>";
  var pReg = el("button", "fb-pbtn");
  pReg.innerHTML = "\\u2B1A <span>Select a region</span><span class=\\"k\\">R</span>";
  var pGen = el("button", "fb-pbtn");
  pGen.innerHTML = "\\uD83D\\uDCDD <span>Comment the page</span><span class=\\"k\\">G</span>";
  var pCancel = el("button", "fb-pcancel");
  pCancel.textContent = "Cancel (Esc)";
  pCancel.style.display = "none";
  var ptools = el("div", "fb-ptools");
  var pHide = el("button", "fb-ptog" + (pstate.hidePins ? " on" : ""));
  pHide.textContent = "Hide pins";
  var pShowRes = el("button", "fb-ptog" + (pstate.showResolved ? " on" : ""));
  pShowRes.textContent = "Show resolved";
  var pAll = el("button", "fb-ptog" + (pstate.allPages ? " on" : ""));
  pAll.textContent = "All pages";
  ptools.appendChild(pHide); ptools.appendChild(pShowRes);
  ptools.appendChild(pAll);
  var psite = el("div");
  psite.style.cssText =
    "color:#667085;font:600 11px -apple-system,system-ui,sans-serif;" +
    "padding:2px 2px 0;display:none";
  var psearch = el("input");
  psearch.placeholder = "Search comments\\u2026";
  psearch.style.cssText =
    "width:100%;box-sizing:border-box;margin-top:6px;background:#f9fafb;" +
    "border:1px solid #e4e7ec;border-radius:8px;padding:6px 8px;color:#1a2433;" +
    "font:500 11px -apple-system,system-ui,sans-serif;outline:none";
  psearch.style.display = "none";
  var ppause = el("div");
  ppause.style.cssText =
    "display:none;background:#fef3f2;color:#b42318;border:1px solid #fecdc9;" +
    "border-radius:8px;padding:7px 9px;margin-bottom:8px;" +
    "font:600 11px -apple-system,system-ui,sans-serif";
  var plist = el("div", "fb-plist");
  pbody.appendChild(ppause);
  pbody.appendChild(pEl); pbody.appendChild(pReg);
  pbody.appendChild(pGen); pbody.appendChild(pCancel);
  pbody.appendChild(ptools); pbody.appendChild(psite);
  pbody.appendChild(psearch); pbody.appendChild(plist);
  function setPaused(paused) {
    ppause.style.display = paused ? "" : "none";
    if (paused) {
      ppause.textContent = "\\u23F8 Feedback is paused \\u2014 new comments " +
        "are disabled for this site.";
    }
    pEl.disabled = paused;
    pReg.disabled = paused;
    pGen.disabled = paused;
    pEl.style.opacity = paused ? ".5" : "";
    pReg.style.opacity = paused ? ".5" : "";
    pGen.style.opacity = paused ? ".5" : "";
  }
  psearch.addEventListener("input", function () {
    S.q = (psearch.value || "").trim().toLowerCase();
    renderList();
  });
  panel.appendChild(phead); panel.appendChild(pbody);
  if (typeof pstate.x === "number" && typeof pstate.y === "number") {
    panel.style.left = clamp(pstate.x, 0, window.innerWidth - 60) + "px";
    panel.style.top = clamp(pstate.y, 0, window.innerHeight - 40) + "px";
    panel.style.right = "auto"; panel.style.bottom = "auto";
  }
  root.appendChild(panel);
  S.panel = panel;

  // --- Toast --------------------------------------------------------------
  var toastEl = el("div", "fb-toast");
  root.appendChild(toastEl);
  var toastT = 0;
  function fbToast(msg, isErr) {
    toastEl.textContent = msg;
    toastEl.className = "fb-toast show" + (isErr ? " err" : "");
    if (toastT) clearTimeout(toastT);
    toastT = setTimeout(function () {
      toastEl.className = "fb-toast" + (isErr ? " err" : "");
    }, 2600);
  }
  function fbErrMsg(e) {
    var m = (e && e.message) || "";
    if (m.indexOf("rate_limited") !== -1) {
      return "Too many comments \\u2014 please wait a moment";
    }
    if (m.indexOf("project_inactive") !== -1) {
      return "Feedback is paused for this site";
    }
    if (m.indexOf("invalid_token") !== -1) {
      return "This feedback link is no longer valid";
    }
    if (m.indexOf("not_found") !== -1) return "That comment was removed";
    if (m.indexOf("request_timeout") !== -1) {
      return "Timed out \\u2014 check your connection";
    }
    if (m.indexOf("network_error") !== -1) {
      return "Network issue \\u2014 try again";
    }
    return "Couldn\\u2019t send \\u2014 try again";
  }

  // --- First-run coachmark ------------------------------------------------
  function dismissCoach() {
    if (S.coach) { S.coach.remove(); S.coach = null; }
    try { localStorage.setItem("bo_fb_seen", "1"); } catch (e) {}
  }
  (function maybeCoach() {
    var seen = false;
    try { seen = localStorage.getItem("bo_fb_seen") === "1"; } catch (e) {}
    if (seen) return;
    var co = el("div", "fb-coach");
    var b = el("b"); b.textContent = "\\uD83D\\uDC4B Leave feedback here";
    var p = el("div");
    p.textContent =
      "Click \\u201cComment an element\\u201d, then click anything on the page to leave a note.";
    var ok = el("button"); ok.textContent = "Got it";
    ok.onclick = dismissCoach;
    co.appendChild(b); co.appendChild(p); co.appendChild(ok);
    root.appendChild(co); S.coach = co;
  })();

  pEl.onclick = function () {
    setMode(S.mode === "element" ? null : "element");
  };
  pReg.onclick = function () {
    setMode(S.mode === "region" ? null : "region");
  };
  pGen.onclick = function () {
    if (S.coach) dismissCoach();
    setMode(null);
    var sx = window.scrollX || 0, sy = window.scrollY || 0;
    var vw = window.innerWidth, vh = window.innerHeight;
    var a = {
      selector: "body", xpath: "/html/body",
      nx: 0.5, ny: 0.5, scrollY: sy,
      elementWidth: vw, elementHeight: vh,
      px: sx + vw / 2, py: sy + 80
    };
    // Screenshot the current viewport for context.
    a._shot = { rect: { x: sx, y: sy, w: vw, h: vh } };
    openComposer(vw / 2 - 160, Math.min(vh - 80, 120), a);
  };
  pCancel.onclick = function () { closeOverlays(); setMode(null); };
  pmin.onclick = function (e) {
    e.stopPropagation();
    var min = !panel.classList.contains("min");
    panel.classList.toggle("min", min);
    pmin.textContent = min ? "\\u2197" : "\\u2013";
    pstate.min = min; savePanelState(pstate);
  };

  (function makeDraggable() {
    var dx, dy, moving;
    phead.addEventListener("pointerdown", function (e) {
      if (e.target === pmin) return;
      moving = true;
      var r = panel.getBoundingClientRect();
      dx = e.clientX - r.left; dy = e.clientY - r.top;
      panel.style.right = "auto"; panel.style.bottom = "auto";
      phead.setPointerCapture(e.pointerId);
    });
    phead.addEventListener("pointermove", function (e) {
      if (!moving) return;
      var x = clamp(e.clientX - dx, 0, window.innerWidth - panel.offsetWidth);
      var y = clamp(e.clientY - dy, 0, window.innerHeight - 40);
      panel.style.left = x + "px"; panel.style.top = y + "px";
    });
    phead.addEventListener("pointerup", function () {
      if (!moving) return;
      moving = false;
      var r = panel.getBoundingClientRect();
      pstate.x = r.left; pstate.y = r.top; savePanelState(pstate);
    });
  })();

  pHide.onclick = function () {
    pstate.hidePins = !pstate.hidePins;
    pHide.className = "fb-ptog" + (pstate.hidePins ? " on" : "");
    savePanelState(pstate); renderPins();
  };
  pShowRes.onclick = function () {
    pstate.showResolved = !pstate.showResolved;
    pShowRes.className = "fb-ptog" + (pstate.showResolved ? " on" : "");
    savePanelState(pstate); renderPins(); renderList();
  };
  pAll.onclick = function () {
    pstate.allPages = !pstate.allPages;
    pAll.className = "fb-ptog" + (pstate.allPages ? " on" : "");
    savePanelState(pstate);
    if (pstate.allPages) refreshSite();
    renderList();
  };

  function visibleComments() {
    var src = pstate.allPages ? (S.allComments || []) : S.comments;
    var q = S.q || "";
    return src.filter(function (c) {
      if (!pstate.showResolved && c.status === "resolved") return false;
      if (q && (c.content || "").toLowerCase().indexOf(q) === -1) {
        return false;
      }
      return true;
    });
  }

  // Stable pin numbers: oldest comment on the page is always #1.
  function numberMap() {
    var arr = S.comments.slice().sort(function (a, b) {
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    var m = {};
    arr.forEach(function (c, i) { m[c.id] = i + 1; });
    return m;
  }

  function renderList() {
    if (S.listHL) { S.listHL.remove(); S.listHL = null; }
    var keepScroll = plist.scrollTop;
    plist.innerHTML = "";
    var srcLen = (pstate.allPages ? (S.allComments || []) : S.comments).length;
    psearch.style.display = srcLen > 0 ? "" : "none";
    var list = visibleComments();
    if (!list.length) {
      var em = el("div", "fb-pempty");
      em.textContent = S.q
        ? "No comments match \\u201c" + S.q + "\\u201d"
        : pstate.allPages
        ? "No comments across the site yet"
        : "No comments on this page yet";
      plist.appendChild(em);
      return;
    }
    var here = path();
    var nmap = numberMap();
    list.forEach(function (c, idx) {
      var n = pstate.allPages
        ? idx + 1
        : nmap[c.id] || idx + 1;
      var row = el("div", "fb-pli" + (c.status === "resolved" ? " res" : ""));
      var nb = el("span", "n"); nb.textContent = String(n);
      row.appendChild(nb);
      if (pstate.allPages && c.pagePath !== here) {
        var pl = el("span");
        pl.textContent = c.pagePath;
        pl.title = c.pagePath;
        pl.style.cssText =
          "flex:none;max-width:78px;overflow:hidden;text-overflow:ellipsis;" +
          "white-space:nowrap;font:600 9px ui-monospace,monospace;" +
          "color:#98a2b3;background:#f2f4f7;padding:2px 5px;border-radius:5px";
        row.appendChild(pl);
      }
      if (c.kind) {
        var kc = { bug: "#b42318", idea: "#b54708", question: "#1570ef" };
        var kd = el("span");
        kd.title = c.kind;
        kd.style.cssText =
          "flex:none;width:7px;height:7px;border-radius:50%;background:" +
          (kc[c.kind] || "#98a2b3");
        row.appendChild(kd);
      }
      var cc = el("span", "c");
      cc.textContent = c.content;
      var tm = el("span");
      tm.textContent = ago(c.createdAt);
      tm.style.cssText =
        "flex:none;font:600 9px -apple-system,system-ui,sans-serif;" +
        "color:#98a2b3";
      var ss = el("span", "s");
      ss.textContent = c.status === "resolved" ? "done" : "open";
      row.appendChild(cc);
      if (hasNewReplies(c)) {
        var nd = el("span");
        nd.title = "New reply";
        nd.style.cssText =
          "flex:none;width:7px;height:7px;border-radius:50%;background:#f79009";
        row.appendChild(nd);
      }
      row.appendChild(tm);
      row.appendChild(ss);
      function rowHLClear() {
        if (S.listHL) { S.listHL.remove(); S.listHL = null; }
      }
      row.addEventListener("mouseenter", function () {
        rowHLClear();
        var t = resolveEl(c.anchor);
        if (!t || !t.getBoundingClientRect) return;
        var r = t.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var h = el("div", "fb-hlp");
        h.style.left = r.left + "px"; h.style.top = r.top + "px";
        h.style.width = r.width + "px"; h.style.height = r.height + "px";
        root.appendChild(h); S.listHL = h;
      });
      row.addEventListener("mouseleave", rowHLClear);
      row.onclick = function () {
        rowHLClear();
        var samePage = c.pagePath === here;
        var t = samePage ? resolveEl(c.anchor) : null;
        if (t && t.scrollIntoView) {
          t.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        setTimeout(function () {
          openThread(c, window.innerWidth / 2 - 160,
            Math.max(20, window.innerHeight / 2 - 180));
        }, t ? 320 : 0);
      };
      plist.appendChild(row);
    });
    var cp = el("button");
    cp.textContent = "\\u2398 Copy " + list.length + " as text";
    cp.style.cssText =
      "width:100%;margin-top:6px;background:none;border:1px dashed #d0d5dd;" +
      "color:#667085;border-radius:8px;padding:7px;font:600 11px " +
      "-apple-system,system-ui,sans-serif;cursor:pointer";
    cp.onclick = function () {
      var txt = list
        .map(function (c, idx) {
          return (
            "#" + (idx + 1) +
            " [" + (c.kind || "note") + "] (" + c.status + ") " +
            c.content + "  \\u2014 " + c.pagePath
          );
        })
        .join("\\n");
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(
          function () { fbToast("Copied " + list.length + " comments"); },
          function () { fbToast("Copy failed", true); }
        );
      } else {
        fbToast("Clipboard unavailable", true);
      }
    };
    plist.appendChild(cp);
    plist.scrollTop = keepScroll;
  }

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
    if (S.listHL) { S.listHL.remove(); S.listHL = null; }
    if (S.cmpHL) { S.cmpHL.remove(); S.cmpHL = null; }
    if (S.bd) { S.bd.remove(); S.bd = null; }
    if (S.card) { S.card.remove(); S.card = null; }
    if (S.cmp) { S.cmp.remove(); S.cmp = null; }
    if (S.hl) { S.hl.remove(); S.hl = null; }
    if (S.hlLab) { S.hlLab.remove(); S.hlLab = null; }
    if (S.cap) { S.cap.remove(); S.cap = null; }
    if (S.shotURL) { try { URL.revokeObjectURL(S.shotURL); } catch (e) {} }
    S.shotBlob = null; S.shotURL = null; S.kind = null; S.pendingAnchor = null;
    S.suppress = false;
  }

  // --- Screenshot ----------------------------------------------------------
  function loadH2C() {
    return new Promise(function (res) {
      if (window.html2canvas) { res(window.html2canvas); return; }
      var srcs = [
        "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
        "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js"
      ];
      var done = false;
      function finish(v) { if (!done) { done = true; res(v); } }
      function load(idx) {
        if (done) return;
        if (idx >= srcs.length) { finish(null); return; }
        var s = document.createElement("script");
        s.src = srcs[idx];
        s.onload = function () {
          if (window.html2canvas) finish(window.html2canvas);
          else load(idx + 1);
        };
        s.onerror = function () { load(idx + 1); };
        document.head.appendChild(s);
      }
      load(0);
      setTimeout(function () {
        finish(window.html2canvas || null);
      }, 8000);
    });
  }
  function shoot(opts) {
    // Never let a hung html2canvas leave the composer stuck "Capturing…".
    var timeout = new Promise(function (r) {
      setTimeout(function () { r(null); }, 12000);
    });
    return Promise.race([timeout, shootInner(opts)]);
  }
  function shootInner(opts) {
    return loadH2C().then(function (h2c) {
      if (!h2c) return null;
      var node = opts.el || document.body;
      var o = {
        logging: false,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 6000,
        proxy: BASE + "/feedback/img?token=" + encodeURIComponent(TOKEN),
        scale: Math.min(2, window.devicePixelRatio || 1),
        backgroundColor: "#ffffff",
        ignoreElements: function (n) {
          return n && n.id === "bo-feedback-host";
        }
      };
      if (opts.rect) {
        o.x = opts.rect.x; o.y = opts.rect.y;
        o.width = opts.rect.w; o.height = opts.rect.h;
        o.windowWidth = document.documentElement.scrollWidth;
        o.windowHeight = document.documentElement.scrollHeight;
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
    // No separate pending pin: the composer's own teardrop dot marks the
    // spot (plus the dashed element highlight). Avoids a double marker.
    S.pendingAnchor = anchor;
    // Idempotency key for this composer session (stable across retries).
    var clientKey = "ck_" + Date.now() + "_" +
      Math.random().toString(36).slice(2, 10);
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
      try { sessionStorage.setItem("bo_fb_draft", inp.value); } catch (e) {}
    });
    // Restore an unsent draft so clients never lose typed feedback.
    try {
      var draft = sessionStorage.getItem("bo_fb_draft");
      if (draft) {
        inp.value = draft;
        snd.disabled = !draft.trim();
        box.classList.add("open");
        setTimeout(function () {
          inp.style.height = "auto";
          inp.style.height = Math.min(120, inp.scrollHeight) + "px";
        }, 30);
      }
    } catch (e) {}

    // Capture screenshot in the background, with a clear status.
    var shotOpts = anchor._shot || { el: resolveEl(anchor) || document.body };
    var note = el("div");
    note.style.cssText =
      "color:#667085;font:500 11px -apple-system,system-ui,sans-serif;" +
      "margin-bottom:8px;display:flex;align-items:center;gap:6px";
    note.textContent = "\\u23F3 Capturing screenshot\\u2026";
    thumbWrap.appendChild(note);
    expand();
    function showShot(blob) {
      if (S.cmp !== wrap || !blob) return;
      if (note.parentNode) note.remove();
      if (S.shotURL) { URL.revokeObjectURL(S.shotURL); S.shotURL = null; }
      thumbWrap.innerHTML = "";
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
    }
    shoot(shotOpts).then(function (blob) {
      if (S.cmp !== wrap) return;
      if (!blob) {
        if (note.parentNode) {
          note.textContent =
            "\\uD83D\\uDCF7 Screenshot unavailable \\u2014 comment still sends";
        }
        return;
      }
      // Don't overwrite a screenshot the reviewer pasted in the meantime.
      if (!S.shotBlob) showShot(blob);
    });
    inp.addEventListener("paste", function (e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var pk = 0; pk < items.length; pk++) {
        if (items[pk].type && items[pk].type.indexOf("image/") === 0) {
          var f = items[pk].getAsFile();
          if (f) {
            e.preventDefault();
            showShot(f);
            fbToast("Pasted image attached");
            return;
          }
        }
      }
    });

    function submit() {
      var content = (inp.value || "").trim();
      if (!content) return;
      snd.disabled = true; snd.innerHTML = "\\u22EF";
      uploadShot(S.shotBlob).then(function (sid) {
        return api("/feedback/comments", "POST", {
          projectToken: TOKEN, pageUrl: location.href, pagePath: path(),
          anchor: { selector: anchor.selector, xpath: anchor.xpath, nx: anchor.nx,
            ny: anchor.ny, scrollY: anchor.scrollY,
            elementWidth: anchor.elementWidth, elementHeight: anchor.elementHeight,
            px: anchor.px, py: anchor.py },
          content: content, kind: S.kind || undefined,
          clientKey: clientKey,
          authorName: "", authorEmail: "",
          metadata: uaInfo(), screenshotStorageId: sid
        });
      }).then(function (j) {
        try { sessionStorage.removeItem("bo_fb_draft"); } catch (e) {}
        if (j && j.id) addMine(j.id);
        closeOverlays(); setMode(null); refresh();
        fbToast("Feedback sent \\u2713");
      })["catch"](function (er) {
        snd.innerHTML = "\\u2191";
        fbToast(fbErrMsg(er), true);
        var msg = (er && er.message) || "";
        if (msg.indexOf("rate_limited") !== -1) {
          // Cooldown so the reviewer doesn't keep hitting the limit.
          snd.disabled = true;
          setTimeout(function () { snd.disabled = !inp.value.trim(); }, 8000);
        } else {
          snd.disabled = false;
        }
      });
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
    markSeen(c.id, (c.replies && c.replies.length) || 0);
    addBackdrop();
    // Highlight the element this comment refers to (works even with pins
    // hidden / opened from the list).
    var tEl = resolveEl(c.anchor);
    if (tEl && tEl.getBoundingClientRect) {
      var tr = tEl.getBoundingClientRect();
      if (tr.width && tr.height) {
        var thl = el("div", "fb-hlp pulse");
        thl.style.left = tr.left + "px"; thl.style.top = tr.top + "px";
        thl.style.width = tr.width + "px"; thl.style.height = tr.height + "px";
        root.appendChild(thl); S.cmpHL = thl;
      }
    }
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
    function msg(name, when, text, who) {
      var m = el("div", "fb-msg");
      m.innerHTML = "<div><span class=\\"who\\"></span><span class=\\"tm\\"></span></div><p></p>";
      m.querySelector(".who").textContent = name;
      if (who === "owner" || who === "client") {
        var tag = el("span");
        tag.textContent = who === "owner" ? "Agency" : "Team";
        tag.style.cssText =
          "margin-left:6px;font:700 9px -apple-system,system-ui,sans-serif;" +
          "text-transform:uppercase;letter-spacing:.03em;padding:2px 5px;" +
          "border-radius:5px;background:rgba(21,112,239,.12);color:" + BRAND;
        m.querySelector(".who").appendChild(tag);
      }
      m.querySelector(".tm").textContent = ago(when);
      m.querySelector("p").textContent = text;
      return m;
    }
    body.appendChild(msg(c.authorName, c.createdAt, c.content, c.authorType));
    if (c.screenshotUrl) {
      var sw = el("div");
      sw.style.cssText = "padding:0 14px 12px";
      var sa = el("a");
      sa.href = c.screenshotUrl;
      sa.target = "_blank"; sa.rel = "noreferrer";
      sa.style.cssText = "display:block";
      var si = el("img");
      si.src = c.screenshotUrl;
      si.alt = "Captured context";
      si.style.cssText =
        "width:100%;max-height:160px;object-fit:cover;border-radius:8px;" +
        "border:1px solid #e4e7ec";
      sa.appendChild(si); sw.appendChild(sa); body.appendChild(sw);
    }
    (c.replies || []).forEach(function (r) {
      body.appendChild(msg(r.authorName, r.createdAt, r.content, r.authorType));
    });
    card.appendChild(body);
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
    if (isMine(c.id)) {
      var del = el("button");
      del.textContent = "Delete my comment";
      del.style.cssText =
        "background:none;border:none;color:#b42318;font:600 11px " +
        "-apple-system,system-ui,sans-serif;cursor:pointer;display:block;" +
        "margin:0 auto 12px";
      del.onclick = function () {
        if (!window.confirm("Delete this comment? This cannot be undone.")) {
          return;
        }
        api("/feedback/delete", "POST", {
          projectToken: TOKEN, commentId: c.id
        }).then(function () {
          closeOverlays(); refresh(); fbToast("Comment deleted");
        })["catch"](function (er) { fbToast(fbErrMsg(er), true); });
      };
      card.appendChild(del);
    }
    root.appendChild(card);
    S.card = card;

    rb.onclick = function () {
      var t = (ri.value || "").trim(); if (!t) return;
      rb.disabled = true;
      api("/feedback/replies", "POST", {
        projectToken: TOKEN, commentId: c.id, content: t,
        authorName: "", authorEmail: ""
      }).then(function () {
        // Keep the thread open — append inline so context isn't lost.
        body.appendChild(msg("You", Date.now(), t, "guest"));
        body.scrollTop = body.scrollHeight;
        ri.value = ""; rb.disabled = false;
        fbToast("Reply sent \\u2713");
        refresh();
      })["catch"](function (er) {
        rb.disabled = false;
        fbToast(fbErrMsg(er), true);
      });
    };
    ri.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); rb.onclick(); }
    });
    resB.onclick = function () {
      var next = c.status === "open" ? "resolved" : "open";
      resB.disabled = true;
      api("/feedback/resolve", "POST", {
        projectToken: TOKEN, commentId: c.id, status: next
      }).then(function () {
        // Update in place — keep the thread open for continued context.
        c.status = next;
        resB.disabled = false;
        resB.textContent = next === "open" ? "Mark resolved" : "Reopen";
        stt.textContent = next;
        stt.style.background =
          next === "open" ? "rgba(21,112,239,.12)" : "#e7f6ec";
        fbToast(next === "resolved" ? "Marked resolved" : "Reopened");
        refresh();
      })["catch"](function (er) {
        resB.disabled = false;
        fbToast(fbErrMsg(er), true);
      });
    };
  }

  // --- Pins (render + drag) ------------------------------------------------
  function pinXY(c) {
    var a = c.anchor || {};
    // Absolute page coords win: pin is fixed to the spot you clicked and
    // does not move when content/images reflow the layout.
    if (typeof a.px === "number" && typeof a.py === "number") {
      return {
        x: a.px - (window.scrollX || 0),
        y: a.py - (window.scrollY || 0)
      };
    }
    var t = resolveEl(a), x, y;
    if (t) {
      var r = t.getBoundingClientRect();
      x = r.left + (a.nx == null ? 0.5 : a.nx) * r.width;
      y = r.top + (a.ny == null ? 0.5 : a.ny) * r.height;
    } else {
      x = 24; y = (a.scrollY || 0) - (window.scrollY || 0) + 90;
    }
    return { x: x, y: y };
  }
  function renderPins() {
    if (S.dragging || S.suppress) return;
    clearHover();
    pinLayer.innerHTML = "";
    if (pstate.hidePins) return;
    var placed = [];
    var nmap = numberMap();
    S.comments.forEach(function (c, i) {
      if (c.status === "resolved" && !pstate.showResolved) return;
      var p = pinXY(c);
      if (p.y < -50 || p.y > window.innerHeight + 50) return;
      // Fan out near-overlapping pins so each stays readable & clickable.
      var px = p.x, py = p.y, guard = 0;
      while (guard < 12) {
        var hit = false;
        for (var q = 0; q < placed.length; q++) {
          if (Math.abs(placed[q].x - px) < 22 &&
              Math.abs(placed[q].y - py) < 22) { hit = true; break; }
        }
        if (!hit) break;
        px += 18; py -= 6; guard++;
      }
      placed.push({ x: px, y: py });
      var pin = el("div", "fb-pin" +
        (c.status === "resolved" ? " res" : "") +
        (hasNewReplies(c) ? " new" : ""));
      var num = nmap[c.id] || i + 1;
      pin.textContent = String(num);
      // Keyboard/AT access: focusable, Enter/Space opens the thread.
      pin.setAttribute("role", "button");
      pin.setAttribute("tabindex", "0");
      pin.setAttribute(
        "aria-label",
        "Feedback " + num + " (" + c.status + "): " +
          (c.content || "").slice(0, 80),
      );
      pin.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          var r = pin.getBoundingClientRect();
          openThread(c, r.left, r.top);
        }
      });
      // Place so the teardrop tip (local ~2,28) sits exactly on the point.
      pin.style.left = (px - 2) + "px";
      pin.style.top = (py - 28) + "px";
      pin.addEventListener("mouseenter", function () {
        if (!S.dragging) showHover(c, pin);
      });
      pin.addEventListener("mouseleave", clearHover);
      attachDrag(pin, c);
      pinLayer.appendChild(pin);
    });
  }
  // KISS drag: the teardrop tip tracks the cursor exactly; on drop we keep
  // the pin where it is (no re-render flash) and just persist the new spot.
  function attachDrag(pin, c) {
    pin.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      var sx = e.clientX, sy = e.clientY, moved = false;
      pin.setPointerCapture(e.pointerId);
      pin.classList.add("drag"); S.dragging = true;
      function mv(ev) {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) {
          moved = true;
        }
        pin.style.left = (ev.clientX - 2) + "px";
        pin.style.top = (ev.clientY - 28) + "px";
      }
      function up(ev) {
        pin.removeEventListener("pointermove", mv);
        pin.removeEventListener("pointerup", up);
        pin.classList.remove("drag"); S.dragging = false;
        if (!moved) { openThread(c, ev.clientX, ev.clientY); return; }
        var x = clamp(ev.clientX, 0, window.innerWidth - 1);
        var y = clamp(ev.clientY, 0, window.innerHeight - 1);
        pin.style.display = "none";
        var tgt = document.elementFromPoint(x, y) || document.body;
        pin.style.display = "";
        var a = makeAnchor(x, y, tgt);
        var idx = S.comments.indexOf(c);
        if (idx >= 0) S.comments[idx].anchor = a;
        // Pin is already at the drop point — leave it; next poll reconciles.
        api("/feedback/move", "POST", {
          projectToken: TOKEN, commentId: c.id,
          selector: a.selector, xpath: a.xpath, nx: a.nx, ny: a.ny,
          scrollY: a.scrollY, elementWidth: a.elementWidth,
          elementHeight: a.elementHeight, px: a.px, py: a.py, anchor: a
        })["catch"](function () { refresh(); });
      }
      pin.addEventListener("pointermove", mv);
      pin.addEventListener("pointerup", up);
    });
  }

  function updateFab() {
    var open = 0;
    S.comments.forEach(function (c) { if (c.status !== "resolved") open++; });
    pct.textContent = open > 99 ? "99+" : String(open);
    pct.style.display = open > 0 ? "" : "none";
  }
  function ensureMounted() {
    // Dynamic themes (Hydrogen/SPA section re-renders) can detach our host;
    // re-attach so the widget never silently disappears.
    if (!document.documentElement.contains(host)) {
      document.documentElement.appendChild(host);
    }
  }
  function refresh() {
    ensureMounted();
    if (S.dragging || document.hidden) return;
    api("/feedback/comments?token=" + encodeURIComponent(TOKEN) +
        "&pagePath=" + encodeURIComponent(path()), "GET")
      .then(function (j) {
        S.comments = (j && j.comments) || [];
        var st = j && j.project && j.project.status;
        setPaused(st && st !== "active");
        renderPins(); updateFab(); renderList();
      })
      ["catch"](function () {});
  }
  function refreshSite() {
    if (document.hidden) return;
    api("/feedback/comments?token=" + encodeURIComponent(TOKEN), "GET")
      .then(function (j) {
        var all = (j && j.comments) || [];
        S.allComments = all;
        var here = path();
        var other = 0;
        all.forEach(function (c) {
          if (c.status !== "resolved" && c.pagePath !== here) other++;
        });
        if (other > 0) {
          psite.style.display = "";
          psite.textContent =
            "\\uD83C\\uDF10 " + other + " open on other pages";
        } else {
          psite.style.display = "none";
        }
        if (pstate.allPages) renderList();
      })["catch"](function () {});
  }

  // --- Selection modes -----------------------------------------------------
  function syncPanel() {
    pEl.className = "fb-pbtn" + (S.mode === "element" ? " on" : "");
    pReg.className = "fb-pbtn" + (S.mode === "region" ? " on" : "");
    pCancel.style.display = S.mode ? "" : "none";
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
        if (!t || t === host) {
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
      if (!t || t === host) return;
      e.preventDefault(); e.stopPropagation();
      document.removeEventListener("mousemove", move, true);
      document.removeEventListener("click", click, true);
      hl.remove(); lab.remove(); S.hl = null; S.hlLab = null;
      var a = makeAnchor(e.clientX, e.clientY, t);
      // Capture the actual visible page cropped to the selected element's
      // box (WYSIWYG) instead of an isolated re-render of the node.
      var er = t.getBoundingClientRect();
      a._shot = { rect: {
        x: er.left + (window.scrollX || 0),
        y: er.top + (window.scrollY || 0),
        w: Math.max(1, er.width), h: Math.max(1, er.height)
      } };
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
    if (m && S.coach) dismissCoach();
    S.mode = m;
    if (!m) {
      S.suppress = false;
      syncPanel();
      renderPins();
      return;
    }
    syncPanel();
    if (m === "element") startElement();
    else startRegion();
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && (S.mode || S.card || S.cmp)) {
      closeOverlays(); setMode(null); return;
    }
    var tag = (e.target && e.target.tagName) || "";
    var typing = tag === "INPUT" || tag === "TEXTAREA" ||
      (e.target && e.target.isContentEditable);
    if (typing || S.mode || S.card || S.cmp) return;
    var k = e.key.toLowerCase();
    if (k === "c") setMode("element");
    else if (k === "r") setMode("region");
    else if (k === "g") pGen.onclick();
  });
  window.addEventListener("scroll", function () { renderPins(); }, { passive: true });
  window.addEventListener("resize", function () {
    renderPins();
    // Keep a moved panel reachable if the viewport shrank/rotated.
    if (panel.style.left) {
      var r = panel.getBoundingClientRect();
      var nx = clamp(r.left, 0, window.innerWidth - r.width);
      var ny = clamp(r.top, 0, window.innerHeight - 40);
      panel.style.left = nx + "px"; panel.style.top = ny + "px";
      if (typeof pstate.x === "number") {
        pstate.x = nx; pstate.y = ny; savePanelState(pstate);
      }
    }
  });
  window.addEventListener("focus", function () { refresh(); refreshSite(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") { refresh(); refreshSite(); }
  });
  refresh();
  refreshSite();
  setInterval(refresh, 10000);
  setInterval(refreshSite, 60000);
  setInterval(ensureMounted, 3000);
})();`;
