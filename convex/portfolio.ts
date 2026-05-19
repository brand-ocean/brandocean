import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { customAlphabet } from "nanoid";
import { internalMutation, mutation, query } from "./_generated/server";

const slugAlphabet =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const newSlug = customAlphabet(slugAlphabet, 10);

function slugify(input: string): string {
	return input
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
}

export const listPublic = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const limit = args.limit ?? 100;
		return await ctx.db
			.query("portfolioItems")
			.withIndex("by_published_order", (q) => q.eq("published", true))
			.order("asc")
			.take(limit);
	},
});

export const listAll = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		return await ctx.db
			.query("portfolioItems")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();
	},
});

export const getById = query({
	args: { id: v.id("portfolioItems") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const item = await ctx.db.get(args.id);
		if (!item) throw new ConvexError("not_found");
		if (item.ownerId !== userId) throw new ConvexError("forbidden");
		return item;
	},
});

export const getBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const item = await ctx.db
			.query("portfolioItems")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (!item || !item.published) return null;
		return item;
	},
});

const itemFields = {
	title: v.string(),
	category: v.string(),
	project: v.string(),
	ctaLabel: v.string(),
	slug: v.optional(v.string()),
	summary: v.optional(v.string()),
	body: v.optional(v.any()),
	heroImageUrl: v.optional(v.string()),
	bunnyVideoUrl: v.optional(v.string()),
	bunnyVideoId: v.optional(v.string()),
	bunnyLibraryId: v.optional(v.string()),
	gallery: v.optional(v.array(v.string())),
	livePages: v.optional(v.array(v.string())),
	industry: v.optional(v.string()),
	tags: v.optional(v.array(v.string())),
	externalUrl: v.optional(v.string()),
	order: v.optional(v.number()),
	published: v.optional(v.boolean()),
	featured: v.optional(v.boolean()),
};

async function ensureUniqueSlug(
	ctx: { db: { query: (t: "portfolioItems") => any } },
	desired: string,
): Promise<string> {
	let candidate = desired || newSlug();
	let attempt = 0;
	// Loop a small number of times to avoid collisions; fallback to random.
	while (attempt < 5) {
		const existing = await ctx.db
			.query("portfolioItems")
			.withIndex("by_slug", (q: { eq: (f: string, v: string) => unknown }) =>
				q.eq("slug", candidate),
			)
			.unique();
		if (!existing) return candidate;
		attempt += 1;
		candidate = `${desired}-${newSlug().slice(0, 4)}`;
	}
	return newSlug();
}

export const create = mutation({
	args: itemFields,
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const now = Date.now();
		const slug = await ensureUniqueSlug(ctx, args.slug ?? slugify(args.title));
		const maxOrder = await ctx.db
			.query("portfolioItems")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();
		const nextOrder =
			args.order ??
			(maxOrder.length === 0
				? 0
				: Math.max(...maxOrder.map((m) => m.order)) + 10);
		return await ctx.db.insert("portfolioItems", {
			ownerId: userId,
			title: args.title,
			category: args.category,
			project: args.project,
			ctaLabel: args.ctaLabel,
			slug,
			summary: args.summary,
			body: args.body,
			heroImageUrl: args.heroImageUrl,
			bunnyVideoUrl: args.bunnyVideoUrl,
			bunnyVideoId: args.bunnyVideoId,
			bunnyLibraryId: args.bunnyLibraryId,
			gallery: args.gallery,
			livePages: args.livePages,
			industry: args.industry,
			tags: args.tags,
			externalUrl: args.externalUrl,
			order: nextOrder,
			published: args.published ?? false,
			featured: args.featured ?? false,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: { id: v.id("portfolioItems"), ...itemFields },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const item = await ctx.db.get(args.id);
		if (!item || item.ownerId !== userId) throw new ConvexError("forbidden");
		const { id, slug, ...rest } = args;
		const patch: Record<string, unknown> = { ...rest, updatedAt: Date.now() };
		if (slug !== undefined && slug !== item.slug) {
			patch.slug = await ensureUniqueSlug(ctx, slug);
		}
		await ctx.db.patch(id, patch);
	},
});

export const remove = mutation({
	args: { id: v.id("portfolioItems") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const item = await ctx.db.get(args.id);
		if (!item || item.ownerId !== userId) throw new ConvexError("forbidden");
		await ctx.db.delete(args.id);
	},
});

export const removeBySlug = internalMutation({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const items = await ctx.db
			.query("portfolioItems")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.collect();
		for (const item of items) {
			await ctx.db.delete(item._id);
		}
		return items.length;
	},
});

