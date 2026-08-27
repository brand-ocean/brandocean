import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// --- Visual website-feedback: cross-origin extension/share API -------------
//
// These endpoints run on the client's Shopify domain (the review extension)
// or the public share board, so they cannot use Convex Auth. They are gated by an
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

function fbStrArr(value: Json): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const out: string[] = [];
	for (const item of value) if (typeof item === "string") out.push(item);
	return out.length ? out : undefined;
}

// Parse the optional rich element-context blob the widget sends. This does
// type-correctness only; feedback.sanitizeElementContext does the clamping and
// array-capping. Returns undefined when absent, so older widgets keep working.
function fbElementContext(body: JsonObject):
	| {
			text?: string;
			tag?: string;
			id?: string;
			classes?: string[];
			attributes?: Array<{ name: string; value: string }>;
			styles?: {
				fontFamily?: string;
				fontSize?: string;
				fontWeight?: string;
				color?: string;
				lineHeight?: string;
				letterSpacing?: string;
				textTransform?: string;
				display?: string;
			};
			componentPath?: string[];
			source?: { fileName: string; lineNumber: number; columnNumber?: number };
			landmark?: { selector?: string; heading?: string };
	  }
	| undefined {
	const raw = body.elementContext;
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
	const ec: JsonObject = raw;
	const optStr = (o: JsonObject, k: string): string | undefined => {
		const value = o[k];
		return typeof value === "string" ? value : undefined;
	};

	let attributes: Array<{ name: string; value: string }> | undefined;
	if (Array.isArray(ec.attributes)) {
		const list: Array<{ name: string; value: string }> = [];
		for (const item of ec.attributes) {
			if (item && typeof item === "object" && !Array.isArray(item)) {
				const a: JsonObject = item;
				if (typeof a.name === "string" && typeof a.value === "string") {
					list.push({ name: a.name, value: a.value });
				}
			}
		}
		if (list.length) attributes = list;
	}

	let styles:
		| {
				fontFamily?: string;
				fontSize?: string;
				fontWeight?: string;
				color?: string;
				lineHeight?: string;
				letterSpacing?: string;
				textTransform?: string;
				display?: string;
		  }
		| undefined;
	if (ec.styles && typeof ec.styles === "object" && !Array.isArray(ec.styles)) {
		const s: JsonObject = ec.styles;
		styles = {
			fontFamily: optStr(s, "fontFamily"),
			fontSize: optStr(s, "fontSize"),
			fontWeight: optStr(s, "fontWeight"),
			color: optStr(s, "color"),
			lineHeight: optStr(s, "lineHeight"),
			letterSpacing: optStr(s, "letterSpacing"),
			textTransform: optStr(s, "textTransform"),
			display: optStr(s, "display"),
		};
	}

	let source:
		| { fileName: string; lineNumber: number; columnNumber?: number }
		| undefined;
	if (ec.source && typeof ec.source === "object" && !Array.isArray(ec.source)) {
		const sc: JsonObject = ec.source;
		if (typeof sc.fileName === "string" && typeof sc.lineNumber === "number") {
			source = {
				fileName: sc.fileName,
				lineNumber: sc.lineNumber,
				columnNumber:
					typeof sc.columnNumber === "number" ? sc.columnNumber : undefined,
			};
		}
	}

	let landmark: { selector?: string; heading?: string } | undefined;
	if (
		ec.landmark &&
		typeof ec.landmark === "object" &&
		!Array.isArray(ec.landmark)
	) {
		const lm: JsonObject = ec.landmark;
		landmark = {
			selector: optStr(lm, "selector"),
			heading: optStr(lm, "heading"),
		};
	}

	return {
		text: optStr(ec, "text"),
		tag: optStr(ec, "tag"),
		id: optStr(ec, "id"),
		classes: fbStrArr(ec.classes),
		attributes,
		styles,
		componentPath: fbStrArr(ec.componentPath),
		source,
		landmark,
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
	"/feedback/edit",
	"/feedback/delete",
	"/feedback/screenshot-upload-url",
	"/feedback/resolve-host",
	"/feedback/projects",
]) {
	http.route({ path, method: "OPTIONS", handler: fbPreflight });
}

