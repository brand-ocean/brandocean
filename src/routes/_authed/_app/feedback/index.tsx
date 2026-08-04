import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	MessageSquareIcon,
	PlusIcon,
	Settings2Icon,
	StoreIcon,
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
	FrameTitle,
} from "@/components/app/frame";
import { type Tone, TonePill } from "@/components/app/tone";
import { ToolbarSearch } from "@/components/app/toolbar";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TableRow } from "@/components/ui/table";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/_authed/_app/feedback/")({
	component: FeedbackProjectsPage,
});

const STATUS_TONE: Record<string, Tone> = {
	active: "success",
	paused: "warning",
	archived: "muted",
};

type Row = {
	id: string;
	name: string;
	shopifyDomain: string;
	status: string;
	openCount: number;
	lastActivityAt: number;
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
	const navigate = useNavigate();
	const isOwner = data?.role === "owner";
	const [q, setQ] = useState("");

	const rows: Row[] = useMemo(() => (data?.projects ?? []) as Row[], [data]);

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		if (!term) return rows;
		return rows.filter(
			(p) =>
				p.name.toLowerCase().includes(term) ||
				(p.shopifyDomain ?? "").toLowerCase().includes(term),
		);
	}, [rows, q]);

	const totalOpen = rows.reduce((a, p) => a + p.openCount, 0);

	const columns: readonly Column<Row>[] = useMemo(
		() => [
			{
				id: "name",
				header: "Project",
				sortValue: (r) => r.name,
				cell: (r) => (
					<div className="flex min-w-0 items-center gap-2.5">
						<span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
							<StoreIcon className="size-3.5" />
						</span>
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-medium">{r.name}</span>
							<span className="truncate font-mono text-xs text-muted-foreground">
								{r.shopifyDomain || "—"}
							</span>
						</div>
					</div>
				),
			},
			{
				id: "open",
				header: "Open comments",
				sortValue: (r) => r.openCount,
				cell: (r) =>
					r.openCount > 0 ? (
						<TonePill dot tone="warning">
							{r.openCount >= 100 ? "99+" : r.openCount} open
						</TonePill>
					) : (
						<span className="text-muted-foreground">All clear</span>
					),
			},
			{
				id: "status",
				header: "Status",
				sortValue: (r) => r.status,
				cell: (r) => (
					<TonePill dot tone={STATUS_TONE[r.status] ?? "muted"}>
						{r.status}
					</TonePill>
				),
			},
			{
				id: "activity",
				header: "Last activity",
				align: "right",
				sortValue: (r) => r.lastActivityAt,
				cell: (r) => (
					<span className="text-muted-foreground tabular-nums">
						{timeAgo(r.lastActivityAt)}
					</span>
				),
			},
			{
				id: "install",
				header: "",
				className: "w-10",
				cell: (r) =>
					isOwner ? (
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label={`Install & share ${r.name}`}
							render={
								<Link
									to="/feedback/$projectId/install"
									params={{ projectId: r.id }}
								/>
							}
							onClick={(e) => e.stopPropagation()}
						>
							<Settings2Icon />
						</Button>
					) : null,
			},
		],
		[isOwner],
	);

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Feedback</FrameTitle>
					<FrameDescription>
						{rows.length > 0
							? `${totalOpen} open across ${rows.length} project${rows.length === 1 ? "" : "s"}`
							: "Visual feedback projects for the Shopify stores you build."}
					</FrameDescription>
				</FrameHeading>
				<FrameActions>
					<ToolbarSearch
						value={q}
						onValueChange={setQ}
						placeholder="Search projects…"
					/>
					{isOwner ? <NewProjectDialog /> : null}
				</FrameActions>
			</FrameHeader>
			<DataTable
				rows={filtered}
				columns={columns}
				getRowKey={(r) => r.id}
				loading={data === undefined}
				noun="projects"
				defaultSort={{ id: "activity", dir: "desc" }}
				renderRow={(row, cells) => (
					<TableRow
						className="cursor-pointer"
						onClick={() =>
							void navigate({
								to: "/feedback/$projectId",
								params: { projectId: row.id },
							})
						}
					>
						{cells}
					</TableRow>
				)}
				empty={
					<EmptyState
						icon={MessageSquareIcon}
						title={q ? "No project matched that" : "No feedback projects yet"}
						description={
							q
								? "Try another name or store domain."
								: isOwner
									? "Create one and paste the widget snippet into the store theme."
									: "Nothing has been shared with you yet."
						}
						action={!q && isOwner ? <NewProjectDialog /> : null}
					/>
				}
			/>
		</Frame>
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
			<DialogTrigger render={<Button size="sm" />}>
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
