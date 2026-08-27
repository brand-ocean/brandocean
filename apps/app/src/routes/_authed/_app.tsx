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
import { Button } from "@/components/ui/button";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authed/_app")({
	component: AppLayout,
});

/**
 * Sidebar colours are pinned to zinc regardless of the app theme — the rail
 * stays dark in light mode, which is what gives the shell its contrast.
 */
const SHELL_VARS = {
	"--sidebar-width": "250px",
	"--sidebar-width-icon": "3rem",
	"--header-height": "50px",
	"--sidebar": "var(--color-zinc-900)",
	"--sidebar-foreground": "var(--color-zinc-100)",
	"--sidebar-border":
		"color-mix(in oklab, var(--color-zinc-700) 60%, transparent)",
	"--sidebar-accent": "var(--color-zinc-800)",
	"--sidebar-accent-foreground": "var(--color-zinc-100)",
	"--sidebar-primary": "var(--color-zinc-100)",
	"--sidebar-primary-foreground": "var(--color-zinc-900)",
	"--sidebar-ring": "var(--color-zinc-500)",
} as React.CSSProperties;

const SHELL_NAV_CLASSES = [
	"[&_[data-slot=sidebar-menu-button][data-active]]:bg-zinc-800!",
	"[&_[data-slot=sidebar-menu-button][data-active]]:text-zinc-50",
	"[&_[data-slot=sidebar-menu-button][data-active]>svg]:text-white",
	"**:data-[slot=sidebar-menu-button]:text-zinc-400",
	"**:data-[slot=sidebar-menu-button]:hover:bg-zinc-800!",
	"**:data-[slot=sidebar-menu-button]:hover:text-zinc-100",
	"[&_[data-slot=sidebar-menu-button]>svg]:opacity-50",
	"[&_[data-slot=sidebar-menu-button]:hover>svg]:opacity-100",
	"[&_[data-slot=sidebar-menu-button][data-active]>svg]:opacity-100",
	"[&_[data-slot=sidebar-menu-sub-button][data-active]]:bg-zinc-800!",
	"[&_[data-slot=sidebar-menu-sub-button][data-active]]:text-zinc-50",
	"**:data-[slot=sidebar-menu-sub-button]:text-zinc-400",
	"**:data-[slot=sidebar-menu-sub-button]:hover:bg-zinc-800!",
	"**:data-[slot=sidebar-menu-sub-button]:hover:text-zinc-100",
	"[&_[data-slot=sidebar-group-label]]:text-zinc-500",
].join(" ");

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
					<SidebarProvider
						style={SHELL_VARS}
						className={`h-svh ${SHELL_NAV_CLASSES}`}
					>
						<AppSidebar onOpenSearch={() => setOpen(true)} />
						<SidebarInset className="min-w-0 overflow-y-auto bg-background">
							<AppHeader onOpenSearch={() => setOpen(true)} />
							<div className="isolate flex flex-1 flex-col gap-4.5 overflow-x-hidden px-4.5 pb-4.5">
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
		<header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 bg-background px-4.5">
			<SidebarTrigger className="-ml-1.5 md:hidden" />
			<nav
				aria-label="Breadcrumb"
				className="flex min-w-0 items-center gap-1.5 text-sm"
			>
				<span className="shrink-0 text-muted-foreground">{crumb.section}</span>
				<span aria-hidden className="text-muted-foreground/60">
					—
				</span>
				<span className="shrink-0 font-medium">{crumb.page}</span>
				{detailTitle ? (
					<>
						<span aria-hidden className="text-muted-foreground/60">
							/
						</span>
						<span className="truncate text-muted-foreground">
							{detailTitle}
						</span>
					</>
				) : null}
			</nav>
			<div className="ml-auto flex items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="Search"
					onClick={onOpenSearch}
				>
					<SearchIcon />
				</Button>
			</div>
		</header>
	);
}
