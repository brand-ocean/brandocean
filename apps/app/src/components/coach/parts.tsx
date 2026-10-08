import { useMutation } from "convex/react";
import { CheckIcon, UserRoundCheckIcon, XIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { api } from "~convex/_generated/api";
import type { Doc, Id } from "~convex/_generated/dataModel";
import { labelName, SpeakerName } from "./extras";
import { activeNudges, clock, NUDGE_META, talkSplit } from "./format";
import { type RecorderSnapshot, recorder } from "./lib/recorder";

/** Een stukje van de recorder-status; geef alleen primitieven of bestaande objecten terug. */
export function useRecorder<T>(select: (s: RecorderSnapshot) => T): T {
	return useSyncExternalStore(
		recorder.subscribe,
		() => select(recorder.getSnapshot()),
		() => select(recorder.getServerSnapshot()),
	);
}

type Nudge = Doc<"coachNudges">;

export function NudgeCard({
	nudge,
	now,
	size = "lg",
	onDismiss,
}: {
	nudge: Nudge;
	now: number;
	size?: "lg" | "md" | "sm";
	onDismiss?: (id: Id<"coachNudges">) => void;
}) {
	const meta = NUDGE_META[nudge.type];
	const Icon = meta.icon;
	const span = Math.max(1, nudge.expiresAt - nudge.at);
	const left = Math.min(1, Math.max(0, (nudge.expiresAt - now) / span));
	return (
		<div
			className={cn(
				"relative overflow-hidden rounded-xl border animate-in fade-in slide-in-from-bottom-2 duration-500",
				meta.soft,
				size === "lg" ? "p-4 xl:p-5" : size === "md" ? "p-4" : "p-3",
				nudge.priority === "high" && "ring-1 ring-current/10",
			)}
		>
			<div className="flex items-start gap-3">
				<div className={cn("mt-0.5 shrink-0", meta.accent)}>
					<Icon className={size === "lg" ? "size-5" : "size-4"} />
				</div>
				<div className="min-w-0 flex-1">
					<p
						className={cn(
							"font-medium tracking-wide uppercase",
							meta.accent,
							size === "sm" ? "text-[0.625rem]" : "text-[0.6875rem]",
						)}
					>
						{meta.label}
						{nudge.priority === "high" ? " · nu" : ""}
					</p>
					<p
						className={cn(
							"font-semibold leading-snug text-balance",
							size === "lg"
								? "mt-1 text-xl xl:text-2xl"
								: size === "md"
									? "mt-0.5 text-lg"
									: "text-sm",
						)}
					>
						{nudge.text}
					</p>
					{nudge.detail ? (
						<p
							className={cn(
								"text-foreground/80 leading-snug",
								size === "lg"
									? "mt-2 text-base"
									: size === "md"
										? "mt-1 text-sm"
										: "mt-0.5 text-xs",
							)}
						>
							{nudge.detail}
						</p>
					) : null}
				</div>
				{onDismiss ? (
					<button
						type="button"
						onClick={() => onDismiss(nudge._id)}
						aria-label="Weg"
						className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 rounded-md p-1 transition-colors"
					>
						<XIcon className="size-4" />
					</button>
				) : null}
			</div>
			<div className="absolute inset-x-0 bottom-0 h-0.5 bg-current/5">
				<div
					className={cn(
						"h-full bg-current/30 transition-[width] duration-200 ease-linear",
						meta.accent,
					)}
					style={{ width: `${left * 100}%` }}
				/>
			</div>
		</div>
	);
}

/** De huidige nudges, of een rustige lege staat. Vaste hoogte: geen sprongen. */
export function NudgeStack({
	nudges,
	now,
	compact = false,
	onDismiss,
	idle,
}: {
	nudges: readonly Nudge[];
	now: number;
	compact?: boolean;
	onDismiss?: (id: Id<"coachNudges">) => void;
	idle: React.ReactNode;
}) {
	const active = activeNudges(nudges, now);
	if (active.length === 0) {
		return (
			<div
				className={cn(
					"text-muted-foreground flex items-center justify-center rounded-xl border border-dashed text-center animate-in fade-in duration-700",
					compact ? "min-h-28 p-3 text-sm" : "min-h-40 p-6",
				)}
			>
				{idle}
			</div>
		);
	}
	const [first, second] = active;
	return (
		<div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
			{first ? (
				<NudgeCard
					key={first._id}
					nudge={first}
					now={now}
					size={compact ? "md" : "lg"}
					onDismiss={onDismiss}
				/>
			) : null}
			{second ? (
				<NudgeCard
					key={second._id}
					nudge={second}
					now={now}
					size="sm"
					onDismiss={onDismiss}
				/>
			) : null}
		</div>
	);
}

type State = Doc<"coachState">;
type Session = Doc<"coachSessions">;

function itemSpent(state: State, index: number, now: number): number {
	const item = state.agenda[index];
	if (!item) return 0;
	const running =
		state.currentItem === index && state.currentSince !== undefined
			? Math.max(0, now - state.currentSince)
			: 0;
	return item.spentMs + running;
}

function planned(state: State, session: Session): number | null {
	if (session.plannedMinutes) return session.plannedMinutes * 60_000;
	const sum = state.agenda.reduce((n, a) => n + (a.minutes ?? 0), 0);
	return sum > 0 ? sum * 60_000 : null;
}

/** Klok + huidig agendapunt met een balk die oranje wordt als het uitloopt. */
export function AgendaTimer({
	session,
	state,
	now,
	compact = false,
	onPick,
}: {
	session: Session;
	state: State;
	now: number;
	compact?: boolean;
	onPick?: (index: number) => void;
}) {
	const elapsed = now - session.startedAt;
	const total = planned(state, session);
	const cur = state.currentItem;
	const item = cur !== undefined ? state.agenda[cur] : undefined;
	const spent = cur !== undefined ? itemSpent(state, cur, now) : 0;
	const limit = item?.minutes ? item.minutes * 60_000 : null;
	const ratio = limit ? spent / limit : 0;
	const over = limit !== null && spent > limit;
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-baseline justify-between gap-2">
				<span
					className={cn(
						"font-semibold tabular-nums",
						compact ? "text-lg" : "text-2xl",
					)}
				>
					{clock(elapsed)}
				</span>
				{total !== null ? (
					<span
						className={cn(
							"text-xs tabular-nums",
							total - elapsed < 5 * 60_000
								? "text-amber-600 dark:text-amber-400"
								: "text-muted-foreground",
						)}
					>
						{total - elapsed >= 0
							? `nog ${Math.ceil((total - elapsed) / 60_000)} min`
							: `${Math.ceil((elapsed - total) / 60_000)} min over tijd`}
					</span>
				) : null}
			</div>
			{item ? (
				<div className="flex flex-col gap-1">
					<div className="flex items-baseline justify-between gap-2 text-sm">
						<span className="truncate font-medium">{item.title}</span>
						<span
							className={cn(
								"shrink-0 text-xs tabular-nums",
								over
									? "text-amber-600 dark:text-amber-400"
									: "text-muted-foreground",
							)}
						>
							{clock(spent)}
							{limit ? ` / ${item.minutes}:00` : ""}
						</span>
					</div>
					{limit ? (
						<div className="bg-muted h-1.5 overflow-hidden rounded-full">
							<div
								className={cn(
									"h-full rounded-full transition-[width,background-color] duration-500",
									over
										? "bg-amber-500"
										: ratio > 0.8
											? "bg-amber-400/70"
											: "bg-emerald-500",
								)}
								style={{ width: `${Math.min(100, ratio * 100)}%` }}
							/>
						</div>
					) : null}
				</div>
			) : null}
			{!compact && state.agenda.length > 0 ? (
				<ol className="mt-1 flex flex-col gap-0.5">
					{state.agenda.map((a, i) => {
						const s = itemSpent(state, i, now);
						const isCur = i === cur;
						return (
							<li key={`${i}-${a.title}`}>
								<button
									type="button"
									disabled={!onPick}
									onClick={() => onPick?.(i)}
									className={cn(
										"flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors",
										onPick && "hover:bg-muted",
										isCur && "bg-muted",
									)}
								>
									<span
										className={cn(
											"flex size-4 shrink-0 items-center justify-center rounded-full border text-[0.5625rem]",
											a.done && "border-emerald-500 bg-emerald-500 text-white",
											isCur && !a.done && "border-foreground",
										)}
									>
										{a.done ? <CheckIcon className="size-2.5" /> : null}
									</span>
									<span
										className={cn(
											"flex-1 truncate",
											a.done && !isCur && "text-muted-foreground",
										)}
									>
										{a.title}
									</span>
									<span className="text-muted-foreground shrink-0 text-xs tabular-nums">
										{s > 0 ? clock(s) : ""}
										{a.minutes ? ` · ${a.minutes}m` : ""}
									</span>
								</button>
							</li>
						);
					})}
				</ol>
			) : null}
		</div>
	);
}

