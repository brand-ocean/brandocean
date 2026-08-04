// Factuur-PDF, 1:1 nagebouwd op de Moneybird-factuurlayout (zie 2026-0031):
// logo + bedrijfsblok rechtsboven, klantblok links, "Factuur <nr>" met
// datumtabel, regeltabel met Bedrag/Totaal/Btw, totalenblok en de betaalzin
// onderaan. Client-only en dynamisch geïmporteerd zodat react-pdf buiten de
// hoofdbundel blijft.
import {
	Document,
	Font,
	Image,
	Page,
	pdf,
	StyleSheet,
	Text,
	View,
} from "@react-pdf/renderer";
import {
	formatDateNl,
	formatEuroCents,
	formatIbanSpaced,
	type InvoiceDocumentData,
	invoiceDocTotals,
	paymentNote,
} from "@/lib/invoiceDocument";

let fontsRegistered = false;
function ensureFonts() {
	if (fontsRegistered) return;
	Font.register({
		family: "Host Grotesk",
		fonts: [
			{ src: "/fonts/host-grotesk-400.ttf", fontWeight: 400 },
			{ src: "/fonts/host-grotesk-600.ttf", fontWeight: 600 },
			{ src: "/fonts/host-grotesk-700.ttf", fontWeight: 700 },
		],
	});
	Font.registerHyphenationCallback((word) => [word]);
	fontsRegistered = true;
}

// Kolombreedtes van de regeltabel (pt) — Bedrag/Totaal rechts, smalle
// Btw-kolom helemaal rechts, zoals op de referentiefactuur.
const COL_QTY = 44;
const COL_AMOUNT = 78;
const COL_TOTAL = 78;
const COL_VAT = 36;

