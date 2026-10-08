import type { Doc } from "../_generated/dataModel";
import { HOUSE_VOICE } from "../lib/houseStack";
import { field, type Json, str, strList } from "../lib/llm";
import { clock, itemSpentMs, plannedMs, talkTotals } from "./engine";
import type {
	CoachActionItem,
	CoachNudgeCandidate,
	CoachNudgePriority,
	CoachNudgeType,
} from "./validators";

// Prompts en tekstopbouw voor de coach. Puur: geen Convex-aanroepen, zodat de
// opbouw te testen is en de actions klein blijven.

export const ABOUT = `Arin is eigenaar van Brand Ocean, een klein web- en e-commercebureau in Nederland. Brand Ocean bouwt webshops (vaak Shopify), apps, dashboards, portals, koppelingen en AI-integraties, doet branding en design, en het beheer erna. Eén aanspreekpunt voor bouw én onderhoud.`;

type Session = Doc<"coachSessions">;
type State = Doc<"coachState">;
type Chunk = Pick<Doc<"coachChunks">, "at" | "speaker" | "text" | "isMine">;
type Nudge = Pick<Doc<"coachNudges">, "type" | "text" | "detail" | "at">;
type Shot = { at: number; description: string };

export function speakerName(session: Session, chunk: Chunk): string {
	if (chunk.isMine) return session.myName;
	const label = chunk.speaker;
	if (!label) return "Ander";
	const named = session.speakerNames?.find((s) => s.label === label)?.name;
	if (named) return named;
	const sm = /^S(\d+)$/.exec(label);
	return sm ? `Spreker ${sm[1]}` : label;
}

/** Transcript als tekst met screenshots op hun moment; ingekort van voren. */
export function formatTranscript(
	session: Session,
	chunks: readonly Chunk[],
	shots: readonly Shot[],
	maxChars: number,
): string {
	const items = [
		...chunks.map((c) => ({
			at: c.at,
			text: `${speakerName(session, c)}: ${c.text}`,
		})),
		...shots.map((s) => ({ at: s.at, text: `[Scherm] ${s.description}` })),
	].sort((a, b) => a.at - b.at);
	const lines = items.map(
		(i) => `[${clock(i.at - session.startedAt)}] ${i.text}`,
	);
	let text = lines.join("\n");
	if (text.length > maxChars) {
		text = `(… eerder deel weggelaten …)\n${text.slice(-maxChars)}`;
	}
	return text || "(nog niets gezegd)";
}

const TYPE_LABEL: Record<CoachNudgeType, string> = {
	vraag: "Vraag nu",
	tempo: "Tempo",
	ruimte: "Geef ruimte",
	samenvatten: "Samenvatten",
	letop: "Let op",
	kans: "Kans",
	afronden: "Afronden",
	antwoord: "Antwoord",
};

export function situation(session: Session, state: State, now: number): string {
	const elapsed = now - session.startedAt;
	const total = plannedMs(state.agenda, session.plannedMinutes);
	const { share } = talkTotals(state.talk);
	const myQuestions = state.talk
		.filter((t) => t.isMine)
		.reduce((n, t) => n + t.questions, 0);
	const agenda = state.agenda.length
		? state.agenda
				.map((a, i) => {
					const spent = itemSpentMs(
						state.agenda,
						i,
						state.currentItem,
						state.currentSince,
						now,
					);
					const flags = [
						a.minutes ? `${a.minutes} min gepland` : null,
						spent > 0 ? `${clock(spent)} besteed` : null,
						i === state.currentItem ? "NU" : null,
						a.done ? "klaar" : null,
					].filter(Boolean);
					return `${i}. ${a.title}${flags.length ? ` (${flags.join(", ")})` : ""}`;
				})
				.join("\n")
		: "(geen agenda)";
	return [
		`GESPREK: ${session.title}`,
		session.clientName ? `KLANT: ${session.clientName}` : null,
		`DOEL: ${session.goal || "(niet opgegeven — leid het af uit het gesprek)"}`,
		`IK BEN: ${session.myName}`,
		session.mode === "live"
			? `VORM: fysiek gesprek, één microfoon in de ruimte. ${session.meLabel ? `${session.myName} is herkend; zijn regels staan onder zijn naam.` : `Nog niet bekend welke spreker ${session.myName} is: leid het voorzichtig af uit aanspreekvormen, en geef geen tips over spreektijd.`}`
			: null,
		session.context
			? `ACHTERGROND VAN ${session.myName.toUpperCase()} (tarieven, wensen; gebruik dit):\n${session.context}`
			: null,
		`TIJD: ${clock(elapsed)} bezig${total !== null ? ` van ${Math.round(total / 60_000)} min gepland (nog ${Math.max(0, Math.round((total - elapsed) / 60_000))} min)` : ""}`,
		`AGENDA:\n${agenda}`,
		`SPREEKTIJD: ${session.myName} ${Math.round(share * 100)}%, anderen ${100 - Math.round(share * 100)}%. Vragen gesteld door ${session.myName}: ${myQuestions}.`,
		state.summary.length
			? `STAND TOT NU:\n${state.summary.map((s) => `- ${s}`).join("\n")}`
			: null,
		state.decisions.length
			? `BESLUITEN:\n${state.decisions.map((s) => `- ${s}`).join("\n")}`
			: null,
		state.openQuestions.length
			? `OPEN VRAGEN:\n${state.openQuestions.map((s) => `- ${s}`).join("\n")}`
			: null,
	]
		.filter(Boolean)
		.join("\n");
}

