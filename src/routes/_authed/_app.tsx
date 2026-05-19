import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authed/_app")({
	component: AppLayout,
});

function AppLayout() {
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
				<SidebarProvider>
					<AppSidebar />
					<SidebarInset>
						<header className="flex h-16 shrink-0 items-center gap-2 border-b px-6 md:px-10">
							<SidebarTrigger className="-ml-1" />
							<Separator
								orientation="vertical"
								className="mr-2 data-[orientation=vertical]:h-4"
							/>
							<h1 className="text-base font-medium">Workspace</h1>
						</header>
						<main className="flex-1 px-6 py-10 md:px-12 md:py-14">
							<Outlet />
						</main>
					</SidebarInset>
				</SidebarProvider>
			</Authenticated>
		</>
	)
}
