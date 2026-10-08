import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "../_generated/server";
import { requireOwner } from "../lib/auth";
import {
	addTalk,
	admitNudges,
	deepDue,
	estimateSpeechMs,
	extendRun,
	type FastReason,
	fastDue,
	isEcho,
	isGenericLabel,
	isMeLabel,
	isQuestionForMe,
	isUrgent,
	MAX_ACTIVE_NUDGES,
	nextSpeakerLabel,
	renameIn,
	runRules,
	runStreakMs,
	switchAgenda,
	talkTotals,
	validVoiceName,
	wordCount,
} from "./engine";
import {
	type CoachChunkInput,
	type CoachNudgeCandidate,
	coachActionItemV,
	coachChunkInputV,
	coachModelV,
	coachNudgeCandidateV,
	DEFAULT_COACH_MODEL,
	type UsageRow,
	usageV,
} from "./validators";

// De meeting coach (/coach): sessies, transcriptregels, nudges, screenshots en
// het verslag. De modelaanroepen staan in ai.ts; de regels (wanneer draait er
// een ronde, welke nudge mag erdoor) in engine.ts.

const MAX_CHUNKS = 6000;
const MAX_SHOTS = 200;
const MAX_TEXT = 2000;
const ECHO_WINDOW_MS = 10_000;

// ---- Helpers -----------------------------------------------------------------

async function ownedSession(
	ctx: QueryCtx | MutationCtx,
	sessionId: Id<"coachSessions">,
): Promise<Doc<"coachSessions">> {
	const userId = await requireOwner(ctx);
	const session = await ctx.db.get(sessionId);
	if (!session || session.ownerId !== userId) {
		throw new ConvexError("Dit gesprek bestaat niet (meer).");
	}
	return session;
}

/** Voor queries: null in plaats van een fout als je niet (meer) ingelogd bent. */
async function readableSession(
	ctx: QueryCtx,
	sessionId: Id<"coachSessions">,
): Promise<Doc<"coachSessions"> | null> {
	const userId = await getAuthUserId(ctx);
	if (!userId) return null;
	const session = await ctx.db.get(sessionId);
	return session && session.ownerId === userId ? session : null;
}

async function stateOf(
	ctx: QueryCtx | MutationCtx,
	sessionId: Id<"coachSessions">,
): Promise<Doc<"coachState">> {
	const state = await ctx.db
		.query("coachState")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.unique();
	if (!state) throw new ConvexError("Coachstatus ontbreekt.");
	return state;
}

function clean(text: string, max: number): string {
	return text.replace(/\s+/g, " ").trim().slice(0, max);
}

async function logUsage(
	ctx: MutationCtx,
	session: Doc<"coachSessions">,
	usage: UsageRow,
): Promise<number> {
	await ctx.db.insert("aiUsage", {
		ownerId: session.ownerId,
		feature: "coach",
		kind: usage.kind,
		coachSessionId: session._id,
		model: usage.model,
		inputTokens: usage.inputTokens,
		outputTokens: usage.outputTokens,
		costUsd: usage.costUsd,
		at: Date.now(),
	});
	return usage.costUsd ?? 0;
}

/**
 * Start een snelle en/of diepe ronde als dat nu moet. Schrijft alleen de
 * boekhouding; het werk zelf draait als action.
 */
async function maybeRun(
	ctx: MutationCtx,
	session: Doc<"coachSessions">,
	state: Doc<"coachState">,
	reason: FastReason,
	now: number,
): Promise<void> {
	if (session.status !== "live") return;
	const patch: Partial<Doc<"coachState">> = {};
	const fast = fastDue(state, now, reason);
	if (fast === "run") {
		Object.assign(patch, {
			fastRunningSince: now,
			lastFastAt: now,
			speechMsSinceFast: 0,
			fastCalls: state.fastCalls + 1,
			pendingReason: undefined,
		});
		await ctx.scheduler.runAfter(0, internal.coach.ai.fastPass, {
			sessionId: session._id,
			reason,
		});
	} else if (fast === "queue") {
		const keep =
			state.pendingReason && isUrgent(state.pendingReason)
				? state.pendingReason
				: reason;
		if (keep !== state.pendingReason) patch.pendingReason = keep;
	}
	if (deepDue(state, now)) {
		Object.assign(patch, {
			deepRunningSince: now,
			lastDeepAt: now,
			speechMsSinceDeep: 0,
			deepCalls: state.deepCalls + 1,
		});
		await ctx.scheduler.runAfter(0, internal.coach.ai.deepPass, {
			sessionId: session._id,
		});
	}
	if (Object.keys(patch).length > 0) await ctx.db.patch(state._id, patch);
}

/**
 * Definitieve regels opslaan (van Speechmatics in de browser of van de
 * gateway). Haalt echo weg, telt spreektijd en kijkt of de coach moet draaien.
 */
