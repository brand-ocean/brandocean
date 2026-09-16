import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";

/**
 * Toegang tot de beheerversie van een bord (/preview/<slug>/beheer). De
 * publieke link is altijd de kijkversie; beheren kan alleen met de sleutel
 * uit `PREVIEW_OWNER_KEY` (Cloudflare-secret, lokaal in apps/site/.dev.vars).
 * Eén keer invullen zet een httpOnly-cookie voor een jaar; de sleutel zelf
 * verlaat de server nooit, dus in de bundel staat niets te vinden.
 */

const COOKIE = "bo-preview-owner";
const YEAR = 60 * 60 * 24 * 365;

function ownerKey(): string {
	return process.env.PREVIEW_OWNER_KEY ?? "";
}

/** Is deze browser al ontgrendeld als beheerder? */
export const ownerAccess = createServerFn({ method: "GET" }).handler(
	async () => {
		const key = ownerKey();
		return !!key && getCookie(COOKIE) === key;
	},
);

/** Sleutel proberen; bij een match blijft de browser een jaar ontgrendeld. */
export const unlockOwner = createServerFn({ method: "POST" })
	.inputValidator((data: { key: string }) => ({
		key: String(data.key ?? "").trim(),
	}))
	.handler(async ({ data }) => {
		const key = ownerKey();
		if (!key || data.key !== key) return false;
		setCookie(COOKIE, key, {
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
			maxAge: YEAR,
		});
		return true;
	});
