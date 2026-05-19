import { createFileRoute } from "@tanstack/react-router";
import { TasksBoard } from "@/components/tasks/TasksBoard";

export const Route = createFileRoute("/_authed/_app/tasks/")({
	component: TasksPage,
});

function TasksPage() {
	return (
		<div className="flex h-full w-full flex-col gap-6 px-4 md:px-6">
			<header className="flex flex-col gap-2">
				<h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
				<p className="text-base text-muted-foreground">
					Roadmap board — drag cards between columns, drag the grip to reorder
					columns.
				</p>
			</header>
			<TasksBoard />
		</div>
	);
}