async function ingest(
	ctx: MutationCtx,
	session: Doc<"coachSessions">,
	chunks: CoachChunkInput[],
): Promise<number> {
	if (session.status !== "live" && session.status !== "finishing") return 0;
	const now = Date.now();
	let state = await stateOf(ctx, session._id);
	let talk = state.talk;
	let speech = 0;
	let lastChunkAt = state.lastChunkAt;
	let reason: FastReason = "cadence";
	let inserted = 0;
	const live = session.mode === "live";
	let meLabel = session.meLabel;
	let run =
		state.myRunStart !== undefined && state.myRunEnd !== undefined
			? { start: state.myRunStart, end: state.myRunEnd }
			: undefined;

	for (const chunk of chunks.slice(0, 50)) {
		const text = clean(chunk.text, MAX_TEXT);
		if (!text) continue;
		const at =
			chunk.at > session.startedAt - 60_000 && chunk.at < now + 10_000
				? Math.round(chunk.at)
				: now;
		const rawSpeaker = chunk.speaker ? clean(chunk.speaker, 40) : null;
		// Live: één microfoon voor iedereen, dus "jij" volgt uit het label.
		// Herkende Speechmatics je stem, dan is het label je naam.
		const byName = !session.voiceOff;
		if (
			live &&
			!meLabel &&
			isMeLabel(rawSpeaker, undefined, session.myName, byName)
		) {
			meLabel = rawSpeaker ?? undefined;
			await ctx.db.patch(session._id, { meLabel });
		}
		const isMine = live
			? isMeLabel(rawSpeaker, meLabel, session.myName, byName)
			: chunk.source === "mic";
		const near = live
			? []
			: await ctx.db
					.query("coachChunks")
					.withIndex("by_session_and_at", (q) =>
						q
							.eq("sessionId", session._id)
							.gte("at", at - ECHO_WINDOW_MS)
							.lte("at", at + ECHO_WINDOW_MS),
					)
					.take(20);
		if (live) {
			// geen echo mogelijk: er is maar één bron
		} else if (isMine) {
			// De microfoon ving de luidspreker op: dit zeiden de anderen.
			if (near.some((c) => !c.isMine && isEcho(text, c.text))) continue;
		} else {
			for (const c of near) {
				if (c.isMine && isEcho(c.text, text)) {
					await ctx.db.delete(c._id);
					talk = addTalk(
						talk,
						"me",
						true,
						-c.durationMs,
						-wordCount(c.text),
						-(c.text.match(/\?/g)?.length ?? 0),
					);
				}
			}
		}
		const durationMs = Math.min(
			60_000,
			Math.max(300, Math.round(chunk.durationMs ?? estimateSpeechMs(text))),
		);
		const speaker = live ? rawSpeaker : isMine ? null : rawSpeaker;
		await ctx.db.insert("coachChunks", {
			sessionId: session._id,
			at,
			source: chunk.source,
			speaker,
			text,
			isMine,
			durationMs,
		});
		inserted++;
		talk = addTalk(
			talk,
			isMine ? "me" : (speaker ?? "?"),
			isMine,
			durationMs,
			wordCount(text),
			text.match(/\?/g)?.length ?? 0,
		);
		speech += durationMs;
		lastChunkAt = Math.max(lastChunkAt, at + durationMs);
		run = extendRun(run, { isMine, at, durationMs, text });
		// Weten we (nog) niet wie jij bent, dan alleen als je naam valt.
		const identified = !live || !!meLabel;
		if (
			!isMine &&
			isQuestionForMe(text, session.myName) &&
			(identified || text.toLowerCase().includes(session.myName.toLowerCase()))
		) {
			reason = "question";
		}
	}
	if (inserted === 0) return 0;

	await ctx.db.patch(state._id, {
		talk,
		lastChunkAt,
		myRunStart: run?.start,
		myRunEnd: run?.end,
		speechMsSinceFast: state.speechMsSinceFast + speech,
		speechMsSinceDeep: state.speechMsSinceDeep + speech,
	});
	state = await stateOf(ctx, session._id);
	await maybeRun(ctx, session, state, reason, now);
	return inserted;
}

// ---- Lezen -------------------------------------------------------------------

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];
		const sessions = await ctx.db
			.query("coachSessions")
			.withIndex("by_owner_and_startedAt", (q) => q.eq("ownerId", userId))
			.order("desc")
			.take(100);
		return sessions.map((s) => ({
			_id: s._id,
			title: s.title,
			clientId: s.clientId ?? null,
			clientName: s.clientName ?? null,
			goal: s.goal ?? null,
			status: s.status,
			startedAt: s.startedAt,
			durationMs: s.durationMs ?? null,
			reportPreview: s.reportPreview ?? null,
		}));
	},
});

export const get = query({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await readableSession(ctx, args.sessionId);
		if (!session) return null;
		const report = await ctx.db
			.query("coachReports")
			.withIndex("by_session", (q) => q.eq("sessionId", session._id))
			.unique();
		return { session, report };
	},
});

export const live = query({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await readableSession(ctx, args.sessionId);
		if (!session) return null;
		return await ctx.db
			.query("coachState")
			.withIndex("by_session", (q) => q.eq("sessionId", session._id))
			.unique();
	},
});

export const chunks = query({
	args: {
		sessionId: v.id("coachSessions"),
		recent: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const session = await readableSession(ctx, args.sessionId);
		if (!session) return [];
		const q = ctx.db
			.query("coachChunks")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id));
		if (args.recent) {
			const rows = await q.order("desc").take(Math.min(args.recent, 400));
			return rows.reverse();
		}
		return await q.take(MAX_CHUNKS);
	},
});

export const nudges = query({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await readableSession(ctx, args.sessionId);
		if (!session) return [];
		return await ctx.db
			.query("coachNudges")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
			.order("desc")
			.take(150);
	},
});

export const shots = query({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await readableSession(ctx, args.sessionId);
		if (!session) return [];
		const rows = await ctx.db
			.query("coachShots")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
			.order("desc")
			.take(MAX_SHOTS);
		return await Promise.all(
			rows.map(async (s) => ({
				_id: s._id,
				at: s.at,
				auto: s.auto,
				status: s.status,
				description: s.description ?? null,
				url: await ctx.storage.getUrl(s.storageId),
			})),
		);
	},
});

/** Kosten van de coach over de laatste 30 dagen (alle modelaanroepen). */
export const usage = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;
		const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
		const rows = await ctx.db
			.query("aiUsage")
			.withIndex("by_owner_and_at", (q) =>
				q.eq("ownerId", userId).gte("at", since),
			)
			.take(5000);
		let costUsd = 0;
		for (const r of rows) if (r.feature === "coach") costUsd += r.costUsd ?? 0;
		return { calls: rows.length, costUsd };
	},
});

// ---- Starten en stoppen --------------------------------------------------------

const agendaInputV = v.array(
	v.object({ title: v.string(), minutes: v.optional(v.number()) }),
);

