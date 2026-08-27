import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type QueryCtx, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";

// Rapporten zijn aggregaties per rekening over een datumbereik. Het aantal
// rekeningen is begrensd (~40) en per rekening/periode blijft het volume van
// één BV klein, dus een indexed collect per rekening is hier prima.

type AccountTotals = {
	accountId: Id<"ledgerAccounts">;
	code: string;
	name: string;
	type: Doc<"ledgerAccounts">["type"];
	debitCents: number;
	creditCents: number;
};

async function totalsPerAccount(
	ctx: QueryCtx,
	ownerId: Id<"users">,
	range: { from?: string; to?: string },
): Promise<AccountTotals[]> {
	const accounts = await ctx.db
		.query("ledgerAccounts")
		.withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
		.collect();
	const rows: AccountTotals[] = [];
	for (const account of accounts) {
		const lines = await ctx.db
			.query("journalLines")
			.withIndex("by_owner_account_date", (q) => {
				const base = q.eq("ownerId", ownerId).eq("accountId", account._id);
				const withFrom =
					range.from !== undefined ? base.gte("date", range.from) : base;
				return range.to !== undefined
					? withFrom.lte("date", range.to)
					: withFrom;
			})
			.collect();
		if (lines.length === 0) continue;
		let debitCents = 0;
		let creditCents = 0;
		for (const line of lines) {
			debitCents += line.debitCents;
			creditCents += line.creditCents;
		}
		rows.push({
			accountId: account._id,
			code: account.code,
			name: account.name,
			type: account.type,
			debitCents,
			creditCents,
		});
	}
	return rows.sort((a, b) => a.code.localeCompare(b.code));
}

// Proef- en saldibalans: alle rekeningen met debet/credit-totalen.
// Debet- en credittotaal horen exact gelijk te zijn.
export const trialBalance = query({
	args: { from: v.optional(v.string()), to: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const ownerId = await requireOwner(ctx);
		const rows = await totalsPerAccount(ctx, ownerId, args);
		const totalDebitCents = rows.reduce((acc, r) => acc + r.debitCents, 0);
		const totalCreditCents = rows.reduce(
			(acc, r) => acc + r.creditCents,
			0,
		);
		return { rows, totalDebitCents, totalCreditCents };
	},
});

// Winst & verlies over een periode: omzet (credit-saldo) en kosten
// (debet-saldo), resultaat = omzet − kosten.
export const winstVerlies = query({
	args: { from: v.string(), to: v.string() },
	handler: async (ctx, args) => {
		const ownerId = await requireOwner(ctx);
		const rows = await totalsPerAccount(ctx, ownerId, args);
		const revenue = rows
			.filter((r) => r.type === "revenue")
			.map((r) => ({ ...r, amountCents: r.creditCents - r.debitCents }));
		const expenses = rows
			.filter((r) => r.type === "expense")
			.map((r) => ({ ...r, amountCents: r.debitCents - r.creditCents }));
		const revenueCents = revenue.reduce((acc, r) => acc + r.amountCents, 0);
		const expenseCents = expenses.reduce((acc, r) => acc + r.amountCents, 0);
		return {
			revenue,
			expenses,
			revenueCents,
			expenseCents,
			resultCents: revenueCents - expenseCents,
		};
	},
});

// Balans per datum: activa (debet-saldo), passiva/eigen vermogen
// (credit-saldo). Het lopende resultaat wordt als aparte regel bij het
// eigen vermogen getoond zodat de balans altijd sluit.
export const balans = query({
	args: { perDate: v.string() },
	handler: async (ctx, args) => {
		const ownerId = await requireOwner(ctx);
		const rows = await totalsPerAccount(ctx, ownerId, {
			to: args.perDate,
		});
		const withBalance = (r: AccountTotals, creditSide: boolean) => ({
			...r,
			amountCents: creditSide
				? r.creditCents - r.debitCents
				: r.debitCents - r.creditCents,
		});
		const assets = rows
			.filter((r) => r.type === "asset")
			.map((r) => withBalance(r, false))
			.filter((r) => r.amountCents !== 0);
		const liabilities = rows
			.filter((r) => r.type === "liability")
			.map((r) => withBalance(r, true))
			.filter((r) => r.amountCents !== 0);
		const equity = rows
			.filter((r) => r.type === "equity")
			.map((r) => withBalance(r, true))
			.filter((r) => r.amountCents !== 0);
		const resultCents =
			rows
				.filter((r) => r.type === "revenue")
				.reduce((acc, r) => acc + r.creditCents - r.debitCents, 0) -
			rows
				.filter((r) => r.type === "expense")
				.reduce((acc, r) => acc + r.debitCents - r.creditCents, 0);
		const assetsCents = assets.reduce((acc, r) => acc + r.amountCents, 0);
		const liabilitiesCents = liabilities.reduce(
			(acc, r) => acc + r.amountCents,
			0,
		);
		const equityCents =
			equity.reduce((acc, r) => acc + r.amountCents, 0) + resultCents;
		return {
			assets,
			liabilities,
			equity,
			resultCents,
			assetsCents,
			liabilitiesCents,
			equityCents,
			balanced: assetsCents === liabilitiesCents + equityCents,
		};
	},
});
