// Gedeelde types en formatters voor de factuur-PDF en de UBL 2.1 e-factuur.
// Puur en zonder react-pdf-imports, zodat beide renderers (en de routes die de
// data samenstellen) hiervan kunnen importeren zonder bundelkosten.
import {
	computeInvoiceTotals,
	type InvoiceTotals,
	makePaymentReference,
} from "~convex/lib/invoiceMath";

export type InvoiceDocLine = {
	description: string;
	quantity: number;
	unitPrice: number; // cents
};

export type InvoiceDocBusiness = {
	name: string;
	street?: string;
	postalCode?: string;
	city?: string;
	countryCode?: string;
	email?: string;
	kvkNumber?: string;
	vatNumber?: string;
	iban?: string;
	bic?: string;
};

export type InvoiceDocClient = {
	name: string;
	companyName?: string;
	email?: string;
	street?: string;
	postalCode?: string;
	city?: string;
	countryCode?: string;
	vatNumber?: string;
};

export type InvoiceDocumentData = {
	number: string;
	issuedAt: number; // ms epoch
	dueAt: number; // ms epoch
	currency: string;
	vatRate: number;
	pricesIncludeVat: boolean;
	lines: InvoiceDocLine[];
	business: InvoiceDocBusiness;
	client: InvoiceDocClient;
};

export function invoiceDocTotals(data: InvoiceDocumentData): InvoiceTotals {
	const lineSum = data.lines.reduce(
		(acc, l) => acc + l.quantity * l.unitPrice,
		0,
	);
	return computeInvoiceTotals(lineSum, data.vatRate, data.pricesIncludeVat);
}

// "€ 2.000,00" — exact zoals op de Moneybird-factuur (gewone spatie).
export function formatEuroCents(cents: number): string {
	const sign = cents < 0 ? "-" : "";
	const abs = Math.abs(Math.round(cents));
	const euros = Math.floor(abs / 100)
		.toString()
		.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
	const dec = String(abs % 100).padStart(2, "0");
	return `${sign}€ ${euros},${dec}`;
}

// Factuurdatums zijn opgeslagen als UTC-middernacht van de gekozen dag, dus
// beide notaties lezen we via de UTC-kalender.
export function formatDateIso(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10); // YYYY-MM-DD
}

export function formatDateNl(ms: number): string {
	const [y, m, d] = formatDateIso(ms).split("-");
	return `${d}-${m}-${y}`; // DD-MM-YYYY
}

// "NL43INGB0109900731" → "NL43 INGB 0109 9007 31"
export function formatIbanSpaced(iban: string): string {
	return iban
		.replace(/\s+/g, "")
		.replace(/(.{4})/g, "$1 ")
		.trim();
}

// De betaalzin onderaan de PDF en in cac:PaymentTerms van de UBL — letterlijk
// de Moneybird-formulering.
export function paymentNote(data: InvoiceDocumentData): string {
	const totals = invoiceDocTotals(data);
	return `We verzoeken u vriendelijk het bovenstaande bedrag van ${formatEuroCents(totals.totalCents)} voor ${formatDateNl(data.dueAt)} te voldoen op onze bankrekening onder vermelding van de omschrijving ${makePaymentReference(data.number)}. Voor vragen kunt u contact opnemen per e-mail.`;
}
