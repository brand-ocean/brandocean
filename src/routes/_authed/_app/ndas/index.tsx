import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	MoreHorizontalIcon,
	PlusIcon,
	RefreshCwIcon,
	ShieldCheckIcon,
	Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { TonePill, type Tone } from "@/components/app/tone";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { TableRow } from "@/components/ui/table";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/ndas/")({
	component: NdasList,
});

type Language = "nl" | "en";
type Direction = "owner_signs" | "client_signs";

const NONE_VALUE = "__none__";

type Row = {
	_id: Id<"ndas">;
	title: string;
	slug: string;
	shareToken: string;
	language: Language;
	direction: Direction;
	updatedAt: number;
	published: boolean;
	publicReadable: boolean;
	signedSlug: string | null;
	clientName: string | null;
};

function state(row: Row): { label: string; tone: Tone; id: string } {
	if (row.signedSlug) return { label: "Signed", tone: "success", id: "signed" };
	if (!row.published) return { label: "Draft", tone: "muted", id: "draft" };
	if (row.publicReadable)
		return { label: "Public", tone: "success", id: "public" };
	return { label: "Shared", tone: "info", id: "shared" };
}

function NdasList() {
	const ndas = useQuery(api.ndas.listByOwner, {});
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
			(ndas ?? []).map((n) => ({
				_id: n._id,
				title: n.title,
				slug: n.slug,
				shareToken: n.shareToken,
				language: n.language,
				direction: n.direction ?? "client_signs",
				updatedAt: n.updatedAt,
				published: n.published,
				publicReadable: n.publicReadable,
				signedSlug: n.signedSlug ?? null,
				clientName: n.clientId ? (clientName.get(n.clientId) ?? null) : null,
			})),
		[ndas, clientName],
	);

	const counts = useMemo(
		() => ({
			all: rows.length,
			signed: rows.filter((r) => r.signedSlug).length,
			awaiting: rows.filter((r) => !r.signedSlug && r.published).length,
			draft: rows.filter((r) => !r.signedSlug && !r.published).length,
		}),
		[rows],
	);

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		return rows.filter((r) => {
			if (tab === "signed" && !r.signedSlug) return false;
			if (tab === "awaiting" && (r.signedSlug || !r.published)) return false;
			if (tab === "draft" && (r.signedSlug || r.published)) return false;
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
				header: "NDA",
				sortValue: (r) => r.title,
				cell: (r) => (
					<div className="flex min-w-0 items-center gap-2.5">
						<span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
							<ShieldCheckIcon className="size-3.5" />
						</span>
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-medium">{r.title}</span>
							<span className="font-mono text-xs text-muted-foreground">
								/n/{r.slug}
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
				id: "who",
				header: "Signed by",
				sortValue: (r) => r.direction,
				cell: (r) => (
					<span className="text-muted-foreground">
						{r.direction === "owner_signs" ? "Me" : "Client"}
					</span>
				),
			},
			{
				id: "lang",
				header: "Lang",
				sortValue: (r) => r.language,
				cell: (r) => (
					<span className="font-mono text-xs uppercase">{r.language}</span>
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
				cell: (r) => (
					<NdaRowMenu
						ndaId={r._id}
						title={r.title}
						slug={r.slug}
						shareToken={r.shareToken}
						published={r.published}
						publicReadable={r.publicReadable}
						signedSlug={r.signedSlug}
					/>
				),
			},
		],
		[],
	);

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>NDAs</FrameTitle>
					<FrameDescription>
						One-way agreements. “Me” means you sign for the client's data;
						“Client” means they sign online for yours.
					</FrameDescription>
				</FrameHeading>
				<FrameActions>
					<ToolbarSearch
						value={q}
						onValueChange={setQ}
						placeholder="Search NDAs…"
					/>
					<NewNdaDialog />
				</FrameActions>
			</FrameHeader>
			<CountTabs
				value={tab}
				onValueChange={setTab}
				tabs={[
					{ id: "all", label: "All", count: counts.all },
					{ id: "awaiting", label: "Awaiting signature", count: counts.awaiting },
					{ id: "signed", label: "Signed", count: counts.signed },
					{ id: "draft", label: "Drafts", count: counts.draft },
				]}
			/>
			<DataTable
				rows={filtered}
				columns={columns}
				getRowKey={(r) => r._id}
				loading={ndas === undefined}
				noun="NDAs"
				defaultSort={{ id: "updated", dir: "desc" }}
				renderRow={(row, cells) => (
					<TableRow
						className="cursor-pointer"
						onClick={() =>
							void navigate({ to: "/ndas/$ndaId", params: { ndaId: row._id } })
						}
					>
						{cells}
					</TableRow>
				)}
				empty={
					<EmptyState
						icon={ShieldCheckIcon}
						title={q || tab !== "all" ? "Nothing here" : "No NDAs yet"}
						description={
							q || tab !== "all"
								? "Try another search or switch tab."
								: "Start from the ready-made one-way template and edit what you need."
						}
						action={q || tab !== "all" ? null : <NewNdaDialog />}
					/>
				}
			/>
		</Frame>
	);
}

