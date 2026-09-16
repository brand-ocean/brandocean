import { useCallback, useEffect, useMemo, useRef } from "react";
import { convexSiteUrl } from "@/lib/convex";

/**
 * Gebruik van de kijkversie meten, voor het dashboard "Borden". Anoniem:
 * een willekeurige sleutel per browser (`visitor`) en één per keer openen
 * (`session`). Events gaan gebundeld naar /preview/track op Convex, elke
 * vijf seconden en bij het sluiten van het tabblad (sendBeacon). Geen
 * Convex-client nodig op de pagina, dus geen websocket en niets extra's in
 * de bundel.
 */

export type TrackKind =
	| "open"
	| "step"
	| "view"
	| "search"
	| "fly"
	| "closing"
	| "cta"
	| "leave";

export type TrackData = {
	client?: string;
	title?: string;
	device?: string;
	referrer?: string;
	returning?: boolean;
	step?: number;
	card?: string;
	label?: string;
	ms?: number;
	q?: string;
	cta?: string;
};

type Event = { kind: TrackKind; at: number; data?: TrackData };

const VISITOR_KEY = "bo-preview-visitor";
const SEEN_KEY = "bo-preview-seen";
const FLUSH_MS = 5000;
const ENDPOINT = `${convexSiteUrl}/preview/track`;

function randomKey(): string {
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useTracker(
	slug: string,
	enabled: boolean,
	meta: { client: string; title: string },
) {
	const queue = useRef<Event[]>([]);
	const ids = useRef<{ visitor: string; session: string } | null>(null);
	const slugRef = useRef(slug);
	slugRef.current = slug;

	const send = useCallback((beacon = false) => {
		const batch = queue.current.splice(0, 50);
		if (!batch.length || !ids.current) return;
		const body = JSON.stringify({
			slug: slugRef.current,
			...ids.current,
			events: batch,
		});
		if (beacon && navigator.sendBeacon) {
			navigator.sendBeacon(
				ENDPOINT,
				new Blob([body], { type: "application/json" }),
			);
			return;
		}
		fetch(ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body,
			keepalive: true,
		}).catch(() => {
			// meten mag nooit het bord storen
		});
	}, []);

	const track = useMemo(
		() => (kind: TrackKind, data?: TrackData) => {
			if (!enabled) return;
			queue.current.push({ kind, at: Date.now(), data });
			if (queue.current.length >= 50) send();
		},
		[enabled, send],
	);

	useEffect(() => {
		if (!enabled) return;
		let visitor = "";
		let returning = false;
		try {
			visitor = localStorage.getItem(VISITOR_KEY) ?? "";
			if (!visitor) {
				visitor = randomKey();
				localStorage.setItem(VISITOR_KEY, visitor);
			}
			const seen = localStorage.getItem(SEEN_KEY) ?? "";
			returning = seen.split(",").includes(slug);
			if (!returning) localStorage.setItem(SEEN_KEY, `${seen},${slug}`);
		} catch {
			visitor = randomKey();
		}
		ids.current = { visitor, session: randomKey() };
		const started = Date.now();
		const device =
			window.innerWidth < 720
				? "telefoon"
				: window.innerWidth < 1100
					? "tablet"
					: "desktop";
		let referrer = "";
		try {
			referrer = document.referrer ? new URL(document.referrer).host : "";
		} catch {
			// vreemde referrer: weglaten
		}
		track("open", {
			device,
			referrer,
			returning,
			client: meta.client,
			title: meta.title,
		});

		const timer = window.setInterval(() => send(), FLUSH_MS);
		const leave = () => {
			track("leave", { ms: Date.now() - started });
			send(true);
		};
		const onHide = () => {
			if (document.visibilityState === "hidden") leave();
		};
		document.addEventListener("visibilitychange", onHide);
		window.addEventListener("pagehide", leave);
		return () => {
			window.clearInterval(timer);
			document.removeEventListener("visibilitychange", onHide);
			window.removeEventListener("pagehide", leave);
			send(true);
		};
	}, [enabled, slug, track, send, meta.client, meta.title]);

	return useMemo(() => ({ track, flush: () => send() }), [track, send]);
}
