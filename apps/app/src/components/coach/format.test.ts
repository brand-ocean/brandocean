import { describe, expect, test } from "vitest";
import { parseAgenda } from "./format";

describe("agenda plakken", () => {
	test("minuten achter de titel, in allerlei vormen", () => {
		expect(
			parseAgenda(
				"1. Kennismaking 5\n- Budget – 10 min\n• Demo (15')\nVervolg: 5m\nRoadmap Q4 2026\n\n",
			),
		).toEqual([
			{ title: "Kennismaking", minutes: 5 },
			{ title: "Budget", minutes: 10 },
			{ title: "Demo", minutes: 15 },
			{ title: "Vervolg", minutes: 5 },
			{ title: "Roadmap Q4 2026" },
		]);
	});
});
