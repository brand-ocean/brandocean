// Owner-facing billing API for the dashboard. Every function is gated on the
// authenticated owner; nothing here talks to external services (see mollie.ts /
// cloudflare.ts / convexUsage.ts for that).

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
	CURRENCY,
	DEFAULT_MARKUP,
	METRICS,
	computeCharge,
	isMetricKey,
	type MetricKey,
} from "./config";
import { startOfMonthKey, utcDayKey } from "./model";

const resourceKindV = v.union(
	v.literal("cf_worker"),
	v.literal("cf_zone"),
	v.literal("cx_deployment"),
);

async function requireOwner(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
	const userId = await getAuthUserId(ctx);
	if (!userId) throw new ConvexError("unauthenticated");
	return userId;
}

async function ownedBillingClient(
	ctx: MutationCtx,
	ownerId: Id<"users">,
	id: Id<"billingClients">,
): Promise<Doc<"billingClients">> {
	const bc = await ctx.db.get(id);
	if (!bc || bc.ownerId !== ownerId) throw new ConvexError("forbidden");
	return bc;
}

// List every billing client with its linked client's name + resource count.
export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const rows = await ctx.db
			.query("billingClients")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();
		return Promise.all(
			rows.map(async (bc) => {
				const client = await ctx.db.get(bc.clientId);
				const resources = await ctx.db
					.query("billingResources")
					.withIndex("by_billing_client", (q) =>
						q.eq("billingClientId", bc._id),
					)
					.collect();
				return {
					id: bc._id,
					clientId: bc.clientId,
					clientName: client?.name ?? "—",
					status: bc.status,
					mandateStatus: bc.mandateStatus ?? null,
					hasMandate: !!bc.stripePaymentMethodId,
					markup: bc.markup ?? DEFAULT_MARKUP,
					billingIntervalMonths: bc.billingIntervalMonths,
					minChargeCents: bc.minChargeCents,
					carryoverCents: bc.carryoverCents,
					periodStart: bc.periodStart,
					resourceCount: resources.length,
				};
			}),
		);
	},
});

// Put a client on usage billing. Idempotent per client.
export const enroll = mutation({
	args: {
		clientId: v.id("clients"),
		markup: v.optional(v.number()),
		billingIntervalMonths: v.optional(v.number()),
		minChargeCents: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<Id<"billingClients">> => {
		const userId = await requireOwner(ctx);
		const client = await ctx.db.get(args.clientId);
		if (!client || client.ownerId !== userId) throw new ConvexError("forbidden");

		const existing = await ctx.db
			.query("billingClients")
			.withIndex("by_client", (q) => q.eq("clientId", args.clientId))
			.first();
		if (existing) return existing._id;

		return await ctx.db.insert("billingClients", {
			ownerId: userId,
			clientId: args.clientId,
			status: "active",
			markup: args.markup,
			billingIntervalMonths: args.billingIntervalMonths ?? 1,
			minChargeCents: args.minChargeCents ?? 500,
			carryoverCents: 0,
			periodStart: startOfMonthKey(Date.now()),
			createdAt: Date.now(),
		});
	},
});

export const updateSettings = mutation({
	args: {
		id: v.id("billingClients"),
		markup: v.optional(v.number()),
		billingIntervalMonths: v.optional(v.number()),
		minChargeCents: v.optional(v.number()),
		status: v.optional(
			v.union(
				v.literal("active"),
				v.literal("paused"),
				v.literal("canceled"),
			),
		),
	},
	handler: async (ctx, args) => {
		const userId = await requireOwner(ctx);
		await ownedBillingClient(ctx, userId, args.id);
		await ctx.db.patch(args.id, {
			...(args.markup !== undefined ? { markup: args.markup } : {}),
			...(args.billingIntervalMonths !== undefined
				? { billingIntervalMonths: args.billingIntervalMonths }
				: {}),
			...(args.minChargeCents !== undefined
				? { minChargeCents: args.minChargeCents }
				: {}),
			...(args.status !== undefined ? { status: args.status } : {}),
		});
		return null;
	},
});

export const addResource = mutation({
	args: {
		billingClientId: v.id("billingClients"),
		kind: resourceKindV,
		identifier: v.string(),
		label: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<Id<"billingResources">> => {
		const userId = await requireOwner(ctx);
		await ownedBillingClient(ctx, userId, args.billingClientId);
		const identifier = args.identifier.trim();
		if (!identifier) throw new ConvexError("empty_identifier");

		// Avoid duplicate identifiers under the same kind (usage would double-count).
		const clash = await ctx.db
			.query("billingResources")
			.withIndex("by_kind_and_identifier", (q) =>
				q.eq("kind", args.kind).eq("identifier", identifier),
			)
			.first();
		if (clash) throw new ConvexError("identifier_already_linked");

		return await ctx.db.insert("billingResources", {
			ownerId: userId,
			billingClientId: args.billingClientId,
			kind: args.kind,
			identifier,
			label: args.label,
			active: true,
			createdAt: Date.now(),
		});
	},
});

export const removeResource = mutation({
	args: { id: v.id("billingResources") },
	handler: async (ctx, args) => {
		const userId = await requireOwner(ctx);
		const resource = await ctx.db.get(args.id);
		if (!resource || resource.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.delete(args.id);
		return null;
	},
});

export const listResources = query({
	args: { billingClientId: v.id("billingClients") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const bc = await ctx.db.get(args.billingClientId);
		if (!bc || bc.ownerId !== userId) return [];
		return await ctx.db
			.query("billingResources")
			.withIndex("by_billing_client", (q) =>
				q.eq("billingClientId", args.billingClientId),
			)
			.collect();
	},
});

// Current unbilled-period usage totals + a live preview of what the next charge
// would be (before the minimum-charge / carryover logic).
export const currentUsage = query({
	args: { billingClientId: v.id("billingClients") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;
		const bc = await ctx.db.get(args.billingClientId);
		if (!bc || bc.ownerId !== userId) return null;

		const periodEnd = utcDayKey(Date.now() + 24 * 60 * 60 * 1000); // exclusive
		const rows = await ctx.db
			.query("usageRecords")
			.withIndex("by_client_and_day", (q) =>
				q
					.eq("billingClientId", args.billingClientId)
					.gte("day", bc.periodStart)
					.lt("day", periodEnd),
			)
			.collect();

		const totals: Partial<Record<MetricKey, number>> = {};
		for (const row of rows) {
			if (!isMetricKey(row.metric)) continue;
			totals[row.metric] = (totals[row.metric] ?? 0) + row.quantity;
		}

		const markup = bc.markup ?? DEFAULT_MARKUP;
		const { lines, usageCents } = computeCharge(totals, markup);
		return {
			periodStart: bc.periodStart,
			markup,
			currency: CURRENCY,
			carryoverCents: bc.carryoverCents,
			usageCents,
			projectedTotalCents: usageCents + bc.carryoverCents,
			minChargeCents: bc.minChargeCents,
			lines: lines.map((l) => ({
				...l,
				label: METRICS[l.metric].label,
				unit: METRICS[l.metric].unit,
			})),
		};
	},
});

export const listInvoices = query({
	args: { billingClientId: v.id("billingClients") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const bc = await ctx.db.get(args.billingClientId);
		if (!bc || bc.ownerId !== userId) return [];
		return await ctx.db
			.query("billingInvoices")
			.withIndex("by_billing_client", (q) =>
				q.eq("billingClientId", args.billingClientId),
			)
			.order("desc")
			.take(50);
	},
});
