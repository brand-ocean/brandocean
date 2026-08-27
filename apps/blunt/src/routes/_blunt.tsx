import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import BluntLayout from "@/blunt/BluntLayout";
import { convex } from "@/lib/convex";

export const Route = createFileRoute("/_blunt")({
	component: BluntShell,
});

function BluntShell() {
	return (
		<ConvexProvider client={convex}>
			<BluntLayout>
				<Outlet />
			</BluntLayout>
		</ConvexProvider>
	);
}
