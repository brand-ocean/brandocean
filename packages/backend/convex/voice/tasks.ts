import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { toE164 } from "./number";

const factV = v.object({ label: v.string(), value: v.string() });

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireOwner(ctx);
		const tasks = await ctx.db
			.query("voiceTasks")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.order("desc")
			.collect();
		// De waarden nooit naar de client. Ik hoef in het overzicht alleen te
		// zien welke gegevens klaarstaan, niet wat ze zijn.
		return tasks.map((t) => ({
			...t,
			facts: t.facts.map((f) => ({
				label: f.label,
				disclosedAt: f.disclosedAt,
			})),
		}));
	},
});

export const getWithCalls = query({
	args: { id: v.id("voiceTasks") },
	handler: async (ctx, args) => {
		const userId = await requireOwner(ctx);
		const task = await ctx.db.get(args.id);
		if (!task || task.ownerId !== userId) return null;
		const calls = await ctx.db
			.query("voiceCalls")
			.withIndex("by_task", (q) => q.eq("taskId", args.id))
			.order("desc")
			.collect();
		return {
			task: {
				...task,
				facts: task.facts.map((f) => ({
					label: f.label,
					disclosedAt: f.disclosedAt,
				})),
			},
			// Het token is de sleutel tot de tools; die hoort nergens in een
			// client-payload thuis, ook niet in de mijne.
			calls: calls.map(({ token: _token, ...rest }) => rest),
		};
	},
});

