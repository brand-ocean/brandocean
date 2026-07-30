import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, type Infer, v } from "convex/values";
import { customAlphabet } from "nanoid";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { elementContextV } from "./schema";

// --- Constants -------------------------------------------------------------

const tokenAlphabet =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const newToken = customAlphabet(tokenAlphabet, 40);

const CONTENT_MAX = 5000;
const NAME_MAX = 120;
const EMAIL_MAX = 200;
const UA_MAX = 500;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 30;

// --- Shared validators -----------------------------------------------------

const anchorValidator = v.object({
	selector: v.string(),
	xpath: v.string(),
	nx: v.number(),
	ny: v.number(),
	scrollY: v.number(),
	elementWidth: v.number(),
	elementHeight: v.number(),
	px: v.optional(v.number()),
	py: v.optional(v.number()),
	region: v.optional(
		v.object({
			x: v.number(),
			y: v.number(),
			w: v.number(),
			h: v.number(),
		}),
	),
});

const metadataValidator = v.object({
	userAgent: v.string(),
	browser: v.string(),
	os: v.string(),
	viewportWidth: v.number(),
	viewportHeight: v.number(),
	devicePixelRatio: v.number(),
});

const statusValidator = v.union(v.literal("open"), v.literal("resolved"));

const kindValidator = v.optional(
	v.union(v.literal("bug"), v.literal("idea"), v.literal("question")),
);

// --- Helpers ---------------------------------------------------------------

function clampString(value: string, max: number): string {
	return value.length > max ? value.slice(0, max) : value;
}

