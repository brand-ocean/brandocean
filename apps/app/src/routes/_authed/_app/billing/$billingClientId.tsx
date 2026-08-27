import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
	ArrowLeftIcon,
	CreditCardIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	Frame,
	FrameActions,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FrameTitle,
} from "@/components/app/frame";
import { usePageTitle } from "@/components/app/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/billing/$billingClientId")({
	component: BillingDetailPage,
});

const RESOURCE_KINDS = [
	{ value: "cf_worker", label: "Cloudflare Worker", hint: "scriptnaam" },
	{ value: "cf_zone", label: "Cloudflare Zone", hint: "zone-id (tag)" },
	{
		value: "cx_deployment",
		label: "Convex deployment",
		hint: "deployment-naam",
	},
] as const;

function kindLabel(kind: string): string {
	return RESOURCE_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

function eur(cents: number, currency = "EUR"): string {
	return new Intl.NumberFormat("nl-NL", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

function formatQuantity(unit: string, qty: number): string {
	if (unit === "byte" || unit === "byte-day") {
		const suffix = unit === "byte-day" ? "·dag" : "";
		const units = ["B", "KB", "MB", "GB", "TB", "PB"];
		let n = qty;
		let i = 0;
		while (n >= 1024 && i < units.length - 1) {
			n /= 1024;
			i += 1;
		}
		return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}${suffix}`;
	}
	if (unit === "GB-hour") return `${qty.toFixed(3)} GB-uur`;
	return new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 }).format(
		qty,
	);
}

function BillingDetailPage() {
	const { billingClientId } = Route.useParams();
	const id = billingClientId as Id<"billingClients">;

	const rows = useQuery(api.billing.api.list);
	const record = rows?.find((r) => r.id === id) ?? null;
	usePageTitle(record?.clientName);

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-4.5">
			<Link
				to="/billing"
				className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<ArrowLeftIcon className="size-4" />
				Terug
			</Link>

			{rows === undefined ? (
				<Skeleton className="h-24" />
			) : record === null ? (
				<p className="text-muted-foreground">Niet gevonden.</p>
			) : (
				<>
					<Frame>
						<FrameHeader>
							<FrameHeading>
								<FrameTitle>{record.clientName}</FrameTitle>
								<FrameDescription>
									Markup {record.markup}× · incasso per{" "}
									{record.billingIntervalMonths} maand
									{record.billingIntervalMonths === 1 ? "" : "en"} · minimum{" "}
									{eur(record.minChargeCents)}
								</FrameDescription>
							</FrameHeading>
							<FrameActions>
								<SettingsDialog id={id} record={record} />
							</FrameActions>
						</FrameHeader>
					</Frame>

					<MandateCard id={id} record={record} />
					<ResourcesCard id={id} />
					<UsageCard id={id} />
					<InvoicesCard id={id} />
				</>
			)}
		</div>
	);
}

type Record = FunctionReturnType<typeof api.billing.api.list>[number];

function MandateCard({
	id,
	record,
}: {
	id: Id<"billingClients">;
	record: Record;
}) {
	const startOnboarding = useAction(api.billing.stripe.startOnboarding);
	const [starting, setStarting] = useState(false);

	const valid = record.mandateStatus === "valid";

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<CreditCardIcon className="size-5" />
					Betaalmethode
				</CardTitle>
				<CardDescription>
					Stripe int het bedrag automatisch zodra de klant één keer een kaart of
					SEPA-mandaat heeft opgeslagen.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-wrap items-center justify-between gap-4">
				<div className="flex items-center gap-2">
					{valid ? (
						<Badge>Mandaat actief</Badge>
					) : record.hasMandate ? (
						<Badge variant="secondary">In behandeling</Badge>
					) : (
						<Badge variant="destructive">Nog geen mandaat</Badge>
					)}
				</div>
				{!valid && (
					<Button
						disabled={starting}
						onClick={async () => {
							setStarting(true);
							try {
								const { checkoutUrl } = await startOnboarding({
									billingClientId: id,
								});
								window.open(checkoutUrl, "_blank", "noopener");
								toast.success("Stripe-checkout geopend", {
									description:
										"Laat de klant de betaalmethode opslaan om incasso te activeren.",
								});
							} catch (err) {
								toast.error("Kon incasso niet starten", {
									description: err instanceof Error ? err.message : String(err),
								});
							} finally {
								setStarting(false);
							}
						}}
					>
						{starting
							? "Bezig…"
							: record.hasMandate
								? "Opnieuw proberen"
								: "Incasso starten"}
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

function ResourcesCard({ id }: { id: Id<"billingClients"> }) {
	const resources = useQuery(api.billing.api.listResources, {
		billingClientId: id,
	});
	const remove = useMutation(api.billing.api.removeResource);

	return (
		<Card>
			<CardHeader className="flex flex-row items-start justify-between gap-4">
				<div className="space-y-1.5">
					<CardTitle>Gekoppelde infra</CardTitle>
					<CardDescription>
						De Workers, zones en Convex-deployments waarvan het verbruik aan
						deze klant wordt toegerekend.
					</CardDescription>
				</div>
				<AddResourceDialog id={id} />
			</CardHeader>
			<CardContent>
				{resources === undefined ? (
					<Skeleton className="h-16" />
				) : resources.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Nog niks gekoppeld. Voeg minstens één Worker, zone of deployment
						toe.
					</p>
				) : (
					<ul className="divide-y rounded-md border">
						{resources.map((r) => (
							<li
								key={r._id}
								className="flex items-center justify-between gap-4 px-4 py-3"
							>
								<div className="flex min-w-0 flex-col">
									<span className="truncate font-medium">
										{r.label || r.identifier}
									</span>
									<span className="text-xs text-muted-foreground">
										{kindLabel(r.kind)} · {r.identifier}
									</span>
								</div>
								<Button
									variant="ghost"
									size="icon"
									onClick={async () => {
										try {
											await remove({ id: r._id });
										} catch (err) {
											toast.error("Verwijderen mislukt", {
												description:
													err instanceof Error ? err.message : String(err),
											});
										}
									}}
								>
									<Trash2Icon className="size-4" />
								</Button>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

function AddResourceDialog({ id }: { id: Id<"billingClients"> }) {
	const add = useMutation(api.billing.api.addResource);
	const [open, setOpen] = useState(false);
	const [kind, setKind] =
		useState<(typeof RESOURCE_KINDS)[number]["value"]>("cf_worker");
	const [identifier, setIdentifier] = useState("");
	const [label, setLabel] = useState("");
	const [saving, setSaving] = useState(false);

	const hint = RESOURCE_KINDS.find((k) => k.value === kind)?.hint ?? "";

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) {
					setIdentifier("");
					setLabel("");
				}
			}}
		>
			<DialogTrigger render={<Button size="sm" variant="outline" />}>
				<PlusIcon data-icon="inline-start" />
				Koppelen
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Infra koppelen</DialogTitle>
					<DialogDescription>
						Kies het type en vul de exacte identifier in.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						if (!identifier.trim()) return;
						setSaving(true);
						try {
							await add({
								billingClientId: id,
								kind,
								identifier: identifier.trim(),
								label: label.trim() || undefined,
							});
							setOpen(false);
							setIdentifier("");
							setLabel("");
						} catch (err) {
							toast.error("Koppelen mislukt", {
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
							<FieldLabel htmlFor="res-kind">Type</FieldLabel>
							<Select
								value={kind}
								onValueChange={(v) =>
									setKind(v as (typeof RESOURCE_KINDS)[number]["value"])
								}
							>
								<SelectTrigger id="res-kind">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{RESOURCE_KINDS.map((k) => (
										<SelectItem key={k.value} value={k.value}>
											{k.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor="res-id">Identifier ({hint})</FieldLabel>
							<Input
								id="res-id"
								value={identifier}
								onChange={(e) => setIdentifier(e.target.value)}
								placeholder={hint}
								autoFocus
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="res-label">Label (optioneel)</FieldLabel>
							<Input
								id="res-label"
								value={label}
								onChange={(e) => setLabel(e.target.value)}
								placeholder="bijv. Hoofdsite"
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" />}>
							Annuleren
						</DialogClose>
						<Button type="submit" disabled={saving || !identifier.trim()}>
							{saving ? "Koppelen…" : "Koppelen"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function UsageCard({ id }: { id: Id<"billingClients"> }) {
	const usage = useQuery(api.billing.api.currentUsage, { billingClientId: id });

	return (
		<Card>
			<CardHeader>
				<CardTitle>Verbruik lopende periode</CardTitle>
				<CardDescription>
					{usage ? `Sinds ${usage.periodStart}` : "Live meterstanden"}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{usage === undefined ? (
					<Skeleton className="h-24" />
				) : usage === null ? (
					<p className="text-sm text-muted-foreground">Geen data.</p>
				) : usage.lines.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						Nog geen verbruik gemeten deze periode.
					</p>
				) : (
					<div className="space-y-4">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Metric</TableHead>
									<TableHead className="text-right">Hoeveelheid</TableHead>
									<TableHead className="text-right">Kostprijs</TableHead>
									<TableHead className="text-right">Doorbelast</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{usage.lines.map((l) => (
									<TableRow key={l.metric}>
										<TableCell>{l.label}</TableCell>
										<TableCell className="text-right tabular-nums">
											{formatQuantity(l.unit, l.quantity)}
										</TableCell>
										<TableCell className="text-right tabular-nums text-muted-foreground">
											{eur(l.costCents, usage.currency)}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{eur(l.amountCents, usage.currency)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						<div className="space-y-1 border-t pt-4 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">
									Verbruik deze periode
								</span>
								<span className="tabular-nums">
									{eur(usage.usageCents, usage.currency)}
								</span>
							</div>
							{usage.carryoverCents > 0 && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">
										Doorgeschoven vorige periode
									</span>
									<span className="tabular-nums">
										{eur(usage.carryoverCents, usage.currency)}
									</span>
								</div>
							)}
							<div className="flex justify-between font-medium">
								<span>Verwacht te incasseren</span>
								<span className="tabular-nums">
									{eur(usage.projectedTotalCents, usage.currency)}
								</span>
							</div>
							{usage.projectedTotalCents < usage.minChargeCents && (
								<p className="pt-1 text-xs text-muted-foreground">
									Onder het minimum van{" "}
									{eur(usage.minChargeCents, usage.currency)}— schuift door naar
									de volgende periode.
								</p>
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function invoiceBadge(status: string): {
	label: string;
	variant: "default" | "secondary" | "destructive" | "outline";
} {
	switch (status) {
		case "paid":
			return { label: "Betaald", variant: "default" };
		case "pending":
			return { label: "In behandeling", variant: "secondary" };
		case "failed":
			return { label: "Mislukt", variant: "destructive" };
		default:
			return { label: "Doorgeschoven", variant: "outline" };
	}
}

function InvoicesCard({ id }: { id: Id<"billingClients"> }) {
	const invoices = useQuery(api.billing.api.listInvoices, {
		billingClientId: id,
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Facturen</CardTitle>
				<CardDescription>Afgesloten periodes en hun incasso.</CardDescription>
			</CardHeader>
			<CardContent>
				{invoices === undefined ? (
					<Skeleton className="h-16" />
				) : invoices.length === 0 ? (
					<p className="text-sm text-muted-foreground">Nog geen facturen.</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Periode</TableHead>
								<TableHead className="text-right">Bedrag</TableHead>
								<TableHead className="text-right">Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{invoices.map((inv) => {
								const badge = invoiceBadge(inv.status);
								const amount =
									inv.status === "carried"
										? inv.carryOutCents
										: inv.chargedCents;
								return (
									<TableRow key={inv._id}>
										<TableCell className="tabular-nums">
											{inv.periodStart} → {inv.periodEnd}
										</TableCell>
										<TableCell className="text-right tabular-nums">
											{eur(amount, inv.currency)}
										</TableCell>
										<TableCell className="text-right">
											<Badge variant={badge.variant}>{badge.label}</Badge>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}

function SettingsDialog({
	id,
	record,
}: {
	id: Id<"billingClients">;
	record: Record;
}) {
	const update = useMutation(api.billing.api.updateSettings);
	const [open, setOpen] = useState(false);
	const [markup, setMarkup] = useState(String(record.markup));
	const [interval, setInterval] = useState(
		String(record.billingIntervalMonths),
	);
	const [minEuro, setMinEuro] = useState(
		(record.minChargeCents / 100).toFixed(2),
	);
	const [saving, setSaving] = useState(false);

	const paused = record.status === "paused";

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (v) {
					setMarkup(String(record.markup));
					setInterval(String(record.billingIntervalMonths));
					setMinEuro((record.minChargeCents / 100).toFixed(2));
				}
			}}
		>
			<DialogTrigger render={<Button variant="outline" />}>
				Instellingen
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Billing-instellingen</DialogTitle>
					<DialogDescription>
						Marge, incasso-interval en de minimumdrempel voor{" "}
						{record.clientName}.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						setSaving(true);
						try {
							const markupNum = Number.parseFloat(markup);
							const intervalNum = Math.max(
								1,
								Math.round(Number.parseFloat(interval) || 1),
							);
							const minCents = Math.max(
								0,
								Math.round((Number.parseFloat(minEuro) || 0) * 100),
							);
							await update({
								id,
								markup: Number.isFinite(markupNum) ? markupNum : undefined,
								billingIntervalMonths: intervalNum,
								minChargeCents: minCents,
							});
							setOpen(false);
						} catch (err) {
							toast.error("Opslaan mislukt", {
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
							<FieldLabel htmlFor="set-markup">Markup (×)</FieldLabel>
							<Input
								id="set-markup"
								type="number"
								step="0.1"
								min="1"
								value={markup}
								onChange={(e) => setMarkup(e.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="set-interval">
								Incasso-interval (maanden)
							</FieldLabel>
							<Input
								id="set-interval"
								type="number"
								step="1"
								min="1"
								value={interval}
								onChange={(e) => setInterval(e.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="set-min">Minimumbedrag (€)</FieldLabel>
							<Input
								id="set-min"
								type="number"
								step="0.01"
								min="0"
								value={minEuro}
								onChange={(e) => setMinEuro(e.target.value)}
							/>
						</Field>
					</FieldGroup>
					<DialogFooter className="sm:justify-between">
						<Button
							type="button"
							variant={paused ? "default" : "outline"}
							onClick={async () => {
								try {
									await update({
										id,
										status: paused ? "active" : "paused",
									});
									toast.success(paused ? "Hervat" : "Gepauzeerd");
								} catch (err) {
									toast.error("Mislukt", {
										description:
											err instanceof Error ? err.message : String(err),
									});
								}
							}}
						>
							{paused ? "Hervatten" : "Pauzeren"}
						</Button>
						<div className="flex gap-2">
							<DialogClose render={<Button type="button" variant="outline" />}>
								Annuleren
							</DialogClose>
							<Button type="submit" disabled={saving}>
								{saving ? "Opslaan…" : "Opslaan"}
							</Button>
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
