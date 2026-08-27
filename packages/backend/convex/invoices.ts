import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { customAlphabet } from "nanoid";
import {
	type MutationCtx,
	internalMutation,
	mutation,
	query,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
	bookInvoicePaidManual,
	bookInvoiceSent,
	bookInvoiceVoided,
	deriveVatCategoryFromRate,
	isInvoiceBooked,
} from "./boekhouding/invoiceBooking";
import { vatCategoryV } from "./boekhouding/validators";
import { computeInvoiceTotals } from "./lib/invoiceMath";

const slugAlphabet =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const newSlug = customAlphabet(slugAlphabet, 10);
const newShareToken = customAlphabet(slugAlphabet, 24);

const statusValidator = v.union(
	v.literal("draft"),
	v.literal("sent"),
	v.literal("paid"),
	v.literal("overdue"),
	v.literal("void"),
);

const DAY_MS = 24 * 60 * 60 * 1000;

// Eenmaal in het grootboek geboekt zijn bedragen en BTW van een factuur
// bevroren — wijzigen zou de administratie laten afwijken van de post.
// Correctie: factuur void'en (tegenboeking) en een nieuwe maken.
async function assertNotBooked(ctx: MutationCtx, invoice: Doc<"invoices">) {
	if (await isInvoiceBooked(ctx, invoice))
		throw new ConvexError("invoice_booked");
}

async function loadSettings(ctx: MutationCtx, userId: Id<"users">) {
	return await ctx.db
		.query("userSettings")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.unique();
}

async function recomputeInvoiceTotals(
	ctx: MutationCtx,
	invoiceId: Id<"invoices">,
) {
	const lines = await ctx.db
		.query("invoiceLines")
		.withIndex("by_invoice", (q) => q.eq("invoiceId", invoiceId))
		.collect();
	const subtotal = lines.reduce(
		(acc, l) => acc + l.quantity * l.unitPrice,
		0,
	);
	await ctx.db.patch(invoiceId, {
		subtotal,
		lineCount: lines.length,
		updatedAt: Date.now(),
	});
}

export const listByOwner = query({
	args: { clientId: v.optional(v.id("clients")) },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const all = await ctx.db
			.query("invoices")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.order("desc")
			.collect();
		const filtered =
			args.clientId === undefined
				? all
				: all.filter((i) => i.clientId === args.clientId);
		const withTotals = await Promise.all(
			filtered.map(async (inv) => {
				let subtotal = inv.subtotal;
				let lineCount = inv.lineCount;
				if (subtotal === undefined || lineCount === undefined) {
					const lines = await ctx.db
						.query("invoiceLines")
						.withIndex("by_invoice", (q) => q.eq("invoiceId", inv._id))
						.collect();
					subtotal = lines.reduce(
						(acc, l) => acc + l.quantity * l.unitPrice,
						0,
					);
					lineCount = lines.length;
				}
				const totals = computeInvoiceTotals(
					subtotal,
					inv.vatRate,
					inv.pricesIncludeVat ?? false,
				);
				return {
					...inv,
					subtotal: totals.subtotalCents,
					vat: totals.vatCents,
					total: totals.totalCents,
					lineCount,
				};
			}),
		);
		return withTotals;
	},
});

export const getById = query({
	args: { id: v.id("invoices") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;
		const invoice = await ctx.db.get(args.id);
		if (!invoice || invoice.ownerId !== userId) return null;
		const lines = await ctx.db
			.query("invoiceLines")
			.withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
			.collect();
		return { invoice, lines: lines.sort((a, b) => a.order - b.order) };
	},
});

export const getBySlug = query({
	args: { slug: v.string(), token: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const invoice = await ctx.db
			.query("invoices")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (!invoice) return null;
		if (invoice.status === "draft") return null;
		if (args.token !== invoice.shareToken) return null;
		const lines = await ctx.db
			.query("invoiceLines")
			.withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
			.collect();
		const client = await ctx.db.get(invoice.clientId);
		// Bedrijfsprofiel van de eigenaar, zodat de publieke pagina de PDF en
		// UBL e-factuur kan renderen. Alleen de velden die op die documenten
		// staan — nooit interne velden of tokens.
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_user", (q) => q.eq("userId", invoice.ownerId))
			.unique();
		return {
			invoice,
			lines: lines.sort((a, b) => a.order - b.order),
			client: client
				? {
						name: client.name,
						email: client.email,
						companyName: client.companyName,
						street: client.street,
						postalCode: client.postalCode,
						city: client.city,
						countryCode: client.countryCode,
						vatNumber: client.vatNumber,
					}
				: null,
			settings: settings
				? {
						businessName: settings.businessName,
						businessStreet: settings.businessStreet,
						businessPostalCode: settings.businessPostalCode,
						businessCity: settings.businessCity,
						businessCountryCode: settings.businessCountryCode,
						businessEmail: settings.businessEmail,
						kvkNumber: settings.kvkNumber,
						vatNumber: settings.vatNumber,
						iban: settings.iban,
						bic: settings.bic,
					}
				: null,
		};
	},
});

