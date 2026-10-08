import { useMutation, useQuery } from "convex/react";
import {
	ArrowDownIcon,
	CameraIcon,
	CircleStopIcon,
	InfoIcon,
	MicIcon,
	MicOffIcon,
	PictureInPicture2Icon,
	RadioIcon,
	XIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "~convex/_generated/api";
import type { Doc } from "~convex/_generated/dataModel";
import { AskBox, AskCard, SessionModelSelect, SpeakerName } from "./extras";
import { activeNudges, clock, NUDGE_META } from "./format";
import { recorder } from "./lib/recorder";
import {
	AgendaTimer,
	ListenDots,
	NudgeCard,
	TalkBar,
	useRecorder,
	WhoIsWho,
} from "./parts";
import { openCoachWindow, pipSupported } from "./pip";

// De livepagina als app-scherm: geen paginascroll, drie kolommen die elk zelf
// scrollen. Links het transcript, midden "Nu" (tips, vraag, antwoorden),
// rechts het overzicht (agenda, spreektijd, stand). Onder 1280px twee
// kolommen met tabs, op een telefoon één kolom met tabs.

type Session = Doc<"coachSessions">;
type State = Doc<"coachState">;
type Chunk = Doc<"coachChunks">;
type Nudge = Doc<"coachNudges">;
type Ask = Doc<"coachAsks">;

export type LiveData = {
	session: Session;
	state: State | null;
	chunks: readonly Chunk[];
	nudges: readonly Nudge[];
	asks: readonly Ask[];
	now: number;
	/** Luistert deze tab mee? */
	attached: boolean;
};

/** Haalt de data op; de layout zelf staat in LiveLayout. */
export function LiveView({ session }: { session: Session }) {
	const attached = useRecorder(
		(s) => s.sessionId === session._id && s.phase !== "idle",
	);
	const recNow = useRecorder((s) => s.now);
	const state = useQuery(api.coach.sessions.live, { sessionId: session._id });
	const nudges = useQuery(api.coach.sessions.nudges, {
		sessionId: session._id,
	});
	const chunks = useQuery(api.coach.sessions.chunks, {
		sessionId: session._id,
		recent: 300,
	});
	const asks = useQuery(api.coach.sessions.asks, { sessionId: session._id });
	return (
		<LiveLayout
			session={session}
			state={state ?? null}
			chunks={chunks ?? []}
			nudges={nudges ?? []}
			asks={asks ?? []}
			now={attached && recNow ? recNow : Date.now()}
			attached={attached}
		/>
	);
}

type Tab = "nu" | "transcript" | "overzicht";

export function LiveLayout(data: LiveData) {
	const [tab, setTab] = useState<Tab>("nu");
	const phase = useRecorder((s) => s.phase);
	return (
		<div className="flex h-[calc(100svh-var(--header-height)-1.125rem)] min-h-[34rem] flex-col gap-3">
			<TopBar {...data} />
			{data.attached ? <Notices live={data.session.mode === "live"} /> : null}

			{/* Tabs onder 1280px; op md zit het transcript altijd links. */}
			<div className="bg-muted/60 flex shrink-0 gap-1 self-start rounded-lg p-1 xl:hidden">
				{(
					[
						["nu", "Nu"],
						["transcript", "Transcript"],
						["overzicht", "Overzicht"],
					] as const
				).map(([id, label]) => (
					<button
						key={id}
						type="button"
						onClick={() => setTab(id)}
						className={cn(
							"rounded-md px-3 py-1 text-sm transition-colors",
							id === "transcript" && "md:hidden",
							tab === id
								? "bg-background font-medium shadow-xs"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{label}
					</button>
				))}
			</div>

			<div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,40fr)_minmax(0,35fr)_minmax(0,25fr)]">
				<Panel
					className={cn(tab === "transcript" ? "flex" : "hidden", "md:flex")}
				>
					<TranscriptPanel {...data} />
				</Panel>
				<Panel
					className={cn(
						tab === "nu" ? "flex" : "hidden",
						tab !== "overzicht" && "md:flex",
						"xl:flex",
					)}
				>
					<NowPanel {...data} />
				</Panel>
				<Panel
					className={cn(tab === "overzicht" ? "flex" : "hidden", "xl:flex")}
				>
					<OverviewPanel {...data} />
				</Panel>
			</div>

			{phase === "stopping" && data.attached ? (
				<div className="bg-background/70 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-300">
					<div className="bg-card flex items-center gap-3 rounded-xl px-5 py-4 shadow-lg ring-1 ring-foreground/10">
						<RadioIcon className="size-4 animate-pulse" />
						<span className="text-sm">
							Laatste woorden uitschrijven en opslaan…
						</span>
					</div>
				</div>
			) : null}
		</div>
	);
}

function Panel({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<section
			className={cn(
				"bg-card min-h-0 min-w-0 flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10",
				className,
			)}
		>
			{children}
		</section>
	);
}

function PanelHeader({
	title,
	children,
}: {
	title: string;
	children?: React.ReactNode;
}) {
	return (
		<div className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
			<h2 className="text-sm font-semibold">{title}</h2>
			<div className="ml-auto flex items-center gap-2">{children}</div>
		</div>
	);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<p className="text-muted-foreground mb-2 text-[0.6875rem] font-medium tracking-wide uppercase">
			{children}
		</p>
	);
}

