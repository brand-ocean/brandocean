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
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/offertes/")({
	component: OffertesList,
});

function OffertesList() {
	const offertes = useQuery(api.offertes.listByOwner, {});
	const createOfferte = useMutation(api.offertes.create);
	const navigate = useNavigate();
	const [title, setTitle] = useState("");
	const [creating, setCreating] = useState(false);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-10">
			<header className="flex flex-col gap-2">
				<h1 className="text-3xl font-semibold tracking-tight">Offertes</h1>
				<p className="text-base text-muted-foreground">
					Create and share proposal checklists with clients.
				</p>
			</header>

			<form
				onSubmit={async (e) => {
					e.preventDefault();
					if (!title.trim()) return;
					setCreating(true);
					try {
						const id = await createOfferte({ title: title.trim() });
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
						placeholder="New offerte title…"
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
					<Skeleton className="h-14" />
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
							Create your first one above to get started.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="divide-y rounded-lg border bg-card">
					{offertes.map((o) => (
						<OfferteRow
							key={o._id}
							offerteId={o._id}
							title={o.title}
							slug={o.slug}
							shareToken={o.shareToken}
							updatedAt={o.updatedAt}
							published={o.published}
							publicReadable={o.publicReadable}
						/>
					))}
				</ul>
			)}
		</div>
	);
}

function OfferteRow({
	offerteId,
	title,
	slug,
	shareToken,
	updatedAt,
	published,
	publicReadable,
}: {
	offerteId: Id<"offertes">;
	title: string;
	slug: string;
	shareToken: string;
	updatedAt: number;
	published: boolean;
	publicReadable: boolean;
}) {
	return (
		<li className="group relative">
			<Link
				to="/offertes/$offerteId"
				params={{ offerteId }}
				className="flex items-center gap-4 px-6 py-5 pr-16 hover:bg-muted/50"
			>
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<span className="truncate text-base font-medium">{title}</span>
					<span className="text-sm text-muted-foreground">
						Updated {new Date(updatedAt).toLocaleDateString()}
					</span>
				</div>
				<Badge
					variant={
						published ? (publicReadable ? "default" : "secondary") : "outline"
					}
					className="shrink-0"
				>
					{published ? (publicReadable ? "Public" : "Shared") : "Draft"}
				</Badge>
			</Link>
			<div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 data-[state=open]:opacity-100">
				<OfferteRowMenu
					offerteId={offerteId}
					title={title}
					slug={slug}
					shareToken={shareToken}
					published={published}
					publicReadable={publicReadable}
				/>
			</div>
		</li>
	);
}

function OfferteRowMenu({
	offerteId,
	title,
	slug,
	shareToken,
	published,
	publicReadable,
}: {
	offerteId: Id<"offertes">;
	title: string;
	slug: string;
	shareToken: string;
	published: boolean;
	publicReadable: boolean;
}) {
	const publish = useMutation(api.offertes.publish);
	const unpublish = useMutation(api.offertes.unpublish);
	const regenerate = useMutation(api.offertes.regenerateSlug);
	const removeOfferte = useMutation(api.offertes.remove);
	const [copied, setCopied] = useState(false);
	const [working, setWorking] = useState(false);

	const origin = typeof window !== "undefined" ? window.location.origin : "";
	const publicUrl = `${origin}/o/${slug}`;
	const tokenUrl = `${origin}/o/${slug}?t=${shareToken}`;
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
						size="icon"
						aria-label={`Actions for ${title}`}
					/>
				}
				onClick={(e) => e.preventDefault()}
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
					/o/{slug}
				</div>
				<DropdownMenuSeparator />
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
								await publish({ id: offerteId, publicReadable: !publicReadable });
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
								await unpublish({ id: offerteId });
								toast.success("Unpublished");
							} else {
								await publish({ id: offerteId, publicReadable: true });
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
					<CheckIcon className="h-4 w-4" />
					{published ? "Unpublish" : "Publish public"}
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
							const next = await regenerate({ id: offerteId });
							toast.success("URL refreshed", { description: `New: /o/${next}` });
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
								`Delete "${title}"? This permanently removes the offerte and all its sections.`,
							)
						)
							return;
						setWorking(true);
						try {
							await removeOfferte({ id: offerteId });
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
					<Trash2Icon className="h-4 w-4" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