export const create = mutation({
	args: {
		title: v.string(),
		clientId: v.optional(v.id("clients")),
		goal: v.optional(v.string()),
		context: v.optional(v.string()),
		myName: v.optional(v.string()),
		agenda: agendaInputV,
		plannedMinutes: v.optional(v.number()),
		mode: v.optional(v.union(v.literal("online"), v.literal("live"))),
		model: v.optional(coachModelV),
	},
	handler: async (ctx, args): Promise<Id<"coachSessions">> => {
		const userId = await requireOwner(ctx);
		let clientName: string | undefined;
		if (args.clientId) {
			const client = await ctx.db.get(args.clientId);
			if (!client || client.ownerId !== userId) {
				throw new ConvexError("Klant niet gevonden.");
			}
			clientName = client.companyName || client.name;
		}
		const agenda = args.agenda
			.map((a) => ({
				title: clean(a.title, 120),
				minutes:
					a.minutes && a.minutes > 0
						? Math.min(240, Math.round(a.minutes))
						: undefined,
			}))
			.filter((a) => a.title)
			.slice(0, 20);
		const planned =
			args.plannedMinutes && args.plannedMinutes > 0
				? Math.min(480, Math.round(args.plannedMinutes))
				: undefined;
		const now = Date.now();
		const title =
			clean(args.title, 120) ||
			(clientName ? `Gesprek met ${clientName}` : "Gesprek");
		const sessionId = await ctx.db.insert("coachSessions", {
			ownerId: userId,
			title,
			clientId: args.clientId,
			clientName,
			goal: args.goal ? clean(args.goal, 300) || undefined : undefined,
			context: args.context?.trim().slice(0, 3000) || undefined,
			myName: clean(args.myName ?? "", 40) || "Arin",
			agenda,
			plannedMinutes: planned,
			mode: args.mode ?? "online",
			model: args.model,
			status: "live",
			startedAt: now,
		});
		await ctx.db.insert("coachState", {
			sessionId,
			ownerId: userId,
			lastChunkAt: 0,
			speechMsSinceFast: 0,
			speechMsSinceDeep: 0,
			lastFastAt: 0,
			lastDeepAt: now,
			deepCursorAt: 0,
			lastNudgeAt: 0,
			lastHighNudgeAt: 0,
			silenceFiredAt: 0,
			monologueFiredAt: 0,
			ratioNudgeAt: 0,
			tempoWarned: [],
			wrapUpFired: false,
			fastCalls: 0,
			deepCalls: 0,
			costUsd: 0,
			silenceMs: 0,
			myStreakMs: 0,
			signalsAt: now,
			summary: [],
			decisions: [],
			actionItems: [],
			openQuestions: [],
			agenda: agenda.map((a) => ({ ...a, spentMs: 0, done: false })),
			currentItem: agenda.length > 0 ? 0 : undefined,
			currentSince: agenda.length > 0 ? now : undefined,
			talk: [],
		});
		return sessionId;
	},
});

export const setProvider = mutation({
	args: {
		sessionId: v.id("coachSessions"),
		provider: v.union(v.literal("speechmatics"), v.literal("gateway")),
	},
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		if (session.provider !== args.provider) {
			await ctx.db.patch(session._id, { provider: args.provider });
		}
		return null;
	},
});

async function finish(
	ctx: MutationCtx,
	session: Doc<"coachSessions">,
	endedAt: number,
): Promise<void> {
	const state = await stateOf(ctx, session._id);
	const closed = switchAgenda(
		state.agenda,
		state.currentItem,
		state.currentSince,
		undefined,
		endedAt,
	);
	await ctx.db.patch(state._id, {
		agenda: closed.agenda,
		currentItem: undefined,
		currentSince: undefined,
	});
	await ctx.db.patch(session._id, {
		status: "finishing",
		endedAt,
		durationMs: Math.max(0, endedAt - session.startedAt),
	});
	await ctx.scheduler.runAfter(3_000, internal.coach.ai.finalReport, {
		sessionId: session._id,
	});
}

/** Stop: de laatste regels zijn binnen, nu het verslag. */
export const stop = mutation({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		if (session.status !== "live") return null;
		await finish(ctx, session, Date.now());
		return null;
	},
});

/**
 * Tab dicht of laptop dicht zonder Stop: na 20 minuten zonder hartslag sluit
 * de server het gesprek zelf af en maakt hij het verslag.
 */
export const closeStale = internalMutation({
	args: {},
	handler: async (ctx) => {
		const live = await ctx.db
			.query("coachSessions")
			.withIndex("by_status", (q) => q.eq("status", "live"))
			.take(50);
		const cutoff = Date.now() - 20 * 60_000;
		for (const session of live) {
			const state = await stateOf(ctx, session._id);
			const lastSign = Math.max(state.signalsAt, state.lastChunkAt);
			if (lastSign < cutoff) await finish(ctx, session, lastSign);
		}
		return null;
	},
});

export const retryReport = mutation({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		if (session.status !== "error" && session.status !== "done") return null;
		await ctx.db.patch(session._id, { status: "finishing" });
		await ctx.scheduler.runAfter(0, internal.coach.ai.finalReport, {
			sessionId: session._id,
		});
		return null;
	},
});

export const update = mutation({
	args: {
		sessionId: v.id("coachSessions"),
		title: v.optional(v.string()),
		clientId: v.optional(v.union(v.id("clients"), v.null())),
	},
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		const patch: Partial<Doc<"coachSessions">> = {};
		if (args.title !== undefined) {
			const title = clean(args.title, 120);
			if (title) patch.title = title;
		}
		if (args.clientId === null) {
			patch.clientId = undefined;
			patch.clientName = undefined;
		} else if (args.clientId) {
			const client = await ctx.db.get(args.clientId);
			if (!client || client.ownerId !== session.ownerId) {
				throw new ConvexError("Klant niet gevonden.");
			}
			patch.clientId = client._id;
			patch.clientName = client.companyName || client.name;
		}
		await ctx.db.patch(session._id, patch);
		const report = await ctx.db
			.query("coachReports")
			.withIndex("by_session", (q) => q.eq("sessionId", session._id))
			.unique();
		if (report && "clientId" in patch) {
			await ctx.db.patch(report._id, { clientId: patch.clientId });
		}
		return null;
	},
});

export const remove = mutation({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		await ctx.scheduler.runAfter(0, internal.coach.sessions.purge, {
			sessionId: session._id,
		});
		await ctx.db.delete(session._id);
		return null;
	},
});

