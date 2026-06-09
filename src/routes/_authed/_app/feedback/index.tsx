import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { MessageSquareIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/_authed/_app/feedback/")({
	component: FeedbackProjectsPage,
});

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
	active: "default",
	paused: "secondary",
	archived: "outline",
};

function timeAgo(ts: number): string {
	const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
	if (s < 60) return "just now";
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	if (d < 7) return `${d}d ago`;
	return new Date(ts).toLocaleDateString();
}

function FeedbackProjectsPage() {
	const data = useQuery(api.feedback.listProjects);
	const isOwner = data?.role === "owner";
	const [q, setQ] = useState("");
	const visibleProjects = (data?.projects ?? []).filter((p) => {
		const t = q.trim().toLowerCase();
		if (!t) return true;
		return (
			p.name.toLowerCase().includes(t) ||
			(p.shopifyDomain ?? "").toLowerCase().includes(t)
		);
	});

	return (
		<div className="mx-auto w-full max-w-5xl space-y-10">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-2">
					<h1 className="text-3xl font-semibold tracking-tight">Feedback</h1>
					<p className="text-base text-muted-foreground">
						Visual feedback projects for the Shopify stores you build.
					</p>
					{data && data.projects.length > 0 && (
						<p className="text-sm font-medium text-primary">
							{data.projects.reduce((a, p) => a + p.openCount, 0)} open
							across {data.projects.length} project
							{data.projects.length === 1 ? "" : "s"}
						</p>
					)}
				</div>
				{isOwner && <NewProjectDialog />}
			</header>

			{data === undefined ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-14" />
					<Skeleton className="h-14" />
					<Skeleton className="h-14" />
				</div>
			) : data.projects.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<MessageSquareIcon />
						</EmptyMedia>
						<EmptyTitle>No feedback projects yet</EmptyTitle>
						<EmptyDescription>
							{isOwner
								? "Create one and paste the widget snippet into the store theme."
								: "Nothing has been shared with you yet."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<>
					{data.projects.length > 4 && (
						<input
							value={q}
							onChange={(e) => setQ(e.target.value)}
							placeholder="Search projects…"
							className="mb-3 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
						/>
					)}
					{visibleProjects.length === 0 ? (
						<p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
							No projects match “{q}”.
						</p>
					) : (
				<ul className="divide-y rounded-lg border bg-card">
					{visibleProjects.map((p) => (
						<li
							key={p.id}
							className="flex items-center gap-3 px-6 py-5 hover:bg-muted/50"
						>
							<Link
								to="/feedback/$projectId"
								params={{ projectId: p.id }}
								className="flex min-w-0 flex-1 flex-col gap-1"
							>
								<span className="truncate text-base font-medium">
									{p.name}
								</span>
								<span className="text-sm text-muted-foreground">
									{p.shopifyDomain || "—"} · updated{" "}
									{timeAgo(p.lastActivityAt)}
								</span>
							</Link>
							{p.openCount > 0 && (
								<Badge>
									{p.openCount >= 100 ? "99+" : p.openCount} open
								</Badge>
							)}
							<Badge variant={statusVariant[p.status] ?? "secondary"}>
								{p.status}
							</Badge>
							{isOwner && (
								<Link
									to="/feedback/$projectId/install"
									params={{ projectId: p.id }}
									className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
									title="Install & share"
								>
									<Settings2Icon className="size-4" />
								</Link>
							)}
						</li>
					))}
				</ul>
					)}
				</>
			)}
		</div>
	);
}

function NewProjectDialog() {
	const create = useMutation(api.feedback.createProject);
	const clients = useQuery(api.clients.listWithCounts);
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [shopifyDomain, setShopifyDomain] = useState("");
	const [clientId, setClientId] = useState<string>("none");
	const [creating, setCreating] = useState(false);
	const nameId = useId();
	const domainId = useId();

	const reset = () => {
		setName("");
		setShopifyDomain("");
		setClientId("none");
	};

	const submit = async () => {
		if (!name.trim()) {
			toast.error("Name is required");
			return;
		}
		if (!shopifyDomain.trim()) {
			toast.error("Store domain is required");
			return;
		}
		setCreating(true);
		try {
			await create({
				name: name.trim(),
				shopifyDomain: shopifyDomain.trim(),
				clientId:
					clientId === "none"
						? undefined
						: (clientId as Parameters<typeof create>[0]["clientId"]),
			});
			toast.success("Project created");
			reset();
			setOpen(false);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			toast.error(
				msg.includes("invalid_domain")
					? "Enter a valid store domain like yourstore.myshopify.com (no https://, no path)"
					: "Could not create project",
			);
		} finally {
			setCreating(false);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) reset();
			}}
		>
			<DialogTrigger render={<Button />}>
				<PlusIcon data-icon="inline-start" />
				New project
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New feedback project</DialogTitle>
					<DialogDescription>
						One project per Shopify store you want feedback on.
					</DialogDescription>
				</DialogHeader>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor={nameId}>Name</FieldLabel>
						<Input
							id={nameId}
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Acme storefront"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={domainId}>Shopify domain</FieldLabel>
						<Input
							id={domainId}
							value={shopifyDomain}
							onChange={(e) => setShopifyDomain(e.target.value)}
							placeholder="acme.myshopify.com"
						/>
					</Field>
					<Field>
						<FieldLabel>Client (optional)</FieldLabel>
						<Select
							value={clientId}
							onValueChange={(v) => setClientId(v ?? "none")}
						>
							<SelectTrigger>
								<SelectValue placeholder="No client" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">No client</SelectItem>
								{clients?.map((c) => (
									<SelectItem key={c._id} value={c._id}>
										{c.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
				</FieldGroup>
				<DialogFooter>
					<Button onClick={submit} disabled={creating}>
						{creating ? "Creating…" : "Create project"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
