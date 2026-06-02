// One-way NDA body templates, generated as TipTap JSONContent so the owner can
// freely edit them in the same editor used for offertes. These are sensible
// starting templates, not legal advice — the editor shows a note telling the
// owner to have them reviewed.

type Mark = { type: "bold" | "italic" };
type TextNode = { type: "text"; text: string; marks?: Mark[] };
type ParagraphNode = { type: "paragraph"; content?: TextNode[] };
type HeadingNode = {
	type: "heading";
	attrs: { level: number };
	content: TextNode[];
};
type ListItemNode = { type: "listItem"; content: ParagraphNode[] };
type BulletListNode = { type: "bulletList"; content: ListItemNode[] };
type ImageNode = { type: "image"; attrs: { src: string; alt: string } };
type BlockNode = ParagraphNode | HeadingNode | BulletListNode | ImageNode;
export type NdaDoc = { type: "doc"; content: BlockNode[] };

export type NdaLanguage = "nl" | "en";

export type NdaSignature = { dataUrl?: string; name: string };

export type NdaVars = {
	disclosingParty: string;
	disclosingAddress?: string;
	receivingParty: string;
	receivingCompany?: string;
	effectiveDate: string;
	termYears: number;
	governingCity: string;
};

const text = (s: string): TextNode => ({ type: "text", text: s });
const bold = (s: string): TextNode => ({
	type: "text",
	text: s,
	marks: [{ type: "bold" }],
});
const p = (...content: TextNode[]): ParagraphNode =>
	content.length ? { type: "paragraph", content } : { type: "paragraph" };
const h = (level: number, s: string): HeadingNode => ({
	type: "heading",
	attrs: { level },
	content: [text(s)],
});
const bullets = (...lines: string[]): BulletListNode => ({
	type: "bulletList",
	content: lines.map((line) => ({
		type: "listItem",
		content: [p(text(line))],
	})),
});

function partyLine(label: string, name: string, extra?: string): ParagraphNode {
	const suffix = extra ? `${name}, ${extra}` : name;
	return p(bold(`${label} `), text(suffix));
}

// Signature block for the party that signs (the Receiving Party). Appended when
// an NDA is signed by the owner at creation.
function signatureBlock(
	language: NdaLanguage,
	signature: NdaSignature,
	dateStr: string,
): BlockNode[] {
	const onBehalf =
		language === "nl"
			? "Namens de ontvangende partij:"
			: "On behalf of the Receiving Party:";
	const dateLabel = language === "nl" ? "Datum:" : "Date:";
	const blocks: BlockNode[] = [p(bold(onBehalf))];
	if (signature.dataUrl) {
		blocks.push({
			type: "image",
			attrs: { src: signature.dataUrl, alt: "Handtekening" },
		});
	}
	blocks.push(p(bold(signature.name)));
	blocks.push(p(text(`${dateLabel} ${dateStr}`)));
	return blocks;
}

function buildEnglish(v: NdaVars): NdaDoc {
	const receiving = v.receivingCompany
		? `${v.receivingParty} (${v.receivingCompany})`
		: v.receivingParty;
	return {
		type: "doc",
		content: [
			h(1, "Non-Disclosure Agreement"),
			p(
				text(
					`This Non-Disclosure Agreement (the “Agreement”) is entered into on ${v.effectiveDate} between:`,
				),
			),
			partyLine("Disclosing Party:", v.disclosingParty, v.disclosingAddress),
			partyLine("Receiving Party:", receiving),
			p(
				text(
					"The Disclosing Party intends to disclose certain confidential information to the Receiving Party for the purpose of evaluating or carrying out a potential or existing business relationship (the “Purpose”). In consideration of that disclosure, the parties agree as follows:",
				),
			),

			h(2, "1. Confidential Information"),
			p(
				text(
					"“Confidential Information” means all non-public information disclosed by the Disclosing Party to the Receiving Party, whether orally, in writing, or in any other form, including but not limited to business plans, strategies, designs, concepts, pricing, client lists, financial data, source files, and any other information that a reasonable person would understand to be confidential given its nature or the circumstances of disclosure.",
				),
			),

			h(2, "2. Obligations of the Receiving Party"),
			p(text("The Receiving Party agrees to:")),
			bullets(
				"keep all Confidential Information strictly confidential;",
				"use the Confidential Information solely for the Purpose;",
				"not disclose the Confidential Information to any third party without the prior written consent of the Disclosing Party;",
				"protect the Confidential Information using at least the same degree of care it uses for its own confidential information, and in any event no less than a reasonable degree of care.",
			),

			h(2, "3. Exclusions"),
			p(
				text(
					"These obligations do not apply to information that: (a) is or becomes publicly available through no fault of the Receiving Party; (b) was lawfully known to the Receiving Party before disclosure; (c) is lawfully received from a third party without a duty of confidentiality; or (d) is required to be disclosed by law or court order, provided the Receiving Party gives prompt notice where legally permitted.",
				),
			),

			h(2, "4. Term"),
			p(
				text(
					`This Agreement takes effect on the date stated above. The Receiving Party's obligations of confidentiality survive for a period of ${v.termYears} years following the date of disclosure of the relevant Confidential Information.`,
				),
			),

			h(2, "5. Return or Destruction of Materials"),
			p(
				text(
					"Upon the Disclosing Party's written request, the Receiving Party shall promptly return or destroy all materials containing Confidential Information, together with any copies, and confirm such destruction in writing if requested.",
				),
			),

			h(2, "6. No Licence or Warranty"),
			p(
				text(
					"No licence or other right to the Confidential Information is granted under this Agreement, whether by implication or otherwise. The Confidential Information is provided “as is”, without any warranty as to its accuracy or completeness.",
				),
			),

			h(2, "7. Governing Law and Jurisdiction"),
			p(
				text(
					`This Agreement is governed by the laws of the Netherlands. Any dispute arising out of or in connection with this Agreement shall be submitted to the exclusive jurisdiction of the competent court in ${v.governingCity}.`,
				),
			),

			h(2, "8. Signature"),
			p(
				text(
					"By signing below, the Receiving Party confirms that it has read, understood, and agrees to be bound by the terms of this Agreement.",
				),
			),
		],
	};
}

