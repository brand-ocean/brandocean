import { useMutation, useQuery } from "convex/react";
import {
	CornerDownLeftIcon,
	MessageCircleIcon,
	PencilIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { api } from "~convex/_generated/api";
import type { Doc, Id } from "~convex/_generated/dataModel";
import { clock } from "./format";

// Losse bouwstenen die op de pagina én in het zwevende venster werken. Geen
// Base UI-popovers of -selects hier: die renderen in een portal in het
// hoofddocument, en dan verschijnen ze niet in het zwevende venster.

type Session = Doc<"coachSessions">;

// ---- Sprekers een naam geven ----------------------------------------------------------

export function labelName(
	session: Pick<Session, "speakerNames">,
	label: string,
): string {
	return (
		session.speakerNames?.find((s) => s.label === label)?.name ??
		label.replace(/^S(\d+)$/, "Spreker $1")
	);
}

/** De naam meteen overal laten zien, nog voor de server terug is. */
function useRename(sessionId: Id<"coachSessions">) {
	return useMutation(api.coach.sessions.renameSpeaker).withOptimisticUpdate(
		(store, args) => {
			const current = store.getQuery(api.coach.sessions.get, { sessionId });
			if (!current) return;
			const rest = (current.session.speakerNames ?? []).filter(
				(s) => s.label !== args.label,
			);
			const name = args.name.trim();
			store.setQuery(
				api.coach.sessions.get,
				{ sessionId },
				{
					...current,
					session: {
						...current.session,
						speakerNames: name ? [...rest, { label: args.label, name }] : rest,
					},
				},
			);
		},
	);
}

/**
 * Klik op een spreker → invoerveld op dezelfde plek → Enter bewaart, Esc
 * annuleert. Leeg maken haalt de naam weg.
 */
export function SpeakerName({
	session,
	label,
	className,
}: {
	session: Session;
	label: string;
	className?: string;
}) {
	const rename = useRename(session._id);
	const [draft, setDraft] = useState<string | null>(null);
	const name = labelName(session, label);
	const save = () => {
		if (draft === null) return;
		const next = draft.trim();
		setDraft(null);
		if (next !== name) {
			void rename({ sessionId: session._id, label, name: next });
		}
	};
	if (draft !== null) {
		return (
			<input
				ref={(el) => {
					if (el && el.ownerDocument.activeElement !== el) el.focus();
				}}
				value={draft}
				placeholder="Naam"
				aria-label={`Naam voor ${name}`}
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						save();
					} else if (e.key === "Escape") {
						setDraft(null);
					}
				}}
				onBlur={save}
				onClick={(e) => e.stopPropagation()}
				maxLength={40}
				className={cn(
					"bg-background w-28 rounded-md border px-1.5 py-0.5 text-xs font-medium outline-none focus:ring-2 focus:ring-ring/40",
					className,
				)}
			/>
		);
	}
	return (
		<button
			type="button"
			title="Naam geven"
			onClick={(e) => {
				e.stopPropagation();
				setDraft(/^Spreker \d+$/.test(name) ? "" : name);
			}}
			className={cn(
				"group/name hover:text-foreground inline-flex items-center gap-1 text-xs font-medium",
				className,
			)}
		>
			{name}
			<PencilIcon className="size-2.5 opacity-40 transition-opacity group-hover/name:opacity-100" />
		</button>
	);
}

// ---- Model kiezen ------------------------------------------------------------------------

