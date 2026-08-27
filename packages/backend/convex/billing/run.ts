// The billing run: close out due periods, price them, and charge (or carry).
//
// Runs daily (crons.ts). A client's period is due once periodStart +
// billingIntervalMonths has arrived. Amounts below the client's minimum are
// carried forward instead of charged, so Mollie's per-transaction fee never
// exceeds a tiny usage bill.

import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
	CURRENCY,
	DEFAULT_MARKUP,
	computeCharge,
	isMetricKey,
	type MetricKey,
} from "./config";
import { utcDayKey } from "./model";

// Add `months` to a "YYYY-MM-DD" day (UTC), clamping the day-of-month so e.g.
// Jan 31 + 1 month = Feb 28/29.
export function addMonths(day: string, months: number): string {
	const [y, m, d] = day.split("-").map((n) => parseInt(n, 10));
	const base = new Date(Date.UTC(y, m - 1, d));
	const targetMonthIndex = base.getUTCMonth() + months;
	const targetYear = base.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
	const normMonth = ((targetMonthIndex % 12) + 12) % 12;
	const daysInTarget = new Date(
		Date.UTC(targetYear, normMonth + 1, 0),
	).getUTCDate();
	const clampedDay = Math.min(d, daysInTarget);
	return new Date(Date.UTC(targetYear, normMonth, clampedDay))
		.toISOString()
		.slice(0, 10);
}

const lineV = v.object({
	metric: v.string(),
	quantity: v.number(),
	costCents: v.number(),
	amountCents: v.number(),
});

// Atomically close a period: create the invoice, decide charge vs carry against
// the freshest carryover + mandate state, and advance the client's periodStart.
// Returns the invoice id + whether the caller should trigger a Mollie charge.
export const commitPeriod = internalMutation({
	args: {
		billingClientId: v.id("billingClients"),
		periodStart: v.string(),
		periodEnd: v.string(),
		lines: v.array(lineV),
		usageCents: v.number(),
	},
	handler: async (
		ctx,
		args,
	): Promise<{ invoiceId: Id<"billingInvoices"> | null; shouldCharge: boolean }> => {
		const bc = await ctx.db.get(args.billingClientId);
		if (!bc || bc.status !== "active") {
			return { invoiceId: null, shouldCharge: false };
		}
		// Guard against double-processing: only advance from the expected start.
		if (bc.periodStart !== args.periodStart) {
			return { invoiceId: null, shouldCharge: false };
		}

		const carryIn = bc.carryoverCents;
		const total = args.usageCents + carryIn;

		// Nothing to bill and nothing carried: just advance the window.
		if (total <= 0) {
			await ctx.db.patch(bc._id, { periodStart: args.periodEnd });
			return { invoiceId: null, shouldCharge: false };
		}

		const hasMandate =
			bc.mandateStatus === "valid" && !!bc.stripePaymentMethodId;
		const meetsMinimum = total >= bc.minChargeCents;
		const willCharge = meetsMinimum && hasMandate;

		const chargedCents = willCharge ? total : 0;
		const carryOut = willCharge ? 0 : total;

		const now = Date.now();
		const invoiceId = await ctx.db.insert("billingInvoices", {
			ownerId: bc.ownerId,
			billingClientId: bc._id,
			periodStart: args.periodStart,
			periodEnd: args.periodEnd,
			lines: args.lines,
			usageCents: args.usageCents,
			carryInCents: carryIn,
			chargedCents,
			carryOutCents: carryOut,
			currency: CURRENCY,
			status: willCharge ? "pending" : "carried",
			createdAt: now,
			updatedAt: now,
		});

		await ctx.db.patch(bc._id, {
			periodStart: args.periodEnd,
			carryoverCents: carryOut,
		});

		return { invoiceId, shouldCharge: willCharge };
	},
});

export const runDue = internalAction({
	args: { today: v.optional(v.string()) },
	handler: async (ctx, args): Promise<{ processed: number; charged: number }> => {
		const today = args.today ?? utcDayKey(Date.now());
		const clients = await ctx.runQuery(
			internal.billing.model.activeBillingClients,
			{},
		);

		let processed = 0;
		let charged = 0;
		for (const bc of clients) {
			const periodEnd = addMonths(bc.periodStart, bc.billingIntervalMonths);
			if (periodEnd > today) continue; // period not finished yet

			const totalsRaw = await ctx.runQuery(internal.billing.model.sumUsage, {
				billingClientId: bc._id,
				periodStart: bc.periodStart,
				periodEnd,
			});
			const totals: Partial<Record<MetricKey, number>> = {};
			for (const [metric, qty] of Object.entries(totalsRaw)) {
				if (isMetricKey(metric)) totals[metric] = qty;
			}

			const { lines, usageCents } = computeCharge(
				totals,
				bc.markup ?? DEFAULT_MARKUP,
			);

			const { invoiceId, shouldCharge } = await ctx.runMutation(
				internal.billing.run.commitPeriod,
				{
					billingClientId: bc._id,
					periodStart: bc.periodStart,
					periodEnd,
					lines,
					usageCents,
				},
			);
			processed += 1;

			if (shouldCharge && invoiceId) {
				const result = await ctx.runAction(
					internal.billing.stripe.chargeInvoice,
					{ invoiceId },
				);
				if (result.ok) charged += 1;
			}
		}

		return { processed, charged };
	},
});