export const reorder = mutation({
	args: {
		updates: v.array(
			v.object({ id: v.id("portfolioItems"), order: v.number() }),
		),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		for (const u of args.updates) {
			const item = await ctx.db.get(u.id);
			if (!item || item.ownerId !== userId) continue;
			await ctx.db.patch(u.id, { order: u.order, updatedAt: Date.now() });
		}
	},
});

export const bulkImport = mutation({
	args: {
		items: v.array(
			v.object({
				title: v.string(),
				category: v.string(),
				project: v.string(),
				ctaLabel: v.string(),
				slug: v.optional(v.string()),
				summary: v.optional(v.string()),
				heroImageUrl: v.optional(v.string()),
				bunnyVideoUrl: v.optional(v.string()),
				bunnyVideoId: v.optional(v.string()),
				bunnyLibraryId: v.optional(v.string()),
				gallery: v.optional(v.array(v.string())),
				livePages: v.optional(v.array(v.string())),
				industry: v.optional(v.string()),
				tags: v.optional(v.array(v.string())),
				externalUrl: v.optional(v.string()),
				published: v.optional(v.boolean()),
				featured: v.optional(v.boolean()),
			}),
		),
		replaceExisting: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		if (args.replaceExisting) {
			const existing = await ctx.db
				.query("portfolioItems")
				.withIndex("by_owner", (q) => q.eq("ownerId", userId))
				.collect();
			for (const e of existing) await ctx.db.delete(e._id);
		}
		const now = Date.now();
		const ids = [];
		let order = 0;
		for (const incoming of args.items) {
			const slug = await ensureUniqueSlug(
				ctx,
				incoming.slug ?? slugify(incoming.title),
			);
			const id = await ctx.db.insert("portfolioItems", {
				ownerId: userId,
				title: incoming.title,
				category: incoming.category,
				project: incoming.project,
				ctaLabel: incoming.ctaLabel,
				slug,
				summary: incoming.summary,
				heroImageUrl: incoming.heroImageUrl,
				bunnyVideoUrl: incoming.bunnyVideoUrl,
				bunnyVideoId: incoming.bunnyVideoId,
				bunnyLibraryId: incoming.bunnyLibraryId,
				gallery: incoming.gallery,
				livePages: incoming.livePages,
				industry: incoming.industry,
				tags: incoming.tags,
				externalUrl: incoming.externalUrl,
				order,
				published: incoming.published ?? true,
				featured: incoming.featured ?? false,
				createdAt: now,
				updatedAt: now,
			});
			ids.push(id);
			order += 10;
		}
		return ids;
	},
});

const INDUSTRY_BY_SLUG: Record<string, string> = {
	"azur-ibiza": "SWIMWEAR",
	"vesting-finance": "FINANCE",
	nerds: "AGENCY",
	"eye-filmmuseum": "CULTURE",
	bruhn: "BARBERSHOP",
	"bruhn-barbershop": "BARBERSHOP",
	kiesbeter: "COMPARISON",
	layerone: "RECRUITMENT",
	"vergeten-bladzijden": "CULTURE",
	"neem-het-stokje-over": "CAMPAIGN",
	"dag-van-empathie": "COMMUNITY",
	prostaffing: "RECRUITMENT",
	"j-the-agency": "AGENCY",
	"ace-and-tate": "E-COMMERCE",
	brons: "RESTAURANT",
	paradiso: "VENUE",
};

const PINNED_TOP_SLUGS = ["kiesbeter", "brons", "ace-and-tate", "layerone"];

