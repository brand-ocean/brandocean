import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { Frame, FramePanel } from "@/components/app/frame";
import { usePageTitle } from "@/components/app/page-title";
import { LiveView } from "@/components/coach/live-view";
import { ReportView } from "@/components/coach/report-view";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/coach/$sessionId")({
	component: CoachSession,
});

function CoachSession() {
	const { sessionId } = Route.useParams();
	const data = useQuery(api.coach.sessions.get, {
		sessionId: sessionId as Id<"coachSessions">,
	});
	usePageTitle(data?.session.title);

	if (data === undefined) {
		return (
			<Frame>
				<FramePanel>
					<p className="text-muted-foreground p-6">Laden…</p>
				</FramePanel>
			</Frame>
		);
	}
	if (data === null) {
		return (
			<Frame>
				<FramePanel>
					<p className="text-muted-foreground p-6">
						Dit gesprek bestaat niet (meer).
					</p>
				</FramePanel>
			</Frame>
		);
	}
	return data.session.status === "live" ? (
		<LiveView session={data.session} />
	) : (
		<ReportView session={data.session} report={data.report} />
	);
}
