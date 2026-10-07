import {
	AlertTriangleIcon,
	FlagIcon,
	GaugeIcon,
	HandIcon,
	type LucideIcon,
	MessageCircleQuestionIcon,
	MessageSquareReplyIcon,
	ScrollTextIcon,
	SparklesIcon,
} from "lucide-react";
import type { Doc } from "~convex/_generated/dataModel";

export type NudgeType = Doc<"coachNudges">["type"];

/** Per soort nudge: label, icoon en kleur. Rustig, maar in één blik herkenbaar. */
export const NUDGE_META: Record<
	NudgeType,
	{ label: string; icon: LucideIcon; accent: string; soft: string }
> = {
	vraag: {
		label: "Vraag nu",
		icon: MessageCircleQuestionIcon,
		accent: "text-sky-600 dark:text-sky-400",
		soft: "border-sky-500/25 bg-sky-500/8",
	},
	antwoord: {
		label: "Antwoord",
		icon: MessageSquareReplyIcon,
		accent: "text-violet-600 dark:text-violet-400",
		soft: "border-violet-500/25 bg-violet-500/8",
	},
	tempo: {
		label: "Tempo",
		icon: GaugeIcon,
		accent: "text-amber-600 dark:text-amber-400",
		soft: "border-amber-500/25 bg-amber-500/8",
	},
	ruimte: {
		label: "Geef ruimte",
		icon: HandIcon,
		accent: "text-orange-600 dark:text-orange-400",
		soft: "border-orange-500/25 bg-orange-500/8",
	},
	samenvatten: {
		label: "Samenvatten",
		icon: ScrollTextIcon,
		accent: "text-teal-600 dark:text-teal-400",
		soft: "border-teal-500/25 bg-teal-500/8",
	},
	letop: {
		label: "Let op",
		icon: AlertTriangleIcon,
		accent: "text-rose-600 dark:text-rose-400",
		soft: "border-rose-500/30 bg-rose-500/10",
	},
	kans: {
		label: "Kans",
		icon: SparklesIcon,
		accent: "text-emerald-600 dark:text-emerald-400",
		soft: "border-emerald-500/25 bg-emerald-500/8",
	},
	afronden: {
		label: "Afronden",
		icon: FlagIcon,
		accent: "text-indigo-600 dark:text-indigo-400",
		soft: "border-indigo-500/25 bg-indigo-500/8",
	},
};

export function clock(ms: number): string {
	const s = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = String(s % 60).padStart(2, "0");
	return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function minutes(ms: number): string {
	const m = Math.round(ms / 60_000);
	return `${m} min`;
}

export function formatDate(ms: number): string {
	return new Date(ms).toLocaleDateString("nl-NL", {
		weekday: "short",
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function speakerLabel(
	session: Pick<Doc<"coachSessions">, "speakerNames" | "myName">,
	chunk: Pick<Doc<"coachChunks">, "speaker" | "isMine">,
): string {
	if (chunk.isMine) return session.myName;
	const label = chunk.speaker;
	if (!label) return "Ander";
	const named = session.speakerNames?.find((s) => s.label === label)?.name;
	if (named) return named;
	const sm = /^S(\d+)$/.exec(label);
	return sm ? `Spreker ${sm[1]}` : label;
}

/** Actief = niet weggeklikt en nog niet verlopen; urgent eerst, dan nieuwste. */
export function activeNudges(
	nudges: readonly Doc<"coachNudges">[],
	now: number,
): Doc<"coachNudges">[] {
	const rank = { high: 0, normal: 1, low: 2 } as const;
	return nudges
		.filter((n) => !n.dismissedAt && n.expiresAt > now)
		.sort((a, b) => rank[a.priority] - rank[b.priority] || b.at - a.at)
		.slice(0, 2);
}

/** Spreektijd: aandeel van jou en per spreker. */
export function talkSplit(talk: Doc<"coachState">["talk"]) {
	let mine = 0;
	let others = 0;
	for (const t of talk) {
		if (t.isMine) mine += Math.max(0, t.ms);
		else others += Math.max(0, t.ms);
	}
	const total = mine + others;
	return { mine, others, total, share: total > 0 ? mine / total : 0 };
}

export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

/**
 * Eén punt per regel. Minuten mogen erachter: "Kennismaking 5",
 * "Budget – 10 min", "Demo (15')". Opsommingstekens en nummers vallen weg.
 */
export function parseAgenda(
	text: string,
): { title: string; minutes?: number }[] {
	return text
		.split("\n")
		.map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
		.filter(Boolean)
		.slice(0, 20)
		.map((line) => {
			const m =
				/^(.*?)(?:\s+|\s*[:–—-]\s*|\s*\()(\d{1,3})\s*(?:min(?:uten)?|m|')?\)?$/i.exec(
					line,
				);
			if (m?.[1] && m[2]) {
				return { title: m[1].trim(), minutes: Number(m[2]) };
			}
			return { title: line };
		});
}
