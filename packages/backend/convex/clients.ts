import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

const contactImportV = v.object({
	importedFrom: v.string(), // Moneybird contact-id
	name: v.string(),
	companyName: v.optional(v.string()),
	email: v.optional(v.string()),
	phone: v.optional(v.string()),
	street: v.optional(v.string()),
	addressLine2: v.optional(v.string()),
	postalCode: v.optional(v.string()),
	city: v.optional(v.string()),
	countryCode: v.optional(v.string()),
	vatNumber: v.optional(v.string()),
	kvkNumber: v.optional(v.string()),
});

// Bulk-import vanuit een Moneybird-contactenexport. Idempotent: bestaande
// records (op importedFrom, anders op e-mail of bedrijfsnaam) worden
// aangevuld met ontbrekende velden, nooit overschreven.
export const importContactsInternal = internalMutation({
	args: { ownerEmail: v.string(), contacts: v.array(contactImportV) },
	handler: async (ctx, args) => {
		const owner = (await ctx.db.query("users").collect()).find(
			(u) => u.email === args.ownerEmail,
		);
		if (!owner) throw new ConvexError("owner_not_found");
		const existing = await ctx.db
			.query("clients")
			.withIndex("by_owner", (q) => q.eq("ownerId", owner._id))
			.collect();
		let created = 0;
		let updated = 0;
		for (const c of args.contacts) {
			const match = existing.find(
				(e) =>
					e.importedFrom === c.importedFrom ||
					(c.email !== undefined && e.email === c.email) ||
					(c.companyName !== undefined &&
						(e.companyName === c.companyName || e.name === c.companyName)),
			);
			if (match) {
				// Alleen lege velden aanvullen.
				const patch: Record<string, string> = {};
				for (const [key, value] of Object.entries(c)) {
					if (value === undefined) continue;
					if (match[key as keyof typeof match] === undefined) {
						patch[key] = value;
					}
				}
				if (Object.keys(patch).length > 0) {
					await ctx.db.patch(match._id, patch);
					updated += 1;
				}
				continue;
			}
			await ctx.db.insert("clients", { ownerId: owner._id, ...c });
			created += 1;
		}
		return { created, updated, total: args.contacts.length };
	},
});

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		return await ctx.db
			.query("clients")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();
	},
});

export const listWithCounts = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const clients = await ctx.db
			.query("clients")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();
		const offertes = await ctx.db
			.query("offertes")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();
		return clients.map((c) => ({
			...c,
			offerteCount: offertes.filter((o) => o.clientId === c._id).length,
		}));
	},
});

export const getById = query({
	args: { id: v.id("clients") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;
		const client = await ctx.db.get(args.id);
		if (!client || client.ownerId !== userId) return null;
		return client;
	},
});

export const create = mutation({
	args: {
		name: v.string(),
		email: v.optional(v.string()),
		companyName: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		return await ctx.db.insert("clients", {
			ownerId: userId,
			name: args.name,
			email: args.email,
			companyName: args.companyName,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("clients"),
		name: v.optional(v.string()),
		email: v.optional(v.string()),
		companyName: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const client = await ctx.db.get(args.id);
		if (!client || client.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.patch(args.id, {
			...(args.name !== undefined ? { name: args.name } : {}),
			...(args.email !== undefined ? { email: args.email } : {}),
			...(args.companyName !== undefined
				? { companyName: args.companyName }
				: {}),
		});
	},
});

export const remove = mutation({
	args: { id: v.id("clients") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const client = await ctx.db.get(args.id);
		if (!client || client.ownerId !== userId) {
			throw new ConvexError("forbidden");
		}
		await ctx.db.delete(args.id);
	},
});
