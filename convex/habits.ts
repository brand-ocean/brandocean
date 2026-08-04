import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";

export const MAX_TRACKERS = 6;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertDay(day: string) {
	if (!DAY_RE.test(day)) throw new ConvexError("bad_day");
}

// Local "YYYY-MM-DD" minus n days, computed in UTC so string math is
// deterministic regardless of server timezone.
function daysBefore(day: string, n: number) {
	const [y, m, d] = day.split("-").map(Number);
	const t = new Date(Date.UTC(y, m - 1, d - n));
	return t.toISOString().slice(0, 10);
}

const trackerFields = {
	name: v.string(),
	emoji: v.string(),
	step: v.number(),
	unit: v.optional(v.string()),
	color: v.string(),
};

async function getOwnTracker(
	ctx: { db: { get: (id: Id<"habitTrackers">) => Promise<unknown> } },
	id: Id<"habitTrackers">,
	userId: Id<"users">,
) {
	const tracker = (await ctx.db.get(id)) as {
		ownerId: Id<"users">;
		step: number;
		total: number;
	} | null;
	if (!tracker) throw new ConvexError("not_found");
	if (tracker.ownerId !== userId) throw new ConvexError("forbidden");
	return tracker;
}

// Trackers in button order, each with today's, this week's and lifetime
// totals. `day` is the client's local date so counts roll over at their
// midnight.
export const list = query({
	args: { day: v.string() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		assertDay(args.day);
		const weekStart = daysBefore(args.day, 6);

		const trackers = await ctx.db
			.query("habitTrackers")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.take(MAX_TRACKERS);
		trackers.sort((a, b) => a.order - b.order);

		return await Promise.all(
			trackers.map(async (tracker) => {
				const weekLogs = await ctx.db
					.query("habitLogs")
					.withIndex("by_tracker_day", (q) =>
						q
							.eq("trackerId", tracker._id)
							.gte("day", weekStart)
							.lte("day", args.day),
					)
					.take(1000);
				let today = 0;
				let week = 0;
				let todayTaps = 0;
				for (const log of weekLogs) {
					week += log.amount;
					if (log.day === args.day) {
						today += log.amount;
						todayTaps += 1;
					}
				}
				return { ...tracker, today, todayTaps, week };
			}),
		);
	},
});

// Creates the three starter buttons on first visit. Idempotent: does nothing
// once the owner has any tracker.
export const ensureDefaults = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const existing = await ctx.db
			.query("habitTrackers")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.take(1);
		if (existing.length > 0) return;
		const now = Date.now();
		const defaults = [
			{ name: "Push-ups", emoji: "💪", step: 10, unit: "push-ups", color: "emerald" },
			{ name: "Unhealthy food", emoji: "🍔", step: 1, unit: undefined, color: "amber" },
			{ name: "Swearing", emoji: "🤬", step: 1, unit: undefined, color: "rose" },
		];
		for (let i = 0; i < defaults.length; i++) {
			await ctx.db.insert("habitTrackers", {
				ownerId: userId,
				...defaults[i],
				order: i,
				total: 0,
				createdAt: now,
			});
		}
	},
});

export const tap = mutation({
	args: { trackerId: v.id("habitTrackers"), day: v.string() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		assertDay(args.day);
		const tracker = await getOwnTracker(ctx, args.trackerId, userId);
		await ctx.db.insert("habitLogs", {
			ownerId: userId,
			trackerId: args.trackerId,
			day: args.day,
			amount: tracker.step,
			createdAt: Date.now(),
		});
		await ctx.db.patch(args.trackerId, { total: tracker.total + tracker.step });
	},
});

// Removes the most recent tap of that day (mis-click fix).
export const undo = mutation({
	args: { trackerId: v.id("habitTrackers"), day: v.string() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		assertDay(args.day);
		const tracker = await getOwnTracker(ctx, args.trackerId, userId);
		const last = await ctx.db
			.query("habitLogs")
			.withIndex("by_tracker_day", (q) =>
				q.eq("trackerId", args.trackerId).eq("day", args.day),
			)
			.order("desc")
			.first();
		if (!last) return;
		await ctx.db.delete(last._id);
		await ctx.db.patch(args.trackerId, { total: tracker.total - last.amount });
	},
});

export const create = mutation({
	args: trackerFields,
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const existing = await ctx.db
			.query("habitTrackers")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.take(MAX_TRACKERS);
		if (existing.length >= MAX_TRACKERS) throw new ConvexError("tracker_limit");
		const maxOrder = existing.reduce((acc, t) => Math.max(acc, t.order), -1);
		return await ctx.db.insert("habitTrackers", {
			ownerId: userId,
			name: args.name,
			emoji: args.emoji,
			step: Math.max(1, Math.round(args.step)),
			unit: args.unit,
			color: args.color,
			order: maxOrder + 1,
			total: 0,
			createdAt: Date.now(),
		});
	},
});

export const update = mutation({
	args: { id: v.id("habitTrackers"), ...trackerFields },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		await getOwnTracker(ctx, args.id, userId);
		await ctx.db.patch(args.id, {
			name: args.name,
			emoji: args.emoji,
			step: Math.max(1, Math.round(args.step)),
			unit: args.unit,
			color: args.color,
		});
	},
});

export const remove = mutation({
	args: { id: v.id("habitTrackers") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		await getOwnTracker(ctx, args.id, userId);
		await ctx.db.delete(args.id);
		await ctx.scheduler.runAfter(0, internal.habits.purgeLogs, {
			trackerId: args.id,
		});
	},
});

// Deletes a removed tracker's logs in batches, rescheduling itself until the
// table is clean, so `remove` never blows the transaction limits.
export const purgeLogs = internalMutation({
	args: { trackerId: v.id("habitTrackers") },
	handler: async (ctx, args) => {
		const batch = await ctx.db
			.query("habitLogs")
			.withIndex("by_tracker_day", (q) => q.eq("trackerId", args.trackerId))
			.take(200);
		for (const log of batch) {
			await ctx.db.delete(log._id);
		}
		if (batch.length === 200) {
			await ctx.scheduler.runAfter(0, internal.habits.purgeLogs, {
				trackerId: args.trackerId,
			});
		}
	},
});
