import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { firstMessage, systemPrompt } from "./prompt";

const OUTBOUND_URL = "https://api.elevenlabs.io/v1/convai/twilio/outbound-call";

type OutboundResponse = {
	success?: boolean;
	message?: string;
	conversation_id?: string | null;
	callSid?: string | null;
};

export const start = action({
	args: { taskId: v.id("voiceTasks") },
	handler: async (
		ctx,
		args,
	): Promise<{ callId: Id<"voiceCalls">; conversationId: string | null }> => {
		// In een action is er geen ctx.db, dus geen requireOwner-helper; het
		// JWT-subject is hier de enige identiteit die telt.
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");

		const apiKey = process.env.ELEVENLABS_API_KEY;
		const agentId = process.env.ELEVENLABS_AGENT_ID;
		const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
		const siteUrl = process.env.CONVEX_SITE_URL;
		if (!apiKey || !agentId || !phoneNumberId || !siteUrl) {
			throw new ConvexError("voice_not_configured");
		}

		const task = await ctx.runQuery(internal.voice.tasks.getTaskInternal, {
			id: args.taskId,
		});
		if (!task || task.ownerId !== userId) throw new ConvexError("not_found");
		if (task.status === "calling") throw new ConvexError("already_calling");

		// Het token bestaat vóór het gesprek, want de agent heeft het nodig zodra
		// de eerste tool afgaat — en dat kan binnen seconden na opnemen zijn.
		const token = crypto.randomUUID();
		const callId: Id<"voiceCalls"> = await ctx.runMutation(
			internal.voice.tasks.startCallRecord,
			{ taskId: args.taskId, token },
		);

		const promptInput = {
			company: task.company,
			goal: task.goal,
			constraints: task.constraints,
			facts: task.facts.map((f) => ({ label: f.label, value: f.value })),
			callerName: process.env.VOICE_CALLER_NAME ?? "Arin Issa",
			orgName: process.env.VOICE_ORG_NAME ?? "Brandocean",
		};

		let body: OutboundResponse;
		try {
			const res = await fetch(OUTBOUND_URL, {
				method: "POST",
				headers: {
					"xi-api-key": apiKey,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					agent_id: agentId,
					agent_phone_number_id: phoneNumberId,
					to_number: task.toNumber,
					conversation_initiation_client_data: {
						conversation_config_override: {
							agent: {
								prompt: { prompt: systemPrompt(promptInput) },
								first_message: firstMessage(promptInput),
								language: "nl",
							},
						},
						// De tools staan op de agent in het dashboard en krijgen deze
						// waarden als header mee. Het token draagt de autorisatie; de
						// tools weten daardoor zelf om welke taak het gaat en hoeven
						// niets uit het gesprek te vertrouwen.
						dynamic_variables: {
							call_token: token,
							tool_base_url: `${siteUrl}/voice`,
							company: task.company,
						},
					},
				}),
			});
			const text = await res.text();
			if (!res.ok) {
				throw new ConvexError(`dial_failed: ${text.slice(0, 200)}`);
			}
			body = JSON.parse(text) as OutboundResponse;
		} catch (e) {
			const message = e instanceof ConvexError ? String(e.data) : String(e);
			await ctx.runMutation(internal.voice.tasks.attachConversation, {
				callId,
				error: message.slice(0, 500),
			});
			throw e;
		}

		if (body.success === false) {
			const message = body.message ?? "dial_rejected";
			await ctx.runMutation(internal.voice.tasks.attachConversation, {
				callId,
				error: message.slice(0, 500),
			});
			throw new ConvexError(message);
		}

		await ctx.runMutation(internal.voice.tasks.attachConversation, {
			callId,
			conversationId: body.conversation_id ?? undefined,
			callSid: body.callSid ?? undefined,
		});

		return { callId, conversationId: body.conversation_id ?? null };
	},
});
