import { useMutation, useQuery } from "convex/react";
import {
	CalendarIcon,
	GripVertical,
	Pencil,
	Plus,
	Trash2,
	X,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
	KanbanBoardCircleColor,
	KanbanBoardDropDirection,
} from "@/components/ui/kanban";
import {
	KanbanBoard,
	KanbanBoardCard,
	KanbanBoardCardButton,
	KanbanBoardCardButtonGroup,
	KanbanBoardCardTitle,
	KanbanBoardColumn,
	KanbanBoardColumnButton,
	KanbanBoardColumnFooter,
	KanbanBoardColumnHeader,
	KanbanBoardColumnList,
	KanbanBoardColumnListItem,
	KanbanBoardColumnTitle,
	KanbanBoardExtraMargin,
	KanbanBoardProvider,
	KanbanColorCircle,
} from "@/components/ui/kanban";
import { cn } from "@/lib/utils";
import { api } from "~convex/_generated/api";
import type { Doc, Id } from "~convex/_generated/dataModel";
import { EditTaskSheet } from "./EditTaskSheet";

type Status =
	| "prio"
	| "in_review"
	| "todo"
	| "in_progress"
	| "done"
	| "canceled";
type Priority = "low" | "medium" | "high";

type Task = Doc<"tasks">;

type ColumnDef = {
	id: Status;
	title: string;
	color: KanbanBoardCircleColor;
};

const COLUMNS: ReadonlyArray<ColumnDef> = [
	{ id: "prio", title: "Prio", color: "red" },
	{ id: "in_review", title: "In review", color: "yellow" },
	{ id: "todo", title: "Todo", color: "gray" },
	{ id: "in_progress", title: "In progress", color: "blue" },
	{ id: "done", title: "Done", color: "green" },
	{ id: "canceled", title: "Canceled", color: "gray" },
];

const DEFAULT_COLUMN_ORDER: ReadonlyArray<Status> = COLUMNS.map((c) => c.id);
const COLUMN_ORDER_STORAGE_KEY = "brandocean.tasks.columnOrder.v1";
const COLUMN_DRAG_TYPE = "kanban-board-column-id";
const UNDO_DELAY_MS = 5000;

function loadColumnOrder(): Array<Status> {
	if (typeof window === "undefined") return [...DEFAULT_COLUMN_ORDER];
	try {
		const raw = window.localStorage.getItem(COLUMN_ORDER_STORAGE_KEY);
		if (!raw) return [...DEFAULT_COLUMN_ORDER];
		const parsed: unknown = JSON.parse(raw);
		if (
			Array.isArray(parsed) &&
			parsed.length === DEFAULT_COLUMN_ORDER.length &&
			DEFAULT_COLUMN_ORDER.every((s) => parsed.includes(s))
		) {
			return parsed as Array<Status>;
		}
	} catch {
		/* fall through */
	}
	return [...DEFAULT_COLUMN_ORDER];
}

function saveColumnOrder(order: Array<Status>) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			COLUMN_ORDER_STORAGE_KEY,
			JSON.stringify(order),
		);
	} catch {
		/* ignore quota errors */
	}
}

const PRIORITY_META: Record<
	Priority,
	{ label: string; color: KanbanBoardCircleColor }
> = {
	low: { label: "Low", color: "gray" },
	medium: { label: "Med", color: "yellow" },
	high: { label: "High", color: "red" },
};

type DeadlineTone = "overdue" | "soon" | "future";

function describeDeadline(ms: number): { label: string; tone: DeadlineTone } {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const target = new Date(ms);
	target.setHours(0, 0, 0, 0);
	const diffDays = Math.round(
		(target.getTime() - today.getTime()) / 86_400_000,
	);
	let tone: DeadlineTone = "future";
	if (diffDays < 0) tone = "overdue";
	else if (diffDays <= 3) tone = "soon";

	let label: string;
	if (diffDays === 0) label = "Today";
	else if (diffDays === 1) label = "Tomorrow";
	else if (diffDays === -1) label = "Yesterday";
	else if (diffDays < 0) label = `${-diffDays}d late`;
	else if (diffDays < 7) label = `In ${diffDays}d`;
	else
		label = target.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
		});
	return { label, tone };
}

