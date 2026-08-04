import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { customAlphabet } from "nanoid";
import type { Doc, Id } from "../_generated/dataModel";
import {
	type MutationCtx,
	type QueryCtx,
	mutation,
	query,
} from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { type EntryType, entryTypeV, vatCategoryV } from "./validators";

const newMemoKey = customAlphabet(
	"0123456789abcdefghijklmnopqrstuvwxyz",
	12,
);

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toDayKey(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

export type EntryLineInput = {
	accountId: Id<"ledgerAccounts">;
	debitCents: number;
	creditCents: number;
	description?: string;
	vatCategory?: Doc<"journalLines">["vatCategory"];
	clientId?: Id<"clients">;
};

export const entryLineInputV = v.object({
	accountId: v.id("ledgerAccounts"),
	debitCents: v.number(),
	creditCents: v.number(),
	description: v.optional(v.string()),
	vatCategory: v.optional(vatCategoryV),
	clientId: v.optional(v.id("clients")),
});

export async function assertPeriodOpen(
	ctx: QueryCtx | MutationCtx,
	ownerId: Id<"users">,
	date: string,
): Promise<void> {
	const periods = await ctx.db
		.query("fiscalPeriods")
		.withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
		.collect(); // ≤ ~5 rijen per boekjaar
	for (const p of periods) {
		if (p.status === "closed" && date >= p.startDate && date < p.endDate) {
			throw new ConvexError("period_closed");
		}
	}
}

async function nextEntryNumber(
	ctx: MutationCtx,
	ownerId: Id<"users">,
): Promise<number> {
	const settings = await ctx.db
		.query("userSettings")
		.withIndex("by_user", (q) => q.eq("userId", ownerId))
		.unique();
	const next = settings?.nextJournalEntryNumber ?? 1;
	if (settings) {
		await ctx.db.patch(settings._id, { nextJournalEntryNumber: next + 1 });
	} else {
		await ctx.db.insert("userSettings", {
			userId: ownerId,
			theme: "system",
			defaultCurrency: "EUR",
			defaultVatRate: 21,
			nextJournalEntryNumber: next + 1,
		});
	}
	return next;
}

// Het enige schrijfpad naar journalEntries/journalLines. Dwingt alle
// invarianten af: idempotentie (sourceKey), balans, periodeslot, geldige
// rekeningen. Posten zijn daarna immutable — correcties via reverseEntry.
export async function postEntry(
	ctx: MutationCtx,
	args: {
		ownerId: Id<"users">;
		date: string;
		type: EntryType;
		description: string;
		sourceKey: string;
		reversesEntryId?: Id<"journalEntries">;
		lines: EntryLineInput[];
	},
): Promise<{ entryId: Id<"journalEntries">; created: boolean }> {
	const existing = await ctx.db
		.query("journalEntries")
		.withIndex("by_owner_source_key", (q) =>
			q.eq("ownerId", args.ownerId).eq("sourceKey", args.sourceKey),
		)
		.unique();
	if (existing) return { entryId: existing._id, created: false };

	if (!DAY_KEY_RE.test(args.date)) throw new ConvexError("bad_date");
	await assertPeriodOpen(ctx, args.ownerId, args.date);

	if (args.lines.length < 2) throw new ConvexError("unbalanced_entry");
	let debitTotal = 0;
	let creditTotal = 0;
	for (const line of args.lines) {
		const debitOk =
			Number.isInteger(line.debitCents) && line.debitCents >= 0;
		const creditOk =
			Number.isInteger(line.creditCents) && line.creditCents >= 0;
		const exactlyOne =
			(line.debitCents > 0) !== (line.creditCents > 0);
		if (!debitOk || !creditOk || !exactlyOne)
			throw new ConvexError("unbalanced_entry");
		debitTotal += line.debitCents;
		creditTotal += line.creditCents;

		const account = await ctx.db.get(line.accountId);
		if (!account || account.ownerId !== args.ownerId || !account.active)
			throw new ConvexError("bad_account");
	}
	if (debitTotal !== creditTotal || debitTotal <= 0)
		throw new ConvexError("unbalanced_entry");

	const entryNumber = await nextEntryNumber(ctx, args.ownerId);
	const entryId = await ctx.db.insert("journalEntries", {
		ownerId: args.ownerId,
		entryNumber,
		date: args.date,
		description: args.description,
		type: args.type,
		sourceKey: args.sourceKey,
		reversesEntryId: args.reversesEntryId,
		totalCents: debitTotal,
		createdAt: Date.now(),
	});
	for (const line of args.lines) {
		await ctx.db.insert("journalLines", {
			entryId,
			ownerId: args.ownerId,
			date: args.date,
			accountId: line.accountId,
			debitCents: line.debitCents,
			creditCents: line.creditCents,
			description: line.description,
			vatCategory: line.vatCategory,
			clientId: line.clientId,
		});
	}
	return { entryId, created: true };
}

// Tegenboeking: spiegelt alle regels (debet↔credit) met dezelfde
// vatCategory, zodat ook de BTW-rubrieken zichzelf corrigeren. De
// tegenboeking wordt gedateerd in een open periode (args.date).
export async function reverseEntry(
	ctx: MutationCtx,
	args: {
		ownerId: Id<"users">;
		entryId: Id<"journalEntries">;
		date: string;
		sourceKey: string;
		description?: string;
	},
): Promise<{ entryId: Id<"journalEntries">; created: boolean }> {
	const original = await ctx.db.get(args.entryId);
	if (!original || original.ownerId !== args.ownerId)
		throw new ConvexError("not_found");
	if (original.reversedByEntryId) {
		return { entryId: original.reversedByEntryId, created: false };
	}
	const lines = await ctx.db
		.query("journalLines")
		.withIndex("by_entry", (q) => q.eq("entryId", args.entryId))
		.collect();
	const result = await postEntry(ctx, {
		ownerId: args.ownerId,
		date: args.date,
		type: "reversal",
		description:
			args.description ??
			`Tegenboeking #${original.entryNumber}: ${original.description}`,
		sourceKey: args.sourceKey,
		reversesEntryId: args.entryId,
		lines: lines.map((l) => ({
			accountId: l.accountId,
			debitCents: l.creditCents,
			creditCents: l.debitCents,
			description: l.description,
			vatCategory: l.vatCategory,
			clientId: l.clientId,
		})),
	});
	if (result.created) {
		// Enige toegestane patch op een journaalpost.
		await ctx.db.patch(args.entryId, { reversedByEntryId: result.entryId });
	}
	return result;
}

export const createMemoriaal = mutation({
	args: {
		date: v.string(),
		description: v.string(),
		lines: v.array(entryLineInputV),
	},
	handler: async (ctx, args) => {
		const ownerId = await requireOwner(ctx);
		return await postEntry(ctx, {
			ownerId,
			date: args.date,
			type: "memoriaal",
			description: args.description,
			sourceKey: `memoriaal:${newMemoKey()}`,
			lines: args.lines,
		});
	},
});

export const reverse = mutation({
	args: {
		entryId: v.id("journalEntries"),
		date: v.string(),
		description: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const ownerId = await requireOwner(ctx);
		return await reverseEntry(ctx, {
			ownerId,
			entryId: args.entryId,
			date: args.date,
			sourceKey: `reversal:${args.entryId}`,
			description: args.description,
		});
	},
});

export const listEntries = query({
	args: {
		paginationOpts: paginationOptsValidator,
		type: v.optional(entryTypeV),
	},
	handler: async (ctx, args) => {
		const ownerId = await requireOwner(ctx);
		const page = await ctx.db
			.query("journalEntries")
			.withIndex("by_owner_date", (q) => q.eq("ownerId", ownerId))
			.order("desc")
			.paginate(args.paginationOpts);
		// type is een presentatiefilter binnen de pagina (geen eigen index nodig
		// bij één BV aan volume).
		return args.type === undefined
			? page
			: { ...page, page: page.page.filter((e) => e.type === args.type) };
	},
});

export const getEntry = query({
	args: { id: v.id("journalEntries") },
	handler: async (ctx, args) => {
		const ownerId = await requireOwner(ctx);
		const entry = await ctx.db.get(args.id);
		if (!entry || entry.ownerId !== ownerId) return null;
		const lines = await ctx.db
			.query("journalLines")
			.withIndex("by_entry", (q) => q.eq("entryId", args.id))
			.collect();
		const withAccounts = await Promise.all(
			lines.map(async (line) => {
				const account = await ctx.db.get(line.accountId);
				return {
					...line,
					accountCode: account?.code ?? "?",
					accountName: account?.name ?? "Onbekend",
				};
			}),
		);
		return { entry, lines: withAccounts };
	},
});
