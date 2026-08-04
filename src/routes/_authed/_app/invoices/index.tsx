import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	BanknoteIcon,
	ClockIcon,
	PlusIcon,
	ReceiptIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { type Column, DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import {
	Frame,
	FrameActions,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { StatStrip } from "@/components/app/stat-strip";
import { type Tone, TonePill } from "@/components/app/tone";
import { CountTabs, ToolbarSearch } from "@/components/app/toolbar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TableRow } from "@/components/ui/table";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/invoices/")({
	component: InvoicesPage,
});

type Status = "draft" | "sent" | "paid" | "overdue" | "void";

const STATUS_LABEL: Record<Status, string> = {
	draft: "Draft",
	sent: "Sent",
	paid: "Paid",
	overdue: "Overdue",
	void: "Void",
};

const STATUS_TONE: Record<Status, Tone> = {
	draft: "muted",
	sent: "info",
	paid: "success",
	overdue: "danger",
	void: "muted",
};

type Row = {
	_id: Id<"invoices">;
	number: string;
	status: Status;
	clientName: string;
	issuedAt: number;
	dueAt: number;
	total: number;
	currency: string;
	lineCount: number;
	pastDue: boolean;
};

function money(cents: number, currency: string) {
	return new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(
		cents / 100,
	);
}

function InvoicesPage() {
	const invoices = useQuery(api.invoices.listByOwner, {});
	const clients = useQuery(api.clients.list);
	const navigate = useNavigate();
	const [q, setQ] = useState("");
	const [tab, setTab] = useState("all");

	const clientName = useMemo(
		() => new Map((clients ?? []).map((c) => [c._id, c.name])),
		[clients],
	);

	const now = Date.now();
	const rows: Row[] = useMemo(
		() =>
			(invoices ?? []).map((inv) => ({
				_id: inv._id,
				number: inv.number,
				status: inv.status,
				clientName: clientName.get(inv.clientId) ?? "Unknown client",
				issuedAt: inv.issuedAt,
				dueAt: inv.dueAt,
				total: inv.total,
				currency: inv.currency,
				lineCount: inv.lineCount,
				pastDue:
					(inv.status === "sent" || inv.status === "overdue") &&
					inv.dueAt < now,
			})),
		[invoices, clientName, now],
	);

	const currency = rows[0]?.currency ?? "EUR";
	const totals = useMemo(() => {
		const paid = rows
			.filter((r) => r.status === "paid")
			.reduce((a, r) => a + r.total, 0);
		const open = rows
			.filter((r) => r.status === "sent" || r.status === "overdue")
			.reduce((a, r) => a + r.total, 0);
		const overdue = rows
			.filter((r) => r.pastDue)
			.reduce((a, r) => a + r.total, 0);
		const drafted = rows
			.filter((r) => r.status === "draft")
			.reduce((a, r) => a + r.total, 0);
		return { paid, open, overdue, drafted };
	}, [rows]);

	const counts = useMemo(
		() => ({
			all: rows.length,
			open: rows.filter((r) => r.status === "sent" || r.status === "overdue")
				.length,
			paid: rows.filter((r) => r.status === "paid").length,
			draft: rows.filter((r) => r.status === "draft").length,
		}),
		[rows],
	);

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		return rows.filter((r) => {
			if (tab === "open" && r.status !== "sent" && r.status !== "overdue")
				return false;
			if (tab === "paid" && r.status !== "paid") return false;
			if (tab === "draft" && r.status !== "draft") return false;
			if (!term) return true;
			return (
				r.number.toLowerCase().includes(term) ||
				r.clientName.toLowerCase().includes(term)
			);
		});
	}, [rows, q, tab]);

	const columns: readonly Column<Row>[] = useMemo(
		() => [
			{
				id: "number",
				header: "Invoice",
				sortValue: (r) => r.number,
				cell: (r) => (
					<div className="flex min-w-0 items-center gap-2.5">
						<span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
							<ReceiptIcon className="size-3.5" />
						</span>
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-medium">{r.number}</span>
							<span className="text-xs text-muted-foreground">
								{r.lineCount} line{r.lineCount === 1 ? "" : "s"}
							</span>
						</div>
					</div>
				),
			},
			{
				id: "client",
				header: "Client",
				sortValue: (r) => r.clientName,
				cell: (r) => r.clientName,
			},
			{
				id: "issued",
				header: "Issued",
				sortValue: (r) => r.issuedAt,
				cell: (r) => (
					<span className="text-muted-foreground tabular-nums">
						{new Date(r.issuedAt).toLocaleDateString()}
					</span>
				),
			},
			{
				id: "due",
				header: "Due",
				sortValue: (r) => r.dueAt,
				cell: (r) => (
					<span
						className={
							r.pastDue
								? "font-medium text-destructive tabular-nums"
								: "text-muted-foreground tabular-nums"
						}
					>
						{new Date(r.dueAt).toLocaleDateString()}
					</span>
				),
			},
			{
				id: "status",
				header: "Status",
				sortValue: (r) => r.status,
				cell: (r) => {
					const status: Status = r.pastDue ? "overdue" : r.status;
					return (
						<TonePill dot tone={STATUS_TONE[status]}>
							{STATUS_LABEL[status]}
						</TonePill>
					);
				},
			},
			{
				id: "total",
				header: "Total",
				align: "right",
				sortValue: (r) => r.total,
				cell: (r) => (
					<span className="font-medium tabular-nums">
						{money(r.total, r.currency)}
					</span>
				),
			},
		],
		[],
	);

	return (
		<>
			<Frame>
				<FramePanel>
					<StatStrip
						loading={invoices === undefined}
						items={[
							{
								label: "Paid",
								icon: BanknoteIcon,
								value: money(totals.paid, currency),
								hint: `${counts.paid} invoice${counts.paid === 1 ? "" : "s"}`,
							},
							{
								label: "Outstanding",
								icon: ClockIcon,
								value: money(totals.open, currency),
								hint: `${counts.open} awaiting payment`,
							},
							{
								label: "Past due",
								icon: TriangleAlertIcon,
								value: money(totals.overdue, currency),
								hint:
									totals.overdue > 0 ? "chase these first" : "nothing overdue",
							},
							{
								label: "In draft",
								icon: ReceiptIcon,
								value: money(totals.drafted, currency),
								hint: `${counts.draft} not sent yet`,
							},
						]}
					/>
				</FramePanel>
			</Frame>

			<Frame>
				<FrameHeader>
					<FrameHeading>
						<FrameTitle>Invoices</FrameTitle>
						<FrameDescription>
							Bill clients, mark paid, share a link.
						</FrameDescription>
					</FrameHeading>
					<FrameActions>
						<ToolbarSearch
							value={q}
							onValueChange={setQ}
							placeholder="Search by number or client…"
						/>
						<NewInvoiceDialog />
					</FrameActions>
				</FrameHeader>
				<CountTabs
					value={tab}
					onValueChange={setTab}
					tabs={[
						{ id: "all", label: "All", count: counts.all },
						{ id: "open", label: "Outstanding", count: counts.open },
						{ id: "paid", label: "Paid", count: counts.paid },
						{ id: "draft", label: "Drafts", count: counts.draft },
					]}
				/>
				<DataTable
					rows={filtered}
					columns={columns}
					getRowKey={(r) => r._id}
					loading={invoices === undefined}
					noun="invoices"
					defaultSort={{ id: "issued", dir: "desc" }}
					renderRow={(row, cells) => (
						<TableRow
							className="cursor-pointer"
							onClick={() =>
								void navigate({
									to: "/invoices/$invoiceId",
									params: { invoiceId: row._id },
								})
							}
						>
							{cells}
						</TableRow>
					)}
					empty={
						<EmptyState
							icon={ReceiptIcon}
							title={q || tab !== "all" ? "Nothing here" : "No invoices yet"}
							description={
								q || tab !== "all"
									? "Try another search or switch tab."
									: "Create one for any client. Mark it Sent when you email it, Paid when the money lands."
							}
							action={q || tab !== "all" ? null : <NewInvoiceDialog />}
						/>
					}
				/>
			</Frame>
		</>
	);
}