/** Wie praat er hoeveel. Groen tot 55%, daarna oranje. */
export function TalkBar({
	session,
	state,
	compact = false,
}: {
	session: Session;
	state: State;
	compact?: boolean;
}) {
	const { share, total } = talkSplit(state.talk);
	const pct = Math.round(share * 100);
	const others = state.talk.filter((t) => !t.isMine && t.ms > 0);
	if (session.mode === "live" && !session.meLabel) {
		return (
			<p className="text-muted-foreground text-xs leading-snug">
				Spreektijd volgt zodra de coach weet wie jij bent.
			</p>
		);
	}
	const tone =
		share > 0.65
			? "bg-orange-500"
			: share > 0.55
				? "bg-amber-400"
				: "bg-emerald-500";
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-baseline justify-between text-xs">
				<span className="font-medium">
					{session.myName} {total > 0 ? `${pct}%` : "—"}
				</span>
				<span className="text-muted-foreground">
					anderen {total > 0 ? `${100 - pct}%` : "—"}
				</span>
			</div>
			<div className="bg-muted flex h-2 overflow-hidden rounded-full">
				<div
					className={cn("h-full transition-[width] duration-700", tone)}
					style={{
						width: `${total > 0 ? pct : 50}%`,
						opacity: total > 0 ? 1 : 0.15,
					}}
				/>
			</div>
			{others.length > 0 ? (
				<div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
					{others.slice(0, compact ? 3 : 12).map((t) =>
						t.key === "?" ? null : (
							<span key={t.key} className="inline-flex items-center gap-1">
								<SpeakerName session={session} label={t.key} />
								<span className="tabular-nums">
									{Math.round((t.ms / Math.max(1, total)) * 100)}%
								</span>
							</span>
						),
					)}
				</div>
			) : null}
		</div>
	);
}