/** Ruimt alles van een verwijderd gesprek op, in porties. */
export const purge = internalMutation({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const batch = 300;
		const chunks = await ctx.db
			.query("coachChunks")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", args.sessionId))
			.take(batch);
		for (const c of chunks) await ctx.db.delete(c._id);
		const nudges = await ctx.db
			.query("coachNudges")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", args.sessionId))
			.take(batch);
		for (const n of nudges) await ctx.db.delete(n._id);
		const asks = await ctx.db
			.query("coachAsks")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", args.sessionId))
			.take(batch);
		for (const a of asks) await ctx.db.delete(a._id);
		const shots = await ctx.db
			.query("coachShots")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", args.sessionId))
			.take(50);
		for (const s of shots) {
			await ctx.storage.delete(s.storageId);
			await ctx.db.delete(s._id);
		}
		const more =
			chunks.length === batch ||
			nudges.length === batch ||
			asks.length === batch ||
			shots.length === 50;
		if (more) {
			await ctx.scheduler.runAfter(0, internal.coach.sessions.purge, args);
			return null;
		}
		const state = await ctx.db
			.query("coachState")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (state) await ctx.db.delete(state._id);
		const report = await ctx.db
			.query("coachReports")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (report) await ctx.db.delete(report._id);
		return null;
	},
});

// ---- Tijdens het gesprek -------------------------------------------------------

/** Definitieve regels uit de browser (Speechmatics). */
export const addChunks = mutation({
	args: {
		sessionId: v.id("coachSessions"),
		chunks: v.array(coachChunkInputV),
	},
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		return await ingest(ctx, session, args.chunks);
	},
});

/**
 * Hartslag uit de browser, elke ±5 s: stilte en monoloog meet de browser (die
 * hoort het meteen). Hier draaien de regels zonder model: tempo, monoloog,
 * spreekverhouding, en de directe triggers voor stilte en afronden.
 */
export const pulse = mutation({
	args: {
		sessionId: v.id("coachSessions"),
		silenceMs: v.number(),
		myStreakMs: v.number(),
	},
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		if (session.status !== "live") return null;
		const now = Date.now();
		const state = await stateOf(ctx, session._id);
		const others = state.talk.filter((t) => !t.isMine);
		const named = others.length
			? session.speakerNames?.find((s) => s.label === others[0]?.key)?.name
			: undefined;
		const live = session.mode === "live";
		// Live meet de browser geen monoloog (één microfoon); dat doen de regels.
		const myStreakMs = live
			? runStreakMs(
					state.myRunStart !== undefined && state.myRunEnd !== undefined
						? { start: state.myRunStart, end: state.myRunEnd }
						: undefined,
					now,
				)
			: Math.max(0, args.myStreakMs);
		const rules = runRules({
			now,
			identified: !live || !!session.meLabel,
			startedAt: session.startedAt,
			myName: session.myName,
			plannedMinutes: session.plannedMinutes,
			agenda: state.agenda,
			currentItem: state.currentItem,
			currentSince: state.currentSince,
			talk: state.talk,
			nextQuestion: state.nextQuestion,
			silenceMs: Math.max(0, args.silenceMs),
			myStreakMs,
			lastChunkAt: state.lastChunkAt,
			silenceFiredAt: state.silenceFiredAt,
			monologueFiredAt: state.monologueFiredAt,
			ratioNudgeAt: state.ratioNudgeAt,
			tempoWarned: state.tempoWarned,
			wrapUpFired: state.wrapUpFired,
			otherName: named ?? session.clientName,
		});
		const patch: Partial<Doc<"coachState">> = {
			...rules.patch,
			silenceMs: Math.round(args.silenceMs),
			myStreakMs: Math.round(myStreakMs),
			signalsAt: now,
		};
		if (rules.nudges.length > 0) {
			const { patch: nudgePatch, admitted } = await insertNudges(
				ctx,
				session,
				state,
				rules.nudges,
				"rule",
			);
			Object.assign(patch, nudgePatch);
			// Alleen wat echt verscheen telt als "gezegd".
			const warned = [...(patch.tempoWarned ?? state.tempoWarned)];
			for (const n of admitted) {
				if (n.reason === "monologue") patch.monologueFiredAt = now;
				if (n.reason === "ratio") patch.ratioNudgeAt = now;
				if (n.mark !== undefined && !warned.includes(n.mark))
					warned.push(n.mark);
			}
			if (warned.length !== state.tempoWarned.length)
				patch.tempoWarned = warned;
		}
		await ctx.db.patch(state._id, patch);
		const fresh = await stateOf(ctx, session._id);
		const reason: FastReason =
			rules.trigger ??
			(fresh.pendingReason as FastReason | undefined) ??
			"cadence";
		await maybeRun(ctx, session, fresh, reason, now);
		return null;
	},
});

/** Handmatig: "Coach nu" (sneltoets). */
export const nudgeNow = mutation({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		const state = await stateOf(ctx, session._id);
		await maybeRun(ctx, session, state, "manual", Date.now());
		return null;
	},
});

/** Handmatig het huidige agendapunt kiezen (de coach doet het ook zelf). */
export const setAgendaItem = mutation({
	args: {
		sessionId: v.id("coachSessions"),
		index: v.union(v.number(), v.null()),
	},
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		const state = await stateOf(ctx, session._id);
		const next =
			args.index === null || !state.agenda[args.index] ? undefined : args.index;
		const switched = switchAgenda(
			state.agenda,
			state.currentItem,
			state.currentSince,
			next,
			Date.now(),
		);
		await ctx.db.patch(state._id, switched);
		return null;
	},
});

export const dismissNudge = mutation({
	args: { nudgeId: v.id("coachNudges") },
	handler: async (ctx, args) => {
		const nudge = await ctx.db.get(args.nudgeId);
		if (!nudge) return null;
		await ownedSession(ctx, nudge.sessionId);
		if (!nudge.dismissedAt) {
			await ctx.db.patch(nudge._id, { dismissedAt: Date.now() });
		}
		return null;
	},
});

export const renameSpeaker = mutation({
	args: {
		sessionId: v.id("coachSessions"),
		label: v.string(),
		name: v.string(),
	},
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		const label = args.label.trim().slice(0, 40);
		if (!label) return null;
		const name = clean(args.name, 40);
		await ctx.db.patch(session._id, {
			speakerNames: renameIn(session.speakerNames ?? [], label, name),
		});
		// Live: stem van deze persoon onthouden, dan herkent Speechmatics hem
		// de volgende keer met zijn naam.
		const ids = session.speakerIds?.find((s) => s.label === label)?.identifiers;
		if (
			session.mode === "live" &&
			name &&
			ids?.length &&
			isGenericLabel(label)
		) {
			await rememberVoice(ctx, session.ownerId, name, ids);
		}
		return null;
	},
});