export const create = mutation({
	args: {
		company: v.string(),
		toNumber: v.string(),
		goal: v.string(),
		constraints: v.optional(v.string()),
		facts: v.optional(v.array(factV)),
	},
	handler: async (ctx, args): Promise<Id<"voiceTasks">> => {
		const userId = await requireOwner(ctx);
		const now = Date.now();
		return await ctx.db.insert("voiceTasks", {
			ownerId: userId,
			company: args.company.trim(),
			toNumber: toE164(args.toNumber),
			goal: args.goal.trim(),
			constraints: args.constraints?.trim() || undefined,
			facts: (args.facts ?? []).map((f) => ({
				label: f.label.trim().toLowerCase(),
				value: f.value.trim(),
			})),
			status: "draft",
			attempts: 0,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("voiceTasks"),
		company: v.optional(v.string()),
		toNumber: v.optional(v.string()),
		goal: v.optional(v.string()),
		constraints: v.optional(v.string()),
		facts: v.optional(v.array(factV)),
		status: v.optional(
			v.union(
				v.literal("draft"),
				v.literal("calling"),
				v.literal("needs_me"),
				v.literal("done"),
				v.literal("failed"),
			),
		),
	},
	handler: async (ctx, args) => {
		const userId = await requireOwner(ctx);
		const task = await ctx.db.get(args.id);
		if (!task || task.ownerId !== userId) throw new ConvexError("not_found");
		const { id, facts, toNumber, ...rest } = args;
		await ctx.db.patch(id, {
			...rest,
			...(toNumber ? { toNumber: toE164(toNumber) } : {}),
			...(facts
				? {
						facts: facts.map((f) => ({
							label: f.label.trim().toLowerCase(),
							value: f.value.trim(),
						})),
					}
				: {}),
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const remove = mutation({
	args: { id: v.id("voiceTasks") },
	handler: async (ctx, args) => {
		const userId = await requireOwner(ctx);
		const task = await ctx.db.get(args.id);
		if (!task || task.ownerId !== userId) throw new ConvexError("not_found");
		const calls = await ctx.db
			.query("voiceCalls")
			.withIndex("by_task", (q) => q.eq("taskId", args.id))
			.collect();
		for (const call of calls) await ctx.db.delete(call._id);
		await ctx.db.delete(args.id);
		return null;
	},
});

// --- Intern: alles wat de action en de webhooks nodig hebben ----------------

export const getTaskInternal = internalQuery({
	args: { id: v.id("voiceTasks") },
	handler: async (ctx, args): Promise<Doc<"voiceTasks"> | null> => {
		return await ctx.db.get(args.id);
	},
});

// Eén lookup die een tool-request in zijn geheel afhandelt: token → gesprek →
// taak. Geeft null bij een onbekend of afgelopen token, zodat de httpAction
// niet hoeft te weten waarom het mis is.
export const resolveToken = internalQuery({
	args: { token: v.string() },
	handler: async (
		ctx,
		args,
	): Promise<{ call: Doc<"voiceCalls">; task: Doc<"voiceTasks"> } | null> => {
		const call = await ctx.db
			.query("voiceCalls")
			.withIndex("by_token", (q) => q.eq("token", args.token))
			.unique();
		if (!call) return null;
		if (call.status === "completed" || call.status === "failed") return null;
		const task = await ctx.db.get(call.taskId);
		if (!task) return null;
		return { call, task };
	},
});

export const startCallRecord = internalMutation({
	args: { taskId: v.id("voiceTasks"), token: v.string() },
	handler: async (ctx, args): Promise<Id<"voiceCalls">> => {
		const task = await ctx.db.get(args.taskId);
		if (!task) throw new ConvexError("not_found");
		const now = Date.now();
		await ctx.db.patch(args.taskId, {
			status: "calling",
			attempts: task.attempts + 1,
			lastCallAt: now,
			updatedAt: now,
		});
		return await ctx.db.insert("voiceCalls", {
			taskId: args.taskId,
			ownerId: task.ownerId,
			token: args.token,
			status: "dialing",
			startedAt: now,
		});
	},
});

export const attachConversation = internalMutation({
	args: {
		callId: v.id("voiceCalls"),
		conversationId: v.optional(v.string()),
		callSid: v.optional(v.string()),
		error: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { callId, error, ...rest } = args;
		if (error) {
			const call = await ctx.db.get(callId);
			await ctx.db.patch(callId, {
				status: "failed",
				error,
				endedAt: Date.now(),
			});
			if (call) {
				await ctx.db.patch(call.taskId, {
					status: "failed",
					updatedAt: Date.now(),
				});
			}
			return null;
		}
		await ctx.db.patch(callId, { ...rest, status: "in_progress" });
		return null;
	},
});

// Markeert precies het gegeven dat de agent heeft opgevraagd als prijsgegeven,
// zodat achteraf te zien is wat er over de lijn is gegaan.
export const markFactDisclosed = internalMutation({
	args: { taskId: v.id("voiceTasks"), label: v.string() },
	handler: async (ctx, args) => {
		const task = await ctx.db.get(args.taskId);
		if (!task) return null;
		await ctx.db.patch(args.taskId, {
			facts: task.facts.map((f) =>
				f.label === args.label ? { ...f, disclosedAt: Date.now() } : f,
			),
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const recordHandoff = internalMutation({
	args: { callId: v.id("voiceCalls"), reason: v.string() },
	handler: async (ctx, args) => {
		const call = await ctx.db.get(args.callId);
		if (!call) return null;
		await ctx.db.patch(args.callId, { handoffReason: args.reason });
		await ctx.db.patch(call.taskId, {
			status: "needs_me",
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const recordOutcome = internalMutation({
	args: {
		callId: v.id("voiceCalls"),
		outcome: v.string(),
		resolved: v.boolean(),
	},
	handler: async (ctx, args) => {
		const call = await ctx.db.get(args.callId);
		if (!call) return null;
		await ctx.db.patch(args.callId, { summary: args.outcome });
		const task = await ctx.db.get(call.taskId);
		// Een handoff wint van "klaar": als de agent om een mens heeft gevraagd
		// is de taak niet af, wat hij aan het eind ook rapporteert.
		if (task && task.status === "needs_me") {
			await ctx.db.patch(call.taskId, {
				outcome: args.outcome,
				updatedAt: Date.now(),
			});
			return null;
		}
		await ctx.db.patch(call.taskId, {
			outcome: args.outcome,
			status: args.resolved ? "done" : "failed",
			updatedAt: Date.now(),
		});
		return null;
	},
});

// Het transcript kan lang worden en een document mag 1MB zijn. Een uur wachtrij
// levert weinig regels op, maar een doorgeschoten agent wel — dus knippen.
const MAX_TURNS = 400;
const MAX_TEXT = 2000;

export const finishFromWebhook = internalMutation({
	args: {
		conversationId: v.string(),
		transcript: v.array(
			v.object({
				role: v.union(v.literal("agent"), v.literal("user")),
				text: v.string(),
				atSec: v.optional(v.number()),
			}),
		),
		summary: v.optional(v.string()),
		durationSecs: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const call = await ctx.db
			.query("voiceCalls")
			.withIndex("by_conversation", (q) =>
				q.eq("conversationId", args.conversationId),
			)
			.unique();
		if (!call) return null;
		await ctx.db.patch(call._id, {
			status: "completed",
			transcript: args.transcript
				.slice(-MAX_TURNS)
				.map((t) => ({ ...t, text: t.text.slice(0, MAX_TEXT) })),
			summary: call.summary ?? args.summary,
			durationSecs: args.durationSecs,
			endedAt: Date.now(),
			// Het token sterft met het gesprek: een afgelopen gesprek mag geen
			// gegevens meer kunnen opvragen.
			token: `spent:${call._id}`,
		});
		const task = await ctx.db.get(call.taskId);
		// Opgehangen zonder log_outcome. Dan is het niet af, ongeacht hoe het
		// gesprek klonk — "calling" laten staan zou het stil laten verdwijnen.
		if (task && task.status === "calling") {
			await ctx.db.patch(call.taskId, {
				status: "failed",
				outcome: task.outcome ?? "Gesprek geëindigd zonder afronding.",
				updatedAt: Date.now(),
			});
		}
		return null;
	},
});
