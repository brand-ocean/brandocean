import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";

export const add = mutation({
	args: { sectionId: v.id("sections"), label: v.string() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const section = await ctx.db.get(args.sectionId);
		if (!section) throw new ConvexError("not_found");
		const offerte = await ctx.db.get(section.offerteId);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		const existing = await ctx.db
			.query("items")
			.withIndex("by_section", (q) => q.eq("sectionId", args.sectionId))
			.collect();
		const maxOrder = existing.reduce(
			(acc, i) => (i.order > acc ? i.order : acc),
			0,
		);
		return await ctx.db.insert("items", {
			offerteId: section.offerteId,
			sectionId: args.sectionId,
			label: args.label,
			completed: false,
			order: maxOrder + 1000,
		});
	},
});

export const toggle = mutation({
	args: { id: v.id("items") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const item = await ctx.db.get(args.id);
		if (!item) throw new ConvexError("not_found");
		const offerte = await ctx.db.get(item.offerteId);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.patch(args.id, { completed: !item.completed });
	},
});

export const updateLabel = mutation({
	args: { id: v.id("items"), label: v.string() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const item = await ctx.db.get(args.id);
		if (!item) throw new ConvexError("not_found");
		const offerte = await ctx.db.get(item.offerteId);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.patch(args.id, { label: args.label });
	},
});

export const updateNote = mutation({
	args: { id: v.id("items"), note: v.any() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const item = await ctx.db.get(args.id);
		if (!item) throw new ConvexError("not_found");
		const offerte = await ctx.db.get(item.offerteId);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.patch(args.id, { note: args.note });
	},
});

export const remove = mutation({
	args: { id: v.id("items") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const item = await ctx.db.get(args.id);
		if (!item) throw new ConvexError("not_found");
		const offerte = await ctx.db.get(item.offerteId);
		if (!offerte || offerte.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.delete(args.id);
	},
});

export const reorder = mutation({
	args: {
		updates: v.array(v.object({ id: v.id("items"), order: v.number() })),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		if (args.updates.length > 50) throw new ConvexError("too_many_updates");
		for (const u of args.updates) {
			const item = await ctx.db.get(u.id);
			if (!item) continue;
			const offerte = await ctx.db.get(item.offerteId);
			if (!offerte || offerte.ownerId !== userId) {
				throw new ConvexError("forbidden");
			}
			await ctx.db.patch(u.id, { order: u.order });
		}
	},
});

export const rebalanceOne = internalMutation({
	args: { offerteId: v.id("offertes") },
	handler: async (ctx, args) => {
		const sections = await ctx.db
			.query("sections")
			.withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
			.collect();
		for (const section of sections) {
			const items = await ctx.db
				.query("items")
				.withIndex("by_section", (q) => q.eq("sectionId", section._id))
				.collect();
			items.sort((a, b) => a.order - b.order);
			for (let i = 0; i < items.length; i++) {
				const target = (i + 1) * 1000;
				if (items[i].order !== target) {
					await ctx.db.patch(items[i]._id, { order: target });
				}
			}
		}
	},
});

// Call this once to schedule per-offerte rebalances. Each offerte runs in its
// own transaction so we don't blow the per-mutation transaction budget.
export const rebalanceAll = internalMutation({
	args: {},
	handler: async (ctx) => {
		const offertes = await ctx.db.query("offertes").collect();
		for (const offerte of offertes) {
			await ctx.scheduler.runAfter(0, internal.items.rebalanceOne, {
				offerteId: offerte._id,
			});
		}
		return { scheduled: offertes.length };
	},
});
