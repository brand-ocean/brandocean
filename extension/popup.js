const DEFAULTS = {
  base: "https://rightful-bulldog-338.eu-west-1.convex.site",
  // Fallback only — the canvas auto-resolves the project by the framed host.
  token: "4Ip1NvDYN5vRMiY9dCcM7N3v8vX2Pn2eR8Ureeqd",
  reviewerName: "",
  reviewerEmail: "",
  // Developer mode (off for normal reviewers): point the extension at a local
  // Convex deployment and/or force a project token for specific hosts.
  dev: false,
  devBase: "",
  devHostTokens: "", // "host[:port]=token" per line
  devDebug: false,
};

const $ = (id) => document.getElementById(id);

const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Name + email are required before a review can start — every comment is
// attributed to the reviewer, so gate "Open review canvas" until both are set.
function refresh() {
  const ok =
    $("name").value.trim().length > 0 && validEmail($("email").value.trim());
  $("open").disabled = !ok;
  $("hint").textContent = ok ? "" : "Enter your name and a valid email to continue.";
}

async function load() {
  const c = await chrome.storage.sync.get(DEFAULTS);
  $("name").value = c.reviewerName;
  $("email").value = c.reviewerEmail;
  $("devOn").checked = !!c.dev;
  $("devBase").value = c.devBase;
  $("devHostTokens").value = c.devHostTokens;
  $("devDebug").checked = !!c.devDebug;
  if (c.dev) $("devSection").open = true;
  // Prefill the URL box with the active tab so "review this page" is one click.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && /^https?:/.test(tab.url)) $("url").value = tab.url;
  refresh();
}

// The Convex base URL + fallback token are infrastructure — never shown to the
// reviewer. We still write them so background.js/canvas.js read the right
// deployment; the project token itself is auto-resolved by the framed host.
async function save() {
  await chrome.storage.sync.set({
    base: DEFAULTS.base,
    token: DEFAULTS.token,
    reviewerName: $("name").value.trim(),
    reviewerEmail: $("email").value.trim(),
    dev: $("devOn").checked,
    devBase: $("devBase").value.trim(),
    devHostTokens: $("devHostTokens").value.trim(),
    devDebug: $("devDebug").checked,
  });
}

["name", "email", "devBase", "devHostTokens"].forEach((id) =>
  $(id).addEventListener("change", save),
);
["devOn", "devDebug"].forEach((id) => $(id).addEventListener("change", save));
["name", "email"].forEach((id) => $(id).addEventListener("input", refresh));

$("open").addEventListener("click", async () => {
  if ($("open").disabled) return;
  await save();
  const url = $("url").value.trim();
  if (!url) return;
  chrome.runtime.sendMessage({ type: "bo:open-canvas", url }, () => window.close());
});

load();
