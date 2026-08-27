import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	FileTextIcon,
	MoreHorizontalIcon,
	PlusIcon,
	RefreshCwIcon,
	Trash2Icon,
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
import { CountTabs, ToolbarSearch } from "@/components/app/toolbar";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TableRow } from "@/components/ui/table";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/offertes/")({
	component: OffertesList,
});

type Row = {
	_id: Id<"offertes">;
	title: string;
	slug: string;
	shareToken: string;
	updatedAt: number;
	published: boolean;
	publicReadable: boolean;
	clientId?: Id<"clients">;
	clientName: string | null;
};

function state(row: Row): { label: string; tone: Tone; id: string } {
	if (!row.published) return { label: "Draft", tone: "muted", id: "draft" };
	if (row.publicReadable)
		return { label: "Public", tone: "success", id: "public" };
	return { label: "Shared", tone: "info", id: "shared" };
}

function OffertesList() {
	const offertes = useQuery(api.offertes.listByOwner, {});
	const clients = useQuery(api.clients.list);
	const navigate = useNavigate();
	const [q, setQ] = useState("");
	const [tab, setTab] = useState("all");

	const clientName = useMemo(
		() => new Map((clients ?? []).map((c) => [c._id, c.name])),
		[clients],
	);

	const rows: Row[] = useMemo(
		() =>
			(offertes ?? []).map((o) => ({
				_id: o._id,
				title: o.title,
				slug: o.slug,
				shareToken: o.shareToken,
				updatedAt: o.updatedAt,
				published: o.published,
				publicReadable: o.publicReadable,
				clientId: o.clientId,
				clientName: o.clientId ? (clientName.get(o.clientId) ?? null) : null,
			})),
		[offertes, clientName],
	);

	const counts = useMemo(
		() => ({
			all: rows.length,
			shared: rows.filter((r) => r.published).length,
			draft: rows.filter((r) => !r.published).length,
		}),
		[rows],
	);

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		return rows.filter((r) => {
			if (tab === "shared" && !r.published) return false;
			if (tab === "draft" && r.published) return false;
			if (!term) return true;
			return (
				r.title.toLowerCase().includes(term) ||
				r.slug.toLowerCase().includes(term) ||
				(r.clientName ?? "").toLowerCase().includes(term)
			);
		});
	}, [rows, q, tab]);

	const columns: readonly Column<Row>[] = useMemo(
		() => [
			{
				id: "title",
				header: "Offerte",
				sortValue: (r) => r.title,
				cell: (r) => (
					<div className="flex min-w-0 items-center gap-2.5">
						<span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
							<FileTextIcon className="size-3.5" />
						</span>
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-medium">{r.title}</span>
							<span className="font-mono text-xs text-muted-foreground">
								/o/{r.slug}
							</span>
						</div>
					</div>
				),
			},
			{
				id: "client",
				header: "Client",
				sortValue: (r) => r.clientName ?? "",
				cell: (r) => (
					<span className={r.clientName ? "" : "text-muted-foreground"}>
						{r.clientName ?? "—"}
					</span>
				),
			},
			{
				id: "status",
				header: "Status",
				sortValue: (r) => state(r).id,
				cell: (r) => {
					const s = state(r);
					return (
						<TonePill dot tone={s.tone}>
							{s.label}
						</TonePill>
					);
				},
			},
			{
				id: "updated",
				header: "Updated",
				align: "right",
				sortValue: (r) => r.updatedAt,
				cell: (r) => (
					<span className="text-muted-foreground tabular-nums">
						{new Date(r.updatedAt).toLocaleDateString()}
					</span>
				),
			},
			{
				id: "actions",
				header: "",
				className: "w-10",
				cell: (r) => <OfferteRowMenu row={r} />,
			},
		],
		[],
	);

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Offertes</FrameTitle>
					<FrameDescription>
						Proposals you write here and share with a link.
					</FrameDescription>
				</FrameHeading>
				<FrameActions>
					<ToolbarSearch
						value={q}
						onValueChange={setQ}
						placeholder="Search offertes…"
					/>
					<NewOfferteDialog />
				</FrameActions>
			</FrameHeader>
			<CountTabs
				value={tab}
				onValueChange={setTab}
				tabs={[
					{ id: "all", label: "All", count: counts.all },
					{ id: "shared", label: "Shared", count: counts.shared },
					{ id: "draft", label: "Drafts", count: counts.draft },
				]}
			/>
			<DataTable
				rows={filtered}
				columns={columns}
				getRowKey={(r) => r._id}
				loading={offertes === undefined}
				noun="offertes"
				defaultSort={{ id: "updated", dir: "desc" }}
				renderRow={(row, cells) => (
					<TableRow
						className="cursor-pointer"
						onClick={() =>
							void navigate({
								to: "/offertes/$offerteId",
								params: { offerteId: row._id },
							})
						}
					>
						{cells}
					</TableRow>
				)}
				empty={
					<EmptyState
						icon={FileTextIcon}
						title={q || tab !== "all" ? "Nothing here" : "No offertes yet"}
						description={
							q || tab !== "all"
								? "Try another search or switch tab."
								: "Write your first proposal and share it with a link."
						}
						action={q || tab !== "all" ? null : <NewOfferteDialog />}
					/>
				}
			/>
		</Frame>
	);
}