// Normalize a free-text store domain to a bare host: strip protocol, path,
// query, and trailing dots/slashes, then lowercase. Throws if it doesn't look
// like a hostname. Stored normalized so the snapshot capture URL is always
// well-formed (a stored "https://store/…" was producing Cloudflare 5006 / DNS).
function normalizeShopifyDomain(input: string): string {
	let h = input.trim().toLowerCase();
	h = h.replace(/^https?:\/\//, ""); // strip protocol
	h = h.split(/[/?#]/)[0]; // strip path/query/hash
	h = h.replace(/^\.+|\.+$/g, ""); // strip leading/trailing dots
	// host.tld — letters/digits/hyphens/dots, with at least one dot.
	if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)) {
		throw new ConvexError("invalid_domain");
	}
	return clampString(h, 300);
}

// Normalize a local development host to "host[:port]". Only loopback-style
// hosts are accepted — real domains belong in shopifyDomain. Throws when the
// input isn't a recognizable dev host.
function normalizeDevHost(input: string): string {
	let h = input.trim().toLowerCase();
	h = h.replace(/^https?:\/\//, "");
	h = h.split(/[/?#]/)[0];
	if (!/^(localhost|127(\.\d{1,3}){3}|\[::1\]|0\.0\.0\.0|[a-z0-9-]+\.(local|test|localhost))(:\d{1,5})?$/.test(h)) {
		throw new ConvexError("invalid_dev_host");
	}
	return clampString(h, 300);
}

function isDevLikeHost(host: string): boolean {
	try {
		normalizeDevHost(host);
		return true;
	} catch {
		return false;
	}
}

function sanitizeAnchor(a: Doc<"comments">["anchor"]): Doc<"comments">["anchor"] {
	const clamp01 = (n: number) =>
		Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
	const num = (n: number) => (Number.isFinite(n) ? n : 0);
	const optNum = (n: number | undefined) =>
		typeof n === "number" && Number.isFinite(n) ? n : undefined;
	return {
		selector: clampString(a.selector, 1000),
		xpath: clampString(a.xpath, 2000),
		nx: clamp01(a.nx),
		ny: clamp01(a.ny),
		scrollY: num(a.scrollY),
		elementWidth: num(a.elementWidth),
		elementHeight: num(a.elementHeight),
		px: optNum(a.px),
		py: optNum(a.py),
		region: a.region
			? {
					x: num(a.region.x),
					y: num(a.region.y),
					w: num(a.region.w),
					h: num(a.region.h),
				}
			: undefined,
	};
}

type ElementContext = Infer<typeof elementContextV>;

// Element context is client-supplied, so clamp every string and cap every array
// before it touches the DB. Optional fields left undefined are stored as absent.
function sanitizeElementContext(
	ec: ElementContext | undefined,
): ElementContext | undefined {
	if (!ec) return undefined;
	const str = (s: string | undefined, max: number): string | undefined =>
		typeof s === "string" ? clampString(s, max) : undefined;
	return {
		text: str(ec.text, 400),
		tag: str(ec.tag, 40),
		id: str(ec.id, 200),
		classes: ec.classes?.slice(0, 30).map((c) => clampString(c, 120)),
		attributes: ec.attributes?.slice(0, 12).map((a) => ({
			name: clampString(a.name, 80),
			value: clampString(a.value, 300),
		})),
		styles: ec.styles
			? {
					fontFamily: str(ec.styles.fontFamily, 200),
					fontSize: str(ec.styles.fontSize, 40),
					fontWeight: str(ec.styles.fontWeight, 40),
					color: str(ec.styles.color, 60),
					lineHeight: str(ec.styles.lineHeight, 40),
					letterSpacing: str(ec.styles.letterSpacing, 40),
					textTransform: str(ec.styles.textTransform, 40),
					display: str(ec.styles.display, 40),
				}
			: undefined,
		componentPath: ec.componentPath
			?.slice(0, 8)
			.map((c) => clampString(c, 120)),
		source: ec.source
			? {
					fileName: clampString(ec.source.fileName, 400),
					lineNumber: ec.source.lineNumber,
					columnNumber: ec.source.columnNumber,
				}
			: undefined,
		landmark: ec.landmark
			? {
					selector: str(ec.landmark.selector, 1000),
					heading: str(ec.landmark.heading, 300),
				}
			: undefined,
	};
}

async function resolveProjectByToken(
	ctx: QueryCtx,
	token: string,
): Promise<{ project: Doc<"feedbackProjects">; kind: "widget" | "share" } | null> {
	const byWidget = await ctx.db
		.query("feedbackProjects")
		.withIndex("by_widget_token", (q) => q.eq("widgetToken", token))
		.first();
	if (byWidget) return { project: byWidget, kind: "widget" };
	const byShare = await ctx.db
		.query("feedbackProjects")
		.withIndex("by_share_token", (q) => q.eq("shareToken", token))
		.first();
	if (byShare) return { project: byShare, kind: "share" };
	return null;
}

async function getAccessRole(
	ctx: QueryCtx,
	userId: Id<"users">,
): Promise<
	{ role: "owner" } | { role: "client"; clientId: Id<"clients"> }
> {
	const access = await ctx.db
		.query("feedbackAccess")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.first();
	if (access) return { role: "client", clientId: access.clientId };
	return { role: "owner" };
}

export async function assertProjectAccess(
	ctx: QueryCtx,
	projectId: Id<"feedbackProjects">,
): Promise<{
	project: Doc<"feedbackProjects">;
	userId: Id<"users">;
	role: "owner" | "client";
}> {
	const userId = await getAuthUserId(ctx);
	if (!userId) throw new ConvexError("unauthenticated");
	const project = await ctx.db.get(projectId);
	if (!project) throw new ConvexError("not_found");
	if (project.ownerUserId === userId) {
		return { project, userId, role: "owner" };
	}
	const role = await getAccessRole(ctx, userId);
	if (
		role.role === "client" &&
		project.clientId &&
		project.clientId === role.clientId
	) {
		return { project, userId, role: "client" };
	}
	throw new ConvexError("forbidden");
}

async function enforceRateLimit(
	ctx: MutationCtx,
	projectId: Id<"feedbackProjects">,
): Promise<void> {
	const windowStart = Math.floor(Date.now() / RATE_WINDOW_MS) * RATE_WINDOW_MS;
	const bucket = await ctx.db
		.query("feedbackRateBuckets")
		.withIndex("by_project_window", (q) =>
			q.eq("projectId", projectId).eq("windowStart", windowStart),
		)
		.first();
	if (!bucket) {
		await ctx.db.insert("feedbackRateBuckets", {
			projectId,
			windowStart,
			count: 1,
		});
		return;
	}
	if (bucket.count >= RATE_MAX_PER_WINDOW) {
		throw new ConvexError("rate_limited");
	}
	await ctx.db.patch(bucket._id, { count: bucket.count + 1 });
}

async function serializeComment(
	ctx: QueryCtx,
	comment: Doc<"comments">,
): Promise<{
	id: Id<"comments">;
	pageUrl: string;
	pagePath: string;
	anchor: Doc<"comments">["anchor"];
	content: string;
	kind: "bug" | "idea" | "question" | undefined;
	status: "open" | "resolved";
	authorType: "owner" | "client" | "guest";
	authorName: string;
	createdAt: number;
	device: "mobile" | "tablet" | "desktop" | undefined;
	metadata: Doc<"comments">["metadata"];
	screenshotUrl: string | null;
	elementContext: Doc<"comments">["elementContext"];
	imagePin: Doc<"comments">["imagePin"];
	replies: Array<{
		id: Id<"commentReplies">;
		content: string;
		authorType: "owner" | "client" | "guest";
		authorName: string;
		createdAt: number;
	}>;
}> {
	const replyDocs = await ctx.db
		.query("commentReplies")
		.withIndex("by_comment", (q) => q.eq("commentId", comment._id))
		.take(200);
	const screenshotUrl = comment.screenshotStorageId
		? await ctx.storage.getUrl(comment.screenshotStorageId)
		: null;
	return {
		id: comment._id,
		pageUrl: comment.pageUrl,
		pagePath: comment.pagePath,
		anchor: comment.anchor,
		content: comment.content,
		status: comment.status,
		authorType: comment.authorType,
		authorName: comment.authorName,
		kind: comment.kind,
		createdAt: comment.createdAt,
		device: comment.device,
		metadata: comment.metadata,
		screenshotUrl,
		elementContext: comment.elementContext,
		imagePin: comment.imagePin,
		replies: replyDocs.map((r) => ({
			id: r._id,
			content: r.content,
			authorType: r.authorType,
			authorName: r.authorName,
			createdAt: r.createdAt,
		})),
	};
}

// --- Token-gated internal functions (called only from convex/http.ts) ------

export const resolveToken = internalQuery({
	args: { token: v.string() },
	handler: async (ctx, args) => {
		const resolved = await resolveProjectByToken(ctx, args.token);
		if (!resolved) return null;
		return {
			projectId: resolved.project._id,
			name: resolved.project.name,
			status: resolved.project.status,
			kind: resolved.kind,
		};
	},
});

// Sibling-project list for the review extension's localhost auto-detect.
// Gated by a valid WIDGET token (share tokens are read-only guests — they
// don't get the owner's other tokens). All projects belong to the same
// owner, so possession of one project token grants listing the rest — this
// is an internal agency tool, not a multi-tenant product.
export const listProjectsForToken = internalQuery({
	args: { token: v.string() },
	handler: async (ctx, args) => {
		const resolved = await resolveProjectByToken(ctx, args.token);
		if (!resolved || resolved.kind !== "widget") return null;
		const projects = await ctx.db
			.query("feedbackProjects")
			.withIndex("by_owner", (q) =>
				q.eq("ownerUserId", resolved.project.ownerUserId),
			)
			.collect();
		return projects
			.filter((p) => p.status === "active")
			.map((p) => ({
				name: p.name,
				token: p.widgetToken,
				shopifyDomain: p.shopifyDomain,
				devHosts: p.devHosts ?? [],
			}));
	},
});

// Resolve the project for a framed host so the review extension shows THIS
// site's feedback (instead of whatever token happens to be saved). The widget
// token is already public in the storefront widget, so returning it by host
// is no new exposure. Returns null for an unknown/invalid host.
export const resolveHost = internalQuery({
	args: { host: v.string() },
	handler: async (ctx, args) => {
		// Dev hosts (localhost:5173 etc.) can't live in the by_shopify_domain
		// index — match them against each project's devHosts list instead. The
		// table is small (one row per client site), so a scan is fine here.
		if (isDevLikeHost(args.host)) {
			const devHost = normalizeDevHost(args.host);
			const projects = await ctx.db.query("feedbackProjects").collect();
			const project = projects.find((p) => p.devHosts?.includes(devHost));
			if (!project) return null;
			return {
				token: project.widgetToken,
				name: project.name,
				status: project.status,
			};
		}
		let host: string;
		try {
			host = normalizeShopifyDomain(args.host);
		} catch {
			return null;
		}
		const project = await ctx.db
			.query("feedbackProjects")
			.withIndex("by_shopify_domain", (q) => q.eq("shopifyDomain", host))
			.first();
		if (!project) return null;
		return {
			token: project.widgetToken,
			name: project.name,
			status: project.status,
		};
	},
});

// One-off backfill: older projects stored shopifyDomain as a raw URL
// ("https://store/") before normalizeShopifyDomain was enforced on create,
// so host lookups (by_shopify_domain) miss them. Normalize every row to a bare
// host. Safe to re-run — already-normalized rows are skipped.
export const normalizeProjectDomains = internalMutation({
	args: {},
	handler: async (ctx) => {
		const projects = await ctx.db.query("feedbackProjects").collect();
		let fixed = 0;
		for (const p of projects) {
			let normalized: string;
			try {
				normalized = normalizeShopifyDomain(p.shopifyDomain);
			} catch {
				continue; // leave un-parseable values untouched
			}
			if (normalized !== p.shopifyDomain) {
				await ctx.db.patch(p._id, { shopifyDomain: normalized });
				fixed++;
			}
		}
		return { total: projects.length, fixed };
	},
});

export const listForToken = internalQuery({
	args: { token: v.string(), pagePath: v.optional(v.string()) },
	handler: async (ctx, args) => {
		const resolved = await resolveProjectByToken(ctx, args.token);
		if (!resolved) throw new ConvexError("invalid_token");
		const projectId = resolved.project._id;
		const pagePath = args.pagePath;
		const docs =
			pagePath !== undefined
				? await ctx.db
						.query("comments")
						.withIndex("by_project_path", (q) =>
							q.eq("projectId", projectId).eq("pagePath", pagePath),
						)
						.order("desc")
						.take(500)
				: await ctx.db
						.query("comments")
						.withIndex("by_project", (q) => q.eq("projectId", projectId))
						.order("desc")
						.take(500);
		const comments = await Promise.all(
			docs.map((d) => serializeComment(ctx, d)),
		);
		return {
			project: {
				name: resolved.project.name,
				status: resolved.project.status,
			},
			comments,
		};
	},
});

export const createCommentFromToken = internalMutation({
	args: {
		token: v.string(),
		pageUrl: v.string(),
		pagePath: v.string(),
		anchor: anchorValidator,
		content: v.string(),
		clientKey: v.optional(v.string()),
		kind: kindValidator,
		authorName: v.string(),
		authorEmail: v.string(),
		device: v.optional(
			v.union(
				v.literal("mobile"),
				v.literal("tablet"),
				v.literal("desktop"),
			),
		),
		metadata: metadataValidator,
		screenshotStorageId: v.optional(v.id("_storage")),
		elementContext: v.optional(elementContextV),
	},
	handler: async (ctx, args) => {
		const resolved = await resolveProjectByToken(ctx, args.token);
		if (!resolved) throw new ConvexError("invalid_token");
		if (resolved.project.status !== "active") {
			throw new ConvexError("project_inactive");
		}
		const content = args.content.trim();
		if (!content) throw new ConvexError("empty_content");
		// Idempotency: a retry after a network timeout must not duplicate.
		if (args.clientKey) {
			const recent = await ctx.db
				.query("comments")
				.withIndex("by_project", (q) =>
					q.eq("projectId", resolved.project._id),
				)
				.order("desc")
				.take(60);
			const dup = recent.find((r) => r.clientKey === args.clientKey);
			if (dup) return dup._id;
		}
		await enforceRateLimit(ctx, resolved.project._id);
		let clientName = "Guest";
		if (resolved.project.clientId) {
			const cl = await ctx.db.get(resolved.project.clientId);
			if (cl?.name) clientName = cl.name;
		}
		const commentId = await ctx.db.insert("comments", {
			projectId: resolved.project._id,
			pageUrl: clampString(args.pageUrl, 2000),
			pagePath: clampString(args.pagePath, 1000),
			anchor: sanitizeAnchor(args.anchor),
			content: clampString(content, CONTENT_MAX),
			clientKey: args.clientKey,
			kind: args.kind,
			status: "open",
			authorType: "guest",
			authorName: clampString(args.authorName, NAME_MAX) || clientName,
			authorEmail: clampString(args.authorEmail, EMAIL_MAX),
			device: args.device,
			screenshotStorageId: args.screenshotStorageId,
			elementContext: sanitizeElementContext(args.elementContext),
			metadata: {
				userAgent: clampString(args.metadata.userAgent, UA_MAX),
				browser: clampString(args.metadata.browser, 80),
				os: clampString(args.metadata.os, 80),
				viewportWidth: args.metadata.viewportWidth,
				viewportHeight: args.metadata.viewportHeight,
				devicePixelRatio: args.metadata.devicePixelRatio,
			},
			createdAt: Date.now(),
		});
		await ctx.scheduler.runAfter(
			0,
			internal.feedback.notifyOwnerOfComment,
			{ commentId },
		);
		// Cropped element screenshot via Cloudflare Browser Rendering (the same
		// reliable engine as pageSnapshots). Best-effort + backgrounded — a failed
		// or unconfigured render never affects the comment itself.
		await ctx.scheduler.runAfter(0, internal.snapshots.captureCommentShot, {
			commentId,
		});
		return commentId;
	},
});

export const getCommentNotice = internalQuery({
	args: { commentId: v.id("comments") },
	handler: async (ctx, args) => {
		const comment = await ctx.db.get(args.commentId);
		if (!comment) return null;
		const project = await ctx.db.get(comment.projectId);
		if (!project) return null;
		const owner = await ctx.db.get(project.ownerUserId);
		const open = await ctx.db
			.query("comments")
			.withIndex("by_project_status", (q) =>
				q.eq("projectId", project._id).eq("status", "open"),
			)
			.take(100);
		return {
			ownerEmail: owner?.email ?? null,
			projectId: project._id,
			projectName: project.name,
			content: comment.content,
			kind: comment.kind ?? null,
			authorName: comment.authorName,
			pagePath: comment.pagePath,
			pageUrl: comment.pageUrl,
			openCount: open.length,
		};
	},
});

// Read the geometry + target URL a clipped screenshot needs. Returns null if the
// comment was deleted before the backgrounded capture ran.
export const getCommentForShot = internalQuery({
	args: { commentId: v.id("comments") },
	handler: async (ctx, args) => {
		const c = await ctx.db.get(args.commentId);
		if (!c) return null;
		return {
			pageUrl: c.pageUrl,
			anchor: c.anchor,
			device: c.device ?? null,
			viewportWidth: c.metadata.viewportWidth,
			viewportHeight: c.metadata.viewportHeight,
		};
	},
});

export const setCommentShot = internalMutation({
	args: { commentId: v.id("comments"), storageId: v.id("_storage") },
	handler: async (ctx, args): Promise<null> => {
		const c = await ctx.db.get(args.commentId);
		if (!c) return null; // comment deleted mid-capture — drop the screenshot
		await ctx.db.patch(args.commentId, { screenshotStorageId: args.storageId });
		return null;
	},
});

const NOTIFY_COOLDOWN_MS = 5 * 60 * 1000;

// Returns true at most once per cooldown per project, so an active review
// session doesn't spam the owner's inbox (dashboard still shows everything).
export const claimNotify = internalMutation({
	args: { projectId: v.id("feedbackProjects") },
	handler: async (ctx, args): Promise<boolean> => {
		const now = Date.now();
		const state = await ctx.db
			.query("feedbackNotifyState")
			.withIndex("by_project", (q) => q.eq("projectId", args.projectId))
			.first();
		if (!state) {
			await ctx.db.insert("feedbackNotifyState", {
				projectId: args.projectId,
				lastAt: now,
			});
			return true;
		}
		if (now - state.lastAt >= NOTIFY_COOLDOWN_MS) {
			await ctx.db.patch(state._id, { lastAt: now });
			return true;
		}
		return false;
	},
});

export const notifyOwnerOfComment = internalAction({
	args: { commentId: v.id("comments") },
	handler: async (ctx, args) => {
		const apiKey = process.env.AUTH_RESEND_KEY;
		if (!apiKey) return null;
		const notice: {
			ownerEmail: string | null;
			projectId: Id<"feedbackProjects">;
			projectName: string;
			content: string;
			kind: "bug" | "idea" | "question" | null;
			authorName: string;
			pagePath: string;
			pageUrl: string;
			openCount: number;
		} | null = await ctx.runQuery(internal.feedback.getCommentNotice, {
			commentId: args.commentId,
		});
		if (!notice || !notice.ownerEmail) return null;
		const may: boolean = await ctx.runMutation(
			internal.feedback.claimNotify,
			{ projectId: notice.projectId },
		);
		if (!may) return null;
		const from =
			process.env.AUTH_EMAIL_FROM ?? "Feedback <onboarding@resend.dev>";
		const site = (process.env.SITE_URL ?? "").replace(/\/$/, "");
		const link = `${site}/feedback/${notice.projectId}`;
		const tag = notice.kind ? `[${notice.kind.toUpperCase()}] ` : "";
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"Idempotency-Key": `fb/${args.commentId}`,
			},
			body: JSON.stringify({
				from,
				to: [notice.ownerEmail],
				subject:
					`${tag}New feedback on ${notice.projectName}` +
					` (${notice.openCount} open)`,
				text:
					`${notice.authorName} commented on ${notice.pagePath}:\n\n` +
					`${notice.content}\n\n` +
					`${notice.openCount} open on this project.\n${link}`,
				html:
					`<p><strong>${notice.authorName}</strong> commented on ` +
					`<code>${notice.pagePath}</code>:</p>` +
					`<blockquote>${notice.content}</blockquote>` +
					`<p>${notice.openCount} open on this project. ` +
					`<a href="${link}">Open the feedback board →</a></p>`,
			}),
		});
		if (!res.ok) {
			console.error("feedback notify failed", await res.text());
		}
		return null;
	},
});

export const addReplyFromToken = internalMutation({
	args: {
		token: v.string(),
		commentId: v.id("comments"),
		content: v.string(),
		authorName: v.string(),
		authorEmail: v.string(),
	},
	handler: async (ctx, args) => {
		const resolved = await resolveProjectByToken(ctx, args.token);
		if (!resolved) throw new ConvexError("invalid_token");
		if (resolved.project.status !== "active") {
			throw new ConvexError("project_inactive");
		}
		const comment = await ctx.db.get(args.commentId);
		if (!comment || comment.projectId !== resolved.project._id) {
			throw new ConvexError("not_found");
		}
		const content = args.content.trim();
		if (!content) throw new ConvexError("empty_content");
		await enforceRateLimit(ctx, resolved.project._id);
		let replyClientName = "Guest";
		if (resolved.project.clientId) {
			const cl = await ctx.db.get(resolved.project.clientId);
			if (cl?.name) replyClientName = cl.name;
		}
		const replyId = await ctx.db.insert("commentReplies", {
			commentId: args.commentId,
			projectId: resolved.project._id,
			content: clampString(content, CONTENT_MAX),
			authorType: "guest",
			authorName: clampString(args.authorName, NAME_MAX) || replyClientName,
			authorEmail: clampString(args.authorEmail, EMAIL_MAX),
			createdAt: Date.now(),
		});
		await ctx.scheduler.runAfter(0, internal.feedback.notifyOwnerOfReply, {
			replyId,
		});
		return replyId;
	},
});

export const getReplyNotice = internalQuery({
	args: { replyId: v.id("commentReplies") },
	handler: async (ctx, args) => {
		const reply = await ctx.db.get(args.replyId);
		if (!reply) return null;
		const project = await ctx.db.get(reply.projectId);
		if (!project) return null;
		const owner = await ctx.db.get(project.ownerUserId);
		const open = await ctx.db
			.query("comments")
			.withIndex("by_project_status", (q) =>
				q.eq("projectId", project._id).eq("status", "open"),
			)
			.take(100);
		return {
			ownerEmail: owner?.email ?? null,
			projectId: project._id,
			projectName: project.name,
			content: reply.content,
			authorName: reply.authorName,
			openCount: open.length,
		};
	},
});

export const notifyOwnerOfReply = internalAction({
	args: { replyId: v.id("commentReplies") },
	handler: async (ctx, args) => {
		const apiKey = process.env.AUTH_RESEND_KEY;
		if (!apiKey) return null;
		const notice: {
			ownerEmail: string | null;
			projectId: Id<"feedbackProjects">;
			projectName: string;
			content: string;
			authorName: string;
			openCount: number;
		} | null = await ctx.runQuery(internal.feedback.getReplyNotice, {
			replyId: args.replyId,
		});
		if (!notice || !notice.ownerEmail) return null;
		const mayReply: boolean = await ctx.runMutation(
			internal.feedback.claimNotify,
			{ projectId: notice.projectId },
		);
		if (!mayReply) return null;
		const from =
			process.env.AUTH_EMAIL_FROM ?? "Feedback <onboarding@resend.dev>";
		const site = (process.env.SITE_URL ?? "").replace(/\/$/, "");
		const link = `${site}/feedback/${notice.projectId}`;
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"Idempotency-Key": `fbr/${args.replyId}`,
			},
			body: JSON.stringify({
				from,
				to: [notice.ownerEmail],
				subject:
					`New reply on ${notice.projectName}` +
					` (${notice.openCount} open)`,
				text:
					`${notice.authorName} replied:\n\n${notice.content}\n\n` +
					`${notice.openCount} open on this project.\n${link}`,
				html:
					`<p><strong>${notice.authorName}</strong> replied:</p>` +
					`<blockquote>${notice.content}</blockquote>` +
					`<p>${notice.openCount} open on this project. ` +
					`<a href="${link}">Open the feedback board →</a></p>`,
			}),
		});
		if (!res.ok) console.error("feedback reply notify failed", await res.text());
		return null;
	},
});

