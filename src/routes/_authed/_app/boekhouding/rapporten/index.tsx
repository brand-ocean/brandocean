import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	BanknoteIcon,
	ChartColumnIcon,
	ReceiptIcon,
	ScaleIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

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
import { StatStrip } from "@/components/app/stat-strip";
import { TonePill } from "@/components/app/tone";
import { CountTabs } from "@/components/app/toolbar";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";
import { todayKey } from "../-shared";

export const Route = createFileRoute("/_authed/_app/boekhouding/rapporten/")({
	component: RapportenPage,
});

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [
	CURRENT_YEAR - 2,
	CURRENT_YEAR - 1,
	CURRENT_YEAR,
	CURRENT_YEAR + 1,
	CURRENT_YEAR + 2,
];

const QUARTERS = [
	{ id: "all", label: "Heel jaar" },
	{ id: "1", label: "Q1" },
	{ id: "2", label: "Q2" },
	{ id: "3", label: "Q3" },
	{ id: "4", label: "Q4" },
] as const;

type ReportRow = {
	accountId: Id<"ledgerAccounts">;
	code: string;
	name: string;
	amountCents: number;
};

function periodRange(year: string, quarter: string) {
	if (quarter === "all") {
		return { from: `${year}-01-01`, to: `${year}-12-31` };
	}
	const q = Number(quarter);
	const startMonth = String((q - 1) * 3 + 1).padStart(2, "0");
	const endMonth = q * 3;
	const endDay = endMonth === 3 || endMonth === 12 ? "31" : "30";
	return {
		from: `${year}-${startMonth}-01`,
		to: `${year}-${String(endMonth).padStart(2, "0")}-${endDay}`,
	};
}

