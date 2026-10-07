import { type Infer, v } from "convex/values";

// Gedeelde validators voor de meeting coach. Los van schema.ts zodat de
// functies en het schema precies dezelfde vorm gebruiken.

/** mic = Arin zelf, tab = het gedeelde Meet-tabblad (de anderen). */
export const coachSourceV = v.union(v.literal("mic"), v.literal("tab"));
export type CoachSource = Infer<typeof coachSourceV>;

export const coachNudgeTypeV = v.union(
	v.literal("vraag"), // Vraag nu
	v.literal("tempo"), // Tempo / agenda
	v.literal("ruimte"), // Je praat lang — geef ruimte / talk ratio
	v.literal("samenvatten"), // Goed moment om samen te vatten
	v.literal("letop"), // Risico: belofte over scope, prijs, deadline
	v.literal("kans"), // Upsell, vervolg, referral, testimonial
	v.literal("afronden"), // Laatste minuten: besluiten, eigenaar, datum
	v.literal("antwoord"), // Er ligt een vraag bij jou
);
export type CoachNudgeType = Infer<typeof coachNudgeTypeV>;

export const coachNudgePriorityV = v.union(
	v.literal("low"),
	v.literal("normal"),
	v.literal("high"),
);
export type CoachNudgePriority = Infer<typeof coachNudgePriorityV>;

export const coachActionItemV = v.object({
	owner: v.string(),
	what: v.string(),
	when: v.optional(v.string()),
});
export type CoachActionItem = Infer<typeof coachActionItemV>;

export const coachAgendaItemV = v.object({
	title: v.string(),
	minutes: v.optional(v.number()),
	spentMs: v.number(),
	done: v.boolean(),
});
export type CoachAgendaItem = Infer<typeof coachAgendaItemV>;

/** Spreektijd per spreker; `key` is "me" of het sprekerlabel. */
export const coachTalkV = v.object({
	key: v.string(),
	isMine: v.boolean(),
	ms: v.number(),
	words: v.number(),
	questions: v.number(),
});
export type CoachTalk = Infer<typeof coachTalkV>;

export const coachChunkInputV = v.object({
	at: v.number(),
	source: coachSourceV,
	speaker: v.union(v.string(), v.null()),
	text: v.string(),
	durationMs: v.optional(v.number()),
});
export type CoachChunkInput = Infer<typeof coachChunkInputV>;

export const coachNudgeCandidateV = v.object({
	type: coachNudgeTypeV,
	priority: coachNudgePriorityV,
	text: v.string(),
	detail: v.optional(v.string()),
});
export type CoachNudgeCandidate = Infer<typeof coachNudgeCandidateV>;

export const usageV = v.object({
	kind: v.string(),
	model: v.string(),
	inputTokens: v.number(),
	outputTokens: v.number(),
	costUsd: v.optional(v.number()),
});
export type UsageRow = Infer<typeof usageV>;
