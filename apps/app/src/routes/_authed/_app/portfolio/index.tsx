import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import {
	ChevronDownIcon,
	ChevronUpIcon,
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
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/portfolio/")({
	component: PortfolioAdmin,
});

function PortfolioAdmin() {
	const items = useQuery(api.portfolio.listAll);
	const remove = useMutation(api.portfolio.remove);
	const reorder = useMutation(api.portfolio.reorder);
	const bulkImport = useMutation(api.portfolio.bulkImport);
	const [importing, setImporting] = useState(false);

	const sorted = items
		? [...items].sort((a, b) => a.order - b.order)
		: undefined;

	/**
	 * Swap this item's order with its neighbour. Orders are sparse (and the
	 * pinned items are negative), so swapping the two values is enough — no
	 * renumbering pass over the whole list.
	 */
	const move = async (index: number, delta: number) => {
		if (!sorted) return;
		const target = index + delta;
		if (target < 0 || target >= sorted.length) return;
		const a = sorted[index];
		const b = sorted[target];
		try {
			await reorder({
				updates: [
					{ id: a._id, order: b.order },
					{ id: b._id, order: a.order },
				],
			});
		} catch (err) {
			toast.error("Volgorde wijzigen mislukt", {
				description: err instanceof Error ? err.message : String(err),
			});
		}
	};

	const onDelete = async (id: Id<"portfolioItems">, title: string) => {
		if (!confirm(`"${title}" verwijderen?`)) return;
		try {
			await remove({ id });
			toast.success("Verwijderd");
		} catch (err) {
			toast.error("Verwijderen mislukt", {
				description: err instanceof Error ? err.message : String(err),
			});
		}
	};

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Portfolio</FrameTitle>
					<FrameDescription>
						Het werk op brandocean.nl, in de volgorde waarin het getoond wordt.
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
											`Je hebt al ${items.length} item(s). Vervangen door de ${BRANDOCEAN_SEED.length} items van brandocean.nl? Annuleer om ze ernaast te zetten.`,
										)
									: false;
							setImporting(true);
							try {
								const ids = await bulkImport({
									items: BRANDOCEAN_SEED,
									replaceExisting: replace,
								});
								toast.success(`${ids.length} items geïmporteerd`);
							} catch (err) {
								toast.error("Import mislukt", {
									description: err instanceof Error ? err.message : String(err),
								});
							} finally {
								setImporting(false);
							}
						}}
					>
						<DownloadIcon data-icon="inline-start" />
						{importing ? "Importeren…" : "Importeer van brandocean.nl"}
					</Button>
					<Button
						size="sm"
						render={<Link to="/portfolio/$itemId" params={{ itemId: "new" }} />}
					>
						<PlusIcon data-icon="inline-start" /> Nieuw project
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
						title="Nog geen projecten"
						description="Voeg er een toe, of haal de bestaande set van brandocean.nl binnen."
						action={
							<Button
								size="sm"
								render={
									<Link to="/portfolio/$itemId" params={{ itemId: "new" }} />
								}
							>
								<PlusIcon data-icon="inline-start" /> Nieuw project
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
									<div className="flex shrink-0 flex-col">
										<Button
											size="icon-sm"
											variant="ghost"
											className="h-5"
											aria-label={`${item.title} omhoog`}
											disabled={i === 0}
											onClick={() => void move(i, -1)}
										>
											<ChevronUpIcon />
										</Button>
										<Button
											size="icon-sm"
											variant="ghost"
											className="h-5"
											aria-label={`${item.title} omlaag`}
											disabled={i === sorted.length - 1}
											onClick={() => void move(i, 1)}
										>
											<ChevronDownIcon />
										</Button>
									</div>
									<div className="size-10 shrink-0 overflow-hidden rounded border bg-muted">
										{item.heroImageUrl ? (
											<img
												src={item.heroImageUrl}
												alt=""
												className="size-full object-cover"
											/>
										) : null}
									</div>
									<div className="flex min-w-0 flex-col">
										<span className="truncate font-medium">{item.title}</span>
										<span className="truncate text-xs text-muted-foreground">
											{item.category} · {item.project}
											{item.blocks?.length
												? ` · ${item.blocks.length} blokken`
												: ""}
										</span>
									</div>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									{item.featured ? (
										<TonePill tone="info">Uitgelicht</TonePill>
									) : null}
									<TonePill dot tone={item.published ? "success" : "muted"}>
										{item.published ? "Live" : "Concept"}
									</TonePill>
									<Button
										size="icon-sm"
										variant="ghost"
										aria-label={`${item.title} bewerken`}
										render={
											<Link
												to="/portfolio/$itemId"
												params={{ itemId: item._id }}
											/>
										}
									>
										<PencilIcon />
									</Button>
									<Button
										size="icon-sm"
										variant="ghost"
										aria-label={`${item.title} verwijderen`}
										onClick={() => void onDelete(item._id, item.title)}
									>
										<TrashIcon />
									</Button>
								</div>
							</li>
						))}
					</ul>
				)}
			</FramePanel>
		</Frame>
	);
}
