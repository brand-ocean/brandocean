import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { convexSiteUrl } from "@/lib/convex";

export const Route = createFileRoute("/share/$shareToken")({
	component: ShareBoardPage,
	head: () => ({
		meta: [
			{ title: "Feedback board" },
			{ name: "robots", content: "noindex, nofollow" },
		],
	}),
});


type Reply = {
	id: string;
	content: string;
	authorName: string;
	authorType: string;
	createdAt: number;
};
type Comment = {
	id: string;
	pagePath: string;
	content: string;
	kind?: "bug" | "idea" | "question";
	status: "open" | "resolved";
	authorName: string;
	authorType: string;
	createdAt: number;
	screenshotUrl: string | null;
	replies: Reply[];
};
function ShareBoardPage() {
	const { shareToken } = Route.useParams();
	const base = convexSiteUrl.replace(/\/$/, "");
	const [comments, setComments] = useState<Comment[] | null>(null);
	const [projectName, setProjectName] = useState("Feedback");
	const [projectStatus, setProjectStatus] = useState<string>("active");
	const [error, setError] = useState<string | null>(null);
	const [statusF, setStatusF] = useState<"open" | "resolved" | "all">(
		"open",
	);
	const [kindF, setKindF] = useState<
		"all" | "bug" | "idea" | "question"
	>("all");

	const refresh = useCallback(async () => {
		try {
			const res = await fetch(
				`${base}/feedback/comments?token=${encodeURIComponent(shareToken)}`,
			);
			const json = await res.json();
			if (!res.ok) {
				setError(json?.error ?? "Could not load board");
				return;
			}
			setError(null);
			setProjectName(json.project?.name ?? "Feedback");
			setProjectStatus(json.project?.status ?? "active");
			setComments(json.comments ?? []);
		} catch {
			setError("Network error");
		}
	}, [base, shareToken]);

	useEffect(() => {
		refresh();
		const t = setInterval(refresh, 15000);
		return () => clearInterval(t);
	}, [refresh]);

	const filtered = (comments ?? []).filter(
		(c) =>
			(statusF === "all" || c.status === statusF) &&
			(kindF === "all" || c.kind === kindF),
	);
	const grouped = filtered.reduce<Record<string, Comment[]>>((acc, c) => {
		const arr = acc[c.pagePath] ?? [];
		arr.push(c);
		acc[c.pagePath] = arr;
		return acc;
	}, {});
	const pill = (active: boolean) =>
		`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
			active
				? "bg-primary text-primary-foreground"
				: "bg-muted text-muted-foreground hover:text-foreground"
		}`;

	return (
		<div className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">
					{projectName}
				</h1>
				<p className="text-sm text-muted-foreground">
					Shared feedback board — comment without an account.
					{comments &&
						comments.length > 0 &&
						` · ${
							comments.filter((c) => c.status === "open").length
						} open of ${comments.length}`}
				</p>
			</header>

			{projectStatus !== "active" && (
				<p className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-800">
					⏸ This feedback board is {projectStatus} — replies and status
					changes are disabled.
				</p>
			)}

			{error && (
				<p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
					{error}
				</p>
			)}

			{comments && comments.length > 0 && (
				<div className="mb-6 flex flex-wrap gap-1.5">
					{(["open", "resolved", "all"] as const).map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setStatusF(s)}
							className={pill(statusF === s)}
						>
							{s}
						</button>
					))}
					<span className="mx-1 w-px bg-border" />
					{(["all", "bug", "idea", "question"] as const).map((k) => (
						<button
							key={k}
							type="button"
							onClick={() => setKindF(k)}
							className={pill(kindF === k)}
						>
							{k}
						</button>
					))}
				</div>
			)}

			{comments === null && !error ? (
				<p className="text-sm text-muted-foreground">Loading…</p>
			) : filtered.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{comments && comments.length === 0
						? "No comments yet."
						: "No comments match these filters."}
				</p>
			) : (
				Object.entries(grouped).map(([path, list]) => (
					<section key={path} className="mb-8">
						<h2 className="mb-2 font-mono text-xs text-muted-foreground">
							{path}
						</h2>
						<ul className="space-y-3">
							{list.map((c) => (
								<CommentRow
									key={c.id}
									comment={c}
									base={base}
									shareToken={shareToken}
									readOnly={projectStatus !== "active"}
									onChange={refresh}
								/>
							))}
						</ul>
					</section>
				))
			)}
		</div>
	);
}

function CommentRow({
	comment,
	base,
	shareToken,
	readOnly,
	onChange,
}: {
	comment: Comment;
	base: string;
	shareToken: string;
	readOnly?: boolean;
	onChange: () => void;
}) {
	const [reply, setReply] = useState("");
	const [busy, setBusy] = useState(false);

	const post = async (path: string, body: Record<string, unknown>) => {
		setBusy(true);
		try {
			const res = await fetch(`${base}${path}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Feedback-Token": shareToken,
				},
				body: JSON.stringify(body),
			});
			if (res.ok) onChange();
		} finally {
			setBusy(false);
		}
	};

	return (
		<li className="rounded-lg border bg-card p-4">
			<div className="flex items-center justify-between gap-2 text-sm">
				<span className="flex items-center gap-2 font-medium">
					{comment.authorName}
					{comment.kind && (
						<span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold capitalize">
							{comment.kind}
						</span>
					)}
				</span>
				<Badge variant={comment.status === "open" ? "default" : "outline"}>
					{comment.status}
				</Badge>
			</div>
			<p className="mt-2 whitespace-pre-wrap text-sm">{comment.content}</p>
			{comment.screenshotUrl && (
				<a
					href={comment.screenshotUrl}
					target="_blank"
					rel="noreferrer"
					className="mt-2 inline-block"
				>
					<img
						src={comment.screenshotUrl}
						alt="context"
						className="max-h-40 rounded border"
					/>
				</a>
			)}
			{comment.replies.length > 0 && (
				<ul className="mt-3 space-y-2 border-l pl-3">
					{comment.replies.map((r) => (
						<li key={r.id} className="text-sm">
							<span className="font-medium">{r.authorName}</span>
							<p className="whitespace-pre-wrap">{r.content}</p>
						</li>
					))}
				</ul>
			)}
			{!readOnly && (
			<div className="mt-3 flex items-end gap-2">
				<Textarea
					rows={1}
					value={reply}
					onChange={(e) => setReply(e.target.value)}
					placeholder="Reply…"
					className="min-h-9"
				/>
				<Button
					size="sm"
					disabled={busy || !reply.trim()}
					onClick={async () => {
						await post("/feedback/replies", {
							projectToken: shareToken,
							commentId: comment.id,
							content: reply.trim(),
							authorName: "",
							authorEmail: "",
						});
						setReply("");
					}}
				>
					Reply
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={busy}
					onClick={() =>
						post("/feedback/resolve", {
							projectToken: shareToken,
							commentId: comment.id,
							status: comment.status === "open" ? "resolved" : "open",
						})
					}
				>
					{comment.status === "open" ? "Resolve" : "Reopen"}
				</Button>
			</div>
			)}
		</li>
	);
}
