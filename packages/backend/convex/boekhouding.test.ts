/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { postEntry, reverseEntry } from "./boekhouding/journal";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

function setup() {
	return convexTest(schema, modules);
}

async function createUser(t: ReturnType<typeof setup>) {
	const userId = await t.run(async (ctx) => {
		return await ctx.db.insert("users", { email: "test@brandocean.nl" });
	});
	return { userId, asUser: t.withIdentity({ subject: `${userId}|session` }) };
}

async function seededUser(t: ReturnType<typeof setup>) {
	const { userId, asUser } = await createUser(t);
	await asUser.mutation(api.boekhouding.accounts.seedChart, {});
	return { userId, asUser };
}

async function accountId(
	t: ReturnType<typeof setup>,
	ownerId: Id<"users">,
	systemKey: string,
): Promise<Id<"ledgerAccounts">> {
	return await t.run(async (ctx) => {
		const acc = await ctx.db
			.query("ledgerAccounts")
			.withIndex("by_owner_system_key", (q) =>
				q.eq("ownerId", ownerId).eq("systemKey", systemKey),
			)
			.unique();
		if (!acc) throw new Error(`account ${systemKey} missing`);
		return acc._id;
	});
}

describe("rekeningschema", () => {
	test("seedChart is idempotent", async () => {
		const t = setup();
		const { asUser } = await createUser(t);
		const first = await asUser.mutation(
			api.boekhouding.accounts.seedChart,
			{},
		);
		expect(first.created).toBeGreaterThan(30);
		const second = await asUser.mutation(
			api.boekhouding.accounts.seedChart,
			{},
		);
		expect(second.created).toBe(0);
	});
});

