import { getAuthUserId } from "@convex-dev/auth/server";
import { generateText } from "ai";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, action, internalAction } from "../_generated/server";
import {
	field,
	generateJson,
	type Json,
	languageModel,
	str,
	strList,
	usageRow,
} from "../lib/llm";
import {
	DEEP_SCHEMA,
	deepInstructions,
	deepPrompt,
	FAST_SCHEMA,
	fastInstructions,
	fastPrompt,
	parseActions,
	parseNudges,
	REPORT_SCHEMA,
	reportInstructions,
	reportPrompt,
	SHOT_INSTRUCTIONS,
	speakerName,
	TRANSCRIBE_SCHEMA,
	transcribeInstructions,
} from "./prompts";
import type { CoachChunkInput } from "./validators";

// De AI-kant van de meeting coach. Alles via de Convex AI Gateway:
// - fastPass: Gemini 3.8 Flash, vaak (±20 s spraak of een directe trigger).
// - deepPass: Claude Sonnet 5.5, elke ±2,5 min: stand, besluiten, acties.
// - finalReport: Claude Sonnet 5.5 na Stop.
// - describeShot: Gemini 3.8 Flash vision.
// - transcribeSegment: de fallback als Speechmatics niet is ingesteld.

export const MODEL_FAST = "google/gemini-3.8-flash";
export const MODEL_DEEP = "anthropic/claude-sonnet-5.5";
export const MODEL_REPORT = "anthropic/claude-sonnet-5.5";
export const MODEL_VISION = "google/gemini-3.8-flash";
export const MODEL_TRANSCRIBE = "google/gemini-3.8-flash";

const SPEECHMATICS_TOKEN_URL =
	"https://mp.speechmatics.com/v1/api_keys?type=rt";
const MAX_AUDIO_BYTES = 1_500_000;

async function requireSessionOwner(
	ctx: ActionCtx,
	sessionId: Id<"coachSessions">,
): Promise<Id<"users">> {
	const userId = await getAuthUserId(ctx);
	if (!userId) throw new ConvexError("unauthenticated");
	const ok: boolean = await ctx.runQuery(internal.coach.sessions.ownerCheck, {
		sessionId,
		userId,
	});
	if (!ok) throw new ConvexError("Dit gesprek bestaat niet (meer).");
	return userId;
}

function timeout(ms: number): AbortSignal {
	return AbortSignal.timeout(ms);
}

// ---- Transcriptie ------------------------------------------------------------

export type TranscriptionKind = "speechmatics" | "gateway";

/** Welke transcriptie de browser gebruikt, met een uitleg als het de fallback is. */
export const transcriptionProvider = action({
	args: {},
	handler: async (
		ctx,
	): Promise<{ kind: TranscriptionKind; hint: string | null }> => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");
		if (process.env.SPEECHMATICS_API_KEY) {
			return { kind: "speechmatics", hint: null };
		}
		return {
			kind: "gateway",
			hint: "Speechmatics is nog niet ingesteld (SPEECHMATICS_API_KEY ontbreekt in Convex). De coach luistert via de AI Gateway: werkt, maar met ±15–20 s vertraging.",
		};
	},
});

/**
 * Kortlevende Speechmatics-sleutel (JWT, 120 s) voor de realtime-WebSocket.
 * Alleen nodig om te verbinden; een open verbinding blijft daarna gewoon
 * lopen. Bij herverbinden haalt de browser een nieuwe.
 */
export const speechmaticsToken = action({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args): Promise<{ token: string }> => {
		await requireSessionOwner(ctx, args.sessionId);
		const key = process.env.SPEECHMATICS_API_KEY;
		if (!key) {
			throw new ConvexError(
				"Speechmatics is niet ingesteld: zet SPEECHMATICS_API_KEY in de Convex-omgeving.",
			);
		}
		const res = await fetch(SPEECHMATICS_TOKEN_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${key}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ ttl: 120 }),
		});
		if (!res.ok) {
			console.error("Speechmatics token", res.status, await res.text());
			throw new ConvexError(
				res.status === 401 || res.status === 403
					? "Speechmatics weigert de API-sleutel. Controleer SPEECHMATICS_API_KEY."
					: `Speechmatics-sleutel ophalen mislukt (${res.status}).`,
			);
		}
		const body: { key_value?: string } = await res.json();
		if (!body.key_value) {
			throw new ConvexError("Speechmatics gaf geen tijdelijke sleutel terug.");
		}
		return { token: body.key_value };
	},
});

