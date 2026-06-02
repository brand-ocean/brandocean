import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
