import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	PlusIcon,
	RefreshCwIcon,
	Trash2Icon,
	UserIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import {
	Frame,
	FrameHeader,
	FrameHeading,
	FramePanel,
} from "@/components/app/frame";
import { usePageTitle } from "@/components/app/page-title";
import { TonePill } from "@/components/app/tone";
import { NoteEditor } from "@/components/offertes/NoteEditor";
import { OfferteEditor } from "@/components/offertes/OfferteEditor";
import { ShareControls } from "@/components/offertes/ShareControls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/offertes/$offerteId")({
	component: OfferteDetail,
});

type ItemDoc = {
	_id: Id<"items">;
	sectionId: Id<"sections">;
	label: string;
	completed: boolean;
	order: number;
	note?: unknown;
};

type SectionDoc = {
	_id: Id<"sections">;
	title: string;
	order: number;
};

function OfferteDetail() {
	const { offerteId } = Route.useParams();
	const id = offerteId as Id<"offertes">;
	const data = useQuery(api.offertes.getById, { id });
	usePageTitle(data?.offerte.title);

	if (data === undefined) {
		return (
			<Frame className="mx-auto w-full max-w-4xl">
				<FramePanel>
					<Skeleton className="mb-4 h-8 w-2/3" />
					<Skeleton className="h-64" />
				</FramePanel>
			</Frame>
		)
	}

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-4.5">
			<Frame>
				<FrameHeader>
					<FrameHeading>
						<EditorHeader offerteId={id} title={data.offerte.title} />
					</FrameHeading>
				</FrameHeader>
				<FramePanel flush className="p-2">
					<OfferteActionBar
						offerteId={id}
						slug={data.offerte.slug}
						shareToken={data.offerte.shareToken}
						published={data.offerte.published}
						publicReadable={data.offerte.publicReadable}
						clientId={data.offerte.clientId}
					/>
				</FramePanel>
			</Frame>

			<BodyEditorBlock
				offerteId={id}
				body={data.offerte.body as JSONContent | undefined}
			/>
			<SectionsEditor
				offerteId={id}
				sections={data.sections}
				items={data.items}
			/>
		</div>
	)
}

function OfferteActionBar({
	offerteId,
	slug,
	shareToken,
	published,
	publicReadable,
	clientId,
}: {
	offerteId: Id<"offertes">;
	slug: string;
	shareToken: string;
	published: boolean;
	publicReadable: boolean;
	clientId: Id<"clients"> | undefined;
}) {
	const status = !published
		? { label: "Draft", tone: "muted" as const }
		: publicReadable
			? { label: "Public", tone: "success" as const }
			: { label: "Shared via link", tone: "info" as const };

	return (
		<div className="flex flex-wrap items-center gap-2">
			<TonePill dot tone={status.tone} className="ml-1">
				{status.label}
			</TonePill>
			<Separator orientation="vertical" className="mx-1 !h-6" />
			<ClientPickerCompact offerteId={offerteId} clientId={clientId} />
			<div className="ml-auto flex items-center gap-1">
				<CopyPublicUrlButton
					slug={slug}
					shareToken={shareToken}
					publicReadable={publicReadable}
					published={published}
				/>
				<RefreshSlugButton offerteId={offerteId} />
				<ShareControls
					offerteId={offerteId}
					slug={slug}
					shareToken={shareToken}
					published={published}
					publicReadable={publicReadable}
					hideBadge
				/>
				<DeleteOfferteButton offerteId={offerteId} />
			</div>
		</div>
	)
}

function CopyPublicUrlButton({
	slug,
	shareToken,
	publicReadable,
	published,
}: {
	slug: string;
	shareToken: string;
	publicReadable: boolean;
	published: boolean;
}) {
	const [copied, setCopied] = useState(false);
	const origin = typeof window !== "undefined" ? window.location.origin : "";
	const url = publicReadable
		? `${origin}/o/${slug}`
		: `${origin}/o/${slug}?t=${shareToken}`;
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(url);
					setCopied(true);
					toast.success(
						published ? "Public URL copied" : "URL copied — publish to enable",
					)
					setTimeout(() => setCopied(false), 1500);
				} catch (err) {
					toast.error("Could not copy", {
						description: err instanceof Error ? err.message : String(err),
					})
				}
			}}
		>
			{copied ? (
				<CheckIcon data-icon="inline-start" />
			) : (
				<CopyIcon data-icon="inline-start" />
			)}
			Copy public URL
		</Button>
	)
}

