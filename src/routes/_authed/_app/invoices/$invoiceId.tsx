import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { CheckIcon, CopyIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/invoices/$invoiceId")({
	component: InvoiceEditor,
});

const STATUSES = ["draft", "sent", "paid", "overdue", "void"] as const;
type Status = (typeof STATUSES)[number];

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

	if (data === undefined) {
		return (
			<div className="mx-auto max-w-4xl space-y-6">
				<Skeleton className="h-10 w-2/3" />
				<Skeleton className="h-40" />
			</div>
		)
	}

	if (data === null) {
		return (
			<div className="mx-auto max-w-4xl space-y-3">
				<h1 className="text-2xl font-semibold">Invoice not found</h1>
				<Button render={<Link to="/invoices" />} variant="outline">
					Back to invoices
				</Button>
			</div>
		)
	}

	const { invoice, lines } = data;
	const client = (clients ?? []).find((c) => c._id === invoice.clientId);
	const subtotal = lines.reduce(
		(acc, l) => acc + l.quantity * l.unitPrice,
		0,
	)
	const vat = Math.round((subtotal * invoice.vatRate) / 100);
	const total = subtotal + vat;

	return (
		<div className="mx-auto w-full max-w-4xl space-y-10">
			<InvoiceHeader
				invoiceId={id}
				number={invoice.number}
				status={invoice.status as Status}
				clientName={client?.name ?? "Unknown client"}
				clientId={invoice.clientId}
				slug={invoice.slug}
				token={invoice.shareToken}
			/>
			<MetaForm
				invoiceId={id}
				issuedAt={invoice.issuedAt}
				dueAt={invoice.dueAt}
				vatRate={invoice.vatRate}
				currency={invoice.currency}
				notes={invoice.notes ?? ""}
			/>
			<LinesEditor invoiceId={id} lines={lines} currency={invoice.currency} />
			<Totals
				subtotal={subtotal}
				vat={vat}
				vatRate={invoice.vatRate}
				total={total}
				currency={invoice.currency}
			/>
		</div>
	)
}

function InvoiceHeader({
	invoiceId,
	number,
	status,
	clientName,
	clientId,
	slug,
	token,
}: {
	invoiceId: Id<"invoices">;
	number: string;
	status: Status;
	clientName: string;
	clientId: Id<"clients">;
	slug: string;
	token: string;
}) {
	const setStatus = useMutation(api.invoices.setStatus);
	const remove = useMutation(api.invoices.remove);
	const [copied, setCopied] = useState(false);
	const shareUrl =
		typeof window !== "undefined"
			? `${window.location.origin}/i/${slug}?t=${token}`
			: `/i/${slug}?t=${token}`;

	return (
		<header className="flex flex-wrap items-start justify-between gap-4">
			<div className="flex flex-col gap-1">
				<h1 className="text-3xl font-semibold tracking-tight">{number}</h1>
				<p className="text-base text-muted-foreground">
					For{" "}
					<Link
						to="/clients/$clientId"
						params={{ clientId }}
						className="underline"
					>
						{clientName}
					</Link>
				</p>
			</div>
			<div className="flex items-center gap-2">
				<Badge variant="outline">{status}</Badge>
				<select
					value={status}
					onChange={(e) =>
						void setStatus({ id: invoiceId, status: e.target.value as Status })
					}
					className="rounded-md border bg-background px-2 py-1 text-sm"
				>
					{STATUSES.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
				<Button
					type="button"
					variant="outline"
					onClick={async () => {
						try {
							await navigator.clipboard.writeText(shareUrl);
							setCopied(true)
							toast.success("Link copied");
							setTimeout(() => setCopied(false), 1500);
						} catch (err) {
							toast.error("Could not copy", {
								description: err instanceof Error ? err.message : String(err),
							})
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
				<Button
					type="button"
					variant="outline"
					onClick={async () => {
						if (!window.confirm(`Delete ${number}?`)) return;
						try {
							await remove({ id: invoiceId });
							window.history.back();
						} catch (err) {
							toast.error("Could not delete", {
								description: err instanceof Error ? err.message : String(err),
							})
						}
					}}
				>
					<Trash2Icon data-icon="inline-start" />
					Delete
				</Button>
			</div>
		</header>
	)
}

function MetaForm({
	invoiceId,
	issuedAt,
	dueAt,
	vatRate,
	currency,
	notes,
}: {
	invoiceId: Id<"invoices">;
	issuedAt: number;
	dueAt: number;
	vatRate: number;
	currency: string;
	notes: string;
}) {
	const update = useMutation(api.invoices.update);
	const [issued, setIssued] = useState(toIsoDate(issuedAt));
	const [due, setDue] = useState(toIsoDate(dueAt));
	const [rate, setRate] = useState(String(vatRate));
	const [curr, setCurr] = useState(currency);
	const [note, setNote] = useState(notes);
	const [saving, setSaving] = useState(false);

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
					})
					toast.success("Saved");
				} catch (err) {
					toast.error("Could not save", {
						description: err instanceof Error ? err.message : String(err),
					})
				} finally {
					setSaving(false);
				}
			}}
			className="rounded-lg border bg-card p-5"
		>
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
			<div className="mt-4">
				<Button type="submit" disabled={saving}>
					{saving ? "Saving…" : "Save details"}
				</Button>
			</div>
		</form>
	)
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
		<div className="space-y-4">
			<h2 className="text-base font-semibold">Line items</h2>
			<div className="overflow-hidden rounded-lg border bg-card">
				<table className="w-full text-sm">
					<thead className="bg-muted/50 text-left text-xs text-muted-foreground">
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
			</div>
			<NewLineForm
				onAdd={async (description, quantity, unitPriceCents) => {
					try {
						await addLine({
							invoiceId,
							description,
							quantity,
							unitPrice: unitPriceCents,
						})
					} catch (err) {
						toast.error("Could not add line", {
							description: err instanceof Error ? err.message : String(err),
						})
					}
				}}
			/>
		</div>
	)
}

function NewLineForm({
	onAdd,
}: {
	onAdd: (description: string, quantity: number, cents: number) => Promise<void>;
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
	)
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
		<div className="ml-auto w-full max-w-xs space-y-2 rounded-lg border bg-card p-5 text-sm">
			<Row label="Subtotal" value={fmtCurrency(subtotal, currency)} />
			<Row label={`VAT (${vatRate}%)`} value={fmtCurrency(vat, currency)} />
			<div className="border-t pt-2 text-base font-semibold">
				<Row label="Total" value={fmtCurrency(total, currency)} />
			</div>
		</div>
	)
}

function Row({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-muted-foreground">{label}</span>
			<span className="font-mono">{value}</span>
		</div>
	)
}
