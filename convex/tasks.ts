import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const statusValidator = v.union(
	v.literal("prio"),
	v.literal("in_review"),
	v.literal("todo"),
	v.literal("in_progress"),
	v.literal("done"),
	v.literal("canceled"),
);

const priorityValidator = v.union(
	v.literal("low"),
	v.literal("medium"),
	v.literal("high"),
);

const ORDER_STEP = 1000;

export const list = query({
	args: {
		clientId: v.optional(v.id("clients")),
		status: v.optional(statusValidator),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const all = await ctx.db
			.query("tasks")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.order("desc")
			.collect();
		const filtered = all.filter((t) => {
			if (args.clientId !== undefined && t.clientId !== args.clientId)
				return false;
			if (args.status !== undefined && t.status !== args.status) return false;
			return true;
		});
		filtered.sort((a, b) => {
			const ao = a.order ?? Number.POSITIVE_INFINITY;
			const bo = b.order ?? Number.POSITIVE_INFINITY;
			if (ao !== bo) return ao - bo;
			return b._creationTime - a._creationTime;
		});
		return filtered;
	},
});

export const create = mutation({
	args: {
		title: v.string(),
		clientId: v.optional(v.id("clients")),
		status: v.optional(statusValidator),
		priority: v.optional(priorityValidator),
		label: v.optional(v.string()),
		dueAt: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const now = Date.now();
		const status = args.status ?? "todo";
		const columnRows = await ctx.db
			.query("tasks")
			.withIndex("by_owner_status_order", (q) =>
				q.eq("ownerId", userId).eq("status", status),
			)
			.collect();
		const maxOrder = columnRows.reduce(
			(acc, row) =>
				row.order !== undefined && row.order > acc ? row.order : acc,
			0,
		);
		return await ctx.db.insert("tasks", {
			ownerId: userId,
			clientId: args.clientId,
			title: args.title,
			status,
			priority: args.priority ?? "medium",
			label: args.label,
			dueAt: args.dueAt,
			order: maxOrder + ORDER_STEP,
			createdAt: now,
			updatedAt: now,
		});
	},
});

async function assertOwn(
	ctx: { db: { get: (id: Id<"tasks">) => Promise<unknown> } },
	id: Id<"tasks">,
	userId: Id<"users">,
) {
	const task = (await ctx.db.get(id)) as { ownerId: Id<"users"> } | null;
	if (!task) throw new ConvexError("not_found");
	if (task.ownerId !== userId) throw new ConvexError("forbidden");
	return task;
}

export const updateStatus = mutation({
	args: { id: v.id("tasks"), status: statusValidator },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		await assertOwn(ctx, args.id, userId);
		await ctx.db.patch(args.id, {
			status: args.status,
			updatedAt: Date.now(),
		});
	},
});

export const updatePriority = mutation({
	args: { id: v.id("tasks"), priority: priorityValidator },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		await assertOwn(ctx, args.id, userId);
		await ctx.db.patch(args.id, {
			priority: args.priority,
			updatedAt: Date.now(),
		});
	},
});

export const updateLabel = mutation({
	args: { id: v.id("tasks"), label: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		await assertOwn(ctx, args.id, userId);
		await ctx.db.patch(args.id, {
			label: args.label,
			updatedAt: Date.now(),
		});
	},
});

export const rename = mutation({
	args: { id: v.id("tasks"), title: v.string() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		await assertOwn(ctx, args.id, userId);
		await ctx.db.patch(args.id, {
			title: args.title,
			updatedAt: Date.now(),
		});
	},
});

export const setClient = mutation({
	args: { id: v.id("tasks"), clientId: v.optional(v.id("clients")) },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		await assertOwn(ctx, args.id, userId);
		await ctx.db.patch(args.id, {
			clientId: args.clientId,
			updatedAt: Date.now(),
		});
	},
});

export const setDueAt = mutation({
	args: { id: v.id("tasks"), dueAt: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		await assertOwn(ctx, args.id, userId);
		await ctx.db.patch(args.id, {
			dueAt: args.dueAt,
			updatedAt: Date.now(),
		});
	},
});

export const remove = mutation({
	args: { id: v.id("tasks") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		await assertOwn(ctx, args.id, userId);
		await ctx.db.delete(args.id);
	},
});

export const move = mutation({
	args: {
		id: v.id("tasks"),
		status: statusValidator,
		targetIndex: v.number(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		await assertOwn(ctx, args.id, userId);

		const others = (
			await ctx.db
				.query("tasks")
				.withIndex("by_owner_status_order", (q) =>
					q.eq("ownerId", userId).eq("status", args.status),
				)
				.collect()
		).filter((t) => t._id !== args.id);

		others.sort((a, b) => {
			const ao = a.order ?? Number.POSITIVE_INFINITY;
			const bo = b.order ?? Number.POSITIVE_INFINITY;
			if (ao !== bo) return ao - bo;
			return a._creationTime - b._creationTime;
		});

		const clampedIndex = Math.max(
			0,
			Math.min(args.targetIndex, others.length),
		);
		const moved = await ctx.db.get(args.id);
		if (!moved) throw new ConvexError("not_found");

		const reordered = [...others];
		reordered.splice(clampedIndex, 0, moved);

		const now = Date.now();
		for (let i = 0; i < reordered.length; i++) {
			const row = reordered[i];
			const desiredOrder = (i + 1) * ORDER_STEP;
			if (row._id === args.id) {
				await ctx.db.patch(row._id, {
					status: args.status,
					order: desiredOrder,
					updatedAt: now,
				});
			} else if (row.order !== desiredOrder) {
				await ctx.db.patch(row._id, { order: desiredOrder });
			}
		}
	},
});
