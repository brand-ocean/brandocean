// Server-rendered page snapshots for the feedback review surface.
//
// Shopify storefronts send `Content-Security-Policy: frame-ancestors 'none'`,
// so they can never be embedded in an iframe. Instead of trying to frame the
// store, we render it server-side with Cloudflare Browser Rendering, store a
// full-page PNG in Convex storage, and let reviewers pin comments onto the
// image (see comments.imagePin). No iframe, no frame-ancestors, works on any
// theme regardless of how JS-driven its nav is.

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	action,
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";
import { assertProjectAccess } from "./feedback";

const CONTENT_MAX = 5000;
const NAME_MAX = 120;

const deviceValidator = v.union(v.literal("desktop"), v.literal("mobile"));

// Viewport per device. `isMobile`/`hasTouch` make themes (incl. Shopify
// Horizon, which switches to its drawer nav on touch) render their true mobile
// layout rather than a narrow desktop one.
const VIEWPORTS = {
	desktop: { width: 1440, height: 900, isMobile: false, hasTouch: false },
	mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
} as const;

// Pull width/height straight from the PNG's IHDR chunk (bytes 16–24, BE) so we
// don't have to decode the image just to know its dimensions.
function pngSize(buf: ArrayBuffer): { width: number; height: number } | null {
	if (buf.byteLength < 24) return null;
	const dv = new DataView(buf);
	if (dv.getUint32(0) !== 0x89504e47) return null; // not a PNG
	return { width: dv.getUint32(16), height: dv.getUint32(20) };
}