function NewNdaDialog() {
	const createNda = useMutation(api.ndas.create);
	const clients = useQuery(api.clients.list);
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("NDA");
	const [language, setLanguage] = useState<Language>("nl");
	const [direction, setDirection] = useState<Direction>("owner_signs");
	const [clientId, setClientId] = useState<string>(NONE_VALUE);
	const [creating, setCreating] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={<Button size="sm" />}>
				<PlusIcon data-icon="inline-start" />
				New NDA
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New NDA</DialogTitle>
					<DialogDescription>
						Starts from the one-way template in the language you pick.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						if (!title.trim()) return;
						setCreating(true);
						try {
							const id = await createNda({
								title: title.trim(),
								language,
								direction,
								clientId:
									clientId === NONE_VALUE
										? undefined
										: (clientId as Id<"clients">),
							});
							setOpen(false);
							setTitle("NDA");
							setClientId(NONE_VALUE);
							navigate({ to: "/ndas/$ndaId", params: { ndaId: id } });
						} catch (err) {
							toast.error("Could not create NDA", {
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
							<FieldLabel htmlFor="new-nda-title">Title</FieldLabel>
							<Input
								id="new-nda-title"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="NDA — Acme"
								autoFocus
							/>
						</Field>
						<Field>
							<FieldLabel>Who signs</FieldLabel>
							<Select
								value={direction}
								onValueChange={(v) => setDirection(v as Direction)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="owner_signs">
										I sign — protecting the client's data
									</SelectItem>
									<SelectItem value="client_signs">
										Client signs — protecting my information
									</SelectItem>
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel>Language</FieldLabel>
							<Select
								value={language}
								onValueChange={(v) => setLanguage(v as Language)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="nl">Dutch</SelectItem>
									<SelectItem value="en">English</SelectItem>
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel>Client (optional)</FieldLabel>
							<Select
								value={clientId}
								onValueChange={(v) => setClientId(v ?? NONE_VALUE)}
							>
								<SelectTrigger>
									<SelectValue placeholder="No client" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={NONE_VALUE}>No client</SelectItem>
									{(clients ?? []).map((c) => (
										<SelectItem key={c._id} value={c._id}>
											{c.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<DialogClose render={<Button type="button" variant="outline" />}>
							Cancel
						</DialogClose>
						<Button type="submit" disabled={creating || !title.trim()}>
							{creating ? "Creating…" : "Create NDA"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function NdaRowMenu({
	ndaId,
	title,
	slug,
	shareToken,
	published,
	publicReadable,
	signedSlug,
}: {
	ndaId: Id<"ndas">;
	title: string;
	slug: string;
	shareToken: string;
	published: boolean;
	publicReadable: boolean;
	signedSlug: string | null;
}) {
	const publish = useMutation(api.ndas.publish);
	const unpublish = useMutation(api.ndas.unpublish);
	const regenerate = useMutation(api.ndas.regenerateSlug);
	const removeNda = useMutation(api.ndas.remove);
	const [copied, setCopied] = useState(false);
	const [working, setWorking] = useState(false);

	const origin = typeof window !== "undefined" ? window.location.origin : "";
	const publicUrl = `${origin}/n/${slug}`;
	const tokenUrl = `${origin}/n/${slug}?t=${shareToken}`;
	const shareUrl = published && publicReadable ? publicUrl : tokenUrl;

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
						aria-label={`Actions for ${title}`}
					/>
				}
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
			>
				{copied ? (
					<CheckIcon className="h-4 w-4" />
				) : (
					<MoreHorizontalIcon className="h-4 w-4" />
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-56"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="px-1.5 py-1 font-mono text-xs text-muted-foreground">
					/n/{slug}
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem render={<Link to="/ndas/$ndaId" params={{ ndaId }} />}>
					<ExternalLinkIcon className="h-4 w-4" />
					Open editor
				</DropdownMenuItem>
				{signedSlug ? (
					<DropdownMenuItem
						onClick={(e) => {
							e.preventDefault();
							window.open(
								`${origin}/ns/${signedSlug}`,
								"_blank",
								"noopener,noreferrer",
							);
						}}
					>
						<ExternalLinkIcon className="h-4 w-4" />
						View signed copy
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem
					onClick={(e) => {
						e.preventDefault();
						void copy(
							shareUrl,
							published ? "Share URL copied" : "URL copied — publish to share",
						);
					}}
				>
					<CopyIcon className="h-4 w-4" />
					Copy share URL
				</DropdownMenuItem>
				{published && publicReadable ? null : (
					<DropdownMenuItem
						onClick={(e) => {
							e.preventDefault();
							void copy(tokenUrl, "Token URL copied");
						}}
					>
						<CopyIcon className="h-4 w-4" />
						Copy URL with token
					</DropdownMenuItem>
				)}
				<DropdownMenuItem
					onClick={(e) => {
						e.preventDefault();
						window.open(shareUrl, "_blank", "noopener,noreferrer");
					}}
				>
					<ExternalLinkIcon className="h-4 w-4" />
					Open share page
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				{published ? (
					<DropdownMenuItem
						disabled={working}
						onClick={async (e) => {
							e.preventDefault();
							setWorking(true);
							try {
								await publish({ id: ndaId, publicReadable: !publicReadable });
								toast.success(
									!publicReadable
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
						<CheckIcon className="h-4 w-4" />
						{publicReadable ? "Switch to token-only" : "Make fully public"}
					</DropdownMenuItem>
				) : null}
				<DropdownMenuItem
					disabled={working}
					onClick={async (e) => {
						e.preventDefault();
						setWorking(true);
						try {
							if (published) {
								await unpublish({ id: ndaId });
								toast.success("Unpublished");
							} else {
								await publish({ id: ndaId, publicReadable: false });
								toast.success("Published — share the link with a token");
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
					<CheckIcon className="h-4 w-4" />
					{published ? "Unpublish" : "Publish"}
				</DropdownMenuItem>
				<DropdownMenuItem
					disabled={working}
					onClick={async (e) => {
						e.preventDefault();
						if (
							!window.confirm(
								"Regenerate share URL? Old links to this NDA will stop working.",
							)
						)
							return;
						setWorking(true);
						try {
							const next = await regenerate({ id: ndaId });
							toast.success("URL refreshed", {
								description: `New: /n/${next}`,
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
					<RefreshCwIcon className="h-4 w-4" />
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
								`Delete "${title}"? This removes the editable NDA. Any signed copy is kept.`,
							)
						)
							return;
						setWorking(true);
						try {
							await removeNda({ id: ndaId });
							toast.success("NDA deleted");
						} catch (err) {
							toast.error("Could not delete", {
								description: err instanceof Error ? err.message : String(err),
							});
						} finally {
							setWorking(false);
						}
					}}
				>
					<Trash2Icon className="h-4 w-4" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
