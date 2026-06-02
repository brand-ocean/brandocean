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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/ndas/")({
	component: NdasList,
});

type Language = "nl" | "en";
type Direction = "owner_signs" | "client_signs";

const NONE_VALUE = "__none__";

function NdasList() {
	const ndas = useQuery(api.ndas.listByOwner, {});
	const clients = useQuery(api.clients.list);
	const createNda = useMutation(api.ndas.create);
	const navigate = useNavigate();
	const [title, setTitle] = useState("NDA");
	const [language, setLanguage] = useState<Language>("nl");
	const [direction, setDirection] = useState<Direction>("owner_signs");
	const [clientId, setClientId] = useState<string>(NONE_VALUE);
	const [creating, setCreating] = useState(false);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-10">
			<header className="flex flex-col gap-2">
				<h1 className="text-3xl font-semibold tracking-tight">NDAs</h1>
				<p className="text-base text-muted-foreground">
					One-way non-disclosure agreements. <strong>I sign</strong> = you
					promise to keep the client's data confidential (auto-signed with your
					signature). <strong>Client signs</strong> = the client promises to
					keep your info confidential and signs online.
				</p>
			</header>

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
			>
				<div className="flex flex-wrap items-center gap-2">
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="NDA title…"
						className="min-w-48 flex-1"
					/>
					<Select
						value={direction}
						onValueChange={(v) => setDirection(v as Direction)}
					>
						<SelectTrigger className="w-48">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="owner_signs">I sign (client data)</SelectItem>
							<SelectItem value="client_signs">Client signs</SelectItem>
						</SelectContent>
					</Select>
					<Select
						value={language}
						onValueChange={(v) => setLanguage(v as Language)}
					>
						<SelectTrigger className="w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="nl">Dutch</SelectItem>
							<SelectItem value="en">English</SelectItem>
						</SelectContent>
					</Select>
					{clients && clients.length > 0 ? (
						<Select
							value={clientId}
							onValueChange={(v) => setClientId(v ?? NONE_VALUE)}
						>
							<SelectTrigger className="w-44">
								<SelectValue placeholder="No client" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>
									<span className="text-muted-foreground">No client</span>
								</SelectItem>
								{clients.map((c) => (
									<SelectItem key={c._id} value={c._id}>
										{c.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : null}
					<Button type="submit" disabled={creating || !title.trim()}>
						<PlusIcon data-icon="inline-start" />
						{creating ? "Creating…" : "Create"}
					</Button>
				</div>
			</form>

			{ndas === undefined ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-14" />
					<Skeleton className="h-14" />
					<Skeleton className="h-14" />
				</div>
			) : ndas.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<ShieldCheckIcon />
						</EmptyMedia>
						<EmptyTitle>No NDAs yet</EmptyTitle>
						<EmptyDescription>
							Create your first one above. It starts from a ready-made one-way
							NDA template you can edit.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="divide-y rounded-lg border bg-card">
					{ndas.map((n) => (
						<NdaRow
							key={n._id}
							ndaId={n._id}
							title={n.title}
							slug={n.slug}
							shareToken={n.shareToken}
							language={n.language}
							updatedAt={n.updatedAt}
							published={n.published}
							publicReadable={n.publicReadable}
							signedSlug={n.signedSlug ?? null}
						/>
					))}
				</ul>
			)}
		</div>
	);
}

function NdaRow({
	ndaId,
	title,
	slug,
	shareToken,
	language,
	updatedAt,
	published,
	publicReadable,
	signedSlug,
}: {
	ndaId: Id<"ndas">;
	title: string;
	slug: string;
	shareToken: string;
	language: Language;
	updatedAt: number;
	published: boolean;
	publicReadable: boolean;
	signedSlug: string | null;
}) {
	return (
		<li className="group relative">
			<Link
				to="/ndas/$ndaId"
				params={{ ndaId }}
				className="flex items-center gap-4 px-6 py-5 pr-16 hover:bg-muted/50"
			>
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					<span className="truncate text-base font-medium">{title}</span>
					<span className="text-sm text-muted-foreground">
						Updated {new Date(updatedAt).toLocaleDateString()}
					</span>
				</div>
				<Badge variant="outline" className="shrink-0 uppercase">
					{language}
				</Badge>
				{signedSlug ? (
					<Badge variant="default" className="shrink-0">
						Signed
					</Badge>
				) : (
					<Badge
						variant={
							published ? (publicReadable ? "default" : "secondary") : "outline"
						}
						className="shrink-0"
					>
						{published ? (publicReadable ? "Public" : "Shared") : "Draft"}
					</Badge>
				)}
			</Link>
			<div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 data-[state=open]:opacity-100">
				<NdaRowMenu
					ndaId={ndaId}
					title={title}
					slug={slug}
					shareToken={shareToken}
					published={published}
					publicReadable={publicReadable}
					signedSlug={signedSlug}
				/>
			</div>
		</li>
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
					/n/{slug}
				</div>
				<DropdownMenuSeparator />
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