/** Model voor diepe ronde, vragen en verslag; ook tijdens het gesprek. */
export const setModel = mutation({
	args: { sessionId: v.id("coachSessions"), model: coachModelV },
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		await ctx.db.patch(session._id, { model: args.model });
		return null;
	},
});

// ---- Vragen aan de coach ----------------------------------------------------------

const MAX_ASKS = 200;

export const asks = query({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await readableSession(ctx, args.sessionId);
		if (!session) return [];
		return await ctx.db
			.query("coachAsks")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
			.order("desc")
			.take(50);
	},
});

/** "Vraag iets…": tijdens of na het gesprek. Het antwoord komt vanzelf binnen. */
export const ask = mutation({
	args: { sessionId: v.id("coachSessions"), question: v.string() },
	handler: async (ctx, args): Promise<Id<"coachAsks">> => {
		const session = await ownedSession(ctx, args.sessionId);
		const question = clean(args.question, 600);
		if (!question) throw new ConvexError("Typ eerst een vraag.");
		const existing = await ctx.db
			.query("coachAsks")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
			.take(MAX_ASKS);
		if (existing.length >= MAX_ASKS) {
			throw new ConvexError("Maximum aantal vragen voor dit gesprek bereikt.");
		}
		const askId = await ctx.db.insert("coachAsks", {
			sessionId: session._id,
			at: Date.now(),
			question,
			status: "pending",
			model: session.model ?? DEFAULT_COACH_MODEL,
		});
		await ctx.scheduler.runAfter(0, internal.coach.ai.answerAsk, { askId });
		return askId;
	},
});

export const askContext = internalQuery({
	args: { askId: v.id("coachAsks") },
	handler: async (ctx, args) => {
		const ask = await ctx.db.get(args.askId);
		if (!ask) return null;
		const session = await ctx.db.get(ask.sessionId);
		if (!session) return null;
		const state = await stateOf(ctx, session._id);
		const chunks = await ctx.db
			.query("coachChunks")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
			.take(MAX_CHUNKS);
		const earlier = await ctx.db
			.query("coachAsks")
			.withIndex("by_session_and_at", (q) =>
				q.eq("sessionId", session._id).lt("at", ask.at),
			)
			.order("desc")
			.take(4);
		const shots = await shotNotes(ctx, session._id, 0, 40);
		return { ask, session, state, chunks, shots, earlier: earlier.reverse() };
	},
});

export const saveAsk = internalMutation({
	args: {
		askId: v.id("coachAsks"),
		answer: v.optional(v.string()),
		usage: v.optional(usageV),
	},
	handler: async (ctx, args) => {
		const ask = await ctx.db.get(args.askId);
		if (!ask) return null;
		const session = await ctx.db.get(ask.sessionId);
		if (session && args.usage) {
			const cost = await logUsage(ctx, session, args.usage);
			const state = await stateOf(ctx, session._id);
			await ctx.db.patch(state._id, { costUsd: state.costUsd + cost });
		}
		await ctx.db.patch(ask._id, {
			status: args.answer ? "done" : "error",
			answer: args.answer?.slice(0, 4000),
		});
		return null;
	},
});

// ---- Live: wie ben jij, en je stem onthouden ----------------------------------------

const MAX_IDS_PER_VOICE = 4;
/** Speechmatics accepteert max. 50 kenmerken over alle sprekers samen. */
const MAX_IDS_SENT = 50;

const VOICE_VERSION = 2;

async function rememberVoice(
	ctx: MutationCtx,
	ownerId: Id<"users">,
	name: string,
	identifiers: string[],
): Promise<void> {
	if (!validVoiceName(name) || identifiers.length === 0) return;
	const existing = await ctx.db
		.query("coachVoices")
		.withIndex("by_owner_and_name", (q) =>
			q.eq("ownerId", ownerId).eq("name", name),
		)
		.unique();
	// Vervangen, niet samenvoegen: een stem die je net aanwees is de waarheid.
	// Samenvoegen mengde eerder andere stemmen in "Arin" (na "wijzig"), en dan
	// labelde Speechmatics iedereen als Arin.
	const merged = identifiers.slice(0, MAX_IDS_PER_VOICE);
	if (existing) {
		await ctx.db.patch(existing._id, {
			identifiers: merged,
			updatedAt: Date.now(),
			version: VOICE_VERSION,
		});
	} else {
		await ctx.db.insert("coachVoices", {
			ownerId,
			name,
			identifiers: merged,
			updatedAt: Date.now(),
			version: VOICE_VERSION,
		});
	}
}

/**
 * "Dit ben ik": dit sprekerlabel ben jij. Herberekent wie wat zei en de
 * spreektijd, en onthoudt je stem als Speechmatics kenmerken leverde.
 */
/** Na een wijziging in wie wie is: isMine, spreektijd en je beurt opnieuw. */
async function recompute(
	ctx: MutationCtx,
	session: Doc<"coachSessions">,
): Promise<void> {
	const chunks = await ctx.db
		.query("coachChunks")
		.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
		.take(MAX_CHUNKS);
	let talk: Doc<"coachState">["talk"] = [];
	let run: { start: number; end: number } | undefined;
	for (const c of chunks) {
		// Online volgt "jij" uit de bron (microfoon), fysiek uit de spreker.
		const isMine =
			session.mode === "live"
				? isMeLabel(
						c.speaker,
						session.meLabel,
						session.myName,
						!session.voiceOff,
					)
				: c.source === "mic";
		if (isMine !== c.isMine) await ctx.db.patch(c._id, { isMine });
		talk = addTalk(
			talk,
			isMine ? "me" : (c.speaker ?? "?"),
			isMine,
			c.durationMs,
			wordCount(c.text),
			c.text.match(/\?/g)?.length ?? 0,
		);
		run = extendRun(run, {
			isMine,
			at: c.at,
			durationMs: c.durationMs,
			text: c.text,
		});
	}
	const state = await stateOf(ctx, session._id);
	await ctx.db.patch(state._id, {
		talk,
		myRunStart: run?.start,
		myRunEnd: run?.end,
	});
}

