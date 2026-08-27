import { createFileRoute } from "@tanstack/react-router";

import {
	Frame,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { TasksBoard } from "@/components/tasks/TasksBoard";

export const Route = createFileRoute("/_authed/_app/tasks/")({
	component: TasksPage,
});

function TasksPage() {
	return (
		<Frame className="min-h-0 flex-1">
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>Tasks</FrameTitle>
					<FrameDescription>
						Drag cards between columns; drag a column's grip to reorder.
					</FrameDescription>
				</FrameHeading>
			</FrameHeader>
			<FramePanel flush className="flex min-h-0 flex-1 flex-col p-3">
				<TasksBoard />
			</FramePanel>
		</Frame>
	);
}
