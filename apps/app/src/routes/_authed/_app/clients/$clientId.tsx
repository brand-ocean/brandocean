import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { FileTextIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Frame, FrameHeader, FramePanel } from "@/components/app/frame";
import { usePageTitle } from "@/components/app/page-title";
import { CountTabs } from "@/components/app/toolbar";
import { TasksPanel } from "@/components/tasks/TasksPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/clients/$clientId")({
	component: ClientDetail,
});

function ClientDetail() {
	const { clientId } = Route.useParams();
	const id = clientId as Id<"clients">;
	const client = useQuery(api.clients.getById, { id });
	const [tab, setTab] = useState("overview");
	usePageTitle(client?.name);

	if (client === undefined) {
		return (
			<Frame className="mx-auto w-full max-w-4xl">
				<FramePanel>
					<Skeleton className="mb-4 h-8 w-2/3" />
					<Skeleton className="h-40" />
				</FramePanel>
			</Frame>
		);
	}

	if (client === null) {
		return (
			<Frame className="mx-auto w-full max-w-4xl">
				<FramePanel flush>
					<EmptyState
						title="Client not found"
						description="It may have been removed, or you don't have access."
						action={
							<Button
								size="sm"
								render={<Link to="/clients" />}
								variant="outline"
							>
								Back to clients
							</Button>
						}
					/>
				</FramePanel>
			</Frame>
		);
	}

	return (
		<Frame className="mx-auto w-full max-w-4xl">
			<FrameHeader>
				<ClientHeader clientId={id} client={client} />
			</FrameHeader>
			<CountTabs
				value={tab}
				onValueChange={setTab}
				tabs={[
					{ id: "overview", label: "Overview" },
					{ id: "offertes", label: "Offertes" },
					{ id: "contracts", label: "Contracts" },
					{ id: "tasks", label: "Tasks" },
					{ id: "notes", label: "Notes" },
				]}
			/>
			<FramePanel>
				{tab === "overview" ? (
					<OverviewTab clientId={id} />
				) : tab === "offertes" ? (
					<OffertesTab clientId={id} />
				) : tab === "contracts" ? (
					<ContractsTab clientId={id} />
				) : tab === "tasks" ? (
					<TasksPanel clientId={id} />
				) : (
					<NotesTab />
				)}
			</FramePanel>
		</Frame>
	);
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
			<>
				<div className="flex min-w-0 flex-col gap-px">
					<h2 className="truncate text-sm font-semibold">{client.name}</h2>
					<p className="truncate text-xs text-muted-foreground">
						{[client.companyName, client.email].filter(Boolean).join(" · ") ||
							"No company or email yet"}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							setName(client.name);
							setCompanyName(client.companyName ?? "");
							setEmail(client.email ?? "");
							setEditing(true);
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
								return;
							try {
								await remove({ id: clientId });
								navigate({ to: "/clients" });
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
				</div>
			</>
		);
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
					});
					setEditing(false);
				} catch (err) {
					toast.error("Could not save", {
						description: err instanceof Error ? err.message : String(err),
					});
				}
			}}
			className="w-full py-2"
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
	);
}

function OverviewTab({ clientId }: { clientId: Id<"clients"> }) {
	const offertes = useQuery(api.offertes.listByOwner, { clientId });
	if (offertes === undefined)
		return (
			<div className="space-y-2">
				<Skeleton className="h-20" />
			</div>
		);
	const published = offertes.filter((o) => o.published).length;
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
			<StatCard label="Offertes" value={offertes.length} />
			<StatCard label="Published" value={published} />
			<StatCard label="Drafts" value={offertes.length - published} />
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg border bg-card p-5">
			<p className="text-sm text-muted-foreground">{label}</p>
			<p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
		</div>
	);
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
						setTitle("");
						navigate({
							to: "/offertes/$offerteId",
							params: { offerteId: id },
						});
					} catch (err) {
						toast.error("Could not create offerte", {
							description: err instanceof Error ? err.message : String(err),
						});
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
				<EmptyState
					icon={FileTextIcon}
					title="No offertes yet"
					description="Create one above to start the proposal flow."
				/>
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
	);
}

function ContractsTab({ clientId }: { clientId: Id<"clients"> }) {
	const contracts = useQuery(api.contracts.listByOwner, { clientId });
	if (contracts === undefined)
		return (
			<div className="flex flex-col gap-2">
				<Skeleton className="h-14" />
			</div>
		);
	if (contracts.length === 0) {
		return (
			<EmptyState
				icon={FileTextIcon}
				title="No signed contracts yet"
				description="When a client signs an offerte share link, the contract appears here."
			/>
		);
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
	);
}

function NotesTab() {
	return (
		<p className="text-sm text-muted-foreground">
			Per-client notes coming later.
		</p>
	);
}