export const moveCommentFromToken = internalMutation({
	args: {
		token: v.string(),
		commentId: v.id("comments"),
		anchor: anchorValidator,
	},
	handler: async (ctx, args) => {
		const resolved = await resolveProjectByToken(ctx, args.token);
		if (!resolved) throw new ConvexError("invalid_token");
		const comment = await ctx.db.get(args.commentId);
		if (!comment || comment.projectId !== resolved.project._id) {
			throw new ConvexError("not_found");
		}
		await enforceRateLimit(ctx, resolved.project._id);
		await ctx.db.patch(args.commentId, { anchor: sanitizeAnchor(args.anchor) });
		return null;
	},
});

export const setStatusFromToken = internalMutation({
	args: {
		token: v.string(),
		commentId: v.id("comments"),
		status: statusValidator,
	},
	handler: async (ctx, args) => {
		const resolved = await resolveProjectByToken(ctx, args.token);
		if (!resolved) throw new ConvexError("invalid_token");
		const comment = await ctx.db.get(args.commentId);
		if (!comment || comment.projectId !== resolved.project._id) {
			throw new ConvexError("not_found");
		}
		await enforceRateLimit(ctx, resolved.project._id);
		await ctx.db.patch(args.commentId, { status: args.status });
		return null;
	},
});

