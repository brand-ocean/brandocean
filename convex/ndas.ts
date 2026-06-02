import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { customAlphabet } from "nanoid";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
	buildOneWayNda,
	formatNdaDate,
	type NdaDoc,
	withUpdatedParties,
} from "./ndaTemplates";

const slugAlphabet =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const newSlugSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 4);
const newShareToken = customAlphabet(slugAlphabet, 24);

const SCHEMA_VERSION = 1;
const DEFAULT_TERM_YEARS = 3;
const DEFAULT_GOVERNING_CITY = "Amsterdam";

const languageValidator = v.union(v.literal("nl"), v.literal("en"));
const directionValidator = v.union(
	v.literal("owner_signs"),
	v.literal("client_signs"),
);

function slugifyBase(input: string): string {
	const base = input
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	return base || "nda";
}

async function makeUniqueNdaSlug(
	ctx: MutationCtx,
	base: string,
): Promise<string> {
	const root = slugifyBase(base);
	const existing = await ctx.db
		.query("ndas")
		.withIndex("by_slug", (q) => q.eq("slug", root))
		.first();
	if (!existing) return root;
	for (let i = 2; i < 50; i++) {
		const candidate = `${root}-${i}`;
		const found = await ctx.db
			.query("ndas")
			.withIndex("by_slug", (q) => q.eq("slug", candidate))
			.first();
		if (!found) return candidate;
	}
	return `${root}-${newSlugSuffix()}`;
}

