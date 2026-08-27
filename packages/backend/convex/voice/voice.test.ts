import { describe, expect, test } from "vitest";
import { toE164 } from "./number";
import { firstMessage, systemPrompt } from "./prompt";

describe("toE164", () => {
	test("Nederlands 06-nummer wordt +31", () => {
		expect(toE164("06 12 34 56 78")).toBe("+31612345678");
	});

	test("servicenummer met streepjes en haakjes", () => {
		expect(toE164("(0900) 0244")).toBe("+319000244");
	});

	test("00-prefix wordt +", () => {
		expect(toE164("0031612345678")).toBe("+31612345678");
	});

	test("al E.164 blijft ongemoeid", () => {
		expect(toE164("+3220123456")).toBe("+3220123456");
	});

	test("onzin gaat er niet stilletjes doorheen", () => {
		expect(() => toE164("bel ze even")).toThrow();
	});
});

const input = {
	company: "KPN",
	goal: "de storing op de zakelijke lijn laten inplannen",
	facts: [{ label: "klantnummer", value: "123456" }],
	callerName: "Arin Issa",
	orgName: "Brandocean",
};

describe("openingszin", () => {
	// AI Act art. 50 eist twee dingen in de eerste interactie: dat dit een
	// machine is, en namens wie er gebeld wordt. Deze test is de reden dat
	// niemand die zin er per ongeluk uit refactort.
	test("zegt dat het een AI is en namens wie", () => {
		const opening = firstMessage(input);
		expect(opening).toContain("AI-assistent");
		expect(opening).toContain("Brandocean");
	});

	test("noemt waar het gesprek over gaat", () => {
		expect(firstMessage(input)).toContain("de storing op de zakelijke lijn");
	});
});

describe("systeemprompt", () => {
	test("geeft de labels door maar nooit de waarden", () => {
		const prompt = systemPrompt(input);
		expect(prompt).toContain("klantnummer");
		expect(prompt).not.toContain("123456");
	});

	test("verbiedt bindende toezeggingen", () => {
		expect(systemPrompt(input)).toContain("nooit ja namens");
	});
});
