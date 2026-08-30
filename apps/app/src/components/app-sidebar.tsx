import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	ActivityIcon,
	ChevronRightIcon,
	FileTextIcon,
	GaugeIcon,
	LandmarkIcon,
	LayoutDashboardIcon,
	ListChecksIcon,
	MessageSquareIcon,
	MoonIcon,
	ReceiptIcon,
	SearchIcon,
	SettingsIcon,
	SunIcon,
	UsersIcon,
} from "lucide-react";
import type * as React from "react";
import { Brandmark, Logotype } from "@/components/brand";
import { NavUser } from "@/components/nav-user";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import { api } from "~convex/_generated/api";

type Leaf = {
	title: string;
	to:
		| "/dashboard"
		| "/offertes"
		| "/specs"
		| "/intakes"
		| "/ndas"
		| "/clients"
		| "/invoices"
		| "/billing"
		| "/boekhouding/grootboek"
		| "/boekhouding/rapporten"
		| "/tasks"
		| "/habits"
		| "/feedback"
		| "/portfolio"
		| "/settings";
};

type NavEntry =
	| ({ kind: "link"; icon: React.ComponentType<{ className?: string }> } & Leaf)
	| {
			kind: "group";
			title: string;
			icon: React.ComponentType<{ className?: string }>;
			items: readonly Leaf[];
	  };

const NAV: readonly NavEntry[] = [
	{
		kind: "link",
		title: "Dashboard",
		to: "/dashboard",
		icon: LayoutDashboardIcon,
	},
	{
		kind: "group",
		title: "Documents",
		icon: FileTextIcon,
		items: [
			{ title: "Offertes", to: "/offertes" },
			{ title: "Vragen", to: "/specs" },
			{ title: "Intakes", to: "/intakes" },
			{ title: "NDAs", to: "/ndas" },
			{ title: "Invoices", to: "/invoices" },
		],
	},
	{ kind: "link", title: "Clients", to: "/clients", icon: UsersIcon },
	{
		kind: "group",
		title: "Delivery",
		icon: ListChecksIcon,
		items: [
			{ title: "Tasks", to: "/tasks" },
			{ title: "Feedback", to: "/feedback" },
			{ title: "Portfolio", to: "/portfolio" },
		],
	},
	{ kind: "link", title: "Habits", to: "/habits", icon: ActivityIcon },
	{
		kind: "group",
		title: "Administratie",
		icon: LandmarkIcon,
		items: [
			{ title: "Grootboek", to: "/boekhouding/grootboek" },
			{ title: "Rapporten", to: "/boekhouding/rapporten" },
		],
	},
	{ kind: "link", title: "Usage billing", to: "/billing", icon: GaugeIcon },
	{ kind: "link", title: "Settings", to: "/settings", icon: SettingsIcon },
];

