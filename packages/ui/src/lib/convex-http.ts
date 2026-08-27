import { ConvexHttpClient } from "convex/browser";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!url) {
	throw new Error(
		"VITE_CONVEX_URL is not set. Run `bunx convex dev` to provision a deployment.",
	);
}

export const convexHttp = new ConvexHttpClient(url);
