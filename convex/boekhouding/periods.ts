import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";

// Maakt boekjaar + 4 kwartalen aan als ze nog niet bestaan. Idempotent.
export async function ensureYearPeriods(
	ctx: MutationCtx,
	ownerId: Id<"users">,
	year: number,
): Promise<void> {
	const existing = await ctx.db
		.query("fiscalPeriods")
		.withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
		.collect();
	const now = Date.now();
	const has = (kind: "year" | "quarter", quarter?: number) =>
		existing.some(
			(p) => p.year === year && p.kind === kind && p.quarter === quarter,
		);
	if (!has("year")) {
		await ctx.db.insert("fiscalPeriods", {
			ownerId,
			kind: "year",
			year,
			startDate: `${year}-01-01`,
			endDate: `${year + 1}-01-01`,
			status: "open",
			createdAt: now,
		});
	}
	const quarterStarts = ["01-01", "04-01", "07-01", "10-01"];
	for (let q = 1; q <= 4; q += 1) {
		if (has("quarter", q)) continue;
		const start = `${year}-${quarterStarts[q - 1]}`;
		const end =
			q === 4 ? `${year + 1}-01-01` : `${year}-${quarterStarts[q]}`;
		await ctx.db.insert("fiscalPeriods", {
			ownerId,
			kind: "quarter",
			year,
			quarter: q,
			startDate: start,
			endDate: end,
			status: "open",
			createdAt: now,
		});
	}
}

export const ensureYear = mutation({
	args: { year: v.number() },
	handler: async (ctx, args) => {
		const ownerId = await requireOwner(ctx);
		await ensureYearPeriods(ctx, ownerId, args.year);
	},
});

export const list = query({
	args: {},
	handler: async (ctx) => {
		const ownerId = await requireOwner(ctx);
		const periods = await ctx.db
			.query("fiscalPeriods")
			.withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
			.collect();
		return periods.sort((a, b) => a.startDate.localeCompare(b.startDate));
	},
});
