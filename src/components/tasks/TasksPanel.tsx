import { useMutation, useQuery } from "convex/react";
import {
	CheckCircle2Icon,
	CircleIcon,
	ListTodoIcon,
	PlusIcon,
	Trash2Icon,
	XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

type Status = "todo" | "in_progress" | "done" | "canceled";
type Priority = "low" | "medium" | "high";

type StatusFilter = Status | "all";

const PRIORITY_LABEL: Record<Priority, string> = {
	low: "Low",
	medium: "Med",
	high: "High",
};

const PRIORITY_VARIANT: Record<
	Priority,
	"outline" | "secondary" | "default" | "destructive"
> = {
	low: "outline",
	medium: "secondary",
	high: "default",
};

function nextPriority(p: Priority): Priority {
	if (p === "low") return "medium";
	if (p === "medium") return "high";
	return "low";
}

export function TasksPanel({ clientId }: { clientId?: Id<"clients"> }) {
	const [filter, setFilter] = useState<StatusFilter>("all");
	const tasks = useQuery(api.tasks.list, {
		clientId,
		status: filter === "all" ? undefined : filter,
	});
	const create = useMutation(api.tasks.create);
	const updateStatus = useMutation(api.tasks.updateStatus);
	const updatePriority = useMutation(api.tasks.updatePriority);
	const rename = useMutation(api.tasks.rename);
	const remove = useMutation(api.tasks.remove);
	const [title, setTitle] = useState("");
	const [creating, setCreating] = useState(false);

	return (
		<div className="space-y-6">
			<form
				onSubmit={async (e) => {
					e.preventDefault();
					if (!title.trim()) return;
					setCreating(true);
					try {
						await create({ title: title.trim(), clientId });
						setTitle("");
					} catch (err) {
						toast.error("Could not add task", {
							description: err instanceof Error ? err.message : String(err),
						});
					} finally {
						setCreating(false);
					}
				}}
			>
				<div className="flex items-center gap-2">
					<Input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="What needs to be done?"
						className="flex-1"
					/>
					<Button type="submit" disabled={creating || !title.trim()}>
						<PlusIcon data-icon="inline-start" />
						Add
					</Button>
				</div>
			</form>

			<div className="flex flex-wrap gap-2">
				{(
					[
						{ value: "all", label: "All" },
						{ value: "todo", label: "Todo" },
						{ value: "in_progress", label: "In progress" },
						{ value: "done", label: "Done" },
						{ value: "canceled", label: "Canceled" },
					] as const
				).map((opt) => (
					<Button
						key={opt.value}
						type="button"
						size="sm"
						variant={filter === opt.value ? "default" : "outline"}
						onClick={() => setFilter(opt.value)}
					>
						{opt.label}
					</Button>
				))}
			</div>

			{tasks === undefined ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-12" />
					<Skeleton className="h-12" />
				</div>
			) : tasks.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<ListTodoIcon />
						</EmptyMedia>
						<EmptyTitle>No tasks</EmptyTitle>
						<EmptyDescription>
							Add one above. Tasks belong to a client when created here.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<ul className="divide-y rounded-lg border bg-card">
					{tasks.map((t) => {
						const status = t.status as Status;
						const priority = t.priority as Priority;
						const isDone = status === "done";
						const isCanceled = status === "canceled";
						const StatusIcon = isDone
							? CheckCircle2Icon
							: isCanceled
								? XCircleIcon
								: CircleIcon;
						return (
							<li
								key={t._id}
								className="group flex items-center gap-3 px-4 py-3"
							>
								<button
									type="button"
									onClick={() =>
										void updateStatus({
											id: t._id,
											status: isDone ? "todo" : "done",
										})
									}
									aria-label={isDone ? "Mark as todo" : "Mark as done"}
									className="text-muted-foreground hover:text-foreground"
								>
									<StatusIcon className="size-5" />
								</button>
								<input
									type="text"
									defaultValue={t.title}
									onBlur={async (e) => {
										const next = e.target.value.trim();
										if (next && next !== t.title) {
											try {
												await rename({ id: t._id, title: next });
											} catch (err) {
												toast.error("Could not rename", {
													description:
														err instanceof Error ? err.message : String(err),
												});
											}
										} else {
											e.target.value = t.title;
										}
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											(e.target as HTMLInputElement).blur();
										}
									}}
									className={`flex-1 bg-transparent text-sm outline-none ${
										isDone || isCanceled
											? "text-muted-foreground line-through"
											: ""
									}`}
								/>
								<button
									type="button"
									onClick={() =>
										void updatePriority({
											id: t._id,
											priority: nextPriority(priority),
										})
									}
									aria-label="Cycle priority"
								>
									<Badge variant={PRIORITY_VARIANT[priority]}>
										{PRIORITY_LABEL[priority]}
									</Badge>
								</button>
								<select
									value={status}
									onChange={(e) =>
										void updateStatus({
											id: t._id,
											status: e.target.value as Status,
										})
									}
									className="rounded-md border bg-background px-2 py-1 text-xs"
								>
									<option value="todo">Todo</option>
									<option value="in_progress">In progress</option>
									<option value="done">Done</option>
									<option value="canceled">Canceled</option>
								</select>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									onClick={async () => {
										if (!window.confirm(`Delete "${t.title}"?`)) return;
										try {
											await remove({ id: t._id });
										} catch (err) {
											toast.error("Could not delete", {
												description:
													err instanceof Error ? err.message : String(err),
											});
										}
									}}
									className="opacity-0 transition-opacity group-hover:opacity-100"
									aria-label="Delete task"
								>
									<Trash2Icon />
								</Button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