/** Leest de JSON-lijst van het transcriptiemodel. */
export function parseTranscribed(
	json: Json | null,
	startedAt: number,
	durationMs: number,
	has: { mic: boolean; tab: boolean },
): CoachChunkInput[] {
	const list = field(json, "lines");
	if (!Array.isArray(list)) return [];
	const out: CoachChunkInput[] = [];
	list.forEach((item: Json, i) => {
		const text = str(field(item, "text"), 2000);
		if (!text) return;
		let source = str(field(item, "source"), 5) === "mic" ? "mic" : "tab";
		if (source === "mic" && !has.mic) source = "tab";
		if (source === "tab" && !has.tab) source = "mic";
		const t = field(item, "t");
		const offset =
			typeof t === "number" && Number.isFinite(t)
				? Math.min(durationMs, Math.max(0, t * 1000))
				: (durationMs * i) / Math.max(1, list.length);
		const speaker = str(field(item, "speaker"), 40);
		out.push({
			at: Math.round(startedAt + offset),
			source: source === "mic" ? "mic" : "tab",
			speaker: source === "mic" ? null : speaker || "Spreker 1",
			text,
		});
	});
	return out.sort((a, b) => a.at - b.at);
}

/**
 * Gateway-fallback: één stuk van ±15 s (microfoon en/of tabblad als WAV)
 * uitschrijven met Gemini 3.8 Flash. Microfoon = jij, tabblad = de anderen.
 */
export const transcribeSegment = action({
	args: {
		sessionId: v.id("coachSessions"),
		mic: v.optional(v.bytes()),
		tab: v.optional(v.bytes()),
		startedAt: v.number(),
		durationMs: v.number(),
	},
	handler: async (ctx, args): Promise<{ lines: number }> => {
		await requireSessionOwner(ctx, args.sessionId);
		const mic = args.mic && args.mic.byteLength > 0 ? args.mic : undefined;
		const tab = args.tab && args.tab.byteLength > 0 ? args.tab : undefined;
		if (!mic && !tab) return { lines: 0 };
		if ((mic?.byteLength ?? 0) + (tab?.byteLength ?? 0) > MAX_AUDIO_BYTES * 2) {
			throw new ConvexError("Opnamestuk te groot.");
		}
		const recent = await ctx.runQuery(
			internal.coach.sessions.recentForTranscribe,
			{ sessionId: args.sessionId, before: args.startedAt + 1 },
		);
		if (!recent) throw new ConvexError("Dit gesprek bestaat niet (meer).");
		const { session } = recent;
		const previous = recent.chunks.length
			? recent.chunks
					.map((c) =>
						c.isMine
							? `${session.myName} (mic): ${c.text}`
							: `${c.speaker ?? "Spreker 1"} (tab): ${c.text}`,
					)
					.join("\n")
			: "(nog niets: dit is het begin van het gesprek)";

		const content: (
			| { type: "text"; text: string }
			| { type: "file"; data: Uint8Array; mediaType: string }
		)[] = [
			{
				type: "text",
				text: `Eerdere regels (alleen context, niet opnieuw uitschrijven):\n${previous}\n\nSchrijf het volgende stuk (${Math.round(args.durationMs / 1000)} s) letterlijk uit.`,
			},
		];
		if (mic) {
			content.push({ type: "text", text: "Opname mic:" });
			content.push({
				type: "file",
				data: new Uint8Array(mic),
				mediaType: "audio/wav",
			});
		}
		if (tab) {
			content.push({ type: "text", text: "Opname tab:" });
			content.push({
				type: "file",
				data: new Uint8Array(tab),
				mediaType: "audio/wav",
			});
		}
		const result = await generateJson({
			model: languageModel(MODEL_TRANSCRIBE),
			instructions: transcribeInstructions(session.myName),
			messages: [{ role: "user", content }],
			schema: TRANSCRIBE_SCHEMA,
			name: "transcript",
			temperature: 0,
			reasoning: "minimal",
			maxOutputTokens: 2000,
			maxRetries: 2,
			abortSignal: timeout(45_000),
		});
		const chunks = parseTranscribed(
			result.json,
			args.startedAt,
			args.durationMs,
			{ mic: !!mic, tab: !!tab },
		);
		const lines: number = await ctx.runMutation(
			internal.coach.sessions.insertTranscribed,
			{
				sessionId: args.sessionId,
				chunks,
				usage: usageRow("transcribe", MODEL_TRANSCRIBE, result),
			},
		);
		return { lines };
	},
});