export const editCommentFromToken = internalMutation({
	args: {
		token: v.string(),
		commentId: v.id("comments"),
		content: v.string(),
		// Image edits: attach/replace with imageStorageId, or clear with removeImage.
		imageStorageId: v.optional(v.id("_storage")),
		removeImage: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const resolved = await resolveProjectByToken(ctx, args.token);
		if (!resolved) throw new ConvexError("invalid_token");
		const comment = await ctx.db.get(args.commentId);
		if (!comment || comment.projectId !== resolved.project._id) {
			throw new ConvexError("not_found");
		}
		const content = args.content.trim();
		if (!content) throw new ConvexError("empty_content");
		await enforceRateLimit(ctx, resolved.project._id);
		const patch: Partial<Doc<"comments">> = {
			content: clampString(content, CONTENT_MAX),
		};
		if (args.removeImage) {
			if (comment.screenshotStorageId) {
				await ctx.storage.delete(comment.screenshotStorageId);
			}
			patch.screenshotStorageId = undefined;
		} else if (args.imageStorageId) {
			if (
				comment.screenshotStorageId &&
				comment.screenshotStorageId !== args.imageStorageId
			) {
				await ctx.storage.delete(comment.screenshotStorageId);
			}
			patch.screenshotStorageId = args.imageStorageId;
		}
		await ctx.db.patch(args.commentId, patch);
		return null;
	},
});

