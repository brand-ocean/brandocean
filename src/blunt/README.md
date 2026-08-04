# blunt

1:1 port of the `blunt-main` Next.js template (CGMWTJULY2026) into this TanStack
Start app. Structure, class names, CSS values, GSAP timings and copy are the
originals — only the framework plumbing changed.

## Layout

```
src/blunt/
  styles/blunt.css        globals.css, scoped under `.blunt`
  utils/textAnimations.ts
  components/<Name>/      <Name>.tsx + <Name>.module.css (CSS copied verbatim)
  pages/*.module.css      the per-page CSS modules from src/app/<page>/
src/routes/_blunt.tsx     pathless layout -> BluntLayout
src/routes/_blunt/*.tsx   / about work sample-project expertise careers contact
```

## What changed from the template

| blunt-main | here | why |
| --- | --- | --- |
| `app/globals.css` at document scope | every rule prefixed `.blunt` | the authed dashboard shares the document and must keep its own reset/typography |
| `html { scrollbar-width: none }` | `html.blunt-scroll`, toggled by `BluntLayout` | same reason |
| `next/font/google` | `@import` in `src/styles.css` | Host Grotesk, DM Mono, Shadows Into Light, SCHABO |
| `next/link` | `components/TransitionLink.tsx` | wraps TanStack `Link`, `href` typed as `BluntHref` |
| `next-transition-router` | `TransitionProvider` + `usePageTransition()` | curtain in → `router.navigate` → curtain out. Browser back/forward navigates without the curtain (the only behavioural difference). |
| `usePathname()` | `useRouterState({ select: s => s.location.pathname })` | |
| `components/ClientLayout.js` | `BluntLayout.tsx` | same ReactLenis/Menu/Footer tree, plus the `.blunt` wrapper |

`react-icons`, `matter-js` and `@gsap/react` were added as dependencies so the
Menu/Testimonials icons and the Footer physics behave exactly as the template.

## Images

The template shipped only 21 of the ~60 images its markup references. The gaps
were filled by cycling the images that did ship — see `PLACEHOLDER-IMAGES.md`
for the list to replace with real BRANDOCEAN artwork.

## Content

All copy is still the template's ("Blunt Studio", Ghost Signal, etc.) — that is
deliberate, so the swap to agency content is a pure text edit.
