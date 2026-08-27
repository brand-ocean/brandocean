import { describe, expect, test } from "vitest";
import {
	computeInvoiceTotals,
	makePaymentReference,
} from "./lib/invoiceMath";

describe("computeInvoiceTotals", () => {
	test("exclusief: BTW bovenop het subtotaal", () => {
		expect(computeInvoiceTotals(1000_00, 21, false)).toEqual({
			subtotalCents: 1000_00,
			vatCents: 210_00,
			totalCents: 1210_00,
		});
	});

	test("inclusief: exact de Moneybird-voorbeeldfactuur (€2.000 incl. 21%)", () => {
		// Referentie 2026-0031: subtotaal €1.652,89 / btw €347,11 / totaal €2.000,00
		expect(computeInvoiceTotals(2000_00, 21, true)).toEqual({
			subtotalCents: 1652_89,
			vatCents: 347_11,
			totalCents: 2000_00,
		});
	});

	test("inclusief: subtotaal + btw is altijd exact het totaal", () => {
		for (const total of [1, 99, 12345, 999_999]) {
			for (const rate of [0, 9, 21]) {
				const t = computeInvoiceTotals(total, rate, true);
				expect(t.subtotalCents + t.vatCents).toBe(t.totalCents);
				expect(t.totalCents).toBe(total);
			}
		}
	});

	test("0% BTW", () => {
		expect(computeInvoiceTotals(500_00, 0, false).vatCents).toBe(0);
		expect(computeInvoiceTotals(500_00, 0, true).subtotalCents).toBe(500_00);
	});
});

describe("makePaymentReference", () => {
	// ISO 11649-validatie: verplaats "RF" + controlegetal naar het einde,
	// letters → 10..35, en het geheel mod 97 moet 1 zijn.
	function isValidRf(rf: string): boolean {
		const rearranged = rf.slice(4) + rf.slice(0, 4);
		const digits = rearranged
			.split("")
			.map((ch) =>
				ch >= "0" && ch <= "9" ? ch : String(ch.charCodeAt(0) - 55),
			)
			.join("");
		let mod = 0;
		for (const d of digits) mod = (mod * 10 + Number(d)) % 97;
		return mod === 1;
	}

	test("genereert geldige RF-kenmerken", () => {
		for (const nr of ["2026-0031", "2026-0032", "BO-0007", "20260099"]) {
			const rf = makePaymentReference(nr);
			expect(rf).toMatch(/^RF\d{2}[0-9A-Z]+$/);
			expect(isValidRf(rf)).toBe(true);
		}
	});

	test("het Moneybird-kenmerk van de voorbeeldfactuur valideert met dezelfde check", () => {
		expect(isValidRf("RF072X446SNV")).toBe(true);
	});
});
