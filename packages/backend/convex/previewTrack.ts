import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

/**
 * Gebruik van de kijkversie van een preview-bord (/preview/<slug>), voor het
 * dashboard "Borden". De kijkversie stuurt gebundelde events naar het
 * HTTP-endpoint /preview/track (zie http.ts), dat ze via `record` wegschrijft.
 * Lezen kan alleen ingelogd (dashboard). Alles per slug, met harde
 * bovengrenzen: korte strings, hoogstens 50 events per aanroep.
 */

const SLUG_MAX = 64;
const KEY_MAX = 64;
const STR_MAX = 200;
const BATCH_MAX = 50;
const LIST_MAX = 4000;

const kindV = v.union(
	v.literal("open"),
	v.literal("step"),
	v.literal("view"),
	v.literal("search"),
	v.literal("fly"),
	v.literal("closing"),
	v.literal("cta"),
	v.literal("leave"),
);

const dataV = v.object({
	client: v.optional(v.string()),
	title: v.optional(v.string()),
	device: v.optional(v.string()),
	referrer: v.optional(v.string()),
	returning: v.optional(v.boolean()),
	step: v.optional(v.number()),
	card: v.optional(v.string()),
	label: v.optional(v.string()),
	ms: v.optional(v.number()),
	q: v.optional(v.string()),
	cta: v.optional(v.string()),
});

const eventV = v.object({ kind: kindV, at: v.number(), data: v.optional(dataV) });

function clip(s: string | undefined, max: number): string | undefined {
	if (s === undefined) return undefined;
	const t = s.trim();
	return t ? t.slice(0, max) : undefined;
}

/** Schrijft een bundel events weg; wordt alleen vanuit http.ts aangeroepen. */
export const record = internalMutation({
	args: {
		slug: v.string(),
		visitor: v.string(),
		session: v.string(),
		events: v.array(eventV),
	},
	handler: async (ctx, args) => {
		const slug = clip(args.slug, SLUG_MAX);
		const visitor = clip(args.visitor, KEY_MAX);
		const session = clip(args.session, KEY_MAX);
		if (!slug || !visitor || !session) return null;
		for (const e of args.events.slice(0, BATCH_MAX)) {
			const d = e.data;
			await ctx.db.insert("previewEvents", {
				slug,
				visitor,
				session,
				kind: e.kind,
				at: Number.isFinite(e.at) ? e.at : Date.now(),
				data: d
					? {
							client: clip(d.client, STR_MAX),
							title: clip(d.title, STR_MAX),
							device: clip(d.device, 32),
							referrer: clip(d.referrer, STR_MAX),
							returning: d.returning,
							step: d.step,
							card: clip(d.card, STR_MAX),
							label: clip(d.label, STR_MAX),
							ms: d.ms,
							q: clip(d.q, STR_MAX),
							cta: clip(d.cta, 32),
						}
					: undefined,
			});
		}
		return null;
	},
});

/** Alle borden die ooit geopend zijn, met laatste activiteit en aantal kijkers. */
export const boards = query({
	args: {},
	handler: async (ctx) => {
		if (!(await getAuthUserId(ctx))) return [];
		const opens = await ctx.db
			.query("previewEvents")
			.order("desc")
			.take(LIST_MAX);
		const bySlug = new Map<
			string,
			{
				slug: string;
				client: string;
				title: string;
				visitors: Set<string>;
				sessions: Set<string>;
				lastAt: number;
				ctas: number;
			}
		>();
		for (const e of opens) {
			const b = bySlug.get(e.slug) ?? {
				slug: e.slug,
				client: "",
				title: "",
				visitors: new Set<string>(),
				sessions: new Set<string>(),
				lastAt: 0,
				ctas: 0,
			};
			if (e.kind === "open") {
				b.client ||= e.data?.client ?? "";
				b.title ||= e.data?.title ?? "";
			}
			if (e.kind === "cta") b.ctas++;
			b.visitors.add(e.visitor);
			b.sessions.add(e.session);
			b.lastAt = Math.max(b.lastAt, e.at);
			bySlug.set(e.slug, b);
		}
		return [...bySlug.values()]
			.map((b) => ({
				slug: b.slug,
				client: b.client || b.slug,
				title: b.title,
				visitors: b.visitors.size,
				sessions: b.sessions.size,
				lastAt: b.lastAt,
				ctas: b.ctas,
			}))
			.sort((a, b) => b.lastAt - a.lastAt);
	},
});

/** Alle events van één bord, nieuwste eerst; het dashboard telt zelf op. */
export const events = query({
	args: { slug: v.string() },
	handler: async (ctx, { slug }) => {
		if (!(await getAuthUserId(ctx))) return [];
		return await ctx.db
			.query("previewEvents")
			.withIndex("by_slug_at", (q) => q.eq("slug", slug))
			.order("desc")
			.take(LIST_MAX);
	},
});
