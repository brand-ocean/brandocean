// One-off admin seeding for usage billing, driven from the CLI (not the app UI):
//   npx convex run internal.billing.seed.seedApps '{ "ownerId": "...", "apps": [...] }'
// Idempotent: re-running won't duplicate clients, enrollments or resources.

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import {
	DEFAULT_MARKUP,
	computeCharge,
	isMetricKey,
	type MetricKey,
} from "./config";
import { startOfMonthKey, utcDayKey } from "./model";

const appV = v.object({
	clientName: v.string(),
	cfWorker: v.optional(v.string()),
	cfZone: v.optional(v.string()),
	cxDeployment: v.optional(v.string()),
});

export const seedApps = internalMutation({
	args: {
		ownerId: v.id("users"),
		apps: v.array(appV),
	},
	handler: async (ctx, args) => {
		const results: Array<{ client: string; resources: string[] }> = [];

		for (const app of args.apps) {
			// find-or-create client by name
			const existingClients = await ctx.db
				.query("clients")
				.withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
				.collect();
			let client = existingClients.find(
				(c) => c.name.toLowerCase() === app.clientName.toLowerCase(),
			);
			let clientId = client?._id;
			if (!clientId) {
				clientId = await ctx.db.insert("clients", {
					ownerId: args.ownerId,
					name: app.clientName,
				});
			}

			// enroll (find-or-create billingClient)
			let bc = await ctx.db
				.query("billingClients")
				.withIndex("by_client", (q) => q.eq("clientId", clientId))
				.first();
			if (!bc) {
				const bcId = await ctx.db.insert("billingClients", {
					ownerId: args.ownerId,
					clientId,
					status: "active",
					billingIntervalMonths: 1,
					minChargeCents: 500,
					carryoverCents: 0,
					periodStart: startOfMonthKey(Date.now()),
					createdAt: Date.now(),
				});
				bc = await ctx.db.get(bcId);
			}
			if (!bc) continue;

			const added: string[] = [];
			const linkResource = async (
				kind: "cf_worker" | "cf_zone" | "cx_deployment",
				identifier?: string,
			) => {
				if (!identifier) return;
				const clash = await ctx.db
					.query("billingResources")
					.withIndex("by_kind_and_identifier", (q) =>
						q.eq("kind", kind).eq("identifier", identifier),
					)
					.first();
				if (clash) return;
				await ctx.db.insert("billingResources", {
					ownerId: args.ownerId,
					billingClientId: bc._id,
					kind,
					identifier,
					active: true,
					createdAt: Date.now(),
				});
				added.push(`${kind}:${identifier}`);
			};

			await linkResource("cf_worker", app.cfWorker);
			await linkResource("cf_zone", app.cfZone);
			await linkResource("cx_deployment", app.cxDeployment);

			results.push({ client: app.clientName, resources: added });
		}

		return results;
	},
});

// Diagnostic: what each active client would be billed for the current period
// (usage so far × markup), plus a grand total. Read-only.
export const projectedCharges = internalQuery({
	args: {},
	handler: async (ctx) => {
		const clients = await ctx.db
			.query("billingClients")
			.withIndex("by_status", (q) => q.eq("status", "active"))
			.collect();
		const periodEnd = utcDayKey(Date.now() + 24 * 60 * 60 * 1000);

		const lines: Array<{ client: string; cents: number }> = [];
		let totalCents = 0;
		for (const bc of clients) {
			const client = await ctx.db.get(bc.clientId);
			const rows = await ctx.db
				.query("usageRecords")
				.withIndex("by_client_and_day", (q) =>
					q
						.eq("billingClientId", bc._id)
						.gte("day", bc.periodStart)
						.lt("day", periodEnd),
				)
				.collect();
			const totals: Partial<Record<MetricKey, number>> = {};
			for (const r of rows) {
				if (isMetricKey(r.metric)) {
					totals[r.metric] = (totals[r.metric] ?? 0) + r.quantity;
				}
			}
			const { usageCents } = computeCharge(totals, bc.markup ?? DEFAULT_MARKUP);
			lines.push({ client: client?.name ?? "—", cents: usageCents });
			totalCents += usageCents;
		}
		lines.sort((a, b) => b.cents - a.cents);
		return {
			totalEur: (totalCents / 100).toFixed(2),
			perClient: lines.map((l) => ({
				client: l.client,
				eur: (l.cents / 100).toFixed(2),
			})),
		};
	},
});

// Maintenance: repoint cx_deployment resources from one deployment name to
// another. The first seeding used the *dev* deployment names out of each repo's
// .env.local, which meters our own `convex dev` traffic instead of the client's
// production usage. Idempotent: a pair whose `from` is gone or whose `to` is
// already linked is reported as skipped rather than applied twice.
export const retargetConvexDeployments = internalMutation({
	args: {
		mapping: v.array(v.object({ from: v.string(), to: v.string() })),
	},
	handler: async (ctx, args) => {
		const patched: string[] = [];
		const skipped: string[] = [];

		for (const pair of args.mapping) {
			const existing = await ctx.db
				.query("billingResources")
				.withIndex("by_kind_and_identifier", (q) =>
					q.eq("kind", "cx_deployment").eq("identifier", pair.to),
				)
				.first();
			if (existing) {
				skipped.push(`${pair.to}: already linked`);
				continue;
			}

			const resource = await ctx.db
				.query("billingResources")
				.withIndex("by_kind_and_identifier", (q) =>
					q.eq("kind", "cx_deployment").eq("identifier", pair.from),
				)
				.first();
			if (!resource) {
				skipped.push(`${pair.from}: not found`);
				continue;
			}

			// The old log stream (if any) pointed at the dev deployment, so the id
			// stored here no longer applies to the resource's new target.
			await ctx.db.patch(resource._id, {
				identifier: pair.to,
				logStreamId: undefined,
			});
			patched.push(`${pair.from} -> ${pair.to}`);
		}

		return { patched, skipped };
	},
});

// Maintenance: reset every active client's current period start to `day`
// (e.g. the 1st of the month) so already-metered usage falls inside the
// current, unbilled period. Does not touch carryover.
export const setPeriodStartAll = internalMutation({
	args: { day: v.string() },
	handler: async (ctx, args) => {
		const clients = await ctx.db
			.query("billingClients")
			.withIndex("by_status", (q) => q.eq("status", "active"))
			.collect();
		for (const bc of clients) {
			await ctx.db.patch(bc._id, { periodStart: args.day });
		}
		return { updated: clients.length };
	},
});
