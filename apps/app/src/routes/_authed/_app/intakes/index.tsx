import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { InboxIcon } from "lucide-react";

import { type Column, DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import {
	Frame,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FrameTitle,
} from "@/components/app/frame";
import { type Tone, TonePill } from "@/components/app/tone";
import { TableRow } from "@/components/ui/table";
import { api } from "~convex/_generated/api";
import type { Doc } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/intakes/")({
	component: IntakesList,
});

const STATUS_TONE: Record<Doc<"intakes">["status"], Tone> = {
	vragen: "info",
	denkt: "warning",
	klaar: "success",
	afgebroken: "muted",
};

const STATUS_LABEL: Record<Doc<"intakes">["status"], string> = {
	vragen: "Bezig",
	denkt: "Leest terug",
	klaar: "Klaar",
	afgebroken: "Afgebroken",
};

function formatDate(ms: number): string {
	return new Date(ms).toLocaleDateString("nl-NL", {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function IntakesList() {
	const intakes = useQuery(api.intakes.listForOwner);

	const columns: readonly Column<Doc<"intakes">>[] = [
		{
			id: "naam",
			header: "Van",
			cell: (row) => (
				<div className="flex flex-col">
					<span className="font-medium">{row.name || "Naamloos"}</span>
					{row.company ? (
						<span className="text-muted-foreground text-xs">{row.company}</span>
					) : null}
				</div>
			),
			sortValue: (row) => row.name ?? "",
		},
		{
			id: "stack",
			header: "Aanpak",
			cell: (row) => (
				<span className="text-muted-foreground">{row.stackAdvies ?? "—"}</span>
			),
		},
		{
			id: "status",
			header: "Status",
			cell: (row) => (
				<TonePill tone={STATUS_TONE[row.status]} dot>
					{STATUS_LABEL[row.status]}
				</TonePill>
			),
			sortValue: (row) => row.status,
		},
		{
			id: "binnen",
			header: "Binnengekomen",
			align: "right",
			cell: (row) => (
				<span className="text-muted-foreground tabular-nums">
					{formatDate(row.createdAt)}
				</span>
			),
			sortValue: (row) => row.createdAt,
		},
	];

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Intakes</FrameTitle>
					<FrameDescription>
						Wat er via het formulier op de site binnenkomt. De samenvatting ging
						naar de klant, de brief is voor jou.
					</FrameDescription>
				</FrameHeading>
			</FrameHeader>

			<DataTable
				rows={intakes ?? []}
				columns={columns}
				getRowKey={(row) => row._id}
				loading={intakes === undefined}
				noun="intakes"
				defaultSort={{ id: "binnen", dir: "desc" }}
				renderRow={(row, cells) => (
					<TableRow key={row._id} className="cursor-pointer">
						<Link
							to="/intakes/$intakeId"
							params={{ intakeId: row._id }}
							className="contents"
						>
							{cells}
						</Link>
					</TableRow>
				)}
				empty={
					<EmptyState
						icon={InboxIcon}
						title="Nog niets binnen"
						description="Zodra iemand het formulier op brandocean.nl invult, staat het hier."
					/>
				}
			/>
		</Frame>
	);
}
