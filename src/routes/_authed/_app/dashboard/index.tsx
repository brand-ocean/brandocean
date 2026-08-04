import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	ArrowRightIcon,
	BanknoteIcon,
	FileTextIcon,
	ListTodoIcon,
	ReceiptIcon,
	ShieldCheckIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { type Column, DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import {
	Frame,
	FrameActions,
	FrameDescription,
	FrameFooter,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { StatStrip } from "@/components/app/stat-strip";
import { type Tone, TonePill } from "@/components/app/tone";
import { ToolbarSearch } from "@/components/app/toolbar";
import { Button } from "@/components/ui/button";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { TableRow } from "@/components/ui/table";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/dashboard/")({
	component: DashboardPage,
});

type QueueRow = {
	key: string;
	kind: "offerte" | "nda" | "invoice" | "task";
	id: string;
	title: string;
	status: string;
	client: string | null;
	amount: number | null;
	currency: string | null;
	updatedAt: number;
};

const KIND_LABEL: Record<QueueRow["kind"], string> = {
	offerte: "Offerte",
	nda: "NDA",
	invoice: "Invoice",
	task: "Task",
};

const KIND_ICON: Record<
	QueueRow["kind"],
	React.ComponentType<{ className?: string }>
> = {
	offerte: FileTextIcon,
	nda: ShieldCheckIcon,
	invoice: ReceiptIcon,
	task: ListTodoIcon,
};

const STATUS_TONE: Record<string, Tone> = {
	draft: "muted",
	shared: "info",
	public: "success",
	signed: "success",
	sent: "info",
	paid: "success",
	overdue: "danger",
	void: "muted",
	todo: "muted",
	prio: "danger",
	in_progress: "info",
	in_review: "warning",
	done: "success",
	canceled: "muted",
};

const STATUS_LABEL: Record<string, string> = {
	in_progress: "In progress",
	in_review: "In review",
	prio: "Priority",
};

function statusLabel(status: string) {
	return STATUS_LABEL[status] ?? status[0].toUpperCase() + status.slice(1);
}

