import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { PresentationIcon } from "lucide-react";
import { useMemo } from "react";

import { type Column, DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import {
	Frame,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FrameTitle,
} from "@/components/app/frame";
import { usePageTitle } from "@/components/app/page-title";
import { TonePill } from "@/components/app/tone";
import { TableRow } from "@/components/ui/table";
import { api } from "~convex/_generated/api";

/**
 * Borden: de klantborden op brandocean.nl/preview/<slug>, met wat kijkers
 * ermee doen. De borden zelf leven in de site-code; hier staat alleen wat
 * er ooit geopend is, uit previewEvents.
 */
export const Route = createFileRoute("/_authed/_app/borden/")({
	component: BordenPage,
});

type Row = {
	slug: string;
	client: string;
	title: string;
	visitors: number;
	sessions: number;
	lastAt: number;
	ctas: number;
};

export function timeAgo(ts: number): string {
	const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
	if (s < 60) return "zojuist";
	const m = Math.floor(s / 60);
	if (m < 60) return `${m} min geleden`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h} uur geleden`;
	const d = Math.floor(h / 24);
	if (d < 7) return `${d} dag${d === 1 ? "" : "en"} geleden`;
	return new Date(ts).toLocaleDateString("nl-NL");
}

function BordenPage() {
	usePageTitle("Borden");
	const data = useQuery(api.previewTrack.boards);
	const navigate = useNavigate();
	const rows: Row[] = useMemo(() => data ?? [], [data]);

	const columns: readonly Column<Row>[] = useMemo(
		() => [
			{
				id: "client",
				header: "Bord",
				sortValue: (r) => r.client,
				cell: (r) => (
					<div className="flex min-w-0 items-center gap-2.5">
						<span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
							<PresentationIcon className="size-3.5" />
						</span>
						<div className="flex min-w-0 flex-col">
							<span className="truncate font-medium">{r.client}</span>
							<span className="truncate font-mono text-xs text-muted-foreground">
								/preview/{r.slug}
							</span>
						</div>
					</div>
				),
			},
			{
				id: "visitors",
				header: "Kijkers",
				sortValue: (r) => r.visitors,
				cell: (r) => (
					<span className="tabular-nums">
						{r.visitors} {r.visitors === 1 ? "browser" : "browsers"}
						<span className="text-muted-foreground"> · {r.sessions}×</span>
					</span>
				),
			},
			{
				id: "ctas",
				header: "Reacties",
				sortValue: (r) => r.ctas,
				cell: (r) =>
					r.ctas > 0 ? (
						<TonePill dot tone="success">
							{r.ctas} klik{r.ctas === 1 ? "" : "ken"} op contact
						</TonePill>
					) : (
						<span className="text-muted-foreground">Nog niets</span>
					),
			},
			{
				id: "last",
				header: "Laatst",
				align: "right",
				sortValue: (r) => r.lastAt,
				cell: (r) => (
					<span className="text-muted-foreground tabular-nums">
						{timeAgo(r.lastAt)}
					</span>
				),
			},
		],
		[],
	);

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Borden</FrameTitle>
					<FrameDescription>
						Wie de klantborden opent en waar ze naar kijken.
					</FrameDescription>
				</FrameHeading>
			</FrameHeader>
			<DataTable
				rows={rows}
				columns={columns}
				getRowKey={(r) => r.slug}
				loading={data === undefined}
				noun="borden"
				defaultSort={{ id: "last", dir: "desc" }}
				renderRow={(row, cells) => (
					<TableRow
						className="cursor-pointer"
						onClick={() =>
							void navigate({
								to: "/borden/$slug",
								params: { slug: row.slug },
							})
						}
					>
						{cells}
					</TableRow>
				)}
				empty={
					<EmptyState
						icon={PresentationIcon}
						title="Nog geen bord geopend"
						description="Zodra iemand een deellink opent, verschijnt het bord hier."
					/>
				}
			/>
		</Frame>
	);
}
