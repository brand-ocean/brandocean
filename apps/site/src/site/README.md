# De Brandocean-site

Oorspronkelijk een 1:1 port van het `blunt-main` Next.js-template (CGMWTJULY2026)
naar TanStack Start — vandaar dat de klassenamen, CSS-waarden en GSAP-timings
nog die van het origineel zijn. De map heette eerder `blunt`; dat was de naam van
het template, niet van een merk.

## Layout

```
src/site/
  styles/site.css        globals.css, scoped under `.bo-site`
  utils/textAnimations.ts
  utils/portfolio.ts      helpers over a CMS portfolio item
  components/<Name>/      <Name>.tsx + <Name>.module.css (CSS copied verbatim)
  components/CaseBlocks/  renders the CMS block list as case-study sections
  pages/*.module.css      the per-page CSS modules from src/app/<page>/
src/routes/_site.tsx     pathless layout -> ConvexProvider -> SiteLayout
src/routes/_site/*.tsx   / about work work/$slug expertise careers contact
```

## Content from the CMS

The work grid (`/work`), the homepage's featured cards and the case pages
(`/work/$slug`) all read the `portfolioItems` table, edited at `/portfolio` in
the authed dashboard. The template's static `/sample-project` page is gone —
`case.module.css` is the stylesheet it left behind, now used by `/work/$slug`.

A case page is an ordered list of typed blocks (`convex/lib/portfolioBlocks.ts`):
text, image, gallery, stats, quote, live preview. Adding a block kind means
adding a branch in `CaseBlocks.tsx` and in `src/components/portfolio/BlockEditor.tsx`
— the discriminated union makes the compiler ask for both.

Photos are uploaded into Convex file storage from the CMS; queries resolve the
storage id into a URL, so the components only ever read `media.url`. Items that
predate the CMS still carry plain `heroImageUrl`/`gallery` URLs and keep working.

The old Convex-driven case page still exists at `/work-v1/$slug`.

## What changed from the template

| blunt-main | here | why |
| --- | --- | --- |
| `app/globals.css` at document scope | every rule prefixed `.bo-site` | the authed dashboard shares the document and must keep its own reset/typography |
| `html { scrollbar-width: none }` | `html.bo-site-scroll`, toggled by `SiteLayout` | same reason |
| `next/font/google` | `@import` in `src/styles.css` | Host Grotesk, DM Mono, Shadows Into Light, SCHABO |
| `next/link` | `components/TransitionLink.tsx` | wraps TanStack `Link`, `href` typed as `SiteHref` |
| `next-transition-router` | `TransitionProvider` + `usePageTransition()` | curtain in → `router.navigate` → curtain out. Browser back/forward navigates without the curtain (the only behavioural difference). |
| `usePathname()` | `useRouterState({ select: s => s.location.pathname })` | |
| `components/ClientLayout.js` | `SiteLayout.tsx` | same ReactLenis/Menu/Footer tree, plus the `.bo-site` wrapper |

`react-icons`, `matter-js` and `@gsap/react` were added as dependencies so the
Menu/Testimonials icons and the Footer physics behave exactly as the template.

## Images

The template shipped only 21 of the ~60 images its markup references. The gaps
were filled by cycling the images that did ship — see `PLACEHOLDER-IMAGES.md`
for the list to replace with real BRANDOCEAN artwork.

## Content

Rewritten for Brandocean. Dutch body copy, English display headlines (SCHABO
h1–h3), sourced from the offertes in this repo and the client repos under
`~/Codebase`.

Still to confirm before this goes public:

- **Testimonials** (`components/Testimonials/Testimonials.tsx`) are drafts we
  wrote, not quotes anyone has said. Replace with approved quotes and real
  names.
- **Team names** (`components/Team/Team.tsx`) are "Naam volgt" placeholders.
- **Stats** (`components/Stats/Stats.tsx`) — "20 jaar" comes straight from the
  offertes; "80+ projecten" is counted from the folders in `~/Codebase`.
- **Project years** now come from the CMS `year` field. Items imported before
  that field existed fall back to the year parsed out of the `project` line —
  fill `year` in at `/portfolio` so the grid stops guessing.
- **Client names** are used publicly on `/work` and the home cards. Check none
  of them are under an NDA that forbids it.