function buildDutch(v: NdaVars): NdaDoc {
	const receiving = v.receivingCompany
		? `${v.receivingParty} (${v.receivingCompany})`
		: v.receivingParty;
	return {
		type: "doc",
		content: [
			h(1, "Geheimhoudingsovereenkomst"),
			p(
				text(
					`Deze geheimhoudingsovereenkomst (de “Overeenkomst”) wordt aangegaan op ${v.effectiveDate} tussen:`,
				),
			),
			partyLine("Verstrekkende partij:", v.disclosingParty, v.disclosingAddress),
			partyLine("Ontvangende partij:", receiving),
			p(
				text(
					"De verstrekkende partij is voornemens bepaalde vertrouwelijke informatie te delen met de ontvangende partij ten behoeve van het beoordelen of uitvoeren van een mogelijke of bestaande samenwerking (het “Doel”). Met inachtneming daarvan komen partijen het volgende overeen:",
				),
			),

			h(2, "1. Vertrouwelijke informatie"),
			p(
				text(
					"Onder “Vertrouwelijke informatie” wordt verstaan alle niet-openbare informatie die de verstrekkende partij aan de ontvangende partij verstrekt, mondeling, schriftelijk of in enige andere vorm, waaronder begrepen maar niet beperkt tot bedrijfsplannen, strategieën, ontwerpen, concepten, prijzen, klantenlijsten, financiële gegevens, bronbestanden en alle overige informatie waarvan een redelijk handelend persoon, gelet op de aard of de omstandigheden van de verstrekking, kan begrijpen dat deze vertrouwelijk is.",
				),
			),

			h(2, "2. Verplichtingen van de ontvangende partij"),
			p(text("De ontvangende partij verbindt zich ertoe om:")),
			bullets(
				"de Vertrouwelijke informatie strikt vertrouwelijk te houden;",
				"de Vertrouwelijke informatie uitsluitend te gebruiken voor het Doel;",
				"de Vertrouwelijke informatie niet zonder voorafgaande schriftelijke toestemming van de verstrekkende partij aan derden bekend te maken;",
				"de Vertrouwelijke informatie te beschermen met ten minste dezelfde zorg als zij voor haar eigen vertrouwelijke informatie hanteert, en in elk geval met een redelijke mate van zorg.",
			),

			h(2, "3. Uitzonderingen"),
			p(
				text(
					"Deze verplichtingen gelden niet voor informatie die: (a) openbaar is of wordt zonder toedoen van de ontvangende partij; (b) bij de ontvangende partij rechtmatig bekend was vóór de verstrekking; (c) rechtmatig van een derde is verkregen zonder geheimhoudingsplicht; of (d) op grond van wet- of regelgeving of een rechterlijke uitspraak openbaar gemaakt moet worden, mits de ontvangende partij hiervan, voor zover wettelijk toegestaan, tijdig melding maakt.",
				),
			),

			h(2, "4. Duur"),
			p(
				text(
					`Deze Overeenkomst treedt in werking op de hierboven genoemde datum. De geheimhoudingsverplichtingen van de ontvangende partij blijven van kracht gedurende een periode van ${v.termYears} jaar na de datum waarop de betreffende Vertrouwelijke informatie is verstrekt.`,
				),
			),

			h(2, "5. Teruggave of vernietiging"),
			p(
				text(
					"Op eerste schriftelijk verzoek van de verstrekkende partij retourneert of vernietigt de ontvangende partij onverwijld alle materialen die Vertrouwelijke informatie bevatten, met inbegrip van kopieën, en bevestigt zij die vernietiging desgevraagd schriftelijk.",
				),
			),

			h(2, "6. Geen licentie of garantie"),
			p(
				text(
					"Met deze Overeenkomst wordt geen licentie of ander recht op de Vertrouwelijke informatie verleend, noch impliciet noch anderszins. De Vertrouwelijke informatie wordt verstrekt “as is”, zonder enige garantie ten aanzien van juistheid of volledigheid.",
				),
			),

			h(2, "7. Toepasselijk recht en bevoegde rechter"),
			p(
				text(
					`Op deze Overeenkomst is Nederlands recht van toepassing. Geschillen die voortvloeien uit of verband houden met deze Overeenkomst worden uitsluitend voorgelegd aan de bevoegde rechter te ${v.governingCity}.`,
				),
			),

			h(2, "8. Ondertekening"),
			p(
				text(
					"Door hieronder te ondertekenen verklaart de ontvangende partij deze Overeenkomst te hebben gelezen en begrepen en zich gebonden te achten aan de bepalingen ervan.",
				),
			),
		],
	};
}

