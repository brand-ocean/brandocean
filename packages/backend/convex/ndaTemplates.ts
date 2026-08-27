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
	return {
		type: "doc",
		content: [
			h(1, "Non-Disclosure Agreement"),
			p(
				text(
					`This Non-Disclosure Agreement (“Agreement”) is entered into on ${v.effectiveDate} between:`,
				),
			),
			partyLine("Disclosing Party:", v.disclosingParty, v.disclosingAddress),
			partyLine("Receiving Party:", v.receivingParty, v.receivingCompany),
			p(
				text(
					"The Disclosing Party shares confidential information with the Receiving Party in connection with a (potential) collaboration. The parties agree as follows:",
				),
			),

			h(2, "1. Confidential Information"),
			p(
				text(
					"Confidential Information means all non-public information that the Disclosing Party shares with the Receiving Party in any form, and any information that the Receiving Party should reasonably understand to be confidential.",
				),
			),

			h(2, "2. Confidentiality"),
			p(text("The Receiving Party:")),
			bullets(
				"keeps the Confidential Information secret and uses it solely for the purpose for which it was provided, never for its own benefit;",
				"does not disclose it to third parties without the Disclosing Party's prior written consent, and binds any employees or engaged third parties to the same confidentiality;",
				"handles it with due care and notifies the Disclosing Party without undue delay of any actual or suspected breach.",
			),

			h(2, "3. Exclusions"),
			p(
				text(
					"The confidentiality obligation does not apply to information that: (a) is or becomes publicly known through no fault of the Receiving Party; (b) was already lawfully known to the Receiving Party; (c) is lawfully obtained from a third party without a duty of confidentiality; or (d) must be disclosed under the law or a court order, in which case the Receiving Party informs the Disclosing Party in advance where permitted.",
				),
			),

			h(2, "4. Term"),
			p(
				text(
					"The confidentiality obligation applies indefinitely, for as long as the information remains confidential in nature.",
				),
			),

			h(2, "5. Return and final provisions"),
			p(
				text(
					`On first request, the Receiving Party returns or destroys the Confidential Information, including any copies. This Agreement is governed by the laws of the Netherlands; any dispute will be submitted to the competent court in ${v.governingCity}.`,
				),
			),

			h(2, "6. Signature"),
			p(
				text(
					"The Receiving Party confirms that it has read, understood, and will comply with this Agreement.",
				),
			),
		],
	};
}

function buildDutch(v: NdaVars): NdaDoc {
	return {
		type: "doc",
		content: [
			h(1, "Geheimhoudingsovereenkomst"),
			p(
				text(
					`Deze geheimhoudingsovereenkomst (“Overeenkomst”) wordt op ${v.effectiveDate} gesloten tussen:`,
				),
			),
			partyLine("Verstrekkende partij:", v.disclosingParty, v.disclosingAddress),
			partyLine("Ontvangende partij:", v.receivingParty, v.receivingCompany),
			p(
				text(
					"De verstrekkende partij verstrekt in het kader van een (mogelijke) samenwerking vertrouwelijke informatie aan de ontvangende partij. Partijen komen hierover het volgende overeen:",
				),
			),

			h(2, "1. Vertrouwelijke informatie"),
			p(
				text(
					"Onder vertrouwelijke informatie wordt verstaan alle niet-openbare informatie die de verstrekkende partij in welke vorm dan ook aan de ontvangende partij verstrekt, en alle informatie waarvan de ontvangende partij redelijkerwijs moet begrijpen dat deze vertrouwelijk is.",
				),
			),

			h(2, "2. Geheimhouding"),
			p(text("De ontvangende partij:")),
			bullets(
				"houdt de vertrouwelijke informatie geheim en gebruikt deze uitsluitend voor het doel waarvoor zij is verstrekt, nooit voor eigen voordeel;",
				"verstrekt de informatie niet aan derden zonder voorafgaande schriftelijke toestemming, en legt medewerkers of ingeschakelde derden dezelfde geheimhouding op;",
				"behandelt de informatie zorgvuldig en meldt een (vermoedelijk) lek zonder onnodige vertraging aan de verstrekkende partij.",
			),

			h(2, "3. Uitzonderingen"),
			p(
				text(
					"De geheimhoudingsplicht geldt niet voor informatie die: (a) algemeen bekend is of wordt zonder dat de ontvangende partij daarvoor verantwoordelijk is; (b) bij de ontvangende partij al rechtmatig bekend was; (c) rechtmatig van een derde is verkregen zonder geheimhoudingsplicht; of (d) op grond van de wet of een rechterlijke uitspraak openbaar moet worden gemaakt, in welk geval de ontvangende partij de verstrekkende partij vooraf informeert voor zover dat is toegestaan.",
				),
			),

			h(2, "4. Duur"),
			p(
				text(
					"De geheimhoudingsplicht geldt voor onbepaalde tijd, zolang de informatie vertrouwelijk van aard is.",
				),
			),

			h(2, "5. Teruggave en slotbepalingen"),
			p(
				text(
					`De ontvangende partij geeft de vertrouwelijke informatie op eerste verzoek terug of vernietigt deze, inclusief eventuele kopieën. Op deze Overeenkomst is Nederlands recht van toepassing; geschillen worden voorgelegd aan de bevoegde rechter te ${v.governingCity}.`,
				),
			),

			h(2, "6. Ondertekening"),
			p(
				text(
					"De ontvangende partij verklaart deze Overeenkomst te hebben gelezen, te begrijpen en na te leven.",
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
	// The client party shows only its company name (fall back to the contact
	// name when no company is set).
	const clientStr = parties.clientCompany || parties.clientName;
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