// Owner's project list (name + token per project) so the review extension can
// auto-detect which project a localhost dev server belongs to. Requires a
// valid widget token — see feedback.listProjectsForToken for the trust model.
http.route({
	path: "/feedback/projects",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const origin = request.headers.get("Origin");
		const url = new URL(request.url);
		const token = fbToken(request, url);
		if (!token) return fbJson({ error: "missing_token" }, 401, origin);
		const result = await ctx.runQuery(internal.feedback.listProjectsForToken, {
			token,
		});
		if (!result) return fbJson({ error: "forbidden" }, 403, origin);
		return fbJson(result, 200, origin);
	}),
});

// Map a framed host → its project (token + name) so the review extension loads
// the right project automatically. No token required (host is the lookup key);
// returns 404 when no project is registered for that host.
http.route({
	path: "/feedback/resolve-host",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const origin = request.headers.get("Origin");
		const url = new URL(request.url);
		const host = url.searchParams.get("host");
		if (!host) return fbJson({ error: "missing_host" }, 400, origin);
		const result = await ctx.runQuery(internal.feedback.resolveHost, { host });
		if (!result) return fbJson({ error: "not_found" }, 404, origin);
		return fbJson(result, 200, origin);
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
					device:
						body.device === "mobile" ||
						body.device === "tablet" ||
						body.device === "desktop"
							? body.device
							: undefined,
					metadata: fbMetadata(body),
					screenshotStorageId:
						typeof screenshotRaw === "string"
							? (screenshotRaw as Id<"_storage">)
							: undefined,
					elementContext: fbElementContext(body),
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
	path: "/feedback/edit",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const origin = request.headers.get("Origin");
		const url = new URL(request.url);
		const token = fbToken(request, url);
		if (!token) return fbJson({ error: "missing_token" }, 401, origin);
		const body = await fbReadJson(request);
		if (!body) return fbJson({ error: "bad_body" }, 400, origin);
		try {
			const editImageRaw = body.imageStorageId;
			await ctx.runMutation(internal.feedback.editCommentFromToken, {
				token,
				commentId: fbStr(body, "commentId") as Id<"comments">,
				content: fbStr(body, "content"),
				imageStorageId:
					typeof editImageRaw === "string"
						? (editImageRaw as Id<"_storage">)
						: undefined,
				removeImage: body.removeImage === true,
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

// --- Usage billing webhooks -------------------------------------------------

// Convex log stream sink. The stream is created per client deployment with the
// URL /billing/convex-usage?deployment=<name>&secret=<...>, so every request
// carries one deployment's batch of usage events. Gated by a shared secret.
http.route({
	path: "/billing/convex-usage",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const url = new URL(request.url);
		const secret = url.searchParams.get("secret");
		const deployment = url.searchParams.get("deployment");
		const expected = process.env.BILLING_WEBHOOK_SECRET;
		if (!expected || secret !== expected) {
			return new Response("forbidden", { status: 403 });
		}
		if (!deployment) return new Response("missing_deployment", { status: 400 });

		const text = await request.text();
		if (text.length > 4 * 1024 * 1024) {
			return new Response("too_large", { status: 413 });
		}
		let events: unknown[];
		try {
			const parsed: Json = JSON.parse(text);
			if (Array.isArray(parsed)) {
				events = parsed;
			} else if (
				parsed &&
				typeof parsed === "object" &&
				Array.isArray((parsed as JsonObject).events)
			) {
				events = (parsed as { events: Json[] }).events;
			} else {
				events = [parsed];
			}
		} catch {
			return new Response("bad_json", { status: 400 });
		}

		await ctx.runAction(internal.billing.convexUsage.ingestConvexEvents, {
			deployment,
			events,
			receivedAt: Date.now(),
		});
		return new Response("ok", { status: 200 });
	}),
});

// Stripe webhook. The signature is verified inside the action against the raw
// body + STRIPE_WEBHOOK_SECRET, so the body must be passed through untouched.
http.route({
	path: "/billing/stripe-webhook",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const signature = request.headers.get("stripe-signature");
		if (!signature) return new Response("missing_signature", { status: 400 });
		const payload = await request.text();
		try {
			const result = await ctx.runAction(
				internal.billing.stripe.handleWebhook,
				{ payload, signature },
			);
			if (!result.ok) return new Response("invalid", { status: 400 });
		} catch (e) {
			console.error("stripe webhook error", e);
			// 200 on transient errors so Stripe's retry doesn't wedge; a bad
			// signature returns 400 above.
		}
		return new Response("ok", { status: 200 });
	}),
});

// --- Bellen: tools tijdens het gesprek, en de afronding erna ----------------
//
// Deze endpoints zijn geen normale API. Aan de andere kant zit een agent die
// midden in een telefoongesprek staat, dus ze moeten binnen een seconde
// antwoorden en ze mogen nooit een stacktrace teruggeven — dat leest hij voor.
// Autorisatie is het per-gesprek token: het opent precies één taak en het
// sterft zodra het gesprek eindigt.

const VOICE_MAX_BODY_BYTES = 1024 * 1024;

function voiceSay(text: string, status = 200): Response {
	return new Response(JSON.stringify({ text }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

async function voiceBody(request: Request): Promise<JsonObject> {
	const text = await request.text();
	if (text.length > VOICE_MAX_BODY_BYTES) return {};
	try {
		const parsed: Json = JSON.parse(text);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? parsed
			: {};
	} catch {
		return {};
	}
}

function voiceToken(request: Request, body: JsonObject): string {
	const header = request.headers.get("X-Call-Token");
	if (header) return header;
	const fromBody = body.call_token;
	return typeof fromBody === "string" ? fromBody : "";
}

// De agent vraagt om één gegeven, omdat de medewerker erom vroeg. Alles wat
// niet exact matcht is een "nee" — geen fuzzy matching, want dan geeft hij bij
// "uw rekeningnummer" straks een geboortedatum door.
http.route({
	path: "/voice/fact",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await voiceBody(request);
		const token = voiceToken(request, body);
		const label = typeof body.label === "string" ? body.label : "";
		if (!token || !label) return voiceSay("Dat gegeven heb ik niet.", 200);

		const resolved = await ctx.runQuery(internal.voice.tasks.resolveToken, {
			token,
		});
		if (!resolved) return voiceSay("Dat gegeven heb ik niet.", 200);

		const wanted = label.trim().toLowerCase();
		const fact = resolved.task.facts.find((f) => f.label === wanted);
		if (!fact) {
			return voiceSay(
				"Dat gegeven mag ik niet doorgeven. Vraag of het op een andere manier kan.",
			);
		}
		await ctx.runMutation(internal.voice.tasks.markFactDisclosed, {
			taskId: resolved.task._id,
			label: wanted,
		});
		return voiceSay(fact.value);
	}),
});

// De agent is tegen iets aangelopen waar een mens over moet. We zetten de taak
// op needs_me; het gesprek zelf mag hij netjes afronden.
http.route({
	path: "/voice/handoff",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await voiceBody(request);
		const token = voiceToken(request, body);
		const reason = typeof body.reason === "string" ? body.reason : "onbekend";
		if (!token) return voiceSay("Genoteerd.");

		const resolved = await ctx.runQuery(internal.voice.tasks.resolveToken, {
			token,
		});
		if (!resolved) return voiceSay("Genoteerd.");

		await ctx.runMutation(internal.voice.tasks.recordHandoff, {
			callId: resolved.call._id,
			reason: reason.slice(0, 1000),
		});
		return voiceSay(
			"Genoteerd. Zeg dat je dit even moet overleggen en dat er wordt teruggekoppeld.",
		);
	}),
});