export type NdaDirection = "owner_signs" | "client_signs";

const DISCLOSING_LABELS = new Set([
	"Disclosing Party:",
	"Verstrekkende partij:",
]);
const RECEIVING_LABELS = new Set(["Receiving Party:", "Ontvangende partij:"]);

// Rebuild the two named-party paragraphs in an existing NDA body from the
// current client + business, leaving all other clauses (and any edits) intact.
// Used when a client is assigned/changed after the NDA was created.
export function withUpdatedParties(
	doc: NdaDoc,
	language: NdaLanguage,
	direction: NdaDirection,
	parties: {
		businessName: string;
		businessAddress?: string;
		clientName: string;
		clientCompany?: string;
	},
): NdaDoc {
	const clientStr = parties.clientCompany
		? `${parties.clientName}, ${parties.clientCompany}`
		: parties.clientName;
	const businessStr = parties.businessAddress
		? `${parties.businessName}, ${parties.businessAddress}`
		: parties.businessName;
	// owner_signs: client discloses, owner receives. client_signs: the reverse.
	const disclosingValue = direction === "owner_signs" ? clientStr : businessStr;
	const receivingValue = direction === "owner_signs" ? businessStr : clientStr;
	const disclosingLabel =
		language === "nl" ? "Verstrekkende partij:" : "Disclosing Party:";
	const receivingLabel =
		language === "nl" ? "Ontvangende partij:" : "Receiving Party:";

	const content = doc.content.map((node) => {
		if (node.type !== "paragraph" || !node.content || node.content.length === 0)
			return node;
		const first = node.content[0];
		if (first.type !== "text" || !first.marks?.some((m) => m.type === "bold"))
			return node;
		const label = first.text.trim();
		if (DISCLOSING_LABELS.has(label))
			return partyLine(disclosingLabel, disclosingValue);
		if (RECEIVING_LABELS.has(label))
			return partyLine(receivingLabel, receivingValue);
		return node;
	});
	return { type: "doc", content };
}

export function buildOneWayNda(
	language: NdaLanguage,
	v: NdaVars,
	signature?: NdaSignature,
): NdaDoc {
	const doc = language === "nl" ? buildDutch(v) : buildEnglish(v);
	// The clauses are identical in both directions — only the named parties
	// differ (set by the caller) and, when the owner signs, their signature is
	// appended beneath the signature clause.
	if (signature) {
		doc.content.push(
			...signatureBlock(language, signature, v.effectiveDate),
		);
	}
	return doc;
}

const MONTHS_EN = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];
const MONTHS_NL = [
	"januari",
	"februari",
	"maart",
	"april",
	"mei",
	"juni",
	"juli",
	"augustus",
	"september",
	"oktober",
	"november",
	"december",
];

// Format a timestamp without relying on Intl locale data in the Convex runtime.
export function formatNdaDate(ts: number, language: NdaLanguage): string {
	const d = new Date(ts);
	const day = d.getUTCDate();
	const month = (language === "nl" ? MONTHS_NL : MONTHS_EN)[d.getUTCMonth()];
	const year = d.getUTCFullYear();
	return `${day} ${month} ${year}`;
}
