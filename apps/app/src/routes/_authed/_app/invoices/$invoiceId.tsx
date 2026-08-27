import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { CheckIcon, CopyIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import {
	Frame,
	FrameActions,
	FrameDescription,
	FrameFooter,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { usePageTitle } from "@/components/app/page-title";
import { type Tone, TonePill } from "@/components/app/tone";
import { InvoiceDownloadButtons } from "@/components/invoices/InvoiceDownloadButtons";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { InvoiceDocumentData } from "@/lib/invoiceDocument";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";
import { computeInvoiceTotals } from "~convex/lib/invoiceMath";

export const Route = createFileRoute("/_authed/_app/invoices/$invoiceId")({
	component: InvoiceEditor,
});

const STATUSES = ["draft", "sent", "paid", "overdue", "void"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_TONE: Record<Status, Tone> = {
	draft: "muted",
	sent: "info",
	paid: "success",
	overdue: "danger",
	void: "muted",
};

function fmtCurrency(cents: number, currency: string) {
	return new Intl.NumberFormat("en-NL", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

function toIsoDate(ms: number) {
	return new Date(ms).toISOString().slice(0, 10);
}

function InvoiceEditor() {
	const { invoiceId } = Route.useParams();
	const id = invoiceId as Id<"invoices">;
	const data = useQuery(api.invoices.getById, { id });
	const clients = useQuery(api.clients.list);
	const settings = useQuery(api.userSettings.get);
	const fullClient = useQuery(
		api.clients.getById,
		data ? { id: data.invoice.clientId } : "skip",
	);
	usePageTitle(data?.invoice.number);

	if (data === undefined) {
		return (
			<Frame className="mx-auto w-full max-w-4xl">
				<FramePanel>
					<Skeleton className="mb-4 h-8 w-2/3" />
					<Skeleton className="h-40" />
				</FramePanel>
			</Frame>
		);
	}

	if (data === null) {
		return (
			<Frame className="mx-auto w-full max-w-4xl">
				<FramePanel flush>
					<EmptyState
						title="Invoice not found"
						description="It may have been removed, or you don't have access."
						action={
							<Button
								size="sm"
								render={<Link to="/invoices" />}
								variant="outline"
							>
								Back to invoices
							</Button>
						}
					/>
				</FramePanel>
			</Frame>
		);
	}

	const { invoice, lines } = data;
	const client = (clients ?? []).find((c) => c._id === invoice.clientId);
	const pricesIncludeVat = invoice.pricesIncludeVat ?? false;
	const lineSum = lines.reduce((acc, l) => acc + l.quantity * l.unitPrice, 0);
	const totals = computeInvoiceTotals(
		lineSum,
		invoice.vatRate,
		pricesIncludeVat,
	);

	// Alles wat op de PDF / UBL e-factuur staat, in één pakketje.
	const docData: InvoiceDocumentData | null =
		settings && fullClient
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
						name: fullClient.name,
						companyName: fullClient.companyName,
						email: fullClient.email,
						street: fullClient.street,
						postalCode: fullClient.postalCode,
						city: fullClient.city,
						countryCode: fullClient.countryCode,
						vatNumber: fullClient.vatNumber,
					},
				}
			: null;

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-4.5">
			<InvoiceHeader
				invoiceId={id}
				number={invoice.number}
				status={invoice.status as Status}
				clientName={client?.name ?? "Unknown client"}
				clientId={invoice.clientId}
				slug={invoice.slug}
				token={invoice.shareToken}
				docData={docData}
			/>
			<MetaForm
				invoiceId={id}
				issuedAt={invoice.issuedAt}
				dueAt={invoice.dueAt}
				vatRate={invoice.vatRate}
				currency={invoice.currency}
				notes={invoice.notes ?? ""}
				pricesIncludeVat={pricesIncludeVat}
			/>
			<LinesEditor invoiceId={id} lines={lines} currency={invoice.currency} />
			<Totals
				subtotal={totals.subtotalCents}
				vat={totals.vatCents}
				vatRate={invoice.vatRate}
				total={totals.totalCents}
				currency={invoice.currency}
			/>
		</div>
	);
}

function InvoiceHeader({
	invoiceId,
	number,
	status,
	clientName,
	clientId,
	slug,
	token,
	docData,
}: {
	invoiceId: Id<"invoices">;
	number: string;
	status: Status;
	clientName: string;
	clientId: Id<"clients">;
	slug: string;
	token: string;
	docData: InvoiceDocumentData | null;
}) {
	const setStatus = useMutation(api.invoices.setStatus);
	const remove = useMutation(api.invoices.remove);
	const [copied, setCopied] = useState(false);
	const shareUrl =
		typeof window !== "undefined"
			? `${window.location.origin}/i/${slug}?t=${token}`
			: `/i/${slug}?t=${token}`;

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>{number}</FrameTitle>
					<FrameDescription>
						For{" "}
						<Link
							to="/clients/$clientId"
							params={{ clientId }}
							className="underline underline-offset-2"
						>
							{clientName}
						</Link>
					</FrameDescription>
				</FrameHeading>
				<FrameActions className="flex-wrap">
					<TonePill dot tone={STATUS_TONE[status]}>
						{status}
					</TonePill>
					<Select
						value={status}
						onValueChange={(v) =>
							void setStatus({ id: invoiceId, status: (v ?? status) as Status })
						}
					>
						<SelectTrigger size="sm" className="w-28">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{STATUSES.map((s) => (
								<SelectItem key={s} value={s}>
									{s}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={async () => {
							try {
								await navigator.clipboard.writeText(shareUrl);
								setCopied(true);
								toast.success("Link copied");
								setTimeout(() => setCopied(false), 1500);
							} catch (err) {
								toast.error("Could not copy", {
									description: err instanceof Error ? err.message : String(err),
								});
							}
						}}
					>
						{copied ? (
							<CheckIcon data-icon="inline-start" />
						) : (
							<CopyIcon data-icon="inline-start" />
						)}
						{copied ? "Copied" : "Copy link"}
					</Button>
					<InvoiceDownloadButtons data={docData} />
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={async () => {
							if (!window.confirm(`Delete ${number}?`)) return;
							try {
								await remove({ id: invoiceId });
								window.history.back();
							} catch (err) {
								toast.error("Could not delete", {
									description: err instanceof Error ? err.message : String(err),
								});
							}
						}}
					>
						<Trash2Icon data-icon="inline-start" />
						Delete
					</Button>
				</FrameActions>
			</FrameHeader>
		</Frame>
	);
}

function MetaForm({
	invoiceId,
	issuedAt,
	dueAt,
	vatRate,
	currency,
	notes,
	pricesIncludeVat,
}: {
	invoiceId: Id<"invoices">;
	issuedAt: number;
	dueAt: number;
	vatRate: number;
	currency: string;
	notes: string;
	pricesIncludeVat: boolean;
}) {
	const update = useMutation(api.invoices.update);
	const [issued, setIssued] = useState(toIsoDate(issuedAt));
	const [due, setDue] = useState(toIsoDate(dueAt));
	const [rate, setRate] = useState(String(vatRate));
	const [curr, setCurr] = useState(currency);
	const [note, setNote] = useState(notes);
	const [saving, setSaving] = useState(false);
	const pricesModeId = useId();

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				setSaving(true);
				try {
					await update({
						id: invoiceId,
						issuedAt: new Date(issued).getTime(),
						dueAt: new Date(due).getTime(),
						vatRate: Number(rate) || 0,
						currency: curr.toUpperCase() || "EUR",
						notes: note,
					});
					toast.success("Saved");
				} catch (err) {
					toast.error("Could not save", {
						description: err instanceof Error ? err.message : String(err),
					});
				} finally {
					setSaving(false);
				}
			}}
		>
			<Frame>
				<FrameHeader>
					<FrameHeading>
						<FrameTitle>Invoice details</FrameTitle>
						<FrameDescription>
							Dates, VAT and the note printed on the invoice.
						</FrameDescription>
					</FrameHeading>
				</FrameHeader>
				<FramePanel>
					<FieldGroup>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							<Field>
								<FieldLabel htmlFor="issued">Issued</FieldLabel>
								<Input
									id="issued"
									type="date"
									value={issued}
									onChange={(e) => setIssued(e.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="due">Due</FieldLabel>
								<Input
									id="due"
									type="date"
									value={due}
									onChange={(e) => setDue(e.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="vat">VAT rate (%)</FieldLabel>
								<Input
									id="vat"
									type="number"
									value={rate}
									onChange={(e) => setRate(e.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="currency">Currency</FieldLabel>
								<Input
									id="currency"
									value={curr}
									onChange={(e) => setCurr(e.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor={pricesModeId}>
									Prijzen incl. btw
								</FieldLabel>
								{/* Direct opslaan — de prijsmodus bepaalt hoe totalen en de
						    PDF/UBL rekenen, dus geen aparte save-stap. */}
								<Select
									value={pricesIncludeVat ? "incl" : "excl"}
									onValueChange={async (v) => {
										if (v === null) return;
										try {
											await update({
												id: invoiceId,
												pricesIncludeVat: v === "incl",
											});
										} catch (err) {
											if (
												err instanceof ConvexError &&
												err.data === "invoice_booked"
											) {
												toast.error("Factuur is al geboekt", {
													description:
														"De prijsmodus is vergrendeld zodra de factuur in het grootboek staat. Void de factuur en maak een nieuwe voor correcties.",
												});
												return;
											}
											toast.error("Could not save", {
												description:
													err instanceof Error ? err.message : String(err),
											});
										}
									}}
								>
									<SelectTrigger id={pricesModeId}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="excl">Excl. btw (standaard)</SelectItem>
										<SelectItem value="incl">Incl. btw (Moneybird)</SelectItem>
									</SelectContent>
								</Select>
							</Field>
						</div>
						<Field>
							<FieldLabel htmlFor="notes">Notes</FieldLabel>
							<Input
								id="notes"
								value={note}
								onChange={(e) => setNote(e.target.value)}
								placeholder="Payment terms, IBAN, etc."
							/>
						</Field>
					</FieldGroup>
				</FramePanel>
				<FrameFooter className="justify-end">
					<Button type="submit" size="sm" disabled={saving}>
						{saving ? "Saving…" : "Save details"}
					</Button>
				</FrameFooter>
			</Frame>
		</form>
	);
}

type LineDoc = {
	_id: Id<"invoiceLines">;
	description: string;
	quantity: number;
	unitPrice: number;
	order: number;
};

function LinesEditor({
	invoiceId,
	lines,
	currency,
}: {
	invoiceId: Id<"invoices">;
	lines: LineDoc[];
	currency: string;
}) {
	const addLine = useMutation(api.invoices.addLine);
	const updateLine = useMutation(api.invoices.updateLine);
	const removeLine = useMutation(api.invoices.removeLine);

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Line items</FrameTitle>
					<FrameDescription>
						{lines.length} line{lines.length === 1 ? "" : "s"} on this invoice
					</FrameDescription>
				</FrameHeading>
			</FrameHeader>
			<FramePanel flush>
				<table className="w-full text-sm">
					<thead className="text-left text-xs text-muted-foreground [&_th]:border-b">
						<tr>
							<th className="px-4 py-3">Description</th>
							<th className="px-4 py-3 w-24">Qty</th>
							<th className="px-4 py-3 w-32">Unit price</th>
							<th className="px-4 py-3 w-32 text-right">Total</th>
							<th className="px-4 py-3 w-12" />
						</tr>
					</thead>
					<tbody className="divide-y">
						{lines.length === 0 ? (
							<tr>
								<td
									colSpan={5}
									className="px-4 py-6 text-center text-sm text-muted-foreground"
								>
									No lines yet. Add one below.
								</td>
							</tr>
						) : (
							lines.map((line) => (
								<tr key={line._id}>
									<td className="px-4 py-3">
										<input
											type="text"
											defaultValue={line.description}
											onBlur={(e) =>
												void updateLine({
													id: line._id,
													description: e.target.value,
												})
											}
											className="w-full bg-transparent outline-none"
										/>
									</td>
									<td className="px-4 py-3">
										<input
											type="number"
											defaultValue={line.quantity}
											onBlur={(e) =>
												void updateLine({
													id: line._id,
													quantity: Number(e.target.value) || 0,
												})
											}
											className="w-full bg-transparent outline-none"
										/>
									</td>
									<td className="px-4 py-3">
										<input
											type="number"
											step="0.01"
											defaultValue={(line.unitPrice / 100).toFixed(2)}
											onBlur={(e) =>
												void updateLine({
													id: line._id,
													unitPrice: Math.round(
														(Number(e.target.value) || 0) * 100,
													),
												})
											}
											className="w-full bg-transparent outline-none"
										/>
									</td>
									<td className="px-4 py-3 text-right font-mono">
										{fmtCurrency(line.quantity * line.unitPrice, currency)}
									</td>
									<td className="px-4 py-3 text-right">
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => void removeLine({ id: line._id })}
											aria-label="Remove line"
										>
											<Trash2Icon />
										</Button>
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</FramePanel>
			<FrameFooter className="py-2">
				<NewLineForm
					onAdd={async (description, quantity, unitPriceCents) => {
						try {
							await addLine({
								invoiceId,
								description,
								quantity,
								unitPrice: unitPriceCents,
							});
						} catch (err) {
							toast.error("Could not add line", {
								description: err instanceof Error ? err.message : String(err),
							});
						}
					}}
				/>
			</FrameFooter>
		</Frame>
	);
}

function NewLineForm({
	onAdd,
}: {
	onAdd: (
		description: string,
		quantity: number,
		cents: number,
	) => Promise<void>;
}) {
	const [description, setDescription] = useState("");
	const [quantity, setQuantity] = useState("1");
	const [unitPrice, setUnitPrice] = useState("");

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				if (!description.trim()) return;
				const qty = Number(quantity) || 0;
				const cents = Math.round((Number(unitPrice) || 0) * 100);
				await onAdd(description.trim(), qty, cents);
				setDescription("");
				setQuantity("1");
				setUnitPrice("");
			}}
			className="rounded-lg border bg-card p-4"
		>
			<FieldGroup>
				<div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_80px_120px_auto]">
					<Field>
						<FieldLabel htmlFor="line-desc" className="sr-only">
							Description
						</FieldLabel>
						<Input
							id="line-desc"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Description"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="line-qty" className="sr-only">
							Quantity
						</FieldLabel>
						<Input
							id="line-qty"
							type="number"
							value={quantity}
							onChange={(e) => setQuantity(e.target.value)}
							placeholder="Qty"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="line-price" className="sr-only">
							Unit price
						</FieldLabel>
						<Input
							id="line-price"
							type="number"
							step="0.01"
							value={unitPrice}
							onChange={(e) => setUnitPrice(e.target.value)}
							placeholder="Unit price"
						/>
					</Field>
					<Button type="submit" disabled={!description.trim()}>
						<PlusIcon data-icon="inline-start" />
						Add line
					</Button>
				</div>
			</FieldGroup>
		</form>
	);
}

function Totals({
	subtotal,
	vat,
	vatRate,
	total,
	currency,
}: {
	subtotal: number;
	vat: number;
	vatRate: number;
	total: number;
	currency: string;
}) {
	return (
		<Frame className="ml-auto w-full max-w-xs">
			<FramePanel className="space-y-2 text-sm">
				<Row
					label="Subtotaal excl. btw"
					value={fmtCurrency(subtotal, currency)}
				/>
				<Row label={`${vatRate}% btw`} value={fmtCurrency(vat, currency)} />
				<div className="border-t pt-2 text-base font-semibold">
					<Row label="Totaal" value={fmtCurrency(total, currency)} />
				</div>
			</FramePanel>
		</Frame>
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