function fmtMoney(cents: number, currency: string) {
	return new Intl.NumberFormat("nl-NL", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

export function AppSidebar({
	onOpenSearch,
	...props
}: React.ComponentProps<typeof Sidebar> & { onOpenSearch: () => void }) {
	const { theme, toggleTheme } = useTheme();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const overview = useQuery(api.dashboard.overview);
	const feedback = useQuery(api.feedback.listProjects);

	const openFeedback = (feedback?.projects ?? []).reduce(
		(a, p) => a + p.openCount,
		0,
	);

	const quickViews = [
		{
			title: "Draft offertes",
			to: "/offertes" as const,
			icon: FileTextIcon,
			count: overview?.counts.offertesDrafts ?? 0,
			badge: "bg-zinc-800 text-zinc-200",
		},
		{
			title: "Open invoices",
			to: "/invoices" as const,
			icon: ReceiptIcon,
			count: overview?.outstanding.overdueCount ?? 0,
			badge: "bg-amber-500/15 text-amber-300",
		},
		{
			title: "Open feedback",
			to: "/feedback" as const,
			icon: MessageSquareIcon,
			count: openFeedback,
			badge: "bg-violet-500/15 text-violet-300",
		},
		{
			title: "Open tasks",
			to: "/tasks" as const,
			icon: ListChecksIcon,
			count: overview?.counts.openTasks ?? 0,
			badge: "bg-emerald-500/15 text-emerald-300",
		},
	];

	const paid = overview?.counts.invoicesPaid ?? 0;
	const totalInvoices = overview?.counts.invoices ?? 0;
	const paidPct =
		totalInvoices === 0 ? 0 : Math.round((paid / totalInvoices) * 100);

	return (
		<Sidebar collapsible="offcanvas" {...props}>
			<SidebarHeader className="gap-2">
				<div className="flex items-center justify-between gap-2 px-1 pt-1">
					<Link
						to="/dashboard"
						className="flex min-w-0 items-center gap-2 rounded-md p-1 transition-opacity hover:opacity-80"
					>
						<Brandmark size={26} className="shrink-0" />
						<Logotype height={18} className="shrink-0" />
					</Link>
					<button
						type="button"
						onClick={toggleTheme}
						aria-label={
							theme === "light" ? "Switch to dark" : "Switch to light"
						}
						className="flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
					>
						{theme === "light" ? (
							<MoonIcon className="size-4" />
						) : (
							<SunIcon className="size-4" />
						)}
					</button>
				</div>
				<button
					type="button"
					onClick={onOpenSearch}
					className="mx-1 flex h-8 items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
				>
					<SearchIcon className="size-3.5 shrink-0" />
					<span className="flex-1 text-left">Search…</span>
					<kbd className="rounded border border-zinc-700 px-1 font-sans text-[0.625rem] text-zinc-500">
						⌘K
					</kbd>
				</button>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Platform</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{NAV.map((entry) =>
								entry.kind === "link" ? (
									<SidebarMenuItem key={entry.title}>
										<SidebarMenuButton
											render={
												<Link
													to={entry.to}
													activeProps={{ "data-active": "true" }}
												/>
											}
										>
											<entry.icon />
											<span>{entry.title}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								) : (
									<Collapsible
										key={entry.title}
										defaultOpen={entry.items.some((i) =>
											pathname.startsWith(i.to),
										)}
										render={<SidebarMenuItem />}
										className="group/collapsible"
									>
										<CollapsibleTrigger render={<SidebarMenuButton />}>
											<entry.icon />
											<span>{entry.title}</span>
											<ChevronRightIcon className="ml-auto size-4 transition-transform duration-200 group-data-open/collapsible:rotate-90" />
										</CollapsibleTrigger>
										<CollapsibleContent>
											<SidebarMenuSub>
												{entry.items.map((item) => (
													<SidebarMenuSubItem key={item.title}>
														<SidebarMenuSubButton
															render={
																<Link
																	to={item.to}
																	activeProps={{ "data-active": "true" }}
																/>
															}
														>
															<span>{item.title}</span>
														</SidebarMenuSubButton>
													</SidebarMenuSubItem>
												))}
											</SidebarMenuSub>
										</CollapsibleContent>
									</Collapsible>
								),
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Quick views</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{quickViews.map((view) => (
								<SidebarMenuItem key={view.title}>
									<SidebarMenuButton render={<Link to={view.to} />}>
										<view.icon />
										<span>{view.title}</span>
										{view.count > 0 ? (
											<span
												className={cn(
													"ml-auto rounded px-1.5 py-0.5 text-[0.6875rem] leading-none font-medium tabular-nums",
													view.badge,
												)}
											>
												{view.count > 99 ? "99+" : view.count}
											</span>
										) : null}
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="gap-2">
				<Link
					to="/invoices"
					className="mx-1 flex flex-col gap-2 rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3 transition-colors hover:bg-zinc-800/70"
				>
					<div className="flex items-baseline justify-between gap-2">
						<span className="text-xs font-medium text-amber-400">
							Outstanding
						</span>
						<span className="text-xs text-zinc-500 tabular-nums">
							{paidPct}% paid
						</span>
					</div>
					<p className="text-lg leading-none font-semibold text-zinc-100 tabular-nums">
						{overview
							? fmtMoney(overview.outstanding.total, overview.currency)
							: "—"}
					</p>
					<div className="h-1.5 overflow-hidden rounded-full bg-zinc-700/70">
						<div
							className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
							style={{ width: `${paidPct}%` }}
						/>
					</div>
					<p className="text-[0.6875rem] text-zinc-500">
						{overview?.outstanding.overdueCount ?? 0} invoice
						{overview?.outstanding.overdueCount === 1 ? "" : "s"} past due
					</p>
				</Link>
				<NavUser />
			</SidebarFooter>
		</Sidebar>
	);
}