/** Twee bolletjes: jij en de anderen, die meebewegen met het geluid. */
export function ListenDots() {
	const levels = useRecorder((s) => s.levels);
	const micOn = useRecorder((s) => s.micOn);
	const tabAudio = useRecorder((s) => s.tabAudio);
	const dot = (on: boolean, level: number, label: string) => (
		<span className="flex items-center gap-1.5" title={label}>
			<span className="relative flex size-2.5 items-center justify-center">
				<span
					className={cn(
						"absolute inset-0 rounded-full transition-transform duration-150",
						on ? "bg-emerald-500/30" : "bg-muted-foreground/20",
					)}
					style={{
						transform: `scale(${on ? 1 + Math.min(1.6, level * 18) : 1})`,
					}}
				/>
				<span
					className={cn(
						"relative size-1.5 rounded-full",
						on ? "bg-emerald-500" : "bg-muted-foreground/40",
					)}
				/>
			</span>
			<span className="text-muted-foreground text-xs">{label}</span>
		</span>
	);
	return (
		<span className="flex items-center gap-3">
			{dot(micOn, levels.mic, "jij")}
			{dot(tabAudio, levels.tab, "Meet")}
		</span>
	);
}

/**
 * Live (alleen microfoon): welke stem ben jij? Eén tik op "Dit ben ik"; de
 * coach onthoudt je stem en herkent je de volgende keer zelf.
 */
