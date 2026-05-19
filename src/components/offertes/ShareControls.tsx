import { useMutation } from "convex/react";
import { CheckIcon, CopyIcon, Share2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

type ShareControlsProps = {
	offerteId: Id<"offertes">;
	slug: string;
	shareToken: string;
	published: boolean;
	publicReadable: boolean;
	hideBadge?: boolean;
};

export function ShareControls({
	offerteId,
	slug,
	shareToken,
	published,
	publicReadable,
	hideBadge = false,
}: ShareControlsProps) {
	const publish = useMutation(api.offertes.publish);
	const unpublish = useMutation(api.offertes.unpublish);
	const [copied, setCopied] = useState(false);

	const origin =
		typeof window !== "undefined" ? window.location.origin : "";
	const shareUrl = publicReadable
		? `${origin}/o/${slug}`
		: `${origin}/o/${slug}?t=${shareToken}`;

	const status = !published
		? { label: "Draft", variant: "outline" as const }
		: publicReadable
			? { label: "Public", variant: "default" as const }
			: { label: "Shared via link", variant: "secondary" as const };

	const togglePublish = async (next: boolean) => {
		try {
			if (next) {
				await publish({ id: offerteId, publicReadable });
			} else {
				await unpublish({ id: offerteId });
			}
		} catch (err) {
			toast.error("Could not update sharing", {
				description: err instanceof Error ? err.message : String(err),
			});
		}
	};

	const togglePublic = async (next: boolean) => {
		try {
			await publish({ id: offerteId, publicReadable: next });
		} catch (err) {
			toast.error("Could not update visibility", {
				description: err instanceof Error ? err.message : String(err),
			});
		}
	};

	const copyLink = async () => {
		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			toast.success("Link copied");
			setTimeout(() => setCopied(false), 1500);
		} catch (err) {
			toast.error("Could not copy", {
				description: err instanceof Error ? err.message : String(err),
			});
		}
	};

	return (
		<div className="flex items-center gap-2">
			{!hideBadge && <Badge variant={status.variant}>{status.label}</Badge>}
			<Popover>
				<PopoverTrigger render={<Button variant="outline" size="sm" />}>
					<Share2Icon data-icon="inline-start" />
					Share
				</PopoverTrigger>
				<PopoverContent align="end" className="w-80 space-y-4 p-4">
					<div className="space-y-1">
						<h3 className="text-sm font-semibold">Share this offerte</h3>
						<p className="text-xs text-muted-foreground">
							Publish to give your client a link they can open in any browser.
						</p>
					</div>

					<Separator />

					<div className="flex items-center justify-between gap-3">
						<div className="space-y-0.5">
							<Label htmlFor="publish-toggle" className="text-sm">
								Published
							</Label>
							<p className="text-xs text-muted-foreground">
								Off keeps it private to you.
							</p>
						</div>
						<Switch
							id="publish-toggle"
							checked={published}
							onCheckedChange={(v) => void togglePublish(v)}
						/>
					</div>

					<div className="flex items-center justify-between gap-3">
						<div className="space-y-0.5">
							<Label htmlFor="public-toggle" className="text-sm">
								Anyone with the link
							</Label>
							<p className="text-xs text-muted-foreground">
								Off requires the secret token in the URL.
							</p>
						</div>
						<Switch
							id="public-toggle"
							checked={publicReadable}
							disabled={!published}
							onCheckedChange={(v) => void togglePublic(v)}
						/>
					</div>

					<Separator />

					<div className="space-y-2">
						<Label className="text-xs uppercase tracking-wide text-muted-foreground">
							Share link
						</Label>
						<div className="flex items-center gap-2">
							<code className="flex-1 truncate rounded-md border bg-muted px-2 py-1.5 text-xs">
								{shareUrl}
							</code>
							<Button
								type="button"
								variant="outline"
								size="icon"
								onClick={() => void copyLink()}
								aria-label="Copy share link"
							>
								{copied ? <CheckIcon /> : <CopyIcon />}
							</Button>
						</div>
						{!published && (
							<p className="text-xs text-muted-foreground">
								Turn on Published to make this link work.
							</p>
						)}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
