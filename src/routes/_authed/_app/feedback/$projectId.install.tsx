import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { InstallPanel } from "@/components/feedback/install-panel";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute(
	"/_authed/_app/feedback/$projectId/install",
)({
	component: InstallPage,
});

function InstallPage() {
	const { projectId } = Route.useParams();
	const id = projectId as Id<"feedbackProjects">;
	return (
		<div className="mx-auto w-full max-w-2xl space-y-6">
			<div>
				<Link
					to="/feedback/$projectId"
					params={{ projectId }}
					className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeftIcon className="size-4" /> Back to board
				</Link>
				<h1 className="text-2xl font-semibold tracking-tight">
					Install &amp; share
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Embed the widget on the store and manage client access.
				</p>
			</div>
			<InstallPanel projectId={id} />
		</div>
	);
}
