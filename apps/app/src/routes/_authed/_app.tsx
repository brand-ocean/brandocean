import {
	createFileRoute,
	Link,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { SearchIcon } from "lucide-react";
import {
	CommandPalette,
	useCommandPalette,
} from "@/components/app/command-palette";
import {
	PageTitleProvider,
	usePageTitleValue,
} from "@/components/app/page-title";
import { AppSidebar } from "@/components/app-sidebar";
import { Brandmark } from "@/components/brand";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authed/_app")({
	component: AppLayout,
});

/** Path segment → what the header calls it. */
const SEGMENT_LABELS: Record<string, { section: string; page: string }> = {
	dashboard: { section: "Home", page: "Dashboard" },
	offertes: { section: "Documents", page: "Offertes" },
	ndas: { section: "Documents", page: "NDAs" },
	invoices: { section: "Documents", page: "Invoices" },
	clients: { section: "Platform", page: "Clients" },
	billing: { section: "Platform", page: "Usage billing" },
	boekhouding: { section: "Administratie", page: "Boekhouding" },
	tasks: { section: "Delivery", page: "Tasks" },
	feedback: { section: "Delivery", page: "Feedback" },
	portfolio: { section: "Delivery", page: "Portfolio" },
	settings: { section: "Platform", page: "Settings" },
	backup: { section: "Platform", page: "Backup" },
};

function AppLayout() {
	const { open, setOpen } = useCommandPalette();

	return (
		<>
			<AuthLoading>
				<div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
					Loading…
				</div>
			</AuthLoading>
			<Unauthenticated>
				<div className="flex min-h-svh flex-col items-center justify-center gap-4">
					<p className="text-sm text-muted-foreground">You're signed out.</p>
					<Button render={<Link to="/signin" />}>Sign in</Button>
				</div>
			</Unauthenticated>
			<Authenticated>
				<PageTitleProvider>
					<SidebarProvider className="h-svh [--header-height:--spacing(12)]">
						<AppSidebar />
						<SidebarInset className="flex min-w-0 flex-1 flex-col overflow-y-auto">
							<AppHeader onOpenSearch={() => setOpen(true)} />
							<div className="@container isolate flex flex-1 flex-col gap-4 overflow-x-hidden px-4.5 pt-0 pb-4.5">
								<Outlet />
							</div>
						</SidebarInset>
						<CommandPalette open={open} onOpenChange={setOpen} />
					</SidebarProvider>
				</PageTitleProvider>
			</Authenticated>
		</>
	);
}

function AppHeader({ onOpenSearch }: { onOpenSearch: () => void }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const detailTitle = usePageTitleValue();

	const first = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
	const crumb = SEGMENT_LABELS[first] ?? { section: "Platform", page: first };

	return (
		<header className="sticky top-0 z-40 flex h-(--header-height) shrink-0 items-center gap-2 bg-background px-4.5">
			<div className="flex min-w-0 items-center gap-2">
				<SidebarTrigger aria-label="Open menu" className="-ml-1 md:hidden" />
				<Link
					to="/dashboard"
					aria-label="Dashboard"
					className="shrink-0 text-foreground md:hidden"
				>
					<Brandmark size={20} />
				</Link>
				<Breadcrumb className="min-w-0">
					<BreadcrumbList className="flex-nowrap">
						<BreadcrumbItem className="hidden md:inline-flex">
							<span className="text-muted-foreground">{crumb.section}</span>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:flex" />
						<BreadcrumbItem className="min-w-0">
							{detailTitle ? (
								<BreadcrumbLink
									className="truncate"
									// The first segment is always a list route (see SEGMENT_LABELS).
									render={<Link to={`/${first}` as "/dashboard"} />}
								>
									{crumb.page}
								</BreadcrumbLink>
							) : (
								<BreadcrumbPage className="truncate">
									{crumb.page}
								</BreadcrumbPage>
							)}
						</BreadcrumbItem>
						{detailTitle ? (
							<>
								<BreadcrumbSeparator />
								<BreadcrumbItem className="min-w-0">
									<BreadcrumbPage className="truncate">
										{detailTitle}
									</BreadcrumbPage>
								</BreadcrumbItem>
							</>
						) : null}
					</BreadcrumbList>
				</Breadcrumb>
			</div>
			<div className="flex-1" />
			<div className="flex shrink-0 items-center gap-0.5">
				<div className="relative mr-1 hidden sm:inline-flex">
					<Button
						type="button"
						variant="outline"
						className="h-8 justify-start gap-3 pr-1.5 pl-7 font-normal hover:bg-background"
						onClick={onOpenSearch}
					>
						Search
						<Kbd>⌘K</Kbd>
					</Button>
					<SearchIcon
						aria-hidden="true"
						className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 opacity-50 select-none"
					/>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="sm:hidden"
					aria-label="Search"
					onClick={onOpenSearch}
				>
					<SearchIcon className="size-4" aria-hidden />
				</Button>
			</div>
		</header>
	);
}