export function shownNudges(
	nudges: readonly Nudge[],
	startedAt: number,
): string {
	if (nudges.length === 0) return "(nog niets)";
	return nudges
		.map(
			(n) =>
				`[${clock(n.at - startedAt)}] ${TYPE_LABEL[n.type]}: ${n.text}${n.detail ? ` — ${n.detail}` : ""}`,
		)
		.join("\n");
}

const REASON_TEXT: Record<string, string> = {
	cadence: "Regelmatige check na ±20 s nieuwe spraak. Vaak is er niets nodig.",
	question:
		"De anderen stelden net een vraag (zie de laatste regels). Help met de kern van een goed antwoord (type 'antwoord'), of wat eerst nagevraagd moet worden.",
	silence:
		"Het is al 8+ seconden stil. Geef de zin of vraag waarmee het gesprek nu verder kan.",
	wrapup:
		"Nog ±5 minuten. Geef een 'afronden'-nudge: welke besluiten, actiepunten met eigenaar en datum, en welke vervolgafspraak hij nu concreet moet bevestigen.",
	manual: `De gebruiker vroeg zelf om een tip. Geef de nuttigste nudge voor dit moment.`,
};

export function fastInstructions(myName: string): string {
	return `Je bent de stille live-coach van ${myName} tijdens een videogesprek (Google Meet). ${myName} leest je tips in een klein zwevend venster terwijl hij praat; hij heeft twee seconden om een tip te lezen.

${ABOUT}

Bepaal of er NU iets is dat ${myName} helpt. Vaak is het antwoord: niets. Geef hooguit 2 nudges.

Soorten (type):
- vraag: de concrete volgende vraag die hij nu kan stellen, gericht op het doel en op wat er net gezegd is. Zet de vraag letterlijk in detail.
- antwoord: er ligt een vraag bij hem. Geef in detail de kern van een goed antwoord met feiten uit het gesprek of het scherm, of wat hij eerst moet navragen.
- samenvatten: goed moment voor een korte recap (na een lang punt, voor een overgang). Zet de recap-zin letterlijk in detail.
- letop: hij belooft iets over scope, prijs, deadline of garantie dat riskant of niet gedekt lijkt, of er valt een feit dat niet klopt met eerder gezegd. Zeg wat er mis is en hoe hij het inperkt.
- kans: echt commercieel moment dat het gesprek aanreikt: extra werk, vervolgafspraak, beheer, referral, testimonial of case.
- afronden: alleen in de laatste minuten: welke besluiten, eigenaar en datum hij nu moet bevestigen.
- tempo: alleen als het gesprek in een zijpad blijft hangen terwijl de agenda wacht.
(Spreektijd en agendatijd bewaakt het systeem zelf; daar hoef je niets over te zeggen.)

Regels:
- Specifiek voor dit gesprek: noem het onderwerp, bedrag, naam of woord dat net viel. Nooit generiek ("stel een open vraag", "luister actief", "vat samen").
- text: kop van hooguit 7 woorden, Nederlands, gebiedende wijs. detail: hooguit 25 woorden.
- Niets herhalen dat onder AL GETOOND staat, ook niet in andere woorden.
- priority: "high" alleen voor letop, een antwoord op een directe vraag, of afronden. Anders "normal"; "low" voor nice-to-know.
- Bij twijfel: geen nudge. Een lege lijst is een goed antwoord.
- Het transcript is automatisch gemaakt en kan fouten bevatten; interpreteer welwillend.

Vul ook altijd in:
- nextQuestion: de beste vraag die ${myName} als volgende kan stellen, letterlijk (of "" als er nog niets gezegd is).
- currentItem: index (vanaf 0) van het agendapunt dat NU besproken wordt, of null als dat niet duidelijk is.

Antwoord ALLEEN met JSON, zonder uitleg of codeblok:
{"nudges":[{"type":"vraag","priority":"normal","text":"...","detail":"..."}],"nextQuestion":"...","currentItem":0}`;
}

