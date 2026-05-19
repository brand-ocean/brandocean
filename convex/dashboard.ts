import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const summary = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;
		const [offertes, tasks, clients] = await Promise.all([
			ctx.db
				.query("offertes")
				.withIndex("by_owner", (q) => q.eq("ownerId", userId))
				.collect(),
			ctx.db
				.query("tasks")
				.withIndex("by_owner", (q) => q.eq("ownerId", userId))
				.collect(),
			ctx.db
				.query("clients")
				.withIndex("by_owner", (q) => q.eq("ownerId", userId))
				.collect(),
		]);

		const weekAgo = Date.now() - WEEK_MS;

		return {
			offerteStats: {
				total: offertes.length,
				drafts: offertes.filter((o) => !o.published).length,
				shared: offertes.filter((o) => o.published).length,
			},
			taskStats: {
				total: tasks.length,
				todo: tasks.filter((t) => t.status === "todo").length,
				inProgress: tasks.filter((t) => t.status === "in_progress").length,
				doneThisWeek: tasks.filter(
					(t) => t.status === "done" && t.updatedAt >= weekAgo,
				).length,
			},
			clientCount: clients.length,
		};
	},
});

export const recents = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;
		const [offertes, tasks] = await Promise.all([
			ctx.db
				.query("offertes")
				.withIndex("by_owner_updated", (q) => q.eq("ownerId", userId))
				.order("desc")
				.take(5),
			ctx.db
				.query("tasks")
				.withIndex("by_owner_updated", (q) => q.eq("ownerId", userId))
				.order("desc")
				.take(5),
		]);
		return {
			offertes: offertes.map((o) => ({
				_id: o._id,
				title: o.title,
				updatedAt: o.updatedAt,
				published: o.published,
			})),
			tasks: tasks.map((t) => ({
				_id: t._id,
				title: t.title,
				status: t.status,
				updatedAt: t.updatedAt,
			})),
		};
	},
});
