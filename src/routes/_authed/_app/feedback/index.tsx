import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { MessageSquareIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
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

function FeedbackProjectsPage() {
	const data = useQuery(api.feedback.listProjects);
	const isOwner = data?.role === "owner";

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
				<ul className="divide-y rounded-lg border bg-card">
					{data.projects.map((p) => (
						<li key={p.id}>
							<Link
								to="/feedback/$projectId"
								params={{ projectId: p.id }}
								className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-muted/50"
							>
								<div className="flex min-w-0 flex-col gap-1">
									<span className="truncate text-base font-medium">
										{p.name}
									</span>
									<span className="text-sm text-muted-foreground">
										{p.shopifyDomain || "—"}
									</span>
								</div>
								<div className="flex items-center gap-2">
									{p.openCount > 0 && (
										<Badge>
											{p.openCount >= 100 ? "99+" : p.openCount} open
										</Badge>
									)}
									<Badge variant={statusVariant[p.status] ?? "secondary"}>
										{p.status}
									</Badge>
								</div>
							</Link>
						</li>
					))}
				</ul>
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
		} catch {
			toast.error("Could not create project");
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
						<FieldLabel htmlFor="fb-name">Name</FieldLabel>
						<Input
							id="fb-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Acme storefront"
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="fb-domain">Shopify domain</FieldLabel>
						<Input
							id="fb-domain"
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
