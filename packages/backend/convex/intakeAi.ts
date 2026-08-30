import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { HOUSE_STACK, HOUSE_VOICE } from "./lib/houseStack";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Doorvragen is goedkoop werk: kijken wat er ontbreekt. De brief is het echte
// denkwerk en mag duurder zijn. Verifieer een id met `or.sh models` als een
// call ineens 404 geeft — het aanbod verandert.
const MODEL_VRAGEN = "google/gemini-3.7-flash";
const MODEL_BRIEF = "anthropic/claude-opus-5";

// Zonder plafond kan één bezoeker eindeloos doorvragen uitlokken.
const MAX_VRAAGRONDES = 3;
const MAX_VRAGEN_PER_RONDE = 3;

type ChatMessage = { role: "system" | "user"; content: string };

type OpenRouterChoice = { message?: { content?: string } };
type OpenRouterResponse = {
	choices?: OpenRouterChoice[];
	usage?: { total_tokens?: number };
	error?: { message?: string; code?: number };
};

async function callOpenRouter(
	model: string,
	messages: ChatMessage[],
	jsonSchema?: Record<string, unknown>,
): Promise<{ text: string; tokens: number }> {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) throw new ConvexError("openrouter_not_configured");

	const body: Record<string, unknown> = { model, messages };
	if (jsonSchema) {
		body.response_format = {
			type: "json_schema",
			json_schema: { name: "intake", strict: true, schema: jsonSchema },
		};
	}

	const res = await fetch(OPENROUTER_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
			// OpenRouter gebruikt deze twee voor attributie in hun dashboard.
			"HTTP-Referer": "https://brandocean.nl",
			"X-Title": "Brandocean intake",
		},
		body: JSON.stringify(body),
	});

	const data: OpenRouterResponse = await res.json();
	if (!res.ok || data.error) {
		throw new ConvexError(
			`openrouter_${res.status}: ${data.error?.message ?? "onbekende fout"}`,
		);
	}
	const text = data.choices?.[0]?.message?.content;
	if (!text) throw new ConvexError("openrouter_lege_respons");
	return { text, tokens: data.usage?.total_tokens ?? 0 };
}

function transcript(
	answers: { question: string; answer?: string }[],
): string {
	return answers
		.map((a) => `V: ${a.question}\nA: ${a.answer?.trim() || "(geen antwoord)"}`)
		.join("\n\n");
}

/**
 * Draait nadat de bezoeker alles beantwoord heeft. Bepaalt of er nog iets
 * ontbreekt en stelt dan nieuwe vragen, of schrijft het eindresultaat.
 *
 * De bezoeker merkt hier niets van behalve dat er vragen bij komen. Dat is de
 * hele truc: het voelt als een formulier dat meedenkt, niet als een chatbot.
 */
