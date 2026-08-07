import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { customAlphabet } from "nanoid";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	type QueryCtx,
	query,
} from "./_generated/server";
import {
	type PortfolioBlock,
	type PortfolioMedia,
	portfolioBlock,
	portfolioMedia,
} from "./lib/portfolioBlocks";

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

/**
 * Turn an uploaded image into something the browser can render. Items that came
 * in as plain URLs pass straight through, so both content generations render
 * from the same `url` field.
 */
async function resolveMedia(
	ctx: QueryCtx,
	media: PortfolioMedia,
): Promise<PortfolioMedia> {
	if (!media.storageId) return media;
	const url = await ctx.storage.getUrl(media.storageId);
	return { ...media, url: url ?? media.url };
}

async function resolveBlock(
	ctx: QueryCtx,
	block: PortfolioBlock,
): Promise<PortfolioBlock> {
	if (block.kind === "image") {
		return { ...block, media: await resolveMedia(ctx, block.media) };
	}
	if (block.kind === "gallery") {
		return {
			...block,
			items: await Promise.all(block.items.map((m) => resolveMedia(ctx, m))),
		};
	}
	return block;
}

/**
 * Every read of a portfolio item goes through this, so a consumer never has to
 * know whether an image lives in Convex storage or on a CDN. `heroImageUrl` and
 * `gallery` stay populated for the older pages that read them directly.
 */
async function resolveItem(ctx: QueryCtx, item: Doc<"portfolioItems">) {
	const heroImage = item.heroImage
		? await resolveMedia(ctx, item.heroImage)
		: undefined;
	const galleryMedia = item.galleryMedia
		? await Promise.all(item.galleryMedia.map((m) => resolveMedia(ctx, m)))
		: undefined;
	const blocks = item.blocks
		? await Promise.all(item.blocks.map((b) => resolveBlock(ctx, b)))
		: undefined;

	const galleryUrls = (galleryMedia ?? [])
		.map((m) => m.url)
		.filter((url): url is string => Boolean(url));

	return {
		...item,
		heroImage,
		galleryMedia,
		blocks,
		heroImageUrl: heroImage?.url ?? item.heroImageUrl,
		gallery: galleryUrls.length > 0 ? galleryUrls : item.gallery,
	};
}

export type ResolvedPortfolioItem = Awaited<ReturnType<typeof resolveItem>>;

export const listPublic = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const limit = args.limit ?? 100;
		const items = await ctx.db
			.query("portfolioItems")
			.withIndex("by_published_order", (q) => q.eq("published", true))
			.order("asc")
			.take(limit);
		return await Promise.all(items.map((item) => resolveItem(ctx, item)));
	},
});

/** The homepage's featured cards, in display order. */
export const listFeatured = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const items = await ctx.db
			.query("portfolioItems")
			.withIndex("by_published_order", (q) => q.eq("published", true))
			.order("asc")
			.collect();
		const featured = items.filter((item) => item.featured);
		return await Promise.all(
			featured.slice(0, args.limit ?? 4).map((item) => resolveItem(ctx, item)),
		);
	},
});

export const listAll = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const items = await ctx.db
			.query("portfolioItems")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();
		return await Promise.all(items.map((item) => resolveItem(ctx, item)));
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
		return await resolveItem(ctx, item);
	},
});

/** Signed URL the CMS POSTs an image to before saving its storage id. */
export const generateUploadUrl = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		return await ctx.storage.generateUploadUrl();
	},
});

/**
 * Drop an uploaded file once the CMS has removed the block referencing it.
 * Only files that no portfolio item still points at are deleted, so swapping an
 * image that is reused elsewhere can't blank out the other spot.
 */
export const deleteUpload = mutation({
	args: { storageId: v.id("_storage") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const items = await ctx.db
			.query("portfolioItems")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();
		const stillUsed = items.some((item) => usesStorageId(item, args.storageId));
		if (stillUsed) return { deleted: false };
		await ctx.storage.delete(args.storageId);
		return { deleted: true };
	},
});

// --- Screenshot capture via Cloudflare Browser Rendering --------------------
//
// Same engine and credentials the feedback tool uses (see snapshots.ts): a
// server-side headless browser renders the client's live site and the PNG lands
// straight in Convex storage, so a portfolio item can get real artwork without
// anyone opening a screenshot tool. Only reaches public pages — anything behind
// a login renders as the login screen.

