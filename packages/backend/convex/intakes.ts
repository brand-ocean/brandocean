import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	mutation,
	type MutationCtx,
	query,
} from "./_generated/server";

// Publiek startpunt, dus krap afgesteld. Een echte bezoeker begint er één,
// hooguit twee. Meer dan dat is een script.
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 3;

// Waar we altijd mee beginnen. Het model bedenkt daarna wat er nog ontbreekt,
// maar deze drie staan vast: zonder dit valt er niets te bedenken.
const SEED_QUESTIONS: { question: string; detail?: string }[] = [
	{
		question: "Wat wil je maken?",
		detail: "In je eigen woorden. Twee zinnen is genoeg.",
	},
	{
		question: "Voor wie is het en wat moeten die mensen er kunnen doen?",
		detail: "Denk aan wie er inlogt, wie er iets bestelt, wie het beheert.",
	},
	{
		question: "Wat gebruik je nu, en wat werkt daar niet aan?",
		detail: "Ook als het antwoord Excel is, of niks.",
	},
];

// Geen IP-adressen opslaan. Dit is genoeg om herhaald misbruik te herkennen en
// verder niets — het is niet omkeerbaar naar een adres.
async function hashIp(ip: string): Promise<string> {
	const data = new TextEncoder().encode(`intake:${ip}`);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(digest).slice(0, 16))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function enforceRateLimit(
	ctx: MutationCtx,
	ipHash: string,
): Promise<void> {
	const windowStart = Math.floor(Date.now() / RATE_WINDOW_MS) * RATE_WINDOW_MS;
	const bucket = await ctx.db
		.query("intakeRateBuckets")
		.withIndex("by_ip_window", (q) =>
			q.eq("ipHash", ipHash).eq("windowStart", windowStart),
		)
		.first();
	if (!bucket) {
		await ctx.db.insert("intakeRateBuckets", { ipHash, windowStart, count: 1 });
		return;
	}
	if (bucket.count >= RATE_MAX_PER_WINDOW) throw new ConvexError("rate_limited");
	await ctx.db.patch(bucket._id, { count: bucket.count + 1 });
}

function requireOwner(userId: Id<"users"> | null): Id<"users"> {
	if (!userId) throw new ConvexError("unauthenticated");
	return userId;
}

// --- publiek ---------------------------------------------------------------

/**
 * Ontstaat pas bij het eerste antwoord, niet bij het openen van de modal. Dat
 * scheelt lege records van mensen die even keken, en het eerste antwoord is het
 * eerste echte signaal dat er iemand zit.
 *
 * Contactgegevens komen bewust achteraan — zie `setContact`.
 */
export const start = mutation({
	args: {
		firstAnswer: v.string(),
		ip: v.optional(v.string()),
	},
	returns: v.object({ token: v.string() }),
	handler: async (ctx, args): Promise<{ token: string }> => {
		if (args.firstAnswer.trim().length < 2) {
			throw new ConvexError("leeg_antwoord");
		}
		const ipHash = args.ip ? await hashIp(args.ip) : "onbekend";
		await enforceRateLimit(ctx, ipHash);

		const now = Date.now();
		const token = crypto.randomUUID().replace(/-/g, "");
		const intakeId = await ctx.db.insert("intakes", {
			status: "vragen",
			ipHash,
			createdAt: now,
			updatedAt: now,
			token,
		});

		for (const [index, seed] of SEED_QUESTIONS.entries()) {
			await ctx.db.insert("intakeAnswers", {
				intakeId,
				order: index,
				question: seed.question,
				detail: seed.detail,
				generated: false,
				// De eerste vraag staat al beantwoord: die stelden we in de modal
				// voordat er een record was.
				answer: index === 0 ? args.firstAnswer.slice(0, 4000) : undefined,
				answeredAt: index === 0 ? now : undefined,
			});
		}

		return { token };
	},
});

/**
 * De mail, gevraagd nadat alle vragen beantwoord zijn. Pas hierna mag de dure
 * brief geschreven worden: zonder adres kun je er toch niets mee.
 */
export const setContact = mutation({
	args: {
		token: v.string(),
		name: v.string(),
		email: v.string(),
		company: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		const intake = await ctx.db
			.query("intakes")
			.withIndex("by_token", (q) => q.eq("token", args.token))
			.first();
		if (!intake) throw new ConvexError("not_found");
		if (!args.email.includes("@")) throw new ConvexError("ongeldig_adres");

		await ctx.db.patch(intake._id, {
			name: args.name.slice(0, 120),
			email: args.email.slice(0, 200),
			company: args.company?.slice(0, 200),
			updatedAt: Date.now(),
		});

		const answers = await ctx.db
			.query("intakeAnswers")
			.withIndex("by_intake", (q) => q.eq("intakeId", intake._id))
			.collect();
		if (answers.every((a) => a.answer && a.answer.trim().length > 0)) {
			await ctx.scheduler.runAfter(0, internal.intakeAi.advance, {
				intakeId: intake._id,
			});
		}
		return null;
	},
});

