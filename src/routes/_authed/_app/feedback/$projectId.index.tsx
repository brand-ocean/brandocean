import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeftIcon, CheckIcon, Settings2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	closestCorners,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
	KanbanBoardColumnHeader,
	KanbanBoardColumnList,
	KanbanBoardColumnTitle,
	KanbanColorCircle,
	kanbanBoardColumnClassNames,
	type KanbanBoardCircleColor,
} from "@/components/ui/kanban";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { FunctionReturnType } from "convex/server";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/feedback/$projectId/")({
	component: ProjectBoardPage,
});

type KindFilter = "all" | "bug" | "idea" | "question";

const FEEDBACK_COLUMNS: Array<{
	id: "open" | "resolved";
	title: string;
	color: KanbanBoardCircleColor;
}> = [
	{ id: "open", title: "Open", color: "yellow" },
	{ id: "resolved", title: "Resolved", color: "green" },
];

const KIND_CIRCLE: Record<string, KanbanBoardCircleColor> = {
	bug: "red",
	idea: "yellow",
	question: "blue",
};

function ProjectBoardPage() {
	const { projectId } = Route.useParams();
	const id = projectId as Id<"feedbackProjects">;
	const project = useQuery(api.feedback.getProject, { projectId: id });
	const [kindFilter, setKindFilter] = useState<KindFilter>("all");
	const [selected, setSelected] = useState<Id<"comments"> | null>(null);
	const allComments = useQuery(api.feedback.listComments, { projectId: id });
	const setStatus = useMutation(api.feedback.setCommentStatus);
	const [dragId, setDragId] = useState<Id<"comments"> | null>(null);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
	);

	const comments =
		allComments && kindFilter !== "all"
			? allComments.filter((c) => c.kind === kindFilter)
			: allComments;
	const selectedComment =
		comments?.find((c) => c.id === selected) ?? null;
	const activeComment = comments?.find((c) => c.id === dragId) ?? null;

	const onDragStart = (e: DragStartEvent) =>
		setDragId(e.active.id as Id<"comments">);
	const onDragEnd = (e: DragEndEvent) => {
		setDragId(null);
		const over = e.over?.id;
		if (over !== "open" && over !== "resolved") return;
		const cid = e.active.id as Id<"comments">;
		const c = comments?.find((x) => x.id === cid);
		if (c && c.status !== over) {
			void setStatus({ commentId: cid, status: over });
		}
	};

	if (project === undefined) {
		return (
			<div className="mx-auto w-full max-w-6xl space-y-4">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-[60vh]" />
			</div>
		);
	}

	return (
		<div className="mx-auto flex h-[calc(100dvh-3rem)] w-full max-w-6xl flex-col gap-6">
			<div>
				<Link
					to="/feedback"
					className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeftIcon className="size-4" /> All projects
				</Link>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-semibold tracking-tight">
							{project.name}
						</h1>
						<Badge variant="secondary">{project.status}</Badge>
					</div>
					<div className="flex items-center gap-1.5">
						{comments && comments.length > 0 && (
							<button
								type="button"
								onClick={() => {
									const esc = (v: string) =>
										`"${String(v).replace(/"/g, '""')}"`;
									const rows = [
										[
											"status",
											"kind",
											"author",
											"page",
											"content",
											"replies",
											"created",
										].join(","),
										...comments.map((c) =>
											[
												c.status,
												c.kind ?? "",
												c.authorName,
												c.pagePath,
												c.content,
												String(c.replies.length),
												new Date(c.createdAt).toISOString(),
											]
												.map(esc)
												.join(","),
										),
									].join("\n");
									const blob = new Blob([rows], {
										type: "text/csv;charset=utf-8",
									});
									const a = document.createElement("a");
									a.href = URL.createObjectURL(blob);
									a.download = `${project.name || "feedback"}.csv`;
									a.click();
									URL.revokeObjectURL(a.href);
								}}
								className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
							>
								Export CSV
							</button>
						)}
						{(["all", "bug", "idea", "question"] as const).map((k) => (
							<button
								key={k}
								type="button"
								onClick={() => setKindFilter(k)}
								className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
									kindFilter === k
										? "bg-primary text-primary-foreground"
										: "bg-muted text-muted-foreground hover:text-foreground"
								}`}
							>
								{k}
							</button>
						))}
					</div>
				</div>
				<p className="mt-1 text-sm text-muted-foreground">
					{project.shopifyDomain || "—"}
				</p>
			</div>

			{project.role === "owner" && (
				<Link
					to="/feedback/$projectId/install"
					params={{ projectId }}
					className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
				>
					<Settings2Icon className="size-4" /> Install &amp; share
				</Link>
			)}

			{comments === undefined ? (
				<Skeleton className="h-full min-h-[24rem] flex-grow" />
			) : comments.length === 0 && kindFilter === "all" ? (
				<div className="flex flex-grow flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-16 text-center">
					<p className="text-sm font-medium">No feedback yet</p>
					<p className="max-w-sm text-sm text-muted-foreground">
						Add the widget snippet to the store so clients can leave
						comments while reviewing.
					</p>
					{project.role === "owner" && (
						<Link
							to="/feedback/$projectId/install"
							params={{ projectId }}
							className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
						>
							<Settings2Icon className="size-4" /> Install &amp; share
						</Link>
					)}
				</div>
			) : (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCorners}
					onDragStart={onDragStart}
					onDragEnd={onDragEnd}
				>
					<div className="flex min-h-0 flex-grow gap-3 overflow-x-auto pb-2">
						{FEEDBACK_COLUMNS.map((col) => (
							<FeedbackColumn
								key={col.id}
								col={col}
								items={comments.filter((c) => c.status === col.id)}
								onOpen={setSelected}
							/>
						))}
					</div>
					<DragOverlay dropAnimation={null}>
						{activeComment && (
							<div className={cn(CARD_CLS, "rotate-1 shadow-lg")}>
								<FeedbackCardBody comment={activeComment} />
							</div>
						)}
					</DragOverlay>
				</DndContext>
			)}

			<Dialog
				open={selectedComment !== null}
				onOpenChange={(o) => {
					if (!o) setSelected(null);
				}}
			>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Comment</DialogTitle>
					</DialogHeader>
					{selectedComment && (
						<CommentDetail comment={selectedComment} />
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

type CommentItem = FunctionReturnType<
	typeof api.feedback.listComments
>[number];

const CARD_CLS =
	"rounded-lg border border-border bg-background p-3 text-start text-foreground shadow-sm flex w-full flex-col gap-2";

function FeedbackColumn({
	col,
	items,
	onOpen,
}: {
	col: { id: "open" | "resolved"; title: string; color: KanbanBoardCircleColor };
	items: CommentItem[];
	onOpen: (id: Id<"comments">) => void;
}) {
	const { setNodeRef, isOver } = useDroppable({ id: col.id });
	return (
		<section
			ref={setNodeRef}
			className={cn(
				kanbanBoardColumnClassNames,
				"transition-colors",
				isOver && "border-primary bg-accent/40",
			)}
		>
			<KanbanBoardColumnHeader>
				<KanbanBoardColumnTitle columnId={col.id}>
					<KanbanColorCircle color={col.color} />
					{col.title}
					<span className="ml-2 text-xs font-normal text-muted-foreground">
						{items.length}
					</span>
				</KanbanBoardColumnTitle>
			</KanbanBoardColumnHeader>
			<KanbanBoardColumnList className="space-y-2 px-2">
				{items.map((c) => (
					<DraggableCard
						key={c.id}
						comment={c}
						onOpen={() => onOpen(c.id)}
					/>
				))}
				{items.length === 0 && (
					<li className="px-2 py-8 text-center text-xs text-muted-foreground">
						Nothing here
					</li>
				)}
			</KanbanBoardColumnList>
		</section>
	);
}

function DraggableCard({
	comment,
	onOpen,
}: {
	comment: CommentItem;
	onOpen: () => void;
}) {
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({ id: comment.id });
	return (
		<li
			ref={setNodeRef}
			style={{
				transform: CSS.Translate.toString(transform),
				opacity: isDragging ? 0 : 1,
			}}
			{...attributes}
			{...listeners}
			onClick={onOpen}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onOpen();
				}
			}}
			className={cn(
				CARD_CLS,
				"cursor-grab touch-none transition-shadow hover:shadow-md active:cursor-grabbing",
			)}
		>
			<FeedbackCardBody comment={comment} />
		</li>
	);
}

function FeedbackCardBody({ comment }: { comment: CommentItem }) {
	return (
		<>
			<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
				<KanbanColorCircle
					color={comment.kind ? KIND_CIRCLE[comment.kind] : "gray"}
				/>
				<span className="font-medium text-foreground">
					{comment.authorName}
				</span>
				<span>· {timeAgo(comment.createdAt)}</span>
			</div>
			<p className="line-clamp-3 text-xs leading-5 whitespace-pre-wrap">
				{comment.content}
			</p>
			{comment.screenshotUrl && (
				<img
					src={comment.screenshotUrl}
					alt="context"
					className="h-20 w-full rounded-md border object-cover"
				/>
			)}
			<div className="flex items-center justify-between text-[11px] text-muted-foreground">
				<span className="truncate">{comment.pagePath}</span>
				{comment.replies.length > 0 && (
					<span>{comment.replies.length} ↩</span>
				)}
			</div>
		</>
	);
}

const KIND_STYLE: Record<string, { label: string; cls: string }> = {
	bug: { label: "🐞 Bug", cls: "bg-red-100 text-red-700" },
	idea: { label: "💡 Idea", cls: "bg-amber-100 text-amber-700" },
	question: { label: "❓ Question", cls: "bg-blue-100 text-blue-700" },
};

function timeAgo(ts: number): string {
	const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
	if (s < 60) return "just now";
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.floor(h / 24);
	if (d < 7) return `${d}d ago`;
	return new Date(ts).toLocaleDateString();
}

function KindBadge({ kind }: { kind: "bug" | "idea" | "question" }) {
	const s = KIND_STYLE[kind];
	return (
		<span
			className={`rounded px-1.5 py-0.5 text-xs font-semibold ${s.cls}`}
		>
			{s.label}
		</span>
	);
}

function CommentDetail({ comment }: { comment: CommentItem }) {
	const setStatus = useMutation(api.feedback.setCommentStatus);
	const addReply = useMutation(api.feedback.addReply);
	const removeComment = useMutation(api.feedback.deleteComment);
	const [reply, setReply] = useState("");
	const [busy, setBusy] = useState(false);

	const toggle = async () => {
		setBusy(true);
		try {
			await setStatus({
				commentId: comment.id,
				status: comment.status === "open" ? "resolved" : "open",
			});
		} catch {
			toast.error("Could not update status");
		} finally {
			setBusy(false);
		}
	};

	const sendReply = async () => {
		if (!reply.trim()) return;
		setBusy(true);
		try {
			await addReply({ commentId: comment.id, content: reply.trim() });
			setReply("");
		} catch {
			toast.error("Could not send reply");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-2 text-sm">
				<span className="font-medium">{comment.authorName}</span>
				{comment.kind && <KindBadge kind={comment.kind} />}
				<Badge variant="outline" className="text-xs">
					{comment.authorType}
				</Badge>
				<span className="text-muted-foreground">
					{timeAgo(comment.createdAt)}
				</span>
				<Badge
					variant={comment.status === "open" ? "default" : "secondary"}
					className="ml-auto"
				>
					{comment.status}
				</Badge>
			</div>

			<p className="whitespace-pre-wrap text-sm">{comment.content}</p>

			<a
				href={comment.pageUrl}
				target="_blank"
				rel="noreferrer"
				className="block truncate text-xs text-muted-foreground hover:text-foreground"
			>
				{comment.pagePath} · {comment.metadata?.browser ?? ""}{" "}
				{comment.metadata?.os ?? ""} ·{" "}
				{comment.metadata?.viewportWidth ?? "?"}×
				{comment.metadata?.viewportHeight ?? "?"} ↗
			</a>

			{comment.screenshotUrl && (
				<a
					href={comment.screenshotUrl}
					target="_blank"
					rel="noreferrer"
					className="block overflow-hidden rounded-md border transition-opacity hover:opacity-90"
				>
					<img
						src={comment.screenshotUrl}
						alt="Comment context"
						className="max-h-72 w-full object-cover"
					/>
				</a>
			)}

			{comment.replies.length > 0 && (
				<ul className="space-y-3 border-l pl-4">
					{comment.replies.map((r) => (
						<li key={r.id} className="text-sm">
							<span className="font-medium">{r.authorName}</span>{" "}
							<span className="text-xs text-muted-foreground">
								{timeAgo(r.createdAt)}
							</span>
							<p className="whitespace-pre-wrap">{r.content}</p>
						</li>
					))}
				</ul>
			)}

			<div className="flex items-end gap-2">
				<Textarea
					value={reply}
					onChange={(e) => setReply(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							if (!busy && reply.trim()) void sendReply();
						}
					}}
					placeholder="Reply… (Enter to send)"
					rows={1}
					className="min-h-9"
				/>
				<Button
					size="sm"
					disabled={busy || !reply.trim()}
					onClick={sendReply}
				>
					Send
				</Button>
				<Button
					variant={comment.status === "open" ? "default" : "outline"}
					size="sm"
					disabled={busy}
					onClick={toggle}
				>
					<CheckIcon className="size-4" />
					{comment.status === "open" ? "Resolve" : "Reopen"}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					disabled={busy}
					className="text-destructive hover:text-destructive"
					onClick={async () => {
						if (
							!window.confirm(
								"Delete this comment and its replies? This cannot be undone.",
							)
						)
							return;
						setBusy(true);
						try {
							await removeComment({ commentId: comment.id });
							toast.success("Comment deleted");
						} catch {
							toast.error("Could not delete");
							setBusy(false);
						}
					}}
				>
					Delete
				</Button>
			</div>
		</div>
	);
}