http.route({
	path: "/voice/outcome",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const body = await voiceBody(request);
		const token = voiceToken(request, body);
		const outcome = typeof body.outcome === "string" ? body.outcome : "";
		const resolvedFlag = body.resolved === true;
		if (!token || !outcome) return voiceSay("Genoteerd.");

		const resolved = await ctx.runQuery(internal.voice.tasks.resolveToken, {
			token,
		});
		if (!resolved) return voiceSay("Genoteerd.");

		await ctx.runMutation(internal.voice.tasks.recordOutcome, {
			callId: resolved.call._id,
			outcome: outcome.slice(0, 4000),
			resolved: resolvedFlag,
		});
		return voiceSay("Genoteerd.");
	}),
});

// Post-call webhook van ElevenLabs. Ondertekend met HMAC-SHA256 over
// "<timestamp>.<body>", meegegeven als `t=...,v0=...` in elevenlabs-signature.
// De ruwe body moet dus ongewijzigd de verificatie in.
async function voiceSignatureValid(
	payload: string,
	header: string | null,
	secret: string,
): Promise<boolean> {
	if (!header) return false;
	const parts = header.split(",");
	const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
	const signature = parts.find((p) => p.startsWith("v0="))?.slice(3);
	if (!timestamp || !signature) return false;

	// Replay-venster van een half uur, zoals ElevenLabs zelf aanraadt.
	const age = Date.now() / 1000 - Number(timestamp);
	if (!Number.isFinite(age) || age > 1800 || age < -300) return false;

	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(`${timestamp}.${payload}`),
	);
	const expected = Array.from(new Uint8Array(mac))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	if (expected.length !== signature.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i += 1) {
		diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
	}
	return diff === 0;
}

