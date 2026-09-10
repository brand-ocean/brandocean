import type { ClientPreview } from "../types";
import shots from "./goudse-poort.shots.json";

/**
 * Goudse Poort, bedrijventerrein Gouda. "Nu" is de gecrawlde site van
 * 9 september 2026 (sitemap_index.xml, 32 URL's, 15 pagina's zonder de
 * nieuwsberichten). "Straks" is het voorstel uit het meeting-plan, in drie
 * niveaus.
 */
export const goudsePoort: ClientPreview = {
	slug: "goudse-poort",
	client: "Goudse Poort",
	title: "goudsepoort.nl, nu en straks",
	date: "9 september 2026",
	site: "goudsepoort.nl",
	shots,
	intro:
		"De site van nu is een folder uit 2020: zeven menu-items, een logo-grid en nieuws dat stilstaat. Het terrein zelf verandert intussen in een gebied waar ook gewoond wordt. Hieronder de site zoals hij is, en zoals hij kan worden: eerst een site die het verhaal vertelt, daarna een werkplek voor de parkmanager, en daarna een platform voor het hele gebied.",
	levels: {
		1: "Nieuwe site",
		2: "Werkplek parkmanager",
		3: "Gebiedsplatform",
	},
	automations: {
		title: "Wat we automatiseren",
		intro:
			"Dit is waar wij het verschil maken. Geen losse website met een contactformulier, maar één systeem waarin meldingen, leden, diensten en cijfers vanzelf hun weg vinden. Elk blok hieronder is werk dat nu met de hand gaat, en straks niet meer.",
		footer:
			"Gebouwd op TanStack en Convex: één bron van waarheid, alles realtime, code en data van Goudse Poort. Wij bouwen, jullie beslissen.",
		items: [
			{
				name: "Meldpunt dat zichzelf doorzet",
				text: "Een ondernemer meldt met foto en plek. De melding gaat automatisch naar de juiste partij (gemeente, groen, beveiliging) en de melder krijgt de status terug. Niets meer overtypen of nabellen.",
				level: 2,
			},
			{
				name: "Werkplek van de parkmanager",
				text: "Eén overzicht: open meldingen, contracten die aflopen, leden die nog niet betaald hebben, taken. Elke ochtend een kort overzicht in de mail, zodat de dag begint met wat er speelt.",
				level: 2,
			},
			{
				name: "Bedrijvenregister dat bijblijft",
				text: "Koppeling met het Handelsregister: nieuwe vestigingen en vertrekkers worden gesignaleerd. Elk bedrijf houdt zijn eigen profiel bij. Geen logo-grid meer dat verouderd raakt.",
				level: 1,
			},
			{
				name: "Lid worden in één stap",
				text: "Aanmelden op de site is meteen lid: welkomstmail, toegang tot het portaal, op de nieuwsbrieflijst, in het register. Geen mailtjes heen en weer.",
				level: 2,
			},
			{
				name: "Contributie en facturen",
				text: "Jaarlijkse facturen en incasso gaan vanzelf, met herinneringen. De penningmeester ziet live wie betaald heeft, zonder Excel.",
				level: 2,
			},
			{
				name: "Diensten en contracten",
				text: "Surveillance, alarmopvolging, verzekering: online aanvragen, contract erbij, verlenging op tijd aangekondigd. Het bedrijf ziet zijn eigen diensten in het portaal.",
				level: 2,
			},
			{
				name: "KVO-rapportage uit het meldpunt",
				text: "Incidentcijfers per maand en per categorie komen rechtstreeks uit de meldingen. Het dossier voor de hercertificering bouwt zichzelf op.",
				level: 2,
			},
			{
				name: "Nieuws één keer schrijven",
				text: "Een bericht op de site gaat automatisch als nieuwsbrief en naar LinkedIn. Het archief staat op de site. Nooit meer een nieuwspagina die stilstaat.",
				level: 1,
			},
			{
				name: "Werkzaamheden en verkeer op de kaart",
				text: "Wegwerkzaamheden en afsluitingen komen op de kaart en gaan als bericht naar de bedrijven in die straat. Ondernemers weten het voordat ze in de file staan.",
				level: 3,
			},
			{
				name: "ALV zonder papier",
				text: "Agenda en stukken online, uitnodiging en herinnering vanzelf, stemmen op afstand met geteld quorum, notulen in het archief.",
				level: 2,
			},
			{
				name: "Vrije panden op de kaart",
				text: "Beschikbaar aanbod per pand komt automatisch binnen van makelaars en staat op de kaart. Vragen van geïnteresseerden landen bij de parkmanager.",
				level: 3,
			},
			{
				name: "Vragen beantwoord door AI",
				text: "Een assistent op de site beantwoordt vragen uit de eigen inhoud (parkeren, KVO, lid worden, wie doet wat) en zet de rest netjes door naar de parkmanager, met de vraag er al bij.",
				level: 3,
			},
			{
				name: "Jaarverslag met één druk op de knop",
				text: "Meldingen, leden, diensten en uitgaven worden het hele jaar bijgehouden. Het jaarverslag en de verantwoording aan de gemeente staan altijd klaar.",
				level: 3,
			},
		],
	},
	walkthrough: [
		{
			at: "intro",
			title: "Waarom we hier zitten",
			line: "goudsepoort.nl is uit 2020. Het terrein is sindsdien veranderd. Wij hebben de site doorgelicht en een voorstel gemaakt.",
		},
		{
			at: "nu-story",
			title: "De site van nu",
			line: "Wat er staat klopt. Maar je kunt er niets doen: ondernemers bellen of mailen.",
		},
		{
			at: "nu-tree",
			title: "Pagina voor pagina",
			line: "Elke pagina met een foto en wat ons opvalt. De roze stickies zijn de kansen.",
		},
		{
			at: "straks-story",
			title: "De site van straks",
			line: "Eén site, drie niveaus: het verhaal, de werkplek van de parkmanager, het gebiedsplatform.",
		},
		{
			at: "straks-tree",
			title: "Wat er slim kan",
			line: "Gele stickies zijn ideeën voor automatisering. N1, N2, N3 zeggen in welke fase.",
		},
		{
			at: "automations",
			title: "Wat er vanzelf kan",
			line: "Alles wat nu handwerk is, op een rij. Elk blok is een stuk werk dat na oplevering niemand meer hoeft te doen.",
		},
		{
			at: "straks-loose",
			title: "Zo werken wij",
			line: "Vast bedrag per maand, elke maand verder. Volgende stap: een uur meelopen op de Tielweg.",
		},
	],
	current: {
		label: "Nu",
		summary:
			"WordPress met een eigen theme uit mei 2020. Vijftien pagina's, waarvan vijf dienstpagina's die nergens in het menu staan. De KVO-link in het menu geeft een 404. Nieuws: vijf berichten sinds 2021, de laatste van mei 2025. De bedrijvenlijst is een grid van honderd logo's zonder zoeken, branche of contact.",
		story: [
			"De site vertelt wat Goudse Poort is: een bedrijventerrein aan de A12/A20 met parkmanagement en twee verenigingen. Dat klopt allemaal nog.",
			"Maar hij is gebouwd in 2020 als folder. Ondernemers kunnen er niets doen: geen melding maken, geen dienst aanvragen, geen buurman opzoeken, geen nieuwsbrief inschrijven. Alles loopt via mail en telefoon naar Ericis.",
			"Intussen verandert het terrein: flexwonen in het Goudse Poortgebouw vanaf 2026, padel, Engelvaart, verduurzaming. Dat verhaal staat nergens.",
		],
		callouts: [
			{
				kind: "mist",
				target: "/#Navbar",
				text: "KVO in het menu linkt naar /kvo en geeft een 404. De echte pagina staat op /keurmerk-veilig-ondernemen.",
			},
			{
				kind: "mist",
				target: "/#Nieuws & agenda",
				text: "Laatste bericht: mei 2025. Daarvoor drie jaar niets. Wie hier komt, denkt dat er niets gebeurt.",
			},
			{
				kind: "mist",
				target: "/#Intro en meldpunt",
				text: "Het meldpunt is een knop naar de gemeente. Niemand op het terrein ziet wat er gemeld is of wat ermee gebeurt.",
			},
			{
				kind: "mist",
				target: "/bedrijven#Logo-grid",
				text: "Honderd logo's, geen zoeken, geen branche, geen adres. Wie zoekt de loodgieter op het terrein? En wie houdt dit bij als er iemand verhuist?",
			},
			{
				kind: "mist",
				target: "/parkmanagement#Inkoop keuzepakket",
				text: "Zes diensten, aanvragen gaat per telefoon. Geen prijs, geen knop, geen bevestiging.",
			},
			{
				kind: "mist",
				target: "/parkmanagement",
				text: "Vijf dienstpagina's (bewegwijzering, camera's, gladheid, groen, verzekeringen) staan nergens in het menu. Alleen via Google te vinden.",
			},
			{
				kind: "mist",
				target: "/verenigingen#Bestuur EVGP",
				text: "Geen 'lid worden', geen ALV-datum, geen stukken. Voor een nieuwe ondernemer op het terrein is de vereniging onzichtbaar.",
			},
			{
				kind: "mist",
				target: "/nieuwsbrieven#Linklijst",
				text: "22 links naar Mailchimp. Inschrijven op de nieuwsbrief kan nergens op de site.",
			},
			{
				kind: "mist",
				target: "/ontwikkelstrategie#Intro",
				text: "De grootste verandering van het terrein (wonen, hotel, padel, Engelvaart) is één alinea en een PDF uit 2016.",
			},
			{
				kind: "cijfer",
				text: "Techniek: WordPress met een eigen theme van mei 2020, twee Google Analytics-tags tegelijk. De site laadt in 0,8 s. Niet traag, wel oud.",
			},
			{
				kind: "vraag",
				text: "Hoe komt een melding nu binnen, en waar wordt die bijgehouden? Hoe wordt de bedrijvenlijst bijgehouden? Welke tools gebruiken jullie: Mailchimp, Excel, Outlook?",
			},
		],
		root: {
			title: "Home",
			path: "/",
			sections: [
				{
					name: "Navbar",
					description:
						"Verenigingen, Parkmanagement, KVO, Bedrijven, Ontwikkelstrategie, Nieuws, Contact.",
				},
				{
					name: "Hero met luchtfoto",
					description:
						"Eén lange zin over ligging aan de A12/A20 en faciliteiten, over een luchtfoto van het terrein.",
				},
				{
					name: "Intro en meldpunt",
					description:
						"Drie regels over wie er gevestigd zijn, plus de knop 'Meldpunt openbaar gebied' die naar de gemeente linkt.",
				},
				{
					name: "Nieuws & agenda",
					description:
						"Twee meest recente berichten: nieuwsbrieven en de Coenecoopbrug, beide van mei 2025.",
				},
				{
					name: "Gevestigde bedrijven",
					description:
						"Vier logo's (VDS Kunststoffen, Blom DSW, Ericis, Kok Schoonmaak) met link naar de volledige lijst.",
				},
				{ name: "Footer" },
			],
			children: [
				{
					title: "Verenigingen",
					path: "/verenigingen",
					sections: [
						{ name: "Navbar" },
						{
							name: "BVGP",
							description:
								"Belangenvereniging voor vastgoedeigenaren, opgericht 2002. Doelen in drie regels.",
						},
						{
							name: "Bestuur BVGP",
							description: "Vier portretten met naam, functie en bedrijf.",
						},
						{
							name: "EVGP",
							description:
								"Exploitatievereniging voor ondernemers en eigenaren, opgericht 2009.",
						},
						{
							name: "Bestuur EVGP",
							description:
								"Vier portretten. Geen contributie, geen lidmaatschap, geen ALV-info.",
						},
						{ name: "Footer" },
					],
				},
				{
					title: "Parkmanagement",
					path: "/parkmanagement",
					sections: [
						{ name: "Navbar" },
						{
							name: "Wat parkmanagement doet",
							description:
								"Vijf bullets (kwaliteit, vastgoedwaarde, veiligheid, bereikbaarheid, inkoopvoordeel) en het telefoonnummer van Ericis.",
						},
						{
							name: "Inkoop basispakket",
							description:
								"Bewegwijzering, camerabewaking, gladheid, KVO, toezicht openbare ruimte. Alleen tekst.",
						},
						{
							name: "Inkoop keuzepakket",
							description:
								"Zes diensten van externe partijen (BBD, Pro-Rec, Interpolis, J. Bos, Stoelmassage) als losse links. Aanvragen gaat per telefoon.",
						},
						{ name: "Footer" },
					],
					children: [
						{
							title: "Bewegwijzering",
							path: "/bewegwijzering",
							note: "Niet in het menu",
							sections: [
								{
									name: "Tekst",
									description: "65 woorden en twee links.",
								},
							],
						},
						{
							title: "Camerabewaking",
							path: "/camerabewaking",
							note: "Niet in het menu",
							sections: [
								{
									name: "Tekst",
									description: "145 woorden over het collectieve systeem.",
								},
							],
						},
						{
							title: "Gladheidbestrijding",
							path: "/gladheidsbestrijding",
							note: "Niet in het menu",
							sections: [
								{
									name: "Tekst met tarieven",
									description:
										"Private kavel, 10% voordeel, strooizout, contact. 266 woorden.",
								},
							],
						},
						{
							title: "Groenvoorziening",
							path: "/groenvoorziening",
							note: "Niet in het menu",
							sections: [
								{
									name: "Tekst",
									description:
										"Verheij Integrale Groenzorg, offerte op maat, voordelen. 285 woorden.",
								},
							],
						},
						{
							title: "Verzekeringen",
							path: "/verzekeringen",
							note: "Niet in het menu",
							sections: [
								{
									name: "Tekst",
									description:
										"Korting op de Bedrijven Compact Polis van Interpolis. 226 woorden.",
								},
							],
						},
					],
				},
				{
					title: "KVO",
					path: "/keurmerk-veilig-ondernemen",
					note: "Menu linkt naar /kvo: 404",
					sections: [
						{ name: "Navbar" },
						{
							name: "Intro",
							description:
								"Wat het Keurmerk Veilig Ondernemen is; Goudse Poort heeft het sinds 2005.",
						},
						{
							name: "Partners",
							description:
								"Lijst van acht partijen: BBD, brandweer, BVGP/EVGP, gemeente, omgevingsdienst, politie, Pro-Rec, Rabobank.",
						},
						{
							name: "Meldkaart",
							description:
								"Contactgegevens van alle partijen als PDF-download.",
						},
						{
							name: "Verzekeringsvoordeel",
							description:
								"15% korting op de jaarpremie bij Interpolis, gratis inspectie.",
						},
						{ name: "Footer" },
					],
				},
				{
					title: "Bedrijven",
					path: "/bedrijven",
					sections: [
						{ name: "Navbar" },
						{
							name: "Logo-grid",
							description:
								"Circa honderd bedrijven op alfabet: logo, naam, 'Bezoek website'. Geen zoeken, geen branche, geen adres, geen kaart. Handmatig bijgehouden.",
						},
						{ name: "Footer" },
					],
				},
				{
					title: "Ontwikkelstrategie",
					path: "/ontwikkelstrategie",
					sections: [
						{ name: "Navbar" },
						{
							name: "Intro",
							description:
								"Eén alinea over de samenwerking met gemeente en provincie sinds 2016, plus een link naar de PDF.",
						},
						{ name: "Footer" },
					],
				},
				{
					title: "Nieuws",
					path: "/nieuws",
					sections: [
						{ name: "Navbar" },
						{
							name: "Berichtenlijst",
							description:
								"Vijf berichten: mei 2025 (2), februari 2022, januari 2022, oktober 2021. Zestien oudere berichten staan wel in de sitemap.",
						},
						{ name: "Footer" },
					],
					children: [
						{
							title: "Nieuwsbrieven",
							path: "/nieuwsbrieven",
							sections: [
								{
									name: "Linklijst",
									description:
										"22 links naar het Mailchimp-archief. Inschrijven kan hier niet.",
								},
							],
						},
					],
				},
				{
					title: "Contact",
					path: "/contact",
					sections: [
						{ name: "Navbar" },
						{
							name: "Contactgegevens",
							description:
								"Ericis Parkmanagement, Tielweg 10, postbus, telefoon, info@goudsepoort.nl.",
						},
						{
							name: "Formulier",
							description: "Naam, e-mailadres, vraag of bericht.",
						},
						{ name: "Footer" },
					],
					children: [
						{
							title: "Privacybeleid",
							path: "/privacybeleid",
							sections: [
								{
									name: "Standaardtekst",
									description:
										"De WordPress-voorbeeldtekst, 620 woorden, ongewijzigd.",
								},
							],
						},
					],
				},
			],
		},
	},
	proposed: {
		label: "Straks",
		summary:
			"Eén site met een ingang per doelgroep: ondernemer, vestigen, eigenaar, bezoeker. Niveau 1 is de nieuwe site. Niveau 2 maakt er de werkplek van de parkmanager van: meldingen, bedrijvenregister, ledenportaal, diensten. Niveau 3 is het gebiedsplatform voor de transformatie, met bewoners en een vestigingsloket.",
		story: [
			"Eén site met een ingang per doelgroep: ik onderneem hier, ik wil me vestigen, ik ben eigenaar, ik kom op bezoek. Het verhaal van het gebied staat voorop: werken, wonen, leisure aan de A12/A20.",
			"Daaronder wordt de site de werkplek van de parkmanager. Een melding gaat automatisch naar de juiste partij. Bedrijven houden hun eigen kaartje bij. Diensten worden online aangevraagd en gefactureerd. Leden loggen in voor contributie, stukken en stemmen.",
			"En als er straks gewoond wordt, groeit de site mee: zelfde meldpunt, zelfde nieuws, een ingang voor bewoners, een kaart met alle projecten. Geen nieuwe site over vier jaar, maar elke maand een stap verder.",
		],
		callouts: [
			{
				kind: "stap",
				text: "Zo werken wij: vast bedrag per maand, elke maand verder bouwen. Site live in maand 2 tot 3, daarna meldpunt, register, portaal, dashboard. Livegang is de start, niet het einde.",
			},
			{
				kind: "stap",
				text: "Jij aan de knop. Software en AI stellen voor, Anne Camile en het bestuur beslissen. Code en data zijn van Goudse Poort, geen black box.",
			},
			{
				kind: "stap",
				text: "Volgende stap: een uur meelopen op de Tielweg om te zien hoe meldingen, diensten en leden nu lopen. Binnen een week daarna staat het plan hier op dit bord: planning, eerste stappen en maandbedrag.",
			},
			{
				kind: "idee",
				target: "/ondernemen#Melding maken",
				text: "Foto + locatie op de kaart. Categorie bepaalt de ontvanger: gemeente, BBD of Ericis. Melder krijgt automatisch 'ontvangen', 'opgepakt', 'klaar'. Dit is meteen de KVO-incidentregistratie.",
			},
			{
				kind: "idee",
				target: "/ondernemen#Werkzaamheden en omleidingen",
				text: "Bericht alleen naar de bedrijven aan die straat. Mail, push of WhatsApp vanuit één knop. Omleidingskaart automatisch op de site.",
			},
			{
				kind: "idee",
				target: "/bedrijven/:bedrijf#Zelf beheren",
				text: "Elk bedrijf krijgt een link om zijn eigen kaartje bij te werken. Eén keer per jaar automatisch: 'klopt dit nog?'. KvK-koppeling signaleert verhuizing of nieuwe vestiging.",
			},
			{
				kind: "idee",
				target: "/bedrijven#Zoeken en filteren",
				text: "Zoek op 'loodgieter' of 'lunch' en vind je buurman. Branches uit KvK-codes, geen handwerk.",
			},
			{
				kind: "idee",
				target: "/leden#Contributie en facturen",
				text: "Contributie automatisch gefactureerd en geïncasseerd. De penningmeester ziet wie betaald heeft zonder Excel.",
			},
			{
				kind: "idee",
				target: "/leden#Mijn diensten",
				text: "Surveillance, alarmopvolging, verzekering: online aanvragen, contract erbij, jaarlijkse verlenging zonder telefoontje. Ericis en BBD krijgen de aanvraag direct.",
			},
			{
				kind: "idee",
				target: "/leden#Stemmen op afstand",
				text: "ALV-besluiten digitaal met quorumcheck. Stukken en notulen op één plek in plaats van bijlagen in de mail.",
			},
			{
				kind: "idee",
				target: "/beheer#AI-assistent",
				text: "Beantwoordt 'waar kan ik parkeren', 'wie is mijn buurman', 'hoe meld ik dumping'. Vat de meldingen van de maand samen en schrijft het concept van de nieuwsbrief. De parkmanager beslist.",
			},
			{
				kind: "idee",
				target: "/beheer#Bestuursrapportage",
				text: "Meldingen per maand, leden en contributie, KVO-cijfers, gebruik van diensten. De ALV-slide maakt zichzelf.",
			},
			{
				kind: "idee",
				target: "/actueel#Nieuwsbrief",
				text: "Schrijf één keer op de site, verstuur per mail. Archief staat op de site zelf. Inschrijven met één veld.",
			},
			{
				kind: "idee",
				target: "/veiligheid#Incidenten",
				text: "KVO-hercertificering: de incidentcijfers komen uit het meldpunt, geen aparte administratie meer.",
			},
			{
				kind: "idee",
				target: "/vestigen#Beschikbare kavels en panden",
				text: "Engelvaart (4 ha) en het aanbod van de makelaars uit het bestuur op één kaart. Een lead gaat automatisch naar de juiste makelaar én naar parkmanagement.",
			},
			{
				kind: "idee",
				target: "/gebied#Bewoners",
				text: "Vanaf 2027 wonen hier honderden mensen. Zelfde meldpunt, zelfde nieuws, eigen ingang. Gemeente en Breevast als partners.",
			},
			{
				kind: "idee",
				target: "/gebied#Duurzaamheid en subsidies",
				text: "Netcongestie was het thema van de kick-off in januari 2025. Energiedashboard per bedrijf, collectieve inkoop, subsidie-alerts.",
			},
			{
				kind: "idee",
				target: "/#Kaart van het terrein",
				text: "Eén kaart met lagen: bedrijven, bouwprojecten, werkzaamheden, camera's, laadpalen, parkeren. Ook bruikbaar voor de andere Ericis-terreinen.",
			},
			{
				kind: "vraag",
				target: "/beheer#Dashboard parkmanager",
				text: "Wat kost jullie nu de meeste tijd per week? Daar begint de automatisering.",
			},
		],
		root: {
			title: "Home",
			path: "/",
			sections: [
				{
					name: "Navbar",
					description:
						"Ondernemen hier, Bedrijven, Vestigen, Gebied, Veiligheid, Verenigingen, Actueel, Contact. Plus 'Melding maken' als knop.",
					tag: "verbeterd",
					level: 1,
				},
				{
					name: "Hero: het verhaal van het gebied",
					description:
						"Luchtfoto blijft. Kop over werken, wonen en leisure aan de A12/A20. Twee knoppen: Melding maken en Vestigen op Goudse Poort.",
					tag: "verbeterd",
					level: 1,
				},
				{
					name: "Ingangen per doelgroep",
					description:
						"Vier kaarten: ik onderneem hier, ik wil me vestigen, ik ben eigenaar, ik kom op bezoek.",
					tag: "nieuw",
					level: 1,
				},
				{
					name: "Actueel",
					description:
						"Nieuws, werkzaamheden en de laatste nieuwsbrief uit één bron. Werkzaamheden met omleidingskaart.",
					tag: "verbeterd",
					level: 1,
				},
				{
					name: "Kaart van het terrein",
					description:
						"Interactieve plattegrond met bedrijven, projecten, werkzaamheden en parkeren.",
					tag: "nieuw",
					level: 3,
				},
				{
					name: "Diensten uitgelicht",
					description: "Basispakket en keuzepakket, elk met een aanvraagknop.",
					tag: "nieuw",
					level: 1,
				},
				{
					name: "Cijfers",
					description:
						"62,5 hectare, circa 100 bedrijven, KVO sinds 2005, banen op het terrein.",
					tag: "nieuw",
					level: 1,
				},
				{
					name: "Bestuur en parkmanagement",
					description:
						"Wie er achter het terrein zitten, in twee regels, met link naar Verenigingen.",
					tag: "behouden",
					level: 1,
				},
				{
					name: "CTA",
					description: "Meld je bedrijf aan of word lid van de EVGP.",
					tag: "nieuw",
					level: 1,
				},
				{ name: "Footer", tag: "behouden", level: 1 },
			],
			children: [
				{
					title: "Ondernemen hier",
					path: "/ondernemen",
					sections: [
						{
							name: "Header",
							description: "Voor wie al op het terrein zit: alles op één plek.",
							tag: "nieuw",
							level: 1,
						},
						{
							name: "Melding maken",
							description:
								"Foto, locatie op de kaart, categorie. Gaat automatisch naar gemeente, BBD of Ericis. Melder krijgt statusupdates.",
							tag: "nieuw",
							level: 2,
						},
						{
							name: "Diensten",
							description:
								"Basispakket en keuzepakket met per dienst: wat, wie, prijs, aanvragen. Vervangt vijf losse tekstpagina's.",
							tag: "verbeterd",
							level: 1,
						},
						{
							name: "Werkzaamheden en omleidingen",
							description:
								"Actuele afsluitingen met kaart, per straat te volgen.",
							tag: "nieuw",
							level: 2,
						},
						{
							name: "Nieuwsbrief",
							description: "Inschrijven op de site zelf.",
							tag: "verbeterd",
							level: 1,
						},
					],
					children: [
						{
							title: "Mijn meldingen",
							path: "/ondernemen/meldingen",
							internal: true,
							sections: [
								{
									name: "Overzicht",
									description:
										"Status van eigen meldingen, reacties, afhandeling.",
									tag: "nieuw",
									level: 2,
								},
							],
						},
					],
				},
				{
					title: "Bedrijven",
					path: "/bedrijven",
					sections: [
						{
							name: "Zoeken en filteren",
							description: "Op naam, branche, straat. Direct resultaat.",
							tag: "nieuw",
							level: 1,
						},
						{
							name: "Kaart",
							description: "Elk bedrijf op zijn plek op het terrein.",
							tag: "nieuw",
							level: 1,
						},
						{
							name: "Bedrijvenlijst",
							description:
								"Logo, naam, branche, adres, telefoon, website. Ongeveer honderd bedrijven.",
							tag: "verbeterd",
							level: 1,
						},
					],
					children: [
						{
							title: "Bedrijfsprofiel",
							path: "/bedrijven/:bedrijf",
							sections: [
								{
									name: "Profiel",
									description:
										"Beschrijving, contact, openingstijden, vacatures.",
									tag: "nieuw",
									level: 1,
								},
								{
									name: "Zelf beheren",
									description:
										"Bedrijf houdt eigen gegevens bij. Jaarlijkse automatische 'klopt dit nog?'-mail. KvK-check op verhuizingen.",
									tag: "nieuw",
									level: 2,
								},
							],
						},
					],
				},
				{
					title: "Vestigen",
					path: "/vestigen",
					sections: [
						{
							name: "Waarom Goudse Poort",
							description:
								"Bereikbaarheid, cijfers, parkmanagement, KVO. Voor bedrijven die een plek zoeken.",
							tag: "nieuw",
							level: 1,
						},
						{
							name: "Beschikbare kavels en panden",
							description:
								"Engelvaartlocatie (4 ha) en aanbod van de makelaars uit het bestuur.",
							tag: "nieuw",
							level: 3,
						},
						{
							name: "Leadformulier",
							description:
								"Interesse achterlaten, automatisch opgevolgd door parkmanagement en makelaar.",
							tag: "nieuw",
							level: 3,
						},
					],
				},
				{
					title: "Gebied en ontwikkeling",
					path: "/gebied",
					sections: [
						{
							name: "Ontwikkelstrategie als tijdlijn",
							description:
								"Fasen sinds 2016 met gemeente en provincie, als webpagina in plaats van een PDF.",
							tag: "verbeterd",
							level: 1,
						},
						{
							name: "Projecten",
							description:
								"Goudse Poortgebouw (flexwonen 2026-2027, daarna wonen en hotel), padelbanen, Engelvaart.",
							tag: "nieuw",
							level: 1,
						},
						{
							name: "Duurzaamheid en subsidies",
							description:
								"Groene bedrijventerreinen, SDE++, netcongestie, collectieve energie.",
							tag: "nieuw",
							level: 3,
						},
						{
							name: "Bewoners",
							description:
								"Zodra er gewoond wordt: zelfde meldpunt, zelfde nieuws, eigen ingang.",
							tag: "nieuw",
							level: 3,
						},
					],
				},
				{
					title: "Veiligheid",
					path: "/veiligheid",
					sections: [
						{
							name: "KVO",
							description:
								"Wat het keurmerk is en wat het ondernemers oplevert. Werkende link deze keer.",
							tag: "verbeterd",
							level: 1,
						},
						{
							name: "Partners en meldkaart",
							description:
								"Acht partijen met contact, als webpagina en als download.",
							tag: "verbeterd",
							level: 1,
						},
						{
							name: "Verzekeringsvoordeel",
							description: "15% korting bij Interpolis, met aanvraagknop.",
							tag: "behouden",
							level: 1,
						},
						{
							name: "Incidenten",
							description:
								"Meldingen per maand en per categorie, uit het meldpunt. Basis voor de KVO-rapportage.",
							tag: "nieuw",
							level: 2,
						},
					],
				},
				{
					title: "Verenigingen",
					path: "/verenigingen",
					sections: [
						{
							name: "BVGP en EVGP",
							description:
								"Wie, waarvoor, sinds wanneer. Bestuur met portretten.",
							tag: "behouden",
							level: 1,
						},
						{
							name: "Lid worden",
							description: "Wat het kost, wat je krijgt, formulier.",
							tag: "nieuw",
							level: 1,
						},
						{
							name: "ALV en stukken",
							description: "Data, agenda's, notulen.",
							tag: "nieuw",
							level: 1,
						},
					],
					children: [
						{
							title: "Ledenportaal",
							path: "/leden",
							internal: true,
							sections: [
								{
									name: "Inloggen",
									description: "Per bedrijf, zonder wachtwoord (magic link).",
									tag: "nieuw",
									level: 2,
								},
								{
									name: "Contributie en facturen",
									description: "Inzien, betalen, downloaden.",
									tag: "nieuw",
									level: 2,
								},
								{
									name: "Stemmen op afstand",
									description: "ALV-besluiten digitaal, met quorum.",
									tag: "nieuw",
									level: 2,
								},
								{
									name: "Mijn diensten",
									description:
										"Afgenomen diensten, contracten, verlengingen. Automatische facturatie.",
									tag: "nieuw",
									level: 2,
								},
							],
						},
					],
				},
				{
					title: "Actueel",
					path: "/actueel",
					sections: [
						{
							name: "Nieuws",
							description: "Berichten met datum, categorie en foto.",
							tag: "verbeterd",
							level: 1,
						},
						{
							name: "Werkzaamheden",
							description: "Aparte stroom met begin- en einddatum en kaart.",
							tag: "nieuw",
							level: 1,
						},
						{
							name: "Nieuwsbrief",
							description:
								"Schrijf één keer, publiceer op site en per mail. Archief op de site zelf.",
							tag: "verbeterd",
							level: 2,
						},
					],
				},
				{
					title: "Contact",
					path: "/contact",
					sections: [
						{
							name: "Contactgegevens",
							description:
								"Ericis, adres, telefoon, mail, kaart, openingsdagen.",
							tag: "behouden",
							level: 1,
						},
						{
							name: "Formulier",
							description:
								"Met onderwerp, zodat de vraag bij de juiste persoon landt.",
							tag: "verbeterd",
							level: 1,
						},
						{
							name: "Melding maken",
							description:
								"Verwijzing naar het meldpunt in plaats van naar de gemeente.",
							tag: "verbeterd",
							level: 2,
						},
					],
				},
				{
					title: "Beheer",
					path: "/beheer",
					internal: true,
					sections: [
						{
							name: "Dashboard parkmanager",
							description:
								"Meldingen, leden, contributie, diensten, KVO-cijfers op één pagina.",
							tag: "nieuw",
							level: 2,
						},
						{
							name: "Bedrijvenregister",
							description:
								"Wijzigingen goedkeuren, KvK-signalen, verhuizingen.",
							tag: "nieuw",
							level: 2,
						},
						{
							name: "Communicatie",
							description:
								"Bericht naar alle bedrijven of alleen naar één straat. Mail, push, WhatsApp vanuit één plek.",
							tag: "nieuw",
							level: 2,
						},
						{
							name: "AI-assistent",
							description:
								"Beantwoordt veelgestelde vragen, vat meldingen samen, schrijft het concept van de nieuwsbrief. Parkmanager beslist.",
							tag: "nieuw",
							level: 2,
						},
						{
							name: "Bestuursrapportage",
							description: "De ALV-cijfers zonder PowerPoint.",
							tag: "nieuw",
							level: 2,
						},
					],
				},
			],
		},
	},
};