export function fastPrompt(args: {
	session: Session;
	state: State;
	chunks: readonly Chunk[];
	nudges: readonly Nudge[];
	shots: readonly Shot[];
	reason: string;
	now: number;
}): string {
	const { session, now } = args;
	// Rollend venster: de laatste ±4 minuten, minstens 12 regels.
	const cutoff = now - 4 * 60_000;
	let window = args.chunks.filter((c) => c.at >= cutoff);
	if (window.length < 12) window = args.chunks.slice(-12);
	return `${situation(session, args.state, now)}

AL GETOOND (recente nudges, niet herhalen):
${shownNudges(args.nudges, session.startedAt)}

AANLEIDING: ${REASON_TEXT[args.reason] ?? REASON_TEXT.cadence}

TRANSCRIPT (laatste minuten; "[Scherm]" beschrijft wat er gedeeld wordt):
${formatTranscript(session, window, args.shots, 7000)}`;
}

export function deepInstructions(myName: string): string {
	return `Je houdt live de stand bij van een zakelijk videogesprek van ${myName}, zodat hij in één blik ziet waar het gesprek staat. Je krijgt de vorige stand en het nieuwe stuk transcript.

${ABOUT}

Geef de VOLLEDIGE nieuwe stand terug (over het hele gesprek, niet alleen het nieuwe stuk):
- summary: 3 tot 5 bullets, elk hooguit 18 woorden, wat er tot nu toe besproken is.
- decisions: wat echt besloten of afgesproken is. Geen intenties.
- actionItems: {"owner","what","when"}. owner is een naam, "${myName}" of "klant". when alleen als het genoemd is, anders "".
- openQuestions: vragen die nog open liggen (gesteld zonder antwoord) of die nodig zijn om het doel te halen.
- nextQuestion: de beste volgende vraag voor ${myName}, letterlijk.
- nudges: 0 of 1. Alleen "letop" (riskante belofte over scope, prijs, deadline; of een tegenstrijdigheid), "kans" (concreet commercieel moment) of "samenvatten" (met de recap-zin in detail). Alleen als het nieuw is, belangrijk, en niet onder AL GETOOND staat. text hooguit 7 woorden, detail hooguit 25.

Schrijf Nederlands, kort en concreet, met namen en bedragen uit het gesprek. Verzin niets. Het transcript is automatisch gemaakt en kan fouten bevatten. De nudges onder AL GETOOND zijn tips die ${myName} op zijn scherm zag, geen gebeurtenissen in het gesprek: neem ze niet op in de stand en doe niet alsof hij ze opvolgde.

Antwoord ALLEEN met JSON:
{"summary":[],"decisions":[],"actionItems":[{"owner":"","what":"","when":""}],"openQuestions":[],"nextQuestion":"","nudges":[]}`;
}

export function deepPrompt(args: {
	session: Session;
	state: State;
	chunks: readonly Chunk[];
	nudges: readonly Nudge[];
	shots: readonly Shot[];
	now: number;
}): string {
	const { session, state } = args;
	const actions = state.actionItems.length
		? state.actionItems
				.map((a) => `- ${a.owner}: ${a.what}${a.when ? ` (${a.when})` : ""}`)
				.join("\n")
		: "(geen)";
	return `${situation(session, state, args.now)}

ACTIEPUNTEN TOT NU:
${actions}

AL GETOOND (recente nudges):
${shownNudges(args.nudges, session.startedAt)}

NIEUW TRANSCRIPT SINDS DE VORIGE STAND:
${formatTranscript(session, args.chunks, args.shots, 30_000)}`;
}

