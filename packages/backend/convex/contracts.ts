import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { customAlphabet } from "nanoid";
import { mutation, query } from "./_generated/server";

const slugAlphabet =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const newSlug = customAlphabet(slugAlphabet, 12);

export const signFromOfferte = mutation({
	args: {
		slug: v.string(),
		token: v.string(),
		signedByName: v.string(),
		signedByEmail: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const offerte = await ctx.db
			.query("offertes")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (!offerte) throw new ConvexError("not_found");
		if (!offerte.published) throw new ConvexError("not_available");
		if (offerte.shareToken !== args.token)
			throw new ConvexError("invalid_token");
		const sections = await ctx.db
			.query("sections")
			.withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
			.collect();
		const items = await ctx.db
			.query("items")
			.withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
			.collect();
		const sectionOrderById = new Map(
			sections.map((s) => [s._id, s.order] as const),
		);
		const contractSlug = newSlug();
		const contractId = await ctx.db.insert("contracts", {
			offerteId: offerte._id,
			ownerId: offerte.ownerId,
			clientId: offerte.clientId,
			title: offerte.title,
			bodySnapshot: offerte.body,
			sectionsSnapshot: sections.map((s) => ({
				title: s.title,
				order: s.order,
			})),
			itemsSnapshot: items.map((i) => ({
				sectionOrder: sectionOrderById.get(i.sectionId) ?? 0,
				label: i.label,
				order: i.order,
			})),
			signedAt: Date.now(),
			signedByName: args.signedByName,
			signedByEmail: args.signedByEmail,
			slug: contractSlug,
		});
		return { contractId, slug: contractSlug };
	},
});

export const getBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const contract = await ctx.db
			.query("contracts")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (!contract) return null;
		return contract;
	},
});

export const listByOwner = query({
	args: { clientId: v.optional(v.id("clients")) },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const all = await ctx.db
			.query("contracts")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.order("desc")
			.collect();
		if (args.clientId === undefined) return all;
		return all.filter((c) => c.clientId === args.clientId);
	},
});
