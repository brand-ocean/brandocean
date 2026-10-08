import { useMutation, useQuery } from "convex/react";
import {
	CameraIcon,
	CircleStopIcon,
	InfoIcon,
	MicIcon,
	MicOffIcon,
	PictureInPicture2Icon,
	RadioIcon,
	XIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
	Frame,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { TonePill } from "@/components/app/tone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "~convex/_generated/api";
import type { Doc } from "~convex/_generated/dataModel";
import { clock, NUDGE_META, speakerLabel } from "./format";
import { recorder } from "./lib/recorder";
import {
	AgendaTimer,
	ListenDots,
	NudgeStack,
	TalkBar,
	useRecorder,
	WhoIsWho,
} from "./parts";
import { openCoachWindow, pipSupported } from "./pip";

type Session = Doc<"coachSessions">;

/** De pagina tijdens het gesprek: alles, voor als je toch even kijkt. */
export function LiveView({ session }: { session: Session }) {
	const mine = useRecorder(
		(s) => s.sessionId === session._id && s.phase !== "idle",
	);
	const phase = useRecorder((s) => s.phase);
	const recNow = useRecorder((s) => s.now);
	const state = useQuery(api.coach.sessions.live, { sessionId: session._id });
	const nudges = useQuery(api.coach.sessions.nudges, {
		sessionId: session._id,
	});
	const dismiss = useMutation(api.coach.sessions.dismissNudge);
	const setItem = useMutation(api.coach.sessions.setAgendaItem);
	const now = mine && recNow ? recNow : Date.now();

	return (
		<>
			<Frame>
				<FrameHeader>
					<FrameHeading>
						<FrameTitle className="flex items-center gap-2">
							{mine ? (
								<span className="relative flex size-2">
									<span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60" />
									<span className="relative size-2 rounded-full bg-emerald-500" />
								</span>
							) : null}
							{session.title}
						</FrameTitle>
						<FrameDescription>
							{[session.clientName, session.goal].filter(Boolean).join(" · ") ||
								"Geen doel opgegeven: de coach leidt het af uit het gesprek."}
						</FrameDescription>
					</FrameHeading>
					{mine ? <Controls session={session} /> : null}
				</FrameHeader>
				{mine ? (
					<Notices live={session.mode === "live"} />
				) : (
					<Detached session={session} />
				)}
			</Frame>

			{/* Telefoon/tablet: tips, dan agenda en spreektijd, dan het transcript. */}
			<div className="grid items-start gap-4.5 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div className="flex min-w-0 flex-col gap-4.5 lg:col-start-1 lg:row-start-1">
					<Frame>
						<FramePanel className="p-4">
							<NudgeStack
								nudges={nudges ?? []}
								now={now}
								onDismiss={(nudgeId) => void dismiss({ nudgeId })}
								idle={
									state?.nextQuestion ? (
										<div className="max-w-xl">
											<p className="text-muted-foreground mb-1 text-[0.6875rem] font-medium tracking-wide uppercase">
												Volgende vraag
											</p>
											<p className="text-foreground text-lg leading-snug">
												{state.nextQuestion}
											</p>
										</div>
									) : (
										<span className="text-sm">
											Luistert mee. Tips verschijnen vanzelf, alleen als ze iets
											toevoegen.
										</span>
									)
								}
							/>
							{state ? (
								<div className="mt-3 empty:hidden">
									<WhoIsWho session={session} state={state} />
								</div>
							) : null}
						</FramePanel>
					</Frame>
				</div>

				<div className="flex min-w-0 flex-col gap-4.5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
					{state ? (
						<>
							<Frame>
								<FramePanel className="flex flex-col gap-4 p-4">
									<AgendaTimer
										session={session}
										state={state}
										now={now}
										onPick={(index) =>
											void setItem({ sessionId: session._id, index })
										}
									/>
									<TalkBar session={session} state={state} />
								</FramePanel>
							</Frame>
							<Standing state={state} />
							<History nudges={nudges ?? []} session={session} now={now} />
							<Shots session={session} />
						</>
					) : null}
				</div>

				<div className="min-w-0 lg:col-start-1 lg:row-start-2">
					<Transcript session={session} live={mine} />
				</div>
			</div>

			{phase === "stopping" && mine ? (
				<div className="bg-background/70 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-300">
					<div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 shadow-lg">
						<RadioIcon className="size-4 animate-pulse" />
						<span className="text-sm">
							Laatste woorden uitschrijven en opslaan…
						</span>
					</div>
				</div>
			) : null}
		</>
	);
}

function Controls({ session }: { session: Session }) {
	const pipOpen = useRecorder((s) => s.pipOpen);
	const shooting = useRecorder((s) => s.shooting);
	const sharing = useRecorder((s) => s.sharing);
	const micOn = useRecorder((s) => s.micOn);
	const kind = useRecorder((s) => s.kind);
	const supported = pipSupported();
	return (
		<div className="flex flex-wrap items-center gap-2">
			<ListenDots />
			{kind ? (
				<TonePill tone="muted" size="sm">
					{session.mode === "live" ? "live · " : ""}
					{kind === "speechmatics" ? "realtime" : "gateway"}
				</TonePill>
			) : null}
			<Button
				size="icon-sm"
				variant="ghost"
				title={micOn ? "Microfoon uit" : "Microfoon aan"}
				onClick={() => void recorder.toggleMic()}
			>
				{micOn ? <MicIcon /> : <MicOffIcon />}
			</Button>
			{sharing ? (
				<Button
					size="icon-sm"
					variant="ghost"
					title="Screenshot (Alt+S)"
					disabled={shooting}
					onClick={() => void recorder.takeShot()}
				>
					<CameraIcon />
				</Button>
			) : null}
			{supported && !pipOpen ? (
				<Button
					size="sm"
					className="relative"
					onClick={() =>
						void openCoachWindow(session._id).catch((err: Error) =>
							toast.error("Zwevend venster openen lukte niet", {
								description: err.message,
							}),
						)
					}
				>
					<span className="absolute -inset-0.5 animate-pulse rounded-[inherit] ring-2 ring-primary/30" />
					<PictureInPicture2Icon />
					Zwevend venster
				</Button>
			) : null}
			<Button
				size="sm"
				variant="destructive"
				onClick={() => void recorder.stop()}
			>
				<CircleStopIcon />
				Stop
			</Button>
		</div>
	);
}

function Notices({ live }: { live: boolean }) {
	const warning = useRecorder((s) => s.warning);
	const hint = useRecorder((s) => s.hint);
	const error = useRecorder((s) => s.error);
	const pipOpen = useRecorder((s) => s.pipOpen);
	const items: {
		key: string;
		tone: "warn" | "info" | "error";
		text: string;
		close?: () => void;
	}[] = [];
	if (error) items.push({ key: "e", tone: "error", text: error });
	if (warning)
		items.push({
			key: "w",
			tone: "warn",
			text: warning,
			close: recorder.dismissWarning,
		});
	if (hint) items.push({ key: "h", tone: "info", text: hint });
	if (!pipOpen && pipSupported()) {
		items.push({
			key: "p",
			tone: "info",
			text: live
				? "Open het zwevende venster: groot en rustig in beeld, ook als je iets anders open hebt."
				: "Open het zwevende venster en ga dan naar Meet. Daar zie je de tips zonder van tabblad te wisselen.",
		});
	} else if (!pipSupported() && !live) {
		items.push({
			key: "p",
			tone: "info",
			text: "Deze browser kent geen zwevend venster. Zet dit tabblad naast Meet, of gebruik Chrome.",
		});
	}
	if (items.length === 0) return null;
	return (
		<div className="flex flex-col gap-1.5 px-4 pb-3">
			{items.map((n) => (
				<div
					key={n.key}
					className={cn(
						"flex items-start gap-2 rounded-lg border px-3 py-2 text-sm animate-in fade-in duration-300",
						n.tone === "error" &&
							"border-destructive/30 bg-destructive/10 text-destructive",
						n.tone === "warn" && "border-amber-500/30 bg-amber-500/10",
						n.tone === "info" && "bg-background text-muted-foreground",
					)}
				>
					<InfoIcon className="mt-0.5 size-4 shrink-0" />
					<span className="flex-1">{n.text}</span>
					{n.close ? (
						<button
							type="button"
							onClick={n.close}
							aria-label="Sluiten"
							className="text-muted-foreground hover:text-foreground"
						>
							<XIcon className="size-4" />
						</button>
					) : null}
				</div>
			))}
		</div>
	);
}

/** Het gesprek staat nog open, maar deze tab luistert niet (herladen?). */
function Detached({ session }: { session: Session }) {
	const stop = useMutation(api.coach.sessions.stop);
	const phase = useRecorder((s) => s.phase);
	const busy = phase === "starting";
	return (
		<div className="flex flex-col gap-3 px-4 pb-4 sm:flex-row sm:items-center">
			<p className="text-muted-foreground flex-1 text-sm">
				Dit gesprek staat nog open, maar deze pagina luistert niet mee (herladen
				of in een andere tab gestart).
			</p>
			<div className="flex gap-2">
				<Button
					size="sm"
					variant="outline"
					disabled={busy || phase === "live"}
					onClick={() =>
						void recorder
							.start(
								{ title: session.title, agenda: [], mode: session.mode },
								true,
								session._id,
							)
							.catch(() => {})
					}
				>
					<RadioIcon />
					Opnieuw verbinden
				</Button>
				<Button
					size="sm"
					variant="destructive"
					onClick={() => void stop({ sessionId: session._id })}
				>
					<CircleStopIcon />
					Afsluiten en verslag maken
				</Button>
			</div>
		</div>
	);
}

/** Transcript dat meeschuift zolang je onderaan staat. */
function Transcript({ session, live }: { session: Session; live: boolean }) {
	const chunks = useQuery(api.coach.sessions.chunks, {
		sessionId: session._id,
		recent: 200,
	});
	const interim = useRecorder((s) => s.interim);
	const rename = useMutation(api.coach.sessions.renameSpeaker);
	// Zonder effect: elke render opnieuw aangeroepen, en alleen naar beneden
	// als je al (bijna) onderaan stond.
	const follow = (el: HTMLDivElement | null) => {
		if (!el) return;
		const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
		if (nearBottom) el.scrollTop = el.scrollHeight;
	};
	const renameSpeaker = (label: string, current: string) => {
		const name = window.prompt(`Naam voor ${current}`, current);
		if (name === null) return;
		void rename({ sessionId: session._id, label, name });
	};
	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Transcript</FrameTitle>
					<FrameDescription>
						Klik op een spreker om een naam te geven.
					</FrameDescription>
				</FrameHeading>
			</FrameHeader>
			<FramePanel flush>
				<div
					ref={follow}
					className="flex h-[26rem] flex-col gap-2.5 overflow-y-auto p-4"
				>
					{(chunks ?? []).length === 0 && !interim.mic && !interim.tab ? (
						<p className="text-muted-foreground m-auto text-sm">
							Nog niets gehoord. Zodra er gepraat wordt, verschijnt het hier.
						</p>
					) : null}
					{(chunks ?? []).map((c) => {
						const name = speakerLabel(session, c);
						return (
							<div
								key={c._id}
								className={cn(
									"flex gap-3 text-sm animate-in fade-in duration-300",
									c.isMine && "flex-row-reverse text-right",
								)}
							>
								<span className="text-muted-foreground w-10 shrink-0 pt-0.5 text-[0.6875rem] tabular-nums">
									{clock(c.at - session.startedAt)}
								</span>
								<div
									className={cn(
										"max-w-[85%] rounded-xl px-3 py-2",
										c.isMine ? "bg-primary/8" : "bg-muted/60",
									)}
								>
									{c.isMine ? null : (
										<button
											type="button"
											onClick={() =>
												c.speaker && renameSpeaker(c.speaker, name)
											}
											className="text-muted-foreground hover:text-foreground mb-0.5 block text-xs font-medium"
										>
											{name}
										</button>
									)}
									<p className="leading-relaxed">{c.text}</p>
								</div>
							</div>
						);
					})}
					{live
						? (["tab", "mic"] as const).map((source) =>
								interim[source] ? (
									<p
										key={source}
										className={cn(
											"text-muted-foreground px-13 text-sm italic",
											source === "mic" && "text-right",
										)}
									>
										{interim[source]}
									</p>
								) : null,
							)
						: null}
				</div>
			</FramePanel>
		</Frame>
	);
}

