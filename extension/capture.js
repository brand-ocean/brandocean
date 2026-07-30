// Shared element-capture logic, exposed on window.__boCapture so multiple
// injected scripts (live overlay, etc.) reuse the exact same anchor +
// elementContext shape the Convex backend stores. Best-effort throughout.
(function () {
  if (window.__boCapture) return;

  function cssEsc(s) {
    return String(s).replace(/["\\\]]/g, "\\$&");
  }
  function cssPath(el) {
    if (!el || el.nodeType !== 1) return "body";
    var parts = [],
      node = el;
    while (node && node.nodeType === 1 && node !== document.body && parts.length < 12) {
      var seg = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(seg + "#" + cssEsc(node.id));
        break;
      }
      var i = 1,
        sib = node;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === node.tagName) i++;
      parts.unshift(seg + ":nth-of-type(" + i + ")");
      node = node.parentElement;
    }
    return (node === document.body ? "body > " : "") + parts.join(" > ");
  }
  function xPath(el) {
    if (!el || el.nodeType !== 1) return "/html/body";
    var parts = [],
      node = el;
    while (node && node.nodeType === 1) {
      var i = 1,
        sib = node;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === node.tagName) i++;
      parts.unshift(node.tagName.toLowerCase() + "[" + i + "]");
      if (node === document.documentElement) break;
      node = node.parentElement;
    }
    return "/" + parts.join("/");
  }
  function uaInfo() {
    var ua = navigator.userAgent,
      b = "Unknown",
      o = "Unknown";
    if (/Edg\//.test(ua)) b = "Edge";
    else if (/Chrome\//.test(ua)) b = "Chrome";
    else if (/Safari\//.test(ua)) b = "Safari";
    else if (/Firefox\//.test(ua)) b = "Firefox";
    if (/Windows/.test(ua)) o = "Windows";
    else if (/Mac OS X/.test(ua)) o = "macOS";
    else if (/Android/.test(ua)) o = "Android";
    else if (/iPhone|iPad/.test(ua)) o = "iOS";
    else if (/Linux/.test(ua)) o = "Linux";
    return {
      userAgent: ua,
      browser: b,
      os: o,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  }
  function fiberOf(node) {
    try {
      var keys = Object.keys(node);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (k.indexOf("__reactFiber$") === 0 || k.indexOf("__reactInternalInstance$") === 0)
          return node[k];
      }
    } catch (e) {}
    return null;
  }
  function elementCtx(target) {
    var out = {};
    try {
      if (!target || target.nodeType !== 1) return out;
      var txt = (target.innerText || target.textContent || "").trim();
      if (txt) out.text = txt.slice(0, 300);
      out.tag = (target.tagName || "").toLowerCase();
      if (target.id) out.id = String(target.id);
      if (target.classList && target.classList.length)
        out.classes = Array.prototype.slice.call(target.classList, 0, 30);
      var keep = ["role", "href", "alt", "name", "type", "title", "placeholder", "value"];
      var attrs = [];
      if (target.attributes)
        for (var ai = 0; ai < target.attributes.length && attrs.length < 12; ai++) {
          var at = target.attributes[ai],
            nm = at.name || "";
          if (nm.indexOf("data-") === 0 || nm.indexOf("aria-") === 0 || keep.indexOf(nm) !== -1)
            attrs.push({ name: nm.slice(0, 80), value: String(at.value || "").slice(0, 300) });
        }
      if (attrs.length) out.attributes = attrs;
      try {
        var cs = getComputedStyle(target);
        out.styles = {
          fontFamily: cs.fontFamily,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          color: cs.color,
          lineHeight: cs.lineHeight,
          letterSpacing: cs.letterSpacing,
          textTransform: cs.textTransform,
          display: cs.display,
        };
      } catch (e) {}
      try {
        var f = fiberOf(target),
          names = [],
          src = null,
          guard = 0;
        while (f && guard++ < 60) {
          var ty = f.type;
          if (ty && typeof ty !== "string") {
            var cn = ty.displayName || ty.name;
            if (cn && names.indexOf(cn) === -1 && names.length < 8) names.push(cn);
          }
          if (!src && f._debugSource && f._debugSource.fileName) {
            src = {
              fileName: String(f._debugSource.fileName).slice(0, 400),
              lineNumber: f._debugSource.lineNumber || 0,
            };
            if (typeof f._debugSource.columnNumber === "number")
              src.columnNumber = f._debugSource.columnNumber;
          }
          f = f["return"];
        }
        if (names.length) out.componentPath = names;
        if (src) out.source = src;
      } catch (e) {}
      try {
        var lm = target.closest
          ? target.closest("section,header,footer,nav,main,article,[id]")
          : null;
        if (lm) {
          var land = { selector: cssPath(lm) };
          var hd = lm.querySelector ? lm.querySelector("h1,h2,h3,h4,[role=heading]") : null;
          var ht = hd ? (hd.innerText || hd.textContent || "").trim() : "";
          if (ht) land.heading = ht.slice(0, 200);
          out.landmark = land;
        }
      } catch (e) {}
    } catch (e) {}
    return out;
  }
  function makeAnchor(clientX, clientY, target) {
    var r = target.getBoundingClientRect();
    var w = r.width || 1,
      h = r.height || 1;
    return {
      selector: cssPath(target),
      xpath: xPath(target),
      nx: Math.min(1, Math.max(0, (clientX - r.left) / w)),
      ny: Math.min(1, Math.max(0, (clientY - r.top) / h)),
      scrollY: window.scrollY || 0,
      elementWidth: w,
      elementHeight: h,
      px: clientX + (window.scrollX || 0),
      py: clientY + (window.scrollY || 0),
    };
  }

  window.__boCapture = { cssPath: cssPath, xPath: xPath, uaInfo: uaInfo, elementCtx: elementCtx, makeAnchor: makeAnchor };
})();
