import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
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

function sanitizeAnchor(a: Doc<"comments">["anchor"]): Doc<"comments">["anchor"] {
	const clamp01 = (n: number) =>
		Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
	const num = (n: number) => (Number.isFinite(n) ? n : 0);
	return {
		selector: clampString(a.selector, 1000),
		xpath: clampString(a.xpath, 2000),
		nx: clamp01(a.nx),
		ny: clamp01(a.ny),
		scrollY: num(a.scrollY),
		elementWidth: num(a.elementWidth),
		elementHeight: num(a.elementHeight),
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

async function assertProjectAccess(
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
	metadata: Doc<"comments">["metadata"];
	screenshotUrl: string | null;
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
		metadata: comment.metadata,
		screenshotUrl,
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
			project: { name: resolved.project.name },
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
		kind: kindValidator,
		authorName: v.string(),
		authorEmail: v.string(),
		metadata: metadataValidator,
		screenshotStorageId: v.optional(v.id("_storage")),
	},
	handler: async (ctx, args) => {
		const resolved = await resolveProjectByToken(ctx, args.token);
		if (!resolved) throw new ConvexError("invalid_token");
		if (resolved.project.status !== "active") {
			throw new ConvexError("project_inactive");
		}
		const content = args.content.trim();
		if (!content) throw new ConvexError("empty_content");
		await enforceRateLimit(ctx, resolved.project._id);
		const commentId = await ctx.db.insert("comments", {
			projectId: resolved.project._id,
			pageUrl: clampString(args.pageUrl, 2000),
			pagePath: clampString(args.pagePath, 1000),
			anchor: sanitizeAnchor(args.anchor),
			content: clampString(content, CONTENT_MAX),
			kind: args.kind,
			status: "open",
			authorType: "guest",
			authorName: clampString(args.authorName, NAME_MAX) || "Guest",
			authorEmail: clampString(args.authorEmail, EMAIL_MAX),
			screenshotStorageId: args.screenshotStorageId,
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
		return {
			ownerEmail: owner?.email ?? null,
			projectId: project._id,
			projectName: project.name,
			content: comment.content,
			kind: comment.kind ?? null,
			authorName: comment.authorName,
			pagePath: comment.pagePath,
			pageUrl: comment.pageUrl,
		};
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
		} | null = await ctx.runQuery(internal.feedback.getCommentNotice, {
			commentId: args.commentId,
		});
		if (!notice || !notice.ownerEmail) return null;
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
				subject: `${tag}New feedback on ${notice.projectName}`,
				text:
					`${notice.authorName} commented on ${notice.pagePath}:\n\n` +
					`${notice.content}\n\n${link}`,
				html:
					`<p><strong>${notice.authorName}</strong> commented on ` +
					`<code>${notice.pagePath}</code>:</p>` +
					`<blockquote>${notice.content}</blockquote>` +
					`<p><a href="${link}">Open the feedback board →</a></p>`,
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
		const replyId = await ctx.db.insert("commentReplies", {
			commentId: args.commentId,
			projectId: resolved.project._id,
			content: clampString(content, CONTENT_MAX),
			authorType: "guest",
			authorName: clampString(args.authorName, NAME_MAX) || "Guest",
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
		return {
			ownerEmail: owner?.email ?? null,
			projectId: project._id,
			projectName: project.name,
			content: reply.content,
			authorName: reply.authorName,
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
		} | null = await ctx.runQuery(internal.feedback.getReplyNotice, {
			replyId: args.replyId,
		});
		if (!notice || !notice.ownerEmail) return null;
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
				subject: `New reply on ${notice.projectName}`,
				text: `${notice.authorName} replied:\n\n${notice.content}\n\n${link}`,
				html:
					`<p><strong>${notice.authorName}</strong> replied:</p>` +
					`<blockquote>${notice.content}</blockquote>` +
					`<p><a href="${link}">Open the feedback board →</a></p>`,
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
		await ctx.db.patch(args.commentId, { status: args.status });
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
				return {
					id: p._id,
					name: p.name,
					shopifyDomain: p.shopifyDomain,
					status: p.status,
					createdAt: p.createdAt,
					openCount: open.length,
				};
			}),
		);
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
			shopifyDomain: clampString(args.shopifyDomain.trim(), 300),
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
