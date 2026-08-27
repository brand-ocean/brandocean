import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
	isLedgerInitialized,
	requireAccountBySystemKey,
} from "./accounts";
import { computeInvoiceTotals } from "../lib/invoiceMath";
import { postEntry, reverseEntry, toDayKey } from "./journal";
import type { VatCategory } from "./validators";

// Verkoopfacturen boeken automatisch zodra het rekeningschema geseed is.
// Vóór die tijd zijn alle hooks no-ops, zodat de bestaande factuurflow
// blijft werken tot de administratie in gebruik is.

export function deriveVatCategoryFromRate(vatRate: number): VatCategory {
	if (vatRate >= 15) return "hoog";
	if (vatRate > 0) return "laag";
	return "nul";
}

export async function findEntryBySourceKey(
	ctx: QueryCtx | MutationCtx,
	ownerId: Id<"users">,
	sourceKey: string,
): Promise<Doc<"journalEntries"> | null> {
	return await ctx.db
		.query("journalEntries")
		.withIndex("by_owner_source_key", (q) =>
			q.eq("ownerId", ownerId).eq("sourceKey", sourceKey),
		)
		.unique();
}

export async function isInvoiceBooked(
	ctx: QueryCtx | MutationCtx,
	invoice: Doc<"invoices">,
): Promise<boolean> {
	return (
		(await findEntryBySourceKey(
			ctx,
			invoice.ownerId,
			`invoice:${invoice._id}:sent`,
		)) !== null
	);
}

async function invoiceTotals(
	ctx: MutationCtx,
	invoice: Doc<"invoices">,
): Promise<{ subtotal: number; vat: number; total: number }> {
	let lineSum = invoice.subtotal;
	if (lineSum === undefined) {
		const lines = await ctx.db
			.query("invoiceLines")
			.withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
			.collect();
		lineSum = lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
	}
	const totals = computeInvoiceTotals(
		lineSum,
		invoice.vatRate,
		invoice.pricesIncludeVat ?? false,
	);
	return {
		subtotal: totals.subtotalCents,
		vat: totals.vatCents,
		total: totals.totalCents,
	};
}

// Debiteuren D / omzet C / BTW C — bij versturen van de factuur.
export async function bookInvoiceSent(
	ctx: MutationCtx,
	invoice: Doc<"invoices">,
): Promise<void> {
	if (!(await isLedgerInitialized(ctx, invoice.ownerId))) return;
	const { subtotal, vat, total } = await invoiceTotals(ctx, invoice);
	if (total <= 0) throw new ConvexError("empty_invoice");

	// Met BTW op de factuur volgt de categorie het tarief; zonder BTW bepaalt
	// de factuurcategorie (nul/eu_dienst/verlegd) de omzetrekening en rubriek.
	const category: VatCategory =
		vat > 0
			? deriveVatCategoryFromRate(invoice.vatRate)
			: (invoice.vatCategory ?? "nul");

	const revenueKey =
		category === "hoog"
			? "omzet_hoog"
			: category === "laag"
				? "omzet_laag"
				: category === "eu_dienst"
					? "omzet_eu_dienst"
					: "omzet_nul";
	const debiteuren = await requireAccountBySystemKey(
		ctx,
		invoice.ownerId,
		"debiteuren",
	);
	const omzet = await requireAccountBySystemKey(
		ctx,
		invoice.ownerId,
		revenueKey,
	);

	const lines = [
		{
			accountId: debiteuren._id,
			debitCents: total,
			creditCents: 0,
			description: `Factuur ${invoice.number}`,
		},
		{
			accountId: omzet._id,
			debitCents: 0,
			creditCents: subtotal,
			vatCategory: category,
			clientId: invoice.clientId,
			description: `Factuur ${invoice.number}`,
		},
	];
	if (vat > 0) {
		const vatAccount = await requireAccountBySystemKey(
			ctx,
			invoice.ownerId,
			category === "laag" ? "btw_laag" : "btw_hoog",
		);
		lines.push({
			accountId: vatAccount._id,
			debitCents: 0,
			creditCents: vat,
			vatCategory: category,
			clientId: invoice.clientId,
			description: `BTW ${invoice.vatRate}% factuur ${invoice.number}`,
		});
	}

	await postEntry(ctx, {
		ownerId: invoice.ownerId,
		date: toDayKey(invoice.issuedAt),
		type: "sales",
		description: `Verkoopfactuur ${invoice.number}`,
		sourceKey: `invoice:${invoice._id}:sent`,
		lines,
	});
}

// Bank D / debiteuren C — handmatig op betaald gezet (zonder bankmatch).
// Bankreconciliatie gebruikt straks dezelfde sourceKey, dus dubbel boeken
// van dezelfde betaling is uitgesloten.
export async function bookInvoicePaidManual(
	ctx: MutationCtx,
	invoice: Doc<"invoices">,
): Promise<void> {
	if (!(await isLedgerInitialized(ctx, invoice.ownerId))) return;
	// Een factuur kan direct van draft naar paid gaan — boek dan eerst de omzet.
	await bookInvoiceSent(ctx, invoice);
	const { total } = await invoiceTotals(ctx, invoice);
	const bank = await requireAccountBySystemKey(ctx, invoice.ownerId, "bank");
	const debiteuren = await requireAccountBySystemKey(
		ctx,
		invoice.ownerId,
		"debiteuren",
	);
	await postEntry(ctx, {
		ownerId: invoice.ownerId,
		date: toDayKey(Date.now()),
		type: "sales_payment",
		description: `Betaling factuur ${invoice.number}`,
		sourceKey: `invoice:${invoice._id}:paid`,
		lines: [
			{ accountId: bank._id, debitCents: total, creditCents: 0 },
			{ accountId: debiteuren._id, debitCents: 0, creditCents: total },
		],
	});
}

// Void: tegenboeken van omzet- en (eventuele) betalingspost.
export async function bookInvoiceVoided(
	ctx: MutationCtx,
	invoice: Doc<"invoices">,
): Promise<void> {
	if (!(await isLedgerInitialized(ctx, invoice.ownerId))) return;
	const today = toDayKey(Date.now());
	const sent = await findEntryBySourceKey(
		ctx,
		invoice.ownerId,
		`invoice:${invoice._id}:sent`,
	);
	if (sent) {
		await reverseEntry(ctx, {
			ownerId: invoice.ownerId,
			entryId: sent._id,
			date: today,
			sourceKey: `invoice:${invoice._id}:void`,
			description: `Annulering factuur ${invoice.number}`,
		});
	}
	const paid = await findEntryBySourceKey(
		ctx,
		invoice.ownerId,
		`invoice:${invoice._id}:paid`,
	);
	if (paid) {
		await reverseEntry(ctx, {
			ownerId: invoice.ownerId,
			entryId: paid._id,
			date: today,
			sourceKey: `invoice:${invoice._id}:void_payment`,
			description: `Annulering betaling factuur ${invoice.number}`,
		});
	}
}
