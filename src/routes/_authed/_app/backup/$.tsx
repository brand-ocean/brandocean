import { createFileRoute, useParams } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarConfigProvider } from "@/template/contexts/sidebar-context";

export const Route = createFileRoute("/_authed/_app/backup/$")({
	component: BackupCatchAll,
});

const PAGES: Record<string, React.LazyExoticComponent<React.FC>> = {
	dashboard: lazy(() => import("@/template/app/dashboard/page")),
	tasks: lazy(() => import("@/template/app/tasks/page")),
	users: lazy(() => import("@/template/app/users/page")),
	faqs: lazy(() => import("@/template/app/faqs/page")),
	pricing: lazy(() => import("@/template/app/pricing/page")),
	landing: lazy(() => import("@/template/app/landing/page")),
	"errors/forbidden": lazy(() => import("@/template/app/errors/forbidden/page")),
	"errors/internal-server-error": lazy(
		() => import("@/template/app/errors/internal-server-error/page"),
	),
	"errors/not-found": lazy(() => import("@/template/app/errors/not-found/page")),
	"errors/unauthorized": lazy(
		() => import("@/template/app/errors/unauthorized/page"),
	),
	"errors/under-maintenance": lazy(
		() => import("@/template/app/errors/under-maintenance/page"),
	),
	"settings/account": lazy(() => import("@/template/app/settings/account/page")),
	"settings/billing": lazy(() => import("@/template/app/settings/billing/page")),
};

function BackupCatchAll() {
	const params = useParams({ from: "/_authed/_app/backup/$" });
	const splat = params._splat ?? "";
	const Component = PAGES[splat];

	if (!Component) {
		return (
			<div className="space-y-2">
				<h2 className="text-lg font-semibold">Template page not found</h2>
				<p className="text-sm text-muted-foreground">
					Path: <code>/backup/{splat}</code>
				</p>
				<p className="text-sm">
					Available pages: {Object.keys(PAGES).join(", ")}
				</p>
			</div>
		)
	}

	return (
		<SidebarConfigProvider>
			<Suspense
				fallback={
					<div className="space-y-4">
						<Skeleton className="h-10 w-1/3" />
						<Skeleton className="h-64" />
					</div>
				}
			>
				<Component />
			</Suspense>
		</SidebarConfigProvider>
	)
}