http.route({
	path: "/voice/webhook",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
		if (!secret) return new Response("not_configured", { status: 503 });

		const payload = await request.text();
		if (payload.length > 4 * 1024 * 1024) {
			return new Response("too_large", { status: 413 });
		}
		const ok = await voiceSignatureValid(
			payload,
			request.headers.get("elevenlabs-signature"),
			secret,
		);
		if (!ok) return new Response("invalid_signature", { status: 401 });

		let parsed: Json;
		try {
			parsed = JSON.parse(payload);
		} catch {
			return new Response("bad_json", { status: 400 });
		}
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return new Response("bad_json", { status: 400 });
		}

		// Alleen het transcript-event draagt het gesprek; audio en
		// initiation-failure laten we bewust liggen.
		if (parsed.type !== "post_call_transcription") {
			return new Response("ok", { status: 200 });
		}
		const data = fbObj(parsed, "data");
		const conversationId = fbStr(data, "conversation_id");
		if (!conversationId) return new Response("ok", { status: 200 });

		const rawTurns = data.transcript;
		const transcript: Array<{
			role: "agent" | "user";
			text: string;
			atSec?: number;
		}> = [];
		if (Array.isArray(rawTurns)) {
			for (const turn of rawTurns) {
				if (!turn || typeof turn !== "object" || Array.isArray(turn)) continue;
				const role = fbStr(turn, "role");
				const text = fbStr(turn, "message");
				if (!text) continue;
				const atSec = fbNum(turn, "time_in_call_secs");
				transcript.push({
					role: role === "user" ? "user" : "agent",
					text,
					atSec,
				});
			}
		}

		const analysis = fbObj(data, "analysis");
		const metadata = fbObj(data, "metadata");
		const summary = fbStr(analysis, "transcript_summary");
		const duration = fbNum(metadata, "call_duration_secs");

		await ctx.runMutation(internal.voice.tasks.finishFromWebhook, {
			conversationId,
			transcript,
			summary: summary || undefined,
			durationSecs: duration || undefined,
		});
		return new Response("ok", { status: 200 });
	}),
});

export default http;
