// Brandocean Feedback — service worker (MV3).
//
// Handles two review modes:
//   • CANVAS mode  — frames a site in an extension page; strips X-Frame-Options /
//     CSP frame-ancestors (per-tab) so any site can be framed; injects capture.
//   • LIVE mode    — injects the overlay straight into the real tab (accurate,
//     no iframe), proxies the /feedback API (no CORS), and switches device width
//     via one of two engines: CDP emulation (chrome.debugger) or window resize.

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const DEVICES = {
  desktop: { w: 1440, h: 900, dsf: 1, mobile: false },
  tablet: { w: 834, h: 1112, dsf: 2, mobile: false },
  mobile: { w: 390, h: 844, dsf: 3, mobile: true },
};

const CFG_DEFAULTS = {
  base: "https://rightful-bulldog-338.eu-west-1.convex.site",
  token: "4Ip1NvDYN5vRMiY9dCcM7N3v8vX2Pn2eR8Ureeqd",
  reviewerName: "Reviewer",
  reviewerEmail: "",
  dev: false,
  devBase: "",
};

// ===========================================================================
// CANVAS mode — declarativeNetRequest header stripping (per review tab).
// ===========================================================================
const reviewTabs = new Set();
// Rule IDs must be small positive integers. Chrome tab IDs grow over a browser
// session and can reach the millions, so `tabId * 10` can overflow DNR's valid
// rule-ID range → updateSessionRules() silently fails → headers never stripped →
// "frame-ancestors 'none'" blocks the frame. Keep IDs bounded instead.
const stripRuleId = (t) => 1000 + (t % 1_000_000) * 2;
const uaRuleId = (t) => 1001 + (t % 1_000_000) * 2;

function stripRule(tabId) {
  return {
    id: stripRuleId(tabId),
    priority: 1,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        { header: "x-frame-options", operation: "remove" },
        { header: "frame-options", operation: "remove" },
        { header: "content-security-policy", operation: "remove" },
        { header: "content-security-policy-report-only", operation: "remove" },
      ],
    },
    condition: { tabIds: [tabId], resourceTypes: ["sub_frame"] },
  };
}
function uaRule(tabId) {
  return {
    id: uaRuleId(tabId),
    priority: 1,
    action: { type: "modifyHeaders", requestHeaders: [{ header: "user-agent", operation: "set", value: MOBILE_UA }] },
    condition: { tabIds: [tabId], resourceTypes: ["sub_frame"] },
  };
}
async function enableSession(tabId, mobile) {
  reviewTabs.add(tabId);
  const addRules = [stripRule(tabId)];
  if (mobile) addRules.push(uaRule(tabId));
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [stripRuleId(tabId), uaRuleId(tabId)],
      addRules,
    });
    const active = await chrome.declarativeNetRequest.getSessionRules();
    console.log(
      `[bo] strip armed for tab ${tabId} (ruleId ${stripRuleId(tabId)}); ` +
        `${active.length} session rule(s) active`,
    );
  } catch (e) {
    console.error("[bo] FAILED to arm header-strip rule:", e);
  }
}
async function setMobileUA(tabId, mobile) {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [uaRuleId(tabId)],
    addRules: mobile ? [uaRule(tabId)] : [],
  });
}
async function endSession(tabId) {
  reviewTabs.delete(tabId);
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [stripRuleId(tabId), uaRuleId(tabId)] });
}

// Inject capture into every framed sub-frame of a review tab.
chrome.webNavigation.onCommitted.addListener(async (d) => {
  if (d.frameId === 0 || !reviewTabs.has(d.tabId)) return;
  try {
    await chrome.scripting.insertCSS({ target: { tabId: d.tabId, frameIds: [d.frameId] }, files: ["content.css"] });
    await chrome.scripting.executeScript({ target: { tabId: d.tabId, frameIds: [d.frameId] }, files: ["capture.js", "content.js"] });
  } catch (e) {}
});

// ===========================================================================
// LIVE mode — device emulation engines.
// ===========================================================================
const cdpTabs = new Set();
const winOrig = new Map(); // tabId -> { windowId, width, height }

