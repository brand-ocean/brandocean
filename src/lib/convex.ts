import { ConvexReactClient } from "convex/react";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!url) {
	throw new Error(
		"VITE_CONVEX_URL is not set. Run `bunx convex dev` to provision a deployment.",
	);
}

export const convex = new ConvexReactClient(url);

// The Convex `*.site` origin (HTTP actions, feedback widget) for the SAME
// deployment as the app. ALWAYS derived from VITE_CONVEX_URL so it can never
// point at a different deployment — a stale VITE_CONVEX_SITE_URL in .env.local
// previously leaked the dev URL into a prod build.
export const convexSiteUrl: string = url.replace(
	".convex.cloud",
	".convex.site",
);