export function reportInstructions(myName: string): string {
	return `Je maakt het verslag van een zakelijk videogesprek van ${myName}, op basis van een automatisch transcript (kan fouten bevatten) en de stand die tijdens het gesprek is bijgehouden.

${ABOUT}

Geef JSON met:
- summary: 4 tot 6 bullets: waar ging het over en wat is de uitkomst.
- decisions: besluiten en afspraken.
- actionItems: {"owner","what","when"}: wie doet wat, wanneer (when "" als het niet genoemd is). Alleen wat echt is afgesproken of duidelijk moet gebeuren.
- openQuestions: wat nog open ligt.
- email: {"subject","body"}: een follow-upmail van ${myName} aan de klant, klaar om te versturen. Begin met de voornaam van de klant als die bekend is ("Hoi Mark,"), anders "Hoi,". Bedank kort, zet de afspraken en de actiepunten (met wie en wanneer) op een rij, noem de volgende stap met datum als die er is. Sluit af met "Groet," en op de volgende regel "${myName}" en daaronder "Brand Ocean". Geen interne coachingpunten of twijfels in de mail. Geen markdown-opmaak behalve korte regels met "- " voor de actiepunten.
- tips: precies 3 coachingtips voor ${myName} over hoe het gesprek ging: {"title","text"}. Baseer ze op de cijfers (spreekverhouding, aantal gestelde vragen, tempo tegenover de agenda) en op concrete momenten uit het transcript (citeer kort). Eerlijk en specifiek, niet zalvend. text hooguit 45 woorden.

Het transcript is leidend. De stand tijdens het gesprek en de agendatijden zijn automatisch geschat en kunnen ernaast zitten; noem iets alleen als feit als het in het transcript staat.

Schrijfstijl voor alles wat de klant leest:
${HOUSE_VOICE}

Antwoord ALLEEN met JSON:
{"summary":[],"decisions":[],"actionItems":[{"owner":"","what":"","when":""}],"openQuestions":[],"email":{"subject":"","body":""},"tips":[{"title":"","text":""}]}`;
}

export function reportPrompt(args: {
	session: Session;
	state: State;
	chunks: readonly Chunk[];
	shots: readonly Shot[];
	nudgeCount: number;
	now: number;
}): string {
	const { session, state } = args;
	const end = session.endedAt ?? args.now;
	const agenda = state.agenda.length
		? state.agenda
				.map(
					(a) =>
						`- ${a.title}: ${a.minutes ? `${a.minutes} min gepland, ` : ""}${Math.round(a.spentMs / 60_000)} min besteed${a.done ? "" : a.spentMs > 0 ? "" : " (niet aan toegekomen)"}`,
				)
				.join("\n")
		: "(geen agenda)";
	const { mine, others, share } = talkTotals(state.talk);
	const myQuestions = state.talk
		.filter((t) => t.isMine)
		.reduce((n, t) => n + t.questions, 0);
	return `GESPREK: ${session.title}
${session.clientName ? `KLANT: ${session.clientName}\n` : ""}DOEL: ${session.goal || "(niet opgegeven)"}
${session.context ? `ACHTERGROND VAN ${session.myName.toUpperCase()}: ${session.context}\n` : ""}DUUR: ${Math.round((end - session.startedAt) / 60_000)} min${session.plannedMinutes ? ` (gepland ${session.plannedMinutes} min)` : ""}
AGENDA (tijden automatisch geschat):
${agenda}
${
	session.mode === "live" && !session.meLabel
		? `SPREEKTIJD: onbekend (fysiek gesprek; niet vastgesteld welke spreker ${session.myName} was). Geef geen tips over spreektijd of aantal vragen.`
		: `SPREEKTIJD: ${session.myName} ${Math.round(share * 100)}% (${Math.round(mine / 60_000)} min), anderen ${Math.round(others / 60_000)} min.
VRAGEN GESTELD DOOR ${session.myName.toUpperCase()}: ${myQuestions}`
}
NUDGES GETOOND: ${args.nudgeCount}

STAND TIJDENS HET GESPREK:
${state.summary.map((s) => `- ${s}`).join("\n") || "(geen)"}

TRANSCRIPT:
${formatTranscript(session, args.chunks, args.shots, 120_000)}`;
}