export const setMe = mutation({
	args: {
		sessionId: v.id("coachSessions"),
		label: v.union(v.string(), v.null()),
	},
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		if (session.mode !== "live") return null;
		const meLabel = args.label ? clean(args.label, 40) || undefined : undefined;
		await ctx.db.patch(session._id, { meLabel });
		await recompute(ctx, { ...session, meLabel });
		// Alleen een algemeen label (S2) dat je zelf aanwees wordt je stem;
		// het label met je naam komt al van de opgeslagen stem.
		const ids =
			meLabel && isGenericLabel(meLabel)
				? session.speakerIds?.find((s) => s.label === meLabel)?.identifiers
				: undefined;
		if (ids?.length) {
			await rememberVoice(ctx, session.ownerId, session.myName, ids);
		}
		return null;
	},
});

/**
 * "Arin is niet iedereen": vergeet je opgeslagen stem, tel het label met je
 * naam niet meer als jij, en laat de browser opnieuw verbinden zonder stem.
 */
export const resetVoice = mutation({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		const voice = await ctx.db
			.query("coachVoices")
			.withIndex("by_owner_and_name", (q) =>
				q.eq("ownerId", session.ownerId).eq("name", session.myName),
			)
			.unique();
		if (voice) await ctx.db.delete(voice._id);
		const patch = { voiceOff: true, meLabel: undefined };
		await ctx.db.patch(session._id, patch);
		await recompute(ctx, { ...session, ...patch });
		return null;
	},
});

/** Eén regel aan een andere (of nieuwe) spreker toewijzen. */
export const reassignChunk = mutation({
	args: {
		chunkId: v.id("coachChunks"),
		/** Bestaand label, of null voor een nieuwe spreker. */
		label: v.union(v.string(), v.null()),
	},
	handler: async (ctx, args): Promise<string | null> => {
		const chunk = await ctx.db.get(args.chunkId);
		if (!chunk) return null;
		const session = await ownedSession(ctx, chunk.sessionId);
		const state = await stateOf(ctx, session._id);
		const label =
			args.label?.trim().slice(0, 40) ||
			nextSpeakerLabel([
				...state.talk.map((t) => t.key),
				...(session.speakerNames ?? []).map((s) => s.label),
				...(session.meLabel ? [session.meLabel] : []),
			]);
		await ctx.db.patch(chunk._id, { speaker: label });
		await recompute(ctx, session);
		return label;
	},
});

/** Stemkenmerken uit Speechmatics' SpeakersResult (live, elke ±45 s). */
export const saveSpeakerIds = mutation({
	args: {
		sessionId: v.id("coachSessions"),
		speakers: v.array(
			v.object({ label: v.string(), identifiers: v.array(v.string()) }),
		),
	},
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		const incoming = args.speakers
			.slice(0, 20)
			.map((s) => ({
				label: clean(s.label, 40),
				identifiers: s.identifiers.slice(0, MAX_IDS_PER_VOICE),
			}))
			.filter((s) => s.label && s.identifiers.length > 0);
		const byLabel = new Map(
			(session.speakerIds ?? []).map((s) => [s.label, s] as const),
		);
		for (const s of incoming) byLabel.set(s.label, s);
		await ctx.db.patch(session._id, {
			speakerIds: [...byLabel.values()].slice(-20),
		});
		for (const s of incoming) {
			// Nooit het label met je naam zelf bijwerken: dat versterkt een
			// verkeerde herkenning (iedereen "Arin").
			if (
				session.meLabel &&
				s.label === session.meLabel &&
				isGenericLabel(s.label)
			) {
				await rememberVoice(
					ctx,
					session.ownerId,
					session.myName,
					s.identifiers,
				);
			}
		}
		return null;
	},
});

/** Is je stem al bekend? Voor de uitleg op het startscherm. */
export const myVoice = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;
		const rows = await ctx.db
			.query("coachVoices")
			.withIndex("by_owner_and_name", (q) => q.eq("ownerId", userId))
			.take(20);
		return rows
			.filter((r) => (r.version ?? 1) >= VOICE_VERSION)
			.map((r) => ({
				_id: r._id,
				name: r.name,
				samples: r.identifiers.length,
				updatedAt: r.updatedAt,
			}));
	},
});

export const forgetVoice = mutation({
	args: { voiceId: v.id("coachVoices") },
	handler: async (ctx, args) => {
		const userId = await requireOwner(ctx);
		const voice = await ctx.db.get(args.voiceId);
		if (voice && voice.ownerId === userId) await ctx.db.delete(voice._id);
		return null;
	},
});

/** Bekende stemmen voor StartRecognition: Speechmatics labelt ze met hun naam. */
export const knownVoices = internalQuery({
	args: { ownerId: v.id("users"), sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session || session.voiceOff) return [];
		const rows = await ctx.db
			.query("coachVoices")
			.withIndex("by_owner_and_name", (q) => q.eq("ownerId", args.ownerId))
			.take(20);
		rows.sort((a, b) => b.updatedAt - a.updatedAt);
		const out: { label: string; speaker_identifiers: string[] }[] = [];
		let total = 0;
		for (const r of rows) {
			if (!validVoiceName(r.name) || (r.version ?? 1) < VOICE_VERSION) continue;
			const ids = r.identifiers.slice(0, MAX_IDS_PER_VOICE);
			if (ids.length === 0 || total + ids.length > MAX_IDS_SENT) continue;
			out.push({ label: r.name, speaker_identifiers: ids });
			total += ids.length;
		}
		return out;
	},
});

export const generateShotUploadUrl = mutation({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		await ownedSession(ctx, args.sessionId);
		return await ctx.storage.generateUploadUrl();
	},
});

export const addShot = mutation({
	args: {
		sessionId: v.id("coachSessions"),
		storageId: v.id("_storage"),
		at: v.number(),
		auto: v.boolean(),
	},
	handler: async (ctx, args) => {
		const session = await ownedSession(ctx, args.sessionId);
		const existing = await ctx.db
			.query("coachShots")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
			.take(MAX_SHOTS);
		if (existing.length >= MAX_SHOTS) {
			await ctx.storage.delete(args.storageId);
			throw new ConvexError("Maximum aantal screenshots bereikt.");
		}
		const shotId = await ctx.db.insert("coachShots", {
			sessionId: session._id,
			at: Math.round(args.at),
			storageId: args.storageId,
			auto: args.auto,
			status: "pending",
		});
		await ctx.scheduler.runAfter(0, internal.coach.ai.describeShot, { shotId });
		return shotId;
	},
});

