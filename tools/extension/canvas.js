// Brandocean Feedback — review canvas controller.
// Frames any site at a chosen device width, captures pinned comments, and posts
// them to the existing Convex /feedback API (token-gated, no auth needed for v1).

const DEFAULTS = {
  base: "https://rightful-bulldog-338.eu-west-1.convex.site",
  // Prefilled with the PIED A TERRE project token so the feedback flow is
  // testable out of the box. Change it in the popup for another project.
  token: "4Ip1NvDYN5vRMiY9dCcM7N3v8vX2Pn2eR8Ureeqd",
  reviewerName: "Reviewer",
  reviewerEmail: "",
  // Developer mode (set in the popup): local Convex base, forced per-host
  // tokens, verbose logging.
  dev: false,
  devBase: "",
  devHostTokens: "",
  devDebug: false,
};

const DEVICES = {
  desktop: { w: 1440, h: 900 },
  tablet: { w: 834, h: 1112 },
  mobile: { w: 390, h: 844 },
};

const el = (id) => document.getElementById(id);
const frame = el("frame");
const frameWrap = el("frameWrap");
const overlay = el("overlay");
const stage = el("stage");

const S = {
  cfg: { ...DEFAULTS },
  base: null, // effective API base, picked at resolve time (see apiBase)
  localHost: null, // "localhost:3000"-style host under review, when local
  localHostMap: {}, // saved host -> { token, name } bindings (storage.sync)
  pickerActive: false, // project picker currently shown in the panel
  tabId: null,
  device: "desktop",
  scale: 1,
  commenting: false,
  href: "",
  path: "/",
  comments: [], // currently-visible (after status filter) — drives list + pins
  fetched: [], // device-scoped set from the server, before status filter
  statusFilter: "open", // "open" | "resolved" | "all"
  // Default to the whole project so the panel never looks empty just because
  // the comments live on another page; pins still only render for the
  // current path + device (see applyFilter).
  scope: "all", // "page" (this path only) | "all" (whole project)
  pending: null, // { anchor, elementContext, metadata, point }
  kind: null,
  resolved: false, // true once a project is matched to the framed host
  pendingFocus: null, // comment id to focus once a cross-page load finishes
};

// --- Config ----------------------------------------------------------------
async function loadConfig() {
  const stored = await chrome.storage.sync.get({ ...DEFAULTS, localHostMap: {} });
  S.localHostMap = stored.localHostMap || {};
  delete stored.localHostMap;
  S.cfg = { ...DEFAULTS, ...stored };
}

// Effective API base. Developer mode can point the canvas at a local Convex
// deployment, but the working base is CHOSEN at resolve time: if the override
// doesn't answer /feedback/resolve-host (e.g. someone typed their website URL
// in there), we fall back to production automatically instead of erroring.
function apiBase() {
  const b = S.base || (S.cfg.dev && S.cfg.devBase ? S.cfg.devBase : S.cfg.base);
  return b.replace(/\/$/, "");
}

// Verbose logging, toggled from the popup's developer section.
function dbgLog() {
  if (S.cfg.devDebug) console.log.apply(console, ["[bo:dev]"].concat([].slice.call(arguments)));
}

function isLocalHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "[::1]" ||
    /^127\./.test(hostname) ||
    /\.(local|test|localhost)$/.test(hostname)
  );
}

// Parse the popup's "host[:port]=token" lines into a lookup map.
function devTokenOverrides() {
  const map = {};
  if (!S.cfg.dev || !S.cfg.devHostTokens) return map;
  S.cfg.devHostTokens.split(/\n+/).forEach((line) => {
    const i = line.indexOf("=");
    if (i < 1) return;
    const host = line.slice(0, i).trim().toLowerCase();
    const token = line.slice(i + 1).trim();
    if (host && token) map[host] = token;
  });
  return map;
}

