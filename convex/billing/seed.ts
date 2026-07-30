// One-off admin seeding for usage billing, driven from the CLI (not the app UI):
//   npx convex run internal.billing.seed.seedApps '{ "ownerId": "...", "apps": [...] }'
// Idempotent: re-running won't duplicate clients, enrollments or resources.

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { utcDayKey } from "./model";

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
					periodStart: utcDayKey(Date.now()),
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
