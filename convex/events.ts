import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

const kindValidator = v.union(
	v.literal("meeting"),
	v.literal("deadline"),
	v.literal("milestone"),
);

export const list = query({
	args: {
		clientId: v.optional(v.id("clients")),
		from: v.optional(v.number()),
		to: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const all = await ctx.db
			.query("events")
			.withIndex("by_owner_starts", (q) => q.eq("ownerId", userId))
			.collect();
		return all.filter((e) => {
			if (args.clientId !== undefined && e.clientId !== args.clientId)
				return false;
			if (args.from !== undefined && e.startsAt < args.from) return false;
			if (args.to !== undefined && e.startsAt > args.to) return false;
			return true;
		});
	},
});

export const create = mutation({
	args: {
		title: v.string(),
		startsAt: v.number(),
		endsAt: v.number(),
		clientId: v.optional(v.id("clients")),
		location: v.optional(v.string()),
		notes: v.optional(v.string()),
		kind: v.optional(kindValidator),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		return await ctx.db.insert("events", {
			ownerId: userId,
			clientId: args.clientId,
			title: args.title,
			startsAt: args.startsAt,
			endsAt: args.endsAt,
			location: args.location,
			notes: args.notes,
			kind: args.kind ?? "meeting",
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("events"),
		title: v.optional(v.string()),
		startsAt: v.optional(v.number()),
		endsAt: v.optional(v.number()),
		clientId: v.optional(v.id("clients")),
		location: v.optional(v.string()),
		notes: v.optional(v.string()),
		kind: v.optional(kindValidator),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const event = await ctx.db.get(args.id);
		if (!event || event.ownerId !== userId)
			throw new ConvexError("forbidden");
		await ctx.db.patch(args.id, {
			...(args.title !== undefined ? { title: args.title } : {}),
			...(args.startsAt !== undefined ? { startsAt: args.startsAt } : {}),
			...(args.endsAt !== undefined ? { endsAt: args.endsAt } : {}),
			...(args.clientId !== undefined ? { clientId: args.clientId } : {}),
			...(args.location !== undefined ? { location: args.location } : {}),
			...(args.notes !== undefined ? { notes: args.notes } : {}),
			...(args.kind !== undefined ? { kind: args.kind } : {}),
		});
	},
});

export const remove = mutation({
	args: { id: v.id("events") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const event = await ctx.db.get(args.id);
		if (!event || event.ownerId !== userId)
			throw new ConvexError("forbidden");
		await ctx.db.delete(args.id);
	},
});
