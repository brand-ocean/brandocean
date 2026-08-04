import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
	type MutationCtx,
	type QueryCtx,
	mutation,
	query,
} from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { type AccountType, type VatCategory, accountTypeV, vatCategoryV } from "./validators";

type ChartAccount = {
	code: string;
	name: string;
	type: AccountType;
	systemKey?: string;
	defaultVatCategory?: VatCategory;
};

// Compact NL-rekeningschema voor één BV (web-/softwarebureau).
// systemKey is de stabiele referentie voor boekingslogica — codes zijn UI.
const CHART: readonly ChartAccount[] = [
	// 0xxx — eigen vermogen & vaste activa
	{ code: "0100", name: "Gestort kapitaal", type: "equity", systemKey: "gestort_kapitaal" },
	{ code: "0800", name: "Overige reserves", type: "equity", systemKey: "winstreserve" },
	{ code: "0210", name: "Inventaris & apparatuur", type: "asset", systemKey: "inventaris" },
	{ code: "0215", name: "Cumulatieve afschrijving inventaris", type: "asset", systemKey: "afschrijving_inventaris_cum" },
	// 1xxx — liquide middelen, vorderingen, kortlopende schulden
	{ code: "1010", name: "Bank", type: "asset", systemKey: "bank" },
	{ code: "1020", name: "Bank — BTW-reserve", type: "asset", systemKey: "bank_btw_reserve" },
	{ code: "1030", name: "Bank — loonheffingreserve", type: "asset", systemKey: "bank_loonheffing_reserve" },
	{ code: "1100", name: "Kruisposten", type: "asset", systemKey: "kruisposten" },
	{ code: "1300", name: "Debiteuren", type: "asset", systemKey: "debiteuren" },
	{ code: "1520", name: "Te betalen BTW hoog", type: "liability", systemKey: "btw_hoog" },
	{ code: "1521", name: "Te betalen BTW laag", type: "liability", systemKey: "btw_laag" },
	{ code: "1530", name: "Voorbelasting", type: "asset", systemKey: "voorbelasting" },
	{ code: "1540", name: "BTW af te dragen (afgesloten tijdvakken)", type: "liability", systemKey: "btw_af_te_dragen" },
	{ code: "1600", name: "Crediteuren", type: "liability", systemKey: "crediteuren" },
	{ code: "1700", name: "Loonheffing te betalen", type: "liability", systemKey: "loonheffing_schuld" },
	{ code: "1710", name: "Netto loon te betalen", type: "liability", systemKey: "netto_loon_schuld" },
	{ code: "1720", name: "Reservering vakantiegeld", type: "liability", systemKey: "vakantiegeld_reserve" },
	{ code: "1800", name: "Rekening-courant DGA", type: "liability", systemKey: "rc_dga" },
	{ code: "2000", name: "Vraagposten", type: "asset", systemKey: "vraagposten" },
	// 4xxx — kosten
	{ code: "4000", name: "Brutoloon", type: "expense", systemKey: "loonkosten" },
	{ code: "4010", name: "Werkgeverslasten", type: "expense", systemKey: "werkgeverslasten" },
	{ code: "4100", name: "Huisvesting", type: "expense", defaultVatCategory: "hoog" },
	{ code: "4200", name: "Software & hosting", type: "expense", systemKey: "software_hosting", defaultVatCategory: "hoog" },
	{ code: "4210", name: "Hardware & kleine inventaris", type: "expense", defaultVatCategory: "hoog" },
	{ code: "4300", name: "Marketing & acquisitie", type: "expense", defaultVatCategory: "hoog" },
	{ code: "4400", name: "Reis- & verblijfkosten", type: "expense", defaultVatCategory: "hoog" },
	{ code: "4500", name: "Administratie & advies", type: "expense", systemKey: "administratie_advies", defaultVatCategory: "hoog" },
	{ code: "4600", name: "Bankkosten", type: "expense", systemKey: "bankkosten", defaultVatCategory: "geen" },
	{ code: "4700", name: "Verzekeringen", type: "expense", defaultVatCategory: "geen" },
	{ code: "4800", name: "Telefoon & internet", type: "expense", defaultVatCategory: "hoog" },
	{ code: "4900", name: "Overige kosten", type: "expense", systemKey: "overige_kosten", defaultVatCategory: "hoog" },
	{ code: "4950", name: "Afschrijvingen", type: "expense", systemKey: "afschrijvingen", defaultVatCategory: "geen" },
	// 8xxx — omzet
	{ code: "8000", name: "Omzet hoog tarief", type: "revenue", systemKey: "omzet_hoog", defaultVatCategory: "hoog" },
	{ code: "8010", name: "Omzet laag tarief", type: "revenue", systemKey: "omzet_laag", defaultVatCategory: "laag" },
	{ code: "8100", name: "Omzet EU-diensten (ICP)", type: "revenue", systemKey: "omzet_eu_dienst", defaultVatCategory: "eu_dienst" },
	{ code: "8200", name: "Omzet 0% / export", type: "revenue", systemKey: "omzet_nul", defaultVatCategory: "nul" },
];

