import { ConvexProvider, useMutation, useQuery } from "convex/react";
import { CameraIcon, CircleStopIcon } from "lucide-react";
import { createRoot } from "react-dom/client";
import { getConvexClient } from "@/lib/convex";
import { cn } from "@/lib/utils";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";
import { AskBox, AskFeed } from "./extras";
import { recorder } from "./lib/recorder";
import {
	AgendaTimer,
	ListenDots,
	NudgeStack,
	TalkBar,
	useRecorder,
	WhoIsWho,
} from "./parts";

// Het zwevende venster (Document Picture-in-Picture, Chrome 116+): een klein
// venster dat boven Meet blijft hangen met de nudge van nu, de klok en de
// spreekverhouding. Hier kijkt Arin tijdens het gesprek; de rest staat op de
// pagina.

type DocumentPip = {
	requestWindow(options: {
		width: number;
		height: number;
		disallowReturnToOpener?: boolean;
	}): Promise<Window>;
};

function documentPip(): DocumentPip | null {
	if (typeof window === "undefined") return null;
	return (
		(window as Window & { documentPictureInPicture?: DocumentPip })
			.documentPictureInPicture ?? null
	);
}

export function pipSupported(): boolean {
	return documentPip() !== null;
}

/** Stijlen van de app overnemen, zodat het venster er hetzelfde uitziet. */
function copyStyles(target: Document) {
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			const css = Array.from(sheet.cssRules)
				.map((r) => r.cssText)
				.join("\n");
			const style = target.createElement("style");
			style.textContent = css;
			target.head.appendChild(style);
		} catch {
			if (sheet.href) {
				const link = target.createElement("link");
				link.rel = "stylesheet";
				link.href = sheet.href;
				target.head.appendChild(link);
			}
		}
	}
	target.documentElement.className = document.documentElement.className;
	target.documentElement.style.cssText = document.documentElement.style.cssText;
}

/** Opent (of focust) het zwevende venster. Moet vanuit een klik komen. */
export async function openCoachWindow(
	sessionId: Id<"coachSessions">,
): Promise<void> {
	const pip = documentPip();
	if (!pip) {
		throw new Error(
			"Deze browser kent geen zwevend venster. Gebruik Chrome (versie 116 of nieuwer).",
		);
	}
	if (recorder.pip) {
		recorder.pip.focus();
		return;
	}
	const win = await pip.requestWindow({ width: 380, height: 520 });
	copyStyles(win.document);
	win.document.title = "Coach";
	win.document.body.className = "bg-background text-foreground antialiased";
	const container = win.document.createElement("div");
	win.document.body.appendChild(container);
	const root = createRoot(container);
	root.render(
		<ConvexProvider client={getConvexClient()}>
			<PipView sessionId={sessionId} />
		</ConvexProvider>,
	);
	win.addEventListener("keydown", (event) => {
		if (event.altKey && event.code === "KeyS") {
			event.preventDefault();
			void recorder.takeShot();
		} else if (event.altKey && event.code === "KeyC") {
			event.preventDefault();
			recorder.coachNow();
		}
	});
	win.addEventListener("pagehide", () => {
		root.unmount();
		recorder.setPip(null);
	});
	recorder.setPip(win);
}

function PipView({ sessionId }: { sessionId: Id<"coachSessions"> }) {
	const data = useQuery(api.coach.sessions.get, { sessionId });
	const state = useQuery(api.coach.sessions.live, { sessionId });
	const nudges = useQuery(api.coach.sessions.nudges, { sessionId });
	const dismiss = useMutation(api.coach.sessions.dismissNudge);
	const now = useRecorder((s) => s.now) || Date.now();
	const phase = useRecorder((s) => s.phase);
	const shooting = useRecorder((s) => s.shooting);
	const sharing = useRecorder((s) => s.sharing);
	const kind = useRecorder((s) => s.kind);
	const pending = useRecorder((s) => s.pending);

	const session = data?.session;
	if (!session || !state) {
		return <p className="text-muted-foreground p-4 text-sm">Laden…</p>;
	}
	return (
		<div className="flex h-svh flex-col gap-3 p-3">
			<div className="flex items-center justify-between gap-2">
				<ListenDots />
				<div className="flex items-center gap-1">
					{kind === "gateway" && pending > 0 ? (
						<span className="text-muted-foreground mr-1 text-[0.625rem]">
							schrijft uit…
						</span>
					) : null}
					{sharing ? (
						<button
							type="button"
							onClick={() => void recorder.takeShot()}
							disabled={shooting}
							title="Screenshot (Alt+S)"
							className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1.5 transition-colors disabled:opacity-40"
						>
							<CameraIcon className="size-4" />
						</button>
					) : null}
					{phase === "live" ? (
						<button
							type="button"
							onClick={() => void recorder.stop()}
							title="Stop en maak het verslag"
							className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md p-1.5 transition-colors"
						>
							<CircleStopIcon className="size-4" />
						</button>
					) : null}
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
				<AskFeed
					session={session}
					limit={1}
					compact
					recentMs={180_000}
					now={now}
				/>
				<NudgeStack
					nudges={nudges ?? []}
					now={now}
					compact
					onDismiss={(nudgeId) => void dismiss({ nudgeId })}
					idle={
						state.nextQuestion ? (
							<span className="text-foreground/80 text-sm leading-snug">
								<span className="text-muted-foreground mb-1 block text-[0.625rem] font-medium tracking-wide uppercase">
									Volgende vraag
								</span>
								{state.nextQuestion}
							</span>
						) : (
							<span>Luistert mee. Tips verschijnen vanzelf.</span>
						)
					}
				/>
				{state.nextQuestion &&
				(nudges ?? []).some((n) => !n.dismissedAt && n.expiresAt > now) ? (
					<p className="text-muted-foreground mt-2 text-xs leading-snug">
						<span className="font-medium">Daarna: </span>
						{state.nextQuestion}
					</p>
				) : null}
			</div>

			<div className={cn("flex flex-col gap-3 border-t pt-3")}>
				<WhoIsWho session={session} state={state} compact />
				<AgendaTimer session={session} state={state} now={now} compact />
				<TalkBar session={session} state={state} compact />
				<AskBox session={session} compact />
			</div>
		</div>
	);
}