export const pruneRateBuckets = internalMutation({
	args: {},
	handler: async (ctx): Promise<null> => {
		const cutoff = Date.now() - 24 * 60 * 60 * 1000;
		// Oldest-first (by _creationTime ~ windowStart); stop at first fresh.
		const batch = await ctx.db
			.query("feedbackRateBuckets")
			.order("asc")
			.take(500);
		let deleted = 0;
		for (const b of batch) {
			if (b.windowStart >= cutoff) break;
			await ctx.db.delete(b._id);
			deleted++;
		}
		if (deleted >= 500) {
			await ctx.scheduler.runAfter(
				0,
				internal.feedback.pruneRateBuckets,
				{},
			);
		}
		return null;
	},
});

export const deleteCommentFromToken = internalMutation({
	args: { token: v.string(), commentId: v.id("comments") },
	handler: async (ctx, args) => {
		const resolved = await resolveProjectByToken(ctx, args.token);
		if (!resolved) throw new ConvexError("invalid_token");
		const comment = await ctx.db.get(args.commentId);
		if (!comment || comment.projectId !== resolved.project._id) {
			throw new ConvexError("not_found");
		}
		await enforceRateLimit(ctx, resolved.project._id);
		const replies = await ctx.db
			.query("commentReplies")
			.withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
			.take(500);
		for (const r of replies) await ctx.db.delete(r._id);
		await ctx.db.delete(args.commentId);
		return null;
	},
});

