import { createFileRoute, Outlet } from "@tanstack/react-router";
import BluntLayout from "@/blunt/BluntLayout";

export const Route = createFileRoute("/_blunt")({
	component: BluntShell,
});

function BluntShell() {
	return (
		<BluntLayout>
			<Outlet />
		</BluntLayout>
	);
}
