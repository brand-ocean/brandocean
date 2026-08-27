import { type Infer, v } from "convex/values";

/**
 * One image on a portfolio item. Either uploaded through the CMS (`storageId`,
 * the normal path) or pasted in as an external URL (`url`, how the scraped
 * brandocean.nl seed data got in). Queries always resolve `storageId` into
 * `url` before handing an item to the site, so the front end only reads `url`.
 */
export const portfolioMedia = v.object({
	storageId: v.optional(v.id("_storage")),
	url: v.optional(v.string()),
	alt: v.optional(v.string()),
});

export const portfolioStat = v.object({
	value: v.string(),
	label: v.string(),
});

/**
 * The body of a case study: an ordered list of typed blocks, each rendering as
 * one section of the blunt case page. Adding a block type here means adding a
 * branch to the CMS editor (`/portfolio/$itemId`) and to the renderer
 * (`src/blunt/components/CaseBlocks`) — the union keeps both honest.
 */
export const portfolioBlock = v.union(
	v.object({
		kind: v.literal("text"),
		heading: v.optional(v.string()),
		paragraphs: v.array(v.string()),
	}),
	v.object({
		kind: v.literal("image"),
		media: portfolioMedia,
		// "inset" sits in the right-hand column like the sample case study,
		// "full" is the edge-to-edge full-height slab.
		layout: v.union(v.literal("inset"), v.literal("full")),
		caption: v.optional(v.string()),
	}),
	v.object({
		kind: v.literal("gallery"),
		heading: v.optional(v.string()),
		items: v.array(portfolioMedia),
	}),
	v.object({
		kind: v.literal("stats"),
		heading: v.optional(v.string()),
		stats: v.array(portfolioStat),
	}),
	v.object({
		kind: v.literal("quote"),
		quote: v.string(),
		attribution: v.optional(v.string()),
	}),
	v.object({
		kind: v.literal("livePreview"),
		heading: v.optional(v.string()),
		url: v.string(),
	}),
);

export type PortfolioMedia = Infer<typeof portfolioMedia>;
export type PortfolioStat = Infer<typeof portfolioStat>;
export type PortfolioBlock = Infer<typeof portfolioBlock>;
export type PortfolioBlockKind = PortfolioBlock["kind"];

export const PORTFOLIO_BLOCK_KINDS: PortfolioBlockKind[] = [
	"text",
	"image",
	"gallery",
	"stats",
	"quote",
	"livePreview",
];

export const PORTFOLIO_BLOCK_LABELS: Record<PortfolioBlockKind, string> = {
	text: "Tekst",
	image: "Foto",
	gallery: "Fotoreeks",
	stats: "Cijfers",
	quote: "Quote",
	livePreview: "Live preview",
};

/** A fresh block of the given kind, used by the "add block" menu in the CMS. */
export function emptyPortfolioBlock(kind: PortfolioBlockKind): PortfolioBlock {
	switch (kind) {
		case "text":
			return { kind: "text", heading: "", paragraphs: [""] };
		case "image":
			return { kind: "image", media: {}, layout: "inset", caption: "" };
		case "gallery":
			return { kind: "gallery", heading: "", items: [] };
		case "stats":
			return { kind: "stats", heading: "", stats: [{ value: "", label: "" }] };
		case "quote":
			return { kind: "quote", quote: "", attribution: "" };
		case "livePreview":
			return { kind: "livePreview", heading: "", url: "" };
	}
}
