import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import { getConvexClient } from "@/lib/convex";
import SiteLayout from "@/site/SiteLayout";

export const Route = createFileRoute("/_site")({
	component: SiteShell,
});

function SiteShell() {
	return (
		<ConvexProvider client={getConvexClient()}>
			<SiteLayout>
				<Outlet />
			</SiteLayout>
		</ConvexProvider>
	);
}