const DEADLINE_TONE_CLASSES: Record<DeadlineTone, string> = {
	overdue:
		"border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
	soon: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
	future: "border-border bg-muted text-muted-foreground",
};

export function TasksBoard({ clientId }: { clientId?: Id<"clients"> }) {
	const tasks = useQuery(api.tasks.list, { clientId });
	const remove = useMutation(api.tasks.remove);
	const [editingId, setEditingId] = React.useState<Id<"tasks"> | null>(null);
	const [pendingDeletes, setPendingDeletes] = React.useState<Set<Id<"tasks">>>(
		() => new Set(),
	);
	const timersRef = React.useRef<
		Map<Id<"tasks">, ReturnType<typeof setTimeout>>
	>(new Map());

	React.useEffect(() => {
		const timers = timersRef.current;
		return () => {
			for (const timer of timers.values()) clearTimeout(timer);
			timers.clear();
		};
	}, []);

	const requestDelete = React.useCallback(
		(task: Task) => {
			setPendingDeletes((prev) => {
				const next = new Set(prev);
				next.add(task._id);
				return next;
			});

			const toastId = toast(`"${task.title}" deleted`, {
				description: "Will be permanently removed in a few seconds.",
				duration: UNDO_DELAY_MS,
				action: {
					label: "Undo",
					onClick: () => {
						const timer = timersRef.current.get(task._id);
						if (timer) {
							clearTimeout(timer);
							timersRef.current.delete(task._id);
						}
						setPendingDeletes((prev) => {
							const next = new Set(prev);
							next.delete(task._id);
							return next;
						});
					},
				},
			});

			const timer = setTimeout(() => {
				timersRef.current.delete(task._id);
				void remove({ id: task._id }).catch((err) => {
					toast.error("Delete failed", {
						description: err instanceof Error ? err.message : "Unknown error",
					});
					setPendingDeletes((prev) => {
						const next = new Set(prev);
						next.delete(task._id);
						return next;
					});
				});
				toast.dismiss(toastId);
			}, UNDO_DELAY_MS);
			timersRef.current.set(task._id, timer);
		},
		[remove],
	);

	const visibleTasks = React.useMemo(
		() => (tasks ?? []).filter((t) => !pendingDeletes.has(t._id)),
		[tasks, pendingDeletes],
	);

	const editingTask = visibleTasks.find((t) => t._id === editingId) ?? null;

	const [columnOrder, setColumnOrder] = React.useState<Array<Status>>(() => [
		...DEFAULT_COLUMN_ORDER,
	]);
	React.useEffect(() => {
		setColumnOrder(loadColumnOrder());
	}, []);
	React.useEffect(() => {
		saveColumnOrder(columnOrder);
	}, [columnOrder]);

	const moveColumn = React.useCallback(
		(fromId: Status, toId: Status, position: "before" | "after") => {
			setColumnOrder((prev) => {
				if (fromId === toId) return prev;
				const without = prev.filter((id) => id !== fromId);
				const toIdx = without.indexOf(toId);
				if (toIdx === -1) return prev;
				const insertIdx = position === "before" ? toIdx : toIdx + 1;
				const next = [...without];
				next.splice(insertIdx, 0, fromId);
				return next;
			});
		},
		[],
	);

	const orderedColumns = columnOrder
		.map((id) => COLUMNS.find((c) => c.id === id))
		.filter((c): c is ColumnDef => Boolean(c));

	return (
		<>
			<div className="h-[calc(100dvh-14rem)] min-h-[24rem]">
				<KanbanBoardProvider>
					<KanbanBoard className="h-full">
						{orderedColumns.map((col) => (
							<ReorderableColumnWrapper
								key={col.id}
								columnId={col.id}
								onMoveColumn={moveColumn}
							>
								<TasksColumn
									column={col}
									items={visibleTasks.filter((t) => t.status === col.id)}
									clientId={clientId}
									onEdit={setEditingId}
									onDelete={requestDelete}
								/>
							</ReorderableColumnWrapper>
						))}
						<KanbanBoardExtraMargin />
					</KanbanBoard>
				</KanbanBoardProvider>
			</div>
			<EditTaskSheet
				task={editingTask}
				open={editingTask !== null}
				onOpenChange={(open) => {
					if (!open) setEditingId(null);
				}}
			/>
		</>
	);
}