function RefreshSlugButton({ offerteId }: { offerteId: Id<"offertes"> }) {
	const regenerate = useMutation(api.offertes.regenerateSlug);
	const [working, setWorking] = useState(false);
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			disabled={working}
			onClick={async () => {
				if (
					!window.confirm(
						"Regenerate the share URL? Old links to this offerte will stop working.",
					)
				)
					return;
				setWorking(true);
				try {
					const slug = await regenerate({ id: offerteId });
					toast.success("URL refreshed", {
						description: `New slug: ${slug}`,
					});
				} catch (err) {
					toast.error("Could not refresh URL", {
						description: err instanceof Error ? err.message : String(err),
					});
				} finally {
					setWorking(false);
				}
			}}
			aria-label="Refresh URL"
			className="text-muted-foreground"
		>
			<RefreshCwIcon className="h-4 w-4" />
		</Button>
	);
}

function DeleteOfferteButton({ offerteId }: { offerteId: Id<"offertes"> }) {
	const removeOfferte = useMutation(api.offertes.remove);
	const navigate = useNavigate();
	const [removing, setRemoving] = useState(false);
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			disabled={removing}
			onClick={async () => {
				if (
					!window.confirm(
						"Delete this offerte? This permanently removes it and all its sections.",
					)
				)
					return
				setRemoving(true);
				try {
					await removeOfferte({ id: offerteId });
					toast.success("Offerte deleted");
					navigate({ to: "/offertes" });
				} catch (err) {
					toast.error("Could not delete", {
						description: err instanceof Error ? err.message : String(err),
					})
					setRemoving(false);
				}
			}}
			aria-label="Delete offerte"
			className="text-muted-foreground hover:text-destructive"
		>
			<Trash2Icon className="h-4 w-4" />
		</Button>
	)
}

const NONE_VALUE = "__none__";

function ClientPickerCompact({
	offerteId,
	clientId,
}: {
	offerteId: Id<"offertes">;
	clientId: Id<"clients"> | undefined;
}) {
	const clients = useQuery(api.clients.list);
	const updateMeta = useMutation(api.offertes.updateMeta);
	if (clients === undefined) {
		return <Skeleton className="h-8 w-44" />;
	}
	if (clients.length === 0) {
		return (
			<Link
				to="/clients"
				className="text-xs text-muted-foreground hover:text-foreground"
			>
				+ add a client
			</Link>
		)
	}
	const current = clientId ? clients.find((c) => c._id === clientId) : null;
	const initials = current
		? current.name
				.split(/\s+/)
				.map((w) => w[0])
				.slice(0, 2)
				.join("")
				.toUpperCase()
		: null;
	return (
		<div className="flex items-center gap-1.5">
			<Select
				value={clientId ?? NONE_VALUE}
				onValueChange={async (value) => {
					try {
						await updateMeta({
							id: offerteId,
							clientId:
								value === NONE_VALUE ? undefined : (value as Id<"clients">),
						})
					} catch (err) {
						toast.error("Could not update", {
							description: err instanceof Error ? err.message : String(err),
						})
					}
				}}
			>
				<SelectTrigger className="h-8 gap-2 border-dashed text-sm">
					{current ? (
						<div className="flex items-center gap-2">
							<span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
								{initials}
							</span>
							<span className="truncate font-medium">{current.name}</span>
							{current.companyName ? (
								<span className="truncate text-muted-foreground">
									· {current.companyName}
								</span>
							) : null}
						</div>
					) : (
						<div className="flex items-center gap-2 text-muted-foreground">
							<UserIcon className="h-3.5 w-3.5" />
							<SelectValue placeholder="No client" />
						</div>
					)}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={NONE_VALUE}>
						<span className="text-muted-foreground">No client</span>
					</SelectItem>
					{clients.map((c) => (
						<SelectItem key={c._id} value={c._id}>
							<div className="flex items-center gap-2">
								<span className="font-medium">{c.name}</span>
								{c.companyName ? (
									<span className="text-muted-foreground">
										· {c.companyName}
									</span>
								) : null}
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{current ? (
				<Link
					to="/clients/$clientId"
					params={{ clientId: current._id }}
					aria-label="Open client"
					className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
				>
					<ExternalLinkIcon className="h-3.5 w-3.5" />
				</Link>
			) : null}
		</div>
	)
}

function BodyEditorBlock({
	offerteId,
	body,
}: {
	offerteId: Id<"offertes">;
	body: JSONContent | undefined;
}) {
	const updateBody = useMutation(api.offertes.updateBody);
	return (
		<OfferteEditor
			value={body}
			onChange={(doc) => void updateBody({ id: offerteId, body: doc })}
		/>
	)
}

function EditorHeader({
	offerteId,
	title,
}: {
	offerteId: Id<"offertes">;
	title: string;
}) {
	const updateMeta = useMutation(api.offertes.updateMeta);
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState(title);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (editing) inputRef.current?.focus();
	}, [editing]);

	if (!editing) {
		return (
			<button
				type="button"
				onClick={() => {
					setValue(title);
					setEditing(true);
				}}
				className="-mx-1 rounded px-1 text-left text-sm font-semibold transition-colors hover:bg-muted"
				title="Click to rename"
			>
				{title}
			</button>
		)
	}

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				if (value.trim() && value.trim() !== title) {
					try {
						await updateMeta({ id: offerteId, title: value.trim() });
					} catch (err) {
						toast.error("Could not rename", {
							description: err instanceof Error ? err.message : String(err),
						})
					}
				}
				setEditing(false);
			}}
		>
			<Input
				ref={inputRef}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onBlur={() => setEditing(false)}
				className="h-7 text-sm font-semibold"
			/>
		</form>
	)
}

