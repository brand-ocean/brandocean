import { describe, expect, test } from "vitest";
import {
	admitNudges,
	type EngineState,
	extendRun,
	fastDue,
	HALFWAY_MARK,
	isEcho,
	isMeLabel,
	isQuestionForMe,
	renameIn,
	runRules,
	runStreakMs,
	similarity,
	switchAgenda,
	validVoiceName,
} from "./engine";

const base: EngineState = {
	speechMsSinceFast: 0,
	speechMsSinceDeep: 0,
	lastFastAt: 0,
	lastDeepAt: 0,
	fastCalls: 0,
	deepCalls: 0,
};

describe("rondes", () => {
	test("pas na ±20 s spraak een gewone ronde", () => {
		expect(
			fastDue({ ...base, speechMsSinceFast: 5_000 }, 100_000, "cadence"),
		).toBe("skip");
		expect(
			fastDue({ ...base, speechMsSinceFast: 21_000 }, 100_000, "cadence"),
		).toBe("run");
	});

	test("een vraag aan jou gaat direct, maar wacht op een lopende ronde", () => {
		expect(fastDue(base, 100_000, "question")).toBe("run");
		expect(
			fastDue({ ...base, fastRunningSince: 95_000 }, 100_000, "question"),
		).toBe("queue");
		expect(
			fastDue({ ...base, fastRunningSince: 95_000 }, 100_000, "cadence"),
		).toBe("skip");
	});

	test("een vastgelopen ronde houdt de coach niet tegen", () => {
		expect(
			fastDue(
				{ ...base, fastRunningSince: 0, speechMsSinceFast: 30_000 },
				100_000,
				"cadence",
			),
		).toBe("run");
	});
});

describe("tekst", () => {
	test("echo van de luidspreker wordt herkend", () => {
		expect(
			isEcho(
				"wat kost het onderhoud per maand",
				"En wat kost het onderhoud per maand na livegang?",
			),
		).toBe(true);
		expect(isEcho("ik denk dat dat goed kan", "Wat kost het onderhoud?")).toBe(
			false,
		);
	});

	test("vraag aan jou", () => {
		expect(isQuestionForMe("Wat kost dat per maand bij jullie?", "Arin")).toBe(
			true,
		);
		expect(isQuestionForMe("Klopt?", "Arin")).toBe(false);
		expect(isQuestionForMe("Dat was het.", "Arin")).toBe(false);
	});

	test("overlap", () => {
		expect(
			similarity(
				"Vraag naar budget voor de Exact-koppeling",
				"Vraag naar het budget van de Exact koppeling",
			),
		).toBeGreaterThan(0.45);
	});
});

describe("nudges toelaten", () => {
	const now = 1_000_000;
	test("hooguit twee, niet binnen 45 s na de vorige", () => {
		const candidates = [
			{
				type: "vraag" as const,
				priority: "normal" as const,
				text: "Vraag naar de deadline",
			},
			{
				type: "kans" as const,
				priority: "normal" as const,
				text: "Bied beheer aan",
			},
			{
				type: "samenvatten" as const,
				priority: "low" as const,
				text: "Vat budget samen",
			},
		];
		expect(
			admitNudges({
				candidates,
				recent: [],
				now,
				lastNudgeAt: 0,
				lastHighNudgeAt: 0,
			}),
		).toHaveLength(2);
		expect(
			admitNudges({
				candidates,
				recent: [],
				now,
				lastNudgeAt: now - 20_000,
				lastHighNudgeAt: 0,
			}),
		).toHaveLength(0);
	});

	test("urgent mag door de pauze heen, herhaling niet", () => {
		const letop = {
			type: "letop" as const,
			priority: "high" as const,
			text: "Geen vaste deadline toezeggen",
			detail: "1 november is krap met de Exact-koppeling.",
		};
		expect(
			admitNudges({
				candidates: [letop],
				recent: [],
				now,
				lastNudgeAt: now - 5_000,
				lastHighNudgeAt: 0,
			}),
		).toHaveLength(1);
		expect(
			admitNudges({
				candidates: [letop],
				recent: [{ ...letop, at: now - 120_000 }],
				now,
				lastNudgeAt: 0,
				lastHighNudgeAt: 0,
			}),
		).toHaveLength(0);
	});
});

