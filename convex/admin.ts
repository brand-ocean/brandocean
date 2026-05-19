import { v } from "convex/values";
import { customAlphabet } from "nanoid";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const slugAlphabet =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const newSlugSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 4);
const newShareToken = customAlphabet(slugAlphabet, 24);

function slugifyBase(input: string): string {
	const base = input
		.toLowerCase()
		.normalize("NFKD")
		.replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	return base || "offerte";
}

async function makeUniqueOfferteSlug(
	ctx: MutationCtx,
	base: string,
): Promise<string> {
	const root = slugifyBase(base);
	const existing = await ctx.db
		.query("offertes")
		.withIndex("by_slug", (q) => q.eq("slug", root))
		.first();
	if (!existing) return root;
	for (let i = 2; i < 50; i++) {
		const candidate = `${root}-${i}`;
		const found = await ctx.db
			.query("offertes")
			.withIndex("by_slug", (q) => q.eq("slug", candidate))
			.first();
		if (!found) return candidate;
	}
	return `${root}-${newSlugSuffix()}`;
}

export const listOffertesMeta = internalQuery({
	args: {},
	handler: async (ctx) => {
		const all = await ctx.db.query("offertes").collect();
		return all.map((o) => ({
			id: o._id,
			title: o.title,
			slug: o.slug,
			ownerId: o.ownerId,
			published: o.published,
			publicReadable: o.publicReadable,
			hasBody: o.body != null,
		}));
	},
});

export const exportOfferte = internalQuery({
	args: { id: v.id("offertes") },
	handler: async (ctx, args) => {
		const offerte = await ctx.db.get(args.id);
		if (!offerte) throw new Error(`offerte ${args.id} not found`);
		const sections = await ctx.db
			.query("sections")
			.withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
			.collect();
		const sorted = [...sections].sort((a, b) => a.order - b.order);
		const items = await ctx.db
			.query("items")
			.withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
			.collect();
		const orderById = new Map(sorted.map((s) => [s._id, s.order]));
		return {
			title: offerte.title,
			slug: offerte.slug,
			body: offerte.body,
			shareToken: offerte.shareToken,
			schemaVersion: offerte.schemaVersion,
			published: offerte.published,
			publicReadable: offerte.publicReadable,
			ownerId: offerte.ownerId,
			sections: sorted.map((s) => ({ title: s.title, order: s.order })),
			items: items.map((it) => ({
				sectionOrder: orderById.get(it.sectionId) ?? 0,
				label: it.label,
				note: it.note,
				completed: it.completed,
				order: it.order,
			})),
		};
	},
});

export const setOfferteBody = internalMutation({
	args: { id: v.id("offertes"), body: v.any() },
	handler: async (ctx, args) => {
		const offerte = await ctx.db.get(args.id);
		if (!offerte) throw new Error(`offerte ${args.id} not found`);
		await ctx.db.patch(args.id, { body: args.body, updatedAt: Date.now() });
		return { id: args.id, title: offerte.title };
	},
});