export async function getAccountBySystemKey(
	ctx: QueryCtx | MutationCtx,
	ownerId: Id<"users">,
	systemKey: string,
): Promise<Doc<"ledgerAccounts"> | null> {
	return await ctx.db
		.query("ledgerAccounts")
		.withIndex("by_owner_system_key", (q) =>
			q.eq("ownerId", ownerId).eq("systemKey", systemKey),
		)
		.unique();
}

export async function requireAccountBySystemKey(
	ctx: QueryCtx | MutationCtx,
	ownerId: Id<"users">,
	systemKey: string,
): Promise<Doc<"ledgerAccounts">> {
	const account = await getAccountBySystemKey(ctx, ownerId, systemKey);
	if (!account) throw new ConvexError("account_missing");
	return account;
}

// True zodra het rekeningschema geseed is — de poort waarachter alle
// automatische boekingen (facturen e.d.) actief worden.
export async function isLedgerInitialized(
	ctx: QueryCtx | MutationCtx,
	ownerId: Id<"users">,
): Promise<boolean> {
	return (await getAccountBySystemKey(ctx, ownerId, "debiteuren")) !== null;
}

export const seedChart = mutation({
	args: {},
	handler: async (ctx) => {
		const ownerId = await requireOwner(ctx);
		const now = Date.now();
		let created = 0;
		for (const acc of CHART) {
			const existing = acc.systemKey
				? await getAccountBySystemKey(ctx, ownerId, acc.systemKey)
				: await ctx.db
						.query("ledgerAccounts")
						.withIndex("by_owner_code", (q) =>
							q.eq("ownerId", ownerId).eq("code", acc.code),
						)
						.unique();
			if (existing) continue;
			await ctx.db.insert("ledgerAccounts", {
				ownerId,
				code: acc.code,
				name: acc.name,
				type: acc.type,
				systemKey: acc.systemKey,
				defaultVatCategory: acc.defaultVatCategory,
				isSystem: acc.systemKey !== undefined,
				active: true,
				createdAt: now,
				updatedAt: now,
			});
			created += 1;
		}
		return { created, total: CHART.length };
	},
});

export const list = query({
	args: { includeInactive: v.optional(v.boolean()) },
	handler: async (ctx, args) => {
		const ownerId = await requireOwner(ctx);
		const accounts = await ctx.db
			.query("ledgerAccounts")
			.withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
			.collect(); // begrensd: ~35-50 rekeningen
		const filtered = args.includeInactive
			? accounts
			: accounts.filter((a) => a.active);
		return filtered.sort((a, b) => a.code.localeCompare(b.code));
	},
});

export const create = mutation({
	args: {
		code: v.string(),
		name: v.string(),
		type: accountTypeV,
		defaultVatCategory: v.optional(vatCategoryV),
	},
	handler: async (ctx, args) => {
		const ownerId = await requireOwner(ctx);
		const existing = await ctx.db
			.query("ledgerAccounts")
			.withIndex("by_owner_code", (q) =>
				q.eq("ownerId", ownerId).eq("code", args.code),
			)
			.unique();
		if (existing) throw new ConvexError("code_in_use");
		const now = Date.now();
		return await ctx.db.insert("ledgerAccounts", {
			ownerId,
			code: args.code,
			name: args.name,
			type: args.type,
			defaultVatCategory: args.defaultVatCategory,
			isSystem: false,
			active: true,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("ledgerAccounts"),
		name: v.optional(v.string()),
		active: v.optional(v.boolean()),
		defaultVatCategory: v.optional(vatCategoryV),
	},
	handler: async (ctx, args) => {
		const ownerId = await requireOwner(ctx);
		const account = await ctx.db.get(args.id);
		if (!account || account.ownerId !== ownerId)
			throw new ConvexError("forbidden");
		await ctx.db.patch(args.id, {
			...(args.name !== undefined ? { name: args.name } : {}),
			...(args.active !== undefined ? { active: args.active } : {}),
			...(args.defaultVatCategory !== undefined
				? { defaultVatCategory: args.defaultVatCategory }
				: {}),
			updatedAt: Date.now(),
		});
	},
});

export const remove = mutation({
	args: { id: v.id("ledgerAccounts") },
	handler: async (ctx, args) => {
		const ownerId = await requireOwner(ctx);
		const account = await ctx.db.get(args.id);
		if (!account || account.ownerId !== ownerId)
			throw new ConvexError("forbidden");
		if (account.isSystem) throw new ConvexError("account_is_system");
		const used = await ctx.db
			.query("journalLines")
			.withIndex("by_owner_account_date", (q) =>
				q.eq("ownerId", ownerId).eq("accountId", args.id),
			)
			.take(1);
		if (used.length > 0) throw new ConvexError("account_in_use");
		await ctx.db.delete(args.id);
	},
});