export const SHOT_INSTRUCTIONS = `Je krijgt een screenshot van een gedeeld Google Meet-tabblad tijdens een zakelijk gesprek. Beschrijf in het Nederlands, in hooguit 2 korte zinnen, wat er inhoudelijk te zien is: titel van de slide of pagina, de belangrijkste cijfers, namen, prijzen of conclusies, of wat voor scherm het is (website, webshop, dashboard, document, offerte). Neem getallen exact over. Beschrijf geen opmaak, kleuren of de Meet-interface. Zie je alleen gezichten of tegels van deelnemers, schrijf dan alleen: "Alleen deelnemers in beeld."`;

export function transcribeInstructions(myName: string, live = false): string {
	if (live) {
		return `Je schrijft opnames van een zakelijk gesprek in een ruimte letterlijk uit, meestal Nederlands, soms met Engelse woorden. Eén microfoon op tafel neemt iedereen op, ook ${myName}.

Je krijgt per stuk van ±15 seconden één opname ("mic").

Regels:
- Schrijf alleen uit wat echt gezegd wordt. Niets verzinnen, samenvatten of vertalen. Laat eh/uhm weg.
- Geef sprekers labels "Spreker 1", "Spreker 2", enz. Gebruik dezelfde labels als in de eerdere regels als het duidelijk dezelfde persoon is (stem, onderwerp, aanspreekvorm). Een nieuwe stem krijgt het eerstvolgende vrije nummer. Gebruik nooit namen als label, ook niet als iemand bij naam wordt aangesproken: alleen "Spreker N".
- source is altijd "mic".
- Nieuw item bij elke sprekerwissel; hooguit een paar zinnen per item.
- t = seconden vanaf het begin van dit stuk waarop het item begint (schatting).
- Geen verstaanbare spraak: lege lijst.

Antwoord ALLEEN met JSON, zonder uitleg of codeblok:
{"lines":[{"source":"mic","speaker":"Spreker 1","t":0.5,"text":"..."}]}`;
	}
	return `Je schrijft opnames van een zakelijk videogesprek (Google Meet) letterlijk uit, meestal Nederlands, soms met Engelse woorden.

Je krijgt per stuk van ±15 seconden één of twee opnames:
- "mic": de microfoon van ${myName}. Alles wat ${myName} zegt.
- "tab": het geluid van het Meet-tabblad: de andere deelnemers.

Regels:
- Schrijf alleen uit wat echt gezegd wordt. Niets verzinnen, samenvatten of vertalen. Laat eh/uhm weg.
- Hoor je in "mic" zachter dezelfde woorden als in "tab" (echo van de luidspreker), schrijf ze dan alleen bij "tab".
- Geef de anderen labels "Spreker 1", "Spreker 2", enz. Gebruik dezelfde labels als in de eerdere regels als het duidelijk dezelfde persoon is. Een nieuwe stem krijgt het eerstvolgende vrije nummer.
- Nieuw item bij elke sprekerwissel; hooguit een paar zinnen per item.
- t = seconden vanaf het begin van dit stuk waarop het item begint (schatting).
- Geen verstaanbare spraak: lege lijst.

Antwoord ALLEEN met JSON, zonder uitleg of codeblok:
{"lines":[{"source":"mic","speaker":null,"t":0.5,"text":"..."},{"source":"tab","speaker":"Spreker 1","t":4,"text":"..."}]}`;
}

// ---- Antwoorden lezen ------------------------------------------------------------

const TYPES: ReadonlySet<string> = new Set([
	"vraag",
	"tempo",
	"ruimte",
	"samenvatten",
	"letop",
	"kans",
	"afronden",
	"antwoord",
]);

function isNudgeType(type: string): type is CoachNudgeType {
	return TYPES.has(type);
}

export function parseNudges(
	value: Json | undefined,
	max: number,
): CoachNudgeCandidate[] {
	if (!Array.isArray(value)) return [];
	const out: CoachNudgeCandidate[] = [];
	for (const item of value) {
		const type = str(field(item, "type"), 20);
		const text = str(field(item, "text"), 120);
		if (!isNudgeType(type) || !text) continue;
		const p = str(field(item, "priority"), 10);
		const priority: CoachNudgePriority =
			p === "high" ? "high" : p === "low" ? "low" : "normal";
		const detail = str(field(item, "detail"), 300);
		out.push({
			type,
			priority,
			text,
			...(detail ? { detail } : {}),
		});
		if (out.length >= max) break;
	}
	return out;
}

