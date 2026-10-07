import type {
	CoachAgendaItem,
	CoachNudgeCandidate,
	CoachNudgePriority,
	CoachNudgeType,
	CoachTalk,
} from "./validators";

// De regels van de coach, los van Convex zodat ze te testen zijn: wanneer
// draait er een modelronde, welke nudges komen erdoor, en welke nudges kunnen
// zonder model (tempo, monoloog, spreekverhouding).

export const FAST_SPEECH_MS = 20_000; // ±20 s nieuwe spraak → snelle ronde
export const FAST_MIN_GAP_MS = 8_000; // ook bij een directe trigger
export const FAST_LEASE_MS = 45_000; // een ronde die langer duurt telt als dood
export const DEEP_EVERY_MS = 150_000; // diepe ronde elke ±2,5 min
export const DEEP_MIN_SPEECH_MS = 30_000;
export const DEEP_LEASE_MS = 120_000;
export const NUDGE_GAP_MS = 45_000; // minimaal tussen niet-urgente nudges
export const HIGH_GAP_MS = 10_000;
export const SILENCE_MS = 8_000;
export const MONOLOGUE_MS = 90_000;
export const MAX_ACTIVE_NUDGES = 2;
/** Plafond per sessie: ruim genoeg voor 3 uur, maar nooit eindeloos. */
export const MAX_FAST_CALLS = 400;
export const MAX_DEEP_CALLS = 60;

/** Hoe lang een nudge zichtbaar blijft. */
export const NUDGE_TTL_MS: Record<CoachNudgeType, number> = {
	vraag: 75_000,
	tempo: 60_000,
	ruimte: 40_000,
	samenvatten: 75_000,
	letop: 120_000,
	kans: 120_000,
	afronden: 240_000,
	antwoord: 60_000,
};

export type FastReason =
	| "cadence"
	| "question"
	| "silence"
	| "wrapup"
	| "manual";

const URGENT: ReadonlySet<FastReason> = new Set([
	"question",
	"silence",
	"wrapup",
	"manual",
]);

export function isUrgent(reason: string): boolean {
	return URGENT.has(reason as FastReason);
}

// ---- Tekst ------------------------------------------------------------------

const STOP = new Set(
	"de het een en of in op te van voor met is dat die dit wat je jij we wij ze zij u ik er niet ook nog wel maar dan als bij aan om naar zo al heb hebt heeft kan kun moet wil was zijn wordt even dus nu".split(
		" ",
	),
);

export function tokens(text: string): string[] {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9€ ]+/g, " ")
		.split(/\s+/)
		.filter((w) => w.length > 1);
}

function contentSet(text: string): Set<string> {
	return new Set(tokens(text).filter((w) => !STOP.has(w)));
}

/** Jaccard-overlap van inhoudswoorden (0–1). */
export function similarity(a: string, b: string): number {
	const x = contentSet(a);
	const y = contentSet(b);
	if (x.size === 0 || y.size === 0) return 0;
	let both = 0;
	for (const w of x) if (y.has(w)) both++;
	return both / (x.size + y.size - both);
}

/**
 * Is deze microfoonregel eigenlijk de echo van de luidsprekers? Dan staan
 * (bijna) dezelfde woorden ook in een tabbladregel van rond hetzelfde moment.
 */
export function isEcho(micText: string, tabText: string): boolean {
	const mic = tokens(micText);
	if (mic.length < 3) return false;
	const tab = new Set(tokens(tabText));
	let hit = 0;
	for (const w of mic) if (tab.has(w)) hit++;
	return hit / mic.length >= 0.6;
}

export function wordCount(text: string): number {
	return tokens(text).length;
}

/** Spreektijd geschat uit woorden (±2,6 woorden per seconde). */
export function estimateSpeechMs(text: string): number {
	return Math.round((wordCount(text) / 2.6) * 1000);
}

/** Een vraag van de anderen die om een antwoord van jou vraagt. */
export function isQuestionForMe(text: string, myName: string): boolean {
	if (!text.includes("?")) return false;
	if (wordCount(text) < 4) return false;
	const lower = text.toLowerCase();
	if (myName && lower.includes(myName.toLowerCase())) return true;
	return /\b(jij|je|jou|jouw|jullie|u|uw|kun|kan|kunnen|zou|zouden|wat vind|hoe zie|hoeveel|wanneer|wat kost|hoe lang)\b/.test(
		lower,
	);
}