export const addParadiso = internalMutation({
	args: {},
	handler: async (ctx) => {
		const existing = await ctx.db
			.query("portfolioItems")
			.withIndex("by_slug", (q) => q.eq("slug", "paradiso"))
			.unique();
		if (existing) return { skipped: true, id: existing._id };
		const owner = await ctx.db.query("portfolioItems").first();
		if (!owner) throw new ConvexError("no_owner_to_inherit");
		const now = Date.now();
		const id = await ctx.db.insert("portfolioItems", {
			ownerId: owner.ownerId,
			title: "Paradiso",
			category: "Branding & Web Development",
			project: "Music Venue · Amsterdam",
			ctaLabel: "View Case",
			slug: "paradiso",
			summary:
				"Iconische Amsterdamse poptempel — branding en digitale aanwezigheid voor een van de bekendste muziekpodia van Nederland.",
			industry: "VENUE",
			tags: ["Branding", "Web Development", "Music", "Amsterdam"],
			externalUrl: "https://www.paradiso.nl/",
			order: -995,
			published: true,
			featured: false,
			createdAt: now,
			updatedAt: now,
		});
		return { skipped: false, id };
	},
});

export const addHetSieraad = internalMutation({
	args: {},
	handler: async (ctx) => {
		const existing = await ctx.db
			.query("portfolioItems")
			.withIndex("by_slug", (q) => q.eq("slug", "het-sieraad"))
			.unique();
		if (existing) return { skipped: true, id: existing._id };
		const owner = await ctx.db.query("portfolioItems").first();
		if (!owner) throw new ConvexError("no_owner_to_inherit");
		const now = Date.now();
		const id = await ctx.db.insert("portfolioItems", {
			ownerId: owner.ownerId,
			title: "Het Sieraad",
			category: "Branding & Web Development",
			project: "Venue · Amsterdam · 2025",
			ctaLabel: "View Case",
			slug: "het-sieraad",
			summary:
				"Club Amsterdam in het iconische Het Sieraad-gebouw — branding en webdevelopment voor een nieuw cultureel hotspot in Amsterdam-West.",
			heroImageUrl:
				"https://cdn.prod.website-files.com/68cc13fdafafe4b8241524fb/68cc7495724ce1dc4760847b_lofi.amsterdam_1756123931_3706958670325619473_13354580159.avif",
			industry: "VENUE",
			tags: ["Branding", "Web Development", "Hospitality", "Amsterdam"],
			externalUrl: "https://clubamsterdam.webflow.io/",
			order: -996,
			published: true,
			featured: false,
			createdAt: now,
			updatedAt: now,
		});
		return { skipped: false, id };
	},
});

export const pinTopOrderInternal = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const updated: string[] = [];
		for (let i = 0; i < PINNED_TOP_SLUGS.length; i += 1) {
			const slug = PINNED_TOP_SLUGS[i];
			const items = await ctx.db
				.query("portfolioItems")
				.withIndex("by_slug", (q) => q.eq("slug", slug))
				.collect();
			for (const item of items) {
				await ctx.db.patch(item._id, { order: -1000 + i, updatedAt: now });
			}
			if (items.length > 0) updated.push(slug);
		}
		return { updated };
	},
});

export const backfillIndustriesInternal = internalMutation({
	args: {},
	handler: async (ctx) => {
		const items = await ctx.db.query("portfolioItems").collect();
		let patched = 0;
		for (const item of items) {
			const industry = item.slug ? INDUSTRY_BY_SLUG[item.slug] : undefined;
			if (!industry) continue;
			if (item.industry === industry) continue;
			await ctx.db.patch(item._id, { industry, updatedAt: Date.now() });
			patched += 1;
		}
		return { total: items.length, patched };
	},
});

export const pinTopOrder = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const now = Date.now();
		const updated: string[] = [];
		for (let i = 0; i < PINNED_TOP_SLUGS.length; i += 1) {
			const slug = PINNED_TOP_SLUGS[i];
			const item = await ctx.db
				.query("portfolioItems")
				.withIndex("by_slug", (q) => q.eq("slug", slug))
				.unique();
			if (!item || item.ownerId !== userId) continue;
			await ctx.db.patch(item._id, { order: -1000 + i, updatedAt: now });
			updated.push(slug);
		}
		return { updated };
	},
});

export const backfillIndustries = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const items = await ctx.db
			.query("portfolioItems")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();
		let patched = 0;
		for (const item of items) {
			const industry = item.slug ? INDUSTRY_BY_SLUG[item.slug] : undefined;
			if (!industry) continue;
			if (item.industry === industry) continue;
			await ctx.db.patch(item._id, { industry, updatedAt: Date.now() });
			patched += 1;
		}
		return { total: items.length, patched };
	},
});
