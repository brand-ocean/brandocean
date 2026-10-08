import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	ActivityIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	FileTextIcon,
	GaugeIcon,
	LandmarkIcon,
	LayoutDashboardIcon,
	ListChecksIcon,
	MessageSquareIcon,
	MessagesSquareIcon,
	ReceiptIcon,
	SettingsIcon,
	UsersIcon,
} from "lucide-react";
import * as React from "react";
import { Brandmark, Logotype } from "@/components/brand";
import { NavUser } from "@/components/nav-user";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
	useSidebar,
} from "@/components/ui/sidebar";
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
		| "/borden"
		| "/coach"
		| "/settings";
};

type Icon = React.ComponentType<{ className?: string }>;

type NavEntry =
	| ({ kind: "link"; icon: Icon } & Leaf)
	| {
			kind: "group";
			title: string;
			icon: Icon;
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
		kind: "link",
		title: "Meeting coach",
		to: "/coach",
		icon: MessagesSquareIcon,
	},
	{
		kind: "group",
		title: "Delivery",
		icon: ListChecksIcon,
		items: [
			{ title: "Tasks", to: "/tasks" },
			{ title: "Feedback", to: "/feedback" },
			{ title: "Borden", to: "/borden" },
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

function isActivePath(pathname: string, to: string) {
	return pathname === to || pathname.startsWith(`${to}/`);
}

function fmtMoney(cents: number, currency: string) {
	return new Intl.NumberFormat("nl-NL", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

/** A nav item with sub-pages. Expanded: a toggle with the sub-list under it.
 *  Collapsed to the icon rail: a dropdown to the right, as in FORZ. */
function GroupNavItem({
	title,
	icon: ItemIcon,
	items,
	pathname,
}: {
	title: string;
	icon: Icon;
	items: readonly Leaf[];
	pathname: string;
}) {
	const { state } = useSidebar();
	const hasActive = items.some((item) => isActivePath(pathname, item.to));
	const [open, setOpen] = React.useState(hasActive);
	const listId = `subnav-${title.toLowerCase()}`;

	if (state === "collapsed") {
		return (
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								tooltip={title}
								isActive={hasActive}
								aria-label={title}
							/>
						}
					>
						<ItemIcon />
						<span>{title}</span>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="right"
						align="start"
						sideOffset={8}
						className="min-w-48"
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel>{title}</DropdownMenuLabel>
							{items.map((item) => (
								<DropdownMenuItem
									key={item.to}
									render={<Link to={item.to} />}
									className={cn(
										isActivePath(pathname, item.to) &&
											"bg-accent/60 font-medium",
									)}
								>
									{item.title}
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		);
	}

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				tooltip={title}
				isActive={hasActive}
				onClick={() => setOpen((prev) => !prev)}
				aria-expanded={open}
				aria-controls={listId}
			>
				<ItemIcon />
				<span>{title}</span>
				<ChevronRightIcon
					aria-hidden="true"
					className={cn(
						"ml-auto size-4 shrink-0 opacity-60 transition-transform duration-200",
						open && "rotate-90",
					)}
				/>
			</SidebarMenuButton>
			{open ? (
				<SidebarMenuSub id={listId} className="gap-0 py-0">
					{items.map((item) => (
						<SidebarMenuSubItem key={item.to}>
							<SidebarMenuSubButton
								render={<Link to={item.to} />}
								isActive={isActivePath(pathname, item.to)}
							>
								<span>{item.title}</span>
							</SidebarMenuSubButton>
						</SidebarMenuSubItem>
					))}
				</SidebarMenuSub>
			) : null}
		</SidebarMenuItem>
	);
}

/** A labelled, foldable group of the sidebar, styled as FORZ's nav groups. */
function NavSection({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	const { state } = useSidebar();
	const [expanded, setExpanded] = React.useState(true);
	const open = state === "collapsed" ? true : expanded;
	const listId = `navgroup-${label.toLowerCase().replace(/\s+/g, "-")}`;

	return (
		<SidebarGroup className="px-2 py-0">
			<SidebarGroupLabel
				render={
					<button
						type="button"
						disabled={state === "collapsed"}
						onClick={() => setExpanded(!open)}
						aria-expanded={open}
						aria-controls={listId}
					/>
				}
				className="h-8 w-full cursor-pointer text-sm focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
			>
				{label}
				<ChevronDownIcon
					aria-hidden="true"
					className={cn(
						"ml-auto size-4 shrink-0 opacity-60 transition-transform duration-200",
						!open && "-rotate-90",
					)}
				/>
			</SidebarGroupLabel>
			{open ? (
				<SidebarGroupContent id={listId}>
					<SidebarMenu>{children}</SidebarMenu>
				</SidebarGroupContent>
			) : null}
		</SidebarGroup>
	);
}

/** The collapse handle on the sidebar's edge, 1:1 FORZ's rail toggle. */
function SidebarRailToggle() {
	const { state, toggleSidebar } = useSidebar();
	const isExpanded = state === "expanded";

	return (
		<button
			type="button"
			aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
			onClick={toggleSidebar}
			style={{
				left: isExpanded ? "var(--sidebar-width)" : "var(--sidebar-width-icon)",
			}}
			className={cn(
				"group/rail fixed top-1/2 z-30 flex h-12 w-7 -translate-y-1/2 cursor-pointer items-center pl-2 outline-none",
				"transition-[left] duration-200 ease-linear",
			)}
		>
			<span className="flex flex-col items-center">
				<span
					aria-hidden="true"
					className={cn(
						"block h-2 w-0.5 rounded-t-full bg-foreground/40",
						"origin-bottom transition-all duration-100 ease-linear",
						isExpanded
							? "group-hover/rail:rotate-40 group-hover/rail:bg-foreground/60"
							: "group-hover/rail:-rotate-40 group-hover/rail:bg-foreground/60",
					)}
				/>
				<span
					aria-hidden="true"
					className={cn(
						"block h-2 w-0.5 rounded-b-full bg-foreground/40",
						"origin-top transition-all duration-100 ease-linear",
						isExpanded
							? "group-hover/rail:-rotate-40 group-hover/rail:bg-foreground/60"
							: "group-hover/rail:rotate-40 group-hover/rail:bg-foreground/60",
					)}
				/>
			</span>
			<span
				className={cn(
					"absolute left-full -ml-2 rounded-md border border-border bg-foreground px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-background shadow-xs shadow-black/5",
					"pointer-events-none transition-all duration-200 ease-out",
					"-translate-x-0.5 opacity-0",
					"group-hover/rail:translate-x-0 group-hover/rail:opacity-100",
				)}
			>
				{isExpanded ? "Collapse" : "Expand"}
			</span>
		</button>
	);
}

/** Wordmark when the sidebar is open, the mark alone on the icon rail. */
function SidebarBrand() {
	const { state } = useSidebar();
	return state === "collapsed" ? (
		<Brandmark size={24} className="shrink-0 text-foreground" />
	) : (
		<span className="flex items-center gap-2 text-foreground">
			<Brandmark size={22} className="shrink-0" />
			<Logotype height={18} className="shrink-0" />
		</span>
	);
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
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
			badge: "bg-secondary text-secondary-foreground",
		},
		{
			title: "Open invoices",
			to: "/invoices" as const,
			icon: ReceiptIcon,
			count: overview?.outstanding.overdueCount ?? 0,
			badge:
				"bg-warning/10 text-warning-foreground dark:bg-warning/15 dark:text-warning",
		},
		{
			title: "Open feedback",
			to: "/feedback" as const,
			icon: MessageSquareIcon,
			count: openFeedback,
			badge: "bg-info/10 text-info-foreground dark:bg-info/15 dark:text-info",
		},
		{
			title: "Open tasks",
			to: "/tasks" as const,
			icon: ListChecksIcon,
			count: overview?.counts.openTasks ?? 0,
			badge:
				"bg-success/10 text-success-foreground dark:bg-success/15 dark:text-success",
		},
	];

	const paid = overview?.counts.invoicesPaid ?? 0;
	const totalInvoices = overview?.counts.invoices ?? 0;
	const paidPct =
		totalInvoices === 0 ? 0 : Math.round((paid / totalInvoices) * 100);

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader className="flex flex-row items-center justify-between in-data-[state=collapsed]:flex-col in-data-[state=collapsed]:items-start in-data-[state=collapsed]:justify-center">
				<div className="inline-flex min-h-10 items-center gap-2 px-0.5 transition-all duration-200 ease-linear">
					<Link
						to="/dashboard"
						aria-label="Dashboard"
						className="flex items-center"
					>
						<SidebarBrand />
					</Link>
				</div>
			</SidebarHeader>

			<SidebarContent>
				<NavSection label="Platform">
					{NAV.map((entry) =>
						entry.kind === "link" ? (
							<SidebarMenuItem key={entry.title}>
								<SidebarMenuButton
									tooltip={entry.title}
									isActive={isActivePath(pathname, entry.to)}
									render={<Link to={entry.to} />}
								>
									<entry.icon />
									<span>{entry.title}</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						) : (
							<GroupNavItem
								key={entry.title}
								title={entry.title}
								icon={entry.icon}
								items={entry.items}
								pathname={pathname}
							/>
						),
					)}
				</NavSection>

				<NavSection label="Quick views">
					{quickViews.map((view) => (
						<SidebarMenuItem key={view.title}>
							<SidebarMenuButton
								tooltip={view.title}
								render={<Link to={view.to} />}
							>
								<view.icon />
								<span>{view.title}</span>
								{view.count > 0 ? (
									<span
										className={cn(
											"ml-auto flex h-4.5 min-w-4.5 items-center justify-center rounded-sm px-1 text-[0.625rem] leading-none font-medium tabular-nums",
											view.badge,
										)}
									>
										{view.count > 99 ? "99+" : view.count}
									</span>
								) : null}
							</SidebarMenuButton>
						</SidebarMenuItem>
					))}
				</NavSection>
			</SidebarContent>

			<SidebarFooter className="pb-3">
				<Link
					to="/invoices"
					className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 shadow-xs shadow-black/5 transition-colors hover:bg-muted group-data-[collapsible=icon]:hidden"
				>
					<div className="flex items-baseline justify-between gap-2">
						<span className="text-xs font-medium text-muted-foreground">
							Outstanding
						</span>
						<span className="text-xs text-muted-foreground tabular-nums">
							{paidPct}% paid
						</span>
					</div>
					<p className="text-lg leading-none font-semibold text-foreground tabular-nums">
						{overview
							? fmtMoney(overview.outstanding.total, overview.currency)
							: "—"}
					</p>
					<div className="h-1.5 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary transition-[width] duration-500"
							style={{ width: `${paidPct}%` }}
						/>
					</div>
					<p className="text-[0.6875rem] text-muted-foreground">
						{overview?.outstanding.overdueCount ?? 0} invoice
						{overview?.outstanding.overdueCount === 1 ? "" : "s"} past due
					</p>
				</Link>
				<NavUser />
			</SidebarFooter>

			<SidebarRailToggle />
		</Sidebar>
	);
}