export function clock(ms: number): string {
	const s = Math.max(0, Math.round(ms / 1000));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = String(s % 60).padStart(2, "0");
	return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function minutes(ms: number): number {
	return Math.max(1, Math.round(ms / 60_000));
}

// ---- Spreektijd -------------------------------------------------------------

export function talkTotals(talk: readonly CoachTalk[]): {
	mine: number;
	others: number;
	share: number;
} {
	let mine = 0;
	let others = 0;
	for (const t of talk) {
		if (t.isMine) mine += t.ms;
		else others += t.ms;
	}
	const total = mine + others;
	return { mine, others, share: total > 0 ? mine / total : 0 };
}

export function addTalk(
	talk: readonly CoachTalk[],
	key: string,
	isMine: boolean,
	ms: number,
	words: number,
	questions: number,
): CoachTalk[] {
	const next = talk.map((t) => ({ ...t }));
	const row = next.find((t) => t.key === key);
	if (row) {
		row.ms += ms;
		row.words += words;
		row.questions += questions;
	} else if (next.length < 16) {
		next.push({ key, isMine, ms, words, questions });
	}
	return next;
}

// ---- Agenda -----------------------------------------------------------------

export function plannedMs(
	agenda: readonly CoachAgendaItem[],
	plannedMinutes: number | undefined,
): number | null {
	if (plannedMinutes && plannedMinutes > 0) return plannedMinutes * 60_000;
	const sum = agenda.reduce((n, a) => n + (a.minutes ?? 0), 0);
	return sum > 0 ? sum * 60_000 : null;
}

export function itemSpentMs(
	agenda: readonly CoachAgendaItem[],
	index: number,
	currentItem: number | undefined,
	currentSince: number | undefined,
	now: number,
): number {
	const item = agenda[index];
	if (!item) return 0;
	const running =
		currentItem === index && currentSince !== undefined
			? Math.max(0, now - currentSince)
			: 0;
	return item.spentMs + running;
}

/** Zet het huidige agendapunt; de tijd van het vorige wordt bijgeschreven. */
export function switchAgenda(
	agenda: readonly CoachAgendaItem[],
	currentItem: number | undefined,
	currentSince: number | undefined,
	next: number | undefined,
	now: number,
): {
	agenda: CoachAgendaItem[];
	currentItem: number | undefined;
	currentSince: number | undefined;
} {
	const copy = agenda.map((a) => ({ ...a }));
	if (next === currentItem) {
		return { agenda: copy, currentItem, currentSince };
	}
	if (currentItem !== undefined && currentSince !== undefined) {
		const prev = copy[currentItem];
		if (prev) prev.spentMs += Math.max(0, now - currentSince);
	}
	if (next === undefined || !copy[next]) {
		return { agenda: copy, currentItem: undefined, currentSince: undefined };
	}
	// Wie verder gaat, is met de punten daarvoor klaar.
	for (let i = 0; i < next; i++) {
		const a = copy[i];
		if (a && a.spentMs > 0) a.done = true;
	}
	return { agenda: copy, currentItem: next, currentSince: now };
}

// ---- Rondes -----------------------------------------------------------------

export type EngineState = {
	speechMsSinceFast: number;
	speechMsSinceDeep: number;
	fastRunningSince?: number;
	deepRunningSince?: number;
	lastFastAt: number;
	lastDeepAt: number;
	fastCalls: number;
	deepCalls: number;
};

export function fastDue(
	state: EngineState,
	now: number,
	reason: FastReason,
): "run" | "queue" | "skip" {
	if (state.fastCalls >= MAX_FAST_CALLS) return "skip";
	if (
		state.fastRunningSince !== undefined &&
		now - state.fastRunningSince < FAST_LEASE_MS
	) {
		return isUrgent(reason) ? "queue" : "skip";
	}
	if (isUrgent(reason)) {
		return now - state.lastFastAt >= FAST_MIN_GAP_MS ? "run" : "queue";
	}
	return state.speechMsSinceFast >= FAST_SPEECH_MS ? "run" : "skip";
}

export function deepDue(state: EngineState, now: number): boolean {
	if (state.deepCalls >= MAX_DEEP_CALLS) return false;
	if (
		state.deepRunningSince !== undefined &&
		now - state.deepRunningSince < DEEP_LEASE_MS
	) {
		return false;
	}
	return (
		now - state.lastDeepAt >= DEEP_EVERY_MS &&
		state.speechMsSinceDeep >= DEEP_MIN_SPEECH_MS
	);
}

// ---- Nudges toelaten ---------------------------------------------------------

export type RecentNudge = {
	type: CoachNudgeType;
	text: string;
	detail?: string;
	at: number;
};

export type AdmittedNudge<T extends CoachNudgeCandidate = CoachNudgeCandidate> =
	T & { expiresAt: number };

const RANK: Record<CoachNudgePriority, number> = { high: 0, normal: 1, low: 2 };

function clip(text: string, max: number): string {
	const t = text.replace(/\s+/g, " ").trim();
	return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * Welke kandidaat-nudges echt verschijnen. Geen herhaling (zelfde soort of
 * zelfde inhoud in het afgelopen kwartier), niet vaker dan eens per 45 s
 * tenzij urgent, en hooguit twee tegelijk.
 */
export function admitNudges<T extends CoachNudgeCandidate>(args: {
	candidates: readonly T[];
	recent: readonly RecentNudge[];
	now: number;
	lastNudgeAt: number;
	lastHighNudgeAt: number;
}): AdmittedNudge<T>[] {
	const { now } = args;
	let lastAt = args.lastNudgeAt;
	let lastHigh = args.lastHighNudgeAt;
	const out: AdmittedNudge<T>[] = [];
	const seen: RecentNudge[] = args.recent.filter(
		(r) => now - r.at < 15 * 60_000,
	);
	const sorted = [...args.candidates]
		.filter((c) => c.text.trim().length > 0)
		.sort((a, b) => RANK[a.priority] - RANK[b.priority]);
	for (const c of sorted) {
		if (out.length >= MAX_ACTIVE_NUDGES) break;
		const text = clip(c.text, 90);
		const detail = c.detail ? clip(c.detail, 240) : undefined;
		const body = `${text} ${detail ?? ""}`;
		const repeat = seen.some(
			(r) =>
				similarity(body, `${r.text} ${r.detail ?? ""}`) >= 0.45 ||
				(r.type === c.type &&
					now - r.at < (c.type === "afronden" ? 10 * 60_000 : 90_000)),
		);
		if (repeat) continue;
		if (c.priority === "high") {
			if (now - lastHigh < HIGH_GAP_MS) continue;
			lastHigh = now;
		} else {
			// Twee in één batch mag; een nieuwe batch wacht 45 s.
			const sameBatch = out.length > 0;
			if (!sameBatch && now - lastAt < NUDGE_GAP_MS) continue;
		}
		lastAt = now;
		out.push({ ...c, text, detail, expiresAt: now + NUDGE_TTL_MS[c.type] });
		seen.push({ type: c.type, text, detail, at: now });
	}
	return out;
}

// ---- Regels zonder model -----------------------------------------------------

export type RuleInput = {
	now: number;
	startedAt: number;
	myName: string;
	plannedMinutes?: number;
	agenda: readonly CoachAgendaItem[];
	currentItem?: number;
	currentSince?: number;
	talk: readonly CoachTalk[];
	nextQuestion?: string;
	silenceMs: number;
	myStreakMs: number;
	lastChunkAt: number;
	silenceFiredAt: number;
	monologueFiredAt: number;
	ratioNudgeAt: number;
	tempoWarned: readonly number[];
	wrapUpFired: boolean;
	otherName?: string;
};

export type RuleOutput = {
	/** `mark`: agendapunt (of HALFWAY_MARK) dat als gewaarschuwd telt zodra de nudge echt verschijnt. */
	nudges: (CoachNudgeCandidate & { reason: string; mark?: number })[];
	trigger?: FastReason;
	patch: {
		silenceFiredAt?: number;
		tempoWarned?: number[];
		wrapUpFired?: boolean;
	};
};

/** Marker in tempoWarned voor "halverwege de tijd" (geen agendapunt). */
export const HALFWAY_MARK = -1;

export function runRules(input: RuleInput): RuleOutput {
	const { now } = input;
	const out: RuleOutput = { nudges: [], patch: {} };
	const elapsed = now - input.startedAt;
	const ask = input.nextQuestion?.trim();

	// Monoloog: Arin praat al 90 s aan één stuk.
	if (
		input.myStreakMs >= MONOLOGUE_MS &&
		now - input.monologueFiredAt >= 120_000
	) {
		out.nudges.push({
			type: "ruimte",
			priority: "high",
			text: `Je praat al ${clock(input.myStreakMs)} — geef ruimte`,
			detail: ask
				? `Rond je zin af en vraag: "${ask}"`
				: "Rond je zin af, stel een open vraag en laat de stilte vallen.",
			reason: "monologue",
		});
	}
	const monologue = out.nudges.length > 0;

	// Spreekverhouding over het hele gesprek.
	const { mine, others, share } = talkTotals(input.talk);
	if (
		elapsed >= 6 * 60_000 &&
		mine + others >= 3 * 60_000 &&
		share >= 0.65 &&
		now - input.ratioNudgeAt >= 8 * 60_000 &&
		!monologue
	) {
		const who = input.otherName || "de klant";
		out.nudges.push({
			type: "ruimte",
			priority: "normal",
			text: `Jij ${Math.round(share * 100)}% aan het woord`,
			detail: ask
				? `Laat ${who} meer vertellen. Vraag: "${ask}"`
				: `Laat ${who} meer vertellen: stel een open vraag en wacht.`,
			reason: "ratio",
		});
	}

	// Tempo per agendapunt.
	const warned = [...input.tempoWarned];
	const total = plannedMs(input.agenda, input.plannedMinutes);
	const cur = input.currentItem;
	if (cur !== undefined) {
		const item = input.agenda[cur];
		if (item?.minutes && !warned.includes(cur)) {
			const spent = itemSpentMs(
				input.agenda,
				cur,
				cur,
				input.currentSince,
				now,
			);
			const over = spent - item.minutes * 60_000;
			if (over >= 60_000) {
				const rest = input.agenda.filter((a, i) => i > cur && !a.done);
				const left = total !== null ? total - elapsed : null;
				const next = rest[0]?.title;
				out.nudges.push({
					type: "tempo",
					priority: "normal",
					text: `"${clip(item.title, 40)}" loopt ${minutes(over)} min uit`,
					detail: [
						rest.length
							? `Nog ${rest.length} ${rest.length === 1 ? "punt" : "punten"}${left !== null ? ` in ${Math.max(0, minutes(left))} min` : ""}.`
							: null,
						next ? `Door naar "${clip(next, 50)}"?` : "Rond dit punt af.",
					]
						.filter(Boolean)
						.join(" "),
					reason: "tempo",
					mark: cur,
				});
			}
		}
	}

	// Halverwege de tijd, maar nog niet halverwege de agenda.
	if (
		total !== null &&
		input.agenda.length >= 3 &&
		!warned.includes(HALFWAY_MARK) &&
		elapsed >= total / 2
	) {
		const doneCount = input.agenda.filter((a) => a.done).length;
		const at = cur ?? doneCount;
		if (at < Math.floor(input.agenda.length / 2)) {
			out.nudges.push({
				type: "tempo",
				priority: "normal",
				text: `Halve tijd, pas bij punt ${at + 1} van ${input.agenda.length}`,
				detail: `Nog ${minutes(total - elapsed)} min. Kies wat écht moet en parkeer de rest.`,
				reason: "halfway",
				mark: HALFWAY_MARK,
			});
		} else {
			warned.push(HALFWAY_MARK);
		}
	}
	if (warned.length !== input.tempoWarned.length)
		out.patch.tempoWarned = warned;

	// Laatste 5 minuten: afronden (het model schrijft de inhoud).
	if (total !== null && !input.wrapUpFired && elapsed >= total - 5 * 60_000) {
		out.trigger = "wrapup";
		out.patch.wrapUpFired = true;
	}

	// Lange stilte na spraak.
	if (
		!out.trigger &&
		input.silenceMs >= SILENCE_MS &&
		elapsed >= 45_000 &&
		input.lastChunkAt > input.silenceFiredAt
	) {
		out.trigger = "silence";
		out.patch.silenceFiredAt = now;
	}

	return out;
}
