import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	CheckCircle2Icon,
	FileTextIcon,
	ListTodoIcon,
	UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/_authed/_app/dashboard/")({
	component: DashboardPage,
});

function DashboardPage() {
	const stats = useQuery(api.dashboard.summary);
	const recents = useQuery(api.dashboard.recents);

	return (
		<div className="mx-auto w-full max-w-6xl space-y-10">
			<header className="flex flex-col gap-2">
				<h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
				<p className="text-base text-muted-foreground">
					Where things stand right now.
				</p>
			</header>

			{stats === undefined || stats === null ? (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<Skeleton className="h-28" />
					<Skeleton className="h-28" />
					<Skeleton className="h-28" />
					<Skeleton className="h-28" />
				</div>
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<Stat
						label="Offertes"
						value={stats.offerteStats.total}
						hint={`${stats.offerteStats.shared} shared · ${stats.offerteStats.drafts} drafts`}
						icon={FileTextIcon}
					/>
					<Stat
						label="Open tasks"
						value={stats.taskStats.todo + stats.taskStats.inProgress}
						hint={`${stats.taskStats.todo} todo · ${stats.taskStats.inProgress} in progress`}
						icon={ListTodoIcon}
					/>
					<Stat
						label="Done this week"
						value={stats.taskStats.doneThisWeek}
						hint="Tasks closed in the last 7 days"
						icon={CheckCircle2Icon}
					/>
					<Stat
						label="Clients"
						value={stats.clientCount}
						hint="People & companies you work with"
						icon={UsersIcon}
					/>
				</div>
			)}

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<RecentBlock
					title="Recent offertes"
					empty="No offertes yet."
					loading={recents === undefined || recents === null}
					items={(recents?.offertes ?? []).map((o) => ({
						key: o._id,
						to: "/offertes/$offerteId" as const,
						params: { offerteId: o._id },
						title: o.title,
						meta: new Date(o.updatedAt).toLocaleDateString(),
						badge: o.published ? "Shared" : "Draft",
					}))}
				/>
				<RecentBlock
					title="Recent tasks"
					empty="No tasks yet."
					loading={recents === undefined || recents === null}
					items={(recents?.tasks ?? []).map((t) => ({
						key: t._id,
						to: "/tasks" as const,
						params: undefined,
						title: t.title,
						meta: new Date(t.updatedAt).toLocaleDateString(),
						badge:
							t.status === "done"
								? "Done"
								: t.status === "in_progress"
									? "In progress"
									: t.status === "canceled"
										? "Canceled"
										: "Todo",
					}))}
				/>
			</div>
		</div>
	)
}

type IconType = React.ComponentType<{ className?: string }>;

function Stat({
	label,
	value,
	hint,
	icon: Icon,
}: {
	label: string;
	value: number;
	hint: string;
	icon: IconType;
}) {
	return (
		<div className="rounded-lg border bg-card p-5">
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">{label}</p>
				<Icon className="size-4 text-muted-foreground" />
			</div>
			<p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
			<p className="mt-1 text-xs text-muted-foreground">{hint}</p>
		</div>
	)
}

type RecentItem = {
	key: string;
	to: "/offertes/$offerteId" | "/tasks";
	params: { offerteId: string } | undefined;
	title: string;
	meta: string;
	badge: string;
};

function RecentBlock({
	title,
	empty,
	items,
	loading,
}: {
	title: string;
	empty: string;
	items: RecentItem[];
	loading?: boolean;
}) {
	return (
		<div className="rounded-lg border bg-card">
			<div className="border-b px-5 py-4">
				<h2 className="text-base font-semibold">{title}</h2>
			</div>
			{loading ? (
				<div className="space-y-2 px-5 py-4">
					<Skeleton className="h-6" />
					<Skeleton className="h-6" />
					<Skeleton className="h-6" />
				</div>
			) : items.length === 0 ? (
				<p className="px-5 py-6 text-sm text-muted-foreground">{empty}</p>
			) : (
				<ul className="divide-y">
					{items.map((it) => (
						<li key={it.key}>
							{it.params ? (
								<Link
									to={it.to}
									params={it.params}
									className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/50"
								>
									<RowContent title={it.title} meta={it.meta} />
									<Badge variant="outline">{it.badge}</Badge>
								</Link>
							) : (
								<Link
									to={it.to}
									className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-muted/50"
								>
									<RowContent title={it.title} meta={it.meta} />
									<Badge variant="outline">{it.badge}</Badge>
								</Link>
							)}
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

function RowContent({ title, meta }: { title: string; meta: string }) {
	return (
		<div className="min-w-0 flex-1">
			<p className="truncate text-sm font-medium">{title}</p>
			<p className="text-xs text-muted-foreground">{meta}</p>
		</div>
	)
}