function Standing({ state }: { state: Doc<"coachState"> }) {
	const blocks: { title: string; items: string[] }[] = [
		{ title: "Stand", items: state.summary },
		{ title: "Besluiten", items: state.decisions },
		{
			title: "Acties",
			items: state.actionItems.map(
				(a) => `${a.owner}: ${a.what}${a.when ? ` (${a.when})` : ""}`,
			),
		},
		{ title: "Open vragen", items: state.openQuestions },
	].filter((b) => b.items.length > 0);
	if (blocks.length === 0) {
		return (
			<p className="text-muted-foreground px-1 text-xs">
				Samenvatting, besluiten en acties verschijnen na een paar minuten.
			</p>
		);
	}
	return (
		<Frame>
			<FramePanel className="flex flex-col gap-4 p-4">
				{blocks.map((b) => (
					<div key={b.title} className="animate-in fade-in duration-500">
						<p className="text-muted-foreground mb-1.5 text-[0.6875rem] font-medium tracking-wide uppercase">
							{b.title}
						</p>
						<ul className="flex flex-col gap-1 text-sm leading-snug">
							{b.items.map((item) => (
								<li key={item} className="flex gap-2">
									<span className="text-muted-foreground">•</span>
									<span>{item}</span>
								</li>
							))}
						</ul>
					</div>
				))}
			</FramePanel>
		</Frame>
	);
}

