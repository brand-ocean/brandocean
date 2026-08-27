import { useAction } from "convex/react";
import { Loader2Icon, PlayIcon, SquareIcon } from "lucide-react";
import {
	type PointerEvent,
	useEffect,
	useRef,
	useState,
	type WheelEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

// Live mobile viewport (must match snapshots.startLivePreview's mobile preset).
const VW = 390;
const VH = 844;

type ServerMsg =
	| { t: "ready" }
	| { t: "frame"; data: string }
	| { t: "closed"; reason?: string }
	| { t: "error"; message?: string };

type State = "idle" | "connecting" | "live" | "ended" | "error";

export function LiveMobilePreview({
	projectId,
	path,
}: {
	projectId: Id<"feedbackProjects">;
	path: string;
}) {
	const start = useAction(api.snapshots.startLivePreview);
	const [state, setState] = useState<State>("idle");
	const [err, setErr] = useState<string | null>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const dragging = useRef(false);

	// Tear down the socket on unmount so we never leak a billed browser session.
	useEffect(() => {
		return () => {
			wsRef.current?.close();
			wsRef.current = null;
		};
	}, []);

	const begin = async () => {
		setState("connecting");
		setErr(null);
		try {
			const { wsUrl } = await start({
				projectId,
				pagePath: path,
				device: "mobile",
			});
			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;
			ws.onmessage = (e) => {
				const m = JSON.parse(e.data) as ServerMsg;
				if (m.t === "ready") {
					setState("live");
				} else if (m.t === "frame" && imgRef.current) {
					imgRef.current.src = `data:image/jpeg;base64,${m.data}`;
				} else if (m.t === "closed") {
					setState("ended");
				} else if (m.t === "error") {
					setErr(m.message ?? "stream error");
					setState("error");
				}
			};
			ws.onclose = () => setState((s) => (s === "live" ? "ended" : s));
			ws.onerror = () => {
				setErr("connection failed");
				setState("error");
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : "";
			setErr(
				msg.includes("preview_not_configured")
					? "Live preview isn't configured yet (deploy the preview Worker + secrets)"
					: "Could not start the live session",
			);
			setState("error");
		}
	};

	const stop = () => {
		const ws = wsRef.current;
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ t: "close" }));
		}
		ws?.close();
		wsRef.current = null;
		setState("ended");
	};

	const sendInput = (msg: Record<string, string | number>) => {
		const ws = wsRef.current;
		if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
	};

	// Map a pointer position on the rendered image to device CSS pixels.
	const toDevice = (clientX: number, clientY: number) => {
		const el = imgRef.current;
		if (!el) return { x: 0, y: 0 };
		const r = el.getBoundingClientRect();
		return {
			x: ((clientX - r.left) / r.width) * VW,
			y: ((clientY - r.top) / r.height) * VH,
		};
	};

	const onPointerDown = (e: PointerEvent) => {
		if (state !== "live") return;
		dragging.current = true;
		e.currentTarget.setPointerCapture(e.pointerId);
		const { x, y } = toDevice(e.clientX, e.clientY);
		sendInput({ t: "touch", phase: "start", x, y });
	};
	const onPointerMove = (e: PointerEvent) => {
		if (!dragging.current) return;
		const { x, y } = toDevice(e.clientX, e.clientY);
		sendInput({ t: "touch", phase: "move", x, y });
	};
	const onPointerUp = (e: PointerEvent) => {
		if (!dragging.current) return;
		dragging.current = false;
		const { x, y } = toDevice(e.clientX, e.clientY);
		sendInput({ t: "touch", phase: "end", x, y });
	};
	const onWheel = (e: WheelEvent) => {
		if (state !== "live") return;
		const { x, y } = toDevice(e.clientX, e.clientY);
		sendInput({ t: "scroll", x, y, dy: e.deltaY });
	};

	const live = state === "live";
	return (
		<div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 py-6">
			<div className="flex items-center gap-2">
				{!live && state !== "connecting" && (
					<Button size="sm" onClick={begin}>
						<PlayIcon className="size-4" />
						{state === "ended" ? "Restart" : "Start live preview"}
					</Button>
				)}
				{state === "connecting" && (
					<span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2Icon className="size-4 animate-spin" /> Spinning up a mobile
						browser…
					</span>
				)}
				{live && (
					<Button size="sm" variant="outline" onClick={stop}>
						<SquareIcon className="size-4" /> Stop
					</Button>
				)}
			</div>

			{err && (
				<p className="max-w-sm text-center text-sm text-destructive">{err}</p>
			)}

			{(live || state === "connecting" || state === "ended") && (
				<div
					className="relative overflow-hidden rounded-[2rem] border-4 border-foreground/80 bg-black shadow-xl"
					style={{ width: 280, aspectRatio: `${VW} / ${VH}` }}
				>
					<img
						ref={imgRef}
						alt="Live mobile preview"
						draggable={false}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
						onWheel={onWheel}
						className="h-full w-full touch-none select-none object-cover"
					/>
					{state === "ended" && (
						<div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
							Session ended
						</div>
					)}
				</div>
			)}

			<p className="max-w-sm text-center text-xs text-muted-foreground">
				Live, tappable mobile render of {path} — streamed from a real browser,
				no iframe. Sessions auto-expire after ~10 min.
			</p>
		</div>
	);
}
