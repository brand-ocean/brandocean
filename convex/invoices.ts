import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { customAlphabet } from "nanoid";
import {
	type MutationCtx,
	internalMutation,
	mutation,
	query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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
				const vat = Math.round((subtotal * inv.vatRate) / 100);
				return {
					...inv,
					subtotal,
					vat,
					total: subtotal + vat,
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
		return {
			invoice,
			lines: lines.sort((a, b) => a.order - b.order),
			client: client
				? {
						name: client.name,
						email: client.email,
						companyName: client.companyName,
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
		currency: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const invoice = await ctx.db.get(args.id);
		if (!invoice || invoice.ownerId !== userId)
			throw new ConvexError("forbidden");
		await ctx.db.patch(args.id, {
			...(args.issuedAt !== undefined ? { issuedAt: args.issuedAt } : {}),
			...(args.dueAt !== undefined ? { dueAt: args.dueAt } : {}),
			...(args.notes !== undefined ? { notes: args.notes } : {}),
			...(args.vatRate !== undefined ? { vatRate: args.vatRate } : {}),
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
		await ctx.db.patch(args.id, {
			status: args.status,
			paidAt: args.status === "paid" ? Date.now() : undefined,
			updatedAt: Date.now(),
		});
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
) {
	const inv = await ctx.db.get(id);
	if (!inv || inv.ownerId !== userId) throw new ConvexError("forbidden");
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
		await assertOwnInvoice(ctx, args.invoiceId, userId);
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
		await assertOwnInvoice(ctx, line.invoiceId, userId);
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
		await assertOwnInvoice(ctx, line.invoiceId, userId);
		await ctx.db.delete(args.id);
		await recomputeInvoiceTotals(ctx, line.invoiceId);
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
