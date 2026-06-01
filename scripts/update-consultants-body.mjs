// One-off: build the args JSON for admin:setOfferteBody to rewrite the
// "Consultants" offerte body in a human voice. Run:
//   bun scripts/update-consultants-body.mjs
//   bunx convex run admin:setOfferteBody "$(cat scripts/consultants-args.json)" --prod
import { writeFileSync } from "node:fs";

const OFFERTE_ID = "k573awrs4vgsxt2b5v4bsg61td87mm7s";
const p = (text) => ({ type: "paragraph", content: [{ type: "text", text }] });

const body = {
	type: "doc",
	content: [
		p("Even kort over wie er voor je gaat bouwen."),
		p(
			"Twintig jaar ervaring als developer en full-stack generalist: front-end, back-end, branding, design, marketing, CRO, UI/UX, data en automatisering. Eén aanspreekpunt in plaats van een bureau plus drie freelancers. Wat normaal verdeeld wordt over een developer, designer, marketeer, CRO-specialist en data-analist, pak ik in één hand op, met de onderlinge samenhang die je anders kwijt bent.",
		),
		p(
			"Concreet voor jullie: ik bouw een app die al jullie mail uitleest, of dat nu Office 365 of Google Workspace is, en daar bruikbare data van maakt. Geen handmatig invoeren meer. Alle contacten en bedrijven uit jullie mailboxen worden automatisch herkend, ontdubbeld en verrijkt. De AI haalt eruit wat normaal verborgen blijft in mailtjes en handtekeningen: naam, rol, bedrijf, telefoon, social media en wat er verder relevant is, met een inschatting van hoe betrouwbaar dat is.",
		),
		p(
			"Zodra die verrijking draait wordt jullie eigen data ineens bruikbaar. Alles komt samen in één overzicht dat je snel kunt doorzoeken en filteren op wat je maar wilt, of dat nu bedrijf, categorie, land of het laatste contactmoment is. Per contact zie je de hele geschiedenis terug: welke mails er waren, waarover, en wie er binnen jullie netwerk bij betrokken is. Zo zie je in één oogopslag wie je kent en hoe jullie met elkaar verbonden zijn, in plaats van dat het verspreid zit over losse inboxen.",
		),
		p(
			"En daarnaast kan er nog veel meer, bovenop dat inzicht. Denk aan dashboards die laten zien wie er het meest contact zoekt, welke vragen er binnenkomen, hoe dat door de tijd loopt en waar je relaties zitten. Denk aan AI die elke dag kort samenvat wat er speelt, of die nieuwe contacten meteen op de juiste plek zet. En denk aan automatiseringen die werk uit handen nemen: contacten en segmenten automatisch doorzetten naar de tools die jullie al gebruiken, bijvoorbeeld voor de nieuwsbrief, en alles op de achtergrond actueel houden zonder dat iemand er naar om hoeft te kijken.",
		),
		p(
			"De richting ligt open. Of het nu meer AI wordt, koppelingen met jullie andere tools, of een eigen pijplijn om alles netjes op te volgen, vrijwel alles is mogelijk. Ik bouw, ontwerp en beheer het in één hand, dus we kunnen klein beginnen en het laten meegroeien met wat jullie nodig hebben.",
		),
		p(
			"De precieze invulling bepalen we samen. Ik heb nog niet alle details, maar het idee is helder: jullie eigen data inzichtelijk en bruikbaar maken in plaats van verstopt in de mail.",
		),
		p(
			"Richtprijs voor het inzichtelijk maken van jullie data: 4.000 excl. btw. Dat is de basis: alle mail uitlezen, verrijken en doorzoekbaar maken in één overzicht. De extra's die ik hierboven noem komen daar bovenop; wat dat precies wordt en kost bepalen we samen zodra duidelijk is welke kant jullie op willen.",
		),
	],
};

writeFileSync(
	new URL("./consultants-args.json", import.meta.url),
	JSON.stringify({ id: OFFERTE_ID, body }),
);
console.log("Wrote scripts/consultants-args.json");