// --- Project auto-resolve by host ------------------------------------------
// Pick the project registered for the framed host so the panel shows THIS
// site's feedback — not whatever token happens to be saved. Sets S.resolved so
// reads/writes only happen against a host that actually has a project.
// Local hosts (localhost:5173 etc.) resolve too: dev-mode overrides win,
// otherwise the backend matches the host against each project's devHosts.
async function resolveProjectForHost(url) {
  S.resolved = false;
  S.base = null;
  S.localHost = null;
  S.pickerActive = false;
  let host = "";
  let hostname = "";
  try {
    const u = new URL(url);
    hostname = u.hostname;
    // Ports matter locally — two dev servers are two different projects.
    host = isLocalHost(u.hostname) ? u.host : u.hostname;
  } catch (e) {}
  if (!host) return;
  const local = isLocalHost(hostname);
  if (local) S.localHost = host.toLowerCase();

  const overrides = devTokenOverrides();
  const forced = overrides[host.toLowerCase()] || overrides[hostname.toLowerCase()];
  if (forced) {
    S.cfg.token = forced;
    S.resolved = true;
    dbgLog("token override hit for", host);
    toast("Dev override → " + host);
    return;
  }

  // A local host we've matched before — reuse the saved binding, zero setup.
  const saved = local && S.localHostMap[S.localHost];
  if (saved && saved.token) {
    S.cfg.token = saved.token;
    S.resolved = true;
    dbgLog("saved local binding", S.localHost, "→", saved.name);
    toast("Project: " + (saved.name || host));
    return;
  }

  // Try the dev base first (when set), then production. Whichever answers
  // becomes the API base for the whole session, so a bad override never
  // breaks the review flow — it just gets skipped.
  const candidates = [];
  if (S.cfg.dev && S.cfg.devBase) candidates.push(S.cfg.devBase);
  if (!candidates.includes(S.cfg.base)) candidates.push(S.cfg.base);

  for (const base of candidates) {
    let data = null;
    try {
      const res = await fetch(
        base.replace(/\/$/, "") +
          "/feedback/resolve-host?host=" + encodeURIComponent(host),
      );
      if (res.ok) data = await res.json();
      else dbgLog("resolve-host miss on", base, "status:", res.status);
    } catch (e) {
      dbgLog("resolve-host unreachable on", base, e);
    }
    if (data && data.token) {
      S.base = base;
      S.cfg.token = data.token;
      S.resolved = true;
      dbgLog("resolved", host, "→ project:", data.name, "via", base);
      toast("Project: " + (data.name || host));
      return;
    }
  }
  if (local) {
    // Unknown local dev server: don't error — auto-detect from the page
    // title once the frame reports bo:ready (see detectLocalProject).
    toast("Detecting project for " + host + "…");
    return;
  }
  toast("No feedback project registered for " + host, true);
}

// --- Localhost auto-detect ---------------------------------------------------
// Nothing identifies a local dev server, so we match the framed page's
// <title> against the owner's project names ("Pied à Terre — …" → PIED A
// TERRE). A unique match binds silently; otherwise a one-click picker is
// shown in the panel. Bindings persist per host:port in storage.sync.
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function fetchProjects() {
  try {
    const res = await fetch(apiBase() + "/feedback/projects", {
      headers: { "X-Feedback-Token": DEFAULTS.token },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    dbgLog("projects list failed:", e);
    return null;
  }
}

function bindLocalProject(p) {
  S.cfg.token = p.token;
  S.resolved = true;
  S.pickerActive = false;
  S.localHostMap[S.localHost] = { token: p.token, name: p.name };
  chrome.storage.sync.set({ localHostMap: S.localHostMap });
}

async function detectLocalProject(title) {
  const projects = await fetchProjects();
  if (!projects || !projects.length) {
    toast("Couldn't load project list", true);
    return false;
  }
  const t = norm(title);
  const matches = t
    ? projects.filter((p) => norm(p.name) && t.indexOf(norm(p.name)) !== -1)
    : [];
  if (matches.length === 1) {
    bindLocalProject(matches[0]);
    dbgLog("auto-detected", S.localHost, "→", matches[0].name, "from title:", title);
    toast("Detected project: " + matches[0].name);
    return true;
  }
  dbgLog("title match ambiguous (" + matches.length + ") for:", title);
  showProjectPicker(projects);
  return false;
}

function showProjectPicker(projects) {
  S.pickerActive = true;
  el("projectName").textContent = "Which project is " + (S.localHost || "this") + "?";
  const list = el("list");
  list.innerHTML = "";
  projects.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card";
    btn.style.cssText = "display:block;width:100%;text-align:left;cursor:pointer;font:inherit";
    btn.textContent = p.name + (p.shopifyDomain ? " — " + p.shopifyDomain : "");
    btn.addEventListener("click", () => {
      bindLocalProject(p);
      toast("Project: " + p.name);
      loadComments();
    });
    list.appendChild(btn);
  });
}

