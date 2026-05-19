import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { convex } from "@/lib/convex";

export const Route = createFileRoute("/_authed")({
	component: AuthedLayout,
});

function AuthedLayout() {
	return (
		<ConvexAuthProvider client={convex}>
			<Outlet />
		</ConvexAuthProvider>
	);
}
