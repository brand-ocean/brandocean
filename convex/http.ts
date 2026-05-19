import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";
import { FEEDBACK_WIDGET_SOURCE } from "./feedbackWidgetSource";

const http = httpRouter();

auth.addHttpRoutes(http);

// --- Visual website-feedback: cross-origin widget/share API ----------------
//
// These endpoints run on the client's Shopify domain (the widget) or the
// public share board, so they cannot use Convex Auth. They are gated by an
// unguessable per-project token. Auth is a token in a header — never a cookie
// — so echoing arbitrary request origins carries no CSRF/credential risk.

const FB_MAX_BODY_BYTES = 256 * 1024;

type Json =
	| string
	| number
	| boolean
	| null
	| Json[]
	| { [key: string]: Json };
type JsonObject = { [key: string]: Json };

function fbCors(origin: string | null): Record<string, string> {
	return {
		"Access-Control-Allow-Origin": origin ?? "*",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, X-Feedback-Token",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};
}

function fbJson<T>(body: T, status: number, origin: string | null): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...fbCors(origin) },
	});
}

function fbStr(obj: JsonObject, key: string): string {
	const value = obj[key];
	return typeof value === "string" ? value : "";
}

function fbNum(obj: JsonObject, key: string): number {
	const value = obj[key];
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function fbObj(obj: JsonObject, key: string): JsonObject {
	const value = obj[key];
	return value && typeof value === "object" && !Array.isArray(value)
		? value
		: {};
}

function fbErrorStatus(message: string): number {
	if (message.includes("rate_limited")) return 429;
	if (message.includes("invalid_token")) return 401;
	if (message.includes("not_found")) return 404;
	return 400;
}

function fbToken(request: Request, url: URL): string | null {
	return (
		request.headers.get("X-Feedback-Token") ??
		url.searchParams.get("token") ??
		null
	);
}

async function fbReadJson(request: Request): Promise<JsonObject | null> {
	const text = await request.text();
	if (text.length > FB_MAX_BODY_BYTES) return null;
	try {
		const parsed: Json = JSON.parse(text);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			return parsed;
		}
		return null;
	} catch {
		return null;
	}
}

function fbAnchor(obj: JsonObject): {
	selector: string;
	xpath: string;
	nx: number;
	ny: number;
	scrollY: number;
	elementWidth: number;
	elementHeight: number;
	px?: number;
	py?: number;
} {
	const a = fbObj(obj, "anchor");
	const optN = (k: string) => {
		const val = a[k];
		return typeof val === "number" && Number.isFinite(val) ? val : undefined;
	};
	return {
		selector: fbStr(a, "selector"),
		xpath: fbStr(a, "xpath"),
		nx: fbNum(a, "nx"),
		ny: fbNum(a, "ny"),
		scrollY: fbNum(a, "scrollY"),
		elementWidth: fbNum(a, "elementWidth"),
		elementHeight: fbNum(a, "elementHeight"),
		px: optN("px"),
		py: optN("py"),
	};
}

function fbMetadata(obj: JsonObject): {
	userAgent: string;
	browser: string;
	os: string;
	viewportWidth: number;
	viewportHeight: number;
	devicePixelRatio: number;
} {
	const m = fbObj(obj, "metadata");
	return {
		userAgent: fbStr(m, "userAgent"),
		browser: fbStr(m, "browser"),
		os: fbStr(m, "os"),
		viewportWidth: fbNum(m, "viewportWidth"),
		viewportHeight: fbNum(m, "viewportHeight"),
		devicePixelRatio: fbNum(m, "devicePixelRatio") || 1,
	};
}

const fbPreflight = httpAction(async (_ctx, request) => {
	return new Response(null, {
		status: 204,
		headers: fbCors(request.headers.get("Origin")),
	});
});

for (const path of [
	"/feedback/comments",
	"/feedback/replies",
	"/feedback/resolve",
	"/feedback/move",
	"/feedback/delete",
	"/feedback/screenshot-upload-url",
]) {
	http.route({ path, method: "OPTIONS", handler: fbPreflight });
}

http.route({
	path: "/feedback/widget.js",
	method: "GET",
	handler: httpAction(async () => {
		return new Response(FEEDBACK_WIDGET_SOURCE, {
			status: 200,
			headers: {
				"Content-Type": "application/javascript; charset=utf-8",
				"Cache-Control": "public, max-age=30",
				"Access-Control-Allow-Origin": "*",
			},
		});
	}),
});

// Image proxy so html2canvas can draw cross-origin store images
// (Shopify/CDN assets without CORS) instead of a solid-color fill.
function fbIsBlockedHost(host: string): boolean {
	const h = host.toLowerCase();
	if (
		h === "localhost" ||
		h === "0.0.0.0" ||
		h === "::1" ||
		h.endsWith(".internal") ||
		h.endsWith(".local")
	)
		return true;
	if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) {
		return true;
	}
	if (/^169\.254\./.test(h)) return true;
	if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
	return false;
}

