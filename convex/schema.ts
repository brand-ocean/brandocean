import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
	accountTypeV,
	entryTypeV,
	vatCategoryV,
} from "./boekhouding/validators";
import { portfolioBlock, portfolioMedia } from "./lib/portfolioBlocks";

// Rich context captured from the clicked element at comment time, so an AI can
// map a comment back to the exact source element/component (text is the highest
// value — it lets the AI grep the repo and land on the component). Every field
// is optional and every array is a bounded snapshot (never grows over the doc's
// life), so adding this is back-compatible and respects the 1MB doc limit.
export const elementContextV = v.object({
	text: v.optional(v.string()),
	tag: v.optional(v.string()),
	id: v.optional(v.string()),
	classes: v.optional(v.array(v.string())),
	attributes: v.optional(
		v.array(v.object({ name: v.string(), value: v.string() })),
	),
	styles: v.optional(
		v.object({
			fontFamily: v.optional(v.string()),
			fontSize: v.optional(v.string()),
			fontWeight: v.optional(v.string()),
			color: v.optional(v.string()),
			lineHeight: v.optional(v.string()),
			letterSpacing: v.optional(v.string()),
			textTransform: v.optional(v.string()),
			display: v.optional(v.string()),
		}),
	),
	// Tier 2 — React only: owner-component name chain + dev-build source location.
	// Empty on minified prod and on non-React (Shopify/Liquid) sites — graceful.
	componentPath: v.optional(v.array(v.string())),
	source: v.optional(
		v.object({
			fileName: v.string(),
			lineNumber: v.number(),
			columnNumber: v.optional(v.number()),
		}),
	),
	// Tier 3 — nearest landmark for orientation on whole-page / body comments.
	landmark: v.optional(
		v.object({
			selector: v.optional(v.string()),
			heading: v.optional(v.string()),
		}),
	),
});

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
		// Voor ICP-opgaaf bij EU-diensten (rubriek 3b).
		vatNumber: v.optional(v.string()),
		countryCode: v.optional(v.string()), // ISO-3166 alpha-2, bv. "NL"
		// Adres-/bedrijfsgegevens voor factuur-PDF en UBL e-factuur.
		street: v.optional(v.string()),
		addressLine2: v.optional(v.string()),
		postalCode: v.optional(v.string()),
		city: v.optional(v.string()),
		phone: v.optional(v.string()),
		kvkNumber: v.optional(v.string()),
		// Herkomst-id bij import (Moneybird contact-id) — voorkomt dubbele import.
		importedFrom: v.optional(v.string()),
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
		// Owner's handwritten signature (downscaled PNG data URI) + the name shown
		// beneath it. Auto-applied to owner-signed NDAs.
		signatureDataUrl: v.optional(v.string()),
		signatureName: v.optional(v.string()),
		// Boekhouding: doorlopende journaalpostteller + boekjaarconfig.
		nextJournalEntryNumber: v.optional(v.number()),
		boekjaarStart: v.optional(v.string()), // "YYYY-MM-DD"
		openingBalanceBookedAt: v.optional(v.number()),
		// Bedrijfsprofiel voor factuur-PDF en UBL e-factuur (gestructureerd,
		// naast het vrije businessAddress-veld).
		businessStreet: v.optional(v.string()),
		businessPostalCode: v.optional(v.string()),
		businessCity: v.optional(v.string()),
		businessCountryCode: v.optional(v.string()),
		businessEmail: v.optional(v.string()),
		iban: v.optional(v.string()),
		bic: v.optional(v.string()),
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
		// BTW-categorie voor de journaalboeking; ontbreekt op oude facturen —
		// leesfallback: afgeleid van vatRate (21→hoog, 9→laag, 0→nul).
		vatCategory: v.optional(vatCategoryV),
		// Moneybird-stijl: regelprijzen zijn inclusief BTW; het factuurtotaal
		// staat vast en subtotaal/BTW worden teruggerekend.
		pricesIncludeVat: v.optional(v.boolean()),
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

	// --- NDAs (one-way non-disclosure agreements) ---

	ndas: defineTable({
		ownerId: v.id("users"),
		clientId: v.optional(v.id("clients")),
		title: v.string(),
		// "one_way" today; kept as a field so a future "mutual" type can be added
		// without a breaking migration.
		kind: v.union(v.literal("one_way")),
		// Who promises confidentiality and signs:
		//  - owner_signs: the owner (BRANDOCEAN) receives the client's info and
		//    signs (auto-signed with the stored signature).
		//  - client_signs: the client receives the owner's info and signs online.
		// Optional for back-compat with NDAs created before this field existed
		// (treated as client_signs on read).
		direction: v.optional(
			v.union(v.literal("owner_signs"), v.literal("client_signs")),
		),
		language: v.union(v.literal("nl"), v.literal("en")),
		body: v.optional(v.any()),
		slug: v.string(),
		shareToken: v.string(),
		published: v.boolean(),
		publicReadable: v.boolean(),
		// Set to the signed copy's slug once the NDA has been signed. Used to
		// lock the public page and stop a second signature.
		signedSlug: v.optional(v.string()),
		schemaVersion: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_slug", ["slug"])
		.index("by_owner", ["ownerId"])
		.index("by_owner_updated", ["ownerId", "updatedAt"]),

	signedNdas: defineTable({
		ndaId: v.id("ndas"),
		ownerId: v.id("users"),
		clientId: v.optional(v.id("clients")),
		title: v.string(),
		language: v.union(v.literal("nl"), v.literal("en")),
		bodySnapshot: v.optional(v.any()),
		signedAt: v.number(),
		signedByName: v.string(),
		signedByEmail: v.optional(v.string()),
		signedByCompany: v.optional(v.string()),
		// Lightweight signing audit trail.
		signedUserAgent: v.optional(v.string()),
		slug: v.string(),
	})
		.index("by_nda", ["ndaId"])
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
		// The case-study body. Ordered, typed blocks — see lib/portfolioBlocks.
		blocks: v.optional(v.array(portfolioBlock)),
		// `heroImage`/`galleryMedia` are the CMS-managed (uploadable) fields.
		// `heroImageUrl`/`gallery` are the original URL-only fields kept for the
		// scraped brandocean.nl items; queries read the new field and fall back.
		heroImage: v.optional(portfolioMedia),
		galleryMedia: v.optional(v.array(portfolioMedia)),
		heroImageUrl: v.optional(v.string()),
		bunnyVideoUrl: v.optional(v.string()),
		bunnyVideoId: v.optional(v.string()),
		bunnyLibraryId: v.optional(v.string()),
		gallery: v.optional(v.array(v.string())),
		livePages: v.optional(v.array(v.string())),
		// Shown on the work grid. Older items only carry the year inside the
		// free-text `project` line, which the site parses out as a fallback.
		year: v.optional(v.number()),
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

	// --- Personal habit tracker (the /habits dashboard) ---

	// One per big button on the habits page, max 6 per owner. `step` is the
	// amount one tap logs (e.g. 10 push-ups), `total` is a denormalized
	// lifetime sum so the page never counts the whole log table.
	habitTrackers: defineTable({
		ownerId: v.id("users"),
		name: v.string(),
		emoji: v.string(),
		step: v.number(),
		unit: v.optional(v.string()),
		color: v.string(),
		order: v.number(),
		total: v.number(),
		createdAt: v.number(),
	}).index("by_owner", ["ownerId"]),

	// One row per tap. `day` is the owner's local "YYYY-MM-DD" (sent by the
	// client so "today" follows their timezone, not UTC).
	habitLogs: defineTable({
		ownerId: v.id("users"),
		trackerId: v.id("habitTrackers"),
		day: v.string(),
		amount: v.number(),
		createdAt: v.number(),
	}).index("by_tracker_day", ["trackerId", "day"]),

	// --- Visual website-feedback tool (Shopify stores) ---

	feedbackProjects: defineTable({
		ownerUserId: v.id("users"),
		clientId: v.optional(v.id("clients")),
		name: v.string(),
		shopifyDomain: v.string(),
		// Local development hosts (e.g. "localhost:5173") that resolve to this
		// project, so the review extension loads the right comments on a dev
		// server too. Stored normalized (lowercase host[:port]).
		devHosts: v.optional(v.array(v.string())),
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
		.index("by_shopify_domain", ["shopifyDomain"])
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
			// Optional rectangular region (document coords) when the reviewer
			// dragged a box instead of clicking a single point.
			region: v.optional(
				v.object({
					x: v.number(),
					y: v.number(),
					w: v.number(),
					h: v.number(),
				}),
			),
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
		// Set when the comment was dropped on a server-rendered page snapshot
		// (the screenshot review surface). nx/ny are normalized 0..1 to the
		// full-page screenshot for the given device, so the pin renders at the
		// exact spot regardless of how the image is scaled in the UI. Independent
		// of `anchor` (which targets a live DOM element via selector/xpath).
		imagePin: v.optional(
			v.object({
				device: v.union(v.literal("desktop"), v.literal("mobile")),
				nx: v.number(),
				ny: v.number(),
			}),
		),
		// Device the comment was left on, so mobile/desktop feedback stays
		// separated (pins + list filter to the matching view). Optional for
		// back-compat; legacy comments are treated as desktop.
		device: v.optional(
			v.union(
				v.literal("mobile"),
				v.literal("tablet"),
				v.literal("desktop"),
			),
		),
		metadata: v.object({
			userAgent: v.string(),
			browser: v.string(),
			os: v.string(),
			viewportWidth: v.number(),
			viewportHeight: v.number(),
			devicePixelRatio: v.number(),
		}),
		// Rich element context captured at click time (see elementContextV).
		elementContext: v.optional(elementContextV),
		createdAt: v.number(),
	})
		.index("by_project", ["projectId"])
		.index("by_project_status", ["projectId", "status"])
		.index("by_project_path", ["projectId", "pagePath"]),

	// Server-rendered full-page screenshots of a project's pages, captured via
	// Cloudflare Browser Rendering. One row per (project, pagePath, device);
	// re-capturing replaces the row's storageId. The screenshot review UI shows
	// these instead of an iframe (Shopify storefronts forbid framing entirely),
	// and comments are pinned onto the image via comments.imagePin.
	pageSnapshots: defineTable({
		projectId: v.id("feedbackProjects"),
		pagePath: v.string(),
		device: v.union(v.literal("desktop"), v.literal("mobile")),
		// "ready" once the PNG is stored; "pending" while capturing; "error" on
		// failure (with the upstream message in `error`).
		status: v.union(
			v.literal("pending"),
			v.literal("ready"),
			v.literal("error"),
		),
		storageId: v.optional(v.id("_storage")),
		// Pixel dimensions of the stored full-page PNG (from its IHDR), used to
		// scale pins correctly in the UI.
		width: v.optional(v.number()),
		height: v.optional(v.number()),
		error: v.optional(v.string()),
		capturedAt: v.number(),
	})
		.index("by_project", ["projectId"])
		.index("by_project_path_device", ["projectId", "pagePath", "device"]),

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

	// --- Usage-based billing (charge clients for Cloudflare + Convex usage) ----
	//
	// A client is put on usage billing by creating one billingClients row and
	// linking their infra (Workers/zones/Convex deployments) as billingResources.
	// Usage is metered per day into usageRecords, then rolled up into a
	// billingInvoices charge collected via Mollie. See convex/billing/.

	// One per client that's on usage billing. Holds the Mollie mandate and the
	// per-client billing knobs (markup override, minimum charge, interval).
	billingClients: defineTable({
		ownerId: v.id("users"),
		clientId: v.id("clients"),
		status: v.union(
			v.literal("active"),
			v.literal("paused"),
			v.literal("canceled"),
		),
		// Stripe identifiers. Populated during onboarding once the client saves a
		// payment method (card/SEPA mandate) via Checkout; until then charging is
		// impossible. mandateStatus "valid" means we have a usable payment method.
		stripeCustomerId: v.optional(v.string()),
		stripePaymentMethodId: v.optional(v.string()),
		mandateStatus: v.optional(
			v.union(
				v.literal("pending"),
				v.literal("valid"),
				v.literal("invalid"),
			),
		),
		// Markup multiplier applied on top of provider cost (overrides the global
		// default in config.ts). e.g. 3 = client pays 3x cost.
		markup: v.optional(v.number()),
		// Bill every N months (1 = monthly). Longer intervals amortize Mollie's
		// per-transaction fee against tiny usage amounts.
		billingIntervalMonths: v.number(),
		// Don't charge below this (in eurocents); usage carries forward instead, so
		// a €0,08 month never triggers a fee-eating incasso.
		minChargeCents: v.number(),
		// Sub-threshold amount rolled over from prior periods (eurocents).
		carryoverCents: v.number(),
		// Start of the current unbilled period ("YYYY-MM-DD"). Advanced by the
		// billing run after each successful (or carried-over) period.
		periodStart: v.string(),
		createdAt: v.number(),
	})
		.index("by_owner", ["ownerId"])
		.index("by_client", ["clientId"])
		.index("by_stripe_customer", ["stripeCustomerId"])
		.index("by_status", ["status"]),

	// Infra owned by a billing client. `identifier` is the Cloudflare script name,
	// zone id, or Convex deployment name we attribute usage to.
	billingResources: defineTable({
		ownerId: v.id("users"),
		billingClientId: v.id("billingClients"),
		kind: v.union(
			v.literal("cf_worker"),
			v.literal("cf_zone"),
			v.literal("cx_deployment"),
		),
		identifier: v.string(),
		label: v.optional(v.string()),
		// Convex log-stream id returned by the Platform API, so we can tear the
		// stream down if the client leaves. Only set for cx_deployment.
		logStreamId: v.optional(v.string()),
		active: v.boolean(),
		createdAt: v.number(),
	})
		.index("by_billing_client", ["billingClientId"])
		.index("by_kind_and_identifier", ["kind", "identifier"])
		.index("by_owner", ["ownerId"]),

	// Daily metered usage, one canonical metric per row. Sharded on write
	// (`shard`) so high-frequency Convex log-stream increments don't contend on a
	// single hot document; the billing run sums all shards for the period.
	usageRecords: defineTable({
		ownerId: v.id("users"),
		billingClientId: v.id("billingClients"),
		metric: v.string(), // see METRICS in config.ts
		day: v.string(), // "YYYY-MM-DD" (UTC), sorts chronologically
		shard: v.number(),
		quantity: v.number(), // in the metric's canonical unit
		createdAt: v.number(),
	})
		.index("by_client_and_day", ["billingClientId", "day"])
		.index("by_client_metric_day_shard", [
			"billingClientId",
			"metric",
			"day",
			"shard",
		]),

	// One computed charge per billing period per client.
	billingInvoices: defineTable({
		ownerId: v.id("users"),
		billingClientId: v.id("billingClients"),
		periodStart: v.string(), // "YYYY-MM-DD" inclusive
		periodEnd: v.string(), // "YYYY-MM-DD" exclusive
		// Per-metric breakdown so the client can see what drove the bill.
		lines: v.array(
			v.object({
				metric: v.string(),
				quantity: v.number(),
				costCents: v.number(), // provider cost (eurocents)
				amountCents: v.number(), // billed = cost * markup (eurocents)
			}),
		),
		usageCents: v.number(), // sum of line amounts this period
		carryInCents: v.number(), // carryover applied from prior periods
		chargedCents: v.number(), // actually charged via Mollie (0 if carried)
		carryOutCents: v.number(), // rolled to next period (below minimum)
		currency: v.string(),
		status: v.union(
			v.literal("carried"), // below minimum, nothing charged
			v.literal("pending"), // Mollie payment created, awaiting webhook
			v.literal("paid"),
			v.literal("failed"),
		),
		stripePaymentIntentId: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_owner", ["ownerId"])
		.index("by_billing_client", ["billingClientId"])
		.index("by_stripe_payment", ["stripePaymentIntentId"])
		.index("by_status", ["status"]),

	// ---------------------------------------------------------------------------
	// Boekhouding — dubbel boekhouden voor de eigen BV.
	// Journaalposten zijn immutable: correcties gaan via tegenboekingen.

	ledgerAccounts: defineTable({
		ownerId: v.id("users"),
		code: v.string(), // "1300" — decimaal rekeningstelsel
		name: v.string(), // "Debiteuren"
		type: accountTypeV,
		// Stabiele sleutel zodat code nooit op rekeningnummers hoeft te matchen.
		// Alleen gezet op geseede systeemrekeningen.
		systemKey: v.optional(v.string()),
		defaultVatCategory: v.optional(vatCategoryV),
		isSystem: v.boolean(), // geseed: niet verwijderbaar, code/type vast
		active: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_owner", ["ownerId"])
		.index("by_owner_code", ["ownerId", "code"])
		.index("by_owner_system_key", ["ownerId", "systemKey"]),

	journalEntries: defineTable({
		ownerId: v.id("users"),
		entryNumber: v.number(), // doorlopend via userSettings.nextJournalEntryNumber
		date: v.string(), // "YYYY-MM-DD" boekdatum
		description: v.string(),
		type: entryTypeV,
		// Idempotentiesleutel — postEntry is een no-op als deze al bestaat.
		sourceKey: v.string(),
		reversesEntryId: v.optional(v.id("journalEntries")),
		// Enige veld dat ooit gepatcht wordt (bij tegenboeking van deze post).
		reversedByEntryId: v.optional(v.id("journalEntries")),
		totalCents: v.number(), // som van de debetzijde
		createdAt: v.number(), // géén updatedAt — immutable
	})
		.index("by_owner_date", ["ownerId", "date"])
		.index("by_owner_source_key", ["ownerId", "sourceKey"])
		.index("by_owner_number", ["ownerId", "entryNumber"]),

	journalLines: defineTable({
		entryId: v.id("journalEntries"),
		// Gedenormaliseerd voor aggregatie over posten heen (rapporten, BTW).
		ownerId: v.id("users"),
		date: v.string(), // = entry.date
		accountId: v.id("ledgerAccounts"),
		debitCents: v.number(), // precies één van debit/credit > 0
		creditCents: v.number(),
		description: v.optional(v.string()),
		vatCategory: v.optional(vatCategoryV),
		clientId: v.optional(v.id("clients")), // voor ICP bij eu_dienst
	})
		.index("by_entry", ["entryId"])
		.index("by_owner_account_date", ["ownerId", "accountId", "date"])
		.index("by_owner_vat_date", ["ownerId", "vatCategory", "date"]),

	fiscalPeriods: defineTable({
		ownerId: v.id("users"),
		kind: v.union(v.literal("year"), v.literal("quarter")),
		year: v.number(),
		quarter: v.optional(v.number()), // 1-4, alleen bij kind "quarter"
		startDate: v.string(), // "YYYY-MM-DD" inclusief
		endDate: v.string(), // exclusief
		status: v.union(v.literal("open"), v.literal("closed")),
		closedAt: v.optional(v.number()),
		createdAt: v.number(),
	})
		.index("by_owner", ["ownerId"]) // ≤ ~5 rijen per jaar
		.index("by_owner_start", ["ownerId", "startDate"]),

	// Vragenlijsten — een genummerde set vragen die je deelt met een klant, die
	// per vraag antwoordt op een publieke pagina. Zelfde deelpatroon als
	// offertes: slug in de URL, shareToken als sleutel.
	specs: defineTable({
		ownerId: v.id("users"),
		clientId: v.optional(v.id("clients")),
		title: v.string(),
		intro: v.optional(v.string()),
		slug: v.string(),
		shareToken: v.string(),
		published: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_slug", ["slug"])
		.index("by_owner", ["ownerId"])
		.index("by_client", ["clientId"]),

	// Eén vraag. `fallback` is wat er gebeurt als de klant niet antwoordt, zodat
	// stilte ook een uitkomst heeft. `resolved` zet jij zelf, na het lezen.
	specQuestions: defineTable({
		specId: v.id("specs"),
		order: v.number(),
		question: v.string(),
		detail: v.optional(v.string()),
		fallback: v.optional(v.string()),
		blocking: v.boolean(),
		answer: v.optional(v.string()),
		answeredBy: v.optional(v.string()),
		answeredAt: v.optional(v.number()),
		resolved: v.boolean(),
	}).index("by_spec", ["specId"]),
});
