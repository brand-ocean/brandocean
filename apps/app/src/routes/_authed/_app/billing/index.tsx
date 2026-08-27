import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { GaugeIcon, PlusIcon, ServerIcon } from "lucide-react";
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
	FrameTitle,
} from "@/components/app/frame";
import { type Tone, TonePill } from "@/components/app/tone";
import { ToolbarSearch } from "@/components/app/toolbar";
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
import { Skeleton } from "@/components/ui/skeleton";
import { TableRow } from "@/components/ui/table";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/_authed/_app/billing/")({
	component: BillingPage,
});

type Row = {
	id: string;
	clientId: string;
	clientName: string;
	resourceCount: number;
	markup: number;
	billingIntervalMonths: number;
	status: string;
	hasMandate: boolean;
	mandateStatus: string | null;
};

function mandate(row: Row): { label: string; tone: Tone; id: string } {
	if (row.mandateStatus === "valid")
		return { label: "Mandaat actief", tone: "success", id: "valid" };
	if (row.hasMandate)
		return { label: "In behandeling", tone: "warning", id: "pending" };
	return { label: "Geen mandaat", tone: "danger", id: "none" };
}

function BillingPage() {
	const rows = useQuery(api.billing.api.list);
	const navigate = useNavigate();
	const [q, setQ] = useState("");

	const list: Row[] = useMemo(() => (rows ?? []) as Row[], [rows]);

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		if (!term) return list;
		return list.filter((r) => r.clientName.toLowerCase().includes(term));
	}, [list, q]);

	const columns: readonly Column<Row>[] = useMemo(
		() => [
			{
				id: "client",
				header: "Klant",
				sortValue: (r) => r.clientName,
				cell: (r) => (
					<div className="flex min-w-0 items-center gap-2.5">
						<span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
							<ServerIcon className="size-3.5" />
						</span>
						<span className="truncate font-medium">{r.clientName}</span>
					</div>
				),
			},
			{
				id: "resources",
				header: "Resources",
				sortValue: (r) => r.resourceCount,
				cell: (r) => (
					<span className="text-muted-foreground tabular-nums">
						{r.resourceCount} gekoppeld
					</span>
				),
			},
			{
				id: "markup",
				header: "Marge",
				sortValue: (r) => r.markup,
				cell: (r) => <span className="tabular-nums">{r.markup}×</span>,
			},
			{
				id: "interval",
				header: "Interval",
				sortValue: (r) => r.billingIntervalMonths,
				cell: (r) => (
					<span className="text-muted-foreground tabular-nums">
						per {r.billingIntervalMonths} mnd
					</span>
				),
			},
			{
				id: "status",
				header: "Status",
				sortValue: (r) => r.status,
				cell: (r) => (
					<TonePill dot tone={r.status === "active" ? "success" : "muted"}>
						{r.status}
					</TonePill>
				),
			},
			{
				id: "mandate",
				header: "Incasso",
				align: "right",
				sortValue: (r) => mandate(r).id,
				cell: (r) => {
					const m = mandate(r);
					return (
						<TonePill dot tone={m.tone}>
							{m.label}
						</TonePill>
					);
				},
			},
		],
		[],
	);

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Usage billing</FrameTitle>
					<FrameDescription>
						Bereken klanten hun echte Cloudflare- en Convex-verbruik door, met
						marge, en incasseer automatisch.
					</FrameDescription>
				</FrameHeading>
				<FrameActions>
					<ToolbarSearch
						value={q}
						onValueChange={setQ}
						placeholder="Zoek klant…"
					/>
					<EnrollDialog />
				</FrameActions>
			</FrameHeader>
			<DataTable
				rows={filtered}
				columns={columns}
				getRowKey={(r) => r.id}
				loading={rows === undefined}
				noun="klanten"
				defaultSort={{ id: "client", dir: "asc" }}
				renderRow={(row, cells) => (
					<TableRow
						className="cursor-pointer"
						onClick={() =>
							void navigate({
								to: "/billing/$billingClientId",
								params: { billingClientId: row.id },
							})
						}
					>
						{cells}
					</TableRow>
				)}
				empty={
					<EmptyState
						icon={GaugeIcon}
						title={q ? "Geen klant gevonden" : "Nog geen klanten op verbruik"}
						description={
							q
								? "Probeer een andere naam."
								: "Meld een klant aan, koppel hun Workers, zones en Convex-deployments, en het verbruik wordt automatisch gemeten."
						}
						action={q ? null : <EnrollDialog />}
					/>
				}
			/>
		</Frame>
	);
}

function EnrollDialog() {
	const clientFieldId = useId();
	const clients = useQuery(api.clients.list);
	const enrolled = useQuery(api.billing.api.list);
	const enroll = useMutation(api.billing.api.enroll);
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [clientId, setClientId] = useState<string>("");
	const [saving, setSaving] = useState(false);

	// Only offer clients that aren't already on usage billing.
	const available = useMemo(() => {
		if (!clients) return [];
		const taken = new Set((enrolled ?? []).map((e) => e.clientId));
		return clients.filter((c) => !taken.has(c._id));
	}, [clients, enrolled]);

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) setClientId("");
			}}
		>
			<DialogTrigger render={<Button size="sm" />}>
				<PlusIcon data-icon="inline-start" />
				Klant aanmelden
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Klant op verbruik zetten</DialogTitle>
					<DialogDescription>
						Kies een bestaande klant. Daarna koppel je hun infra en start je de
						incasso.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						if (!clientId) return;
						setSaving(true);
						try {
							const id = await enroll({
								clientId: clientId as (typeof available)[number]["_id"],
							});
							setOpen(false);
							navigate({
								to: "/billing/$billingClientId",
								params: { billingClientId: id },
							});
						} catch (err) {
							toast.error("Aanmelden mislukt", {
								description: err instanceof Error ? err.message : String(err),
							});
						} finally {
							setSaving(false);
						}
					}}
					className="space-y-6"
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={clientFieldId}>Klant</FieldLabel>
							{clients === undefined ? (
								<Skeleton className="h-9" />
							) : available.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									Alle klanten staan al op verbruik. Maak eerst een nieuwe klant
									aan onder Clients.
								</p>
							) : (
								<Select
									value={clientId}
									onValueChange={(v) => setClientId(v ?? "")}
								>
									<SelectTrigger id={clientFieldId}>
										<SelectValue placeholder="Kies een klant…" />
									</SelectTrigger>
									<SelectContent>
										{available.map((c) => (
											<SelectItem key={c._id} value={c._id}>
												{c.name}
												{c.companyName ? ` · ${c.companyName}` : ""}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</Field>
					</FieldGroup>
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" />}>
							Annuleren
						</DialogClose>
						<Button type="submit" disabled={saving || !clientId}>
							{saving ? "Aanmelden…" : "Aanmelden"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
