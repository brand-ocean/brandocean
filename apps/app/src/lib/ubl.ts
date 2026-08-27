// UBL 2.1 e-factuur, structureel identiek aan de Moneybird-export
// (2026-0031.xml): zelfde namespaces, schemeID's en elementvolgorde. De PDF
// kan als PrimaryImage-bijlage worden ingesloten.

import {
	formatDateIso,
	type InvoiceDocumentData,
	invoiceDocTotals,
	paymentNote,
} from "@/lib/invoiceDocument";
import { makePaymentReference } from "~convex/lib/invoiceMath";

function esc(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

// Bedragen in euro's met 2 decimalen: 165289 → "1652.89".
function euros(cents: number): string {
	return (cents / 100).toFixed(2);
}

// Stukprijs (excl.) mag lange decimalen hebben, zoals "1652.892561983" in de
// referentie. Ronde bedragen krijgen gewoon 2 decimalen.
function priceAmount(value: number): string {
	const rounded2 = Math.round(value * 100) / 100;
	if (Math.abs(value - rounded2) < 1e-9) return rounded2.toFixed(2);
	return value.toFixed(9).replace(/0+$/, "");
}

// Hoeveelheid met minimaal één decimaal: 1 → "1.0", 2.5 → "2.5".
function quantity(q: number): string {
	const s = String(q);
	return s.includes(".") ? s : `${s}.0`;
}

export function buildUblInvoice(
	data: InvoiceDocumentData,
	pdfBase64?: string,
): string {
	const { business, client } = data;
	const totals = invoiceDocTotals(data);
	const buyerName = client.companyName || client.name;
	const vatCategoryId = data.vatRate === 0 ? "Z" : "S";
	const percent = data.vatRate.toFixed(1);
	const paymentRef = makePaymentReference(data.number);
	const iban = (business.iban ?? "").replace(/\s+/g, "");

	// Regelbedragen excl. btw in centen; bij prijzen incl. btw wordt per regel
	// teruggerekend en vangt de laatste regel het afrondingsverschil op, zodat
	// de som exact gelijk is aan het subtotaal.
	const rate = data.vatRate;
	const lineExclCents: number[] = data.lines.map((l) =>
		data.pricesIncludeVat
			? Math.round((l.quantity * l.unitPrice * 100) / (100 + rate))
			: Math.round(l.quantity * l.unitPrice),
	);
	if (lineExclCents.length > 0) {
		const sum = lineExclCents.reduce((acc, c) => acc + c, 0);
		lineExclCents[lineExclCents.length - 1] += totals.subtotalCents - sum;
	}

	const taxCategoryXml = (
		tag: "cac:TaxCategory" | "cac:ClassifiedTaxCategory",
		indent: string,
	) =>
		[
			`${indent}<${tag}>`,
			`${indent}  <cbc:ID schemeID="UNCL5305">${vatCategoryId}</cbc:ID>`,
			`${indent}  <cbc:Percent>${percent}</cbc:Percent>`,
			`${indent}  <cac:TaxScheme>`,
			`${indent}    <cbc:ID schemeID="UN/ECE 5153">VAT</cbc:ID>`,
			`${indent}  </cac:TaxScheme>`,
			`${indent}</${tag}>`,
		].join("\n");

	const lines = data.lines
		.map((line, i) => {
			// Stukprijs excl. btw in euro's, met lange decimalen bij incl-prijzen.
			const unitExclEuros = data.pricesIncludeVat
				? line.unitPrice / 100 / (1 + rate / 100)
				: line.unitPrice / 100;
			return [
				"  <cac:InvoiceLine>",
				`    <cbc:ID>${i + 1}</cbc:ID>`,
				`    <cbc:InvoicedQuantity unitCode="ZZ" unitCodeListID="UNECERec20">${quantity(line.quantity)}</cbc:InvoicedQuantity>`,
				`    <cbc:LineExtensionAmount currencyID="${esc(data.currency)}">${euros(lineExclCents[i])}</cbc:LineExtensionAmount>`,
				"    <cac:Item>",
				`      <cbc:Description>${esc(line.description)}</cbc:Description>`,
				`      <cbc:Name>${esc(line.description)}</cbc:Name>`,
				taxCategoryXml("cac:ClassifiedTaxCategory", "      "),
				"    </cac:Item>",
				"    <cac:Price>",
				`      <cbc:PriceAmount currencyID="${esc(data.currency)}">${priceAmount(unitExclEuros)}</cbc:PriceAmount>`,
				"    </cac:Price>",
				"  </cac:InvoiceLine>",
			].join("\n");
		})
		.join("\n");

	const additionalDocumentReference = pdfBase64
		? [
				"  <cac:AdditionalDocumentReference>",
				`    <cbc:ID>${esc(data.number)}.pdf</cbc:ID>`,
				"    <cbc:DocumentType>PrimaryImage</cbc:DocumentType>",
				"    <cac:Attachment>",
				`      <cbc:EmbeddedDocumentBinaryObject mimeCode="application/pdf" filename="${esc(data.number)}.pdf">${pdfBase64}</cbc:EmbeddedDocumentBinaryObject>`,
				"    </cac:Attachment>",
				"  </cac:AdditionalDocumentReference>",
			].join("\n")
		: null;

	const supplierParty = [
		"  <cac:AccountingSupplierParty>",
		"    <cac:Party>",
		...(business.kvkNumber
			? [
					`      <cbc:EndpointID schemeID="0106">${esc(business.kvkNumber)}</cbc:EndpointID>`,
				]
			: []),
		"      <cac:PartyName>",
		`        <cbc:Name>${esc(business.name)}</cbc:Name>`,
		"      </cac:PartyName>",
		"      <cac:PostalAddress>",
		...(business.street
			? [`        <cbc:StreetName>${esc(business.street)}</cbc:StreetName>`]
			: []),
		...(business.city
			? [`        <cbc:CityName>${esc(business.city)}</cbc:CityName>`]
			: []),
		...(business.postalCode
			? [`        <cbc:PostalZone>${esc(business.postalCode)}</cbc:PostalZone>`]
			: []),
		"        <cac:Country>",
		`          <cbc:IdentificationCode listID="ISO3166-1:Alpha2" listAgencyID="6">${esc(business.countryCode ?? "NL")}</cbc:IdentificationCode>`,
		"        </cac:Country>",
		"      </cac:PostalAddress>",
		...(business.vatNumber
			? [
					"      <cac:PartyTaxScheme>",
					`        <cbc:CompanyID schemeID="NL:VAT">${esc(business.vatNumber)}</cbc:CompanyID>`,
					"        <cac:TaxScheme>",
					'          <cbc:ID schemeID="UN/ECE 5153">VAT</cbc:ID>',
					"        </cac:TaxScheme>",
					"      </cac:PartyTaxScheme>",
				]
			: []),
		"      <cac:PartyLegalEntity>",
		`        <cbc:RegistrationName>${esc(business.name)}</cbc:RegistrationName>`,
		...(business.kvkNumber
			? [
					`        <cbc:CompanyID schemeID="0106">${esc(business.kvkNumber)}</cbc:CompanyID>`,
				]
			: []),
		"      </cac:PartyLegalEntity>",
		...(business.email
			? [
					"      <cac:Contact>",
					`        <cbc:ElectronicMail>${esc(business.email)}</cbc:ElectronicMail>`,
					"      </cac:Contact>",
				]
			: []),
		"    </cac:Party>",
		"  </cac:AccountingSupplierParty>",
	].join("\n");

	const hasClientAddress = Boolean(
		client.street || client.postalCode || client.city,
	);
	const customerParty = [
		"  <cac:AccountingCustomerParty>",
		"    <cac:Party>",
		"      <cac:PartyName>",
		`        <cbc:Name>${esc(buyerName)}</cbc:Name>`,
		"      </cac:PartyName>",
		...(hasClientAddress
			? [
					"      <cac:PostalAddress>",
					...(client.street
						? [`        <cbc:StreetName>${esc(client.street)}</cbc:StreetName>`]
						: []),
					...(client.city
						? [`        <cbc:CityName>${esc(client.city)}</cbc:CityName>`]
						: []),
					...(client.postalCode
						? [
								`        <cbc:PostalZone>${esc(client.postalCode)}</cbc:PostalZone>`,
							]
						: []),
					"        <cac:Country>",
					`          <cbc:IdentificationCode listID="ISO3166-1:Alpha2" listAgencyID="6">${esc(client.countryCode ?? "NL")}</cbc:IdentificationCode>`,
					"        </cac:Country>",
					"      </cac:PostalAddress>",
				]
			: []),
		...(client.vatNumber
			? [
					"      <cac:PartyTaxScheme>",
					`        <cbc:CompanyID schemeID="NL:VAT">${esc(client.vatNumber)}</cbc:CompanyID>`,
					"        <cac:TaxScheme>",
					'          <cbc:ID schemeID="UN/ECE 5153">VAT</cbc:ID>',
					"        </cac:TaxScheme>",
					"      </cac:PartyTaxScheme>",
				]
			: []),
		"      <cac:PartyLegalEntity>",
		`        <cbc:RegistrationName>${esc(buyerName)}</cbc:RegistrationName>`,
		"      </cac:PartyLegalEntity>",
		...(client.email
			? [
					"      <cac:Contact>",
					`        <cbc:ElectronicMail>${esc(client.email)}</cbc:ElectronicMail>`,
					"      </cac:Contact>",
				]
			: []),
		"    </cac:Party>",
		"  </cac:AccountingCustomerParty>",
	].join("\n");

	const paymentMeans = [
		"  <cac:PaymentMeans>",
		'    <cbc:PaymentMeansCode listID="UNCL4461" listAgencyID="6">30</cbc:PaymentMeansCode>',
		`    <cbc:PaymentDueDate>${formatDateIso(data.dueAt)}</cbc:PaymentDueDate>`,
		`    <cbc:PaymentID>${esc(paymentRef)}</cbc:PaymentID>`,
		...(iban
			? [
					"    <cac:PayeeFinancialAccount>",
					`      <cbc:ID schemeID="IBAN">${esc(iban)}</cbc:ID>`,
					...(business.bic
						? [
								"      <cac:FinancialInstitutionBranch>",
								"        <cac:FinancialInstitution>",
								`          <cbc:ID schemeID="BIC">${esc(business.bic)}</cbc:ID>`,
								"        </cac:FinancialInstitution>",
								"      </cac:FinancialInstitutionBranch>",
							]
						: []),
					"    </cac:PayeeFinancialAccount>",
				]
			: []),
		"  </cac:PaymentMeans>",
	].join("\n");

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2 UBL-Invoice-2.1.xsd" xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">',
		"  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>",
		`  <cbc:ID>${esc(data.number)}</cbc:ID>`,
		`  <cbc:IssueDate>${formatDateIso(data.issuedAt)}</cbc:IssueDate>`,
		`  <cbc:DueDate>${formatDateIso(data.dueAt)}</cbc:DueDate>`,
		'  <cbc:InvoiceTypeCode listID="UNCL1001" listAgencyID="6">380</cbc:InvoiceTypeCode>',
		`  <cbc:DocumentCurrencyCode listID="ISO4217" listAgencyID="6">${esc(data.currency)}</cbc:DocumentCurrencyCode>`,
		`  <cbc:BuyerReference>${esc(buyerName)}</cbc:BuyerReference>`,
		...(additionalDocumentReference ? [additionalDocumentReference] : []),
		supplierParty,
		customerParty,
		paymentMeans,
		"  <cac:PaymentTerms>",
		`    <cbc:Note>${esc(paymentNote(data))}</cbc:Note>`,
		"  </cac:PaymentTerms>",
		"  <cac:TaxTotal>",
		`    <cbc:TaxAmount currencyID="${esc(data.currency)}">${euros(totals.vatCents)}</cbc:TaxAmount>`,
		"    <cac:TaxSubtotal>",
		`      <cbc:TaxableAmount currencyID="${esc(data.currency)}">${euros(totals.subtotalCents)}</cbc:TaxableAmount>`,
		`      <cbc:TaxAmount currencyID="${esc(data.currency)}">${euros(totals.vatCents)}</cbc:TaxAmount>`,
		taxCategoryXml("cac:TaxCategory", "      "),
		"    </cac:TaxSubtotal>",
		"  </cac:TaxTotal>",
		"  <cac:LegalMonetaryTotal>",
		`    <cbc:LineExtensionAmount currencyID="${esc(data.currency)}">${euros(totals.subtotalCents)}</cbc:LineExtensionAmount>`,
		`    <cbc:TaxExclusiveAmount currencyID="${esc(data.currency)}">${euros(totals.subtotalCents)}</cbc:TaxExclusiveAmount>`,
		`    <cbc:TaxInclusiveAmount currencyID="${esc(data.currency)}">${euros(totals.totalCents)}</cbc:TaxInclusiveAmount>`,
		`    <cbc:AllowanceTotalAmount currencyID="${esc(data.currency)}">0</cbc:AllowanceTotalAmount>`,
		`    <cbc:PayableAmount currencyID="${esc(data.currency)}">${euros(totals.totalCents)}</cbc:PayableAmount>`,
		"  </cac:LegalMonetaryTotal>",
		...(lines ? [lines] : []),
		"</Invoice>",
		"",
	].join("\n");
}

async function blobToBase64(blob: Blob): Promise<string> {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	let binary = "";
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

// Bouwt eerst de PDF (dynamisch geladen zodat react-pdf buiten de bundel
// blijft), sluit die in als PrimaryImage en downloadt "<nummer>.xml".
export async function downloadUblInvoice(
	data: InvoiceDocumentData,
): Promise<void> {
	const { invoicePdfBlob } = await import("@/components/invoices/invoicePdf");
	const pdfBlob = await invoicePdfBlob(data);
	const pdfBase64 = await blobToBase64(pdfBlob);
	const xml = buildUblInvoice(data, pdfBase64);
	const blob = new Blob([xml], { type: "application/xml" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${data.number}.xml`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