// ---- Bovenbalk -------------------------------------------------------------------------

function TopBar({ session, now, attached }: LiveData) {
	const pipOpen = useRecorder((s) => s.pipOpen);
	const shooting = useRecorder((s) => s.shooting);
	const sharing = useRecorder((s) => s.sharing);
	const micOn = useRecorder((s) => s.micOn);
	const kind = useRecorder((s) => s.kind);
	const phase = useRecorder((s) => s.phase);
	const stopSession = useMutation(api.coach.sessions.stop);
	const live = session.mode === "live";
	return (
		<header className="bg-card flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-4 py-2.5 ring-1 ring-foreground/10">
			<div className="flex min-w-0 flex-1 basis-60 flex-col">
				<h1 className="truncate text-sm font-semibold">{session.title}</h1>
				<p className="text-muted-foreground truncate text-xs">
					{[session.clientName, session.goal].filter(Boolean).join(" · ") ||
						"Geen doel: de coach leidt het af uit het gesprek."}
				</p>
			</div>

			<div className="flex items-center gap-3">
				{attached ? (
					<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
						<span className="relative flex size-2">
							<span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/60" />
							<span className="relative size-2 rounded-full bg-emerald-500" />
						</span>
						Live
					</span>
				) : (
					<span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
						<span className="size-2 rounded-full bg-amber-500" />
						Niet verbonden
					</span>
				)}
				<span className="text-base font-semibold tabular-nums">
					{clock(now - session.startedAt)}
				</span>
				<span className="text-muted-foreground hidden text-xs sm:inline">
					{live ? "Fysiek" : "Online"}
					{kind ? ` · ${kind === "speechmatics" ? "realtime" : "gateway"}` : ""}
				</span>
				{attached ? <ListenDots /> : null}
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<SessionModelSelect session={session} />
				{attached ? (
					<>
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
						{pipSupported() && !pipOpen ? (
							<Button
								size="sm"
								variant="outline"
								onClick={() =>
									void openCoachWindow(session._id).catch((err: Error) =>
										toast.error("Zwevend venster openen lukte niet", {
											description: err.message,
										}),
									)
								}
							>
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
					</>
				) : (
					<>
						<Button
							size="sm"
							disabled={phase === "starting" || phase === "live"}
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
							variant="ghost"
							title="Gesprek afsluiten en het verslag laten maken"
							onClick={() => void stopSession({ sessionId: session._id })}
						>
							<CircleStopIcon />
							Afsluiten
						</Button>
					</>
				)}
			</div>
		</header>
	);
}

function Notices({ live }: { live: boolean }) {
	const warning = useRecorder((s) => s.warning);
	const hint = useRecorder((s) => s.hint);
	const error = useRecorder((s) => s.error);
	const items: {
		key: string;
		tone: "warn" | "info" | "error";
		text: string;
		close?: () => void;
	}[] = [];
	if (error) items.push({ key: "e", tone: "error", text: error });
	if (warning) {
		items.push({
			key: "w",
			tone: "warn",
			text: warning,
			close: recorder.dismissWarning,
		});
	}
	if (hint && !live) items.push({ key: "h", tone: "info", text: hint });
	if (items.length === 0) return null;
	return (
		<div className="flex shrink-0 flex-col gap-1.5">
			{items.map((n) => (
				<div
					key={n.key}
					className={cn(
						"flex items-start gap-2 rounded-lg px-3 py-1.5 text-xs ring-1 animate-in fade-in duration-300",
						n.tone === "error" &&
							"bg-destructive/10 text-destructive ring-destructive/25",
						n.tone === "warn" && "bg-amber-500/10 ring-amber-500/25",
						n.tone === "info" &&
							"bg-muted/60 text-muted-foreground ring-foreground/5",
					)}
				>
					<InfoIcon className="mt-px size-3.5 shrink-0" />
					<span className="flex-1">{n.text}</span>
					{n.close ? (
						<button
							type="button"
							onClick={n.close}
							aria-label="Sluiten"
							className="text-muted-foreground hover:text-foreground"
						>
							<XIcon className="size-3.5" />
						</button>
					) : null}
				</div>
			))}
		</div>
	);
}

// ---- Transcript ----------------------------------------------------------------------------

const SPEAKER_DOTS = [
	"bg-sky-500",
	"bg-violet-500",
	"bg-amber-500",
	"bg-teal-500",
	"bg-rose-500",
	"bg-lime-500",
];

function dotFor(label: string): string {
	let h = 0;
	for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return SPEAKER_DOTS[h % SPEAKER_DOTS.length] ?? "bg-sky-500";
}

function TranscriptPanel({ session, chunks, attached }: LiveData) {
	const interim = useRecorder((s) => s.interim);
	const [atBottom, setAtBottom] = useState(true);
	const scroller = useRef<HTMLDivElement | null>(null);
	// Zonder effect: na elke render naar beneden, zolang je onderaan stond.
	const follow = (el: HTMLDivElement | null) => {
		scroller.current = el;
		if (el && atBottom) el.scrollTop = el.scrollHeight;
	};
	const toBottom = () => {
		const el = scroller.current;
		if (el) el.scrollTop = el.scrollHeight;
		setAtBottom(true);
	};
	return (
		<>
			<PanelHeader title="Transcript">
				<span className="text-muted-foreground text-xs tabular-nums">
					{chunks.length} regels
				</span>
			</PanelHeader>
			<div className="relative min-h-0 flex-1">
				<div
					ref={follow}
					onScroll={(e) => {
						const el = e.currentTarget;
						const bottom =
							el.scrollHeight - el.scrollTop - el.clientHeight < 60;
						if (bottom !== atBottom) setAtBottom(bottom);
					}}
					className="h-full overflow-y-auto px-4 py-3"
				>
					{chunks.length === 0 && !interim.mic && !interim.tab ? (
						<p className="text-muted-foreground py-10 text-center text-sm">
							Nog niets gehoord. Zodra er gepraat wordt, verschijnt het hier.
						</p>
					) : null}
					<ol className="flex max-w-[70ch] flex-col">
						{chunks.map((c, i) => {
							const prev = chunks[i - 1];
							const key = c.isMine ? "me" : (c.speaker ?? "?");
							const prevKey = prev
								? prev.isMine
									? "me"
									: (prev.speaker ?? "?")
								: null;
							const continued =
								prevKey === key &&
								prev !== undefined &&
								c.at - prev.at < 90_000;
							return (
								<li
									key={c._id}
									className={cn(
										"text-sm",
										continued ? "pt-1" : "pt-3 first:pt-0",
									)}
								>
									{continued ? null : (
										<div className="mb-0.5 flex items-center gap-2">
											<span
												className={cn(
													"size-2 shrink-0 rounded-full",
													c.isMine ? "bg-primary" : dotFor(key),
												)}
											/>
											{c.isMine || !c.speaker ? (
												<span className="text-xs font-semibold">
													{c.isMine ? session.myName : "Ander"}
												</span>
											) : (
												<SpeakerName
													session={session}
													label={c.speaker}
													className="text-foreground font-semibold"
												/>
											)}
											<span className="text-muted-foreground text-[0.6875rem] tabular-nums">
												{clock(c.at - session.startedAt)}
											</span>
										</div>
									)}
									<p className="text-foreground/90 pl-4 leading-relaxed">
										{c.text}
									</p>
								</li>
							);
						})}
						{attached
							? (["tab", "mic"] as const).map((source) =>
									interim[source] ? (
										<li
											key={source}
											className="text-muted-foreground pt-2 pl-4 text-sm italic"
										>
											{interim[source]}
										</li>
									) : null,
								)
							: null}
					</ol>
				</div>
				{atBottom ? null : (
					<button
						type="button"
						onClick={toBottom}
						className="bg-background absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium shadow-md ring-1 ring-foreground/10 animate-in fade-in duration-200"
					>
						<ArrowDownIcon className="size-3.5" />
						Naar nieuwste
					</button>
				)}
			</div>
		</>
	);
}

// ---- Nu --------------------------------------------------------------------------------------

type FeedItem =
	| { kind: "ask"; at: number; ask: Ask }
	| { kind: "nudge"; at: number; nudge: Nudge };

function NowPanel({ session, state, nudges, asks, now }: LiveData) {
	const dismiss = useMutation(api.coach.sessions.dismissNudge);
	const active = activeNudges(nudges, now);
	const activeIds = new Set(active.map((n) => n._id));
	const feed: FeedItem[] = [
		...asks.map((ask) => ({ kind: "ask" as const, at: ask.at, ask })),
		...nudges
			.filter((n) => !activeIds.has(n._id))
			.map((nudge) => ({ kind: "nudge" as const, at: nudge.at, nudge })),
	]
		.sort((a, b) => b.at - a.at)
		.slice(0, 60);
	const [first, second] = active;
	return (
		<>
			<PanelHeader title="Nu" />
			{/* Telefoon: alles scrolt samen; groter scherm: alleen de feed. */}
			<div className="flex min-h-0 flex-1 flex-col max-md:overflow-y-auto">
				<div className="flex shrink-0 flex-col gap-2.5 border-b p-4">
					{first ? (
						<NudgeCard
							key={first._id}
							nudge={first}
							now={now}
							size="lg"
							onDismiss={(nudgeId) => void dismiss({ nudgeId })}
						/>
					) : (
						<div className="text-muted-foreground flex items-center gap-2 text-sm">
							<span className="relative flex size-2">
								<span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/40" />
								<span className="relative size-2 rounded-full bg-emerald-500/70" />
							</span>
							Coach luistert mee…
						</div>
					)}
					{second ? (
						<NudgeCard
							key={second._id}
							nudge={second}
							now={now}
							size="sm"
							onDismiss={(nudgeId) => void dismiss({ nudgeId })}
						/>
					) : null}
					{state?.nextQuestion ? (
						<div className="bg-muted/50 rounded-lg px-3 py-2">
							<p className="text-muted-foreground text-[0.625rem] font-medium tracking-wide uppercase">
								Volgende vraag
							</p>
							<p className="text-sm leading-snug">{state.nextQuestion}</p>
						</div>
					) : null}
					{state ? <WhoIsWho session={session} state={state} /> : null}
					<div className="max-md:hidden">
						<AskBox
							session={session}
							placeholder="Vraag iets… bv. wat hadden we over de prijs gezegd?"
						/>
					</div>
				</div>
				<div className="p-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
					{feed.length === 0 ? (
						<p className="text-muted-foreground text-xs">
							Antwoorden en eerdere tips verschijnen hier, nieuwste boven.
						</p>
					) : (
						<div className="flex flex-col gap-2.5">
							{feed.map((item) =>
								item.kind === "ask" ? (
									<AskCard
										key={item.ask._id}
										ask={item.ask}
										session={session}
									/>
								) : (
									<PastNudge
										key={item.nudge._id}
										nudge={item.nudge}
										session={session}
									/>
								),
							)}
						</div>
					)}
				</div>
			</div>
			{/* Telefoon: vraagveld onderaan, binnen duimbereik. */}
			<div className="shrink-0 border-t p-3 md:hidden">
				<AskBox session={session} />
			</div>
		</>
	);
}

function PastNudge({ nudge, session }: { nudge: Nudge; session: Session }) {
	const meta = NUDGE_META[nudge.type];
	const Icon = meta.icon;
	return (
		<div className="flex gap-2.5 rounded-lg px-1 py-1 text-sm">
			<Icon className={cn("mt-0.5 size-3.5 shrink-0", meta.accent)} />
			<div className="min-w-0 flex-1">
				<p className="leading-snug">
					<span className={cn("font-medium", meta.accent)}>{meta.label}</span>{" "}
					<span className="text-foreground/90">{nudge.text}</span>
				</p>
				{nudge.detail ? (
					<p className="text-muted-foreground text-xs leading-snug">
						{nudge.detail}
					</p>
				) : null}
			</div>
			<span className="text-muted-foreground shrink-0 text-[0.6875rem] tabular-nums">
				{clock(nudge.at - session.startedAt)}
			</span>
		</div>
	);
}

// ---- Overzicht -------------------------------------------------------------------------------

type Section = "stand" | "besluiten" | "acties" | "vragen" | "scherm";

function OverviewPanel({ session, state, now }: LiveData) {
	const setItem = useMutation(api.coach.sessions.setAgendaItem);
	const [section, setSection] = useState<Section>("stand");
	if (!state) {
		return <PanelHeader title="Overzicht" />;
	}
	const sections: { id: Section; label: string; items: string[] }[] = [
		{ id: "stand", label: "Stand", items: state.summary },
		{ id: "besluiten", label: "Besluiten", items: state.decisions },
		{
			id: "acties",
			label: "Acties",
			items: state.actionItems.map(
				(a) => `${a.owner}: ${a.what}${a.when ? ` (${a.when})` : ""}`,
			),
		},
		{ id: "vragen", label: "Open", items: state.openQuestions },
	];
	const current = sections.find((s) => s.id === section);
	return (
		<>
			<PanelHeader title="Overzicht" />
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="flex flex-col gap-4 border-b p-4">
					<div>
						<SectionLabel>Agenda</SectionLabel>
						<AgendaTimer
							session={session}
							state={state}
							now={now}
							onPick={(index) =>
								void setItem({ sessionId: session._id, index })
							}
						/>
					</div>
					<div>
						<SectionLabel>Spreektijd</SectionLabel>
						<TalkBar session={session} state={state} />
					</div>
				</div>
				<div className="p-4">
					<div className="bg-muted/60 mb-3 flex flex-wrap gap-1 rounded-lg p-1">
						{[
							...sections,
							...(session.mode === "live"
								? []
								: [{ id: "scherm" as const, label: "Scherm", items: [] }]),
						].map((s) => (
							<button
								key={s.id}
								type="button"
								onClick={() => setSection(s.id)}
								className={cn(
									"flex-1 rounded-md px-2 py-1 text-xs whitespace-nowrap transition-colors",
									section === s.id
										? "bg-background font-medium shadow-xs"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{s.label}
								{s.items.length ? (
									<span className="text-muted-foreground ml-1 tabular-nums">
										{s.items.length}
									</span>
								) : null}
							</button>
						))}
					</div>
					{section === "scherm" ? (
						<Shots session={session} bare />
					) : current?.items.length ? (
						<ul className="flex flex-col gap-1.5 text-sm leading-snug">
							{current.items.map((item) => (
								<li key={item} className="flex gap-2">
									<span className="text-muted-foreground">•</span>
									<span>{item}</span>
								</li>
							))}
						</ul>
					) : (
						<p className="text-muted-foreground text-xs">
							Verschijnt na een paar minuten gesprek.
						</p>
					)}
				</div>
			</div>
		</>
	);
}

/** Screenshots met beschrijving (ook op de verslagpagina). */
export function Shots({
	session,
	limit = 12,
	bare = false,
}: {
	session: Session;
	limit?: number;
	bare?: boolean;
}) {
	const shots = useQuery(api.coach.sessions.shots, { sessionId: session._id });
	if (!shots || shots.length === 0) {
		return bare ? (
			<p className="text-muted-foreground text-xs">
				Nog geen screenshots. Ze komen vanzelf bij een nieuw scherm; Alt+S voor
				een eigen.
			</p>
		) : null;
	}
	const list = (
		<div className="flex flex-col gap-3">
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
								className="w-full rounded-lg ring-1 ring-foreground/10"
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
		</div>
	);
	if (bare) return list;
	return (
		<section className="bg-card flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
			<h2 className="text-sm font-semibold">Scherm</h2>
			{list}
		</section>
	);
}
