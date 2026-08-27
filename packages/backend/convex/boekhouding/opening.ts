import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { requireAccountBySystemKey } from "./accounts";
import { postEntry } from "./journal";
import { ensureYearPeriods } from "./periods";

// Openingsbalans voor een BV in oprichting: gestort kapitaal op de bank,
// optioneel een deel als rekening-courant DGA (bv. oprichtingskosten die
// privé zijn voorgeschoten).
export const bookOpeningBalance = mutation({
	args: {
		date: v.string(), // "YYYY-MM-DD" — oprichtings-/startdatum
		shareCapitalCents: v.number(),
		bankCents: v.optional(v.number()), // default: volledig op de bank
	},
	handler: async (ctx, args) => {
		const ownerId = await requireOwner(ctx);
		if (
			!Number.isInteger(args.shareCapitalCents) ||
			args.shareCapitalCents <= 0
		)
			throw new ConvexError("bad_amount");
		const bankCents = args.bankCents ?? args.shareCapitalCents;
		if (
			!Number.isInteger(bankCents) ||
			bankCents < 0 ||
			bankCents > args.shareCapitalCents
		)
			throw new ConvexError("bad_amount");

		const year = Number(args.date.slice(0, 4));
		if (!Number.isInteger(year)) throw new ConvexError("bad_date");
		await ensureYearPeriods(ctx, ownerId, year);

		const bank = await requireAccountBySystemKey(ctx, ownerId, "bank");
		const kapitaal = await requireAccountBySystemKey(
			ctx,
			ownerId,
			"gestort_kapitaal",
		);
		const rcDga = await requireAccountBySystemKey(ctx, ownerId, "rc_dga");

		const dgaCents = args.shareCapitalCents - bankCents;
		const lines = [
			...(bankCents > 0
				? [
						{
							accountId: bank._id,
							debitCents: bankCents,
							creditCents: 0,
							description: "Gestort kapitaal op bankrekening",
						},
					]
				: []),
			// Nog niet op de bank ontvangen deel staat als vordering op de DGA.
			...(dgaCents > 0
				? [
						{
							accountId: rcDga._id,
							debitCents: dgaCents,
							creditCents: 0,
							description: "Nog te storten kapitaal (rekening-courant DGA)",
						},
					]
				: []),
			{
				accountId: kapitaal._id,
				debitCents: 0,
				creditCents: args.shareCapitalCents,
				description: "Gestort en opgevraagd kapitaal",
			},
		];

		const result = await postEntry(ctx, {
			ownerId,
			date: args.date,
			type: "opening",
			description: "Openingsbalans",
			sourceKey: `opening:${year}`,
			lines,
		});

		if (result.created) {
			const settings = await ctx.db
				.query("userSettings")
				.withIndex("by_user", (q) => q.eq("userId", ownerId))
				.unique();
			if (settings) {
				await ctx.db.patch(settings._id, {
					boekjaarStart: args.date,
					openingBalanceBookedAt: Date.now(),
				});
			}
		}
		return result;
	},
});

export const status = query({
	args: {},
	handler: async (ctx) => {
		const ownerId = await requireOwner(ctx);
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_user", (q) => q.eq("userId", ownerId))
			.unique();
		const accounts = await ctx.db
			.query("ledgerAccounts")
			.withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
			.take(1);
		return {
			chartSeeded: accounts.length > 0,
			openingBooked: settings?.openingBalanceBookedAt !== undefined,
			boekjaarStart: settings?.boekjaarStart ?? null,
		};
	},
});