function NewInvoiceDialog() {
	const clientFieldId = useId();
	const create = useMutation(api.invoices.create);
	const clients = useQuery(api.clients.list);
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [clientId, setClientId] = useState<string>("");
	const [creating, setCreating] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button size="sm" />}>
				<PlusIcon data-icon="inline-start" />
				New invoice
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New invoice</DialogTitle>
					<DialogDescription>
						Pick a client. You can add line items and edit the dates after.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						if (!clientId) return;
						setCreating(true);
						try {
							const id = await create({
								clientId: clientId as Id<"clients">,
							});
							setOpen(false);
							setClientId("");
							navigate({
								to: "/invoices/$invoiceId",
								params: { invoiceId: id },
							});
						} catch (err) {
							toast.error("Could not create invoice", {
								description: err instanceof Error ? err.message : String(err),
							});
						} finally {
							setCreating(false);
						}
					}}
					className="space-y-6"
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={clientFieldId}>Client</FieldLabel>
							<Select
								value={clientId}
								onValueChange={(v) => setClientId(v ?? "")}
							>
								<SelectTrigger id={clientFieldId}>
									<SelectValue placeholder="Choose a client…" />
								</SelectTrigger>
								<SelectContent>
									{(clients ?? []).map((c) => (
										<SelectItem key={c._id} value={c._id}>
											{c.name}
											{c.companyName ? ` · ${c.companyName}` : ""}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" />}>
							Cancel
						</DialogClose>
						<Button type="submit" disabled={creating || !clientId}>
							{creating ? "Creating…" : "Create draft"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
