import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	...authTables,

	offertes: defineTable({
		ownerId: v.id("users"),
		clientId: v.optional(v.id("clients")),
		title: v.string(),
		body: v.optional(v.any()),
		slug: v.string(),
		shareToken: v.string(),
		published: v.boolean(),
		publicReadable: v.boolean(),
		schemaVersion: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_slug", ["slug"])
		.index("by_owner", ["ownerId"])
		.index("by_owner_updated", ["ownerId", "updatedAt"]),

	sections: defineTable({
		offerteId: v.id("offertes"),
		title: v.string(),
		order: v.number(),
	}).index("by_offerte", ["offerteId"]),

	items: defineTable({
		offerteId: v.id("offertes"),
		sectionId: v.id("sections"),
		label: v.string(),
		note: v.optional(v.any()),
		completed: v.boolean(),
		order: v.number(),
	})
		.index("by_section", ["sectionId"])
		.index("by_offerte", ["offerteId"]),

	clients: defineTable({
		ownerId: v.id("users"),
		name: v.string(),
		email: v.optional(v.string()),
		companyName: v.optional(v.string()),
	}).index("by_owner", ["ownerId"]),

	userSettings: defineTable({
		userId: v.id("users"),
		theme: v.union(
			v.literal("light"),
			v.literal("dark"),
			v.literal("system"),
		),
		brandColor: v.optional(v.string()),
		vatNumber: v.optional(v.string()),
		kvkNumber: v.optional(v.string()),
		invoicePrefix: v.optional(v.string()),
		defaultCurrency: v.string(),
		defaultVatRate: v.number(),
		businessName: v.optional(v.string()),
		businessAddress: v.optional(v.string()),
		nextInvoiceNumber: v.optional(v.number()),
	}).index("by_user", ["userId"]),

	invoices: defineTable({
		ownerId: v.id("users"),
		clientId: v.id("clients"),
		contractId: v.optional(v.id("contracts")),
		number: v.string(),
		status: v.union(
			v.literal("draft"),
			v.literal("sent"),
			v.literal("paid"),
			v.literal("overdue"),
			v.literal("void"),
		),
		issuedAt: v.number(),
		dueAt: v.number(),
		paidAt: v.optional(v.number()),
		currency: v.string(),
		vatRate: v.number(),
		notes: v.optional(v.string()),
		slug: v.string(),
		shareToken: v.string(),
		subtotal: v.optional(v.number()),
		lineCount: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_owner", ["ownerId"])
		.index("by_client", ["clientId"])
		.index("by_slug", ["slug"]),

	invoiceLines: defineTable({
		invoiceId: v.id("invoices"),
		description: v.string(),
		quantity: v.number(),
		unitPrice: v.number(),
		order: v.number(),
	}).index("by_invoice", ["invoiceId"]),

	contracts: defineTable({
		offerteId: v.id("offertes"),
		ownerId: v.id("users"),
		clientId: v.optional(v.id("clients")),
		title: v.string(),
		bodySnapshot: v.optional(v.any()),
		sectionsSnapshot: v.array(
			v.object({ title: v.string(), order: v.number() }),
		),
		itemsSnapshot: v.array(
			v.object({
				sectionOrder: v.number(),
				label: v.string(),
				order: v.number(),
			}),
		),
		signedAt: v.number(),
		signedByName: v.string(),
		signedByEmail: v.optional(v.string()),
		slug: v.string(),
	})
		.index("by_offerte", ["offerteId"])
		.index("by_owner", ["ownerId"])
		.index("by_client", ["clientId"])
		.index("by_slug", ["slug"]),

	events: defineTable({
		ownerId: v.id("users"),
		clientId: v.optional(v.id("clients")),
		title: v.string(),
		startsAt: v.number(),
		endsAt: v.number(),
		location: v.optional(v.string()),
		notes: v.optional(v.string()),
		kind: v.union(
			v.literal("meeting"),
			v.literal("deadline"),
			v.literal("milestone"),
		),
	})
		.index("by_owner", ["ownerId"])
		.index("by_client", ["clientId"])
		.index("by_owner_starts", ["ownerId", "startsAt"]),

	portfolioItems: defineTable({
		ownerId: v.id("users"),
		title: v.string(),
		category: v.string(),
		project: v.string(),
		ctaLabel: v.string(),
		slug: v.string(),
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
		order: v.number(),
		published: v.boolean(),
		featured: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_owner", ["ownerId"])
		.index("by_slug", ["slug"])
		.index("by_published_order", ["published", "order"]),

	tasks: defineTable({
		ownerId: v.id("users"),
		clientId: v.optional(v.id("clients")),
		title: v.string(),
		status: v.union(
			v.literal("prio"),
			v.literal("in_review"),
			v.literal("todo"),
			v.literal("in_progress"),
			v.literal("done"),
			v.literal("canceled"),
		),
		priority: v.union(
			v.literal("low"),
			v.literal("medium"),
			v.literal("high"),
		),
		label: v.optional(v.string()),
		dueAt: v.optional(v.number()),
		order: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_owner", ["ownerId"])
		.index("by_client", ["clientId"])
		.index("by_owner_updated", ["ownerId", "updatedAt"])
		.index("by_owner_status_order", ["ownerId", "status", "order"]),

	// --- Visual website-feedback tool (Shopify stores) ---

	feedbackProjects: defineTable({
		ownerUserId: v.id("users"),
		clientId: v.optional(v.id("clients")),
		name: v.string(),
		shopifyDomain: v.string(),
		widgetToken: v.string(),
		shareToken: v.string(),
		status: v.union(
			v.literal("active"),
			v.literal("paused"),
			v.literal("archived"),
		),
		createdAt: v.number(),
	})
		.index("by_owner", ["ownerUserId"])
		.index("by_widget_token", ["widgetToken"])
		.index("by_share_token", ["shareToken"])
		.index("by_client", ["clientId"]),

	comments: defineTable({
		projectId: v.id("feedbackProjects"),
		pageUrl: v.string(),
		pagePath: v.string(),
		anchor: v.object({
			selector: v.string(),
			xpath: v.string(),
			nx: v.number(),
			ny: v.number(),
			scrollY: v.number(),
			elementWidth: v.number(),
			elementHeight: v.number(),
			px: v.optional(v.number()),
			py: v.optional(v.number()),
		}),
		content: v.string(),
		clientKey: v.optional(v.string()),
		kind: v.optional(
			v.union(
				v.literal("bug"),
				v.literal("idea"),
				v.literal("question"),
			),
		),
		status: v.union(v.literal("open"), v.literal("resolved")),
		authorType: v.union(
			v.literal("owner"),
			v.literal("client"),
			v.literal("guest"),
		),
		authorName: v.string(),
		authorEmail: v.string(),
		screenshotStorageId: v.optional(v.id("_storage")),
		metadata: v.object({
			userAgent: v.string(),
			browser: v.string(),
			os: v.string(),
			viewportWidth: v.number(),
			viewportHeight: v.number(),
			devicePixelRatio: v.number(),
		}),
		createdAt: v.number(),
	})
		.index("by_project", ["projectId"])
		.index("by_project_status", ["projectId", "status"])
		.index("by_project_path", ["projectId", "pagePath"]),

	commentReplies: defineTable({
		commentId: v.id("comments"),
		projectId: v.id("feedbackProjects"),
		content: v.string(),
		authorType: v.union(
			v.literal("owner"),
			v.literal("client"),
			v.literal("guest"),
		),
		authorName: v.string(),
		authorEmail: v.string(),
		createdAt: v.number(),
	}).index("by_comment", ["commentId"]),

	feedbackAccess: defineTable({
		email: v.string(),
		userId: v.optional(v.id("users")),
		clientId: v.id("clients"),
		role: v.literal("client"),
		createdAt: v.number(),
	})
		.index("by_email", ["email"])
		.index("by_user", ["userId"]),

	feedbackRateBuckets: defineTable({
		projectId: v.id("feedbackProjects"),
		windowStart: v.number(),
		count: v.number(),
	}).index("by_project_window", ["projectId", "windowStart"]),

	feedbackNotifyState: defineTable({
		projectId: v.id("feedbackProjects"),
		lastAt: v.number(),
	}).index("by_project", ["projectId"]),
});