const CAPTURE_VIEWPORTS = {
	desktop: { width: 1440, height: 900 },
	mobile: { width: 390, height: 844 },
} as const;

/**
 * Cookie walls, newsletter popups and floating chat/booking widgets otherwise
 * dominate almost every shot of a live client site. Named vendors first, then
 * the generic attribute patterns that catch the rest.
 */
const HIDE_OVERLAYS = `
#onetrust-consent-sdk,#CybotCookiebotDialog,#cookiescript_injected,#cookie-law-info-bar,
#usercentrics-root,#didomi-host,.cc-window,.cookie-notice-container,.klaro,
[id*='cookie'],[class*='cookie'],[id*='Cookie'],[class*='Cookie'],
[id*='cookieConsent'],[class*='cookieConsent'],[class*='consent-banner'],
#intercom-container,.intercom-lightweight-app,[id*='intercom'],
.crisp-client,#tawkchat-container,#hubspot-messages-iframe-container,
#drift-widget-container,.drift-frame-controller,[id*='trengo'],[class*='trengo'],
[id*='whatsapp'],[class*='whatsapp-button'],[class*='wa-widget'],
[class*='newsletter-modal'],[class*='newsletter-popup'],[class*='popup-overlay'],
[class*='modal-backdrop'],.modal.show,.modal.in,[class*='exit-intent'],
[id*='popup'],[class*='popup'],[class*='Popup'],
[class*='klaviyo-form'],.needsclick[class*='kl-private'],
[aria-modal='true'],[role='dialog']
{display:none!important;visibility:hidden!important;opacity:0!important}
html,body{overflow:auto!important;position:static!important}
`;

/**
 * Lazy-loads the page by stepping through it, then parks at the requested
 * fraction of the scrollable height so each shot shows a different section.
 * Sites driven by smooth-scroll libraries may ignore scrollTo — they simply
 * come back as top-of-page rather than failing.
 */
function scrollScript(fraction: number): string {
	return `(async () => {
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const maxScroll = () =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

  /**
   * Selector lists never keep up with 17 different client sites, so classify by
   * geometry instead: anything pinned to the viewport that either covers it
   * (a modal) or hangs in the bottom band (chat bubble, cookie bar, sticky CTA)
   * is clutter. Headers pinned to the top are part of the design — left alone.
   */
  const stripOverlays = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const el of document.querySelectorAll('body *')) {
      const pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const coversViewport = r.width * r.height > vw * vh * 0.6;
      const inBottomBand = r.top > vh * 0.6;
      if (coversViewport || inBottomBand) el.style.setProperty('display', 'none', 'important');
    }
  };

  stripOverlays();
  for (let y = 0; y < maxScroll(); y += window.innerHeight) {
    window.scrollTo(0, y);
    await pause(120);
  }
  window.scrollTo(0, Math.round(maxScroll() * ${fraction}));
  await pause(400);
  // Again after scrolling — sticky CTAs and exit-intent popups only appear once
  // the visitor has moved down the page.
  stripOverlays();
  await pause(200);
})();`;
}