// "/collections/all?x=1" | "https://store/collections/all" -> "/collections/all"
function normalizePath(input: string): string {
	let p = input.trim();
	if (/^https?:\/\//i.test(p)) {
		try {
			p = new URL(p).pathname;
		} catch {
			p = "/";
		}
	}
	if (!p.startsWith("/")) p = `/${p}`;
	// Drop the query/hash — a snapshot is keyed by path only.
	p = p.split(/[?#]/)[0];
	return p || "/";
}

// "https://store.com/path/" | "store.com" | "www.store.com//" -> "store.com".
// The stored shopifyDomain is free-text, so a protocol or trailing path here
// would otherwise produce a malformed URL like `https://https://store.com/…`,
// which the headless browser can't resolve (Cloudflare error 5006 / DNS).
function sanitizeHost(domain: string): string {
	let h = domain.trim();
	h = h.replace(/^https?:\/\//i, ""); // strip protocol
	h = h.split(/[/?#]/)[0]; // strip any path/query/hash
	h = h.replace(/\.+$/, ""); // strip trailing dots
	return h.toLowerCase();
}

// --- Internal: access + persistence (called only from the action) ----------

export const projectForCapture = internalQuery({
	args: { projectId: v.id("feedbackProjects") },
	handler: async (ctx, args) => {
		// Reuses the same owner/client gating as the rest of the feedback API;
		// auth identity propagates from the calling action.
		const { project } = await assertProjectAccess(ctx, args.projectId);
		return { shopifyDomain: project.shopifyDomain, status: project.status };
	},
});

export const upsert = internalMutation({
	args: {
		projectId: v.id("feedbackProjects"),
		pagePath: v.string(),
		device: deviceValidator,
		status: v.union(
			v.literal("pending"),
			v.literal("ready"),
			v.literal("error"),
		),
		capturedAt: v.number(),
		storageId: v.optional(v.id("_storage")),
		width: v.optional(v.number()),
		height: v.optional(v.number()),
		error: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("pageSnapshots")
			.withIndex("by_project_path_device", (q) =>
				q
					.eq("projectId", args.projectId)
					.eq("pagePath", args.pagePath)
					.eq("device", args.device),
			)
			.first();

		const patch: Record<string, unknown> = {
			status: args.status,
			capturedAt: args.capturedAt,
		};
		if (args.storageId !== undefined) patch.storageId = args.storageId;
		if (args.width !== undefined) patch.width = args.width;
		if (args.height !== undefined) patch.height = args.height;
		// Clear a stale error on success; record it on failure.
		patch.error = args.status === "error" ? (args.error ?? "unknown") : undefined;

		if (existing) {
			// Replacing the image — delete the old blob so storage doesn't leak.
			if (
				args.storageId !== undefined &&
				existing.storageId &&
				existing.storageId !== args.storageId
			) {
				await ctx.storage.delete(existing.storageId);
			}
			await ctx.db.patch(existing._id, patch);
			return existing._id;
		}
		return await ctx.db.insert("pageSnapshots", {
			projectId: args.projectId,
			pagePath: args.pagePath,
			device: args.device,
			status: args.status,
			capturedAt: args.capturedAt,
			storageId: args.storageId,
			width: args.width,
			height: args.height,
			error: args.status === "error" ? (args.error ?? "unknown") : undefined,
		});
	},
});

// --- Public: capture a snapshot (owner/client triggers from the dashboard) --

export const capture = action({
	args: {
		projectId: v.id("feedbackProjects"),
		pagePath: v.string(),
		device: deviceValidator,
	},
	handler: async (ctx, args): Promise<{ ok: true }> => {
		const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
		const apiToken = process.env.CLOUDFLARE_BROWSER_API_TOKEN;
		if (!accountId || !apiToken) {
			throw new ConvexError("cloudflare_not_configured");
		}

		const { shopifyDomain } = await ctx.runQuery(
			internal.snapshots.projectForCapture,
			{ projectId: args.projectId },
		);

		const pagePath = normalizePath(args.pagePath);
		const vp = VIEWPORTS[args.device];
		const host = sanitizeHost(shopifyDomain);
		if (!host) throw new ConvexError("invalid_domain");
		// feedback=0 tells the injected widget to no-op, so it never appears in
		// the screenshot.
		const targetUrl = `https://${host}${pagePath}?feedback=0`;

		await ctx.runMutation(internal.snapshots.upsert, {
			projectId: args.projectId,
			pagePath,
			device: args.device,
			status: "pending",
			capturedAt: Date.now(),
		});

		const markError = (msg: string) =>
			ctx.runMutation(internal.snapshots.upsert, {
				projectId: args.projectId,
				pagePath,
				device: args.device,
				status: "error",
				capturedAt: Date.now(),
				error: msg.slice(0, 500),
			});

		let res: Response;
		try {
			res = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/screenshot`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						url: targetUrl,
						viewport: { ...vp, deviceScaleFactor: 1 },
						screenshotOptions: { fullPage: true, type: "png" },
						// networkidle2 + bestAttempt: storefronts keep analytics/long-poll
						// connections open, so networkidle0 may never settle. Proceed once
						// the page is essentially loaded rather than erroring (5006).
						gotoOptions: { waitUntil: "networkidle2", timeout: 45000 },
						bestAttempt: true,
						// Belt-and-suspenders: hide our widget host if it ever renders.
						addStyleTag: [
							{ content: "#bo-feedback-host{display:none!important}" },
						],
					}),
				},
			);
		} catch (e) {
			await markError(e instanceof Error ? e.message : "fetch_failed");
			throw new ConvexError("capture_failed");
		}

		const contentType = res.headers.get("Content-Type") || "";
		if (!res.ok || !contentType.startsWith("image/")) {
			const text = await res.text().catch(() => "");
			await markError(text || `status_${res.status}`);
			throw new ConvexError("capture_failed");
		}

		const buf = await res.arrayBuffer();
		const dims = pngSize(buf);
		const storageId = await ctx.storage.store(
			new Blob([buf], { type: "image/png" }),
		);

		await ctx.runMutation(internal.snapshots.upsert, {
			projectId: args.projectId,
			pagePath,
			device: args.device,
			status: "ready",
			capturedAt: Date.now(),
			storageId,
			width: dims?.width,
			height: dims?.height,
		});

		return { ok: true };
	},
});

// --- Public: read snapshots for the review UI -------------------------------

export const listForProject = query({
	args: { projectId: v.id("feedbackProjects") },
	handler: async (ctx, args) => {
		await assertProjectAccess(ctx, args.projectId);
		const rows = await ctx.db
			.query("pageSnapshots")
			.withIndex("by_project", (q) => q.eq("projectId", args.projectId))
			.collect();
		return Promise.all(
			rows.map(async (s) => ({
				id: s._id,
				pagePath: s.pagePath,
				device: s.device,
				status: s.status,
				width: s.width ?? null,
				height: s.height ?? null,
				error: s.error ?? null,
				capturedAt: s.capturedAt,
				url: s.storageId ? await ctx.storage.getUrl(s.storageId) : null,
			})),
		);
	},
});

// --- Public: pin a comment onto a screenshot (owner/client) -----------------

export const createImageComment = mutation({
	args: {
		projectId: v.id("feedbackProjects"),
		pagePath: v.string(),
		device: deviceValidator,
		nx: v.number(),
		ny: v.number(),
		content: v.string(),
		kind: v.optional(
			v.union(v.literal("bug"), v.literal("idea"), v.literal("question")),
		),
	},
	handler: async (ctx, args): Promise<Id<"comments">> => {
		const { role } = await assertProjectAccess(ctx, args.projectId);
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		const user = await ctx.db.get(userId);

		const content = args.content.trim();
		if (!content) throw new ConvexError("empty_content");

		const clamp01 = (n: number) =>
			Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
		const pagePath = args.pagePath.startsWith("/")
			? args.pagePath
			: `/${args.pagePath}`;

		return await ctx.db.insert("comments", {
			projectId: args.projectId,
			pageUrl: pagePath,
			pagePath,
			// No live-DOM anchor for an image pin; imagePin carries the position.
			anchor: {
				selector: "",
				xpath: "",
				nx: clamp01(args.nx),
				ny: clamp01(args.ny),
				scrollY: 0,
				elementWidth: 0,
				elementHeight: 0,
			},
			imagePin: { device: args.device, nx: clamp01(args.nx), ny: clamp01(args.ny) },
			content: content.slice(0, CONTENT_MAX),
			kind: args.kind,
			status: "open",
			authorType: role,
			authorName: (
				user?.name ||
				user?.email ||
				(role === "owner" ? "Owner" : "Client")
			).slice(0, NAME_MAX),
			authorEmail: (user?.email || "").slice(0, 200),
			device: args.device,
			metadata: {
				userAgent: "",
				browser: "",
				os: "",
				viewportWidth: VIEWPORTS[args.device].width,
				viewportHeight: VIEWPORTS[args.device].height,
				devicePixelRatio: 1,
			},
			createdAt: Date.now(),
		});
	},
});

// --- Live interactive mobile preview (remote browser streaming) -------------
// Issues a short-lived, HMAC-signed WebSocket URL for the dedicated preview
// Worker (workers/mobile-preview), which verifies the signature and streams a
// live Cloudflare mobile browser to the dashboard canvas — no iframe. The token
// carries the target URL + viewport so the Worker never touches the DB.

const PREVIEW_TTL_MS = 2 * 60 * 1000; // window to open the socket

const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function base64urlBytes(bytes: Uint8Array): string {
	let out = "";
	for (let i = 0; i < bytes.length; i += 3) {
		const b0 = bytes[i];
		const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
		const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
		out += B64URL[b0 >> 2];
		out += B64URL[((b0 & 3) << 4) | (b1 >> 4)];
		if (i + 1 < bytes.length) out += B64URL[((b1 & 15) << 2) | (b2 >> 6)];
		if (i + 2 < bytes.length) out += B64URL[b2 & 63];
	}
	return out;
}

function toHex(bytes: Uint8Array): string {
	let s = "";
	for (let i = 0; i < bytes.length; i++) {
		s += bytes[i].toString(16).padStart(2, "0");
	}
	return s;
}

async function signPreviewToken(
	payload: { url: string; w: number; h: number; dsf: number; exp: number },
	secret: string,
): Promise<string> {
	const enc = new TextEncoder();
	const body = base64urlBytes(enc.encode(JSON.stringify(payload)));
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
	return `${body}.${toHex(new Uint8Array(sig))}`;
}

export const startLivePreview = action({
	args: {
		projectId: v.id("feedbackProjects"),
		pagePath: v.string(),
		device: deviceValidator,
	},
	handler: async (
		ctx,
		args,
	): Promise<{ wsUrl: string; expiresAt: number }> => {
		const secret = process.env.PREVIEW_TOKEN_SECRET;
		const workerUrl = process.env.PREVIEW_WORKER_URL; // wss://…/preview
		if (!secret || !workerUrl) {
			throw new ConvexError("preview_not_configured");
		}
		const { shopifyDomain } = await ctx.runQuery(
			internal.snapshots.projectForCapture,
			{ projectId: args.projectId },
		);
		const host = sanitizeHost(shopifyDomain);
		if (!host) throw new ConvexError("invalid_domain");
		const pagePath = normalizePath(args.pagePath);
		const vp =
			args.device === "mobile"
				? { w: 390, h: 844, dsf: 2 }
				: { w: 1440, h: 900, dsf: 1 };
		const exp = Date.now() + PREVIEW_TTL_MS;
		const token = await signPreviewToken(
			{ url: `https://${host}${pagePath}`, w: vp.w, h: vp.h, dsf: vp.dsf, exp },
			secret,
		);
		const sep = workerUrl.includes("?") ? "&" : "?";
		return {
			wsUrl: `${workerUrl}${sep}token=${encodeURIComponent(token)}`,
			expiresAt: exp,
		};
	},
});