export const advance = internalAction({
	args: { intakeId: v.id("intakes") },
	returns: v.null(),
	handler: async (ctx, args): Promise<null> => {
		const data = await ctx.runQuery(internal.intakes.getForAi, {
			intakeId: args.intakeId,
		});
		if (!data) return null;
		if (data.intake.status !== "vragen" && data.intake.status !== "contact") {
			return null;
		}

		await ctx.runMutation(internal.intakes.setStatus, {
			intakeId: args.intakeId,
			status: "denkt",
		});

		try {
			const rondes = data.answers.filter((a) => a.generated).length;
			// Kwam hij hier via het adresformulier, dan was doorvragen al klaar.
			const magNogVragen =
				data.intake.status === "vragen" &&
				rondes < MAX_VRAAGRONDES * MAX_VRAGEN_PER_RONDE;
			const gesprek = transcript(data.answers);

			if (magNogVragen) {
				const { text } = await callOpenRouter(
					MODEL_VRAGEN,
					[
						{
							role: "system",
							content: `Je helpt een digitaal bureau een klantvraag scherp krijgen.\n\n${HOUSE_STACK}\n\n${HOUSE_VOICE}\n\nJe krijgt een gesprek met een potentiële klant. Bepaal of je genoeg weet om een technisch voorstel te schrijven.\n\nOntbreekt er iets wezenlijks — schaal, koppelingen met bestaande systemen, wie het beheert, budget-orde, deadline — stel dan maximaal ${MAX_VRAGEN_PER_RONDE} vragen. Vraag alleen wat het voorstel echt verandert. Stel geen vraag waarvan het antwoord al in het gesprek staat.\n\nWeet je genoeg, geef dan een lege lijst.\n\nSchrijf de vragen zoals een mens ze stelt, in het Nederlands, zonder jargon.`,
						},
						{ role: "user", content: gesprek },
					],
					{
						type: "object",
						properties: {
							genoeg: { type: "boolean" },
							vragen: {
								type: "array",
								items: {
									type: "object",
									properties: {
										question: { type: "string" },
										detail: { type: "string" },
									},
									required: ["question", "detail"],
									additionalProperties: false,
								},
							},
						},
						required: ["genoeg", "vragen"],
						additionalProperties: false,
					},
				);

				const parsed: { genoeg: boolean; vragen: { question: string; detail: string }[] } =
					JSON.parse(text);

				if (!parsed.genoeg && parsed.vragen.length > 0) {
					await ctx.runMutation(internal.intakes.appendQuestions, {
						intakeId: args.intakeId,
						questions: parsed.vragen
							.slice(0, MAX_VRAGEN_PER_RONDE)
							.map((q) => ({ question: q.question, detail: q.detail })),
					});
					return null;
				}
			}

			// Genoeg gehoord — maar de brief is de duurste stap en heeft alleen zin
			// als we weten wie het was. Geen adres? Dan wachten we hier. De modal
			// vraagt er dan om en `setContact` zet ons opnieuw aan het werk.
			if (!data.intake.email) {
				await ctx.runMutation(internal.intakes.setStatus, {
					intakeId: args.intakeId,
					status: "contact",
				});
				return null;
			}

			// Twee stukken tekst uit één call: wat de klant terugkrijgt, en wat ik
			// erover moet weten.
			const { text, tokens } = await callOpenRouter(
				MODEL_BRIEF,
				[
					{
						role: "system",
						content: `Je bent de technisch partner van Brandocean en leest een intakegesprek met een potentiële klant.\n\n${HOUSE_STACK}\n\n${HOUSE_VOICE}\n\nLever drie dingen.\n\n"samenvatting" is voor de klant. Vier tot zes zinnen: wat hij wil, wat daarin het echte probleem is, en welke richting wij zien. Geen architectuur, geen productnamen, geen prijzen. Hij moet zich herkend voelen, niet overladen.\n\n"brief" is voor intern gebruik en mag wel technisch. Beschrijf de aanpak in onze stack, in welke fases je het zou bouwen, waar de risico's zitten, en wat er na dit gesprek nog onduidelijk is. Wees eerlijk over wat je niet weet. Als dit project niet bij ons past, schrijf dat op.\n\n"stackAdvies" is één regel: welke stack en waarom. Bijvoorbeeld "TanStack Start + Convex, want realtime samenwerking" of "Shopify, want commerce is het hart".`,
					},
					{ role: "user", content: gesprek },
				],
				{
					type: "object",
					properties: {
						samenvatting: { type: "string" },
						brief: { type: "string" },
						stackAdvies: { type: "string" },
					},
					required: ["samenvatting", "brief", "stackAdvies"],
					additionalProperties: false,
				},
			);

			const parsed: {
				samenvatting: string;
				brief: string;
				stackAdvies: string;
			} = JSON.parse(text);

			await ctx.runMutation(internal.intakes.finish, {
				intakeId: args.intakeId,
				summary: parsed.samenvatting,
				brief: parsed.brief,
				stackAdvies: parsed.stackAdvies,
				tokensUsed: tokens,
				modelUsed: MODEL_BRIEF,
			});
		} catch (error) {
			// Niet in "denkt" laten hangen: dan ziet de bezoeker een spinner die
			// nooit stopt. Terug naar waar hij vandaan kwam, dan kan hij het
			// opnieuw proberen.
			await ctx.runMutation(internal.intakes.setStatus, {
				intakeId: args.intakeId,
				status: data.intake.email ? "contact" : "vragen",
			});
			throw error;
		}
		return null;
	},
});
