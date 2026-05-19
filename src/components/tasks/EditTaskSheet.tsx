import { useMutation, useQuery } from "convex/react";
import { CalendarIcon, Pencil } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { api } from "~convex/_generated/api";
import type { Doc, Id } from "~convex/_generated/dataModel";

type Priority = "low" | "medium" | "high";

const NO_CLIENT_VALUE = "__none__";

function parseDateInput(value: string): number | undefined {
	if (!value) return undefined;
	const [y, m, d] = value.split("-").map(Number);
	if (!y || !m || !d) return undefined;
	return new Date(y, m - 1, d).getTime();
}

function formatDateInput(ms: number): string {
	const d = new Date(ms);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export function EditTaskSheet({
	task,
	open,
	onOpenChange,
}: {
	task: Doc<"tasks"> | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const rename = useMutation(api.tasks.rename);
	const updatePriority = useMutation(api.tasks.updatePriority);
	const updateLabel = useMutation(api.tasks.updateLabel);
	const setDueAt = useMutation(api.tasks.setDueAt);
	const setClient = useMutation(api.tasks.setClient);
	const clients = useQuery(api.clients.list, {});

	const [title, setTitle] = React.useState("");
	const [priority, setPriority] = React.useState<Priority>("medium");
	const [label, setLabel] = React.useState("");
	const [dueAt, setDueAt_] = React.useState("");
	const [clientId, setClientId] = React.useState<string>(NO_CLIENT_VALUE);
	const [pending, setPending] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	React.useEffect(() => {
		if (open && task) {
			setTitle(task.title);
			setPriority(task.priority as Priority);
			setLabel(task.label ?? "");
			setDueAt_(task.dueAt !== undefined ? formatDateInput(task.dueAt) : "");
			setClientId(task.clientId ?? NO_CLIENT_VALUE);
			setError(null);
		}
	}, [open, task]);

	async function submit() {
		if (!task) return;
		const trimmedTitle = title.trim();
		if (!trimmedTitle || pending) return;
		setPending(true);
		setError(null);
		try {
			const trimmedLabel = label.trim();
			const parsedDue = parseDateInput(dueAt);
			const nextClient =
				clientId === NO_CLIENT_VALUE ? undefined : (clientId as Id<"clients">);

			await Promise.all([
				trimmedTitle !== task.title
					? rename({ id: task._id, title: trimmedTitle })
					: Promise.resolve(),
				priority !== task.priority
					? updatePriority({ id: task._id, priority })
					: Promise.resolve(),
				(trimmedLabel || undefined) !== task.label
					? updateLabel({
							id: task._id,
							label: trimmedLabel || undefined,
						})
					: Promise.resolve(),
				parsedDue !== task.dueAt
					? setDueAt({ id: task._id, dueAt: parsedDue })
					: Promise.resolve(),
				nextClient !== task.clientId
					? setClient({ id: task._id, clientId: nextClient })
					: Promise.resolve(),
			]);
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save");
		} finally {
			setPending(false);
		}
	}

	if (!task) {
		return (
			<Sheet open={open} onOpenChange={onOpenChange}>
				<SheetContent />
			</Sheet>
		);
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
				<SheetHeader className="border-b px-6 py-4">
					<SheetTitle className="flex items-center gap-2">
						<Pencil className="size-4" />
						Edit task
					</SheetTitle>
					<SheetDescription>
						Changes are saved when you click Save.
					</SheetDescription>
				</SheetHeader>

				<form
					className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5"
					onSubmit={(event) => {
						event.preventDefault();
						void submit();
					}}
				>
					<div className="flex flex-col gap-1.5">
						<label className="text-sm font-medium" htmlFor="task-edit-title">
							Title
						</label>
						<Input
							id="task-edit-title"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-sm font-medium">Priority</label>
						<Select
							value={priority}
							onValueChange={(v) => {
								if (v) setPriority(v as Priority);
							}}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="low">Low</SelectItem>
								<SelectItem value="medium">Medium</SelectItem>
								<SelectItem value="high">High</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-sm font-medium" htmlFor="task-edit-label">
							Label
						</label>
						<Input
							id="task-edit-label"
							value={label}
							placeholder="Optional tag (e.g. design, infra)"
							onChange={(event) => setLabel(event.target.value)}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label
							className="flex items-center gap-1.5 text-sm font-medium"
							htmlFor="task-edit-due"
						>
							<CalendarIcon className="size-3.5" />
							Due date
						</label>
						<div className="flex items-center gap-2">
							<Input
								id="task-edit-due"
								type="date"
								value={dueAt}
								onChange={(event) => setDueAt_(event.target.value)}
								className="flex-1"
							/>
							{dueAt ? (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setDueAt_("")}
								>
									Clear
								</Button>
							) : null}
						</div>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-sm font-medium">Client</label>
						<Select
							value={clientId}
							onValueChange={(v) => setClientId(v ?? NO_CLIENT_VALUE)}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NO_CLIENT_VALUE}>No client</SelectItem>
								{(clients ?? []).map((c) => (
									<SelectItem key={c._id} value={c._id}>
										{c.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{error ? <p className="text-destructive text-sm">{error}</p> : null}
				</form>

				<SheetFooter className="border-t px-6 py-4">
					<Button
						type="button"
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={pending}
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={() => void submit()}
						disabled={!title.trim() || pending}
					>
						{pending ? "Saving…" : "Save"}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