// ---- Nudges --------------------------------------------------------------------

/** Laat kandidaten door de filters en zet ze erin. Geeft de state-patch terug. */
async function insertNudges<
	T extends CoachNudgeCandidate & { reason?: string },
>(
	ctx: MutationCtx,
	session: Doc<"coachSessions">,
	state: Doc<"coachState">,
	candidates: T[],
	origin: Doc<"coachNudges">["origin"],
	reason?: string,
): Promise<{ patch: Partial<Doc<"coachState">>; admitted: T[] }> {
	const now = Date.now();
	const recent = await ctx.db
		.query("coachNudges")
		.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
		.order("desc")
		.take(30);
	const admitted = admitNudges({
		candidates,
		recent: recent.map((r) => ({
			type: r.type,
			text: r.text,
			detail: r.detail,
			at: r.at,
		})),
		now,
		lastNudgeAt: state.lastNudgeAt,
		lastHighNudgeAt: state.lastHighNudgeAt,
	});
	if (admitted.length === 0) return { patch: {}, admitted: [] };
	for (const n of admitted) {
		await ctx.db.insert("coachNudges", {
			sessionId: session._id,
			at: now,
			type: n.type,
			priority: n.priority,
			text: n.text,
			detail: n.detail,
			origin,
			reason: n.reason ?? reason,
			expiresAt: n.expiresAt,
		});
	}
	// Hooguit twee tegelijk: oudere actieve nudges laten we nu verlopen.
	const active = recent.filter((r) => !r.dismissedAt && r.expiresAt > now);
	const room = Math.max(0, MAX_ACTIVE_NUDGES - admitted.length);
	for (const old of active.slice(room)) {
		await ctx.db.patch(old._id, { expiresAt: now });
	}
	const patch: Partial<Doc<"coachState">> = { lastNudgeAt: now };
	if (admitted.some((n) => n.priority === "high")) patch.lastHighNudgeAt = now;
	return { patch, admitted };
}

// ---- Intern: voor ai.ts ----------------------------------------------------------

/** Eigenaar-check voor actions (die hebben geen ctx.db). */
export const ownerCheck = internalQuery({
	args: { sessionId: v.id("coachSessions"), userId: v.id("users") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		return session !== null && session.ownerId === args.userId;
	},
});

async function shotNotes(
	ctx: QueryCtx,
	sessionId: Id<"coachSessions">,
	since: number,
	limit: number,
) {
	const rows = await ctx.db
		.query("coachShots")
		.withIndex("by_session_and_at", (q) =>
			q.eq("sessionId", sessionId).gte("at", since),
		)
		.order("desc")
		.take(limit);
	return rows
		.filter((s) => s.description)
		.reverse()
		.map((s) => ({ at: s.at, description: s.description ?? "" }));
}

export const fastContext = internalQuery({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) return null;
		const state = await stateOf(ctx, session._id);
		const recent = await ctx.db
			.query("coachChunks")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
			.order("desc")
			.take(60);
		const nudges = await ctx.db
			.query("coachNudges")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
			.order("desc")
			.take(10);
		const shots = await shotNotes(
			ctx,
			session._id,
			Date.now() - 10 * 60_000,
			3,
		);
		return { session, state, chunks: recent.reverse(), nudges, shots };
	},
});

export const deepContext = internalQuery({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) return null;
		const state = await stateOf(ctx, session._id);
		// Nieuw sinds de vorige diepe ronde, met een kleine overlap.
		const since = Math.max(0, state.deepCursorAt - 20_000);
		const fresh = await ctx.db
			.query("coachChunks")
			.withIndex("by_session_and_at", (q) =>
				q.eq("sessionId", session._id).gt("at", since),
			)
			.take(600);
		const nudges = await ctx.db
			.query("coachNudges")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
			.order("desc")
			.take(10);
		const shots = await shotNotes(ctx, session._id, since, 6);
		return { session, state, chunks: fresh, nudges, shots };
	},
});

export const reportContext = internalQuery({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) return null;
		const state = await stateOf(ctx, session._id);
		const chunks = await ctx.db
			.query("coachChunks")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
			.take(MAX_CHUNKS);
		const nudges = await ctx.db
			.query("coachNudges")
			.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
			.take(500);
		const shots = await shotNotes(ctx, session._id, 0, 60);
		return { session, state, chunks, nudges, shots };
	},
});

export const shotContext = internalQuery({
	args: { shotId: v.id("coachShots") },
	handler: async (ctx, args) => {
		const shot = await ctx.db.get(args.shotId);
		if (!shot) return null;
		const session = await ctx.db.get(shot.sessionId);
		if (!session) return null;
		const recent = await ctx.db
			.query("coachChunks")
			.withIndex("by_session_and_at", (q) =>
				q.eq("sessionId", session._id).lte("at", shot.at),
			)
			.order("desc")
			.take(8);
		return { shot, session, recent: recent.reverse() };
	},
});

export const recentForTranscribe = internalQuery({
	args: { sessionId: v.id("coachSessions"), before: v.number() },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) return null;
		const rows = await ctx.db
			.query("coachChunks")
			.withIndex("by_session_and_at", (q) =>
				q.eq("sessionId", session._id).lt("at", args.before),
			)
			.order("desc")
			.take(8);
		return { session, chunks: rows.reverse() };
	},
});

export const insertTranscribed = internalMutation({
	args: {
		sessionId: v.id("coachSessions"),
		chunks: v.array(coachChunkInputV),
		usage: usageV,
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) return 0;
		const cost = await logUsage(ctx, session, args.usage);
		const state = await stateOf(ctx, session._id);
		await ctx.db.patch(state._id, { costUsd: state.costUsd + cost });
		return await ingest(ctx, session, args.chunks);
	},
});

const vPriority = (p: string, type: string): "low" | "normal" | "high" => {
	// "Hoog" alleen waar het echt nu moet; anders wordt alles hoog.
	if (
		p === "high" &&
		(type === "letop" || type === "antwoord" || type === "afronden")
	) {
		return "high";
	}
	return p === "low" ? "low" : "normal";
};

