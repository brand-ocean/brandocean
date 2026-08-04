import { ConvexError, v } from "convex/values";
import { customAlphabet } from "nanoid";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireOwner } from "./lib/auth";

// Vragenlijsten. Eén lijst per onderwerp, genummerde vragen, gedeeld via een
// link met token. De klant antwoordt per vraag op de publieke pagina; wij lezen
// de antwoorden hier terug en vinken ze af.

const slugAlphabet =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const newSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 4);
const newShareToken = customAlphabet(slugAlphabet, 24);

function slugify(input: string): string {
	const base = input
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
	return base || "vragen";
}

async function uniqueSlug(ctx: MutationCtx, base: string): Promise<string> {
	const root = slugify(base);
	const taken = await ctx.db
		.query("specs")
		.withIndex("by_slug", (q) => q.eq("slug", root))
		.first();
	if (!taken) return root;
	for (let i = 2; i < 50; i++) {
		const candidate = `${root}-${i}`;
		const found = await ctx.db
			.query("specs")
			.withIndex("by_slug", (q) => q.eq("slug", candidate))
			.first();
		if (!found) return candidate;
	}
	return `${root}-${newSuffix()}`;
}

async function ownedSpec(
	ctx: QueryCtx | MutationCtx,
	specId: Id<"specs">,
): Promise<Doc<"specs">> {
	const userId = await requireOwner(ctx);
	const spec = await ctx.db.get(specId);
	if (!spec) throw new ConvexError("not_found");
	if (spec.ownerId !== userId) throw new ConvexError("forbidden");
	return spec;
}

async function questionsOf(
	ctx: QueryCtx,
	specId: Id<"specs">,
): Promise<Doc<"specQuestions">[]> {
	const rows = await ctx.db
		.query("specQuestions")
		.withIndex("by_spec", (q) => q.eq("specId", specId))
		.collect();
	// Blokkerende vragen bovenaan, daarbinnen op eigen volgorde. Zo ziet de
	// klant meteen waar hij écht op moet reageren.
	return rows.sort(
		(a, b) => Number(b.blocking) - Number(a.blocking) || a.order - b.order,
	);
}

// --- Beheer (ingelogd) -----------------------------------------------------

