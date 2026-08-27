// Pure factuurwiskunde — gedeeld tussen backend (boeking) en frontend
// (PDF/UBL/weergave). Geen Convex-imports, dus veilig te bundelen.

export type InvoiceTotals = {
	subtotalCents: number; // excl. BTW
	vatCents: number;
	totalCents: number; // incl. BTW
};

// lineSumCents = som van quantity × unitPrice over de regels.
// Bij pricesIncludeVat zijn de regelprijzen inclusief BTW (Moneybird-stijl):
// het totaal staat vast en de BTW wordt eruit teruggerekend.
export function computeInvoiceTotals(
	lineSumCents: number,
	vatRate: number,
	pricesIncludeVat: boolean,
): InvoiceTotals {
	if (pricesIncludeVat) {
		const totalCents = Math.round(lineSumCents);
		const vatCents = Math.round((totalCents * vatRate) / (100 + vatRate));
		return { subtotalCents: totalCents - vatCents, vatCents, totalCents };
	}
	const subtotalCents = Math.round(lineSumCents);
	const vatCents = Math.round((subtotalCents * vatRate) / 100);
	return { subtotalCents, vatCents, totalCents: subtotalCents + vatCents };
}

// ISO 11649 RF-betaalkenmerk op basis van het factuurnummer, zoals
// Moneybird op facturen zet ("RF07...").
export function makePaymentReference(invoiceNumber: string): string {
	const ref = invoiceNumber.toUpperCase().replace(/[^0-9A-Z]/g, "");
	// mod-97 over ref + "RF00", letters als 10..35 (ISO 7064).
	const digits = `${ref}RF00`
		.split("")
		.map((ch) => (ch >= "0" && ch <= "9" ? ch : String(ch.charCodeAt(0) - 55)))
		.join("");
	let mod = 0;
	for (const d of digits) mod = (mod * 10 + Number(d)) % 97;
	const check = String(98 - mod).padStart(2, "0");
	return `RF${check}${ref}`;
}
