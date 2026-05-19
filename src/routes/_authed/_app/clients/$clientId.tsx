import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	FileTextIcon,
	PencilIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TasksPanel } from "@/components/tasks/TasksPanel";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/clients/$clientId")({
	component: ClientDetail,
});

function ClientDetail() {
	const { clientId } = Route.useParams();
	const id = clientId as Id<"clients">;
	const client = useQuery(api.clients.getById, { id });

	if (client === undefined) {
		return (
			<div className="mx-auto w-full max-w-4xl space-y-8">
				<Skeleton className="h-10 w-2/3" />
				<Skeleton className="h-32" />
			</div>
		)
	}

	if (client === null) {
		return (
			<div className="mx-auto w-full max-w-4xl space-y-3">
				<h1 className="text-2xl font-semibold">Client not found</h1>
				<p className="text-muted-foreground">
					It may have been removed or you don't have access.
				</p>
				<Button render={<Link to="/clients" />} variant="outline">
					Back to clients
				</Button>
			</div>
		)
	}

	return (
		<div className="mx-auto w-full max-w-4xl space-y-10">
			<ClientHeader clientId={id} client={client} />
			<Tabs defaultValue="overview">
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="offertes">Offertes</TabsTrigger>
					<TabsTrigger value="contracts">Contracts</TabsTrigger>
					<TabsTrigger value="tasks">Tasks</TabsTrigger>
					<TabsTrigger value="notes">Notes</TabsTrigger>
				</TabsList>
				<TabsContent value="overview" className="pt-6">
					<OverviewTab clientId={id} />
				</TabsContent>
				<TabsContent value="offertes" className="pt-6">
					<OffertesTab clientId={id} />
				</TabsContent>
				<TabsContent value="contracts" className="pt-6">
					<ContractsTab clientId={id} />
				</TabsContent>
				<TabsContent value="tasks" className="pt-6">
					<TasksPanel clientId={id} />
				</TabsContent>
				<TabsContent value="notes" className="pt-6">
					<NotesTab />
				</TabsContent>
			</Tabs>
		</div>
	)
}

type ClientDoc = {
	_id: Id<"clients">;
	name: string;
	email?: string;
	companyName?: string;
};

function ClientHeader({
	clientId,
	client,
}: {
	clientId: Id<"clients">;
	client: ClientDoc;
}) {
	const update = useMutation(api.clients.update);
	const remove = useMutation(api.clients.remove);
	const navigate = useNavigate();
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(client.name);
	const [companyName, setCompanyName] = useState(client.companyName ?? "");
	const [email, setEmail] = useState(client.email ?? "");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (editing) inputRef.current?.focus();
	}, [editing]);

	if (!editing) {
		return (
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="text-3xl font-semibold tracking-tight">
						{client.name}
					</h1>
					<p className="text-base text-muted-foreground">
						{[client.companyName, client.email].filter(Boolean).join(" · ") ||
							"No company or email yet"}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							setName(client.name)
							setCompanyName(client.companyName ?? "");
							setEmail(client.email ?? "");
							setEditing(true)
						}}
					>
						<PencilIcon data-icon="inline-start" />
						Edit
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={async () => {
							if (
								!window.confirm(
									`Delete ${client.name}? Linked offertes are kept.`,
								)
							)
								return
							try {
								await remove({ id: clientId });
								navigate({ to: "/clients" });
							} catch (err) {
								toast.error("Could not delete", {
									description:
										err instanceof Error ? err.message : String(err),
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

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				if (!name.trim()) return;
				try {
					await update({
						id: clientId,
						name: name.trim(),
						companyName: companyName.trim() || undefined,
						email: email.trim() || undefined,
					})
					setEditing(false);
				} catch (err) {
					toast.error("Could not save", {
						description: err instanceof Error ? err.message : String(err),
					})
				}
			}}
		>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="client-name">Name</FieldLabel>
					<Input
						ref={inputRef}
						id="client-name"
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="client-company">Company</FieldLabel>
					<Input
						id="client-company"
						value={companyName}
						onChange={(e) => setCompanyName(e.target.value)}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor="client-email">Email</FieldLabel>
					<Input
						id="client-email"
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
					/>
				</Field>
				<div className="flex gap-2">
					<Button type="submit" disabled={!name.trim()}>
						Save
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => setEditing(false)}
					>
						Cancel
					</Button>
				</div>
			</FieldGroup>
		</form>
	)
}

