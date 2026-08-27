import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { customAlphabet } from "nanoid";
import { mutation, query } from "./_generated/server";

const slugAlphabet =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const newSlug = customAlphabet(slugAlphabet, 12);

export const signNda = mutation({
	args: {
		slug: v.string(),
		token: v.string(),
		signedByName: v.string(),
		signedByEmail: v.optional(v.string()),
		signedByCompany: v.optional(v.string()),
		userAgent: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const nda = await ctx.db
			.query("ndas")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (!nda) throw new ConvexError("not_found");
		if (!nda.published) throw new ConvexError("not_available");
		if (nda.shareToken !== args.token) throw new ConvexError("invalid_token");
		if (nda.signedSlug) throw new ConvexError("already_signed");

		const name = args.signedByName.trim();
		if (!name) throw new ConvexError("name_required");

		const signedSlug = newSlug();
		await ctx.db.insert("signedNdas", {
			ndaId: nda._id,
			ownerId: nda.ownerId,
			clientId: nda.clientId,
			title: nda.title,
			language: nda.language,
			bodySnapshot: nda.body,
			signedAt: Date.now(),
			signedByName: name,
			signedByEmail: args.signedByEmail?.trim() || undefined,
			signedByCompany: args.signedByCompany?.trim() || undefined,
			signedUserAgent: args.userAgent,
			slug: signedSlug,
		});
		// Lock the draft so the public page stops offering the signing form.
		await ctx.db.patch(nda._id, { signedSlug, updatedAt: Date.now() });
		return { slug: signedSlug };
	},
});

export const getBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const signed = await ctx.db
			.query("signedNdas")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (!signed) return null;
		return signed;
	},
});

export const listByOwner = query({
	args: { clientId: v.optional(v.id("clients")) },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const all = await ctx.db
			.query("signedNdas")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.order("desc")
			.collect();
		if (args.clientId === undefined) return all;
		return all.filter((s) => s.clientId === args.clientId);
	},
});