export const getByToken = query({
	args: { token: v.string() },
	handler: async (ctx, args) => {
		const intake = await ctx.db
			.query("intakes")
			.withIndex("by_token", (q) => q.eq("token", args.token))
			.first();
		if (!intake) return null;

		const answers = await ctx.db
			.query("intakeAnswers")
			.withIndex("by_intake", (q) => q.eq("intakeId", intake._id))
			.collect();

		// De brief gaat bewust niet mee naar de klant. Die is voor intern.
		return {
			status: intake.status,
			name: intake.name,
			summary: intake.summary,
			questions: answers
				.sort((a, b) => a.order - b.order)
				.map((a) => ({
					id: a._id,
					order: a.order,
					question: a.question,
					detail: a.detail,
					answer: a.answer,
				})),
		};
	},
});

export const answer = mutation({
	args: {
		token: v.string(),
		questionId: v.id("intakeAnswers"),
		answer: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		const intake = await ctx.db
			.query("intakes")
			.withIndex("by_token", (q) => q.eq("token", args.token))
			.first();
		if (!intake) throw new ConvexError("not_found");
		if (intake.status !== "vragen") throw new ConvexError("gesloten");

		const question = await ctx.db.get(args.questionId);
		if (!question || question.intakeId !== intake._id) {
			throw new ConvexError("not_found");
		}

		await ctx.db.patch(args.questionId, {
			answer: args.answer.slice(0, 4000),
			answeredAt: Date.now(),
		});
		await ctx.db.patch(intake._id, { updatedAt: Date.now() });

		// Alles beantwoord? Dan mag het model kijken of het genoeg weet. Dat
		// gebeurt in de achtergrond; de klant wacht op een status, niet op ons.
		const answers = await ctx.db
			.query("intakeAnswers")
			.withIndex("by_intake", (q) => q.eq("intakeId", intake._id))
			.collect();
		if (answers.every((a) => a.answer && a.answer.trim().length > 0)) {
			await ctx.scheduler.runAfter(0, internal.intakeAi.advance, {
				intakeId: intake._id,
			});
		}
		return null;
	},
});

// --- intern, voor de AI-acties ---------------------------------------------

export const getForAi = internalQuery({
	args: { intakeId: v.id("intakes") },
	handler: async (ctx, args) => {
		const intake = await ctx.db.get(args.intakeId);
		if (!intake) return null;
		const answers = await ctx.db
			.query("intakeAnswers")
			.withIndex("by_intake", (q) => q.eq("intakeId", args.intakeId))
			.collect();
		return {
			intake,
			answers: answers.sort((a, b) => a.order - b.order),
		};
	},
});

export const setStatus = internalMutation({
	args: {
		intakeId: v.id("intakes"),
		status: v.union(
			v.literal("vragen"),
			v.literal("denkt"),
			v.literal("contact"),
			v.literal("klaar"),
			v.literal("afgebroken"),
		),
	},
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		await ctx.db.patch(args.intakeId, {
			status: args.status,
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const appendQuestions = internalMutation({
	args: {
		intakeId: v.id("intakes"),
		questions: v.array(
			v.object({ question: v.string(), detail: v.optional(v.string()) }),
		),
	},
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		const existing = await ctx.db
			.query("intakeAnswers")
			.withIndex("by_intake", (q) => q.eq("intakeId", args.intakeId))
			.collect();
		let order = existing.length;
		for (const q of args.questions) {
			await ctx.db.insert("intakeAnswers", {
				intakeId: args.intakeId,
				order,
				question: q.question,
				detail: q.detail,
				generated: true,
			});
			order += 1;
		}
		await ctx.db.patch(args.intakeId, {
			status: "vragen",
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const finish = internalMutation({
	args: {
		intakeId: v.id("intakes"),
		summary: v.string(),
		brief: v.string(),
		stackAdvies: v.optional(v.string()),
		tokensUsed: v.optional(v.number()),
		modelUsed: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		await ctx.db.patch(args.intakeId, {
			status: "klaar",
			summary: args.summary,
			brief: args.brief,
			stackAdvies: args.stackAdvies,
			tokensUsed: args.tokensUsed,
			modelUsed: args.modelUsed,
			updatedAt: Date.now(),
		});
		return null;
	},
});

// --- voor mij in de tool ---------------------------------------------------

export const listForOwner = query({
	args: {},
	handler: async (ctx): Promise<Doc<"intakes">[]> => {
		requireOwner(await getAuthUserId(ctx));
		return await ctx.db
			.query("intakes")
			.withIndex("by_created")
			.order("desc")
			.take(100);
	},
});

export const getForOwner = query({
	args: { intakeId: v.id("intakes") },
	handler: async (ctx, args) => {
		requireOwner(await getAuthUserId(ctx));
		const intake = await ctx.db.get(args.intakeId);
		if (!intake) return null;
		const answers = await ctx.db
			.query("intakeAnswers")
			.withIndex("by_intake", (q) => q.eq("intakeId", args.intakeId))
			.collect();
		return { intake, answers: answers.sort((a, b) => a.order - b.order) };
	},
});