describe("regels zonder model", () => {
	const startedAt = 0;
	const agenda = [
		{ title: "Kennismaking", minutes: 5, spentMs: 0, done: false },
		{ title: "Wensen", minutes: 10, spentMs: 0, done: false },
		{ title: "Budget", minutes: 10, spentMs: 0, done: false },
		{ title: "Vervolg", minutes: 5, spentMs: 0, done: false },
	];
	const input = {
		startedAt,
		myName: "Arin",
		agenda,
		talk: [],
		silenceMs: 0,
		myStreakMs: 0,
		lastChunkAt: 0,
		silenceFiredAt: 0,
		monologueFiredAt: 0,
		ratioNudgeAt: 0,
		tempoWarned: [],
		wrapUpFired: false,
	};

	test("monoloog van 90 s geeft een ruimte-nudge met de volgende vraag", () => {
		const out = runRules({
			...input,
			now: 200_000,
			myStreakMs: 95_000,
			nextQuestion: "Wat moet de webshop over een jaar kunnen?",
		});
		expect(out.nudges[0]?.type).toBe("ruimte");
		expect(out.nudges[0]?.detail).toContain("over een jaar");
	});

	test("agendapunt over tijd geeft tempo, één keer", () => {
		const out = runRules({
			...input,
			now: 7 * 60_000,
			currentItem: 0,
			currentSince: 0,
		});
		const tempo = out.nudges.find((n) => n.type === "tempo");
		expect(tempo?.mark).toBe(0);
		const again = runRules({
			...input,
			now: 8 * 60_000,
			currentItem: 0,
			currentSince: 0,
			tempoWarned: [0, HALFWAY_MARK],
		});
		expect(again.nudges.some((n) => n.type === "tempo")).toBe(false);
	});

	test("laatste 5 minuten: afronden", () => {
		const out = runRules({
			...input,
			now: 26 * 60_000,
			tempoWarned: [HALFWAY_MARK],
		});
		expect(out.trigger).toBe("wrapup");
	});

	test("stilte na spraak", () => {
		const out = runRules({
			...input,
			now: 120_000,
			silenceMs: 9_000,
			lastChunkAt: 100_000,
		});
		expect(out.trigger).toBe("silence");
	});

	test("agenda wisselen schrijft de tijd bij", () => {
		const out = switchAgenda(agenda, 0, 0, 1, 60_000);
		expect(out.agenda[0]?.spentMs).toBe(60_000);
		expect(out.currentItem).toBe(1);
	});
});

describe("live (alleen microfoon)", () => {
	test("jouw beurt loopt door over korte pauzes en een kort 'ja'", () => {
		let run = extendRun(undefined, {
			isMine: true,
			at: 0,
			durationMs: 20_000,
			text: "a",
		});
		run = extendRun(run, {
			isMine: false,
			at: 21_000,
			durationMs: 500,
			text: "ja",
		});
		run = extendRun(run, {
			isMine: true,
			at: 22_000,
			durationMs: 70_000,
			text: "b",
		});
		expect(runStreakMs(run, 95_000)).toBe(92_000);
		const broken = extendRun(run, {
			isMine: false,
			at: 93_000,
			durationMs: 4_000,
			text: "Dat vind ik een goed idee eigenlijk",
		});
		expect(broken).toBeUndefined();
	});

	test("jij = gekozen label of je herkende naam", () => {
		expect(isMeLabel("S2", "S2", "Arin")).toBe(true);
		expect(isMeLabel("Arin", undefined, "Arin")).toBe(true);
		expect(isMeLabel("S1", "S2", "Arin")).toBe(false);
		expect(validVoiceName("S3")).toBe(false);
		expect(validVoiceName("Arin")).toBe(true);
	});

	test("zolang onbekend wie jij bent: geen spreektijd-tips, wel tempo", () => {
		const out = runRules({
			now: 7 * 60_000,
			startedAt: 0,
			myName: "Arin",
			identified: false,
			agenda: [{ title: "Intro", minutes: 3, spentMs: 0, done: false }],
			currentItem: 0,
			currentSince: 0,
			talk: [
				{ key: "S1", isMine: true, ms: 300_000, words: 900, questions: 0 },
			],
			silenceMs: 0,
			myStreakMs: 120_000,
			lastChunkAt: 0,
			silenceFiredAt: 0,
			monologueFiredAt: 0,
			ratioNudgeAt: 0,
			tempoWarned: [],
			wrapUpFired: false,
		});
		expect(out.nudges.some((n) => n.type === "ruimte")).toBe(false);
		expect(out.nudges.some((n) => n.type === "tempo")).toBe(true);
	});
});

describe("sprekers hernoemen", () => {
	test("naam zetten, wijzigen en weghalen per label", () => {
		let names = renameIn([], "S1", "  Mark  ");
		expect(names).toEqual([{ label: "S1", name: "Mark" }]);
		names = renameIn(names, "Spreker 2", "Lisa");
		names = renameIn(names, "S1", "Mark de Vries");
		expect(names).toEqual([
			{ label: "Spreker 2", name: "Lisa" },
			{ label: "S1", name: "Mark de Vries" },
		]);
		expect(renameIn(names, "S1", " ")).toEqual([
			{ label: "Spreker 2", name: "Lisa" },
		]);
	});
});
