import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Eenmalige vulling van de FORZ-vragenlijst over placements. Internal, dus
// alleen aan te roepen via de CLI of het dashboard. Draait idempotent: bestaat
// de lijst al, dan doet hij niets. Weg te gooien zodra hij gedraaid heeft.

type Seed = {
	question: string;
	detail?: string;
	fallback?: string;
	blocking: boolean;
};

const QUESTIONS: Seed[] = [
	{
		blocking: true,
		question: "Wat is de commissieregel bij Werving en Selectie?",
		detail:
			"Welk percentage over de fee, en hoe verdeeld tussen consultant en resourcer? Bij contractdeals is het tien procent over een basis maal een factor. Perm heeft vast een eigen tarief.",
	},
	{
		blocking: true,
		question:
			"Wat gebeurt er als de kandidaat binnen de garantieperiode vertrekt?",
		detail:
			"Creditnota, pro rata terug, of vervanging zonder nieuwe fee? En wordt de al uitbetaalde commissie teruggeboekt?",
	},
	{
		blocking: true,
		question: "Speciale kosten: bedrag per maand of per uur?",
		detail:
			"Commissie loopt per uur over de marge per uur. Reken ik een maandbedrag om met de contractuele uren, of met de werkelijk gewerkte uren? Dat scheelt echt geld in een vakantiemaand.",
	},
	{
		blocking: true,
		question:
			"Speciale kosten: wat betekent zichtbaar voor de klant bij een urenfactuur?",
		detail:
			"Bij margin only is de factuur de marge, dus aftrekken is helder. Bij uren maal tarief niet. Wordt het een aparte regel op de factuur, een hoger tarief, of gebruik je deze optie alleen bij margin only?",
	},
	{
		blocking: true,
		question: "Wanneer worden de velden verplicht?",
		detail:
			"KvK en BTW van de kandidaat weten we bij het aanmaken nog niet, die komen uit de onboarding. Mijn voorstel: aanmaken blijft licht, verplicht pas bij het versturen van de inzetbevestiging of het contract. Zeg je ja, dan blokkeert dit niet meer.",
	},
	{
		blocking: false,
		question: "Startdatum verschuift na goedkeuring",
		fallback:
			"Wijzigingsverzoek dat de factuurdatum en de commissiemaand automatisch meeschuift.",
	},
	{
		blocking: false,
		question: "Bericht aan de kandidaat bij Werving en Selectie",
		fallback: "Niets automatisch. Alleen het klantspoor loopt.",
	},
	{
		blocking: false,
		question: "Wanneer is een permdeal afgerond",
		fallback:
			"Automatisch afgerond zodra de factuur betaald is, met een handmatige afsluitknop.",
	},
	{
		blocking: false,
		question: "Permdeals in het leaderboard",
		fallback: "Ja, met de fee als waarde, naast de contractdeals.",
	},
	{
		blocking: false,
		question: "Facturatie in drie termijnen",
		fallback:
			"Finance zet per termijn zelf percentage en datum, verdeling vrij. Commissie volledig na de eerste factuur.",
	},
	{
		blocking: false,
		question: "BTW op de fee",
		fallback:
			"Eenentwintig procent, via hetzelfde WeFact-product als de interimfacturen.",
	},
	{
		blocking: false,
		question: "Looptijd van speciale kosten",
		fallback:
			"Per kostenpost een omschrijving, bedrag, begin- en einddatum. Meerdere naast elkaar mogelijk.",
	},
	{
		blocking: false,
		question: "Speciale kosten wijzigen na goedkeuring",
		fallback:
			"Alleen via een wijzigingsverzoek, want het raakt de commissie van een collega.",
	},
	{
		blocking: false,
		question: "Kosten stoppen halverwege",
		fallback:
			"Afgesloten commissiemaanden blijven staan. Alleen de maanden erna rekenen opnieuw.",
	},
	{
		blocking: false,
		question: "Geupload klantcontract",
		fallback:
			"De upload zet de klantzijde op getekend, met datum en wie het uploadde.",
	},
	{
		blocking: false,
		question: "Taal bij gedeelde berichten",
		fallback:
			"Klanttaal richting klant, kandidaattaal richting kandidaat, Nederlands intern. Gedeelde mails splits ik.",
	},
	{
		blocking: false,
		question: "Ondertekenaar bij een extern bedrijf",
		fallback:
			"Bij freelancer de kandidaat zelf. Bij extern bedrijf vraagt de onboarding om de tekenbevoegde.",
	},
	{
		blocking: false,
		question: "Debiteuren in WeFact",
		fallback:
			"WeFact blijft leidend. De OS maakt niets aan, maar meldt het als de gegevens afwijken.",
	},
	{
		blocking: false,
		question: "Vierwekelijks factureren",
		fallback:
			"Vaste blokken van vier weken vanaf het jaarbegin, zodat alle klanten in hetzelfde ritme lopen.",
	},
	{
		blocking: false,
		question: "Betaaltermijn van de kandidaat",
		fallback:
			"Bepaalt de betaaldatum op de self-bill en komt in het kandidaatcontract.",
	},
	{
		blocking: false,
		question: "Northern Partners en het documentarchief",
		fallback:
			"Northern Partners blijft bestaan maar niet meer kiesbaar. Het archief blijft, alleen zonder eigen menu-item.",
	},
];

export const seedForzPlacements = internalMutation({
	args: { ownerId: v.id("users"), clientId: v.optional(v.id("clients")) },
	handler: async (ctx, args): Promise<{ specId: Id<"specs">; slug: string }> => {
		const slug = "forz-placements";
		const existing = await ctx.db
			.query("specs")
			.withIndex("by_slug", (q) => q.eq("slug", slug))
			.unique();
		if (existing) return { specId: existing._id, slug };

		const now = Date.now();
		const specId = await ctx.db.insert("specs", {
			ownerId: args.ownerId,
			clientId: args.clientId,
			title: "Placements",
			intro:
				"Bij elke vraag staat wat ik doe als ik niets hoor. Reageer dus alleen op de punten waar je het niet mee eens bent. De eerste vijf kan ik niet zelf invullen.",
			slug,
			shareToken: "forzplacements2026aug05x",
			published: true,
			createdAt: now,
			updatedAt: now,
		});

		for (const [index, seed] of QUESTIONS.entries()) {
			await ctx.db.insert("specQuestions", {
				specId,
				order: index + 1,
				question: seed.question,
				detail: seed.detail,
				fallback: seed.fallback,
				blocking: seed.blocking,
				resolved: false,
			});
		}
		return { specId, slug };
	},
});