function NewOfferteDialog() {
	const titleId = useId();
	const createOfferte = useMutation(api.offertes.create);
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [creating, setCreating] = useState(false);

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) setTitle("");
			}}
		>
			<DialogTrigger render={<Button size="sm" />}>
				<PlusIcon data-icon="inline-start" />
				New offerte
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New offerte</DialogTitle>
					<DialogDescription>
						Give it a working title — you can rename it any time.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						if (!title.trim()) return;
						setCreating(true);
						try {
							const id = await createOfferte({ title: title.trim() });
							setOpen(false);
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
					className="space-y-6"
				>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor={titleId}>Title</FieldLabel>
							<Input
								id={titleId}
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Webshop redesign — Acme"
								autoFocus
							/>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" />}>
							Cancel
						</DialogClose>
						<Button type="submit" disabled={creating || !title.trim()}>
							{creating ? "Creating…" : "Create offerte"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function OfferteRowMenu({ row }: { row: Row }) {
	const publish = useMutation(api.offertes.publish);
	const unpublish = useMutation(api.offertes.unpublish);
	const regenerate = useMutation(api.offertes.regenerateSlug);
	const removeOfferte = useMutation(api.offertes.remove);
	const [copied, setCopied] = useState(false);
	const [working, setWorking] = useState(false);

	const origin = typeof window !== "undefined" ? window.location.origin : "";
	const publicUrl = `${origin}/o/${row.slug}`;
	const tokenUrl = `${origin}/o/${row.slug}?t=${row.shareToken}`;
	const shareUrl = row.published && row.publicReadable ? publicUrl : tokenUrl;

	const copy = async (url: string, label: string) => {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			toast.success(label);
			setTimeout(() => setCopied(false), 1500);
		} catch (err) {
			toast.error("Could not copy", {
				description: err instanceof Error ? err.message : String(err),
			});
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={`Actions for ${row.title}`}
					/>
				}
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
			>
				{copied ? (
					<CheckIcon className="size-4" />
				) : (
					<MoreHorizontalIcon className="size-4" />
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-56"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="px-1.5 py-1 font-mono text-xs text-muted-foreground">
					/o/{row.slug}
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					render={
						<Link to="/offertes/$offerteId" params={{ offerteId: row._id }} />
					}
				>
					<ExternalLinkIcon className="size-4" />
					Open editor
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={(e) => {
						e.preventDefault();
						void copy(
							shareUrl,
							row.published
								? "Share URL copied"
								: "URL copied — publish to share",
						);
					}}
				>
					<CopyIcon className="size-4" />
					Copy share URL
				</DropdownMenuItem>
				{row.published && row.publicReadable ? null : (
					<DropdownMenuItem
						onClick={(e) => {
							e.preventDefault();
							void copy(tokenUrl, "Token URL copied");
						}}
					>
						<CopyIcon className="size-4" />
						Copy URL with token
					</DropdownMenuItem>
				)}
				<DropdownMenuItem
					onClick={(e) => {
						e.preventDefault();
						window.open(shareUrl, "_blank", "noopener,noreferrer");
					}}
				>
					<ExternalLinkIcon className="size-4" />
					Open share page
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				{row.published ? (
					<DropdownMenuItem
						disabled={working}
						onClick={async (e) => {
							e.preventDefault();
							setWorking(true);
							try {
								await publish({
									id: row._id,
									publicReadable: !row.publicReadable,
								});
								toast.success(
									!row.publicReadable
										? "Now public — no token needed"
										: "Now token-only",
								);
							} catch (err) {
								toast.error("Could not update", {
									description: err instanceof Error ? err.message : String(err),
								});
							} finally {
								setWorking(false);
							}
						}}
					>
						<CheckIcon className="size-4" />
						{row.publicReadable ? "Switch to token-only" : "Make fully public"}
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem
					disabled={working}
					onClick={async (e) => {
						e.preventDefault();
						setWorking(true);
						try {
							if (row.published) {
								await unpublish({ id: row._id });
								toast.success("Unpublished");
							} else {
								await publish({ id: row._id, publicReadable: true });
								toast.success("Published publicly");
							}
						} catch (err) {
							toast.error("Could not update", {
								description: err instanceof Error ? err.message : String(err),
							});
						} finally {
							setWorking(false);
						}
					}}
				>
					<CheckIcon className="size-4" />
					{row.published ? "Unpublish" : "Publish public"}
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={working}
					onClick={async (e) => {
						e.preventDefault();
						if (
							!window.confirm(
								"Regenerate share URL? Old links to this offerte will stop working.",
							)
						)
							return;
						setWorking(true);
						try {
							const next = await regenerate({ id: row._id });
							toast.success("URL refreshed", {
								description: `New: /o/${next}`,
							});
						} catch (err) {
							toast.error("Could not refresh", {
								description: err instanceof Error ? err.message : String(err),
							});
						} finally {
							setWorking(false);
						}
					}}
				>
					<RefreshCwIcon className="size-4" />
					Refresh URL
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					variant="destructive"
					disabled={working}
					onClick={async (e) => {
						e.preventDefault();
						if (
							!window.confirm(
								`Delete "${row.title}"? This permanently removes the offerte and all its sections.`,
							)
						)
							return;
						setWorking(true);
						try {
							await removeOfferte({ id: row._id });
							toast.success("Offerte deleted");
						} catch (err) {
							toast.error("Could not delete", {
								description: err instanceof Error ? err.message : String(err),
							});
						} finally {
							setWorking(false);
						}
					}}
				>
					<Trash2Icon className="size-4" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
