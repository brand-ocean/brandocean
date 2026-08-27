import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";

export const add = mutation({
	args: { offerteId: v.id("offertes"), title: v.string() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const offerte = await ctx.db.get(args.offerteId);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		const existing = await ctx.db
			.query("sections")
			.withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
			.collect();
		const maxOrder = existing.reduce(
			(acc, s) => (s.order > acc ? s.order : acc),
			0,
		);
		return await ctx.db.insert("sections", {
			offerteId: args.offerteId,
			title: args.title,
			order: maxOrder + 1000,
		});
	},
});

export const rename = mutation({
	args: { id: v.id("sections"), title: v.string() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const section = await ctx.db.get(args.id);
		if (!section) throw new ConvexError("not_found");
		const offerte = await ctx.db.get(section.offerteId);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.patch(args.id, { title: args.title });
	},
});

export const remove = mutation({
	args: { id: v.id("sections") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const section = await ctx.db.get(args.id);
		if (!section) throw new ConvexError("not_found");
		const offerte = await ctx.db.get(section.offerteId);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		const items = await ctx.db
			.query("items")
			.withIndex("by_section", (q) => q.eq("sectionId", args.id))
			.collect();
		for (const item of items) {
			await ctx.db.delete(item._id);
		}
		await ctx.db.delete(args.id);
	},
});

export const reorder = mutation({
	args: {
		updates: v.array(
			v.object({ id: v.id("sections"), order: v.number() }),
		),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		if (args.updates.length > 50) throw new ConvexError("too_many_updates");
		for (const u of args.updates) {
			const section = await ctx.db.get(u.id);
			if (!section) continue;
			const offerte = await ctx.db.get(section.offerteId);
			if (!offerte || offerte.ownerId !== userId) {
				throw new ConvexError("forbidden");
			}
			await ctx.db.patch(u.id, { order: u.order });
		}
	},
});