http.route({
	path: "/feedback/img",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const target = url.searchParams.get("url");
		const deny = (s: number) =>
			new Response("", { status: s, headers: { "Vary": "Origin" } });
		const token = url.searchParams.get("token");
		if (!token) return deny(401);
		const project = await ctx.runQuery(internal.feedback.resolveToken, {
			token,
		});
		if (!project) return deny(403);
		if (!target) return deny(400);
		let parsed: URL;
		try {
			parsed = new URL(target);
		} catch {
			return deny(400);
		}
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return deny(400);
		}
		if (fbIsBlockedHost(parsed.hostname)) return deny(403);
		try {
			const upstream = await fetch(parsed.toString(), {
				headers: { Accept: "image/*" },
				redirect: "follow",
			});
			if (!upstream.ok) return deny(upstream.status === 404 ? 404 : 502);
			const ct = upstream.headers.get("Content-Type") || "";
			if (!ct.startsWith("image/")) return deny(415);
			const buf = await upstream.arrayBuffer();
			if (buf.byteLength > 8 * 1024 * 1024) return deny(413);
			return new Response(buf, {
				status: 200,
				headers: {
					"Content-Type": ct,
					"Cache-Control": "public, max-age=86400",
					"Access-Control-Allow-Origin": "*",
				},
			});
		} catch {
			return deny(502);
		}
	}),
});

http.route({
	path: "/feedback/comments",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const origin = request.headers.get("Origin");
		const url = new URL(request.url);
		const token = fbToken(request, url);
		if (!token) return fbJson({ error: "missing_token" }, 401, origin);
		const pagePathParam = url.searchParams.get("pagePath");
		try {
			const result = await ctx.runQuery(internal.feedback.listForToken, {
				token,
				pagePath: pagePathParam ?? undefined,
			});
			return fbJson(result, 200, origin);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return fbJson({ error: msg }, fbErrorStatus(msg), origin);
		}
	}),
});

http.route({
	path: "/feedback/comments",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const origin = request.headers.get("Origin");
		const url = new URL(request.url);
		const token = fbToken(request, url);
		if (!token) return fbJson({ error: "missing_token" }, 401, origin);
		const body = await fbReadJson(request);
		if (!body) return fbJson({ error: "bad_body" }, 400, origin);
		const screenshotRaw = body.screenshotStorageId;
		try {
			const id = await ctx.runMutation(
				internal.feedback.createCommentFromToken,
				{
					token,
					pageUrl: fbStr(body, "pageUrl"),
					pagePath: fbStr(body, "pagePath") || "/",
					anchor: fbAnchor(body),
					content: fbStr(body, "content"),
					clientKey: fbStr(body, "clientKey") || undefined,
					kind:
						body.kind === "bug" ||
						body.kind === "idea" ||
						body.kind === "question"
							? body.kind
							: undefined,
					authorName: fbStr(body, "authorName"),
					authorEmail: fbStr(body, "authorEmail"),
					metadata: fbMetadata(body),
					screenshotStorageId:
						typeof screenshotRaw === "string"
							? (screenshotRaw as Id<"_storage">)
							: undefined,
				},
			);
			return fbJson({ id }, 200, origin);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return fbJson({ error: msg }, fbErrorStatus(msg), origin);
		}
	}),
});

http.route({
	path: "/feedback/replies",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const origin = request.headers.get("Origin");
		const url = new URL(request.url);
		const token = fbToken(request, url);
		if (!token) return fbJson({ error: "missing_token" }, 401, origin);
		const body = await fbReadJson(request);
		if (!body) return fbJson({ error: "bad_body" }, 400, origin);
		try {
			const id = await ctx.runMutation(internal.feedback.addReplyFromToken, {
				token,
				commentId: fbStr(body, "commentId") as Id<"comments">,
				content: fbStr(body, "content"),
				authorName: fbStr(body, "authorName"),
				authorEmail: fbStr(body, "authorEmail"),
			});
			return fbJson({ id }, 200, origin);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return fbJson({ error: msg }, fbErrorStatus(msg), origin);
		}
	}),
});

http.route({
	path: "/feedback/resolve",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const origin = request.headers.get("Origin");
		const url = new URL(request.url);
		const token = fbToken(request, url);
		if (!token) return fbJson({ error: "missing_token" }, 401, origin);
		const body = await fbReadJson(request);
		if (!body) return fbJson({ error: "bad_body" }, 400, origin);
		const status = body.status === "resolved" ? "resolved" : "open";
		try {
			await ctx.runMutation(internal.feedback.setStatusFromToken, {
				token,
				commentId: fbStr(body, "commentId") as Id<"comments">,
				status,
			});
			return fbJson({ ok: true }, 200, origin);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return fbJson({ error: msg }, fbErrorStatus(msg), origin);
		}
	}),
});

