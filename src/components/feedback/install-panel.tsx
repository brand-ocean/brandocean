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
import { convexSiteUrl } from "@/lib/convex";
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
	const navigate = useNavigate();
	const [clientId, setClientId] = useState("none");

	if (!project || project.widgetToken === null) return null;

	const base = convexSiteUrl;
	const snippet = `<script>
(function () {
  try {
    var p = new URLSearchParams(location.search);
    var fb = p.get("feedback");
    var on1 = (p.has("feedback") && fb !== "0") ||
      location.hash === "#feedback";
    // Stay on across page navigation once turned on, until ?feedback=0.
    try {
      if (on1) localStorage.setItem("bo_fb", "1");
      if (fb === "0") localStorage.removeItem("bo_fb");
    } catch (e) {}
    var saved = false;
    try { saved = localStorage.getItem("bo_fb") === "1"; } catch (e) {}
    var tags = {% if customer %}{{ customer.tags | json }}{% else %}[]{% endif %};
    var on = on1 || saved ||
      (Array.isArray(tags) && tags.indexOf("feedback-reviewer") !== -1);
    if (!on) return;
    window.__FEEDBACK__ = { token: "${project.widgetToken}", base: "${base}" };
    var s = document.createElement("script");
    s.src = "${base}/feedback/widget.js?v=" + Date.now();
    s.async = true;
    document.head.appendChild(s);
  } catch (e) {
    if (window.console && console.warn) console.warn("feedback widget failed", e);
  }
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
						"Widget stops accepting new comments when not active."}
				</span>
			</div>

			<div>
				<div className="mb-1 flex items-center justify-between">
					<span className="text-xs font-medium text-muted-foreground">
						Theme snippet — paste before &lt;/body&gt; in theme.liquid
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
					Add the tag <code>feedback-reviewer</code> to a Shopify customer,
					or append <code>?feedback</code> to any store URL. It then stays
					on as you browse the store; add <code>?feedback=0</code> to turn it off.
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
							toast.success(
								"Client linked — they can log in with their email",
							);
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
					Danger zone — only revoke a token if a link leaked. This does NOT
					affect linked client accounts. You must re-paste the snippet
					after.
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
						toast.success(
							"Widget token regenerated — re-paste the snippet",
						);
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
