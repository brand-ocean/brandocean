// Brandocean Feedback — capture script, injected ONLY into the framed site
// inside the review canvas (never into normal browsing). It captures the exact
// clicked element (anchor + rich elementContext, same shape the Convex backend
// expects) and reports geometry so the canvas can overlay pins. It talks to the
// parent canvas via window.postMessage; it never touches the network itself.
(function () {
  if (window.__BO_FB_CAPTURE__) return;
  window.__BO_FB_CAPTURE__ = true;

  var commenting = false;
  var pins = []; // [{ id, selector, nx, ny, px, py }]
  var hoverEl = null;

  function send(msg) {
    try {
      window.parent.postMessage(Object.assign({ __bo: true }, msg), "*");
    } catch (e) {}
  }

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
      while ((sib = sib.previousElementSibling))
        if (sib.tagName === node.tagName) i++;
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
      while ((sib = sib.previousElementSibling))
        if (sib.tagName === node.tagName) i++;
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

  function makeAnchor(clientX, clientY, target, region) {
    var r = target.getBoundingClientRect();
    var w = r.width || 1,
      h = r.height || 1;
    var a = {
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
    // region: rectangle in document coords when the reviewer dragged a box.
    if (region) a.region = region;
    return a;
  }

  // --- Pin geometry: report each tracked pin's position in iframe-viewport
  //     coords so the canvas can lay markers over the iframe. ----------------
  var OFFSCREEN = { x: -9999, y: -9999 };
  function rectFor(p) {
    // Region pins: a rectangle in document coords. Place the marker at the box's
    // top-left and report its size so the canvas can draw the outline. Visible
    // when the box intersects the viewport at all.
    if (p.region && typeof p.region.x === "number") {
      var rx = p.region.x - (window.scrollX || 0);
      var ry = p.region.y - (window.scrollY || 0);
      var rw = p.region.w || 0,
        rh = p.region.h || 0;
      var visible =
        rx + rw > 0 && ry + rh > 0 && rx < window.innerWidth && ry < window.innerHeight;
      if (!visible) return { id: p.id, x: OFFSCREEN.x, y: OFFSCREEN.y };
      return { id: p.id, x: rx, y: ry, w: rw, h: rh };
    }
    var el = null;
    try {
      if (p.selector) el = document.querySelector(p.selector);
    } catch (e) {}
    var x, y;
    if (el) {
      // Anchor is inside a dropdown/modal/menu that's currently closed: the node
      // is still in the DOM but not rendered (display:none, an ancestor hidden,
      // or detached). getClientRects() is empty in all those cases — hide the pin
      // rather than pinning it to the (0,0) corner.
      if (el.getClientRects().length === 0)
        return { id: p.id, x: OFFSCREEN.x, y: OFFSCREEN.y };
      var r = el.getBoundingClientRect();
      x = r.left + (p.nx || 0.5) * r.width;
      y = r.top + (p.ny || 0.5) * r.height;
    } else if (p.selector) {
      // Had a real element anchor but it's gone now (e.g. a dropdown/modal that
      // was removed from the DOM on close). Don't float the pin at stale page
      // coords — hide it until the element comes back.
      return { id: p.id, x: OFFSCREEN.x, y: OFFSCREEN.y };
    } else if (typeof p.px === "number") {
      // Legacy pins with no selector: fall back to absolute doc coords.
      x = p.px - (window.scrollX || 0);
      y = p.py - (window.scrollY || 0);
    } else {
      return { id: p.id, x: OFFSCREEN.x, y: OFFSCREEN.y };
    }
    // Hide pins whose anchor sits outside the visible viewport, so they don't
    // float in the canvas margins before the element scrolls into view.
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight)
      return { id: p.id, x: OFFSCREEN.x, y: OFFSCREEN.y };
    return { id: p.id, x: x, y: y };
  }

  // Briefly highlight an element when its comment is opened from the sidebar.
  function flashFocus(el) {
    try {
      el.classList.add("bo-fb-focus");
      setTimeout(function () {
        el.classList.remove("bo-fb-focus");
      }, 1700);
    } catch (e) {}
  }
  function emitRects() {
    send({ type: "bo:rects", rects: pins.map(rectFor) });
  }

  // --- Click an element OR drag a region while commenting -------------------
  // A plain click anchors the comment to the element under the cursor. A drag
  // (past a small threshold) draws a rectangle and anchors the comment to that
  // region instead. We pick on mouseup so the same gesture covers both.
  var DRAG_MIN = 5; // px before a press counts as a region drag
  var drag = null; // { sx, sy, moved }
  var regionBox = null;

  function clearHover() {
    if (hoverEl) {
      hoverEl.classList.remove("bo-fb-hl");
      hoverEl = null;
    }
  }
  function ensureRegionBox() {
    if (regionBox) return regionBox;
    var b = document.createElement("div");
    b.style.cssText =
      "position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #1552EE;" +
      "background:rgba(21,82,238,0.12);border-radius:4px;display:none;";
    (document.body || document.documentElement).appendChild(b);
    regionBox = b;
    return b;
  }
  function paintRegionBox(left, top, w, h) {
    var b = ensureRegionBox();
    b.style.left = left + "px";
    b.style.top = top + "px";
    b.style.width = w + "px";
    b.style.height = h + "px";
    b.style.display = "block";
  }
  function hideRegionBox() {
    if (regionBox) regionBox.style.display = "none";
  }

  function onDown(e) {
    if (!commenting || e.button !== 0) return;
    e.preventDefault();
    drag = { sx: e.clientX, sy: e.clientY, moved: false };
  }
  function onMove(e) {
    if (!commenting) return;
    if (drag) {
      var dx = e.clientX - drag.sx,
        dy = e.clientY - drag.sy;
      if (!drag.moved && Math.abs(dx) < DRAG_MIN && Math.abs(dy) < DRAG_MIN) return;
      drag.moved = true;
      clearHover();
      paintRegionBox(
        Math.min(drag.sx, e.clientX),
        Math.min(drag.sy, e.clientY),
        Math.abs(dx),
        Math.abs(dy),
      );
      return;
    }
    // Hover highlight when not dragging.
    var el = e.target;
    if (el === hoverEl) return;
    if (hoverEl) hoverEl.classList.remove("bo-fb-hl");
    hoverEl = el && el.nodeType === 1 ? el : null;
    if (hoverEl) hoverEl.classList.add("bo-fb-hl");
  }
  function onUp(e) {
    if (!commenting || !drag) return;
    var wasDrag = drag.moved;
    var sx = drag.sx,
      sy = drag.sy;
    drag = null;
    if (wasDrag) {
      var left = Math.min(sx, e.clientX),
        top = Math.min(sy, e.clientY),
        w = Math.abs(e.clientX - sx),
        h = Math.abs(e.clientY - sy);
      hideRegionBox();
      var cx = left + w / 2,
        cy = top + h / 2;
      var target = document.elementFromPoint(cx, cy) || document.body;
      if (!target || target.nodeType !== 1) target = document.body;
      var region = {
        x: left + (window.scrollX || 0),
        y: top + (window.scrollY || 0),
        w: w,
        h: h,
      };
      send({
        type: "bo:pick",
        anchor: makeAnchor(cx, cy, target, region),
        elementContext: elementCtx(target),
        metadata: uaInfo(),
        point: { x: cx, y: cy },
      });
    } else {
      // Plain click → anchor to the element under the cursor.
      var t = e.target;
      if (!t || t.nodeType !== 1) return;
      send({
        type: "bo:pick",
        anchor: makeAnchor(e.clientX, e.clientY, t),
        elementContext: elementCtx(t),
        metadata: uaInfo(),
        point: { x: e.clientX, y: e.clientY },
      });
    }
  }
  // Block navigation/selection clicks while commenting; picking happens on mouseup.
  function onClick(e) {
    if (!commenting) return;
    e.preventDefault();
    e.stopPropagation();
  }

  // Forward the "C" hotkey to the canvas so it toggles comment mode even when
  // focus is inside the framed page (ignored while typing in a field).
  window.addEventListener(
    "keydown",
    function (e) {
      if (e.key !== "c" && e.key !== "C") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target,
        tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
      send({ type: "bo:hotkey", key: "c" });
    },
    true,
  );

  window.addEventListener("mousedown", onDown, true);
  window.addEventListener("mousemove", onMove, true);
  window.addEventListener("mouseup", onUp, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("scroll", emitRects, true);
  window.addEventListener("resize", emitRects, true);

  // Reposition when the DOM changes (a dropdown/menu/modal opening or closing)
  // so pins anchored inside it show/hide with the element — not just on scroll.
  // Coalesce bursts into one emit per frame; getBoundingClientRect is layout-heavy.
  var emitRaf = 0;
  function scheduleEmit() {
    if (emitRaf) return;
    emitRaf = requestAnimationFrame(function () {
      emitRaf = 0;
      emitRects();
    });
  }
  try {
    new MutationObserver(scheduleEmit).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "open", "popover"],
    });
  } catch (e) {}

  // --- Messages from the canvas --------------------------------------------
  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || !d.__bo || e.source !== window.parent) return;
    if (d.type === "bo:set-mode") {
      commenting = !!d.commenting;
      document.documentElement.classList.toggle("bo-fb-commenting", commenting);
      if (!commenting) {
        drag = null;
        hideRegionBox();
        clearHover();
      }
    } else if (d.type === "bo:track") {
      pins = Array.isArray(d.pins) ? d.pins : [];
      emitRects();
    } else if (d.type === "bo:locate") {
      emitRects();
    } else if (d.type === "bo:focus") {
      // Open from the sidebar: scroll the anchored element into view and flash
      // it, then re-emit geometry so the pin lands on the now-visible element.
      var fel = null;
      try {
        if (d.selector) fel = document.querySelector(d.selector);
      } catch (e) {}
      if (fel) {
        try {
          fel.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        } catch (e) {
          fel.scrollIntoView();
        }
        flashFocus(fel);
      } else if (typeof d.py === "number") {
        var top = Math.max(0, d.py - window.innerHeight / 2);
        try {
          window.scrollTo({ top: top, behavior: "smooth" });
        } catch (e) {
          window.scrollTo(0, top);
        }
      }
      // Let the smooth scroll settle, then refresh pin positions.
      setTimeout(emitRects, 400);
      setTimeout(emitRects, 800);
    } else if (d.type === "bo:reanchor") {
      // Re-anchor a dragged pin to the element under the drop point.
      var el = null;
      try {
        el = document.elementFromPoint(d.x, d.y);
      } catch (e) {}
      if (!el || el.nodeType !== 1) el = document.body;
      send({ type: "bo:reanchored", id: d.id, anchor: makeAnchor(d.x, d.y, el) });
    }
  });

  // Announce the framed page so the canvas knows the real URL/path to comment on.
  send({
    type: "bo:ready",
    href: location.href,
    path: location.pathname,
    title: document.title,
  });
})();