export const create = mutation({
	args: { title: v.string(), clientId: v.optional(v.id("clients")) },
	handler: async (ctx, args): Promise<Id<"specs">> => {
		const userId = await requireOwner(ctx);
		const title = args.title.trim();
		if (title === "") throw new ConvexError("Geef de lijst een titel");
		const client = args.clientId ? await ctx.db.get(args.clientId) : null;
		const now = Date.now();
		return await ctx.db.insert("specs", {
			ownerId: userId,
			clientId: args.clientId,
			title,
			slug: await uniqueSlug(ctx, client?.name ? `${client.name} ${title}` : title),
			shareToken: newShareToken(),
			published: false,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const listByOwner = query({
	args: {},
	handler: async (
		ctx,
	): Promise<
		(Doc<"specs"> & { total: number; answered: number; openBlocking: number })[]
	> => {
		const userId = await requireOwner(ctx);
		const specs = await ctx.db
			.query("specs")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.order("desc")
			.collect();
		return await Promise.all(
			specs.map(async (spec) => {
				const rows = await questionsOf(ctx, spec._id);
				return {
					...spec,
					total: rows.length,
					answered: rows.filter((r) => r.answer !== undefined).length,
					openBlocking: rows.filter(
						(r) => r.blocking && r.answer === undefined,
					).length,
				};
			}),
		);
	},
});

export const getById = query({
	args: { id: v.id("specs") },
	handler: async (
		ctx,
		args,
	): Promise<{ spec: Doc<"specs">; questions: Doc<"specQuestions">[] }> => {
		const spec = await ownedSpec(ctx, args.id);
		return { spec, questions: await questionsOf(ctx, spec._id) };
	},
});

export const update = mutation({
	args: {
		id: v.id("specs"),
		title: v.optional(v.string()),
		intro: v.optional(v.string()),
		clientId: v.optional(v.id("clients")),
	},
	handler: async (ctx, args): Promise<null> => {
		await ownedSpec(ctx, args.id);
		await ctx.db.patch(args.id, {
			updatedAt: Date.now(),
			...(args.title !== undefined ? { title: args.title.trim() } : {}),
			...(args.intro !== undefined ? { intro: args.intro } : {}),
			...(args.clientId !== undefined ? { clientId: args.clientId } : {}),
		});
		return null;
	},
});

export const setPublished = mutation({
	args: { id: v.id("specs"), published: v.boolean() },
	handler: async (ctx, args): Promise<null> => {
		await ownedSpec(ctx, args.id);
		await ctx.db.patch(args.id, {
			published: args.published,
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const remove = mutation({
	args: { id: v.id("specs") },
	handler: async (ctx, args): Promise<null> => {
		await ownedSpec(ctx, args.id);
		const rows = await ctx.db
			.query("specQuestions")
			.withIndex("by_spec", (q) => q.eq("specId", args.id))
			.collect();
		for (const row of rows) await ctx.db.delete(row._id);
		await ctx.db.delete(args.id);
		return null;
	},
});

export const addQuestion = mutation({
	args: {
		specId: v.id("specs"),
		question: v.string(),
		detail: v.optional(v.string()),
		fallback: v.optional(v.string()),
		blocking: v.boolean(),
	},
	handler: async (ctx, args): Promise<Id<"specQuestions">> => {
		await ownedSpec(ctx, args.specId);
		const question = args.question.trim();
		if (question === "") throw new ConvexError("Vraag mag niet leeg zijn");
		const existing = await ctx.db
			.query("specQuestions")
			.withIndex("by_spec", (q) => q.eq("specId", args.specId))
			.collect();
		const order =
			existing.reduce((max, row) => Math.max(max, row.order), 0) + 1;
		await ctx.db.patch(args.specId, { updatedAt: Date.now() });
		return await ctx.db.insert("specQuestions", {
			specId: args.specId,
			order,
			question,
			detail: args.detail?.trim() || undefined,
			fallback: args.fallback?.trim() || undefined,
			blocking: args.blocking,
			resolved: false,
		});
	},
});

export const updateQuestion = mutation({
	args: {
		id: v.id("specQuestions"),
		question: v.optional(v.string()),
		detail: v.optional(v.string()),
		fallback: v.optional(v.string()),
		blocking: v.optional(v.boolean()),
		resolved: v.optional(v.boolean()),
	},
	handler: async (ctx, args): Promise<null> => {
		const row = await ctx.db.get(args.id);
		if (!row) throw new ConvexError("not_found");
		await ownedSpec(ctx, row.specId);
		await ctx.db.patch(args.id, {
			...(args.question !== undefined ? { question: args.question.trim() } : {}),
			...(args.detail !== undefined
				? { detail: args.detail.trim() || undefined }
				: {}),
			...(args.fallback !== undefined
				? { fallback: args.fallback.trim() || undefined }
				: {}),
			...(args.blocking !== undefined ? { blocking: args.blocking } : {}),
			...(args.resolved !== undefined ? { resolved: args.resolved } : {}),
		});
		return null;
	},
});

export const removeQuestion = mutation({
	args: { id: v.id("specQuestions") },
	handler: async (ctx, args): Promise<null> => {
		const row = await ctx.db.get(args.id);
		if (!row) return null;
		await ownedSpec(ctx, row.specId);
		await ctx.db.delete(args.id);
		return null;
	},
});

// --- Publieke pagina (geen login, token in de link) ------------------------

export const getBySlug = query({
	args: { slug: v.string(), token: v.optional(v.string()) },
	handler: async (
		ctx,
		args,
	): Promise<{
		title: string;
		intro?: string;
		questions: {
			_id: Id<"specQuestions">;
			question: string;
			detail?: string;
			fallback?: string;
			blocking: boolean;
			answer?: string;
			answeredBy?: string;
			answeredAt?: number;
		}[];
	} | null> => {
		const spec = await ctx.db
			.query("specs")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (!spec || !spec.published) return null;
		if (args.token !== spec.shareToken) return null;
		const rows = await questionsOf(ctx, spec._id);
		return {
			title: spec.title,
			intro: spec.intro,
			// Bewust niet het hele document terug: de publieke pagina heeft geen
			// eigenaar, token of interne velden nodig.
			questions: rows.map((r) => ({
				_id: r._id,
				question: r.question,
				detail: r.detail,
				fallback: r.fallback,
				blocking: r.blocking,
				answer: r.answer,
				answeredBy: r.answeredBy,
				answeredAt: r.answeredAt,
			})),
		};
	},
});

// Antwoord van de klant. De token in de link is de sleutel: hij moet horen bij
// de lijst waar deze vraag onder hangt, anders kan iemand met één geldige link
// in andermans lijst schrijven.
export const answerQuestion = mutation({
	args: {
		questionId: v.id("specQuestions"),
		token: v.string(),
		answer: v.string(),
		name: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<null> => {
		const row = await ctx.db.get(args.questionId);
		if (!row) throw new ConvexError("not_found");
		const spec = await ctx.db.get(row.specId);
		if (!spec || !spec.published) throw new ConvexError("not_found");
		if (spec.shareToken !== args.token) throw new ConvexError("forbidden");
		const answer = args.answer.trim();
		await ctx.db.patch(args.questionId, {
			answer: answer || undefined,
			answeredBy: answer ? args.name?.trim() || undefined : undefined,
			answeredAt: answer ? Date.now() : undefined,
		});
		await ctx.db.patch(spec._id, { updatedAt: Date.now() });
		return null;
	},
});