export const duplicateOfferte = internalMutation({
	args: {
		id: v.id("offertes"),
		count: v.optional(v.number()),
		titleSuffix: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const source = await ctx.db.get(args.id);
		if (!source) throw new Error(`offerte ${args.id} not found`);
		const sections = await ctx.db
			.query("sections")
			.withIndex("by_offerte", (q) => q.eq("offerteId", source._id))
			.collect();
		const items = await ctx.db
			.query("items")
			.withIndex("by_offerte", (q) => q.eq("offerteId", source._id))
			.collect();

		const count = Math.max(1, Math.min(args.count ?? 1, 10));
		const suffix = args.titleSuffix ?? " (kopie)";
		const created: { id: Id<"offertes">; slug: string; title: string }[] = [];

		for (let n = 0; n < count; n++) {
			const title =
				count > 1
					? `${source.title}${suffix} ${n + 1}`
					: `${source.title}${suffix}`;
			const slug = await makeUniqueOfferteSlug(ctx, title);
			const now = Date.now();
			const newOfferteId = await ctx.db.insert("offertes", {
				ownerId: source.ownerId,
				clientId: source.clientId,
				title,
				body: source.body,
				slug,
				shareToken: newShareToken(),
				published: false,
				publicReadable: false,
				schemaVersion: source.schemaVersion,
				createdAt: now,
				updatedAt: now,
			});

			const sectionMap = new Map<Id<"sections">, Id<"sections">>();
			for (const s of sections) {
				const newSectionId = await ctx.db.insert("sections", {
					offerteId: newOfferteId,
					title: s.title,
					order: s.order,
				});
				sectionMap.set(s._id, newSectionId);
			}
			for (const it of items as Doc<"items">[]) {
				const mappedSection = sectionMap.get(it.sectionId);
				if (!mappedSection) continue;
				await ctx.db.insert("items", {
					offerteId: newOfferteId,
					sectionId: mappedSection,
					label: it.label,
					note: it.note,
					completed: it.completed,
					order: it.order,
				});
			}
			created.push({ id: newOfferteId, slug, title });
		}

		return {
			source: { id: source._id, title: source.title },
			created,
		};
	},
});

type JsonNode = {
	type?: string;
	content?: JsonNode[];
	text?: string;
	[k: string]: unknown;
};

function visitText(node: JsonNode, fn: (text: string) => string): JsonNode {
	if (node.text && typeof node.text === "string") {
		return { ...node, text: fn(node.text) };
	}
	if (Array.isArray(node.content)) {
		return { ...node, content: node.content.map((c) => visitText(c, fn)) };
	}
	return node;
}

function dropMatchingHeadings(
	node: JsonNode,
	matches: (text: string) => boolean,
): JsonNode {
	if (Array.isArray(node.content)) {
		const filtered = node.content
			.filter((c) => {
				if (c.type !== "heading") return true;
				const inner = (c.content ?? []).map((t) => t.text ?? "").join("");
				return !matches(inner.trim());
			})
			.map((c) => dropMatchingHeadings(c, matches));
		return { ...node, content: filtered };
	}
	return node;
}

export const cleanupOfferteBody = internalMutation({
	args: {
		slug: v.string(),
		replaceTitle: v.optional(
			v.object({ find: v.string(), replace: v.string() }),
		),
		dropHeadings: v.optional(v.array(v.string())),
	},
	handler: async (ctx, args) => {
		const offerte = await ctx.db
			.query("offertes")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (!offerte) throw new Error(`offerte not found for slug ${args.slug}`);
		let body = (offerte.body as JsonNode | undefined) ?? null;
		if (!body) return { id: offerte._id, changed: false };
		if (args.replaceTitle) {
			const { find, replace } = args.replaceTitle;
			body = visitText(body, (t) =>
				t.includes(find) ? t.split(find).join(replace) : t,
			);
		}
		if (args.dropHeadings && args.dropHeadings.length > 0) {
			const drops = args.dropHeadings.map((s) => s.trim().toLowerCase());
			body = dropMatchingHeadings(body, (text) =>
				drops.includes(text.toLowerCase()),
			);
		}
		const newTitle = offerte.title.replace(/^FORZ OS — Offerte$/, "FORZ OS");
		await ctx.db.patch(offerte._id, {
			body,
			title: newTitle,
			updatedAt: Date.now(),
		});
		return { id: offerte._id, changed: true };
	},
});

