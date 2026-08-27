# Brandocean Feedback — Chrome Extension (v0.2)

Pin visual feedback on **any** website at **desktop / tablet / mobile** widths —
Shopify and React included — and post it straight into the existing Brandocean
Convex `/feedback` backend. This is the **only** way feedback is collected: the
old on-page `?feedback` widget has been removed; nothing is installed on the
client's site.

## Two modes
- **Live mode (recommended)** — `Comment on this page (live)` injects the overlay
  straight into the **real tab** (`live.js`), so auth, flows, and scroll animations
  are 100% accurate (no iframe). Device width is switched by one of two engines you
  pick from the toolbar dropdown:
  - **CDP (accurate)** — `chrome.debugger` + `Emulation.setDeviceMetricsOverride`:
    true width + **device-pixel-ratio + touch + mobile UA**. Chrome shows a
    *"…started debugging this browser"* banner while active.
  - **Resize (no banner)** — `chrome.windows.update` resizes the real window to the
    device width. No banner, but approximate (no DPR/touch, clamped by the OS
    minimum window width, and includes browser chrome).
- **Canvas mode** — frames a URL in an extension page; good for quickly checking a
  page you're not on, but carries iframe limits (logged-out for auth pages, some
  flows break, scroll-choreographed sites may render slightly off).

## How it works
- The **review canvas** (`canvas.html`) loads the target site in a responsive
  `<iframe>` and lets you switch device width (true layout reflow).
- The service worker uses **`declarativeNetRequest`** to strip `X-Frame-Options`
  / CSP `frame-ancestors` **only for the review tab** (scoped via `tabIds`), so
  sites that normally block framing (Shopify) can be reviewed — and your normal
  browsing is never affected. Mobile also swaps in a mobile User-Agent.
- A **capture script** (`content.js`) is injected only into the framed site. It
  records the clicked element's anchor + rich `elementContext` (text, computed
  styles, React component/source, landmark) — the same shape the backend stores.
- Comments POST to `/feedback/comments` with `X-Feedback-Token`. The backend then
  auto-generates the **cropped element screenshot** server-side (Cloudflare
  Browser Rendering) — nothing to capture on the client.

## Install (unpacked)
1. Chrome → `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this folder
   (`~/Downloads/brandocean-feedback-extension`).
3. Click the extension icon → enter your name + email.
4. Enter a URL (or use the prefilled current tab) → **Open review canvas**.
   The project is auto-resolved from the framed host, so the right comments
   load automatically.
5. Pick a device width, hit **Comment**, click any element, type, **Send**.
6. Comments + pins appear in the right panel and on the page; they flow into the
   `/feedback` skill and the dashboard.

## Localhost / dev servers
Reviewing `http://localhost:5173` (or `127.0.0.1`, `*.local`, `*.test`) works
out of the box: bare `localhost:5173` input defaults to `http://`, and the
host **including port** is sent to `/feedback/resolve-host`. Map a dev host to
a project on the dashboard's **Review & share** page ("Dev hosts") so the
right comments auto-load — or force a token locally via Developer mode.

## Developer mode (popup → "Developer mode")
For working on the extension/backend itself:
- **API base override** — point everything at a local Convex deployment
  (e.g. `http://127.0.0.1:3211`) without touching production.
- **Host → token overrides** — `localhost:5173=TOKEN` lines that win over
  auto-resolve (copy the token from the project's Review & share page).
- **Verbose logging** — `[bo:dev]` logs in the canvas console for resolve,
  API calls, and override hits.
After editing extension files: `chrome://extensions` → reload the extension,
then reopen the canvas tab.

## v1 scope / not yet
- **No auth** (intentional, per request) — a project token gates writes.
  Project auto-resolve by host is in (prod domains + dev hosts); magic-link
  login comes later.
- Pins track elements via selector/coords; SPA in-iframe route changes re-inject
  on full loads (history-API navigations are a follow-up).
- Header-stripping is scoped to the review tab only, but it does remove CSP there —
  acceptable for an internal review tool; documented for transparency.

## Where the build lives
Developed here in `~/Downloads`. The production copy belongs in the brandocean
repo at **`brandocean/extension/`** (sibling to `workers/`), kept as a standalone
MV3 bundle (no Vite/SSR coupling).