// --- API (token-gated /feedback) -------------------------------------------
async function api(path, method, body) {
  dbgLog("api", method, path);
  const res = await fetch(apiBase() + path, {
    method,
    headers: {
      "X-Feedback-Token": S.cfg.token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "request_failed");
  return json;
}

// --- Toast -----------------------------------------------------------------
let toastT = null;
function toast(msg, isErr) {
  const t = el("toast");
  t.textContent = msg;
  t.classList.toggle("toast--err", !!isErr);
  t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.hidden = true), 2600);
}

// --- iframe messaging ------------------------------------------------------
function toFrame(msg) {
  if (frame.contentWindow) frame.contentWindow.postMessage({ __bo: true, ...msg }, "*");
}

window.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || !d.__bo || e.source !== frame.contentWindow) return;
  if (d.type === "bo:ready") {
    S.href = d.href || frame.src;
    S.path = d.path || "/";
    el("status").textContent = S.path;
    toFrame({ type: "bo:set-mode", commenting: S.commenting });
    // Unknown local dev server: match the page title to a project first,
    // then load its comments.
    const detect =
      !S.resolved && S.localHost
        ? detectLocalProject(d.title)
        : Promise.resolve(true);
    detect.then(() =>
      loadComments().then(() => {
        if (!S.pendingFocus) return;
        const c = S.fetched.find((x) => x.id === S.pendingFocus);
        S.pendingFocus = null;
        if (c) setTimeout(() => sendFocus(c), 150);
      }),
    );
  } else if (d.type === "bo:pick") {
    openComposer(d);
  } else if (d.type === "bo:rects") {
    positionPins(d.rects || []);
  } else if (d.type === "bo:reanchored") {
    saveMovedPin(d.id, d.anchor);
  } else if (d.type === "bo:hotkey" && d.key === "c") {
    setCommenting(!S.commenting);
  }
});

// --- Load a site -----------------------------------------------------------
async function loadSite(url) {
  if (!/^https?:\/\//i.test(url)) {
    // Bare "localhost:5173" means the local dev server — it has no TLS.
    const bareHost = url.split(/[/?#]/)[0].split(":")[0].toLowerCase();
    url = (isLocalHost(bareHost) ? "http://" : "https://") + url;
  }
  el("urlInput").value = url;
  el("empty").hidden = true;
  // Match the project to this host so the panel shows the right site's feedback.
  await resolveProjectForHost(url);
  // Arm/refresh header-stripping and WAIT for it to be active before the iframe
  // request fires. Otherwise the first navigation can hit X-Frame-Options / CSP
  // frame-ancestors before the strip rule lands → "refused to connect".
  try {
    await chrome.runtime.sendMessage({
      type: "bo:session-start",
      tabId: S.tabId,
      mobile: S.device === "mobile",
    });
  } catch (e) {}
  frame.src = url;
}

// --- Device width ----------------------------------------------------------
function setDevice(device) {
  const wasMobile = S.device === "mobile";
  S.device = device;
  document.querySelectorAll(".seg").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.device === device)),
  );
  const dim = DEVICES[device];
  frame.style.width = dim.w + "px";
  frame.style.height = dim.h + "px";
  relayout();
  const nowMobile = device === "mobile";
  if (wasMobile !== nowMobile) {
    // Mobile UA affects the document request — update the rule, then reload.
    chrome.runtime.sendMessage({ type: "bo:set-mobile", tabId: S.tabId, mobile: nowMobile });
    if (frame.src && frame.src !== "about:blank") {
      const src = frame.src;
      setTimeout(() => (frame.src = src), 120);
    }
  }
  loadComments();
}

function relayout() {
  const dim = DEVICES[S.device];
  const avail = stage.clientWidth - 48;
  S.scale = Math.min(1, avail / dim.w);
  frameWrap.style.zoom = String(S.scale);
}
window.addEventListener("resize", relayout);

// --- Comment mode ----------------------------------------------------------
function setCommenting(on) {
  S.commenting = on;
  el("commentToggle").setAttribute("aria-pressed", String(on));
  toFrame({ type: "bo:set-mode", commenting: on });
  if (!on) closeComposer();
}