function money(cents: number, currency: string) {
	return new Intl.NumberFormat("nl-NL", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

function relative(ts: number) {
	const mins = Math.round((Date.now() - ts) / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins} min ago`;
	const hours = Math.round(mins / 60);
	if (hours < 24) return `${hours} hr ago`;
	const days = Math.round(hours / 24);
	if (days < 30) return `${days}d ago`;
	return new Date(ts).toLocaleDateString();
}

const paceConfig: ChartConfig = {
	offertes: { label: "Offertes", color: "var(--color-violet-500)" },
	signed: { label: "NDAs signed", color: "var(--color-emerald-500)" },
	done: { label: "Tasks done", color: "var(--color-zinc-400)" },
};

const revenueConfig: ChartConfig = {
	invoiced: { label: "Invoiced", color: "var(--color-zinc-800)" },
};

function DashboardPage() {
	const overview = useQuery(api.dashboard.overview);
	const navigate = useNavigate();
	const [q, setQ] = useState("");

	// The queue mixes record types, so each row routes to its own detail page.
	const openQueueRow = (row: QueueRow) => {
		if (row.kind === "offerte") {
			void navigate({
				to: "/offertes/$offerteId",
				params: { offerteId: row.id as Id<"offertes"> },
			});
		} else if (row.kind === "nda") {
			void navigate({
				to: "/ndas/$ndaId",
				params: { ndaId: row.id as Id<"ndas"> },
			});
		} else if (row.kind === "invoice") {
			void navigate({
				to: "/invoices/$invoiceId",
				params: { invoiceId: row.id as Id<"invoices"> },
			});
		} else {
			void navigate({ to: "/tasks" });
		}
	};

	const loading = overview === undefined;
	const currency = overview?.currency ?? "EUR";

	const revenueDelta = useMemo(() => {
		if (!overview) return null;
		const { current, prior } = overview.revenue;
		if (prior === 0)
			return current === 0 ? null : { value: "new", dir: "up" as const };
		const pct = Math.round(((current - prior) / prior) * 100);
		return {
			value: `${pct >= 0 ? "+" : ""}${pct}%`,
			dir: pct >= 0 ? ("up" as const) : ("down" as const),
		};
	}, [overview]);

	const queue = (overview?.queue ?? []) as QueueRow[];
	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		if (!term) return queue;
		return queue.filter(
			(r) =>
				r.title.toLowerCase().includes(term) ||
				(r.client ?? "").toLowerCase().includes(term) ||
				KIND_LABEL[r.kind].toLowerCase().includes(term),
		);
	}, [queue, q]);

	const columns: readonly Column<QueueRow>[] = useMemo(
		() => [
			{
				id: "title",
				header: "Item",
				sortValue: (r) => r.title,
				cell: (r) => {
					const Icon = KIND_ICON[r.kind];
					return (
						<div className="flex min-w-0 items-center gap-2.5">
							<span className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
								<Icon className="size-3.5" />
							</span>
							<div className="flex min-w-0 flex-col">
								<span className="truncate font-medium">{r.title}</span>
								<span className="text-xs text-muted-foreground">
									{KIND_LABEL[r.kind]}
								</span>
							</div>
						</div>
					);
				},
			},
			{
				id: "client",
				header: "Client",
				sortValue: (r) => r.client ?? "",
				cell: (r) => (
					<span className={r.client ? "" : "text-muted-foreground"}>
						{r.client ?? "—"}
					</span>
				),
			},
			{
				id: "status",
				header: "Status",
				sortValue: (r) => r.status,
				cell: (r) => (
					<TonePill dot tone={STATUS_TONE[r.status] ?? "muted"}>
						{statusLabel(r.status)}
					</TonePill>
				),
			},
			{
				id: "amount",
				header: "Amount",
				align: "right",
				sortValue: (r) => r.amount ?? -1,
				cell: (r) =>
					r.amount === null ? (
						<span className="text-muted-foreground">—</span>
					) : (
						<span className="font-medium tabular-nums">
							{money(r.amount, r.currency ?? currency)}
						</span>
					),
			},
			{
				id: "updated",
				header: "Updated",
				align: "right",
				sortValue: (r) => r.updatedAt,
				cell: (r) => (
					<span className="text-muted-foreground tabular-nums">
						{relative(r.updatedAt)}
					</span>
				),
			},
		],
		[currency],
	);

	return (
		<>
			{/* Headline numbers */}
			<Frame>
				<FramePanel>
					<div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<FrameHeading>
							<FrameTitle>Performance overview</FrameTitle>
							<FrameDescription>
								Last 30 days across offertes, NDAs and invoices
							</FrameDescription>
						</FrameHeading>
					</div>
					<StatStrip
						loading={loading}
						items={[
							{
								label: "Revenue paid",
								icon: BanknoteIcon,
								value: overview
									? money(overview.revenue.current, currency)
									: "—",
								trend: revenueDelta
									? { value: revenueDelta.value, direction: revenueDelta.dir }
									: undefined,
								hint: "vs previous 30 days",
							},
							{
								label: "Outstanding",
								icon: ReceiptIcon,
								value: overview
									? money(overview.outstanding.total, currency)
									: "—",
								trend:
									overview && overview.outstanding.overdueCount > 0
										? {
												value: String(overview.outstanding.overdueCount),
												direction: "down",
											}
										: undefined,
								hint:
									overview && overview.outstanding.overdueCount > 0
										? "past due"
										: "all on schedule",
							},
							{
								label: "Offertes shared",
								icon: FileTextIcon,
								value: overview?.counts.offertesShared ?? 0,
								hint: `${overview?.counts.offertesDrafts ?? 0} still draft`,
							},
							{
								label: "Open tasks",
								icon: ListTodoIcon,
								value: overview?.counts.openTasks ?? 0,
								hint: `${overview?.counts.tasksDoneThisWeek ?? 0} closed this week`,
							},
						]}
					/>
				</FramePanel>
				<FrameFooter>
					<span>
						{overview
							? `${overview.counts.clients} client${overview.counts.clients === 1 ? "" : "s"}, ${overview.counts.offertes} offerte${overview.counts.offertes === 1 ? "" : "s"} and ${overview.counts.ndas} NDA${overview.counts.ndas === 1 ? "" : "s"} on file.`
							: "Loading your workspace…"}
					</span>
					<Button
						variant="ghost"
						size="sm"
						render={<Link to="/invoices" />}
						className="text-foreground"
					>
						Open invoices
						<ArrowRightIcon data-icon="inline-end" />
					</Button>
				</FrameFooter>
			</Frame>

			{/* Charts */}
			<div className="grid grid-cols-1 gap-4.5 lg:grid-cols-[1.4fr_1fr]">
				<Frame>
					<FrameHeader>
						<FrameHeading>
							<FrameTitle>Pipeline pace</FrameTitle>
							<FrameDescription>
								Offertes created, NDAs signed and tasks closed per week
							</FrameDescription>
						</FrameHeading>
						<FrameActions className="gap-3 text-xs text-muted-foreground">
							{Object.entries(paceConfig).map(([key, cfg]) => (
								<span key={key} className="flex items-center gap-1.5">
									<span
										className="size-2 rounded-full"
										style={{ background: cfg.color }}
									/>
									{cfg.label}
								</span>
							))}
						</FrameActions>
					</FrameHeader>
					<FramePanel>
						{loading ? (
							<Skeleton className="h-64 w-full" />
						) : (
							<ChartContainer config={paceConfig} className="h-64 w-full">
								<AreaChart
									data={overview?.series ?? []}
									margin={{ left: 4, right: 4, top: 8 }}
								>
									<defs>
										{Object.entries(paceConfig).map(([key, cfg]) => (
											<linearGradient
												key={key}
												id={`fill-${key}`}
												x1="0"
												y1="0"
												x2="0"
												y2="1"
											>
												<stop
													offset="5%"
													stopColor={cfg.color}
													stopOpacity={0.3}
												/>
												<stop
													offset="95%"
													stopColor={cfg.color}
													stopOpacity={0}
												/>
											</linearGradient>
										))}
									</defs>
									<CartesianGrid vertical={false} strokeDasharray="3 3" />
									<XAxis
										dataKey="label"
										tickLine={false}
										axisLine={false}
										tickMargin={8}
										minTickGap={24}
										className="text-xs"
									/>
									<ChartTooltip content={<ChartTooltipContent />} />
									{(["offertes", "signed", "done"] as const).map((key) => (
										<Area
											key={key}
											dataKey={key}
											type="monotone"
											stroke={paceConfig[key].color}
											strokeWidth={2}
											fill={`url(#fill-${key})`}
											stackId={undefined}
										/>
									))}
								</AreaChart>
							</ChartContainer>
						)}
					</FramePanel>
				</Frame>

				<Frame>
					<FrameHeader>
						<FrameHeading>
							<FrameTitle>Invoiced per week</FrameTitle>
							<FrameDescription>
								Gross value of issued invoices
							</FrameDescription>
						</FrameHeading>
					</FrameHeader>
					<FramePanel>
						{loading ? (
							<Skeleton className="h-64 w-full" />
						) : (
							<>
								<div className="mb-4 flex items-baseline gap-3">
									<span className="text-2xl font-semibold tabular-nums">
										{money(
											(overview?.series ?? []).reduce(
												(a, s) => a + s.invoiced,
												0,
											),
											currency,
										)}
									</span>
									<span className="text-xs text-muted-foreground">
										last 12 weeks
									</span>
								</div>
								<ChartContainer config={revenueConfig} className="h-48 w-full">
									<BarChart
										data={overview?.series ?? []}
										margin={{ left: 4, right: 4 }}
									>
										<CartesianGrid vertical={false} strokeDasharray="3 3" />
										<XAxis
											dataKey="label"
											tickLine={false}
											axisLine={false}
											tickMargin={8}
											minTickGap={24}
											className="text-xs"
										/>
										<ChartTooltip content={<ChartTooltipContent />} />
										<Bar
											dataKey="invoiced"
											fill="var(--color-invoiced)"
											radius={[4, 4, 0, 0]}
										/>
									</BarChart>
								</ChartContainer>
							</>
						)}
					</FramePanel>
				</Frame>
			</div>

			{/* Work queue */}
			<Frame>
				<FrameHeader>
					<FrameHeading>
						<FrameTitle>Work queue</FrameTitle>
						<FrameDescription>
							{filtered.length} of {queue.length} recently updated items
						</FrameDescription>
					</FrameHeading>
					<FrameActions>
						<ToolbarSearch
							value={q}
							onValueChange={setQ}
							placeholder="Search the queue…"
						/>
						<Button size="sm" render={<Link to="/offertes" />}>
							New offerte
						</Button>
					</FrameActions>
				</FrameHeader>
				<DataTable
					rows={filtered}
					columns={columns}
					getRowKey={(r) => r.key}
					loading={loading}
					noun="items"
					pageSize={10}
					defaultSort={{ id: "updated", dir: "desc" }}
					renderRow={(row, cells) => (
						<TableRow
							className="cursor-pointer"
							onClick={() => openQueueRow(row)}
						>
							{cells}
						</TableRow>
					)}
					empty={
						<EmptyState
							icon={FileTextIcon}
							title={q ? "Nothing matched that search" : "No activity yet"}
							description={
								q
									? "Try a different name, client or type."
									: "Create an offerte, NDA or invoice and it will show up here."
							}
							action={
								q ? null : (
									<Button size="sm" render={<Link to="/offertes" />}>
										Create an offerte
									</Button>
								)
							}
						/>
					}
				/>
			</Frame>
		</>
	);
}
