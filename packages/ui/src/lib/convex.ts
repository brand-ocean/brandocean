import { ConvexReactClient } from "convex/react";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!url) {
	throw new Error(
		"VITE_CONVEX_URL is not set. Run `bunx convex dev` to provision a deployment.",
	);
}

let client: ConvexReactClient | undefined;

/**
 * De client wordt lui gebouwd, niet op module-scope. In workerd is dat een
 * harde eis: de constructor genereert een sessie-id met random waarden, en
 * Cloudflare staat "generating random values" buiten een handler niet toe.
 * Deed hij dat wel, dan knapte de SSR-boundary en viel de pagina terug op
 * client-rendering — zichtbaar als `<!--$!-->` in de HTML.
 */
export function getConvexClient(): ConvexReactClient {
	if (!client) client = new ConvexReactClient(url as string);
	return client;
}

// De Convex `*.site`-origin (HTTP actions, feedback-widget) van DEZELFDE
// deployment als de app. Altijd afgeleid van VITE_CONVEX_URL zodat hij nooit
// naar een andere deployment kan wijzen — een verouderde VITE_CONVEX_SITE_URL
// in .env.local lekte eerder de dev-URL een prod-build in.
export const convexSiteUrl: string = url.replace(
	".convex.cloud",
	".convex.site",
);