export function WhoIsWho({
	session,
	state,
	compact = false,
}: {
	session: Session;
	state: State;
	compact?: boolean;
}) {
	const setMeMutation = useMutation(api.coach.sessions.setMe);
	const resetMutation = useMutation(api.coach.sessions.resetVoice);
	const mine = useRecorder(
		(s) => s.sessionId === session._id && s.phase === "live",
	);
	if (session.mode !== "live") return null;
	const setMe = (label: string | null) => {
		if (mine) void recorder.setMe(label);
		else void setMeMutation({ sessionId: session._id, label });
	};
	const reset = () => {
		if (mine) void recorder.resetVoice();
		else void resetMutation({ sessionId: session._id });
	};
	if (session.meLabel) {
		const { mine: myMs, others } = talkSplit(state.talk);
		// Alles onder jouw naam na een minuut praten: de stemherkenning pakt
		// iedereen. Dan meteen de uitweg tonen.
		const suspicious = others === 0 && myMs > 45_000;
		return (
			<div
				className={cn(
					"flex flex-col gap-1.5 text-xs",
					suspicious &&
						"rounded-lg bg-amber-500/10 p-2 ring-1 ring-amber-500/25",
				)}
			>
				{suspicious ? (
					<p className="leading-snug">
						Alles staat onder {session.myName}. Praten er meer mensen? Laat de
						coach de stemmen opnieuw scheiden.
					</p>
				) : null}
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<UserRoundCheckIcon className="size-3.5 shrink-0 text-emerald-500" />
					<span className="text-muted-foreground">
						Jij ={" "}
						<span className="text-foreground font-medium">
							{labelName(session, session.meLabel)}
						</span>
					</span>
					<span className="ml-auto flex items-center gap-2">
						<button
							type="button"
							onClick={reset}
							title="Vergeet je opgeslagen stem en scheid de stemmen opnieuw"
							className={cn(
								"underline-offset-2 hover:underline",
								suspicious
									? "font-medium text-amber-700 dark:text-amber-400"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{session.myName} is niet iedereen
						</button>
						<button
							type="button"
							onClick={() => setMe(null)}
							className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
						>
							wijzig
						</button>
					</span>
				</div>
			</div>
		);
	}
	const labels = state.talk
		.filter((t) => !t.isMine && t.key !== "?" && t.ms > 0)
		.sort((a, b) => b.ms - a.ms)
		.map((t) => t.key)
		.slice(0, 6);
	return (
		<div
			className={cn(
				"flex flex-col gap-2 rounded-lg border border-dashed p-2.5 animate-in fade-in duration-500",
				compact ? "text-xs" : "text-sm",
			)}
		>
			<p className="text-muted-foreground leading-snug">
				{labels.length
					? "Wie ben jij? Tik bij je eigen stem op 'dit ben ik'. Klik op een naam om hem te wijzigen."
					: "Zodra er gepraat wordt, kies je hier welke stem jij bent."}
			</p>
			{labels.length ? (
				<div className="flex flex-wrap gap-1.5">
					{labels.map((label) => (
						<span
							key={label}
							className="bg-muted flex items-center gap-1.5 rounded-full py-0.5 pr-0.5 pl-2.5"
						>
							<SpeakerName session={session} label={label} />
							<button
								type="button"
								onClick={() => setMe(label)}
								className="hover:bg-primary hover:text-primary-foreground rounded-full px-2 py-0.5 text-xs opacity-80 transition-colors hover:opacity-100"
							>
								dit ben ik
							</button>
						</span>
					))}
				</div>
			) : null}
		</div>
	);
}