function dbg(method, target, params) {
  return new Promise((resolve) => {
    chrome.debugger.sendCommand(target, method, params || {}, () => {
      void chrome.runtime.lastError;
      resolve();
    });
  });
}
function attach(tabId) {
  return new Promise((resolve) => {
    chrome.debugger.attach({ tabId }, "1.3", () => {
      void chrome.runtime.lastError; // ignore "already attached"
      cdpTabs.add(tabId);
      resolve();
    });
  });
}
async function applyCdp(tabId, device) {
  if (device === "desktop") return resetCdp(tabId);
  const d = DEVICES[device];
  await attach(tabId);
  const target = { tabId };
  await dbg("Emulation.setDeviceMetricsOverride", target, {
    width: d.w,
    height: d.h,
    deviceScaleFactor: d.dsf,
    mobile: d.mobile,
  });
  await dbg("Emulation.setTouchEmulationEnabled", target, { enabled: d.mobile });
  if (d.mobile) await dbg("Emulation.setUserAgentOverride", target, { userAgent: MOBILE_UA });
}
async function resetCdp(tabId) {
  if (!cdpTabs.has(tabId)) return;
  const target = { tabId };
  await dbg("Emulation.clearDeviceMetricsOverride", target);
  await dbg("Emulation.setTouchEmulationEnabled", target, { enabled: false });
  await new Promise((r) => chrome.debugger.detach(target, () => (void chrome.runtime.lastError, r())));
  cdpTabs.delete(tabId);
}
async function applyResize(tabId, device) {
  const tab = await chrome.tabs.get(tabId);
  if (!winOrig.has(tabId)) {
    const w = await chrome.windows.get(tab.windowId);
    winOrig.set(tabId, { windowId: tab.windowId, width: w.width, height: w.height });
  }
  if (device === "desktop") return resetResize(tabId);
  const d = DEVICES[device];
  // Approximate: window outer size ≈ device viewport + a little chrome.
  await chrome.windows.update(tab.windowId, { state: "normal", width: d.w, height: d.h + 120 });
}
async function resetResize(tabId) {
  const o = winOrig.get(tabId);
  if (!o) return;
  await chrome.windows.update(o.windowId, { width: o.width, height: o.height });
  winOrig.delete(tabId);
}
async function emulate(tabId, device, engine) {
  if (engine === "cdp") {
    await resetResize(tabId);
    await applyCdp(tabId, device);
  } else {
    await resetCdp(tabId);
    await applyResize(tabId, device);
  }
}
async function emulateReset(tabId) {
  await resetCdp(tabId);
  await resetResize(tabId);
}

chrome.debugger.onDetach.addListener((src) => {
  if (src.tabId != null) cdpTabs.delete(src.tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => {
  if (reviewTabs.has(tabId)) endSession(tabId);
  cdpTabs.delete(tabId);
  if (winOrig.has(tabId)) resetResize(tabId);
});

// ===========================================================================
// Message router.
// ===========================================================================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      const tabId = msg.tabId != null ? msg.tabId : sender.tab && sender.tab.id;

      // --- Canvas mode ---
      if (msg.type === "bo:open-canvas") {
        const url = chrome.runtime.getURL(`canvas.html?u=${encodeURIComponent(msg.url || "")}`);
        const tab = await chrome.tabs.create({ url });
        await enableSession(tab.id, false);
        return sendResponse({ ok: true, tabId: tab.id });
      }
      if (msg.type === "bo:session-start") {
        if (tabId) await enableSession(tabId, !!msg.mobile);
        return sendResponse({ ok: true });
      }
      if (msg.type === "bo:set-mobile") {
        if (tabId) await setMobileUA(tabId, !!msg.mobile);
        return sendResponse({ ok: true });
      }
      if (msg.type === "bo:session-end") {
        if (tabId) await endSession(tabId);
        return sendResponse({ ok: true });
      }

      if (msg.type === "bo:getcfg") {
        const c = await chrome.storage.sync.get(CFG_DEFAULTS);
        return sendResponse({ reviewerName: c.reviewerName, reviewerEmail: c.reviewerEmail });
      }
      if (msg.type === "bo:api") {
        const c = await chrome.storage.sync.get(CFG_DEFAULTS);
        const base = c.dev && c.devBase ? c.devBase : c.base;
        const res = await fetch(base.replace(/\/$/, "") + msg.path, {
          method: msg.method,
          headers: { "X-Feedback-Token": c.token, ...(msg.body ? { "Content-Type": "application/json" } : {}) },
          body: msg.body ? JSON.stringify(msg.body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        return sendResponse({ ok: res.ok, json });
      }
      if (msg.type === "bo:emulate") {
        if (tabId) await emulate(tabId, msg.device, msg.engine);
        return sendResponse({ ok: true });
      }
      if (msg.type === "bo:emulate-reset") {
        if (tabId) await emulateReset(tabId);
        return sendResponse({ ok: true });
      }

      sendResponse({ ok: false });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
});
