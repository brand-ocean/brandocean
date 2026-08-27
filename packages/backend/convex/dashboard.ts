import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const summary = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;
		const [offertes, tasks, clients] = await Promise.all([
			ctx.db
				.query("offertes")
				.withIndex("by_owner", (q) => q.eq("ownerId", userId))
				.collect(),
			ctx.db
				.query("tasks")
				.withIndex("by_owner", (q) => q.eq("ownerId", userId))
				.collect(),
			ctx.db
				.query("clients")
				.withIndex("by_owner", (q) => q.eq("ownerId", userId))
				.collect(),
		]);

		const weekAgo = Date.now() - WEEK_MS;

		return {
			offerteStats: {
				total: offertes.length,
				drafts: offertes.filter((o) => !o.published).length,
				shared: offertes.filter((o) => o.published).length,
			},
			taskStats: {
				total: tasks.length,
				todo: tasks.filter((t) => t.status === "todo").length,
				inProgress: tasks.filter((t) => t.status === "in_progress").length,
				doneThisWeek: tasks.filter(
					(t) => t.status === "done" && t.updatedAt >= weekAgo,
				).length,
			},
			clientCount: clients.length,
		};
	},
});

export const recents = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;
		const [offertes, tasks] = await Promise.all([
			ctx.db
				.query("offertes")
				.withIndex("by_owner_updated", (q) => q.eq("ownerId", userId))
				.order("desc")
				.take(5),
			ctx.db
				.query("tasks")
				.withIndex("by_owner_updated", (q) => q.eq("ownerId", userId))
				.order("desc")
				.take(5),
		]);
		return {
			offertes: offertes.map((o) => ({
				_id: o._id,
				title: o.title,
				updatedAt: o.updatedAt,
				published: o.published,
			})),
			tasks: tasks.map((t) => ({
				_id: t._id,
				title: t.title,
				status: t.status,
				updatedAt: t.updatedAt,
			})),
		};
	},
});

/**
 * Everything the dashboard renders in one round trip: headline numbers with a
 * period-over-period delta, a twelve-week activity series for the charts, and
 * a merged work queue across offertes, NDAs, invoices and tasks.
 */