const styles = StyleSheet.create({
	page: {
		paddingTop: 42,
		paddingBottom: 110,
		paddingHorizontal: 56,
		fontFamily: "Host Grotesk",
		fontSize: 9,
		lineHeight: 1.5,
		color: "#111111",
	},
	bold: { fontWeight: 600 },

	headerRow: { flexDirection: "row", justifyContent: "flex-end" },
	logo: { width: 56, height: 56, marginRight: 16 },
	headerBlock: { minWidth: 150 },
	headerSpacer: { height: 13 },

	clientBlock: { marginTop: 26, marginLeft: 58 },

	titleRow: {
		marginTop: 96,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	title: { fontSize: 23, lineHeight: 1.2 },
	dateTable: {},
	dateRow: { flexDirection: "row", justifyContent: "flex-end" },
	dateLabel: { marginRight: 28 },
	dateValue: { minWidth: 66, textAlign: "right" },

	table: { marginTop: 44 },
	tableHeader: {
		flexDirection: "row",
		borderBottomWidth: 1,
		borderBottomColor: "#111111",
		paddingBottom: 5,
	},
	tableRow: {
		flexDirection: "row",
		borderBottomWidth: 0.75,
		borderBottomColor: "#111111",
		paddingVertical: 7,
	},
	colQty: { width: COL_QTY, paddingRight: 8, color: "#555555" },
	colDescription: { flex: 1, paddingRight: 10 },
	colAmount: { width: COL_AMOUNT, textAlign: "right" },
	colTotal: { width: COL_TOTAL, textAlign: "right" },
	colVat: { width: COL_VAT, textAlign: "right" },

	totals: {
		alignSelf: "flex-end",
		width: 250,
		paddingRight: COL_VAT,
	},
	totalsRow: {
		flexDirection: "row",
		justifyContent: "flex-end",
		paddingTop: 9,
	},
	totalsLabel: { flex: 1, textAlign: "right" },
	totalsValue: { width: 84, textAlign: "right" },
	totalsRule: {
		borderTopWidth: 1.5,
		borderTopColor: "#111111",
		marginTop: 10,
	},

	footer: {
		position: "absolute",
		left: 56,
		right: 56,
		bottom: 44,
		borderTopWidth: 0.75,
		borderTopColor: "#111111",
		paddingTop: 12,
		fontSize: 9,
		lineHeight: 1.55,
	},
});

// "1" → "1", "2.5" → "2,5" (nl-notatie in de regelkolom).
function formatQty(quantity: number): string {
	return String(quantity).replace(".", ",");
}

export function buildInvoicePdfDoc(data: InvoiceDocumentData) {
	ensureFonts();
	const { business, client } = data;
	const totals = invoiceDocTotals(data);
	const clientName = client.companyName || client.name;
	const clientCityLine = [client.postalCode, client.city]
		.filter(Boolean)
		.join(" ");
	const businessCityLine = [business.postalCode, business.city]
		.filter(Boolean)
		.join(" ");

	return (
		<Document
			title={`Factuur ${data.number}`}
			author={business.name}
			language="nl"
		>
			<Page size="A4" style={styles.page}>
				{/* Bedrijfsblok rechtsboven: logo links van naam/adres, daaronder
				    e-mail en registraties — zoals op de Moneybird-factuur. */}
				<View style={styles.headerRow}>
					<Image src="/logo512.png" style={styles.logo} />
					<View style={styles.headerBlock}>
						<Text style={styles.bold}>{business.name}</Text>
						{business.street ? <Text>{business.street}</Text> : null}
						{businessCityLine ? <Text>{businessCityLine}</Text> : null}
						<View style={styles.headerSpacer} />
						{business.email ? <Text>{business.email}</Text> : null}
						<View style={styles.headerSpacer} />
						{business.kvkNumber ? <Text>KVK: {business.kvkNumber}</Text> : null}
						{business.vatNumber ? <Text>Btw: {business.vatNumber}</Text> : null}
						{business.iban ? (
							<Text>Bank: {formatIbanSpaced(business.iban)}</Text>
						) : null}
					</View>
				</View>

				{/* Klantblok op vensterenvelop-positie. */}
				<View style={styles.clientBlock}>
					<Text>{clientName}</Text>
					{client.street ? <Text>{client.street}</Text> : null}
					{clientCityLine ? <Text>{clientCityLine}</Text> : null}
				</View>

				{/* Titel + datumtabel. */}
				<View style={styles.titleRow}>
					<Text style={styles.title}>Factuur {data.number}</Text>
					<View style={styles.dateTable}>
						<View style={styles.dateRow}>
							<Text style={styles.dateLabel}>Factuurdatum:</Text>
							<Text style={styles.dateValue}>
								{formatDateNl(data.issuedAt)}
							</Text>
						</View>
						<View style={styles.dateRow}>
							<Text style={styles.dateLabel}>Vervaldatum:</Text>
							<Text style={styles.dateValue}>{formatDateNl(data.dueAt)}</Text>
						</View>
					</View>
				</View>

				{/* Regeltabel. Bij prijzen incl. btw tonen Bedrag/Totaal de
				    ingevoerde (incl.) bedragen, net als Moneybird. */}
				<View style={styles.table}>
					<View style={styles.tableHeader}>
						<Text style={styles.colQty} />
						<Text style={[styles.colDescription, styles.bold]}>
							Omschrijving
						</Text>
						<Text style={[styles.colAmount, styles.bold]}>Bedrag</Text>
						<Text style={[styles.colTotal, styles.bold]}>Totaal</Text>
						<Text style={[styles.colVat, styles.bold]}>Btw</Text>
					</View>
					{data.lines.map((line, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: statische eenmalige PDF-render
						<View key={i} style={styles.tableRow} wrap={false}>
							<Text style={styles.colQty}>{formatQty(line.quantity)} x</Text>
							<Text style={styles.colDescription}>{line.description}</Text>
							<Text style={styles.colAmount}>
								{formatEuroCents(line.unitPrice)}
							</Text>
							<Text style={styles.colTotal}>
								{formatEuroCents(line.quantity * line.unitPrice)}
							</Text>
							<Text style={styles.colVat}>{data.vatRate}%</Text>
						</View>
					))}
				</View>

				{/* Totalenblok, uitgelijnd onder de Totaal-kolom. */}
				<View style={styles.totals} wrap={false}>
					<View style={styles.totalsRow}>
						<Text style={[styles.totalsLabel, styles.bold]}>
							Subtotaal excl. btw
						</Text>
						<Text style={styles.totalsValue}>
							{formatEuroCents(totals.subtotalCents)}
						</Text>
					</View>
					<View style={styles.totalsRow}>
						<Text style={styles.totalsLabel}>{data.vatRate}% btw</Text>
						<Text style={styles.totalsValue}>
							{formatEuroCents(totals.vatCents)}
						</Text>
					</View>
					<View style={styles.totalsRule} />
					<View style={styles.totalsRow}>
						<Text style={[styles.totalsLabel, styles.bold]}>Totaal</Text>
						<Text style={[styles.totalsValue, styles.bold]}>
							{formatEuroCents(totals.totalCents)}
						</Text>
					</View>
				</View>

				{/* Betaalzin onderaan, boven een dunne lijn. */}
				<View style={styles.footer} fixed>
					<Text>{paymentNote(data)}</Text>
				</View>
			</Page>
		</Document>
	);
}

export async function invoicePdfBlob(data: InvoiceDocumentData): Promise<Blob> {
	return await pdf(buildInvoicePdfDoc(data)).toBlob();
}

export async function downloadInvoicePdf(
	data: InvoiceDocumentData,
	filename: string,
): Promise<void> {
	const blob = await invoicePdfBlob(data);
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