// ---- Snelle ronde ------------------------------------------------------------

export const fastPass = internalAction({
	args: { sessionId: v.id("coachSessions"), reason: v.string() },
	handler: async (ctx, args) => {
		const data = await ctx.runQuery(internal.coach.sessions.fastContext, {
			sessionId: args.sessionId,
		});
		if (!data) return null;
		const { session } = data;
		const fail = () =>
			ctx.runMutation(internal.coach.sessions.applyFast, {
				sessionId: args.sessionId,
				reason: args.reason,
				nudges: [],
				failed: true,
			});
		if (session.status !== "live" || data.chunks.length === 0) {
			await fail();
			return null;
		}
		try {
			const result = await generateJson({
				model: languageModel(MODEL_FAST),
				instructions: fastInstructions(session.myName),
				schema: FAST_SCHEMA,
				name: "coach",
				prompt: fastPrompt({ ...data, reason: args.reason, now: Date.now() }),
				temperature: 0.4,
				reasoning: "low",
				maxOutputTokens: 700,
				maxRetries: 1,
				abortSignal: timeout(25_000),
			});
			const json = result.json;
			const current = field(json, "currentItem");
			await ctx.runMutation(internal.coach.sessions.applyFast, {
				sessionId: args.sessionId,
				reason: args.reason,
				nudges: parseNudges(field(json, "nudges"), 2),
				nextQuestion: str(field(json, "nextQuestion"), 220) || undefined,
				currentItem:
					typeof current === "number" && Number.isInteger(current)
						? current
						: null,
				usage: usageRow("fast", MODEL_FAST, result),
			});
		} catch (error) {
			console.error("Coach: snelle ronde mislukt", error);
			await fail();
		}
		return null;
	},
});

// ---- Diepe ronde -------------------------------------------------------------

export const deepPass = internalAction({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const data = await ctx.runQuery(internal.coach.sessions.deepContext, {
			sessionId: args.sessionId,
		});
		if (!data) return null;
		const fail = () =>
			ctx.runMutation(internal.coach.sessions.applyDeep, {
				sessionId: args.sessionId,
				cursorAt: 0,
				summary: [],
				decisions: [],
				actionItems: [],
				openQuestions: [],
				nudges: [],
				failed: true,
			});
		if (data.chunks.length === 0) {
			await fail();
			return null;
		}
		const cursorAt = data.chunks[data.chunks.length - 1]?.at ?? 0;
		try {
			const result = await generateJson({
				model: languageModel(MODEL_DEEP),
				instructions: deepInstructions(data.session.myName),
				prompt: deepPrompt({ ...data, now: Date.now() }),
				schema: DEEP_SCHEMA,
				name: "stand",
				maxOutputTokens: 4000,
				maxRetries: 1,
				abortSignal: timeout(90_000),
			});
			const json = result.json;
			if (!json) throw new Error(`Geen JSON: ${result.text.slice(0, 200)}`);
			await ctx.runMutation(internal.coach.sessions.applyDeep, {
				sessionId: args.sessionId,
				cursorAt,
				summary: strList(field(json, "summary"), 5, 220),
				decisions: strList(field(json, "decisions"), 20, 240),
				actionItems: parseActions(field(json, "actionItems"), 30),
				openQuestions: strList(field(json, "openQuestions"), 15, 240),
				nudges: parseNudges(field(json, "nudges"), 1).filter(
					(n) =>
						n.type === "letop" || n.type === "kans" || n.type === "samenvatten",
				),
				nextQuestion: str(field(json, "nextQuestion"), 220) || undefined,
				usage: usageRow("deep", MODEL_DEEP, result),
			});
		} catch (error) {
			console.error("Coach: diepe ronde mislukt", error);
			await fail();
		}
		return null;
	},
});

// ---- Verslag -----------------------------------------------------------------

