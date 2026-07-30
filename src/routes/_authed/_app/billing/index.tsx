import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { GaugeIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/_authed/_app/billing/")({
	component: BillingPage,
});

function mandateBadge(
	mandateStatus: string | null,
	hasMandate: boolean,
): { label: string; variant: "default" | "secondary" | "destructive" } {
	if (mandateStatus === "valid") return { label: "Mandaat actief", variant: "default" };
	if (hasMandate) return { label: "Mandaat in behandeling", variant: "secondary" };
	return { label: "Geen mandaat", variant: "destructive" };
}

function BillingPage() {
	const rows = useQuery(api.billing.api.list);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-10">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-2">
					<h1 className="text-3xl font-semibold tracking-tight">
						Usage billing
					</h1>
					<p className="text-base text-muted-foreground">
						Bereken klanten hun echte Cloudflare- en Convex-verbruik door, met
						marge, en incasseer automatisch via Stripe.
					</p>
				</div>
				<EnrollDialog />
			</header>

			{rows === undefined ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-16" />
					<Skeleton className="h-16" />
					<Skeleton className="h-16" />
				</div>
			) : rows.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<GaugeIcon />
						</EmptyMedia>
						<EmptyTitle>Nog geen klanten op verbruik</EmptyTitle>
						<EmptyDescription>
							Meld een klant aan met de knop hierboven, koppel hun Workers,
							zones en Convex-deployments, en het verbruik wordt automatisch
							gemeten.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="divide-y rounded-lg border bg-card">
					{rows.map((r) => {
						const badge = mandateBadge(r.mandateStatus, r.hasMandate);
						return (
							<li key={r.id}>
								<Link
									to="/billing/$billingClientId"
									params={{ billingClientId: r.id }}
									className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-muted/50"
								>
									<div className="flex min-w-0 flex-col gap-1">
										<span className="truncate text-base font-medium">
											{r.clientName}
										</span>
										<span className="text-sm text-muted-foreground">
											{r.resourceCount}{" "}
											{r.resourceCount === 1 ? "resource" : "resources"} ·
											markup {r.markup}× · per {r.billingIntervalMonths} mnd
										</span>
									</div>
									<div className="flex items-center gap-2">
										{r.status !== "active" && (
											<Badge variant="outline">{r.status}</Badge>
										)}
										<Badge variant={badge.variant}>{badge.label}</Badge>
									</div>
								</Link>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

function EnrollDialog() {
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
			<DialogTrigger render={<Button />}>
				<PlusIcon data-icon="inline-start" />
				Klant aanmelden
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Klant op verbruik zetten</DialogTitle>
					<DialogDescription>
						Kies een bestaande klant. Daarna koppel je hun infra en start je de
						Stripe-incasso.
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
							<FieldLabel htmlFor="enroll-client">Klant</FieldLabel>
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
									<SelectTrigger id="enroll-client">
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