export const applyFast = internalMutation({
	args: {
		sessionId: v.id("coachSessions"),
		reason: v.string(),
		nudges: v.array(coachNudgeCandidateV),
		nextQuestion: v.optional(v.string()),
		currentItem: v.optional(v.union(v.number(), v.null())),
		usage: v.optional(usageV),
		failed: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) return null;
		const state = await stateOf(ctx, session._id);
		const now = Date.now();
		const patch: Partial<Doc<"coachState">> = { fastRunningSince: undefined };
		if (args.usage) {
			patch.costUsd =
				state.costUsd + (await logUsage(ctx, session, args.usage));
		}
		if (!args.failed && session.status === "live") {
			if (args.nextQuestion) patch.nextQuestion = clean(args.nextQuestion, 220);
			if (
				typeof args.currentItem === "number" &&
				state.agenda[args.currentItem] &&
				args.currentItem !== state.currentItem
			) {
				Object.assign(
					patch,
					switchAgenda(
						state.agenda,
						state.currentItem,
						state.currentSince,
						args.currentItem,
						now,
					),
				);
			}
			const candidates = args.nudges.map((n) => ({
				...n,
				priority:
					args.reason === "question" && n.type === "antwoord"
						? ("high" as const)
						: vPriority(n.priority, n.type),
			}));
			const inserted = await insertNudges(
				ctx,
				session,
				state,
				candidates,
				"fast",
				args.reason,
			);
			Object.assign(patch, inserted.patch);
		}
		await ctx.db.patch(state._id, patch);
		const fresh = await stateOf(ctx, session._id);
		if (fresh.pendingReason) {
			await maybeRun(
				ctx,
				session,
				fresh,
				fresh.pendingReason as FastReason,
				now,
			);
		}
		return null;
	},
});

export const applyDeep = internalMutation({
	args: {
		sessionId: v.id("coachSessions"),
		cursorAt: v.number(),
		summary: v.array(v.string()),
		decisions: v.array(v.string()),
		actionItems: v.array(coachActionItemV),
		openQuestions: v.array(v.string()),
		nudges: v.array(coachNudgeCandidateV),
		nextQuestion: v.optional(v.string()),
		usage: v.optional(usageV),
		failed: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) return null;
		const state = await stateOf(ctx, session._id);
		const patch: Partial<Doc<"coachState">> = { deepRunningSince: undefined };
		if (args.usage) {
			patch.costUsd =
				state.costUsd + (await logUsage(ctx, session, args.usage));
		}
		if (!args.failed) {
			patch.deepCursorAt = Math.max(state.deepCursorAt, args.cursorAt);
			if (args.summary.length) patch.summary = args.summary.slice(0, 5);
			patch.decisions = args.decisions.slice(0, 20);
			patch.actionItems = args.actionItems.slice(0, 30);
			patch.openQuestions = args.openQuestions.slice(0, 15);
			if (args.nextQuestion) patch.nextQuestion = clean(args.nextQuestion, 220);
			if (session.status === "live" && args.nudges.length) {
				const candidates = args.nudges.map((n) => ({
					...n,
					priority: vPriority(n.priority, n.type),
				}));
				const inserted = await insertNudges(
					ctx,
					session,
					state,
					candidates,
					"deep",
					"deep",
				);
				Object.assign(patch, inserted.patch);
			}
		}
		await ctx.db.patch(state._id, patch);
		return null;
	},
});

export const saveShot = internalMutation({
	args: {
		shotId: v.id("coachShots"),
		description: v.optional(v.string()),
		usage: v.optional(usageV),
	},
	handler: async (ctx, args) => {
		const shot = await ctx.db.get(args.shotId);
		if (!shot) return null;
		const session = await ctx.db.get(shot.sessionId);
		if (session && args.usage) {
			const cost = await logUsage(ctx, session, args.usage);
			const state = await stateOf(ctx, session._id);
			await ctx.db.patch(state._id, { costUsd: state.costUsd + cost });
		}
		await ctx.db.patch(shot._id, {
			status: args.description ? "done" : "error",
			description: args.description ? clean(args.description, 1200) : undefined,
		});
		return null;
	},
});

export const saveReport = internalMutation({
	args: {
		sessionId: v.id("coachSessions"),
		model: v.string(),
		summary: v.array(v.string()),
		decisions: v.array(v.string()),
		actionItems: v.array(coachActionItemV),
		openQuestions: v.array(v.string()),
		emailSubject: v.string(),
		emailBody: v.string(),
		tips: v.array(v.object({ title: v.string(), text: v.string() })),
		questionsAsked: v.number(),
		usage: v.optional(usageV),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) return null;
		const state = await stateOf(ctx, session._id);
		let costUsd = state.costUsd;
		if (args.usage) costUsd += await logUsage(ctx, session, args.usage);
		await ctx.db.patch(state._id, { costUsd });
		const nudgeCount = (
			await ctx.db
				.query("coachNudges")
				.withIndex("by_session_and_at", (q) => q.eq("sessionId", session._id))
				.take(1000)
		).length;
		const { mine, others, share } = talkTotals(state.talk);
		const existing = await ctx.db
			.query("coachReports")
			.withIndex("by_session", (q) => q.eq("sessionId", session._id))
			.unique();
		const doc = {
			sessionId: session._id,
			ownerId: session.ownerId,
			clientId: session.clientId,
			createdAt: Date.now(),
			model: args.model,
			summary: args.summary,
			decisions: args.decisions,
			actionItems: args.actionItems,
			openQuestions: args.openQuestions,
			emailSubject: args.emailSubject,
			emailBody: args.emailBody,
			tips: args.tips,
			stats: {
				durationMs: session.durationMs ?? Date.now() - session.startedAt,
				myShare: share,
				myTalkMs: mine,
				othersTalkMs: others,
				questionsAsked: args.questionsAsked,
				nudges: nudgeCount,
				plannedMinutes: session.plannedMinutes,
				costUsd,
			},
		};
		if (existing) await ctx.db.replace(existing._id, doc);
		else await ctx.db.insert("coachReports", doc);
		await ctx.db.patch(session._id, {
			status: "done",
			reportPreview: args.summary.slice(0, 2).join(" ").slice(0, 280),
		});
		return null;
	},
});

export const reportFailed = internalMutation({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (session) await ctx.db.patch(session._id, { status: "error" });
		return null;
	},
});