// --- Authenticated dashboard functions -------------------------------------

export const listProjects = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const role = await getAccessRole(ctx, userId);
		const projects =
			role.role === "client"
				? await ctx.db
						.query("feedbackProjects")
						.withIndex("by_client", (q) => q.eq("clientId", role.clientId))
						.order("desc")
						.take(200)
				: await ctx.db
						.query("feedbackProjects")
						.withIndex("by_owner", (q) => q.eq("ownerUserId", userId))
						.order("desc")
						.take(200);
		const projectsWithCounts = await Promise.all(
			projects.map(async (p) => {
				const open = await ctx.db
					.query("comments")
					.withIndex("by_project_status", (q) =>
						q.eq("projectId", p._id).eq("status", "open"),
					)
					.take(100);
				const newest = await ctx.db
					.query("comments")
					.withIndex("by_project", (q) => q.eq("projectId", p._id))
					.order("desc")
					.first();
				return {
					id: p._id,
					name: p.name,
					shopifyDomain: p.shopifyDomain,
					status: p.status,
					createdAt: p.createdAt,
					openCount: open.length,
					lastActivityAt: newest?.createdAt ?? p.createdAt,
				};
			}),
		);
		projectsWithCounts.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
		return { role: role.role, projects: projectsWithCounts };
	},
});

export const getProject = query({
	args: { projectId: v.id("feedbackProjects") },
	handler: async (ctx, args) => {
		const { project, role } = await assertProjectAccess(ctx, args.projectId);
		return {
			id: project._id,
			name: project.name,
			shopifyDomain: project.shopifyDomain,
			devHosts: project.devHosts ?? [],
			status: project.status,
			createdAt: project.createdAt,
			role,
			// Tokens are install secrets — owner only.
			widgetToken: role === "owner" ? project.widgetToken : null,
			shareToken: role === "owner" ? project.shareToken : null,
		};
	},
});

