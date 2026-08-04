import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	DownloadIcon,
	ImageIcon,
	PencilIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import {
	Frame,
	FrameActions,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { TonePill } from "@/components/app/tone";
import { BRANDOCEAN_SEED } from "@/components/portfolio/brandoceanSeedData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "~convex/_generated/api";
import type { Doc, Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/portfolio/")({
	component: PortfolioAdmin,
});

type PortfolioItem = Doc<"portfolioItems">;

const empty = (): Partial<PortfolioItem> => ({
	title: "",
	category: "",
	project: "",
	ctaLabel: "View Log",
	summary: "",
	heroImageUrl: "",
	bunnyVideoUrl: "",
	externalUrl: "",
	tags: [],
	published: true,
	featured: false,
});

function PortfolioAdmin() {
	const items = useQuery(api.portfolio.listAll);
	const create = useMutation(api.portfolio.create);
	const update = useMutation(api.portfolio.update);
	const remove = useMutation(api.portfolio.remove);
	const bulkImport = useMutation(api.portfolio.bulkImport);
	const [importing, setImporting] = useState(false);

	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<Partial<PortfolioItem> | null>(null);
	const [saving, setSaving] = useState(false);

	const sorted = items
		? [...items].sort((a, b) => a.order - b.order)
		: undefined;

	const startNew = () => {
		setEditing(empty());
		setOpen(true);
	}

	const startEdit = (item: PortfolioItem) => {
		setEditing(item);
		setOpen(true);
	}

	const save = async () => {
		if (!editing) return;
		if (!editing.title || !editing.category || !editing.project) {
			toast.error("Title, category, and project are required");
			return
		}
		setSaving(true);
		try {
			const payload = {
				title: editing.title,
				category: editing.category,
				project: editing.project,
				ctaLabel: editing.ctaLabel || "View Log",
				summary: editing.summary || undefined,
				heroImageUrl: editing.heroImageUrl || undefined,
				bunnyVideoUrl: editing.bunnyVideoUrl || undefined,
				bunnyVideoId: editing.bunnyVideoId || undefined,
				bunnyLibraryId: editing.bunnyLibraryId || undefined,
				externalUrl: editing.externalUrl || undefined,
				tags:
					editing.tags && editing.tags.length > 0 ? editing.tags : undefined,
				livePages:
					editing.livePages && editing.livePages.length > 0
						? editing.livePages
						: undefined,
				industry: editing.industry || undefined,
				published: editing.published ?? true,
				featured: editing.featured ?? false,
			}
			if ("_id" in editing && editing._id) {
				await update({ id: editing._id as Id<"portfolioItems">, ...payload });
				toast.success("Updated");
			} else {
				await create(payload);
				toast.success("Created");
			}
			setOpen(false);
			setEditing(null);
		} catch (err) {
			toast.error("Save failed", {
				description: err instanceof Error ? err.message : String(err),
			})
		} finally {
			setSaving(false);
		}
	}

	const onDelete = async (id: Id<"portfolioItems">) => {
		if (!confirm("Delete this portfolio item?")) return;
		try {
			await remove({ id });
			toast.success("Deleted");
		} catch (err) {
			toast.error("Delete failed", {
				description: err instanceof Error ? err.message : String(err),
			})
		}
	}

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Portfolio</FrameTitle>
					<FrameDescription>
						The Observation Registry shown on the homepage, in display order.
					</FrameDescription>
				</FrameHeading>
				<FrameActions className="flex-wrap">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={importing}
						onClick={async () => {
							const replace =
								items && items.length > 0
									? confirm(
											`You already have ${items.length} item(s). Replace them with the ${BRANDOCEAN_SEED.length} brandocean.nl items? Click Cancel to add alongside.`,
										)
									: false
							setImporting(true)
							try {
								const ids = await bulkImport({
									items: BRANDOCEAN_SEED,
									replaceExisting: replace,
								})
								toast.success(`Imported ${ids.length} portfolio items`);
							} catch (err) {
								toast.error("Import failed", {
									description: err instanceof Error ? err.message : String(err),
								})
							} finally {
								setImporting(false)
							}
						}}
					>
						<DownloadIcon data-icon="inline-start" />
						{importing ? "Importing…" : "Import from brandocean.nl"}
					</Button>
					<Button size="sm" onClick={startNew}>
						<PlusIcon data-icon="inline-start" /> Add item
					</Button>
				</FrameActions>
			</FrameHeader>

			<FramePanel flush>
				{sorted === undefined ? (
					<div className="flex flex-col gap-2 p-4">
						<Skeleton className="h-12" />
						<Skeleton className="h-12" />
						<Skeleton className="h-12" />
					</div>
				) : sorted.length === 0 ? (
					<EmptyState
						icon={ImageIcon}
						title="No portfolio items yet"
						description="Add one by hand, or pull the existing set in from brandocean.nl."
						action={
							<Button size="sm" onClick={startNew}>
								<PlusIcon data-icon="inline-start" /> Add item
							</Button>
						}
					/>
				) : (
					<ul className="divide-y">
						{sorted.map((item, i) => (
							<li
								key={item._id}
								className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
							>
								<div className="flex min-w-0 items-center gap-2.5">
									<span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-xs font-medium text-muted-foreground tabular-nums">
										{i + 1}
									</span>
									<div className="flex min-w-0 flex-col">
										<span className="truncate font-medium">{item.title}</span>
										<span className="truncate text-xs text-muted-foreground">
											{item.category} · {item.project}
										</span>
									</div>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									{item.featured ? (
										<TonePill tone="info">Featured</TonePill>
									) : null}
									<TonePill dot tone={item.published ? "success" : "muted"}>
										{item.published ? "Public" : "Draft"}
									</TonePill>
									<Button
										size="icon-sm"
										variant="ghost"
										aria-label={`Edit ${item.title}`}
										onClick={() => startEdit(item)}
									>
										<PencilIcon />
									</Button>
									<Button
										size="icon-sm"
										variant="ghost"
										aria-label={`Delete ${item.title}`}
										onClick={() => void onDelete(item._id)}
									>
										<TrashIcon />
									</Button>
								</div>
							</li>
						))}
					</ul>
				)}
			</FramePanel>

			<Sheet open={open} onOpenChange={setOpen}>
				<SheetContent className="w-full sm:max-w-xl overflow-y-auto">
					<SheetHeader>
						<SheetTitle>
							{editing && "_id" in editing ? "Edit item" : "New item"}
						</SheetTitle>
						<SheetDescription>
							Fields shown on the homepage: title, category, project, CTA label.
						</SheetDescription>
					</SheetHeader>
					{editing ? (
						<div className="flex flex-col gap-4 px-4 pb-4">
							<Field label="Title">
								<Input
									value={editing.title ?? ""}
									onChange={(e) =>
										setEditing({ ...editing, title: e.target.value })
									}
								/>
							</Field>
							<div className="grid grid-cols-2 gap-3">
								<Field label="Category">
									<Input
										value={editing.category ?? ""}
										placeholder="Scan Record"
										onChange={(e) =>
											setEditing({ ...editing, category: e.target.value })
										}
									/>
								</Field>
								<Field label="Project">
									<Input
										value={editing.project ?? ""}
										placeholder="Haven Cluster"
										onChange={(e) =>
											setEditing({ ...editing, project: e.target.value })
										}
									/>
								</Field>
							</div>
							<Field label="CTA label">
								<Input
									value={editing.ctaLabel ?? ""}
									placeholder="View Log"
									onChange={(e) =>
										setEditing({ ...editing, ctaLabel: e.target.value })
									}
								/>
							</Field>
							<Field label="Summary">
								<Textarea
									rows={3}
									value={editing.summary ?? ""}
									onChange={(e) =>
										setEditing({ ...editing, summary: e.target.value })
									}
								/>
							</Field>
							<Field label="Hero image URL">
								<Input
									value={editing.heroImageUrl ?? ""}
									placeholder="https://…"
									onChange={(e) =>
										setEditing({ ...editing, heroImageUrl: e.target.value })
									}
								/>
							</Field>
							<Field label="Bunny video URL (iframe embed)">
								<Input
									value={editing.bunnyVideoUrl ?? ""}
									placeholder="https://iframe.mediadelivery.net/embed/{lib}/{id}"
									onChange={(e) =>
										setEditing({ ...editing, bunnyVideoUrl: e.target.value })
									}
								/>
							</Field>
							<div className="grid grid-cols-2 gap-3">
								<Field label="Bunny library ID">
									<Input
										value={editing.bunnyLibraryId ?? ""}
										onChange={(e) =>
											setEditing({ ...editing, bunnyLibraryId: e.target.value })
										}
									/>
								</Field>
								<Field label="Bunny video ID">
									<Input
										value={editing.bunnyVideoId ?? ""}
										onChange={(e) =>
											setEditing({ ...editing, bunnyVideoId: e.target.value })
										}
									/>
								</Field>
							</div>
							<Field label="External URL (optional)">
								<Input
									value={editing.externalUrl ?? ""}
									placeholder="https://client.example.com"
									onChange={(e) =>
										setEditing({ ...editing, externalUrl: e.target.value })
									}
								/>
							</Field>
							<Field label="Industry tag (one short word shown beside title — e.g. RESTAURANT, AGENCY, E-COMMERCE)">
								<Input
									value={editing.industry ?? ""}
									placeholder="RESTAURANT"
									onChange={(e) =>
										setEditing({
											...editing,
											industry: e.target.value.toUpperCase(),
										})
									}
								/>
							</Field>
							<Field label="Live preview pages (one per line — full URLs or paths)">
								<Textarea
									rows={4}
									value={(editing.livePages ?? []).join("\n")}
									placeholder={
										"https://example.com/\nhttps://example.com/about\n/pricing"
									}
									onChange={(e) =>
										setEditing({
											...editing,
											livePages: e.target.value
												.split("\n")
												.map((s) => s.trim())
												.filter(Boolean),
										})
									}
								/>
							</Field>
							<div className="flex items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<Switch
										checked={editing.published ?? true}
										onCheckedChange={(v) =>
											setEditing({ ...editing, published: v })
										}
									/>
									<span className="text-sm">Published</span>
								</div>
								<div className="flex items-center gap-2">
									<Switch
										checked={editing.featured ?? false}
										onCheckedChange={(v) =>
											setEditing({ ...editing, featured: v })
										}
									/>
									<span className="text-sm">Featured</span>
								</div>
							</div>
						</div>
					) : null}
					<SheetFooter>
						<Button variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button onClick={() => void save()} disabled={saving}>
							{saving ? "Saving…" : "Save"}
						</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</Frame>
	)
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label>{label}</Label>
			{children}
		</div>
	)
}