// --- Composer --------------------------------------------------------------
function openComposer(pick) {
  S.pending = pick;
  S.kind = null;
  const c = el("composer");
  const text = el("composerText");
  text.value = "";
  document.querySelectorAll(".kind").forEach((k) => k.setAttribute("aria-pressed", "false"));
  const ctx = pick.elementContext || {};
  el("composerCtx").textContent =
    (ctx.tag ? ctx.tag : "") + (ctx.text ? " · " + ctx.text.slice(0, 40) : "");
  // Map the iframe-space click point to screen via the zoomed frame rect.
  const r = frameWrap.getBoundingClientRect();
  let x = r.left + pick.point.x * S.scale + 14;
  let y = r.top + pick.point.y * S.scale + 14;
  x = Math.min(x, window.innerWidth - 320);
  y = Math.min(y, window.innerHeight - 200);
  c.style.left = Math.max(8, x) + "px";
  c.style.top = Math.max(8, y) + "px";
  c.hidden = false;
  text.focus();
}
function closeComposer() {
  el("composer").hidden = true;
  S.pending = null;
}

async function sendComment() {
  if (!S.pending) return;
  if (!S.resolved) {
    toast("No project for this host — can't post", true);
    return;
  }
  const content = el("composerText").value.trim();
  if (!content) return;
  const clientKey = "ck_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  const payload = {
    projectToken: S.cfg.token,
    pageUrl: S.href,
    pagePath: S.path,
    anchor: S.pending.anchor,
    content,
    kind: S.kind || undefined,
    clientKey,
    device: S.device,
    authorName: S.cfg.reviewerName || "Reviewer",
    authorEmail: S.cfg.reviewerEmail || "",
    metadata: S.pending.metadata,
    elementContext: S.pending.elementContext,
  };
  el("composerSend").disabled = true;
  try {
    await api("/feedback/comments", "POST", payload);
    closeComposer();
    toast("Feedback sent ✓");
    await loadComments();
  } catch (e) {
    toast(e.message === "rate_limited" ? "Too many comments — wait a moment" : "Send failed", true);
  } finally {
    el("composerSend").disabled = false;
  }
}

// --- Comments list + pins --------------------------------------------------
async function loadComments() {
  if (!S.resolved) {
    // Keep the localhost project picker on screen — it lives in the list.
    if (S.pickerActive) return;
    el("projectName").textContent = "No project for this host";
    el("list").innerHTML = "";
    S.comments = [];
    toFrame({ type: "bo:track", pins: [] });
    return;
  }
  if (!S.cfg.token || !S.path) return;
  try {
    // Scope: this page only (pagePath) vs the whole project (no pagePath).
    const qs =
      S.scope === "page" ? "?pagePath=" + encodeURIComponent(S.path) : "";
    const res = await api("/feedback/comments" + qs, "GET");
    // The LIST shows every device (a mobile comment shouldn't vanish while
    // reviewing desktop); pins are device- and path-scoped in applyFilter.
    S.fetched = res.comments || [];
    el("projectName").textContent = (res.project && res.project.name) || "Comments";
    applyFilter();
  } catch (e) {
    toast("Couldn't load comments: " + e.message, true);
  }
}

// Filter the fetched set by the active status filter, then render the list and
// the on-canvas pins from the SAME set so they always match.
function applyFilter() {
  const isOpen = (c) => c.status !== "resolved";
  const counts = {
    open: S.fetched.filter(isOpen).length,
    resolved: S.fetched.length - S.fetched.filter(isOpen).length,
    all: S.fetched.length,
  };
  document.querySelectorAll("#statusFilter .fbtn").forEach((b) => {
    const k = b.dataset.status;
    b.setAttribute("aria-pressed", String(k === S.statusFilter));
    b.textContent = b.dataset.label + " " + counts[k];
  });
  const scopeBtn = el("scopeToggle");
  if (scopeBtn) {
    scopeBtn.setAttribute("aria-pressed", String(S.scope === "page"));
    scopeBtn.textContent = S.scope === "page" ? "This page" : "All pages";
  }
  S.comments =
    S.statusFilter === "all"
      ? S.fetched
      : S.fetched.filter((c) =>
          S.statusFilter === "open" ? isOpen(c) : !isOpen(c),
        );
  renderList();
  // Pins overlay the framed page, so only anchor comments that belong to THIS
  // path at THIS device width — the rest stay reachable via the list.
  const pinnable = S.comments.filter(
    (c) =>
      (c.pagePath || "/") === S.path && (c.device || "desktop") === S.device,
  );
  toFrame({
    type: "bo:track",
    pins: pinnable.map((c) => ({
      id: c.id,
      selector: c.anchor && c.anchor.selector,
      nx: c.anchor && c.anchor.nx,
      ny: c.anchor && c.anchor.ny,
      px: c.anchor && c.anchor.px,
      py: c.anchor && c.anchor.py,
      region: c.anchor && c.anchor.region,
    })),
  });
}