/** One Browser Rendering call. Throws with the API's own message on failure. */
async function renderScreenshot(opts: {
	url: string;
	device: "desktop" | "mobile";
	fullPage: boolean;
	/** 0 = top of page, 0.5 = halfway down, 1 = bottom. */
	scrollFraction?: number;
}): Promise<ArrayBuffer> {
	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	const apiToken = process.env.CLOUDFLARE_BROWSER_API_TOKEN;
	if (!accountId || !apiToken) throw new ConvexError("cloudflare_not_configured");

	const res = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/screenshot`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				url: opts.url,
				viewport: {
					...CAPTURE_VIEWPORTS[opts.device],
					deviceScaleFactor: 2,
				},
				screenshotOptions: { type: "png", fullPage: opts.fullPage },
				// networkidle2 + bestAttempt, as in snapshots.ts: marketing sites keep
				// analytics sockets open so networkidle0 may never settle.
				gotoOptions: { waitUntil: "networkidle2", timeout: 45000 },
				bestAttempt: true,
				addStyleTag: [{ content: HIDE_OVERLAYS }],
				addScriptTag: [{ content: scrollScript(opts.scrollFraction ?? 0) }],
				// Long enough for the stepped lazy-load walk plus any reveal animation
				// that fires when a section scrolls into view.
				waitForTimeout: 3500,
			}),
		},
	);

	const contentType = res.headers.get("Content-Type") || "";
	if (!res.ok || !contentType.startsWith("image/")) {
		const text = await res.text().catch(() => "");
		throw new ConvexError(`capture_failed: ${text.slice(0, 200)}`);
	}
	return await res.arrayBuffer();
}

export const captureShot = action({
	args: {
		id: v.id("portfolioItems"),
		/** Defaults to the item's own externalUrl. */
		url: v.optional(v.string()),
		target: v.union(v.literal("hero"), v.literal("gallery")),
		device: v.optional(v.union(v.literal("desktop"), v.literal("mobile"))),
		/** Whole page rather than just the first viewport. */
		fullPage: v.optional(v.boolean()),
	},
	handler: async (ctx, args): Promise<{ storageId: Id<"_storage"> }> => {
		const item = await ctx.runQuery(api.portfolio.getById, { id: args.id });
		const target = args.url?.trim() || item.externalUrl;
		if (!target) throw new ConvexError("no_url");

		// Each extra gallery grab walks further down the page, so clicking the
		// button repeatedly builds a set of different sections rather than the
		// same hero crop over and over.
		const scrollFraction =
			args.target === "hero"
				? 0
				: SECTION_DEPTHS[(item.galleryMedia?.length ?? 0) % SECTION_DEPTHS.length];

		const buf = await renderScreenshot({
			url: target,
			device: args.device ?? "desktop",
			fullPage: args.fullPage ?? false,
			scrollFraction,
		});

		const storageId = await ctx.storage.store(
			new Blob([buf], { type: "image/png" }),
		);

		await ctx.runMutation(internal.portfolio.attachShot, {
			id: args.id,
			storageId,
			target: args.target,
			alt: `${item.title} — ${target}`,
		});

		return { storageId };
	},
});

/**
 * Which shots make up an item's gallery. Every shot is a different *section* —
 * scrolled to a different depth — so a gallery never ends up as four near
 * identical hero crops. Items with extra `livePages` get one shot per page at
 * staggered depths; items with only a homepage get that page sampled down its
 * length. The tail of a page is skipped: that's almost always the footer.
 */
const SECTION_DEPTHS = [0.28, 0.5, 0.72, 0.38, 0.62];

function galleryPlan(
	livePages: string[] | undefined,
	externalUrl: string | undefined,
): { url: string; scrollFraction: number }[] {
	const extras: string[] = [];
	for (const page of livePages ?? []) {
		const url = /^https?:\/\//i.test(page)
			? page
			: externalUrl
				? new URL(page, externalUrl).toString()
				: undefined;
		// The hero already covers the front page at full height.
		if (!url || url === externalUrl) continue;
		extras.push(url);
	}

	if (extras.length > 0) {
		return extras.map((url, i) => ({
			url,
			scrollFraction: SECTION_DEPTHS[i % SECTION_DEPTHS.length],
		}));
	}

	if (!externalUrl) return [];
	// Homepage-only item: sample the one page at widely spaced depths. Short
	// pages still produce near-duplicates — there just isn't more page to show.
	return [0.33, 0.66, 0.92].map((scrollFraction) => ({
		url: externalUrl,
		scrollFraction,
	}));
}

// One item per invocation, driven from the CLI, so a slow client site can never
// push the whole backfill past an action's time limit. Idempotent: re-running a
// slug replaces that item's captured hero and gallery rather than appending.
export const captureItemInternal = internalAction({
	args: { slug: v.string(), skipIfHasUpload: v.optional(v.boolean()) },
	handler: async (
		ctx,
		args,
	): Promise<{
		slug: string;
		hero: string;
		gallery: number;
		failures: string[];
	}> => {
		const item = await ctx.runQuery(internal.portfolio.itemForCapture, {
			slug: args.slug,
		});
		if (!item) return { slug: args.slug, hero: "no_item", gallery: 0, failures: [] };
		if (args.skipIfHasUpload && item.heroImage?.storageId) {
			return { slug: args.slug, hero: "skipped", gallery: 0, failures: [] };
		}

		const failures: string[] = [];

		let heroStorageId: Id<"_storage"> | undefined;
		if (item.externalUrl) {
			try {
				const buf = await renderScreenshot({
					url: item.externalUrl,
					device: "desktop",
					fullPage: false,
				});
				heroStorageId = await ctx.storage.store(
					new Blob([buf], { type: "image/png" }),
				);
			} catch (e) {
				failures.push(
					`hero ${item.externalUrl}: ${e instanceof Error ? e.message : String(e)}`,
				);
			}
		}

		const galleryStorageIds: Id<"_storage">[] = [];
		for (const shot of galleryPlan(item.livePages, item.externalUrl)) {
			try {
				const buf = await renderScreenshot({
					url: shot.url,
					device: "desktop",
					fullPage: false,
					scrollFraction: shot.scrollFraction,
				});
				galleryStorageIds.push(
					await ctx.storage.store(new Blob([buf], { type: "image/png" })),
				);
			} catch (e) {
				failures.push(
					`gallery ${shot.url} @${shot.scrollFraction}: ${
						e instanceof Error ? e.message : String(e)
					}`,
				);
			}
		}

		await ctx.runMutation(internal.portfolio.setCapturedMedia, {
			id: item._id,
			title: item.title,
			heroStorageId,
			galleryStorageIds,
		});

		return {
			slug: args.slug,
			hero: heroStorageId ? "ok" : "failed",
			gallery: galleryStorageIds.length,
			failures,
		};
	},
});

export const itemForCapture = internalQuery({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("portfolioItems")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
	},
});

export const setCapturedMedia = internalMutation({
	args: {
		id: v.id("portfolioItems"),
		title: v.string(),
		heroStorageId: v.optional(v.id("_storage")),
		galleryStorageIds: v.array(v.id("_storage")),
	},
	handler: async (ctx, args) => {
		const patch: {
			updatedAt: number;
			heroImage?: PortfolioMedia;
			galleryMedia?: PortfolioMedia[];
		} = { updatedAt: Date.now() };
		if (args.heroStorageId) {
			patch.heroImage = {
				storageId: args.heroStorageId,
				alt: args.title,
			};
		}
		if (args.galleryStorageIds.length > 0) {
			patch.galleryMedia = args.galleryStorageIds.map((storageId, i) => ({
				storageId,
				alt: `${args.title} — ${i + 1}`,
			}));
		}
		await ctx.db.patch(args.id, patch);
	},
});

export const attachShot = internalMutation({
	args: {
		id: v.id("portfolioItems"),
		storageId: v.id("_storage"),
		target: v.union(v.literal("hero"), v.literal("gallery")),
		alt: v.string(),
	},
	handler: async (ctx, args) => {
		const item = await ctx.db.get(args.id);
		if (!item) throw new ConvexError("not_found");
		const media = { storageId: args.storageId, alt: args.alt };
		if (args.target === "hero") {
			await ctx.db.patch(args.id, { heroImage: media, updatedAt: Date.now() });
		} else {
			await ctx.db.patch(args.id, {
				galleryMedia: [...(item.galleryMedia ?? []), media],
				updatedAt: Date.now(),
			});
		}
	},
});

function usesStorageId(item: Doc<"portfolioItems">, storageId: string): boolean {
	if (item.heroImage?.storageId === storageId) return true;
	if (item.galleryMedia?.some((m) => m.storageId === storageId)) return true;
	return (item.blocks ?? []).some((block) => {
		if (block.kind === "image") return block.media.storageId === storageId;
		if (block.kind === "gallery")
			return block.items.some((m) => m.storageId === storageId);
		return false;
	});
}

export const getBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const item = await ctx.db
			.query("portfolioItems")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (!item || !item.published) return null;
		return await resolveItem(ctx, item);
	},
});

const itemFields = {
	title: v.string(),
	category: v.string(),
	project: v.string(),
	ctaLabel: v.string(),
	slug: v.optional(v.string()),
	summary: v.optional(v.string()),
	blocks: v.optional(v.array(portfolioBlock)),
	heroImage: v.optional(portfolioMedia),
	galleryMedia: v.optional(v.array(portfolioMedia)),
	year: v.optional(v.number()),
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
			blocks: args.blocks,
			heroImage: args.heroImage,
			galleryMedia: args.galleryMedia,
			year: args.year,
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