http.route({
	path: "/feedback/move",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const origin = request.headers.get("Origin");
		const url = new URL(request.url);
		const token = fbToken(request, url);
		if (!token) return fbJson({ error: "missing_token" }, 401, origin);
		const body = await fbReadJson(request);
		if (!body) return fbJson({ error: "bad_body" }, 400, origin);
		try {
			await ctx.runMutation(internal.feedback.moveCommentFromToken, {
				token,
				commentId: fbStr(body, "commentId") as Id<"comments">,
				anchor: fbAnchor(body),
			});
			return fbJson({ ok: true }, 200, origin);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return fbJson({ error: msg }, fbErrorStatus(msg), origin);
		}
	}),
});

http.route({
	path: "/feedback/delete",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const origin = request.headers.get("Origin");
		const url = new URL(request.url);
		const token = fbToken(request, url);
		if (!token) return fbJson({ error: "missing_token" }, 401, origin);
		const body = await fbReadJson(request);
		if (!body) return fbJson({ error: "bad_body" }, 400, origin);
		try {
			await ctx.runMutation(internal.feedback.deleteCommentFromToken, {
				token,
				commentId: fbStr(body, "commentId") as Id<"comments">,
			});
			return fbJson({ ok: true }, 200, origin);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return fbJson({ error: msg }, fbErrorStatus(msg), origin);
		}
	}),
});

http.route({
	path: "/feedback/screenshot-upload-url",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const origin = request.headers.get("Origin");
		const url = new URL(request.url);
		const token = fbToken(request, url);
		if (!token) return fbJson({ error: "missing_token" }, 401, origin);
		const resolved = await ctx.runQuery(internal.feedback.resolveToken, {
			token,
		});
		if (!resolved || resolved.status !== "active") {
			return fbJson({ error: "invalid_token" }, 401, origin);
		}
		const uploadUrl = await ctx.storage.generateUploadUrl();
		return fbJson({ uploadUrl }, 200, origin);
	}),
});

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function wrapTitle(title: string, perLine = 18): string[] {
	const words = title.split(/\s+/);
	const lines: string[] = [];
	let current = "";
	for (const w of words) {
		if (!current) {
			current = w;
			continue;
		}
		if ((current + " " + w).length > perLine) {
			lines.push(current);
			current = w;
		} else {
			current = current + " " + w;
		}
	}
	if (current) lines.push(current);
	return lines.slice(0, 3);
}

function renderOgSvg(titleRaw: string): string {
	const safe = escapeXml(titleRaw.toUpperCase());
	const lines = wrapTitle(safe);
	const lineHeight = 120;
	const totalHeight = lines.length * lineHeight;
	const startY = 315 - totalHeight / 2 + lineHeight * 0.75;
	const tspans = lines
		.map(
			(l, i) =>
				`<tspan x="80" dy="${i === 0 ? 0 : lineHeight}">${l}</tspan>`,
		)
		.join("");
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect x="0" y="0" width="1200" height="4" fill="#0f172a"/>
  <text x="80" y="100" font-family="'Barlow Condensed','Inter','Helvetica Neue',Arial,sans-serif" font-size="22" font-weight="600" fill="#94a3b8" letter-spacing="6">BRANDOCEAN</text>
  <text x="80" y="${startY}" font-family="'Barlow Condensed','Inter','Helvetica Neue',Arial,sans-serif" font-size="112" font-weight="700" fill="#0f172a" letter-spacing="-1">${tspans}</text>
  <text x="80" y="570" font-family="'Inter','Helvetica Neue',Arial,sans-serif" font-size="22" font-weight="500" fill="#64748b">Offerte · brandocean.nl</text>
</svg>`;
}

http.route({
	pathPrefix: "/og/o/",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const slug = decodeURIComponent(
			url.pathname.replace(/^\/og\/o\//, "").replace(/\/$/, ""),
		);
		let title = "Offerte";
		try {
			const data = await ctx.runQuery(api.offertes.getBySlug, { slug });
			if (data?.offerte?.title) title = data.offerte.title;
		} catch {
			// fall through with default
		}
		return new Response(renderOgSvg(title), {
			status: 200,
			headers: {
				"Content-Type": "image/svg+xml; charset=utf-8",
				"Cache-Control": "public, max-age=300, s-maxage=600",
				"Access-Control-Allow-Origin": "*",
			},
		});
	}),
});

export default http;