function renderList() {
  const list = el("list");
  list.innerHTML = "";
  if (!S.comments.length) {
    const empty = document.createElement("div");
    empty.className = "list__empty";
    empty.textContent =
      S.statusFilter === "open"
        ? "No open comments here."
        : S.statusFilter === "resolved"
          ? "No resolved comments here."
          : "No comments here yet.";
    list.appendChild(empty);
    return;
  }
  S.comments.forEach((c, i) => {
    const card = document.createElement("div");
    const open = c.status !== "resolved";
    card.className = "card" + (open ? "" : " card--resolved");
    const ec = c.elementContext || {};
    const kindIcon =
      c.kind === "bug" ? "🐞" : c.kind === "idea" ? "💡" : c.kind === "question" ? "❓" : "•";
    const nReplies = (c.replies || []).length;
    // Context line: the element it points at, or the page path as fallback.
    const ctx = ec.text
      ? (ec.tag || "el") + " · " + ec.text
      : ec.tag
        ? "<" + ec.tag + ">"
        : c.pagePath || "/";
    card.innerHTML =
      `<div class="card__row">` +
      `<span class="dot ${open ? "" : "dot--resolved"}"></span>` +
      `<span class="card__num">#${i + 1}</span>` +
      `<span class="card__kind">${kindIcon} ${c.kind || "note"}${
        (c.device || "desktop") !== S.device ? " · " + (c.device || "desktop") : ""
      }</span>` +
      (S.scope === "all" ? `<span class="card__page"></span>` : "") +
      (nReplies ? `<span class="card__reply">💬 ${nReplies}</span>` : "") +
      `</div>` +
      `<div class="card__text"></div>` +
      `<div class="card__ctx"></div>`;
    card.querySelector(".card__text").textContent = c.content;
    card.querySelector(".card__ctx").textContent = ctx;
    if (S.scope === "all") card.querySelector(".card__page").textContent = c.pagePath || "/";
    card.onclick = () => openDetail(c);
    list.appendChild(card);
  });
}

// Open a comment from the sidebar: if it lives on another page, navigate the
// frame there first, then scroll its element into view and flash it.
function focusComment(c) {
  const targetPath = c.pagePath || "/";
  if (targetPath !== S.path) {
    // Navigate WITHIN the origin under review — a comment made on the live
    // store must open localhost's version of that page when reviewing
    // localhost, not jump the frame to production.
    let target = c.pageUrl;
    try {
      target = new URL(targetPath, S.href || frame.src).href;
    } catch (e) {}
    if (!target) return;
    S.pendingFocus = c.id;
    el("urlInput").value = target;
    el("status").textContent = "Loading " + targetPath + " …";
    frame.src = target;
    return;
  }
  sendFocus(c);
}
function sendFocus(c) {
  const a = c.anchor || {};
  toFrame({
    type: "bo:focus",
    id: c.id,
    selector: a.selector,
    nx: a.nx,
    ny: a.ny,
    px: a.px,
    py: a.py,
    region: a.region,
  });
}

function positionPins(rects) {
  overlay.innerHTML = "";
  const byId = {};
  S.comments.forEach((c, i) => (byId[c.id] = { i, resolved: c.status === "resolved" }));
  rects.forEach((r) => {
    const meta = byId[r.id];
    if (!meta || r.x < -1000) return;
    // Region comment: outline the dragged box behind the numbered pin.
    if (typeof r.w === "number" && typeof r.h === "number") {
      const box = document.createElement("div");
      box.className = "region" + (meta.resolved ? " region--resolved" : "");
      box.style.left = r.x + "px";
      box.style.top = r.y + "px";
      box.style.width = r.w + "px";
      box.style.height = r.h + "px";
      overlay.appendChild(box);
    }
    const pin = document.createElement("div");
    pin.className = "pin" + (meta.resolved ? " pin--resolved" : "");
    pin.dataset.id = r.id;
    pin.style.left = r.x + "px";
    pin.style.top = r.y + "px";
    pin.innerHTML = `<span>${meta.i + 1}</span>`;
    makePinDraggable(pin, r.id);
    overlay.appendChild(pin);
  });
}

