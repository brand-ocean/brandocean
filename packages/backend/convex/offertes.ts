import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { customAlphabet } from "nanoid";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const slugAlphabet =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const newSlugSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 4);
const newShareToken = customAlphabet(slugAlphabet, 24);

function slugifyBase(input: string): string {
	const base = input
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
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

const SCHEMA_VERSION = 1;

export const create = mutation({
	args: {
		title: v.string(),
		clientId: v.optional(v.id("clients")),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const client = args.clientId ? await ctx.db.get(args.clientId) : null;
		const base = client?.name ? `${client.name} ${args.title}` : args.title;
		const slug = await makeUniqueOfferteSlug(ctx, base);
		const now = Date.now();
		return await ctx.db.insert("offertes", {
			ownerId: userId,
			clientId: args.clientId,
			title: args.title,
			slug,
			shareToken: newShareToken(),
			published: false,
			publicReadable: false,
			schemaVersion: SCHEMA_VERSION,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const listByOwner = query({
	args: { clientId: v.optional(v.id("clients")) },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const all = await ctx.db
			.query("offertes")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.order("desc")
			.collect();
		if (args.clientId === undefined) return all;
		return all.filter((o) => o.clientId === args.clientId);
	},
});

export const getById = query({
	args: { id: v.id("offertes") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const offerte = await ctx.db.get(args.id);
		if (!offerte) throw new ConvexError("not_found");
		if (offerte.ownerId !== userId) throw new ConvexError("forbidden");
		const sections = await ctx.db
			.query("sections")
			.withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
			.collect();
		const items = await ctx.db
			.query("items")
			.withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
			.collect();
		return { offerte, sections, items };
	},
});

export const getBySlug = query({
	args: { slug: v.string(), token: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const offerte = await ctx.db
			.query("offertes")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (!offerte) return null;
		if (!offerte.published) return null;
		const tokenMatches = args.token === offerte.shareToken;
		if (!offerte.publicReadable && !tokenMatches) return null;
		const sections = await ctx.db
			.query("sections")
			.withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
			.collect();
		const items = await ctx.db
			.query("items")
			.withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
			.collect();
		return {
			offerte,
			sections,
			items,
			mode: tokenMatches ? ("edit" as const) : ("readonly" as const),
		};
	},
});

export const updateMeta = mutation({
	args: {
		id: v.id("offertes"),
		title: v.optional(v.string()),
		clientId: v.optional(v.id("clients")),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const offerte = await ctx.db.get(args.id);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.patch(args.id, {
			updatedAt: Date.now(),
			...(args.title !== undefined ? { title: args.title } : {}),
			...(args.clientId !== undefined ? { clientId: args.clientId } : {}),
		});
	},
});

export const updateBody = mutation({
	args: {
		id: v.id("offertes"),
		body: v.any(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const offerte = await ctx.db.get(args.id);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.patch(args.id, {
			body: args.body,
			updatedAt: Date.now(),
		});
	},
});

export const regenerateSlug = mutation({
	args: { id: v.id("offertes") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const offerte = await ctx.db.get(args.id);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		const client = offerte.clientId ? await ctx.db.get(offerte.clientId) : null;
		const base = client?.name ? `${client.name} ${offerte.title}` : offerte.title;
		const slug = await makeUniqueOfferteSlug(ctx, base);
		await ctx.db.patch(args.id, { slug, updatedAt: Date.now() });
		return slug;
	},
});

export const publish = mutation({
	args: { id: v.id("offertes"), publicReadable: v.boolean() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const offerte = await ctx.db.get(args.id);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.patch(args.id, {
			published: true,
			publicReadable: args.publicReadable,
			updatedAt: Date.now(),
		});
	},
});

export const unpublish = mutation({
	args: { id: v.id("offertes") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const offerte = await ctx.db.get(args.id);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.patch(args.id, {
			published: false,
			updatedAt: Date.now(),
		});
	},
});

export const remove = mutation({
	args: { id: v.id("offertes") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const offerte = await ctx.db.get(args.id);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		const sections = await ctx.db
			.query("sections")
			.withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
			.collect();
		const items = await ctx.db
			.query("items")
			.withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
			.collect();
		await Promise.all(items.map((i) => ctx.db.delete(i._id)));
		await Promise.all(sections.map((s) => ctx.db.delete(s._id)));
		await ctx.db.delete(args.id);
	},
});