export const listComments = query({
	args: {
		projectId: v.id("feedbackProjects"),
		status: v.optional(statusValidator),
	},
	handler: async (ctx, args) => {
		await assertProjectAccess(ctx, args.projectId);
		const projectId = args.projectId;
		const status = args.status;
		const docs =
			status !== undefined
				? await ctx.db
						.query("comments")
						.withIndex("by_project_status", (q) =>
							q.eq("projectId", projectId).eq("status", status),
						)
						.order("desc")
						.take(500)
				: await ctx.db
						.query("comments")
						.withIndex("by_project", (q) => q.eq("projectId", projectId))
						.order("desc")
						.take(500);
		return await Promise.all(docs.map((d) => serializeComment(ctx, d)));
	},
});

export const listReplies = query({
	args: { commentId: v.id("comments") },
	handler: async (ctx, args) => {
		const comment = await ctx.db.get(args.commentId);
		if (!comment) throw new ConvexError("not_found");
		await assertProjectAccess(ctx, comment.projectId);
		const replies = await ctx.db
			.query("commentReplies")
			.withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
			.take(200);
		return replies.map((r) => ({
			id: r._id,
			content: r.content,
			authorType: r.authorType,
			authorName: r.authorName,
			createdAt: r.createdAt,
		}));
	},
});

export const createProject = mutation({
	args: {
		name: v.string(),
		shopifyDomain: v.string(),
		clientId: v.optional(v.id("clients")),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		// Only owners create projects.
		const role = await getAccessRole(ctx, userId);
		if (role.role !== "owner") throw new ConvexError("forbidden");
		const name = args.name.trim();
		if (!name) throw new ConvexError("empty_name");
		if (args.clientId) {
			const client = await ctx.db.get(args.clientId);
			if (!client || client.ownerId !== userId) {
				throw new ConvexError("invalid_client");
			}
		}
		return await ctx.db.insert("feedbackProjects", {
			ownerUserId: userId,
			clientId: args.clientId,
			name: clampString(name, NAME_MAX),
			shopifyDomain: normalizeShopifyDomain(args.shopifyDomain),
			widgetToken: newToken(),
			shareToken: newToken(),
			status: "active",
			createdAt: Date.now(),
		});
	},
});

async function assertOwner(
	ctx: MutationCtx,
	projectId: Id<"feedbackProjects">,
): Promise<Doc<"feedbackProjects">> {
	const userId = await getAuthUserId(ctx);
	if (!userId) throw new ConvexError("unauthenticated");
	const project = await ctx.db.get(projectId);
	if (!project || project.ownerUserId !== userId) {
		throw new ConvexError("forbidden");
	}
	return project;
}

export const linkClient = mutation({
	args: {
		projectId: v.id("feedbackProjects"),
		clientId: v.id("clients"),
	},
	handler: async (ctx, args) => {
		const project = await assertOwner(ctx, args.projectId);
		const client = await ctx.db.get(args.clientId);
		if (!client || client.ownerId !== project.ownerUserId) {
			throw new ConvexError("invalid_client");
		}
		if (!client.email) throw new ConvexError("client_has_no_email");
		const email = client.email.trim().toLowerCase();
		await ctx.db.patch(args.projectId, { clientId: args.clientId });
		const existing = await ctx.db
			.query("feedbackAccess")
			.withIndex("by_email", (q) => q.eq("email", email))
			.first();
		if (!existing) {
			await ctx.db.insert("feedbackAccess", {
				email,
				clientId: args.clientId,
				role: "client",
				createdAt: Date.now(),
			});
		} else if (existing.clientId !== args.clientId) {
			await ctx.db.patch(existing._id, { clientId: args.clientId });
		}
		return null;
	},
});

export const regenerateToken = mutation({
	args: {
		projectId: v.id("feedbackProjects"),
		which: v.union(v.literal("widget"), v.literal("share")),
	},
	handler: async (ctx, args) => {
		await assertOwner(ctx, args.projectId);
		await ctx.db.patch(
			args.projectId,
			args.which === "widget"
				? { widgetToken: newToken() }
				: { shareToken: newToken() },
		);
		return null;
	},
});

export const setProjectStatus = mutation({
	args: {
		projectId: v.id("feedbackProjects"),
		status: v.union(
			v.literal("active"),
			v.literal("paused"),
			v.literal("archived"),
		),
	},
	handler: async (ctx, args) => {
		await assertOwner(ctx, args.projectId);
		await ctx.db.patch(args.projectId, { status: args.status });
		return null;
	},
});

// Owner-set list of local dev hosts (e.g. "localhost:5173") that resolve to
// this project in the review extension. Rejects anything that isn't a
// loopback-style host and caps the list so it stays a dev convenience.
export const setDevHosts = mutation({
	args: {
		projectId: v.id("feedbackProjects"),
		devHosts: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		await assertOwner(ctx, args.projectId);
		const normalized: string[] = [];
		for (const raw of args.devHosts.slice(0, 10)) {
			const h = normalizeDevHost(raw);
			if (!normalized.includes(h)) normalized.push(h);
		}
		await ctx.db.patch(args.projectId, { devHosts: normalized });
		return null;
	},
});

