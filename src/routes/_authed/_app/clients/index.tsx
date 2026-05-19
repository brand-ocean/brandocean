import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { PlusIcon, UsersIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/_authed/_app/clients/")({
	component: ClientsPage,
});

function ClientsPage() {
	const clients = useQuery(api.clients.listWithCounts);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-10">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-2">
					<h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
					<p className="text-base text-muted-foreground">
						People and companies you send offertes, contracts and invoices to.
					</p>
				</div>
				<NewClientDialog />
			</header>

			{clients === undefined ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-14" />
					<Skeleton className="h-14" />
					<Skeleton className="h-14" />
				</div>
			) : clients.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<UsersIcon />
						</EmptyMedia>
						<EmptyTitle>No clients yet</EmptyTitle>
						<EmptyDescription>
							Add your first one with the button above.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="divide-y rounded-lg border bg-card">
					{clients.map((c) => (
						<li key={c._id}>
							<Link
								to="/clients/$clientId"
								params={{ clientId: c._id }}
								className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-muted/50"
							>
								<div className="flex min-w-0 flex-col gap-1">
									<span className="truncate text-base font-medium">
										{c.name}
									</span>
									<span className="text-sm text-muted-foreground">
										{[c.companyName, c.email].filter(Boolean).join(" · ") ||
											"—"}
									</span>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant="secondary">
										{c.offerteCount}{" "}
										{c.offerteCount === 1 ? "offerte" : "offertes"}
									</Badge>
								</div>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

function NewClientDialog() {
	const create = useMutation(api.clients.create);
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [email, setEmail] = useState("");
	const [creating, setCreating] = useState(false);

	const reset = () => {
		setName("");
		setCompanyName("");
		setEmail("");
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v)
				if (!v) reset();
			}}
		>
			<DialogTrigger render={<Button />}>
				<PlusIcon data-icon="inline-start" />
				New client
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add a client</DialogTitle>
					<DialogDescription>
						You can edit details and link offertes after.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						if (!name.trim()) return;
						setCreating(true)
						try {
							const id = await create({
								name: name.trim(),
								companyName: companyName.trim() || undefined,
								email: email.trim() || undefined,
							})
							setOpen(false)
							reset()
							navigate({
								to: "/clients/$clientId",
								params: { clientId: id },
							})
						} catch (err) {
							toast.error("Could not create client", {
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
							<FieldLabel htmlFor="new-client-name">Name</FieldLabel>
							<Input
								id="new-client-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Jane van der Berg"
								autoFocus
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="new-client-company">
								Company (optional)
							</FieldLabel>
							<Input
								id="new-client-company"
								value={companyName}
								onChange={(e) => setCompanyName(e.target.value)}
								placeholder="EAVE Cosmetics"
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="new-client-email">
								Email (optional)
							</FieldLabel>
							<Input
								id="new-client-email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="jane@company.com"
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" />}>
							Cancel
						</DialogClose>
						<Button type="submit" disabled={creating || !name.trim()}>
							{creating ? "Creating…" : "Create client"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
