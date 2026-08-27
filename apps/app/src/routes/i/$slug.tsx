import { createFileRoute } from "@tanstack/react-router";
import { Brandmark, Logotype } from "@/components/brand";
import { InvoiceDownloadButtons } from "@/components/invoices/InvoiceDownloadButtons";
import { convexHttp } from "@/lib/convex-http";
import type { InvoiceDocumentData } from "@/lib/invoiceDocument";
import { api } from "~convex/_generated/api";
import { computeInvoiceTotals } from "~convex/lib/invoiceMath";

export const Route = createFileRoute("/i/$slug")({
	validateSearch: (search: Record<string, unknown>) => ({
		t: typeof search.t === "string" ? search.t : undefined,
	}),
	loaderDeps: ({ search }) => ({ token: search.t }),
	loader: async ({ params, deps }) =>
		convexHttp.query(api.invoices.getBySlug, {
			slug: params.slug,
			token: deps.token,
		}),
	head: ({ loaderData }) => {
		const number = loaderData?.invoice?.number;
		const title = number
			? `Invoice ${number} — BRANDOCEAN`
			: "Invoice — BRANDOCEAN";
		const description = number
			? `Invoice ${number} from BRANDOCEAN.`
			: "Invoice from BRANDOCEAN.";
		return {
			meta: [
				{ title },
				{ name: "description", content: description },
				{ property: "og:title", content: title },
				{ property: "og:description", content: description },
				{ property: "og:type", content: "article" },
				{ property: "og:site_name", content: "BRANDOCEAN" },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "robots", content: "noindex, nofollow" },
			],
		};
	},
	component: PublicInvoice,
});

function fmtCurrency(cents: number, currency: string) {
	return new Intl.NumberFormat("en-NL", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

function PublicInvoice() {
	const data = Route.useLoaderData();

	if (data === null) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
				<div className="flex items-center gap-3">
					<Brandmark size={48} />
					<Logotype height={32} />
				</div>
				<h1 className="text-2xl font-semibold">Invoice not available</h1>
				<p className="max-w-md text-sm text-muted-foreground">
					The link is missing or invalid, or the invoice is still in draft.
				</p>
			</div>
		);
	}

	const { invoice, lines, client, settings } = data;
	const pricesIncludeVat = invoice.pricesIncludeVat ?? false;
	const lineSum = lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
	const {
		subtotalCents: subtotal,
		vatCents: vat,
		totalCents: total,
	} = computeInvoiceTotals(lineSum, invoice.vatRate, pricesIncludeVat);

	// Dezelfde gegevens als op de PDF / UBL e-factuur, uit de publieke payload.
	const docData: InvoiceDocumentData | null =
		settings && client
			? {
					number: invoice.number,
					issuedAt: invoice.issuedAt,
					dueAt: invoice.dueAt,
					currency: invoice.currency,
					vatRate: invoice.vatRate,
					pricesIncludeVat,
					lines: lines.map((l) => ({
						description: l.description,
						quantity: l.quantity,
						unitPrice: l.unitPrice,
					})),
					business: {
						name: settings.businessName ?? "brandocean",
						street: settings.businessStreet,
						postalCode: settings.businessPostalCode,
						city: settings.businessCity,
						countryCode: settings.businessCountryCode,
						email: settings.businessEmail,
						kvkNumber: settings.kvkNumber,
						vatNumber: settings.vatNumber,
						iban: settings.iban,
						bic: settings.bic,
					},
					client: {
						name: client.name,
						companyName: client.companyName,
						email: client.email,
						street: client.street,
						postalCode: client.postalCode,
						city: client.city,
						countryCode: client.countryCode,
						vatNumber: client.vatNumber,
					},
				}
			: null;

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="border-b">
				<div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
					<Brandmark size={48} />
					<Logotype height={32} />
				</div>
			</header>
			<main className="mx-auto max-w-3xl px-6 py-16">
				<header className="mb-8 space-y-2">
					<p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
						Invoice {invoice.number}
					</p>
					<h1 className="text-4xl font-semibold tracking-tight">
						{client?.name ?? "Client"}
					</h1>
					<p className="text-sm text-muted-foreground">
						Issued {new Date(invoice.issuedAt).toLocaleDateString()} · Due{" "}
						{new Date(invoice.dueAt).toLocaleDateString()}
					</p>
					{docData ? (
						<div className="flex gap-2 pt-2">
							<InvoiceDownloadButtons data={docData} />
						</div>
					) : null}
				</header>

				<table className="w-full text-sm">
					<thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
						<tr className="border-b">
							<th className="py-3">Description</th>
							<th className="py-3 text-right">Qty</th>
							<th className="py-3 text-right">Unit</th>
							<th className="py-3 text-right">Total</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{lines.map((l) => (
							<tr key={l._id}>
								<td className="py-3">{l.description}</td>
								<td className="py-3 text-right font-mono">{l.quantity}</td>
								<td className="py-3 text-right font-mono">
									{fmtCurrency(l.unitPrice, invoice.currency)}
								</td>
								<td className="py-3 text-right font-mono">
									{fmtCurrency(l.quantity * l.unitPrice, invoice.currency)}
								</td>
							</tr>
						))}
					</tbody>
				</table>

				<div className="ml-auto mt-8 w-full max-w-xs space-y-2 text-sm">
					<Row
						label="Subtotal"
						value={fmtCurrency(subtotal, invoice.currency)}
					/>
					<Row
						label={`VAT (${invoice.vatRate}%)`}
						value={fmtCurrency(vat, invoice.currency)}
					/>
					<div className="border-t pt-2 text-base font-semibold">
						<Row label="Total" value={fmtCurrency(total, invoice.currency)} />
					</div>
				</div>

				{invoice.notes ? (
					<p className="mt-12 whitespace-pre-wrap text-sm text-muted-foreground">
						{invoice.notes}
					</p>
				) : null}
			</main>
		</div>
	);
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-muted-foreground">{label}</span>
			<span className="font-mono">{value}</span>
		</div>
	);
}
