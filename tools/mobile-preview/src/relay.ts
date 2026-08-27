// Remote interactive mobile preview — the relay core (runs in the preview
// Worker, typed with @cloudflare/workers-types).
//
// Bridges the dashboard WebSocket <-> Cloudflare Browser Rendering's CDP
// WebSocket so a reviewer can see and TAP a live mobile render of the store on
// a canvas — no iframe anywhere.
//
// Wire protocol (JSON text frames):
//   worker -> client : {t:"ready"} | {t:"frame",data:<base64 jpeg>}
//                      | {t:"error",message} | {t:"closed"}
//   client -> worker : {t:"touch",phase:"start"|"move"|"end",x,y}
//                      | {t:"scroll",x,y,dy} | {t:"key",text}
//                      | {t:"nav",url} | {t:"close"}
// Client x/y are CSS pixels in the device viewport (0..width, 0..height).

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

interface CdpMessage {
	id?: number;
	method?: string;
	sessionId?: string;
	params?: { [key: string]: Json };
	result?: { [key: string]: Json };
	error?: { message: string };
}

export interface PreviewViewport {
	width: number;
	height: number;
	deviceScaleFactor: number;
	userAgent: string;
}

export interface RelayOptions {
	accountId: string;
	apiToken: string;
	url: string;
	viewport: PreviewViewport;
	/** Screencast JPEG quality, 0–100. Lower = smoother stream. */
	quality?: number;
}

interface ClientInput {
	t: "touch" | "scroll" | "key" | "nav" | "close";
	phase?: "start" | "move" | "end";
	x?: number;
	y?: number;
	dy?: number;
	text?: string;
	url?: string;
}

const DEFAULT_IPHONE_UA =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
	"AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function asString(value: Json | undefined): string | null {
	return typeof value === "string" ? value : null;
}

/**
 * Drive a single live mobile-preview session. `client` is the already-accepted
 * server side of the dashboard WebSocket.
 */
export async function relayMobilePreview(
	client: WebSocket,
	opts: RelayOptions,
): Promise<void> {
	const vp = opts.viewport;
	const cdpUrl =
		`wss://api.cloudflare.com/client/v4/accounts/${opts.accountId}` +
		`/browser-rendering/devtools/browser?keep_alive=600000`;

	// Workers open an outbound WebSocket via a fetch Upgrade; the bearer token
	// rides on the request headers and never reaches the browser client.
	const resp = await fetch(cdpUrl, {
		headers: { Upgrade: "websocket", Authorization: `Bearer ${opts.apiToken}` },
	});
	const cdp = resp.webSocket;
	if (!cdp) {
		client.send(JSON.stringify({ t: "error", message: "cdp_upgrade_failed" }));
		client.close();
		return;
	}
	cdp.accept();

	let nextId = 1;
	let sessionId: string | null = null; // flatten-mode target session
	let closed = false;

	const send = (method: string, params: { [key: string]: Json } = {}) => {
		const msg: CdpMessage = { id: nextId++, method, params };
		if (sessionId) msg.sessionId = sessionId;
		cdp.send(JSON.stringify(msg));
	};

	const shutdown = (reason: string) => {
		if (closed) return;
		closed = true;
		try {
			client.send(JSON.stringify({ t: "closed", reason }));
		} catch {
			/* client already gone */
		}
		try {
			cdp.close();
		} catch {
			/* cdp already gone */
		}
		try {
			client.close();
		} catch {
			/* already closing */
		}
	};

	// 1) create a blank target, 2) attach (flatten) for a page session, then
	// emulate mobile, navigate, and start the screencast.
	cdp.send(
		JSON.stringify({
			id: nextId++,
			method: "Target.createTarget",
			params: { url: "about:blank" },
		}),
	);

	cdp.addEventListener("message", (event: MessageEvent) => {
		const raw = typeof event.data === "string" ? event.data : "";
		if (!raw) return;
		const msg = JSON.parse(raw) as CdpMessage;

		const targetId = asString(msg.result?.targetId);
		if (targetId && !sessionId) {
			cdp.send(
				JSON.stringify({
					id: nextId++,
					method: "Target.attachToTarget",
					params: { targetId, flatten: true },
				}),
			);
			return;
		}

		const attached = asString(msg.result?.sessionId);
		if (attached && !sessionId) {
			sessionId = attached;
			send("Page.enable");
			send("Emulation.setDeviceMetricsOverride", {
				width: vp.width,
				height: vp.height,
				deviceScaleFactor: vp.deviceScaleFactor,
				mobile: true,
			});
			send("Emulation.setTouchEmulationEnabled", {
				enabled: true,
				maxTouchPoints: 1,
			});
			send("Emulation.setUserAgentOverride", {
				userAgent: vp.userAgent || DEFAULT_IPHONE_UA,
			});
			send("Page.navigate", { url: opts.url });
			send("Page.startScreencast", {
				format: "jpeg",
				quality: opts.quality ?? 55,
				maxWidth: vp.width,
				maxHeight: vp.height,
				everyNthFrame: 1,
			});
			client.send(JSON.stringify({ t: "ready" }));
			return;
		}

		if (msg.method === "Page.screencastFrame") {
			const data = asString(msg.params?.data);
			const ackId = msg.params?.sessionId;
			if (data) client.send(JSON.stringify({ t: "frame", data }));
			if (typeof ackId === "number") {
				send("Page.screencastFrameAck", { sessionId: ackId });
			}
			return;
		}

		if (
			msg.method === "Inspector.detached" ||
			msg.method === "Target.detachedFromTarget"
		) {
			shutdown("detached");
		}
	});

	cdp.addEventListener("close", () => shutdown("cdp_closed"));
	cdp.addEventListener("error", () => shutdown("cdp_error"));

	// --- Dashboard -> browser input ----------------------------------------
	client.addEventListener("message", (event: MessageEvent) => {
		const raw = typeof event.data === "string" ? event.data : "";
		if (!raw || !sessionId) return;
		const m = JSON.parse(raw) as ClientInput;

		if (m.t === "close") {
			shutdown("client_close");
			return;
		}
		if (m.t === "nav" && typeof m.url === "string") {
			send("Page.navigate", { url: m.url });
			return;
		}
		const x = typeof m.x === "number" ? m.x : 0;
		const y = typeof m.y === "number" ? m.y : 0;
		if (m.t === "touch") {
			const type =
				m.phase === "start"
					? "touchStart"
					: m.phase === "move"
						? "touchMove"
						: "touchEnd";
			send("Input.dispatchTouchEvent", {
				type,
				touchPoints: type === "touchEnd" ? [] : [{ x, y }],
			});
			return;
		}
		if (m.t === "scroll") {
			send("Input.dispatchMouseEvent", {
				type: "mouseWheel",
				x,
				y,
				deltaX: 0,
				deltaY: typeof m.dy === "number" ? m.dy : 0,
			});
			return;
		}
		if (m.t === "key" && typeof m.text === "string") {
			send("Input.insertText", { text: m.text });
		}
	});

	client.addEventListener("close", () => shutdown("client_closed"));
	client.addEventListener("error", () => shutdown("client_error"));
}