export const create = mutation({
	args: {
		title: v.string(),
		language: languageValidator,
		clientId: v.optional(v.id("clients")),
		direction: v.optional(directionValidator),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");

		const client = args.clientId ? await ctx.db.get(args.clientId) : null;
		const settings = await ctx.db
			.query("userSettings")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();

		const now = Date.now();
		const effectiveDate = formatNdaDate(now, args.language);
		const direction = args.direction ?? "owner_signs";
		const businessName = settings?.businessName || "BRANDOCEAN";
		const businessAddress = settings?.businessAddress || undefined;
		const clientName =
			client?.name ||
			(args.language === "nl" ? "[Naam klant]" : "[Client name]");
		const clientCompany = client?.companyName || undefined;

		// The clauses are identical; only who is named as disclosing vs receiving
		// party swaps, and for owner_signs the owner's signature is embedded.
		const body =
			direction === "owner_signs"
				? buildOneWayNda(
						args.language,
						{
							disclosingParty: clientName,
							disclosingAddress: clientCompany,
							receivingParty: businessName,
							receivingCompany: businessAddress,
							effectiveDate,
							termYears: DEFAULT_TERM_YEARS,
							governingCity: DEFAULT_GOVERNING_CITY,
						},
						{
							dataUrl: settings?.signatureDataUrl || undefined,
							name: settings?.signatureName || businessName,
						},
					)
				: buildOneWayNda(args.language, {
						disclosingParty: businessName,
						disclosingAddress: businessAddress,
						receivingParty: clientName,
						receivingCompany: clientCompany,
						effectiveDate,
						termYears: DEFAULT_TERM_YEARS,
						governingCity: DEFAULT_GOVERNING_CITY,
					});

		const base = client?.name ? `${client.name} ${args.title}` : args.title;
		const slug = await makeUniqueNdaSlug(ctx, base);

		return await ctx.db.insert("ndas", {
			ownerId: userId,
			clientId: args.clientId,
			title: args.title,
			kind: "one_way",
			direction,
			language: args.language,
			body,
			slug,
			shareToken: newShareToken(),
			published: false,
			publicReadable: false,
			schemaVersion: SCHEMA_VERSION,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const listByOwner = query({
	args: { clientId: v.optional(v.id("clients")) },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const all = await ctx.db
			.query("ndas")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.order("desc")
			.collect();
		if (args.clientId === undefined) return all;
		return all.filter((n) => n.clientId === args.clientId);
	},
});

export const getById = query({
	args: { id: v.id("ndas") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const nda = await ctx.db.get(args.id);
		if (!nda) throw new ConvexError("not_found");
		if (nda.ownerId !== userId) throw new ConvexError("forbidden");
		const signed = await ctx.db
			.query("signedNdas")
			.withIndex("by_nda", (q) => q.eq("ndaId", nda._id))
			.order("desc")
			.first();
		return { nda, signed };
	},
});

export const getBySlug = query({
	args: { slug: v.string(), token: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const nda = await ctx.db
			.query("ndas")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (!nda) return null;
		if (!nda.published) return null;
		const tokenMatches = args.token === nda.shareToken;
		if (!nda.publicReadable && !tokenMatches) return null;
		// Never expose shareToken / ownership fields on the public endpoint. The
		// signer's token comes from their own URL, not from this document.
		// owner_signs NDAs are already signed by the owner (signature embedded in
		// the body), so the client never sees a signing form. NDAs created before
		// the direction field existed default to client_signs.
		const direction = nda.direction ?? "client_signs";
		return {
			title: nda.title,
			language: nda.language,
			body: nda.body ?? null,
			slug: nda.slug,
			direction,
			canSign:
				direction === "client_signs" && tokenMatches && !nda.signedSlug,
			alreadySigned: Boolean(nda.signedSlug),
			signedSlug: nda.signedSlug ?? null,
		};
	},
});

export const updateMeta = mutation({
	args: {
		id: v.id("ndas"),
		title: v.optional(v.string()),
		clientId: v.optional(v.id("clients")),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const nda = await ctx.db.get(args.id);
		if (!nda || nda.ownerId !== userId) throw new ConvexError("forbidden");

		// When a client is assigned, refresh the named parties in the document so
		// the disclosing party shows the client's name + company.
		let updatedBody: NdaDoc | undefined;
		if (args.clientId !== undefined && nda.body) {
			const client = await ctx.db.get(args.clientId);
			const settings = await ctx.db
				.query("userSettings")
				.withIndex("by_user", (q) => q.eq("userId", userId))
				.unique();
			updatedBody = withUpdatedParties(
				nda.body as NdaDoc,
				nda.language,
				nda.direction ?? "client_signs",
				{
					businessName: settings?.businessName || "BRANDOCEAN",
					businessAddress: settings?.businessAddress || undefined,
					clientName:
						client?.name ||
						(nda.language === "nl" ? "[Naam klant]" : "[Client name]"),
					clientCompany: client?.companyName || undefined,
				},
			);
		}

		await ctx.db.patch(args.id, {
			updatedAt: Date.now(),
			...(args.title !== undefined ? { title: args.title } : {}),
			...(args.clientId !== undefined ? { clientId: args.clientId } : {}),
			...(updatedBody !== undefined ? { body: updatedBody } : {}),
		});
	},
});

export const updateBody = mutation({
	args: { id: v.id("ndas"), body: v.any() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const nda = await ctx.db.get(args.id);
		if (!nda || nda.ownerId !== userId) throw new ConvexError("forbidden");
		await ctx.db.patch(args.id, { body: args.body, updatedAt: Date.now() });
	},
});

export const regenerateSlug = mutation({
	args: { id: v.id("ndas") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const nda = await ctx.db.get(args.id);
		if (!nda || nda.ownerId !== userId) throw new ConvexError("forbidden");
		const client = nda.clientId ? await ctx.db.get(nda.clientId) : null;
		const base = client?.name ? `${client.name} ${nda.title}` : nda.title;
		const slug = await makeUniqueNdaSlug(ctx, base);
		await ctx.db.patch(args.id, { slug, updatedAt: Date.now() });
		return slug;
	},
});

export const publish = mutation({
	args: { id: v.id("ndas"), publicReadable: v.boolean() },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const nda = await ctx.db.get(args.id);
		if (!nda || nda.ownerId !== userId) throw new ConvexError("forbidden");
		await ctx.db.patch(args.id, {
			published: true,
			publicReadable: args.publicReadable,
			updatedAt: Date.now(),
		});
	},
});

export const unpublish = mutation({
	args: { id: v.id("ndas") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const nda = await ctx.db.get(args.id);
		if (!nda || nda.ownerId !== userId) throw new ConvexError("forbidden");
		await ctx.db.patch(args.id, { published: false, updatedAt: Date.now() });
	},
});

export const remove = mutation({
	args: { id: v.id("ndas") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const nda = await ctx.db.get(args.id);
		if (!nda || nda.ownerId !== userId) throw new ConvexError("forbidden");
		// Signed copies are kept on purpose — they are the standalone legal
		// record and must survive deletion of the editable draft.
		await ctx.db.delete(args.id);
	},
});