function OverviewTab({ clientId }: { clientId: Id<"clients"> }) {
	const offertes = useQuery(api.offertes.listByOwner, { clientId });
	if (offertes === undefined)
		return (
			<div className="space-y-2">
				<Skeleton className="h-20" />
			</div>
		)
	const published = offertes.filter((o) => o.published).length;
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
			<StatCard label="Offertes" value={offertes.length} />
			<StatCard label="Published" value={published} />
			<StatCard label="Drafts" value={offertes.length - published} />
		</div>
	)
}

function StatCard({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg border bg-card p-5">
			<p className="text-sm text-muted-foreground">{label}</p>
			<p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
		</div>
	)
}

function OffertesTab({ clientId }: { clientId: Id<"clients"> }) {
	const offertes = useQuery(api.offertes.listByOwner, { clientId });
	const create = useMutation(api.offertes.create);
	const navigate = useNavigate();
	const [title, setTitle] = useState("");
	const [creating, setCreating] = useState(false);

	return (
		<div className="space-y-6">
			<form
				onSubmit={async (e) => {
					e.preventDefault();
					if (!title.trim()) return;
					setCreating(true);
					try {
						const id = await create({ title: title.trim(), clientId });
						setTitle("")
						navigate({
							to: "/offertes/$offerteId",
							params: { offerteId: id },
						})
					} catch (err) {
						toast.error("Could not create offerte", {
							description: err instanceof Error ? err.message : String(err),
						})
					} finally {
						setCreating(false);
					}
				}}
			>
				<div className="flex items-center gap-2">
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="New offerte for this client…"
						className="flex-1"
					/>
					<Button type="submit" disabled={creating || !title.trim()}>
						<PlusIcon data-icon="inline-start" />
						{creating ? "Creating…" : "Create"}
					</Button>
				</div>
			</form>

			{offertes === undefined ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-14" />
				</div>
			) : offertes.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<FileTextIcon />
						</EmptyMedia>
						<EmptyTitle>No offertes yet</EmptyTitle>
						<EmptyDescription>
							Create one above to start the proposal flow.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="divide-y rounded-lg border bg-card">
					{offertes.map((o) => (
						<li key={o._id}>
							<Link
								to="/offertes/$offerteId"
								params={{ offerteId: o._id }}
								className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-muted/50"
							>
								<div className="flex min-w-0 flex-col gap-1">
									<span className="truncate text-base font-medium">
										{o.title}
									</span>
									<span className="text-sm text-muted-foreground">
										Updated {new Date(o.updatedAt).toLocaleDateString()}
									</span>
								</div>
								<Badge
									variant={
										o.published
											? o.publicReadable
												? "default"
												: "secondary"
											: "outline"
									}
								>
									{o.published
										? o.publicReadable
											? "Public"
											: "Shared"
										: "Draft"}
								</Badge>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

function ContractsTab({ clientId }: { clientId: Id<"clients"> }) {
	const contracts = useQuery(api.contracts.listByOwner, { clientId });
	if (contracts === undefined)
		return (
			<div className="flex flex-col gap-2">
				<Skeleton className="h-14" />
			</div>
		)
	if (contracts.length === 0) {
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<FileTextIcon />
					</EmptyMedia>
					<EmptyTitle>No signed contracts yet</EmptyTitle>
					<EmptyDescription>
						When a client signs an offerte share link, the contract appears here.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}
	return (
		<ul className="divide-y rounded-lg border bg-card">
			{contracts.map((c) => (
				<li
					key={c._id}
					className="flex items-center justify-between gap-4 px-6 py-5"
				>
					<div className="flex min-w-0 flex-col gap-1">
						<span className="truncate text-base font-medium">{c.title}</span>
						<span className="text-sm text-muted-foreground">
							Signed by {c.signedByName} on{" "}
							{new Date(c.signedAt).toLocaleDateString()}
						</span>
					</div>
					<a
						href={`/c/${c.slug}`}
						target="_blank"
						rel="noreferrer"
						className="text-sm underline"
					>
						View
					</a>
				</li>
			))}
		</ul>
	)
}

function NotesTab() {
	return (
		<p className="text-sm text-muted-foreground">
			Per-client notes coming later.
		</p>
	)
}
