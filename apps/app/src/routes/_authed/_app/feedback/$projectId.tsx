import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route for a single feedback project. The board lives in
// `$projectId.index.tsx`; the install page in `$projectId.install.tsx`.
// This must render <Outlet /> so child routes (install) can display.
export const Route = createFileRoute("/_authed/_app/feedback/$projectId")({
	component: () => <Outlet />,
});