// Map a screen point to iframe-viewport coords (the frameWrap is CSS-zoomed by
// S.scale, so the rendered rect is scaled — divide back out).
function pinToIframePoint(clientX, clientY) {
  const rect = frame.getBoundingClientRect();
  const scale = S.scale || 1;
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
}

// Drag a pin to re-anchor its comment to whatever element it's dropped on.
// While dragging we disable the iframe's pointer-events so the parent keeps
// receiving mousemove/up even when the cursor is over the framed site.
function makePinDraggable(pin, id) {
  pin.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    frame.style.pointerEvents = "none";
    document.body.style.userSelect = "none";
    pin.classList.add("pin--dragging");

    const onMove = (ev) => {
      if (Math.abs(ev.clientX - startX) > 3 || Math.abs(ev.clientY - startY) > 3) {
        moved = true;
      }
      const p = pinToIframePoint(ev.clientX, ev.clientY);
      pin.style.left = p.x + "px";
      pin.style.top = p.y + "px";
    };
    const onUp = (ev) => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
      frame.style.pointerEvents = "";
      document.body.style.userSelect = "";
      pin.classList.remove("pin--dragging");
      if (moved) {
        const p = pinToIframePoint(ev.clientX, ev.clientY);
        toFrame({ type: "bo:reanchor", id, x: p.x, y: p.y });
      } else {
        const c = S.comments.find((x) => x.id === id);
        if (c) openDetail(c);
      }
    };
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
  });
}

async function saveMovedPin(id, anchor) {
  if (!anchor) return loadComments();
  try {
    await api("/feedback/move", "POST", { commentId: id, anchor });
    toast("Pin moved ✓");
  } catch (e) {
    toast("Move failed: " + e.message, true);
  }
  await loadComments();
}

async function resolveComment(c, open) {
  try {
    await api("/feedback/resolve", "POST", {
      commentId: c.id,
      status: open ? "resolved" : "open",
    });
    await loadComments();
  } catch (e) {
    toast("Failed: " + e.message, true);
  }
}
// --- Note detail (in-sidebar master→detail, like Marker.io / Linear) -------
// D holds the open note plus any staged image change that commits on Save.
const D = { comment: null, imageStorageId: undefined, imageUrl: null, removeImage: false };

function fmtTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch (e) {
    return "";
  }
}

// Swap the sidebar between the list and a single note's detail. No overlay —
// the canvas stays fully visible.
function setPanelMode(mode) {
  const isDetail = mode === "detail";
  el("detail").hidden = !isDetail;
  el("list").hidden = isDetail;
  document.querySelector(".panel__filters").hidden = isDetail;
  document.querySelector(".panel__head").hidden = isDetail;
}

function openDetail(c) {
  D.comment = c;
  D.imageStorageId = undefined;
  D.imageUrl = c.screenshotUrl || null;
  D.removeImage = false;
  // Jump to it on the page and flash the element (switches page if needed).
  focusComment(c);
  el("dText").value = c.content || "";
  populateDetailMeta(c);
  renderDetailImage();
  renderDetailReplies(c);
  armDelete(false);
  el("dReplyInput").value = "";
  setPanelMode("detail");
  el("detail").scrollTop = 0;
  // Size the note textarea now that the panel is visible (a hidden element
  // reports scrollHeight 0, so this must run after the slide opens).
  requestAnimationFrame(() => autoGrow(el("dText")));
}
function closeDetail() {
  setPanelMode("list");
  D.comment = null;
}

// Grow a textarea to fit its content so the full note is visible without an
// inner scrollbar.
function autoGrow(ta) {
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";
}

// Full-size image viewer. Click anywhere (or Esc) to close.
function openLightbox(url) {
  const lb = el("lightbox");
  el("lightboxImg").src = url;
  lb.hidden = false;
}
function closeLightbox() {
  el("lightbox").hidden = true;
  el("lightboxImg").src = "";
}

function populateDetailMeta(c) {
  const open = c.status !== "resolved";
  const tag = el("dTag");
  tag.textContent = open ? "Open" : "Resolved";
  tag.className = "modal__tag" + (open ? "" : " modal__tag--resolved");
  const ec = c.elementContext || {};
  const bits = [];
  bits.push((c.kind || "note") + " · " + (c.device || "desktop"));
  bits.push("Page: " + (c.pagePath || "/"));
  if (ec.tag || ec.text) bits.push("Element: " + (ec.tag || "") + (ec.text ? ' · "' + ec.text + '"' : ""));
  bits.push("By " + (c.authorName || "—") + " · " + fmtTime(c.createdAt));
  el("dMeta").textContent = bits.join("  •  ");
  el("dResolve").textContent = open ? "Mark resolved" : "Reopen";
}

