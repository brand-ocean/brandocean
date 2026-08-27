import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import {
	Frame,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
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
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-4.5">
			<Link
				to="/feedback/$projectId"
				params={{ projectId }}
				className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<ArrowLeftIcon className="size-4" /> Back to board
			</Link>
			<Frame>
				<FrameHeader>
					<FrameHeading>
						<FrameTitle>Review &amp; share</FrameTitle>
						<FrameDescription>
							Review the site with the Chrome extension and manage client
							access.
						</FrameDescription>
					</FrameHeading>
				</FrameHeader>
				<FramePanel>
					<InstallPanel projectId={id} />
				</FramePanel>
			</Frame>
		</div>
	);
}