export const COACH_MODELS = [
	{ id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5" },
	{ id: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5" },
	{ id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash" },
	{ id: "openai/gpt-6.1-sol", label: "GPT-6.1 Sol" },
] as const;

export type CoachModelId = (typeof COACH_MODELS)[number]["id"];
export const DEFAULT_MODEL: CoachModelId = "anthropic/claude-sonnet-5.5";

export function isCoachModel(value: string): value is CoachModelId {
	return COACH_MODELS.some((m) => m.id === value);
}

export const MODEL_HINT =
	"Dit model maakt de stand (elke ±2,5 min), beantwoordt je vragen en schrijft het verslag. De snelle tips tussendoor blijven op Gemini 3.8 Flash: die moeten binnen een paar seconden komen.";

/** Gewone <select>: werkt ook in het zwevende venster. */
export function ModelSelect({
	value,
	onChange,
	className,
}: {
	value: CoachModelId;
	onChange: (model: CoachModelId) => void;
	className?: string;
}) {
	return (
		<select
			value={value}
			title={MODEL_HINT}
			aria-label="Model"
			onChange={(e) => {
				if (isCoachModel(e.target.value)) onChange(e.target.value);
			}}
			className={cn(
				"bg-background h-7 rounded-md border px-2 text-xs outline-none focus:ring-2 focus:ring-ring/40 dark:bg-input/30",
				className,
			)}
		>
			{COACH_MODELS.map((m) => (
				<option key={m.id} value={m.id}>
					{m.label}
				</option>
			))}
		</select>
	);
}

/** Het model van dit gesprek, te wisselen tijdens het gesprek. */
export function SessionModelSelect({ session }: { session: Session }) {
	const setModel = useMutation(
		api.coach.sessions.setModel,
	).withOptimisticUpdate((store, args) => {
		const current = store.getQuery(api.coach.sessions.get, {
			sessionId: session._id,
		});
		if (!current) return;
		store.setQuery(
			api.coach.sessions.get,
			{ sessionId: session._id },
			{ ...current, session: { ...current.session, model: args.model } },
		);
	});
	return (
		<ModelSelect
			value={session.model ?? DEFAULT_MODEL}
			onChange={(model) => {
				rememberModel(model);
				void setModel({ sessionId: session._id, model });
			}}
		/>
	);
}

const MODEL_KEY = "coach.model";

export function storedModel(): CoachModelId {
	if (typeof window === "undefined") return DEFAULT_MODEL;
	try {
		const value = localStorage.getItem(MODEL_KEY) ?? "";
		return isCoachModel(value) ? value : DEFAULT_MODEL;
	} catch {
		return DEFAULT_MODEL;
	}
}

export function rememberModel(model: CoachModelId) {
	try {
		localStorage.setItem(MODEL_KEY, model);
	} catch {
		// privé-venster
	}
}

// ---- Vraag iets ----------------------------------------------------------------------------

type Ask = Doc<"coachAsks">;

export function AskBox({
	session,
	compact = false,
	placeholder = "Vraag iets…",
}: {
	session: Session;
	compact?: boolean;
	placeholder?: string;
}) {
	const ask = useMutation(api.coach.sessions.ask);
	const [question, setQuestion] = useState("");
	const [error, setError] = useState<string | null>(null);
	const send = async () => {
		const q = question.trim();
		if (!q) return;
		setQuestion("");
		setError(null);
		try {
			await ask({ sessionId: session._id, question: q });
		} catch (err) {
			setQuestion(q);
			setError(err instanceof Error ? err.message : "Versturen mislukt.");
		}
	};
	return (
		<form
			className="flex flex-col gap-1"
			onSubmit={(e) => {
				e.preventDefault();
				void send();
			}}
		>
			<div className="relative">
				<MessageCircleIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
				<input
					value={question}
					onChange={(e) => setQuestion(e.target.value)}
					placeholder={placeholder}
					aria-label="Vraag aan de coach"
					maxLength={600}
					className={cn(
						"bg-background w-full rounded-lg border pr-8 pl-8 outline-none transition-shadow focus:ring-2 focus:ring-ring/40 dark:bg-input/30",
						compact ? "h-8 text-xs" : "h-9 text-sm",
					)}
				/>
				<CornerDownLeftIcon className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2" />
			</div>
			{error ? <p className="text-destructive text-xs">{error}</p> : null}
		</form>
	);
}

export function AskCard({
	ask,
	session,
	compact = false,
}: {
	ask: Ask;
	session: Session;
	compact?: boolean;
}) {
	return (
		<div
			className={cn(
				"rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/6 animate-in fade-in slide-in-from-bottom-2 duration-500",
				compact ? "p-3" : "p-4",
			)}
		>
			<p className="text-[0.6875rem] font-medium tracking-wide text-fuchsia-600 uppercase dark:text-fuchsia-400">
				Jouw vraag · {clock(ask.at - session.startedAt)}
			</p>
			<p className={cn("mt-0.5 font-medium", compact ? "text-xs" : "text-sm")}>
				{ask.question}
			</p>
			<div
				className={cn(
					"text-foreground/85 mt-1.5 leading-snug whitespace-pre-wrap",
					compact ? "text-xs" : "text-sm",
				)}
			>
				{ask.status === "pending" ? (
					<span className="text-muted-foreground animate-pulse">Denkt na…</span>
				) : ask.status === "error" ? (
					<span className="text-destructive">
						Geen antwoord gekregen. Probeer het nog eens.
					</span>
				) : (
					ask.answer
				)}
			</div>
		</div>
	);
}

/** Antwoorden, nieuwste boven. `recentMs` toont alleen recente (zwevend venster). */
export function AskFeed({
	session,
	limit = 20,
	compact = false,
	recentMs,
	now,
}: {
	session: Session;
	limit?: number;
	compact?: boolean;
	recentMs?: number;
	now?: number;
}) {
	const asks = useQuery(api.coach.sessions.asks, { sessionId: session._id });
	const shown = (asks ?? [])
		.filter(
			(a) =>
				recentMs === undefined ||
				a.status === "pending" ||
				(now ?? Date.now()) - a.at < recentMs,
		)
		.slice(0, limit);
	if (shown.length === 0) return null;
	return (
		<div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
			{shown.map((a) => (
				<AskCard key={a._id} ask={a} session={session} compact={compact} />
			))}
		</div>
	);
}

// ---- Microfoon: versterking en keuze -------------------------------------------------------

export type AudioInput = { deviceId: string; label: string };

/** Microfoons van deze computer (namen pas zichtbaar na toestemming). */
export async function listMics(): Promise<AudioInput[]> {
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices
			.filter((d) => d.kind === "audioinput" && d.deviceId !== "default")
			.map((d, i) => ({
				deviceId: d.deviceId,
				label: d.label || `Microfoon ${i + 1}`,
			}));
	} catch {
		return [];
	}
}

export function GainSlider({
	value,
	onChange,
}: {
	value: number;
	onChange: (value: number) => void;
}) {
	return (
		<label className="flex items-center gap-2 text-xs">
			<span className="text-muted-foreground shrink-0">Versterken</span>
			<input
				type="range"
				min={1}
				max={6}
				step={0.5}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
				className="accent-primary w-full"
			/>
			<span className="w-9 shrink-0 text-right font-medium tabular-nums">
				{value.toFixed(1)}×
			</span>
		</label>
	);
}

export function MicSelect({
	value,
	devices,
	onChange,
	onOpen,
}: {
	value: string;
	devices: readonly AudioInput[];
	onChange: (deviceId: string) => void;
	onOpen?: () => void;
}) {
	return (
		<select
			value={value}
			aria-label="Microfoon"
			onFocus={onOpen}
			onPointerDown={onOpen}
			onChange={(e) => onChange(e.target.value)}
			className="bg-background h-7 w-full min-w-0 rounded-md border px-2 text-xs outline-none focus:ring-2 focus:ring-ring/40 dark:bg-input/30"
		>
			<option value="">Standaard microfoon</option>
			{devices.map((d) => (
				<option key={d.deviceId} value={d.deviceId}>
					{d.label}
				</option>
			))}
		</select>
	);
}