function ReorderableColumnWrapper({
	columnId,
	onMoveColumn,
	children,
}: {
	columnId: Status;
	onMoveColumn: (
		fromId: Status,
		toId: Status,
		position: "before" | "after",
	) => void;
	children: React.ReactNode;
}) {
	const [dropPos, setDropPos] = React.useState<"none" | "before" | "after">(
		"none",
	);

	return (
		<div
			className={cn(
				"relative flex max-h-full",
				dropPos === "before" &&
					"before:bg-primary before:absolute before:-left-1 before:top-0 before:bottom-0 before:w-0.5 before:rounded-full",
				dropPos === "after" &&
					"after:bg-primary after:absolute after:-right-1 after:top-0 after:bottom-0 after:w-0.5 after:rounded-full",
			)}
			onDragOver={(event) => {
				if (!event.dataTransfer.types.includes(COLUMN_DRAG_TYPE)) return;
				event.preventDefault();
				const rect = event.currentTarget.getBoundingClientRect();
				const midpoint = (rect.left + rect.right) / 2;
				setDropPos(event.clientX <= midpoint ? "before" : "after");
			}}
			onDragLeave={() => setDropPos("none")}
			onDrop={(event) => {
				if (!event.dataTransfer.types.includes(COLUMN_DRAG_TYPE)) return;
				event.preventDefault();
				event.stopPropagation();
				const fromId = event.dataTransfer.getData(COLUMN_DRAG_TYPE) as Status;
				const finalPos = dropPos === "none" ? "after" : dropPos;
				if (fromId && fromId !== columnId) {
					onMoveColumn(fromId, columnId, finalPos);
				}
				setDropPos("none");
			}}
		>
			{children}
		</div>
	);
}

type DragPayload = {
	id: Id<"tasks">;
};

function TasksColumn({
	column,
	items,
	clientId,
	onEdit,
	onDelete,
}: {
	column: ColumnDef;
	items: Array<Task>;
	clientId?: Id<"clients">;
	onEdit: (id: Id<"tasks">) => void;
	onDelete: (task: Task) => void;
}) {
	const [adding, setAdding] = React.useState(false);
	const create = useMutation(api.tasks.create);
	const move = useMutation(api.tasks.move);

	const parsePayload = (raw: string): DragPayload | null => {
		if (!raw) return null;
		try {
			const parsed = JSON.parse(raw) as DragPayload;
			return parsed.id ? parsed : null;
		} catch {
			return null;
		}
	};

	const handleDropOnColumn = (raw: string) => {
		const payload = parsePayload(raw);
		if (!payload) return;
		const sameColumnCount = items.filter((i) => i._id !== payload.id).length;
		void move({
			id: payload.id,
			status: column.id,
			targetIndex: sameColumnCount,
		});
	};

	const handleDropOnItem = (
		raw: string,
		overItemId: Id<"tasks">,
		direction: KanbanBoardDropDirection,
	) => {
		const payload = parsePayload(raw);
		if (!payload) return;

		const others = items.filter((i) => i._id !== payload.id);
		const overIndex = others.findIndex((i) => i._id === overItemId);
		if (overIndex === -1) {
			void move({
				id: payload.id,
				status: column.id,
				targetIndex: others.length,
			});
			return;
		}
		const targetIndex = direction === "bottom" ? overIndex + 1 : overIndex;
		void move({
			id: payload.id,
			status: column.id,
			targetIndex,
		});
	};

	return (
		<KanbanBoardColumn
			columnId={column.id}
			onDropOverColumn={handleDropOnColumn}
		>
			<KanbanBoardColumnHeader>
				<KanbanBoardColumnTitle columnId={column.id}>
					<KanbanColorCircle color={column.color} />
					{column.title}
					<span className="text-muted-foreground ml-2 text-xs font-normal">
						{items.length}
					</span>
				</KanbanBoardColumnTitle>
				<div
					draggable
					role="button"
					aria-label="Drag to reorder column"
					title="Drag to reorder column"
					onDragStart={(event) => {
						event.dataTransfer.effectAllowed = "move";
						event.dataTransfer.setData(COLUMN_DRAG_TYPE, column.id);
					}}
					className="text-muted-foreground hover:text-foreground -mr-1 inline-flex size-6 cursor-grab items-center justify-center rounded-md active:cursor-grabbing"
				>
					<GripVertical className="size-4" />
				</div>
			</KanbanBoardColumnHeader>

			<KanbanBoardColumnList>
				{items.map((item) => (
					<KanbanBoardColumnListItem
						key={item._id}
						cardId={item._id}
						onDropOverListItem={(raw, dir) =>
							handleDropOnItem(raw, item._id, dir)
						}
					>
						<TaskCard task={item} onEdit={onEdit} onDelete={onDelete} />
					</KanbanBoardColumnListItem>
				))}
			</KanbanBoardColumnList>

			<KanbanBoardColumnFooter>
				{adding ? (
					<NewTaskForm
						onCancel={() => setAdding(false)}
						onSubmit={async (title) => {
							await create({
								title,
								status: column.id,
								clientId,
							});
							setAdding(false);
						}}
					/>
				) : (
					<KanbanBoardColumnButton onClick={() => setAdding(true)}>
						<Plus className="size-4" />
						Add task
					</KanbanBoardColumnButton>
				)}
			</KanbanBoardColumnFooter>
		</KanbanBoardColumn>
	);
}