// Resolve the image URL currently in effect given staged edits.
function currentImageUrl() {
  if (D.removeImage) return null;
  if (D.imageStorageId) return D.imageUrl; // freshly attached (local preview)
  return D.comment && D.comment.screenshotUrl;
}
function renderDetailImage() {
  const row = el("dImgRow");
  row.innerHTML = "";
  const url = currentImageUrl();
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Attachment";
    img.className = "modal__thumb";
    img.title = "Click to enlarge";
    img.onclick = () => openLightbox(url);
    const rm = document.createElement("button");
    rm.className = "btn btn--danger";
    rm.type = "button";
    rm.textContent = "Remove image";
    rm.onclick = () => {
      D.removeImage = true;
      D.imageStorageId = undefined;
      D.imageUrl = null;
      renderDetailImage();
    };
    row.appendChild(img);
    row.appendChild(rm);
  } else {
    const none = document.createElement("div");
    none.className = "modal__imgNone";
    none.textContent = "No image attached.";
    row.appendChild(none);
  }
}

function renderDetailReplies(c) {
  const box = el("dReplies");
  box.innerHTML = "";
  const replies = c.replies || [];
  if (!replies.length) {
    const e = document.createElement("div");
    e.className = "modal__empty";
    e.textContent = "No messages yet — start the conversation below.";
    box.appendChild(e);
    return;
  }
  replies
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((r) => {
      const d = document.createElement("div");
      d.className = "reply";
      d.innerHTML = `<div class="reply__meta"><b></b> · <span></span></div><div class="reply__text"></div>`;
      d.querySelector("b").textContent = r.authorName || "Guest";
      d.querySelector("span").textContent = fmtTime(r.createdAt);
      d.querySelector(".reply__text").textContent = r.content;
      box.appendChild(d);
    });
}

// Upload a file to Convex storage via the token-gated upload-url endpoint.
async function uploadImage(file) {
  const r = await fetch(apiBase() + "/feedback/screenshot-upload-url", {
    method: "POST",
    headers: { "X-Feedback-Token": S.cfg.token },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.uploadUrl) throw new Error(j.error || "upload_url_failed");
  const up = await fetch(j.uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || !uj.storageId) throw new Error("upload_failed");
  return uj.storageId;
}

async function onAttachImage(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    toast("Pick an image file", true);
    return;
  }
  el("dAttach").disabled = true;
  try {
    const storageId = await uploadImage(file);
    D.imageStorageId = storageId;
    D.imageUrl = URL.createObjectURL(file); // local preview until saved
    D.removeImage = false;
    renderDetailImage();
    toast("Image attached — Save to keep it");
  } catch (e) {
    toast("Upload failed: " + e.message, true);
  } finally {
    el("dAttach").disabled = false;
  }
}

async function saveDetail() {
  if (!D.comment) return;
  const content = el("dText").value.trim();
  if (!content) {
    toast("Note can't be empty", true);
    return;
  }
  const body = { commentId: D.comment.id, content };
  if (D.imageStorageId) body.imageStorageId = D.imageStorageId;
  else if (D.removeImage) body.removeImage = true;
  el("dSave").disabled = true;
  try {
    await api("/feedback/edit", "POST", body);
    toast("Saved ✓");
    await loadComments();
    const fresh = S.fetched.find((x) => x.id === D.comment.id);
    if (fresh) {
      D.comment = fresh;
      D.imageStorageId = undefined;
      D.removeImage = false;
      D.imageUrl = fresh.screenshotUrl || null;
      populateDetailMeta(fresh);
      renderDetailImage();
      renderDetailReplies(fresh);
    }
  } catch (e) {
    toast("Save failed: " + e.message, true);
  } finally {
    el("dSave").disabled = false;
  }
}