function SectionsEditor({
	offerteId,
	sections,
	items,
}: {
	offerteId: Id<"offertes">;
	sections: SectionDoc[];
	items: ItemDoc[];
}) {
	const addSection = useMutation(api.sections.add);
	const [newSection, setNewSection] = useState("");

	const sorted = [...sections].sort((a, b) => a.order - b.order);

	return (
		<div className="space-y-8">
			{sorted.length === 0 ? (
				<p className="text-base text-muted-foreground">
					No sections yet — add one below to start.
				</p>
			) : (
				sorted.map((s) => (
					<SectionBlock
						key={s._id}
						section={s}
						items={items.filter((i) => i.sectionId === s._id)}
					/>
				))
			)}

			<form
				onSubmit={async (e) => {
					e.preventDefault();
					if (!newSection.trim()) return;
					try {
						await addSection({
							offerteId,
							title: newSection.trim(),
						})
						setNewSection("")
					} catch (err) {
						toast.error("Could not add section", {
							description: err instanceof Error ? err.message : String(err),
						})
					}
				}}
			>
				<div className="flex items-center gap-2">
					<Input
						value={newSection}
						onChange={(e) => setNewSection(e.target.value)}
						placeholder="New section title…"
						className="flex-1"
					/>
					<Button
						type="submit"
						variant="outline"
						disabled={!newSection.trim()}
					>
						<PlusIcon data-icon="inline-start" />
						Add section
					</Button>
				</div>
			</form>
		</div>
	)
}

function SectionBlock({
	section,
	items,
}: {
	section: SectionDoc;
	items: ItemDoc[];
}) {
	const addItem = useMutation(api.items.add);
	const [newItem, setNewItem] = useState("");

	const sorted = [...items].sort((a, b) => a.order - b.order);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base font-medium uppercase tracking-wide text-muted-foreground">
					{section.title}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-6">
				{sorted.map((item) => (
					<ItemRow key={item._id} item={item} />
				))}
				<form
					onSubmit={async (e) => {
						e.preventDefault();
						if (!newItem.trim()) return;
						try {
							await addItem({
								sectionId: section._id,
								label: newItem.trim(),
							})
							setNewItem("")
						} catch (err) {
							toast.error("Could not add item", {
								description: err instanceof Error ? err.message : String(err),
							})
						}
					}}
				>
					<div className="flex items-center gap-2">
						<Input
							value={newItem}
							onChange={(e) => setNewItem(e.target.value)}
							placeholder="New item…"
							className="flex-1"
						/>
						<Button
							type="submit"
							variant="ghost"
							size="sm"
							disabled={!newItem.trim()}
						>
							<PlusIcon data-icon="inline-start" />
							Add
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	)
}

function ItemRow({ item }: { item: ItemDoc }) {
	const toggleItem = useMutation(api.items.toggle).withOptimisticUpdate(
		(store, { id }) => {
			for (const { args, value } of store.getAllQueries(api.offertes.getById)) {
				if (!value) continue;
				if (!value.items.some((i) => i._id === id)) continue;
				store.setQuery(api.offertes.getById, args, {
					...value,
					items: value.items.map((i) =>
						i._id === id ? { ...i, completed: !i.completed } : i,
					),
				})
			}
		},
	)
	const updateNote = useMutation(api.items.updateNote);
	const removeItem = useMutation(api.items.remove);

	return (
		<div className="group border-b pb-6 last:border-b-0 last:pb-0">
			<div className="flex items-start gap-3">
				<Checkbox
					checked={item.completed}
					onCheckedChange={() => void toggleItem({ id: item._id })}
					className="mt-1"
				/>
				<div className="flex-1 space-y-1">
					<div
						className={`text-base font-medium ${
							item.completed ? "text-muted-foreground line-through" : ""
						}`}
					>
						{item.label}
					</div>
					<NoteEditor
						value={item.note as Parameters<typeof NoteEditor>[0]["value"]}
						onChange={(doc) => void updateNote({ id: item._id, note: doc })}
						placeholder="Add a note, links, sub-tasks…"
					/>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={() => void removeItem({ id: item._id })}
					aria-label="Delete item"
					className="opacity-0 transition-opacity group-hover:opacity-100"
				>
					<Trash2Icon />
				</Button>
			</div>
		</div>
	)
}