export const finalReport = internalAction({
	args: { sessionId: v.id("coachSessions") },
	handler: async (ctx, args) => {
		const data = await ctx.runQuery(internal.coach.sessions.reportContext, {
			sessionId: args.sessionId,
		});
		if (!data) return null;
		const { session, state } = data;
		const questionsAsked = state.talk
			.filter((t) => t.isMine)
			.reduce((n, t) => n + t.questions, 0);
		if (data.chunks.length === 0) {
			await ctx.runMutation(internal.coach.sessions.saveReport, {
				sessionId: args.sessionId,
				model: "-",
				summary: ["Er is niets opgenomen in dit gesprek."],
				decisions: [],
				actionItems: [],
				openQuestions: [],
				emailSubject: "",
				emailBody: "",
				tips: [],
				questionsAsked: 0,
			});
			return null;
		}
		try {
			const result = await generateJson({
				model: languageModel(MODEL_REPORT),
				instructions: reportInstructions(session.myName),
				schema: REPORT_SCHEMA,
				name: "verslag",
				prompt: reportPrompt({
					session,
					state,
					chunks: data.chunks,
					shots: data.shots,
					nudgeCount: data.nudges.length,
					now: Date.now(),
				}),
				maxOutputTokens: 10000,
				maxRetries: 2,
				abortSignal: timeout(180_000),
			});
			const json = result.json;
			if (!json) throw new Error(`Geen JSON: ${result.text.slice(0, 200)}`);
			const email = field(json, "email");
			const tipsRaw = field(json, "tips");
			const tips = Array.isArray(tipsRaw)
				? tipsRaw
						.map((t) => ({
							title: str(field(t, "title"), 80),
							text: str(field(t, "text"), 400),
						}))
						.filter((t) => t.title && t.text)
						.slice(0, 3)
				: [];
			const body = field(email ?? null, "body");
			await ctx.runMutation(internal.coach.sessions.saveReport, {
				sessionId: args.sessionId,
				model: MODEL_REPORT,
				summary: strList(field(json, "summary"), 8, 300),
				decisions: strList(field(json, "decisions"), 20, 300),
				actionItems: parseActions(field(json, "actionItems"), 30),
				openQuestions: strList(field(json, "openQuestions"), 15, 300),
				emailSubject: str(field(email ?? null, "subject"), 160),
				// De mail houdt zijn regels; alleen trimmen.
				emailBody: typeof body === "string" ? body.trim().slice(0, 6000) : "",
				tips,
				questionsAsked,
				usage: usageRow("report", MODEL_REPORT, result),
			});
		} catch (error) {
			console.error("Coach: verslag mislukt", error);
			await ctx.runMutation(internal.coach.sessions.reportFailed, {
				sessionId: args.sessionId,
			});
		}
		return null;
	},
});

// ---- Screenshots ---------------------------------------------------------------

export const describeShot = internalAction({
	args: { shotId: v.id("coachShots") },
	handler: async (ctx, args) => {
		const data = await ctx.runQuery(internal.coach.sessions.shotContext, {
			shotId: args.shotId,
		});
		if (!data) return null;
		const { shot, session, recent } = data;
		try {
			const blob = await ctx.storage.get(shot.storageId);
			if (!blob) throw new Error("Screenshot niet gevonden in de opslag");
			const said = recent.length
				? recent.map((c) => `${speakerName(session, c)}: ${c.text}`).join("\n")
				: "(nog niets)";
			const result = await generateText({
				model: languageModel(MODEL_VISION),
				instructions: SHOT_INSTRUCTIONS,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: `Gesprek: ${session.title}\nLaatst gezegd (alleen context):\n${said}`,
							},
							{
								type: "file",
								data: new Uint8Array(await blob.arrayBuffer()),
								mediaType: blob.type || "image/jpeg",
							},
						],
					},
				],
				reasoning: "minimal",
				maxOutputTokens: 300,
				maxRetries: 2,
				abortSignal: timeout(45_000),
			});
			await ctx.runMutation(internal.coach.sessions.saveShot, {
				shotId: args.shotId,
				description: result.text.trim().slice(0, 1200) || undefined,
				usage: usageRow("vision", MODEL_VISION, result),
			});
		} catch (error) {
			console.error("Coach: screenshot beschrijven mislukt", error);
			await ctx.runMutation(internal.coach.sessions.saveShot, {
				shotId: args.shotId,
			});
		}
		return null;
	},
});
