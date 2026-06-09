import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
	ArrowLeftIcon,
	CameraIcon,
	CheckIcon,
	Loader2Icon,
	MonitorIcon,
	SmartphoneIcon,
} from "lucide-react";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LiveMobilePreview } from "@/components/feedback/live-mobile-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute(
	"/_authed/_app/feedback/$projectId/review",
)({ component: ReviewPage });

type Device = "desktop" | "mobile";
type Kind = "bug" | "idea" | "question";
type Comment = FunctionReturnType<typeof api.feedback.listComments>[number];

const KIND_DOT: Record<string, string> = {
	bug: "bg-red-500",
	idea: "bg-amber-500",
	question: "bg-blue-500",
};

function ReviewPage() {
	const { projectId } = Route.useParams();
	const id = projectId as Id<"feedbackProjects">;

	const project = useQuery(api.feedback.getProject, { projectId: id });
	const snapshots = useQuery(api.snapshots.listForProject, { projectId: id });
	const comments = useQuery(api.feedback.listComments, { projectId: id });
	const capture = useAction(api.snapshots.capture);

	const [device, setDevice] = useState<Device>("desktop");
	const [path, setPath] = useState("/");
	const [capturing, setCapturing] = useState(false);
	// "shot" = server screenshot review; "live" = streamed interactive mobile.
	const [mode, setMode] = useState<"shot" | "live">("shot");

	// Paths that already have at least one snapshot or pinned comment.
	const knownPaths = useMemo(() => {
		const set = new Set<string>();
		for (const s of snapshots ?? []) set.add(s.pagePath);
		for (const c of comments ?? []) if (c.imagePin) set.add(c.pagePath);
		return Array.from(set).sort();
	}, [snapshots, comments]);

	const snapshot = (snapshots ?? []).find(
		(s) => s.pagePath === normalize(path) && s.device === device,
	);
	const pins = (comments ?? []).filter(
		(c) => c.imagePin?.device === device && c.pagePath === normalize(path),
	);

	const runCapture = async () => {
		setCapturing(true);
		try {
			await capture({ projectId: id, pagePath: normalize(path), device });
			toast.success("Snapshot captured");
		} catch (e) {
			const msg = e instanceof Error ? e.message : "";
			toast.error(
				msg.includes("cloudflare_not_configured")
					? "Cloudflare Browser Rendering isn't configured yet"
					: "Capture failed — check the page path",
			);
		} finally {
			setCapturing(false);
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
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
			<div>
				<Link
					to="/feedback/$projectId"
					params={{ projectId }}
					className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeftIcon className="size-4" /> Back to board
				</Link>
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">Review</h1>
						<p className="mt-1 text-sm text-muted-foreground">
							{project.shopifyDomain} · click the screenshot to leave a comment
						</p>
					</div>
					<div className="flex items-center gap-1.5">
						<div className="flex rounded-md bg-muted p-0.5">
							{(["shot", "live"] as const).map((mo) => (
								<button
									key={mo}
									type="button"
									onClick={() => {
										setMode(mo);
										if (mo === "live") setDevice("mobile");
									}}
									className={cn(
										"rounded px-2.5 py-1 text-xs font-medium transition-colors",
										mode === mo
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{mo === "shot" ? "Screenshot" : "⚡ Live"}
								</button>
							))}
						</div>
						<div className="flex rounded-md bg-muted p-0.5">
							{(["desktop", "mobile"] as const).map((d) => (
								<button
									key={d}
									type="button"
									onClick={() => setDevice(d)}
									className={cn(
										"inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
										device === d
											? "bg-background text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{d === "desktop" ? (
										<MonitorIcon className="size-3.5" />
									) : (
										<SmartphoneIcon className="size-3.5" />
									)}
									{d}
								</button>
							))}
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2">
				<form
					className="flex items-center gap-2"
					onSubmit={(e: FormEvent) => {
						e.preventDefault();
						void runCapture();
					}}
				>
					<input
						value={path}
						onChange={(e) => setPath(e.target.value)}
						placeholder="/collections/all"
						spellCheck={false}
						className="h-8 w-64 rounded-md border bg-background px-2.5 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
					/>
					<Button type="submit" size="sm" disabled={capturing}>
						{capturing ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : (
							<CameraIcon className="size-4" />
						)}
						{snapshot ? "Recapture" : "Capture"}
					</Button>
				</form>
				{knownPaths.map((p) => (
					<button
						key={p}
						type="button"
						onClick={() => setPath(p)}
						className={cn(
							"rounded-md px-2 py-1 font-mono text-xs transition-colors",
							normalize(path) === p
								? "bg-primary text-primary-foreground"
								: "bg-muted text-muted-foreground hover:text-foreground",
						)}
					>
						{p}
					</button>
				))}
			</div>

			{mode === "live" ? (
				<LiveMobilePreview projectId={id} path={normalize(path)} />
			) : (
				<SnapshotCanvas
					projectId={id}
					device={device}
					path={normalize(path)}
					snapshot={snapshot}
					pins={pins}
					capturing={capturing}
					onCapture={runCapture}
				/>
			)}
		</div>
	);
}

type Snapshot = NonNullable<
	FunctionReturnType<typeof api.snapshots.listForProject>
>[number];

function SnapshotCanvas({
	projectId,
	device,
	path,
	snapshot,
	pins,
	capturing,
	onCapture,
}: {
	projectId: Id<"feedbackProjects">;
	device: Device;
	path: string;
	snapshot: Snapshot | undefined;
	pins: Comment[];
	capturing: boolean;
	onCapture: () => void;
}) {
	const createComment = useMutation(api.snapshots.createImageComment);
	const imgRef = useRef<HTMLDivElement>(null);
	const [draft, setDraft] = useState<{ nx: number; ny: number } | null>(null);
	const [openPin, setOpenPin] = useState<Id<"comments"> | null>(null);

	if (snapshot === undefined && !capturing) {
		return (
			<EmptyCanvas
				title="No snapshot for this page yet"
				body="Capture a server-rendered screenshot of this page to start leaving pinned feedback — no iframe, works on any Shopify theme."
				cta="Capture this page"
				onCapture={onCapture}
			/>
		);
	}
	if (capturing && snapshot?.status !== "ready") {
		return (
			<div className="flex h-[60vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed text-center">
				<Loader2Icon className="size-6 animate-spin text-muted-foreground" />
				<p className="text-sm text-muted-foreground">
					Rendering {path} ({device})…
				</p>
			</div>
		);
	}
	if (snapshot?.status === "error") {
		return (
			<EmptyCanvas
				title="Capture failed"
				body={snapshot.error ?? "The page couldn't be rendered."}
				cta="Try again"
				onCapture={onCapture}
			/>
		);
	}
	if (!snapshot?.url) {
		return (
			<EmptyCanvas
				title="Snapshot is still processing"
				body="Give it a moment, then recapture if it doesn't appear."
				cta="Recapture"
				onCapture={onCapture}
			/>
		);
	}

	const aspect =
		snapshot.width && snapshot.height
			? `${snapshot.width} / ${snapshot.height}`
			: undefined;

	const onCanvasClick = (e: React.MouseEvent) => {
		if (openPin) {
			setOpenPin(null);
			return;
		}
		const el = imgRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		const nx = (e.clientX - r.left) / r.width;
		const ny = (e.clientY - r.top) / r.height;
		setDraft({ nx: clamp01(nx), ny: clamp01(ny) });
	};

	return (
		<div className="overflow-auto rounded-lg border bg-muted/30">
			<div
				className="relative mx-auto w-full"
				style={{ maxWidth: device === "mobile" ? 420 : "100%" }}
			>
				{/* biome-ignore lint/a11y/noStaticElementInteractions: image canvas drop-target */}
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: coordinate picker; keyboard placement is not meaningful */}
				<div
					ref={imgRef}
					className="relative w-full cursor-crosshair select-none"
					style={{ aspectRatio: aspect }}
					onClick={onCanvasClick}
				>
					<img
						src={snapshot.url}
						alt={`${path} (${device})`}
						className="block w-full"
						draggable={false}
					/>

					{pins.map((c, i) => (
						<button
							key={c.id}
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								setOpenPin(openPin === c.id ? null : c.id);
								setDraft(null);
							}}
							style={{
								left: `${(c.imagePin?.nx ?? 0) * 100}%`,
								top: `${(c.imagePin?.ny ?? 0) * 100}%`,
							}}
							className={cn(
								"absolute -translate-x-1/2 -translate-y-full",
								"flex size-6 items-center justify-center rounded-full rounded-bl-none",
								"border-2 border-white text-[11px] font-bold text-white shadow-md",
								c.status === "resolved" ? "bg-emerald-500" : "bg-primary",
							)}
							title={c.content}
						>
							{i + 1}
						</button>
					))}

					{draft && (
						// biome-ignore lint/a11y/noStaticElementInteractions: positioning wrapper; only stops canvas click bubbling
						<div
							style={{
								left: `${draft.nx * 100}%`,
								top: `${draft.ny * 100}%`,
							}}
							className="absolute z-10 -translate-x-1/2 translate-y-2"
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => e.stopPropagation()}
						>
							<Composer
								onCancel={() => setDraft(null)}
								onSubmit={async (content, kind) => {
									await createComment({
										projectId,
										pagePath: path,
										device,
										nx: draft.nx,
										ny: draft.ny,
										content,
										kind,
									});
									setDraft(null);
								}}
							/>
						</div>
					)}

					{openPin &&
						(() => {
							const c = pins.find((p) => p.id === openPin);
							if (!c) return null;
							return (
								// biome-ignore lint/a11y/noStaticElementInteractions: positioning wrapper; only stops canvas click bubbling
								<div
									style={{
										left: `${(c.imagePin?.nx ?? 0) * 100}%`,
										top: `${(c.imagePin?.ny ?? 0) * 100}%`,
									}}
									className="absolute z-10 -translate-x-1/2 translate-y-2"
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => e.stopPropagation()}
								>
									<PinCard comment={c} onClose={() => setOpenPin(null)} />
								</div>
							);
						})()}
				</div>
			</div>
		</div>
	);
}