export const create = mutation({
	args: {
		clientId: v.id("clients"),
		contractId: v.optional(v.id("contracts")),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const client = await ctx.db.get(args.clientId);
		if (!client || client.ownerId !== userId)
			throw new ConvexError("forbidden");
		const settings = await loadSettings(ctx, userId);
		const prefix = settings?.invoicePrefix ?? "BO-";
		const currency = settings?.defaultCurrency ?? "EUR";
		const vatRate = settings?.defaultVatRate ?? 21;

		let next = settings?.nextInvoiceNumber;
		if (next === undefined) {
			// First time using the counter — seed from existing invoices once.
			const existing = await ctx.db
				.query("invoices")
				.withIndex("by_owner", (q) => q.eq("ownerId", userId))
				.collect();
			next = existing.length + 1;
		}
		const number = `${prefix}${String(next).padStart(4, "0")}`;

		if (settings) {
			await ctx.db.patch(settings._id, { nextInvoiceNumber: next + 1 });
		} else {
			await ctx.db.insert("userSettings", {
				userId,
				theme: "system",
				invoicePrefix: prefix,
				defaultCurrency: currency,
				defaultVatRate: vatRate,
				nextInvoiceNumber: next + 1,
			});
		}

		const now = Date.now();
		return await ctx.db.insert("invoices", {
			ownerId: userId,
			clientId: args.clientId,
			contractId: args.contractId,
			number,
			status: "draft",
			issuedAt: now,
			dueAt: now + 14 * DAY_MS,
			currency,
			vatRate,
			vatCategory: deriveVatCategoryFromRate(vatRate),
			slug: newSlug(),
			shareToken: newShareToken(),
			subtotal: 0,
			lineCount: 0,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("invoices"),
		issuedAt: v.optional(v.number()),
		dueAt: v.optional(v.number()),
		notes: v.optional(v.string()),
		vatRate: v.optional(v.number()),
		vatCategory: v.optional(vatCategoryV),
		pricesIncludeVat: v.optional(v.boolean()),
		currency: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const invoice = await ctx.db.get(args.id);
		if (!invoice || invoice.ownerId !== userId)
			throw new ConvexError("forbidden");
		const touchesBookedFields =
			args.vatRate !== undefined ||
			args.vatCategory !== undefined ||
			args.currency !== undefined ||
			args.issuedAt !== undefined ||
			args.pricesIncludeVat !== undefined;
		if (touchesBookedFields) await assertNotBooked(ctx, invoice);
		await ctx.db.patch(args.id, {
			...(args.issuedAt !== undefined ? { issuedAt: args.issuedAt } : {}),
			...(args.dueAt !== undefined ? { dueAt: args.dueAt } : {}),
			...(args.notes !== undefined ? { notes: args.notes } : {}),
			...(args.vatRate !== undefined ? { vatRate: args.vatRate } : {}),
			...(args.vatCategory !== undefined
				? { vatCategory: args.vatCategory }
				: {}),
			...(args.pricesIncludeVat !== undefined
				? { pricesIncludeVat: args.pricesIncludeVat }
				: {}),
			...(args.currency !== undefined ? { currency: args.currency } : {}),
			updatedAt: Date.now(),
		});
	},
});

export const setStatus = mutation({
	args: { id: v.id("invoices"), status: statusValidator },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const invoice = await ctx.db.get(args.id);
		if (!invoice || invoice.ownerId !== userId)
			throw new ConvexError("forbidden");
		// Terug naar draft kan niet meer zodra de factuur in het grootboek
		// staat — correcties lopen via void (tegenboeking) + nieuwe factuur.
		if (args.status === "draft") await assertNotBooked(ctx, invoice);
		await ctx.db.patch(args.id, {
			status: args.status,
			paidAt: args.status === "paid" ? Date.now() : undefined,
			updatedAt: Date.now(),
		});
		const updated = await ctx.db.get(args.id);
		if (!updated) return;
		if (args.status === "sent" || args.status === "overdue") {
			await bookInvoiceSent(ctx, updated);
		} else if (args.status === "paid") {
			await bookInvoicePaidManual(ctx, updated);
		} else if (args.status === "void") {
			await bookInvoiceVoided(ctx, updated);
		}
	},
});

export const remove = mutation({
	args: { id: v.id("invoices") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const invoice = await ctx.db.get(args.id);
		if (!invoice || invoice.ownerId !== userId)
			throw new ConvexError("forbidden");
		await assertNotBooked(ctx, invoice);
		const lines = await ctx.db
			.query("invoiceLines")
			.withIndex("by_invoice", (q) => q.eq("invoiceId", args.id))
			.collect();
		for (const l of lines) {
			await ctx.db.delete(l._id);
		}
		await ctx.db.delete(args.id);
	},
});

async function assertOwnInvoice(
	ctx: MutationCtx,
	id: Id<"invoices">,
	userId: Id<"users">,
): Promise<Doc<"invoices">> {
	const inv = await ctx.db.get(id);
	if (!inv || inv.ownerId !== userId) throw new ConvexError("forbidden");
	return inv;
}

async function assertEditableInvoice(
	ctx: MutationCtx,
	id: Id<"invoices">,
	userId: Id<"users">,
): Promise<Doc<"invoices">> {
	const inv = await assertOwnInvoice(ctx, id, userId);
	await assertNotBooked(ctx, inv);
	return inv;
}

export const addLine = mutation({
	args: {
		invoiceId: v.id("invoices"),
		description: v.string(),
		quantity: v.number(),
		unitPrice: v.number(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		await assertEditableInvoice(ctx, args.invoiceId, userId);
		const existing = await ctx.db
			.query("invoiceLines")
			.withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
			.collect();
		const maxOrder = existing.reduce(
			(acc, l) => (l.order > acc ? l.order : acc),
			0,
		);
		const id = await ctx.db.insert("invoiceLines", {
			invoiceId: args.invoiceId,
			description: args.description,
			quantity: args.quantity,
			unitPrice: args.unitPrice,
			order: maxOrder + 1000,
		});
		await recomputeInvoiceTotals(ctx, args.invoiceId);
		return id;
	},
});

export const updateLine = mutation({
	args: {
		id: v.id("invoiceLines"),
		description: v.optional(v.string()),
		quantity: v.optional(v.number()),
		unitPrice: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const line = await ctx.db.get(args.id);
		if (!line) throw new ConvexError("not_found");
		await assertEditableInvoice(ctx, line.invoiceId, userId);
		await ctx.db.patch(args.id, {
			...(args.description !== undefined
				? { description: args.description }
				: {}),
			...(args.quantity !== undefined ? { quantity: args.quantity } : {}),
			...(args.unitPrice !== undefined ? { unitPrice: args.unitPrice } : {}),
		});
		if (args.quantity !== undefined || args.unitPrice !== undefined) {
			await recomputeInvoiceTotals(ctx, line.invoiceId);
		}
	},
});

export const removeLine = mutation({
	args: { id: v.id("invoiceLines") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const line = await ctx.db.get(args.id);
		if (!line) throw new ConvexError("not_found");
		await assertEditableInvoice(ctx, line.invoiceId, userId);
		await ctx.db.delete(args.id);
		await recomputeInvoiceTotals(ctx, line.invoiceId);
	},
});

export const backfillInvoiceVatCategoryInternal = internalMutation({
	args: {},
	handler: async (ctx) => {
		const invoices = await ctx.db.query("invoices").collect();
		let patched = 0;
		for (const inv of invoices) {
			if (inv.vatCategory !== undefined) continue;
			await ctx.db.patch(inv._id, {
				vatCategory: deriveVatCategoryFromRate(inv.vatRate),
			});
			patched += 1;
		}
		return { total: invoices.length, patched };
	},
});

export const backfillInvoiceTotalsInternal = internalMutation({
	args: {},
	handler: async (ctx) => {
		const invoices = await ctx.db.query("invoices").collect();
		let patched = 0;
		for (const inv of invoices) {
			if (inv.subtotal !== undefined && inv.lineCount !== undefined) continue;
			await recomputeInvoiceTotals(ctx, inv._id);
			patched += 1;
		}
		return { total: invoices.length, patched };
	},
});
