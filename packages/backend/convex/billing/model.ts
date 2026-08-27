// DB layer for usage billing: internal lookups + the sharded usage upsert.
// External-service calls (Cloudflare, Convex Platform API, Mollie) live in the
// sibling action files; everything here is pure Convex runtime (queries/mutations).

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { USAGE_SHARDS, isMetricKey } from "./config";

// UTC "YYYY-MM-DD" for a timestamp. Days are the billing grain.
export function utcDayKey(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

// First day of the UTC month containing `ms`, as "YYYY-MM-01". Used as the
// default period start so a freshly enrolled client's current period captures
// usage already metered earlier this month (incl. the daily pull of yesterday).
export function startOfMonthKey(ms: number): string {
	return `${new Date(ms).toISOString().slice(0, 7)}-01`;
}

const usageEntryV = v.object({
	metric: v.string(),
	quantity: v.number(),
});

// Add usage to a client's daily buckets. Each entry lands in a random shard so
// concurrent callers rarely touch the same document. Unknown metrics and
// non-positive quantities are ignored. Called by the Cloudflare pull (once/day
// per metric) and the Convex log-stream webhook (pre-aggregated per batch).
export const recordUsage = internalMutation({
	args: {
		billingClientId: v.id("billingClients"),
		day: v.string(),
		entries: v.array(usageEntryV),
	},
	handler: async (ctx, args) => {
		const bc = await ctx.db.get(args.billingClientId);
		if (!bc || bc.status === "canceled") return null;

		for (const entry of args.entries) {
			if (!isMetricKey(entry.metric)) continue;
			if (!(entry.quantity > 0)) continue;
			const shard = Math.floor(Math.random() * USAGE_SHARDS);
			const existing = await ctx.db
				.query("usageRecords")
				.withIndex("by_client_metric_day_shard", (q) =>
					q
						.eq("billingClientId", args.billingClientId)
						.eq("metric", entry.metric)
						.eq("day", args.day)
						.eq("shard", shard),
				)
				.unique();
			if (existing) {
				await ctx.db.patch(existing._id, {
					quantity: existing.quantity + entry.quantity,
				});
			} else {
				await ctx.db.insert("usageRecords", {
					ownerId: bc.ownerId,
					billingClientId: args.billingClientId,
					metric: entry.metric,
					day: args.day,
					shard,
					quantity: entry.quantity,
					createdAt: Date.now(),
				});
			}
		}
		return null;
	},
});

// Idempotently SET a day's usage for given metrics (replace, not add). Used by
// the Cloudflare pull, which fetches one authoritative daily total per metric —
// re-running the pull for the same day must not double-count. Writes to shard 0
// only; safe because Cloudflare metrics (cf_*) are never written via recordUsage.
export const setDailyUsage = internalMutation({
	args: {
		billingClientId: v.id("billingClients"),
		day: v.string(),
		entries: v.array(usageEntryV),
	},
	handler: async (ctx, args) => {
		const bc = await ctx.db.get(args.billingClientId);
		if (!bc || bc.status === "canceled") return null;

		for (const entry of args.entries) {
			if (!isMetricKey(entry.metric)) continue;
			const quantity = entry.quantity > 0 ? entry.quantity : 0;
			const existing = await ctx.db
				.query("usageRecords")
				.withIndex("by_client_metric_day_shard", (q) =>
					q
						.eq("billingClientId", args.billingClientId)
						.eq("metric", entry.metric)
						.eq("day", args.day)
						.eq("shard", 0),
				)
				.unique();
			if (existing) {
				await ctx.db.patch(existing._id, { quantity });
			} else if (quantity > 0) {
				await ctx.db.insert("usageRecords", {
					ownerId: bc.ownerId,
					billingClientId: args.billingClientId,
					metric: entry.metric,
					day: args.day,
					shard: 0,
					quantity,
					createdAt: Date.now(),
				});
			}
		}
		return null;
	},
});

// Resolve a Cloudflare script/zone or Convex deployment to its billing client.
// Used by the Convex log-stream webhook (kind "cx_deployment") and can be reused
// for any resource-keyed ingest.
export const resourceOwner = internalQuery({
	args: {
		kind: v.union(
			v.literal("cf_worker"),
			v.literal("cf_zone"),
			v.literal("cx_deployment"),
		),
		identifier: v.string(),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		billingClientId: Id<"billingClients">;
		ownerId: Id<"users">;
	} | null> => {
		const resource = await ctx.db
			.query("billingResources")
			.withIndex("by_kind_and_identifier", (q) =>
				q.eq("kind", args.kind).eq("identifier", args.identifier),
			)
			.first();
		if (!resource || !resource.active) return null;
		const bc = await ctx.db.get(resource.billingClientId);
		if (!bc || bc.status !== "active") return null;
		return { billingClientId: resource.billingClientId, ownerId: bc.ownerId };
	},
});

// All active billing clients (for the daily Cloudflare pull + the billing run).
export const activeBillingClients = internalQuery({
	args: {},
	handler: async (ctx) => {
		return await ctx.db
			.query("billingClients")
			.withIndex("by_status", (q) => q.eq("status", "active"))
			.collect();
	},
});

// A client's Cloudflare resources, so the pull knows which scripts/zones to query.
export const cloudflareResources = internalQuery({
	args: { billingClientId: v.id("billingClients") },
	handler: async (ctx, args) => {
		const rows = await ctx.db
			.query("billingResources")
			.withIndex("by_billing_client", (q) =>
				q.eq("billingClientId", args.billingClientId),
			)
			.collect();
		return rows.filter(
			(r) => r.active && (r.kind === "cf_worker" || r.kind === "cf_zone"),
		);
	},
});

// Sum a client's usage per metric over [periodStart, periodEnd) (day strings,
// end exclusive), collapsing all shards. Returns a plain metric->quantity map.
export const sumUsage = internalQuery({
	args: {
		billingClientId: v.id("billingClients"),
		periodStart: v.string(),
		periodEnd: v.string(),
	},
	handler: async (ctx, args): Promise<Record<string, number>> => {
		const totals: Record<string, number> = {};
		const rows = await ctx.db
			.query("usageRecords")
			.withIndex("by_client_and_day", (q) =>
				q
					.eq("billingClientId", args.billingClientId)
					.gte("day", args.periodStart)
					.lt("day", args.periodEnd),
			)
			.collect();
		for (const row of rows) {
			totals[row.metric] = (totals[row.metric] ?? 0) + row.quantity;
		}
		return totals;
	},
});

// Store the Convex log-stream id on a resource (set during provisioning).
export const setResourceLogStream = internalMutation({
	args: {
		resourceId: v.id("billingResources"),
		logStreamId: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.resourceId, { logStreamId: args.logStreamId });
		return null;
	},
});

export const getBillingClient = internalQuery({
	args: { billingClientId: v.id("billingClients") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.billingClientId);
	},
});
