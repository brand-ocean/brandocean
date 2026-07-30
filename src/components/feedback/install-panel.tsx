import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export function InstallPanel({
	projectId,
}: {
	projectId: Id<"feedbackProjects">;
}) {
	const project = useQuery(api.feedback.getProject, { projectId });
	const clients = useQuery(api.clients.listWithCounts);
	const regenerate = useMutation(api.feedback.regenerateToken);
	const linkClient = useMutation(api.feedback.linkClient);
	const devAdd = useMutation(api.feedback.devAddTestComment);
	const setProjectStatus = useMutation(api.feedback.setProjectStatus);
	const deleteProject = useMutation(api.feedback.deleteProject);
	const setDevHosts = useMutation(api.feedback.setDevHosts);
	const navigate = useNavigate();
	const [clientId, setClientId] = useState("none");
	const [devHostsDraft, setDevHostsDraft] = useState<string | null>(null);

	if (!project || project.widgetToken === null) return null;

	const shareUrl = `${window.location.origin}/share/${project.shareToken}`;
	const devHostsValue = devHostsDraft ?? project.devHosts.join(", ");

	const copy = (text: string, label: string) => {
		navigator.clipboard.writeText(text).then(
			() => toast.success(`${label} copied`),
			() => toast.error("Copy failed"),
		);
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-2">
				<span className="text-xs font-medium text-muted-foreground">
					Status:
				</span>
				{(["active", "paused", "archived"] as const).map((s) => (
					<Button
						key={s}
						size="sm"
						variant={project.status === s ? "default" : "outline"}
						className="capitalize"
						onClick={async () => {
							if (project.status === s) return;
							try {
								await setProjectStatus({ projectId, status: s });
								toast.success(`Project ${s}`);
							} catch {
								toast.error("Could not update status");
							}
						}}
					>
						{s}
					</Button>
				))}
				<span className="text-xs text-muted-foreground">
					{project.status !== "active" &&
						"The project stops accepting new comments when not active."}
				</span>
			</div>

			<div className="space-y-2 rounded-md border bg-background p-3">
				<span className="text-xs font-medium text-muted-foreground">
					Review with the Chrome extension
				</span>
				<p className="text-xs text-muted-foreground">
					Nothing to install on the site — open the Brandocean Feedback
					extension, enter your name and email, and load{" "}
					<code>{project.shopifyDomain}</code>. The extension matches the domain
					to this project automatically and loads its comments.
				</p>
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-xs font-medium text-muted-foreground">
						Extension token (for dev-mode overrides):
					</span>
					<code className="truncate rounded bg-muted px-2 py-1 text-xs">
						{project.widgetToken}
					</code>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => copy(project.widgetToken ?? "", "Token")}
					>
						Copy
					</Button>
				</div>
			</div>

			<div className="space-y-1">
				<span className="text-xs font-medium text-muted-foreground">
					Dev hosts — local URLs that also resolve to this project
				</span>
				<div className="flex items-center gap-2">
					<input
						className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
						placeholder="localhost:5173, 127.0.0.1:3000"
						value={devHostsValue}
						onChange={(e) => setDevHostsDraft(e.target.value)}
					/>
					<Button
						size="sm"
						variant="outline"
						disabled={devHostsDraft === null}
						onClick={async () => {
							const hosts = devHostsValue
								.split(",")
								.map((h) => h.trim())
								.filter(Boolean);
							try {
								await setDevHosts({ projectId, devHosts: hosts });
								setDevHostsDraft(null);
								toast.success("Dev hosts saved");
							} catch {
								toast.error(
									"Only local hosts allowed (localhost, 127.x, *.local, *.test)",
								);
							}
						}}
					>
						Save
					</Button>
				</div>
				<p className="text-xs text-muted-foreground">
					Reviewing e.g. <code>http://localhost:5173</code> in the extension
					then loads this project's comments.
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

			<div className="flex flex-wrap items-center gap-2 border-t pt-4">
				<span className="w-full text-xs text-muted-foreground">
					Danger zone — only revoke a token if it leaked. This does NOT affect
					linked client accounts. Dev-mode token overrides in the extension must
					be updated after.
				</span>
				<Button
					variant="outline"
					size="sm"
					onClick={async () => {
						if (
							!window.confirm(
								"Revoke the current feedback token? The extension re-resolves it by domain automatically, but any dev-mode token override must be updated.",
							)
						)
							return;
						await regenerate({ projectId, which: "widget" });
						toast.success("Feedback token regenerated");
					}}
				>
					<RotateCcwIcon className="size-4" /> Revoke feedback token
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
						await devAdd({
							projectId,
							content: "Test comment from dashboard",
						});
						toast.success("Test comment added");
					}}
				>
					+ Test comment
				</Button>
				<Button
					variant="ghost"
					size="sm"
					className="ml-auto text-destructive hover:text-destructive"
					onClick={async () => {
						if (
							!window.confirm(
								"Delete this project and ALL its feedback permanently? This cannot be undone.",
							)
						)
							return;
						try {
							await deleteProject({ projectId });
							toast.success("Project deleted");
							navigate({ to: "/feedback" });
						} catch {
							toast.error("Could not delete project");
						}
					}}
				>
					Delete project
				</Button>
			</div>
		</div>
	);
}