function TaskCard({
	task,
	onEdit,
	onDelete,
}: {
	task: Task;
	onEdit: (id: Id<"tasks">) => void;
	onDelete: (task: Task) => void;
}) {
	const priorityMeta = PRIORITY_META[task.priority as Priority];
	const deadline =
		task.dueAt !== undefined ? describeDeadline(task.dueAt) : null;

	return (
		<KanbanBoardCard
			data={{ id: task._id }}
			onClick={(event) => {
				event.stopPropagation();
				onEdit(task._id);
			}}
		>
			<div className="flex items-center gap-1.5">
				<KanbanColorCircle color={priorityMeta.color} className="mr-0" />
				<span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
					{priorityMeta.label}
				</span>
				{task.label ? (
					<span className="text-muted-foreground text-[10px] font-medium">
						· {task.label}
					</span>
				) : null}
				{deadline ? (
					<span
						className={cn(
							"ml-auto inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
							DEADLINE_TONE_CLASSES[deadline.tone],
						)}
					>
						<CalendarIcon className="size-3" />
						{deadline.label}
					</span>
				) : null}
			</div>
			<KanbanBoardCardTitle>{task.title}</KanbanBoardCardTitle>

			<KanbanBoardCardButtonGroup>
				<KanbanBoardCardButton
					tooltip="Edit"
					onClick={(event) => {
						event.stopPropagation();
						onEdit(task._id);
					}}
				>
					<Pencil />
				</KanbanBoardCardButton>
				<KanbanBoardCardButton
					tooltip="Delete"
					onClick={(event) => {
						event.stopPropagation();
						onDelete(task);
					}}
				>
					<Trash2 />
				</KanbanBoardCardButton>
			</KanbanBoardCardButtonGroup>
		</KanbanBoardCard>
	);
}

function NewTaskForm({
	onCancel,
	onSubmit,
}: {
	onCancel: () => void;
	onSubmit: (title: string) => Promise<void>;
}) {
	const [title, setTitle] = React.useState("");
	const [pending, setPending] = React.useState(false);

	const submit = async () => {
		const trimmed = title.trim();
		if (!trimmed || pending) return;
		setPending(true);
		try {
			await onSubmit(trimmed);
		} catch (err) {
			toast.error("Could not add task", {
				description: err instanceof Error ? err.message : String(err),
			});
		} finally {
			setPending(false);
		}
	};

	return (
		<form
			className="flex w-full flex-col gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				void submit();
			}}
		>
			<Input
				autoFocus
				placeholder="Task title"
				value={title}
				onChange={(event) => setTitle(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						onCancel();
					}
				}}
			/>
			<div className="flex items-center justify-end gap-1">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onCancel}
					disabled={pending}
				>
					<X className="size-3" />
					Cancel
				</Button>
				<Button type="submit" size="sm" disabled={!title.trim() || pending}>
					{pending ? "Adding…" : "Add"}
				</Button>
			</div>
		</form>
	);
}
