import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_marketing/full")({
	beforeLoad: () => {
		throw redirect({ to: "/" });
	},
});
