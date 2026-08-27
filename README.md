# BRANDOCEAN

Monorepo met de Brandocean-apps op één gedeelde Convex-backend.

## Structuur

```
apps/
  app/      admin tool (offertes, contracten, facturen, boekhouding, feedback,
            NDA's, specs, portfolio) + de publieke klantroutes /o /v /c /i /n /ns /share
  blunt/    de Brandocean-website — "blunt" is de naam van het template
            (blunt-main), niet van een merk. Home, about, work, expertise,
            careers, contact; work-grid en cases komen uit de CMS.
  site/     de vorige generatie van diezelfde site (/v1, /full)
packages/
  backend/  Convex — één gedeelde deployment voor alle apps
  ui/       shadcn-primitives, brandmark, theme/language context,
            gedeelde hooks, constants en de Tailwind-stylesheet
tools/
  extension/        Chrome-extensie voor de feedback-widget
  mobile-preview/   losse Cloudflare Worker
```

Elke app is een eigen TanStack Start-build met een eigen Cloudflare Worker, dus
een wijziging aan de marketingsite deployt de tool niet mee.

## Aliassen

Twee aliassen, in elke app hetzelfde:

- `~convex/*` → `packages/backend/convex/*`
- `@/*` → eerst de eigen `src/`, dan `packages/ui/src/` als terugval

Die terugval staat in `tsconfig.json` van elke app. Daardoor werkt
`@/components/ui/button` zonder dat elke app de primitives dupliceert, en kan een
app een gedeeld bestand overrulen door het zelf onder dezelfde naam te zetten
(zo laadt blunt zijn eigen `src/styles.css`).

## Draaien

```bash
bun install

bun run dev          # apps/app + convex dev
bun run dev:blunt    # poort 2223
bun run dev:site     # poort 2224
bun run dev:convex   # alleen de backend

bun run typecheck    # tsc over alle workspaces
bun run test         # vitest
bun run check        # biome
```

## Deployen

De backend is gedeeld, dus `convex deploy` draait vanuit `packages/backend` en
injecteert de deployment-URL als `VITE_CONVEX_URL` in de build van de app:

```bash
bun run deploy:app
bun run deploy:blunt
bun run deploy:site
```

Domeinen staan in `apps/*/wrangler.jsonc`. Alleen `apps/app` heeft er nu een
(`app.brandocean.nl`). `apps/blunt` is de publieke site en hoort op
brandocean.nl; `apps/site` is de oude generatie en heeft alleen een domein
nodig zolang je 'm nog wilt kunnen bekijken.

## Nieuwe miniapp

1. `apps/<naam>/` met `package.json`, `vite.config.ts`, `wrangler.jsonc` en
   `tsconfig.json` — kopieer die van `apps/site`, dat is de kleinste.
2. `src/routes/__root.tsx` en `src/router.tsx` erbij.
3. `@source "../../../apps/<naam>/src";` toevoegen in
   `packages/ui/src/styles.css`, anders ziet Tailwind de klassen niet.
4. `bun install`.

## Convex

Alle backendcode staat in `packages/backend/convex/`. Lees
`packages/backend/convex/_generated/ai/guidelines.md` voordat je daar iets wijzigt.