async function sendReply() {
  if (!D.comment) return;
  const content = el("dReplyInput").value.trim();
  if (!content) return;
  try {
    await api("/feedback/replies", "POST", {
      commentId: D.comment.id,
      content,
      authorName: S.cfg.reviewerName || "Reviewer",
      authorEmail: S.cfg.reviewerEmail || "",
    });
    el("dReplyInput").value = "";
    await loadComments();
    const fresh = S.fetched.find((x) => x.id === D.comment.id);
    if (fresh) {
      D.comment = fresh;
      renderDetailReplies(fresh);
    }
  } catch (e) {
    toast(e.message === "rate_limited" ? "Too fast — wait a moment" : "Reply failed", true);
  }
}

async function toggleResolveDetail() {
  if (!D.comment) return;
  const open = D.comment.status !== "resolved";
  await resolveComment(D.comment, open);
  const fresh = S.fetched.find((x) => x.id === D.comment.id);
  if (fresh) {
    D.comment = fresh;
    populateDetailMeta(fresh);
  }
}

// Two-step delete (no browser confirm): first click arms, second click deletes.
let deleteArmed = false;
let deleteT = null;
function armDelete(on) {
  deleteArmed = on;
  const b = el("dDelete");
  b.classList.toggle("is-armed", on);
  b.textContent = on ? "Click again to delete" : "Delete";
  clearTimeout(deleteT);
  if (on) deleteT = setTimeout(() => armDelete(false), 3000);
}
async function deleteDetail() {
  if (!D.comment) return;
  if (!deleteArmed) {
    armDelete(true);
    return;
  }
  armDelete(false);
  const id = D.comment.id;
  try {
    await api("/feedback/delete", "POST", { commentId: id });
    toast("Note deleted ✓");
    closeDetail();
    await loadComments();
  } catch (e) {
    toast("Delete failed: " + e.message, true);
  }
}

// --- Wire up ---------------------------------------------------------------
function bind() {
  el("urlForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const u = el("urlInput").value.trim();
    if (u) loadSite(u);
  });
  document.querySelectorAll(".seg").forEach((b) =>
    b.addEventListener("click", () => setDevice(b.dataset.device)),
  );
  el("commentToggle").addEventListener("click", () => setCommenting(!S.commenting));
  // Press "C" to toggle comment mode (ignored while typing in a field).
  window.addEventListener("keydown", (e) => {
    if (e.key !== "c" && e.key !== "C") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    const tag = t && t.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
    e.preventDefault();
    setCommenting(!S.commenting);
  });
  el("refreshBtn").addEventListener("click", loadComments);
  // Status filter (Open / Resolved / All) — pure client-side re-render.
  document.querySelectorAll("#statusFilter .fbtn").forEach((b) =>
    b.addEventListener("click", () => {
      S.statusFilter = b.dataset.status;
      applyFilter();
    }),
  );
  // Scope toggle (this page vs all pages) — needs a re-fetch.
  el("scopeToggle").addEventListener("click", () => {
    S.scope = S.scope === "page" ? "all" : "page";
    loadComments();
  });
  el("composerSend").addEventListener("click", sendComment);
  el("composerCancel").addEventListener("click", closeComposer);
  // Note detail (in-sidebar)
  el("dBack").addEventListener("click", closeDetail);
  el("dLocate").addEventListener("click", () => D.comment && focusComment(D.comment));
  el("dAttach").addEventListener("click", () => el("dFile").click());
  el("dFile").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-picking the same file
    onAttachImage(f);
  });
  el("dText").addEventListener("input", (e) => autoGrow(e.target));
  el("dSave").addEventListener("click", saveDetail);
  el("lightbox").addEventListener("click", closeLightbox);
  el("dResolve").addEventListener("click", toggleResolveDetail);
  el("dDelete").addEventListener("click", deleteDetail);
  el("dReplyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    sendReply();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!el("lightbox").hidden) closeLightbox();
    else if (!el("detail").hidden) closeDetail();
  });
  document.querySelectorAll(".kind").forEach((k) =>
    k.addEventListener("click", () => {
      S.kind = S.kind === k.dataset.kind ? null : k.dataset.kind;
      document.querySelectorAll(".kind").forEach((o) =>
        o.setAttribute("aria-pressed", String(o.dataset.kind === S.kind)),
      );
    }),
  );
}

(async function init() {
  await loadConfig();
  try {
    const t = await chrome.tabs.getCurrent();
    S.tabId = t && t.id;
  } catch (e) {}
  bind();
  setDevice("desktop");
  const u = new URLSearchParams(location.search).get("u");
  if (u) loadSite(u);
})();