describe("postEntry-invarianten", () => {
	test("boekt een sluitende post en is idempotent op sourceKey", async () => {
		const t = setup();
		const { userId } = await seededUser(t);
		const bank = await accountId(t, userId, "bank");
		const kapitaal = await accountId(t, userId, "gestort_kapitaal");

		const first = await t.run(async (ctx) =>
			postEntry(ctx, {
				ownerId: userId,
				date: "2026-09-01",
				type: "opening",
				description: "Test",
				sourceKey: "opening:2026",
				lines: [
					{ accountId: bank, debitCents: 100_00, creditCents: 0 },
					{ accountId: kapitaal, debitCents: 0, creditCents: 100_00 },
				],
			}),
		);
		expect(first.created).toBe(true);

		const second = await t.run(async (ctx) =>
			postEntry(ctx, {
				ownerId: userId,
				date: "2026-09-01",
				type: "opening",
				description: "Test dubbel",
				sourceKey: "opening:2026",
				lines: [
					{ accountId: bank, debitCents: 999_00, creditCents: 0 },
					{ accountId: kapitaal, debitCents: 0, creditCents: 999_00 },
				],
			}),
		);
		expect(second.created).toBe(false);
		expect(second.entryId).toBe(first.entryId);
	});

	test("weigert niet-sluitende en ongeldige regels", async () => {
		const t = setup();
		const { userId } = await seededUser(t);
		const bank = await accountId(t, userId, "bank");
		const kapitaal = await accountId(t, userId, "gestort_kapitaal");

		const attempt = (lines: Parameters<typeof postEntry>[1]["lines"]) =>
			t.run(async (ctx) =>
				postEntry(ctx, {
					ownerId: userId,
					date: "2026-09-01",
					type: "memoriaal",
					description: "Kapot",
					sourceKey: `memoriaal:${Math.random()}`,
					lines,
				}),
			);

		// Niet in balans.
		await expect(
			attempt([
				{ accountId: bank, debitCents: 100_00, creditCents: 0 },
				{ accountId: kapitaal, debitCents: 0, creditCents: 99_00 },
			]),
		).rejects.toThrow();
		// Eén regel.
		await expect(
			attempt([{ accountId: bank, debitCents: 0, creditCents: 0 }]),
		).rejects.toThrow();
		// Debet én credit op één regel.
		await expect(
			attempt([
				{ accountId: bank, debitCents: 50_00, creditCents: 50_00 },
				{ accountId: kapitaal, debitCents: 50_00, creditCents: 50_00 },
			]),
		).rejects.toThrow();
		// Geen gehele centen.
		await expect(
			attempt([
				{ accountId: bank, debitCents: 10.5, creditCents: 0 },
				{ accountId: kapitaal, debitCents: 0, creditCents: 10.5 },
			]),
		).rejects.toThrow();
	});

	test("weigert boeken in een gesloten periode", async () => {
		const t = setup();
		const { userId } = await seededUser(t);
		const bank = await accountId(t, userId, "bank");
		const kapitaal = await accountId(t, userId, "gestort_kapitaal");
		await t.run(async (ctx) => {
			await ctx.db.insert("fiscalPeriods", {
				ownerId: userId,
				kind: "quarter",
				year: 2026,
				quarter: 1,
				startDate: "2026-01-01",
				endDate: "2026-04-01",
				status: "closed",
				closedAt: Date.now(),
				createdAt: Date.now(),
			});
		});
		await expect(
			t.run(async (ctx) =>
				postEntry(ctx, {
					ownerId: userId,
					date: "2026-02-15",
					type: "memoriaal",
					description: "In gesloten kwartaal",
					sourceKey: "memoriaal:closed",
					lines: [
						{ accountId: bank, debitCents: 10_00, creditCents: 0 },
						{ accountId: kapitaal, debitCents: 0, creditCents: 10_00 },
					],
				}),
			),
		).rejects.toThrow();
		// Buiten de gesloten periode mag wél.
		const ok = await t.run(async (ctx) =>
			postEntry(ctx, {
				ownerId: userId,
				date: "2026-04-01",
				type: "memoriaal",
				description: "In open kwartaal",
				sourceKey: "memoriaal:open",
				lines: [
					{ accountId: bank, debitCents: 10_00, creditCents: 0 },
					{ accountId: kapitaal, debitCents: 0, creditCents: 10_00 },
				],
			}),
		);
		expect(ok.created).toBe(true);
	});

	test("tegenboeking spiegelt regels en is idempotent", async () => {
		const t = setup();
		const { userId } = await seededUser(t);
		const bank = await accountId(t, userId, "bank");
		const omzet = await accountId(t, userId, "omzet_hoog");

		const original = await t.run(async (ctx) =>
			postEntry(ctx, {
				ownerId: userId,
				date: "2026-09-01",
				type: "memoriaal",
				description: "Origineel",
				sourceKey: "memoriaal:orig",
				lines: [
					{ accountId: bank, debitCents: 121_00, creditCents: 0 },
					{
						accountId: omzet,
						debitCents: 0,
						creditCents: 121_00,
						vatCategory: "hoog",
					},
				],
			}),
		);
		const reversal = await t.run(async (ctx) =>
			reverseEntry(ctx, {
				ownerId: userId,
				entryId: original.entryId,
				date: "2026-09-05",
				sourceKey: `reversal:${original.entryId}`,
			}),
		);
		expect(reversal.created).toBe(true);

		const again = await t.run(async (ctx) =>
			reverseEntry(ctx, {
				ownerId: userId,
				entryId: original.entryId,
				date: "2026-09-06",
				sourceKey: `reversal:again:${original.entryId}`,
			}),
		);
		expect(again.created).toBe(false);
		expect(again.entryId).toBe(reversal.entryId);

		await t.run(async (ctx) => {
			const orig = await ctx.db.get(original.entryId);
			expect(orig?.reversedByEntryId).toBe(reversal.entryId);
			const lines = await ctx.db
				.query("journalLines")
				.withIndex("by_entry", (q) => q.eq("entryId", reversal.entryId))
				.collect();
			const bankLine = lines.find((l) => l.accountId === bank);
			expect(bankLine?.creditCents).toBe(121_00);
			const omzetLine = lines.find((l) => l.accountId === omzet);
			expect(omzetLine?.debitCents).toBe(121_00);
			expect(omzetLine?.vatCategory).toBe("hoog");
		});
	});
});

