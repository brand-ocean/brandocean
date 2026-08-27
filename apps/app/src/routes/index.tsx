import { createFileRoute, redirect } from "@tanstack/react-router";

// Blunt heeft `/` meegenomen naar zijn eigen app; hier is de root de tool.
export const Route = createFileRoute("/")({
	beforeLoad: () => {
		throw redirect({ to: "/dashboard" });
	},
});
