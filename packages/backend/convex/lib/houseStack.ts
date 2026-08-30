/**
 * Wat Brandocean bouwt en hoe. Dit gaat als context mee in elke AI-call rond
 * intakes, zodat een voorstel in deze stack denkt en niet in een generieke.
 *
 * Geteld over ~70 projecten in ~/Codebase: TanStack Start + Convex + Cloudflare
 * is de default (30+), Astro voor content-sites, Shopify waar commerce leidend
 * is. Houd dit bij als de stack schuift — het model weet alleen wat hier staat.
 */
export const HOUSE_STACK = `
# De stack van Brandocean

## Default voor alles met een backend
- **TanStack Start** (React 19, file-based routing via TanStack Router).
- **Convex** als backend: database, serverfuncties, scheduling, file storage,
  auth en realtime in één type-safe geheel. Elke functie is een transactie.
- **Cloudflare Workers** als hosting, via wrangler. Eén worker per app.
- **Tailwind v4** + shadcn/base-ui componenten. **Biome** voor lint/format.
- **bun** als package manager, bun workspaces voor monorepo's.

## Wanneer iets anders
- **Astro** als de site vooral content is en er nauwelijks app-logica in zit:
  marketing, brochure, blog. Ook op Cloudflare.
- **Shopify** als commerce het hart is (Liquid, Hydrogen, of een custom app op
  de Admin API). Niet zelf een webshop bouwen die Shopify al is.
- Alles daarbuiten is een bewuste uitzondering en moet uitgelegd worden.

## Harde regels in de code
- Nooit \`any\` of \`unknown\` als type. Geen uitzonderingen.
- Nooit \`useEffect\` schrijven. Gebruik afgeleide state, event handlers,
  \`useMemo\`, \`useSyncExternalStore\`, key-based resets of een datalaag.
- Convex-conventies volgen: validators op elke functie, indexes in plaats van
  filters, \`internalMutation\` voor wat niet publiek hoort.
- Nederlands in klantgerichte teksten, in gewone mensentaal.

## Wat Brandocean typisch levert
Apps, webshops, dashboards, portals, CRM-koppelingen, AI-integraties,
automatisering, branding en design, en het beheer erna. Eén aanspreekpunt voor
bouw én onderhoud — geen bureau met freelancers eromheen.
`.trim();

/**
 * De toon voor alles wat de klant leest. Losstaand van de stack, want dit geldt
 * ook voor de vragen zelf en niet alleen voor het eindantwoord.
 */
export const HOUSE_VOICE = `
Schrijf zoals een ervaren bouwer praat, niet zoals een offertegenerator.

- Nederlands, gewone woorden, korte zinnen.
- Geen opsommingstekens in lopende tekst, geen kopjes, geen gedachtestreepjes.
- Geen marketingtaal ("oplossing op maat", "in nauwe samenwerking", "unlocken").
- Geen jargon richting de klant. "We slaan het op" in plaats van "persistente
  datalaag".
- Nooit doen alsof je iets zeker weet wat je niet weet. Als iets onduidelijk is,
  zeg dat het onduidelijk is.
`.trim();