function History({
	nudges,
	session,
	now,
}: {
	nudges: readonly Doc<"coachNudges">[];
	session: Session;
	now: number;
}) {
	const past = nudges
		.filter((n) => n.dismissedAt || n.expiresAt <= now)
		.slice(0, 12);
	if (past.length === 0) return null;
	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Eerdere tips</FrameTitle>
				</FrameHeading>
			</FrameHeader>
			<FramePanel className="flex flex-col gap-2.5 p-4">
				{past.map((n) => {
					const meta = NUDGE_META[n.type];
					const Icon = meta.icon;
					return (
						<div key={n._id} className="flex gap-2 text-sm">
							<Icon className={cn("mt-0.5 size-3.5 shrink-0", meta.accent)} />
							<div className="min-w-0">
								<p className="leading-snug">{n.text}</p>
								{n.detail ? (
									<p className="text-muted-foreground text-xs leading-snug">
										{n.detail}
									</p>
								) : null}
							</div>
							<span className="text-muted-foreground ml-auto shrink-0 text-[0.6875rem] tabular-nums">
								{clock(n.at - session.startedAt)}
							</span>
						</div>
					);
				})}
			</FramePanel>
		</Frame>
	);
}

export function Shots({
	session,
	limit = 6,
}: {
	session: Session;
	limit?: number;
}) {
	const shots = useQuery(api.coach.sessions.shots, { sessionId: session._id });
	if (!shots || shots.length === 0) return null;
	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Scherm</FrameTitle>
					<FrameDescription>
						Automatisch bij een nieuw scherm. Alt+S voor een eigen.
					</FrameDescription>
				</FrameHeading>
			</FrameHeader>
			<FramePanel className="flex flex-col gap-3 p-4">
				{shots.slice(0, limit).map((s) => (
					<div
						key={s._id}
						className="flex flex-col gap-1.5 animate-in fade-in duration-500"
					>
						{s.url ? (
							<a href={s.url} target="_blank" rel="noreferrer">
								<img
									src={s.url}
									alt={s.description ?? "Screenshot"}
									className="w-full rounded-lg border"
									loading="lazy"
								/>
							</a>
						) : null}
						<p className="text-muted-foreground text-xs leading-snug">
							<span className="tabular-nums">
								{clock(s.at - session.startedAt)}
							</span>
							{" · "}
							{s.status === "pending"
								? "wordt bekeken…"
								: s.status === "error"
									? "beschrijven mislukt"
									: s.description}
						</p>
					</div>
				))}
			</FramePanel>
		</Frame>
	);
}