function RapportenPage() {
	const [tab, setTab] = useState("wv");
	const [year, setYear] = useState(String(CURRENT_YEAR));
	const [quarter, setQuarter] = useState("all");
	const [perDate, setPerDate] = useState(todayKey);

	const { from, to } = useMemo(
		() => periodRange(year, quarter),
		[year, quarter],
	);

	const winstVerlies = useQuery(
		api.boekhouding.reports.winstVerlies,
		tab === "wv" ? { from, to } : "skip",
	);
	const balans = useQuery(
		api.boekhouding.reports.balans,
		tab === "balans" && perDate !== "" ? { perDate } : "skip",
	);
	const trialBalance = useQuery(
		api.boekhouding.reports.trialBalance,
		tab === "proef" ? { from, to } : "skip",
	);

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Rapporten</FrameTitle>
					<FrameDescription>
						Winst & verlies, balans en proef- en saldibalans.
					</FrameDescription>
				</FrameHeading>
				<FrameActions className="flex-wrap">
					{tab === "balans" ? (
						<>
							{balans && !balans.balanced ? (
								<TonePill dot tone="danger">
									Balans sluit niet
								</TonePill>
							) : null}
							<Input
								type="date"
								value={perDate}
								onChange={(e) => setPerDate(e.target.value)}
								aria-label="Balans per datum"
								className="h-8 w-40"
							/>
						</>
					) : (
						<>
							<Select value={year} onValueChange={(v) => setYear(v ?? year)}>
								<SelectTrigger size="sm" className="w-24" aria-label="Boekjaar">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{YEARS.map((y) => (
										<SelectItem key={y} value={String(y)}>
											{y}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={quarter}
								onValueChange={(v) => setQuarter(v ?? quarter)}
							>
								<SelectTrigger size="sm" className="w-28" aria-label="Periode">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{QUARTERS.map((q) => (
										<SelectItem key={q.id} value={q.id}>
											{q.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</>
					)}
				</FrameActions>
			</FrameHeader>
			<CountTabs
				value={tab}
				onValueChange={setTab}
				tabs={[
					{ id: "wv", label: "Winst & verlies" },
					{ id: "balans", label: "Balans" },
					{ id: "proef", label: "Proef- en saldibalans" },
				]}
			/>
			{tab === "wv" ? <WinstVerliesTab data={winstVerlies} /> : null}
			{tab === "balans" ? <BalansTab data={balans} /> : null}
			{tab === "proef" ? <ProefSaldiTab data={trialBalance} /> : null}
		</Frame>
	);
}

function LoadingPanel() {
	return (
		<FramePanel>
			<Skeleton className="mb-4 h-8 w-2/3" />
			<Skeleton className="h-40" />
		</FramePanel>
	);
}

function SectionTable({
	title,
	rows,
	totalLabel,
	totalCents,
	extraRows = [],
}: {
	title: string;
	rows: readonly ReportRow[];
	totalLabel: string;
	totalCents: number;
	extraRows?: readonly { key: string; label: string; amountCents: number }[];
}) {
	return (
		<FramePanel flush>
			<div className="border-b px-4 py-2 text-xs font-medium text-muted-foreground">
				{title}
			</div>
			<table className="w-full text-sm">
				<tbody className="divide-y">
					{rows.length === 0 && extraRows.length === 0 ? (
						<tr>
							<td
								colSpan={2}
								className="px-4 py-4 text-center text-muted-foreground"
							>
								Geen boekingen in deze periode.
							</td>
						</tr>
					) : (
						<>
							{rows.map((row) => (
								<tr key={row.accountId}>
									<td className="px-4 py-2.5">
										<span className="font-medium tabular-nums">{row.code}</span>{" "}
										<span className="text-muted-foreground">{row.name}</span>
									</td>
									<td className="px-4 py-2.5 text-right tabular-nums">
										{formatCurrency(row.amountCents)}
									</td>
								</tr>
							))}
							{extraRows.map((row) => (
								<tr key={row.key}>
									<td className="px-4 py-2.5 text-muted-foreground">
										{row.label}
									</td>
									<td className="px-4 py-2.5 text-right tabular-nums">
										{formatCurrency(row.amountCents)}
									</td>
								</tr>
							))}
						</>
					)}
				</tbody>
				<tfoot>
					<tr className="border-t font-medium">
						<td className="px-4 py-2.5">{totalLabel}</td>
						<td className="px-4 py-2.5 text-right tabular-nums">
							{formatCurrency(totalCents)}
						</td>
					</tr>
				</tfoot>
			</table>
		</FramePanel>
	);
}

function WinstVerliesTab({
	data,
}: {
	data:
		| {
				revenue: ReportRow[];
				expenses: ReportRow[];
				revenueCents: number;
				expenseCents: number;
				resultCents: number;
		  }
		| undefined;
}) {
	if (data === undefined) return <LoadingPanel />;

	const result = data.resultCents;

	return (
		<>
			<FramePanel>
				<StatStrip
					columns={3}
					items={[
						{
							label: "Omzet",
							icon: BanknoteIcon,
							value: formatCurrency(data.revenueCents),
						},
						{
							label: "Kosten",
							icon: ReceiptIcon,
							value: formatCurrency(data.expenseCents),
						},
						{
							label: "Resultaat",
							icon: ChartColumnIcon,
							value: formatCurrency(result),
							trend: {
								value: result > 0 ? "Winst" : result < 0 ? "Verlies" : "0",
								direction: result > 0 ? "up" : result < 0 ? "down" : "flat",
							},
						},
					]}
				/>
			</FramePanel>
			<SectionTable
				title="Omzet"
				rows={data.revenue}
				totalLabel="Totaal omzet"
				totalCents={data.revenueCents}
			/>
			<SectionTable
				title="Kosten"
				rows={data.expenses}
				totalLabel="Totaal kosten"
				totalCents={data.expenseCents}
			/>
		</>
	);
}

function BalansTab({
	data,
}: {
	data:
		| {
				assets: ReportRow[];
				liabilities: ReportRow[];
				equity: ReportRow[];
				resultCents: number;
				assetsCents: number;
				liabilitiesCents: number;
				equityCents: number;
				balanced: boolean;
		  }
		| undefined;
}) {
	if (data === undefined) return <LoadingPanel />;

	return (
		<>
			<SectionTable
				title="Activa"
				rows={data.assets}
				totalLabel="Totaal activa"
				totalCents={data.assetsCents}
			/>
			<SectionTable
				title="Eigen vermogen"
				rows={data.equity}
				extraRows={[
					{
						key: "resultaat",
						label: "Resultaat boekjaar",
						amountCents: data.resultCents,
					},
				]}
				totalLabel="Totaal eigen vermogen"
				totalCents={data.equityCents}
			/>
			<SectionTable
				title="Schulden"
				rows={data.liabilities}
				totalLabel="Totaal schulden"
				totalCents={data.liabilitiesCents}
			/>
		</>
	);
}

function ProefSaldiTab({
	data,
}: {
	data:
		| {
				rows: {
					accountId: Id<"ledgerAccounts">;
					code: string;
					name: string;
					debitCents: number;
					creditCents: number;
				}[];
				totalDebitCents: number;
				totalCreditCents: number;
		  }
		| undefined;
}) {
	if (data === undefined) return <LoadingPanel />;

	const inBalance = data.totalDebitCents === data.totalCreditCents;

	if (data.rows.length === 0) {
		return (
			<FramePanel flush>
				<EmptyState
					icon={ScaleIcon}
					title="Geen boekingen"
					description="Er zijn nog geen journaalposten in deze periode."
				/>
			</FramePanel>
		);
	}

	return (
		<FramePanel flush>
			<div className="flex items-center justify-between border-b px-4 py-2">
				<span className="text-xs font-medium text-muted-foreground">
					Proef- en saldibalans
				</span>
				<TonePill dot tone={inBalance ? "success" : "danger"}>
					{inBalance ? "In evenwicht" : "Niet in evenwicht"}
				</TonePill>
			</div>
			<table className="w-full text-sm">
				<thead className="text-left text-xs text-muted-foreground [&_th]:border-b">
					<tr>
						<th className="px-4 py-3 w-24">Code</th>
						<th className="px-4 py-3">Naam</th>
						<th className="px-4 py-3 w-32 text-right">Debet</th>
						<th className="px-4 py-3 w-32 text-right">Credit</th>
					</tr>
				</thead>
				<tbody className="divide-y">
					{data.rows.map((row) => (
						<tr key={row.accountId}>
							<td className="px-4 py-2.5 font-medium tabular-nums">
								{row.code}
							</td>
							<td className="px-4 py-2.5">{row.name}</td>
							<td className="px-4 py-2.5 text-right tabular-nums">
								{formatCurrency(row.debitCents)}
							</td>
							<td className="px-4 py-2.5 text-right tabular-nums">
								{formatCurrency(row.creditCents)}
							</td>
						</tr>
					))}
				</tbody>
				<tfoot>
					<tr className="border-t font-medium">
						<td className="px-4 py-2.5" colSpan={2}>
							Totaal
						</td>
						<td className="px-4 py-2.5 text-right tabular-nums">
							{formatCurrency(data.totalDebitCents)}
						</td>
						<td className="px-4 py-2.5 text-right tabular-nums">
							{formatCurrency(data.totalCreditCents)}
						</td>
					</tr>
				</tfoot>
			</table>
		</FramePanel>
	);
}