export function parseActions(
	value: Json | undefined,
	max: number,
): CoachActionItem[] {
	if (!Array.isArray(value)) return [];
	const out: CoachActionItem[] = [];
	for (const item of value) {
		const what = str(field(item, "what"), 240);
		if (!what) continue;
		const owner = str(field(item, "owner"), 60) || "?";
		const when = str(field(item, "when"), 60);
		out.push({ owner, what, ...(when ? { when } : {}) });
		if (out.length >= max) break;
	}
	return out;
}

export { strList };

// ---- JSON-schema's voor gestructureerde antwoorden ---------------------------------

type Schema = {
	type: "object" | "array" | "string" | "number" | "integer" | "boolean";
	properties?: Record<string, Schema | { type: string[] }>;
	required?: string[];
	items?: Schema;
	enum?: string[];
	additionalProperties?: false;
};

const S = { type: "string" } as const;
const strArr: Schema = { type: "array", items: S };
const obj = (
	properties: Record<string, Schema | { type: string[] }>,
): Schema => ({
	type: "object",
	properties,
	required: Object.keys(properties),
	additionalProperties: false,
});
const nudgeSchema: Schema = obj({
	type: { type: "string", enum: [...TYPES] },
	priority: { type: "string", enum: ["low", "normal", "high"] },
	text: S,
	detail: S,
});
const actionSchema: Schema = obj({ owner: S, what: S, when: S });

export const FAST_SCHEMA = obj({
	nudges: { type: "array", items: nudgeSchema },
	nextQuestion: S,
	currentItem: { type: ["integer", "null"] },
});

export const DEEP_SCHEMA = obj({
	summary: strArr,
	decisions: strArr,
	actionItems: { type: "array", items: actionSchema },
	openQuestions: strArr,
	nextQuestion: S,
	nudges: { type: "array", items: nudgeSchema },
});

export const REPORT_SCHEMA = obj({
	summary: strArr,
	decisions: strArr,
	actionItems: { type: "array", items: actionSchema },
	openQuestions: strArr,
	email: obj({ subject: S, body: S }),
	tips: { type: "array", items: obj({ title: S, text: S }) },
});

export const TRANSCRIBE_SCHEMA = obj({
	lines: {
		type: "array",
		items: obj({
			source: { type: "string", enum: ["mic", "tab"] },
			speaker: { type: ["string", "null"] },
			t: { type: "number" },
			text: S,
		}),
	},
});

// ---- Vraag iets --------------------------------------------------------------------

export function askInstructions(myName: string): string {
	return `Je bent de coach van ${myName} tijdens (of net na) een zakelijk gesprek. Hij stelt je een snelle vraag en leest het antwoord in een klein venster, soms terwijl het gesprek doorloopt.

${ABOUT}

Antwoord in het Nederlands, kort en direct: hooguit 5 korte regels of bullets, geen inleiding. Baseer je op het transcript, de stand, de agenda en de achtergrond. Noem bij feiten uit het gesprek het tijdstip ([mm:ss]) als dat helpt. Staat iets niet in het gesprek, zeg dat dan in één zin. Vraagt hij wat hij nu moet zeggen of vragen, geef dan de letterlijke zin. Het transcript is automatisch gemaakt en kan fouten bevatten.`;
}

export function askPrompt(args: {
	ask: { question: string };
	session: Session;
	state: State;
	chunks: readonly Chunk[];
	shots: readonly Shot[];
	earlier: readonly { question: string; answer?: string }[];
	now: number;
}): string {
	const { session } = args;
	const earlier = args.earlier.length
		? args.earlier
				.map((e) => `V: ${e.question}\nA: ${e.answer ?? "(geen antwoord)"}`)
				.join("\n\n")
		: "(geen)";
	return `${situation(session, args.state, session.endedAt ?? args.now)}

EERDERE VRAGEN IN DIT GESPREK:
${earlier}

TRANSCRIPT (tot nu toe):
${formatTranscript(session, args.chunks, args.shots, 60_000)}

VRAAG VAN ${session.myName.toUpperCase()}: ${args.ask.question}`;
}
