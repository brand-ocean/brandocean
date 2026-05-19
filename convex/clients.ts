import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		return await ctx.db
			.query("clients")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();
	},
});

export const listWithCounts = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const clients = await ctx.db
			.query("clients")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();
		const offertes = await ctx.db
			.query("offertes")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();
		return clients.map((c) => ({
			...c,
			offerteCount: offertes.filter((o) => o.clientId === c._id).length,
		}));
	},
});

export const getById = query({
	args: { id: v.id("clients") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;
		const client = await ctx.db.get(args.id);
		if (!client || client.ownerId !== userId) return null;
		return client;
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		email: v.optional(v.string()),
		companyName: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		return await ctx.db.insert("clients", {
			ownerId: userId,
			name: args.name,
			email: args.email,
			companyName: args.companyName,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("clients"),
		name: v.optional(v.string()),
		email: v.optional(v.string()),
		companyName: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const client = await ctx.db.get(args.id);
		if (!client || client.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.patch(args.id, {
			...(args.name !== undefined ? { name: args.name } : {}),
			...(args.email !== undefined ? { email: args.email } : {}),
			...(args.companyName !== undefined
				? { companyName: args.companyName }
				: {}),
		});
	},
});

export const remove = mutation({
	args: { id: v.id("clients") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const client = await ctx.db.get(args.id);
		if (!client || client.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.delete(args.id);
	},
});