// CLI escape hatch (`npx convex run feedback:setDevHostsByDomain --prod ...`)
// for wiring a dev host before the dashboard UI is deployed. Same
// normalization rules as setDevHosts.
export const setDevHostsByDomain = internalMutation({
	args: { shopifyDomain: v.string(), devHosts: v.array(v.string()) },
	handler: async (ctx, args) => {
		const project = await ctx.db
			.query("feedbackProjects")
			.withIndex("by_shopify_domain", (q) =>
				q.eq("shopifyDomain", args.shopifyDomain),
			)
			.first();
		if (!project) throw new ConvexError("project_not_found");
		const normalized: string[] = [];
		for (const raw of args.devHosts.slice(0, 10)) {
			const h = normalizeDevHost(raw);
			if (!normalized.includes(h)) normalized.push(h);
		}
		await ctx.db.patch(project._id, { devHosts: normalized });
		return { project: project.name, devHosts: normalized };
	},
});

export const purgeProject = internalMutation({
	args: { projectId: v.id("feedbackProjects") },
	handler: async (ctx, args): Promise<null> => {
		const comments = await ctx.db
			.query("comments")
			.withIndex("by_project", (q) => q.eq("projectId", args.projectId))
			.take(80);
		for (const c of comments) {
			const replies = await ctx.db
				.query("commentReplies")
				.withIndex("by_comment", (q) => q.eq("commentId", c._id))
				.take(500);
			for (const r of replies) await ctx.db.delete(r._id);
			await ctx.db.delete(c._id);
		}
		if (comments.length === 80) {
			await ctx.scheduler.runAfter(0, internal.feedback.purgeProject, {
				projectId: args.projectId,
			});
			return null;
		}
		// No comments left — clean up auxiliary rows + the project itself.
		const buckets = await ctx.db
			.query("feedbackRateBuckets")
			.withIndex("by_project_window", (q) =>
				q.eq("projectId", args.projectId),
			)
			.take(500);
		for (const b of buckets) await ctx.db.delete(b._id);
		const notify = await ctx.db
			.query("feedbackNotifyState")
			.withIndex("by_project", (q) => q.eq("projectId", args.projectId))
			.collect();
		for (const n of notify) await ctx.db.delete(n._id);
		const project = await ctx.db.get(args.projectId);
		if (project) await ctx.db.delete(args.projectId);
		return null;
	},
});

export const deleteProject = mutation({
	args: { projectId: v.id("feedbackProjects") },
	handler: async (ctx, args) => {
		await assertOwner(ctx, args.projectId);
		// feedbackAccess is keyed by client/email and may be shared with
		// other projects, so it is intentionally left intact.
		await ctx.scheduler.runAfter(0, internal.feedback.purgeProject, {
			projectId: args.projectId,
		});
		return null;
	},
});

export const addReply = mutation({
	args: { commentId: v.id("comments"), content: v.string() },
	handler: async (ctx, args) => {
		const comment = await ctx.db.get(args.commentId);
		if (!comment) throw new ConvexError("not_found");
		const { role } = await assertProjectAccess(ctx, comment.projectId);
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const user = await ctx.db.get(userId);
		const content = args.content.trim();
		if (!content) throw new ConvexError("empty_content");
		return await ctx.db.insert("commentReplies", {
			commentId: args.commentId,
			projectId: comment.projectId,
			content: clampString(content, CONTENT_MAX),
			authorType: role,
			authorName: clampString(
				user?.name || user?.email || (role === "owner" ? "Owner" : "Client"),
				NAME_MAX,
			),
			authorEmail: clampString(user?.email ?? "", EMAIL_MAX),
			createdAt: Date.now(),
		});
	},
});

export const setCommentStatus = mutation({
	args: { commentId: v.id("comments"), status: statusValidator },
	handler: async (ctx, args) => {
		const comment = await ctx.db.get(args.commentId);
		if (!comment) throw new ConvexError("not_found");
		await assertProjectAccess(ctx, comment.projectId);
		await ctx.db.patch(args.commentId, { status: args.status });
		return null;
	},
});

export const deleteComment = mutation({
	args: { commentId: v.id("comments") },
	handler: async (ctx, args) => {
		const comment = await ctx.db.get(args.commentId);
		if (!comment) throw new ConvexError("not_found");
		await assertProjectAccess(ctx, comment.projectId);
		const replies = await ctx.db
			.query("commentReplies")
			.withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
			.take(500);
		for (const r of replies) await ctx.db.delete(r._id);
		await ctx.db.delete(args.commentId);
		return null;
	},
});

// --- Dev-only helper (Phase 2 dashboard testing) ---------------------------

export const devAddTestComment = mutation({
	args: {
		projectId: v.id("feedbackProjects"),
		content: v.string(),
		pagePath: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await assertOwner(ctx, args.projectId);
		const path = args.pagePath ?? "/";
		return await ctx.db.insert("comments", {
			projectId: args.projectId,
			pageUrl: `https://example.myshopify.com${path}`,
			pagePath: path,
			anchor: {
				selector: "body",
				xpath: "/html/body",
				nx: 0.5,
				ny: 0.5,
				scrollY: 0,
				elementWidth: 1280,
				elementHeight: 720,
			},
			content: clampString(args.content.trim() || "Test comment", CONTENT_MAX),
			status: "open",
			authorType: "guest",
			authorName: "Test Guest",
			authorEmail: "guest@example.com",
			metadata: {
				userAgent: "dev",
				browser: "dev",
				os: "dev",
				viewportWidth: 1280,
				viewportHeight: 720,
				devicePixelRatio: 1,
			},
			createdAt: Date.now(),
		});
	},
});