export const replaceFromHeading = internalMutation({
	args: {
		slug: v.string(),
		headingText: v.string(),
		replacement: v.any(),
	},
	handler: async (ctx, args) => {
		const offerte = await ctx.db
			.query("offertes")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (!offerte) throw new Error(`offerte not found for slug ${args.slug}`);
		const body = offerte.body as JsonNode | undefined;
		if (!body || !Array.isArray(body.content)) {
			return { changed: false, reason: "empty_body" as const };
		}
		const target = args.headingText.trim().toLowerCase();
		const idx = body.content.findIndex((c) => {
			if (c.type !== "heading") return false;
			const inner = (c.content ?? [])
				.map((t) => t.text ?? "")
				.join("")
				.trim()
				.toLowerCase();
			return inner === target;
		});
		if (idx < 0) {
			return { changed: false, reason: "heading_not_found" as const };
		}
		const replacement = args.replacement as JsonNode[];
		const newContent = [...body.content.slice(0, idx), ...replacement];
		await ctx.db.patch(offerte._id, {
			body: { ...body, content: newContent },
			updatedAt: Date.now(),
		});
		return { changed: true, removedFromIndex: idx };
	},
});

export const publishOffertePublic = internalMutation({
	args: {
		slugCurrent: v.string(),
		slugNew: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const offerte = await ctx.db
			.query("offertes")
			.withIndex("by_slug", (q) => q.eq("slug", args.slugCurrent))
			.unique();
		if (!offerte) {
			throw new Error(`offerte not found for slug ${args.slugCurrent}`);
		}
		const slug = args.slugNew ?? offerte.slug;
		if (slug !== offerte.slug) {
			const taken = await ctx.db
				.query("offertes")
				.withIndex("by_slug", (q) => q.eq("slug", slug))
				.unique();
			if (taken) {
				throw new Error(`slug ${slug} already taken`);
			}
		}
		await ctx.db.patch(offerte._id, {
			slug,
			published: true,
			publicReadable: true,
			updatedAt: Date.now(),
		});
		return { id: offerte._id, slug };
	},
});

export const importOfferte = internalMutation({
	args: {
		slug: v.string(),
		title: v.string(),
		body: v.optional(v.any()),
		shareToken: v.string(),
		schemaVersion: v.number(),
		published: v.boolean(),
		publicReadable: v.boolean(),
		ownerId: v.string(),
		clientId: v.optional(v.string()),
		sections: v.optional(
			v.array(v.object({ title: v.string(), order: v.number() })),
		),
		items: v.optional(
			v.array(
				v.object({
					sectionOrder: v.number(),
					label: v.string(),
					note: v.optional(v.any()),
					completed: v.boolean(),
					order: v.number(),
				}),
			),
		),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("offertes")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (existing) {
			await ctx.db.patch(existing._id, {
				title: args.title,
				body: args.body,
				shareToken: args.shareToken,
				schemaVersion: args.schemaVersion,
				published: args.published,
				publicReadable: args.publicReadable,
				updatedAt: Date.now(),
			});
			return { id: existing._id, action: "updated" as const };
		}
		const now = Date.now();
		const offerteId = await ctx.db.insert("offertes", {
			ownerId: args.ownerId as Id<"users">,
			clientId: args.clientId
				? (args.clientId as Id<"clients">)
				: undefined,
			title: args.title,
			body: args.body,
			slug: args.slug,
			shareToken: args.shareToken,
			published: args.published,
			publicReadable: args.publicReadable,
			schemaVersion: args.schemaVersion,
			createdAt: now,
			updatedAt: now,
		});
		const sectionIdByOrder = new Map<number, Id<"sections">>();
		for (const s of args.sections ?? []) {
			const sid = await ctx.db.insert("sections", {
				offerteId,
				title: s.title,
				order: s.order,
			});
			sectionIdByOrder.set(s.order, sid);
		}
		for (const it of args.items ?? []) {
			const sectionId = sectionIdByOrder.get(it.sectionOrder);
			if (!sectionId) continue;
			await ctx.db.insert("items", {
				offerteId,
				sectionId,
				label: it.label,
				note: it.note,
				completed: it.completed,
				order: it.order,
			});
		}
		return { id: offerteId, action: "created" as const };
	},
});
