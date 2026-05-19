import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeftIcon, CheckIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { FunctionReturnType } from "convex/server";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/feedback/$projectId")({
	component: ProjectBoardPage,
});

const SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;

type StatusFilter = "open" | "resolved" | "all";

function ProjectBoardPage() {
	const { projectId } = Route.useParams();
	const id = projectId as Id<"feedbackProjects">;
	const project = useQuery(api.feedback.getProject, { projectId: id });
	const [filter, setFilter] = useState<StatusFilter>("open");
	const [kindFilter, setKindFilter] = useState<
		"all" | "bug" | "idea" | "question"
	>("all");
	const allComments = useQuery(api.feedback.listComments, {
		projectId: id,
		status: filter === "all" ? undefined : filter,
	});
	const comments =
		allComments && kindFilter !== "all"
			? allComments.filter((c) => c.kind === kindFilter)
			: allComments;

	if (project === undefined) {
		return (
			<div className="mx-auto w-full max-w-4xl space-y-4">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-40" />
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-4xl space-y-8">
			<div>
				<Link
					to="/feedback"
					className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeftIcon className="size-4" /> All projects
				</Link>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h1 className="text-3xl font-semibold tracking-tight">
						{project.name}
					</h1>
					<Badge variant="secondary">{project.status}</Badge>
				</div>
				<p className="mt-1 text-sm text-muted-foreground">
					{project.shopifyDomain || "—"}
				</p>
			</div>

			{project.role === "owner" && <InstallPanel projectId={id} />}

			<div className="space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<Tabs
						value={filter}
						onValueChange={(v) => setFilter(v as StatusFilter)}
					>
						<TabsList>
							<TabsTrigger value="open">Open</TabsTrigger>
							<TabsTrigger value="resolved">Resolved</TabsTrigger>
							<TabsTrigger value="all">All</TabsTrigger>
						</TabsList>
					</Tabs>
					<div className="flex gap-1.5">
						{(["all", "bug", "idea", "question"] as const).map((k) => (
							<button
								key={k}
								type="button"
								onClick={() => setKindFilter(k)}
								className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
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

				{comments === undefined ? (
					<Skeleton className="h-32" />
				) : comments.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>No {filter} comments</EmptyTitle>
							<EmptyDescription>
								Comments dropped on the store show up here.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div className="space-y-6">
						{groupByPage(comments).map(([page, list]) => (
							<section key={page} className="space-y-3">
								<div className="flex items-center gap-2">
									<h3 className="font-mono text-xs text-muted-foreground">
										{page}
									</h3>
									<Badge variant="secondary" className="text-xs">
										{list.length}
									</Badge>
								</div>
								<ul className="space-y-3">
									{list.map((c) => (
										<CommentCard key={c.id} comment={c} />
									))}
								</ul>
							</section>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

type CommentItem = FunctionReturnType<
	typeof api.feedback.listComments
>[number];

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

function groupByPage(
	comments: CommentItem[],
): Array<[string, CommentItem[]]> {
	const map = new Map<string, CommentItem[]>();
	for (const c of comments) {
		const arr = map.get(c.pagePath) ?? [];
		arr.push(c);
		map.set(c.pagePath, arr);
	}
	return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
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

function CommentCard({ comment }: { comment: CommentItem }) {
	const setStatus = useMutation(api.feedback.setCommentStatus);
	const addReply = useMutation(api.feedback.addReply);
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
		<li className="rounded-lg border bg-card p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2 text-sm">
						<span className="font-medium">{comment.authorName}</span>
						{comment.kind && <KindBadge kind={comment.kind} />}
						<Badge variant="outline" className="text-xs">
							{comment.authorType}
						</Badge>
						<span className="text-muted-foreground">
							{timeAgo(comment.createdAt)}
						</span>
					</div>
					<p className="mt-2 whitespace-pre-wrap text-sm">
						{comment.content}
					</p>
					<p className="mt-2 truncate text-xs text-muted-foreground">
						{comment.pagePath} · {comment.metadata?.browser ?? ""}{" "}
						{comment.metadata?.os ?? ""} ·{" "}
						{comment.metadata?.viewportWidth ?? "?"}×
						{comment.metadata?.viewportHeight ?? "?"}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{comment.screenshotUrl && (
						<Dialog>
							<DialogTrigger
								render={
									<button
										type="button"
										className="overflow-hidden rounded-md border transition-opacity hover:opacity-80"
									/>
								}
							>
								<img
									src={comment.screenshotUrl}
									alt="context"
									className="h-14 w-20 object-cover"
								/>
							</DialogTrigger>
							<DialogContent className="max-w-3xl">
								<DialogHeader>
									<DialogTitle>Screenshot</DialogTitle>
								</DialogHeader>
								<img
									src={comment.screenshotUrl}
									alt="Comment context"
									className="w-full rounded-md border"
								/>
							</DialogContent>
						</Dialog>
					)}
					<Button
						variant={comment.status === "open" ? "default" : "outline"}
						size="sm"
						disabled={busy}
						onClick={toggle}
					>
						<CheckIcon className="size-4" />
						{comment.status === "open" ? "Resolve" : "Reopen"}
					</Button>
				</div>
			</div>

			{comment.replies.length > 0 && (
				<ul className="mt-3 space-y-2 border-l pl-4">
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

			<div className="mt-3 flex items-end gap-2">
				<Textarea
					value={reply}
					onChange={(e) => setReply(e.target.value)}
					placeholder="Reply…"
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
			</div>
		</li>
	);
}

function InstallPanel({ projectId }: { projectId: Id<"feedbackProjects"> }) {
	const project = useQuery(api.feedback.getProject, { projectId });
	const clients = useQuery(api.clients.listWithCounts);
	const regenerate = useMutation(api.feedback.regenerateToken);
	const linkClient = useMutation(api.feedback.linkClient);
	const devAdd = useMutation(api.feedback.devAddTestComment);
	const [clientId, setClientId] = useState("none");

	if (!project || project.widgetToken === null) return null;

	const base = SITE_URL ?? "https://YOUR-DEPLOYMENT.convex.site";
	const snippet = `<script>
(function () {
  try {
    var p = new URLSearchParams(location.search);
    if (p.get("feedback") === "1") sessionStorage.setItem("bo_fb", "1");
    if (p.get("feedback") === "0") sessionStorage.removeItem("bo_fb");
    var tags = {% if customer %}{{ customer.tags | json }}{% else %}[]{% endif %};
    var on =
      sessionStorage.getItem("bo_fb") === "1" ||
      (Array.isArray(tags) && tags.indexOf("feedback-reviewer") !== -1);
    if (!on) return;
    window.__FEEDBACK__ = { token: "${project.widgetToken}", base: "${base}" };
    var s = document.createElement("script");
    s.src = "${base}/feedback/widget.js";
    s.async = true;
    document.head.appendChild(s);
  } catch (e) {}
})();
</script>`;
	const shareUrl = `${window.location.origin}/share/${project.shareToken}`;

	const copy = (text: string, label: string) => {
		navigator.clipboard.writeText(text).then(
			() => toast.success(`${label} copied`),
			() => toast.error("Copy failed"),
		);
	};

	return (
		<div className="space-y-4 rounded-lg border bg-muted/30 p-4">
			<h2 className="text-sm font-semibold">Install &amp; share</h2>

			<div>
				<div className="mb-1 flex items-center justify-between">
					<span className="text-xs font-medium text-muted-foreground">
						Theme snippet — paste before &lt;/body&gt; in theme.liquid (inline,
					safe for all visitors)
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => copy(snippet, "Snippet")}
					>
						Copy
					</Button>
				</div>
				<pre className="overflow-x-auto rounded-md border bg-background p-3 text-xs">
					{snippet}
				</pre>
				<p className="mt-1 text-xs text-muted-foreground">
					Add the tag <code>feedback-reviewer</code> to a Shopify customer, or
					append <code>?feedback=1</code> to any store URL, to show the widget.
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<span className="text-xs font-medium text-muted-foreground">
					Guest share link:
				</span>
				<code className="truncate rounded bg-background px-2 py-1 text-xs">
					{shareUrl}
				</code>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => copy(shareUrl, "Share link")}
				>
					Copy
				</Button>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<span className="w-full text-xs text-muted-foreground">
					Danger zone — only revoke a token if a link leaked. This does NOT
					affect linked client accounts. You must re-paste the snippet after.
				</span>
				<Button
					variant="outline"
					size="sm"
					onClick={async () => {
						if (
							!window.confirm(
								"Revoke the current widget token? The snippet already in the store theme will stop working until you paste the new one.",
							)
						)
							return;
						await regenerate({ projectId, which: "widget" });
						toast.success("Widget token regenerated — re-paste the snippet");
					}}
				>
					<RotateCcwIcon className="size-4" /> Revoke widget token
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={async () => {
						if (
							!window.confirm(
								"Revoke the current share token? The old /share link will stop working.",
							)
						)
							return;
						await regenerate({ projectId, which: "share" });
						toast.success("Share token regenerated");
					}}
				>
					<RotateCcwIcon className="size-4" /> Revoke share token
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={async () => {
						await devAdd({ projectId, content: "Test comment from dashboard" });
						toast.success("Test comment added");
					}}
				>
					+ Test comment
				</Button>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<span className="text-xs font-medium text-muted-foreground">
					Give a client login access:
				</span>
				<Select
					value={clientId}
					onValueChange={(v) => setClientId(v ?? "none")}
				>
					<SelectTrigger className="w-56">
						<SelectValue placeholder="Select client" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">Select client</SelectItem>
						{clients?.map((c) => (
							<SelectItem key={c._id} value={c._id}>
								{c.name} {c.email ? `(${c.email})` : "— no email"}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button
					size="sm"
					disabled={clientId === "none"}
					onClick={async () => {
						try {
							await linkClient({
								projectId,
								clientId: clientId as Id<"clients">,
							});
							toast.success("Client linked — they can log in with their email");
						} catch {
							toast.error("Could not link client (needs an email)");
						}
					}}
				>
					Link
				</Button>
			</div>
		</div>
	);
}
