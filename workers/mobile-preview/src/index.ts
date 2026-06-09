// Dedicated, isolated Worker for the live interactive mobile preview.
//
// It does ONE thing: on `GET /preview` (WebSocket upgrade) it verifies a
// short-lived HMAC token minted by Convex (snapshots.startLivePreview), then
// streams a live Cloudflare mobile browser to the dashboard canvas via the CDP
// relay. No iframe, and fully separate from the main app Worker.
//
// A Durable Object holds each session: plain Workers aren't guaranteed to stay
// alive for a multi-minute WebSocket, DOs are.

import { relayMobilePreview } from "./relay";

interface Env {
	CLOUDFLARE_ACCOUNT_ID: string;
	CLOUDFLARE_BROWSER_API_TOKEN: string;
	PREVIEW_TOKEN_SECRET: string;
	PREVIEW: DurableObjectNamespace;
}

interface PreviewPayload {
	url: string;
	w: number;
	h: number;
	dsf: number;
	exp: number;
}

const B64URL =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const REV: Record<string, number> = {};
for (let i = 0; i < B64URL.length; i++) REV[B64URL[i]] = i;

function base64urlToBytes(s: string): Uint8Array {
	const out: number[] = [];
	let acc = 0;
	let bits = 0;
	for (const ch of s) {
		const v = REV[ch];
		if (v === undefined) continue;
		acc = (acc << 6) | v;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			out.push((acc >> bits) & 0xff);
		}
	}
	return new Uint8Array(out);
}

function toHex(bytes: Uint8Array): string {
	let s = "";
	for (let i = 0; i < bytes.length; i++) {
		s += bytes[i].toString(16).padStart(2, "0");
	}
	return s;
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

// Verify the `body.hexHmac` token exactly as Convex signed it, then decode +
// expiry-check the payload. Returns null on any mismatch.
async function verifyToken(
	token: string,
	secret: string,
): Promise<PreviewPayload | null> {
	const dot = token.indexOf(".");
	if (dot < 0) return null;
	const body = token.slice(0, dot);
	const sig = token.slice(dot + 1);
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign("HMAC", key, enc.encode(body));
	if (!timingSafeEqual(toHex(new Uint8Array(mac)), sig)) return null;
	let payload: PreviewPayload;
	try {
		payload = JSON.parse(
			new TextDecoder().decode(base64urlToBytes(body)),
		) as PreviewPayload;
	} catch {
		return null;
	}
	if (typeof payload.url !== "string" || typeof payload.exp !== "number") {
		return null;
	}
	if (payload.exp < Date.now()) return null;
	return payload;
}

export class PreviewSession {
	private env: Env;
	constructor(_state: DurableObjectState, env: Env) {
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
			return new Response("expected websocket", { status: 426 });
		}
		const url = new URL(request.url);
		const token = url.searchParams.get("token");
		const payload = token
			? await verifyToken(token, this.env.PREVIEW_TOKEN_SECRET)
			: null;
		if (!payload) {
			return new Response("invalid or expired token", { status: 403 });
		}

		const pair = new WebSocketPair();
		const client = pair[0];
		const server = pair[1];
		server.accept();
		// Fire-and-forget: the DO stays alive while the accepted socket is open.
		relayMobilePreview(server, {
			accountId: this.env.CLOUDFLARE_ACCOUNT_ID,
			apiToken: this.env.CLOUDFLARE_BROWSER_API_TOKEN,
			url: payload.url,
			viewport: {
				width: payload.w,
				height: payload.h,
				deviceScaleFactor: payload.dsf,
				userAgent: "",
			},
		});
		return new Response(null, { status: 101, webSocket: client });
	}
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname !== "/preview") {
			return new Response("not found", { status: 404 });
		}
		// One fresh DO per connection; it owns the browser session lifecycle.
		const stub = env.PREVIEW.get(env.PREVIEW.newUniqueId());
		return stub.fetch(request);
	},
};