function Composer({
	onCancel,
	onSubmit,
}: {
	onCancel: () => void;
	onSubmit: (content: string, kind: Kind | undefined) => Promise<void>;
}) {
	const [content, setContent] = useState("");
	const [kind, setKind] = useState<Kind | undefined>(undefined);
	const [busy, setBusy] = useState(false);

	const submit = async () => {
		const t = content.trim();
		if (!t) return;
		setBusy(true);
		try {
			await onSubmit(t, kind);
		} catch {
			toast.error("Could not save comment");
			setBusy(false);
		}
	};

	return (
		<div className="w-72 rounded-lg border bg-popover p-2.5 shadow-xl">
			<Textarea
				autoFocus
				rows={3}
				value={content}
				onChange={(e) => setContent(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						if (!busy) void submit();
					}
					if (e.key === "Escape") onCancel();
				}}
				placeholder="What needs changing here?"
				className="mb-2 min-h-16 text-sm"
			/>
			<div className="flex items-center justify-between gap-2">
				<div className="flex gap-1">
					{(["bug", "idea", "question"] as const).map((k) => (
						<button
							key={k}
							type="button"
							onClick={() => setKind(kind === k ? undefined : k)}
							className={cn(
								"flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium capitalize transition-colors",
								kind === k
									? "bg-accent text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<span className={cn("size-2 rounded-full", KIND_DOT[k])} />
							{k}
						</button>
					))}
				</div>
				<div className="flex gap-1">
					<Button
						type="button"
						size="sm"
						variant="ghost"
						onClick={onCancel}
						disabled={busy}
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={submit}
						disabled={busy || !content.trim()}
					>
						{busy ? <Loader2Icon className="size-4 animate-spin" /> : "Comment"}
					</Button>
				</div>
			</div>
		</div>
	);
}

function PinCard({
	comment,
	onClose,
}: {
	comment: Comment;
	onClose: () => void;
}) {
	const setStatus = useMutation(api.feedback.setCommentStatus);
	const [busy, setBusy] = useState(false);
	return (
		<div className="w-72 rounded-lg border bg-popover p-3 shadow-xl">
			<div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
				<span className="font-medium text-foreground">
					{comment.authorName}
				</span>
				{comment.kind && (
					<span className="flex items-center gap-1 capitalize">
						<span
							className={cn("size-2 rounded-full", KIND_DOT[comment.kind])}
						/>
						{comment.kind}
					</span>
				)}
				<Badge
					variant={comment.status === "open" ? "default" : "secondary"}
					className="ml-auto"
				>
					{comment.status}
				</Badge>
			</div>
			<p className="whitespace-pre-wrap text-sm">{comment.content}</p>
			<div className="mt-2 flex justify-end gap-1">
				<Button
					size="sm"
					variant="outline"
					disabled={busy}
					onClick={async () => {
						setBusy(true);
						try {
							await setStatus({
								commentId: comment.id,
								status: comment.status === "open" ? "resolved" : "open",
							});
							onClose();
						} catch {
							toast.error("Could not update");
							setBusy(false);
						}
					}}
				>
					<CheckIcon className="size-4" />
					{comment.status === "open" ? "Resolve" : "Reopen"}
				</Button>
			</div>
		</div>
	);
}

function EmptyCanvas({
	title,
	body,
	cta,
	onCapture,
}: {
	title: string;
	body: string;
	cta: string;
	onCapture: () => void;
}) {
	return (
		<div className="flex h-[60vh] flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 text-center">
			<CameraIcon className="size-6 text-muted-foreground" />
			<p className="text-sm font-medium">{title}</p>
			<p className="max-w-md text-sm text-muted-foreground">{body}</p>
			<Button size="sm" onClick={onCapture}>
				<CameraIcon className="size-4" /> {cta}
			</Button>
		</div>
	);
}

function normalize(p: string): string {
	let s = (p || "/").trim();
	if (!s.startsWith("/")) s = `/${s}`;
	s = s.split(/[?#]/)[0];
	return s || "/";
}

function clamp01(n: number): number {
	return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}
