import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { PlusIcon, ReceiptIcon } from "lucide-react";
import { useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/invoices/")({
	component: InvoicesPage,
});

const STATUS_LABEL: Record<string, string> = {
	draft: "Draft",
	sent: "Sent",
	paid: "Paid",
	overdue: "Overdue",
	void: "Void",
};

const STATUS_VARIANT: Record<
	string,
	"outline" | "secondary" | "default" | "destructive"
> = {
	draft: "outline",
	sent: "secondary",
	paid: "default",
	overdue: "destructive",
	void: "outline",
};

function fmtCurrency(cents: number, currency: string) {
	return new Intl.NumberFormat("en-NL", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

function InvoicesPage() {
	const invoices = useQuery(api.invoices.listByOwner, {});
	const clients = useQuery(api.clients.list);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-10">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-2">
					<h1 className="text-3xl font-semibold tracking-tight">Invoices</h1>
					<p className="text-base text-muted-foreground">
						Bill clients, mark paid, share a link.
					</p>
				</div>
				<NewInvoiceDialog />
			</header>

			{invoices === undefined ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-14" />
					<Skeleton className="h-14" />
				</div>
			) : invoices.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<ReceiptIcon />
						</EmptyMedia>
						<EmptyTitle>No invoices yet</EmptyTitle>
						<EmptyDescription>
							Create one for any client. Set status to Sent when you've emailed
							it; mark Paid when money lands.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="divide-y rounded-lg border bg-card">
					{invoices.map((inv) => {
						const client = (clients ?? []).find((c) => c._id === inv.clientId);
						return (
							<li key={inv._id}>
								<Link
									to="/invoices/$invoiceId"
									params={{ invoiceId: inv._id }}
									className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-muted/50"
								>
									<div className="flex min-w-0 flex-col gap-1">
										<span className="truncate text-base font-medium">
											{inv.number} — {client?.name ?? "Unknown client"}
										</span>
										<span className="text-sm text-muted-foreground">
											Issued {new Date(inv.issuedAt).toLocaleDateString()} ·
											Due {new Date(inv.dueAt).toLocaleDateString()}
										</span>
									</div>
									<div className="flex items-center gap-3">
										<span className="font-mono text-sm">
											{fmtCurrency(inv.total, inv.currency)}
										</span>
										<Badge variant={STATUS_VARIANT[inv.status] ?? "outline"}>
											{STATUS_LABEL[inv.status] ?? inv.status}
										</Badge>
									</div>
								</Link>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}

function NewInvoiceDialog() {
	const create = useMutation(api.invoices.create);
	const clients = useQuery(api.clients.list);
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [clientId, setClientId] = useState<string>("");
	const [creating, setCreating] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button />}>
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
						setCreating(true)
						try {
							const id = await create({
								clientId: clientId as Id<"clients">,
							})
							setOpen(false)
							setClientId("")
							navigate({
								to: "/invoices/$invoiceId",
								params: { invoiceId: id },
							})
						} catch (err) {
							toast.error("Could not create invoice", {
								description:
									err instanceof Error ? err.message : String(err),
							})
						} finally {
							setCreating(false)
						}
					}}
					className="space-y-6"
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="invoice-client">Client</FieldLabel>
							<select
								id="invoice-client"
								value={clientId}
								onChange={(e) => setClientId(e.target.value)}
								className="rounded-md border bg-background px-2 py-2 text-sm"
								required
							>
								<option value="">— choose —</option>
								{(clients ?? []).map((c) => (
									<option key={c._id} value={c._id}>
										{c.name}
										{c.companyName ? ` · ${c.companyName}` : ""}
									</option>
								))}
							</select>
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
	)
}