describe("factuur-boeking", () => {
	async function createInvoice(
		t: ReturnType<typeof setup>,
		userId: Id<"users">,
		overrides: { vatRate?: number } = {},
	) {
		return await t.run(async (ctx) => {
			const clientId = await ctx.db.insert("clients", {
				ownerId: userId,
				name: "Testklant",
			});
			const now = Date.now();
			const invoiceId = await ctx.db.insert("invoices", {
				ownerId: userId,
				clientId,
				number: "BO-0001",
				status: "draft",
				issuedAt: now,
				dueAt: now,
				currency: "EUR",
				vatRate: overrides.vatRate ?? 21,
				slug: "testslug123",
				shareToken: "testtoken",
				subtotal: 1000_00,
				lineCount: 1,
				createdAt: now,
				updatedAt: now,
			});
			await ctx.db.insert("invoiceLines", {
				invoiceId,
				description: "Werk",
				quantity: 1,
				unitPrice: 1000_00,
				order: 1000,
			});
			return invoiceId;
		});
	}

	test("sent boekt debiteuren/omzet/BTW, paid boekt bank/debiteuren — beide idempotent", async () => {
		const t = setup();
		const { userId, asUser } = await seededUser(t);
		const invoiceId = await createInvoice(t, userId);

		await asUser.mutation(api.invoices.setStatus, {
			id: invoiceId,
			status: "sent",
		});
		// Nogmaals sent — mag geen tweede post opleveren.
		await asUser.mutation(api.invoices.setStatus, {
			id: invoiceId,
			status: "sent",
		});
		await asUser.mutation(api.invoices.setStatus, {
			id: invoiceId,
			status: "paid",
		});

		await t.run(async (ctx) => {
			const entries = await ctx.db
				.query("journalEntries")
				.withIndex("by_owner_date", (q) => q.eq("ownerId", userId))
				.collect();
			expect(entries).toHaveLength(2);
			const sales = entries.find((e) => e.type === "sales");
			const payment = entries.find((e) => e.type === "sales_payment");
			expect(sales?.totalCents).toBe(1210_00); // 1000 + 21% BTW
			expect(payment?.totalCents).toBe(1210_00);
		});
	});

	test("geboekte factuur is vergrendeld: regels en verwijderen geblokkeerd", async () => {
		const t = setup();
		const { userId, asUser } = await seededUser(t);
		const invoiceId = await createInvoice(t, userId);
		await asUser.mutation(api.invoices.setStatus, {
			id: invoiceId,
			status: "sent",
		});

		await expect(
			asUser.mutation(api.invoices.addLine, {
				invoiceId,
				description: "Extra",
				quantity: 1,
				unitPrice: 5000,
			}),
		).rejects.toThrow();
		await expect(
			asUser.mutation(api.invoices.update, {
				id: invoiceId,
				vatRate: 9,
			}),
		).rejects.toThrow();
		await expect(
			asUser.mutation(api.invoices.remove, { id: invoiceId }),
		).rejects.toThrow();
		await expect(
			asUser.mutation(api.invoices.setStatus, {
				id: invoiceId,
				status: "draft",
			}),
		).rejects.toThrow();
		// Notities blijven wel aanpasbaar.
		await asUser.mutation(api.invoices.update, {
			id: invoiceId,
			notes: "Mag wel",
		});
	});

	test("void draait omzet- en betalingspost terug", async () => {
		const t = setup();
		const { userId, asUser } = await seededUser(t);
		const invoiceId = await createInvoice(t, userId);
		await asUser.mutation(api.invoices.setStatus, {
			id: invoiceId,
			status: "paid",
		});
		await asUser.mutation(api.invoices.setStatus, {
			id: invoiceId,
			status: "void",
		});
		await t.run(async (ctx) => {
			const entries = await ctx.db
				.query("journalEntries")
				.withIndex("by_owner_date", (q) => q.eq("ownerId", userId))
				.collect();
			const reversals = entries.filter((e) => e.type === "reversal");
			expect(reversals).toHaveLength(2);
			// Alles telt op tot nul.
			const lines = await ctx.db.query("journalLines").collect();
			const debit = lines.reduce((acc, l) => acc + l.debitCents, 0);
			const credit = lines.reduce((acc, l) => acc + l.creditCents, 0);
			expect(debit).toBe(credit);
		});
	});

	test("zonder geseed rekeningschema blijft de factuurflow gewoon werken", async () => {
		const t = setup();
		const { userId, asUser } = await createUser(t);
		const invoiceId = await createInvoice(t, userId);
		await asUser.mutation(api.invoices.setStatus, {
			id: invoiceId,
			status: "sent",
		});
		await t.run(async (ctx) => {
			const entries = await ctx.db.query("journalEntries").collect();
			expect(entries).toHaveLength(0);
		});
	});
});

describe("rapporten", () => {
	test("proef- en saldibalans sluit na openingsbalans en factuur", async () => {
		const t = setup();
		const { userId, asUser } = await seededUser(t);
		await asUser.mutation(api.boekhouding.opening.bookOpeningBalance, {
			date: "2026-09-01",
			shareCapitalCents: 100_00,
		});
		const bank = await accountId(t, userId, "bank");
		const omzet = await accountId(t, userId, "omzet_hoog");
		await t.run(async (ctx) =>
			postEntry(ctx, {
				ownerId: userId,
				date: "2026-09-10",
				type: "memoriaal",
				description: "Omzet",
				sourceKey: "memoriaal:omzet",
				lines: [
					{ accountId: bank, debitCents: 500_00, creditCents: 0 },
					{
						accountId: omzet,
						debitCents: 0,
						creditCents: 500_00,
						vatCategory: "hoog",
					},
				],
			}),
		);
		const tb = await asUser.query(api.boekhouding.reports.trialBalance, {});
		expect(tb.totalDebitCents).toBe(tb.totalCreditCents);
		expect(tb.totalDebitCents).toBe(600_00);

		const wv = await asUser.query(api.boekhouding.reports.winstVerlies, {
			from: "2026-01-01",
			to: "2026-12-31",
		});
		expect(wv.revenueCents).toBe(500_00);
		expect(wv.resultCents).toBe(500_00);

		const balans = await asUser.query(api.boekhouding.reports.balans, {
			perDate: "2026-12-31",
		});
		expect(balans.balanced).toBe(true);
		expect(balans.assetsCents).toBe(600_00);
	});
});