export const overview = query({
	args: {},
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		const [offertes, ndas, signedNdas, invoices, tasks, clients] =
			await Promise.all([
				ctx.db
					.query("offertes")
					.withIndex("by_owner", (q) => q.eq("ownerId", userId))
					.collect(),
				ctx.db
					.query("ndas")
					.withIndex("by_owner", (q) => q.eq("ownerId", userId))
					.collect(),
				ctx.db
					.query("signedNdas")
					.withIndex("by_owner", (q) => q.eq("ownerId", userId))
					.collect(),
				ctx.db
					.query("invoices")
					.withIndex("by_owner", (q) => q.eq("ownerId", userId))
					.collect(),
				ctx.db
					.query("tasks")
					.withIndex("by_owner", (q) => q.eq("ownerId", userId))
					.collect(),
				ctx.db
					.query("clients")
					.withIndex("by_owner", (q) => q.eq("ownerId", userId))
					.collect(),
			]);

		const clientName = new Map(clients.map((c) => [c._id, c.name]));

		// Invoice totals fall back to summing lines for rows written before the
		// denormalised subtotal existed.
		const invoiceTotals = await Promise.all(
			invoices.map(async (inv) => {
				let subtotal = inv.subtotal;
				if (subtotal === undefined) {
					const lines = await ctx.db
						.query("invoiceLines")
						.withIndex("by_invoice", (q) => q.eq("invoiceId", inv._id))
						.collect();
					subtotal = lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
				}
				const total = subtotal + Math.round((subtotal * inv.vatRate) / 100);
				return { inv, total };
			}),
		);

		const now = Date.now();
		const periodStart = now - 30 * DAY_MS;
		const priorStart = now - 60 * DAY_MS;

		const paidIn = (from: number, to: number) =>
			invoiceTotals
				.filter(
					(r) =>
						r.inv.status === "paid" &&
						r.inv.paidAt !== undefined &&
						r.inv.paidAt >= from &&
						r.inv.paidAt < to,
				)
				.reduce((a, r) => a + r.total, 0);

		const revenue30 = paidIn(periodStart, now);
		const revenuePrior30 = paidIn(priorStart, periodStart);

		const outstanding = invoiceTotals
			.filter((r) => r.inv.status === "sent" || r.inv.status === "overdue")
			.reduce((a, r) => a + r.total, 0);
		const overdueCount = invoiceTotals.filter(
			(r) => r.inv.status === "overdue" || (r.inv.status === "sent" && r.inv.dueAt < now),
		).length;

		const createdIn = (ts: number[], from: number, to: number) =>
			ts.filter((t) => t >= from && t < to).length;

		const offerteTimes = offertes.map((o) => o.createdAt);
		const signedTimes = signedNdas.map((s) => s.signedAt);
		const doneTimes = tasks
			.filter((t) => t.status === "done")
			.map((t) => t.updatedAt);

		// Twelve weekly buckets, oldest first.
		const weekStart = now - 11 * WEEK_MS;
		const series = Array.from({ length: 12 }, (_, i) => {
			const from = weekStart + i * WEEK_MS;
			const to = from + WEEK_MS;
			return {
				label: new Date(from).toLocaleDateString("en-GB", {
					day: "numeric",
					month: "short",
				}),
				offertes: createdIn(offerteTimes, from, to),
				signed: createdIn(signedTimes, from, to),
				done: createdIn(doneTimes, from, to),
				invoiced: invoiceTotals
					.filter((r) => r.inv.issuedAt >= from && r.inv.issuedAt < to)
					.reduce((a, r) => a + r.total, 0),
			};
		});

		// One queue of everything that recently moved, newest first.
		const queue = [
			...offertes.map((o) => ({
				key: `offerte:${o._id}`,
				kind: "offerte" as const,
				id: o._id as string,
				title: o.title,
				status: o.published ? (o.publicReadable ? "public" : "shared") : "draft",
				client: o.clientId ? (clientName.get(o.clientId) ?? null) : null,
				amount: null as number | null,
				currency: null as string | null,
				updatedAt: o.updatedAt,
			})),
			...ndas.map((n) => ({
				key: `nda:${n._id}`,
				kind: "nda" as const,
				id: n._id as string,
				title: n.title,
				status: n.signedSlug ? "signed" : n.published ? "shared" : "draft",
				client: n.clientId ? (clientName.get(n.clientId) ?? null) : null,
				amount: null as number | null,
				currency: null as string | null,
				updatedAt: n.updatedAt,
			})),
			...invoiceTotals.map((r) => ({
				key: `invoice:${r.inv._id}`,
				kind: "invoice" as const,
				id: r.inv._id as string,
				title: r.inv.number,
				status:
					r.inv.status === "sent" && r.inv.dueAt < now ? "overdue" : r.inv.status,
				client: clientName.get(r.inv.clientId) ?? null,
				amount: r.total as number | null,
				currency: r.inv.currency as string | null,
				updatedAt: r.inv.updatedAt,
			})),
			...tasks.map((t) => ({
				key: `task:${t._id}`,
				kind: "task" as const,
				id: t._id as string,
				title: t.title,
				status: t.status,
				client: t.clientId ? (clientName.get(t.clientId) ?? null) : null,
				amount: null as number | null,
				currency: null as string | null,
				updatedAt: t.updatedAt,
			})),
		]
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.slice(0, 40);

		const openTasks = tasks.filter(
			(t) => t.status !== "done" && t.status !== "canceled",
		).length;
		const openTasksPrior = tasks.filter(
			(t) =>
				t.status !== "done" &&
				t.status !== "canceled" &&
				t.createdAt < periodStart,
		).length;

		return {
			currency: invoices[0]?.currency ?? "EUR",
			revenue: { current: revenue30, prior: revenuePrior30 },
			outstanding: { total: outstanding, overdueCount },
			counts: {
				offertes: offertes.length,
				offertesShared: offertes.filter((o) => o.published).length,
				offertesDrafts: offertes.filter((o) => !o.published).length,
				ndas: ndas.length,
				ndasSigned: signedNdas.length,
				invoices: invoices.length,
				invoicesPaid: invoices.filter((i) => i.status === "paid").length,
				clients: clients.length,
				openTasks,
				openTasksPrior,
				tasksDoneThisWeek: doneTimes.filter((t) => t >= now - WEEK_MS).length,
			},
			series,
			queue,
		};
	},
});
