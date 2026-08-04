import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

const themeValidator = v.union(
	v.literal("light"),
	v.literal("dark"),
	v.literal("system"),
);

export const get = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		return settings;
	},
});

export const update = mutation({
	args: {
		theme: v.optional(themeValidator),
		brandColor: v.optional(v.string()),
		vatNumber: v.optional(v.string()),
		kvkNumber: v.optional(v.string()),
		invoicePrefix: v.optional(v.string()),
		defaultCurrency: v.optional(v.string()),
		defaultVatRate: v.optional(v.number()),
		businessName: v.optional(v.string()),
		businessAddress: v.optional(v.string()),
		businessStreet: v.optional(v.string()),
		businessPostalCode: v.optional(v.string()),
		businessCity: v.optional(v.string()),
		businessCountryCode: v.optional(v.string()),
		businessEmail: v.optional(v.string()),
		iban: v.optional(v.string()),
		bic: v.optional(v.string()),
		signatureDataUrl: v.optional(v.string()),
		signatureName: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const existing = await ctx.db
			.query("userSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		if (!existing) {
			await ctx.db.insert("userSettings", {
				userId,
				theme: args.theme ?? "system",
				brandColor: args.brandColor,
				vatNumber: args.vatNumber,
				kvkNumber: args.kvkNumber,
				invoicePrefix: args.invoicePrefix ?? "BO-",
				defaultCurrency: args.defaultCurrency ?? "EUR",
				defaultVatRate: args.defaultVatRate ?? 21,
				businessName: args.businessName,
				businessAddress: args.businessAddress,
			});
			return;
		}
		await ctx.db.patch(existing._id, {
			...(args.theme !== undefined ? { theme: args.theme } : {}),
			...(args.brandColor !== undefined
				? { brandColor: args.brandColor }
				: {}),
			...(args.vatNumber !== undefined ? { vatNumber: args.vatNumber } : {}),
			...(args.kvkNumber !== undefined ? { kvkNumber: args.kvkNumber } : {}),
			...(args.invoicePrefix !== undefined
				? { invoicePrefix: args.invoicePrefix }
				: {}),
			...(args.defaultCurrency !== undefined
				? { defaultCurrency: args.defaultCurrency }
				: {}),
			...(args.defaultVatRate !== undefined
				? { defaultVatRate: args.defaultVatRate }
				: {}),
			...(args.businessName !== undefined
				? { businessName: args.businessName }
				: {}),
			...(args.businessAddress !== undefined
				? { businessAddress: args.businessAddress }
				: {}),
			...(args.businessStreet !== undefined
				? { businessStreet: args.businessStreet }
				: {}),
			...(args.businessPostalCode !== undefined
				? { businessPostalCode: args.businessPostalCode }
				: {}),
			...(args.businessCity !== undefined
				? { businessCity: args.businessCity }
				: {}),
			...(args.businessCountryCode !== undefined
				? { businessCountryCode: args.businessCountryCode }
				: {}),
			...(args.businessEmail !== undefined
				? { businessEmail: args.businessEmail }
				: {}),
			...(args.iban !== undefined ? { iban: args.iban } : {}),
			...(args.bic !== undefined ? { bic: args.bic } : {}),
			...(args.signatureDataUrl !== undefined
				? {
						signatureDataUrl:
							args.signatureDataUrl === "" ? undefined : args.signatureDataUrl,
					}
				: {}),
			...(args.signatureName !== undefined
				? {
						signatureName:
							args.signatureName === "" ? undefined : args.signatureName,
					}
				: {}),
		});
	},
});

// Eenmalige seed van het bedrijfsprofiel (waarden van de Moneybird-factuur)
// + doorlopen van de Moneybird-nummerreeks. Vult alleen lege velden aan.
export const seedBusinessProfileInternal = internalMutation({
	args: { ownerEmail: v.string() },
	handler: async (ctx, args) => {
		const owner = (await ctx.db.query("users").collect()).find(
			(u) => u.email === args.ownerEmail,
		);
		if (!owner) throw new ConvexError("owner_not_found");
		const existing = await ctx.db
			.query("userSettings")
			.withIndex("by_user", (q) => q.eq("userId", owner._id))
			.unique();
		const profile = {
			businessName: "brandocean",
			businessStreet: "Rooswijck 5A",
			businessPostalCode: "1081AJ",
			businessCity: "Amsterdam",
			businessCountryCode: "NL",
			businessEmail: "info@brandocean.nl",
			kvkNumber: "86415441",
			vatNumber: "NL004243554B91",
			iban: "NL43INGB0109900731",
			bic: "INGBNL2A",
			invoicePrefix: "2026-",
			nextInvoiceNumber: 32,
		};
		if (!existing) {
			await ctx.db.insert("userSettings", {
				userId: owner._id,
				theme: "system",
				defaultCurrency: "EUR",
				defaultVatRate: 21,
				...profile,
			});
			return { created: true };
		}
		const patch: Record<string, string | number> = {};
		for (const [key, value] of Object.entries(profile)) {
			if (existing[key as keyof typeof existing] === undefined) {
				patch[key] = value;
			}
		}
		// Nummering volgt altijd de Moneybird-reeks (JJJJ-NNNN), maar de teller
		// gaat nooit terug ten opzichte van wat er al is.
		patch.invoicePrefix = profile.invoicePrefix;
		patch.nextInvoiceNumber = Math.max(
			existing.nextInvoiceNumber ?? 0,
			profile.nextInvoiceNumber,
		);
		await ctx.db.patch(existing._id, patch);
		return { created: false, patched: Object.keys(patch) };
	},
});
