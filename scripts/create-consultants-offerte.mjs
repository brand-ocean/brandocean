// One-off: generate a JSONL document to append to the PROD `offertes` table.
// Run:  bun scripts/create-consultants-offerte.mjs
// Then: bunx convex import --table offertes --append --prod -y scripts/consultants-offerte.jsonl
import { writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";

const OWNER_ID = "kd717f40pzfmwd58dk6f0gw80x85h6k1"; // info@brandocean.nl (owner of prod data)
const slugAlphabet =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const token = (n) =>
	Array.from({ length: n }, () => slugAlphabet[randomInt(slugAlphabet.length)]).join("");

// TipTap (ProseMirror) JSON helpers — matches OfferteEditor's StarterKit schema.
const h = (level, text) => ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const p = (text) => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] });
const li = (text) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const ul = (items) => ({ type: "bulletList", content: items.map(li) });

const body = {
	type: "doc",
	content: [
		h(2, "Even kort over wie er voor je gaat bouwen"),
		p(
			"Twintig jaar ervaring als developer en full-stack generalist: front-end, back-end, branding, design, marketing, CRO, UI/UX, data en automatisering. Eén aanspreekpunt in plaats van een bureau plus drie freelancers. Wat normaal verdeeld wordt over een developer, designer, marketeer, CRO-specialist en data-analist, pak ik in één hand op — met de onderlinge samenhang die je anders kwijt bent.",
		),
		h(2, "Wat ik voor jullie ga bouwen"),
		p(
			"Jullie hebben enorm veel waardevolle kennis in de mailbox zitten — contacten, gesprekken, relaties — maar die data is nu versnipperd en nauwelijks te doorzoeken. Ik bouw één applicatie die daar grip op geeft: alle e-mail wordt uitgelezen, omgezet in verrijkte contactdata en toegankelijk gemaakt in een omgeving die snel en prettig doorzoekbaar is.",
		),
		ul([
			"Koppeling met Microsoft 365 of Google Workspace — alle e-mail wordt veilig uitgelezen.",
			"Contacten en bedrijven worden automatisch herkend, ontdubbeld en verrijkt (enrichment).",
			"Eén overzichtelijke, doorzoekbare omgeving: in één oogopslag zien wie je kent, wanneer en waarover er contact was.",
			"Automatiseringen: contacten en segmenten automatisch koppelen en pushen naar de gewenste tool, bijvoorbeeld voor nieuwsbrieven.",
		]),
		h(2, "Aanpak"),
		p(
			"De details staan nog open, dus we beginnen klein en concreet. Eerst een korte ontdekkingsfase om de scope en koppelingen scherp te krijgen, daarna een werkende eerste versie die we samen aanscherpen.",
		),
		ul([
			"Discovery — doelen, databronnen en gewenste koppelingen vastleggen.",
			"MVP — mailkoppeling, contactverrijking en de doorzoekbare omgeving.",
			"Uitbreiding — automatiseringen en koppelingen naar externe tools, zoals nieuwsbrieven.",
		]),
		h(2, "Investering"),
		p(
			"Richtprijs: vanaf € 4.000 excl. btw. De definitieve prijs bepalen we zodra de scope na de ontdekkingsfase vaststaat.",
		),
		p("Klinkt dit goed? Dan plannen we een kort gesprek om de details door te nemen."),
	],
};

const now = Date.now();
const doc = {
	ownerId: OWNER_ID,
	title: "Consultants",
	slug: "consultants",
	shareToken: token(24),
	published: false,
	publicReadable: false,
	schemaVersion: 1,
	createdAt: now,
	updatedAt: now,
	body,
};

writeFileSync(
	new URL("./consultants-offerte.jsonl", import.meta.url),
	`${JSON.stringify(doc)}\n`,
);
console.log("Wrote scripts/consultants-offerte.jsonl");
console.log("shareToken:", doc.shareToken, "| slug:", doc.slug);
