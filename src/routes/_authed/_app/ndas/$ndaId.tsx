import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/react";
import { useMutation, useQuery } from "convex/react";
import {
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	InfoIcon,
	RefreshCwIcon,
	Trash2Icon,
	UserIcon,
} from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DownloadPdfButton } from "@/components/nda/DownloadPdfButton";
import { OfferteEditor } from "@/components/offertes/OfferteEditor";
import { OfferteStaticContent } from "@/components/offertes/OfferteStaticContent";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_authed/_app/ndas/$ndaId")({
	component: NdaDetail,
});

function NdaDetail() {
	const { ndaId } = Route.useParams();
	const id = ndaId as Id<"ndas">;
	const data = useQuery(api.ndas.getById, { id });
	const printRef = useRef<HTMLDivElement>(null);

	if (data === undefined) {
		return (
			<div className="mx-auto max-w-4xl space-y-8">
				<Skeleton className="h-10 w-2/3" />
				<Skeleton className="h-32" />
				<Skeleton className="h-64" />
			</div>
		);
	}

	const { nda, signed } = data;

	return (
		<div className="mx-auto w-full max-w-4xl space-y-6">
			<EditorHeader ndaId={id} title={nda.title} />
			<NdaActionBar
				ndaId={id}
				slug={nda.slug}
				shareToken={nda.shareToken}
				language={nda.language}
				published={nda.published}
				publicReadable={nda.publicReadable}
				clientId={nda.clientId}
				locked={Boolean(nda.signedSlug)}
				printRef={printRef}
				title={nda.title}
			/>

			{signed ? (
				<Alert>
					<CheckIcon />
					<AlertTitle>Signed</AlertTitle>
					<AlertDescription>
						<span>
							Signed by {signed.signedByName}
							{signed.signedByEmail ? ` · ${signed.signedByEmail}` : ""} on{" "}
							{new Date(signed.signedAt).toLocaleString()}.{" "}
							<a
								href={`/ns/${signed.slug}`}
								target="_blank"
								rel="noopener noreferrer"
								className="font-medium underline"
							>
								View signed copy
							</a>
						</span>
					</AlertDescription>
				</Alert>
			) : (
				<Alert>
					<InfoIcon />
					<AlertTitle>Starting template — not legal advice</AlertTitle>
					<AlertDescription>
						This one-way NDA is a sensible starting point. Edit the text to fit
						your situation and have it reviewed by a lawyer before you rely on
						it. Your signature comes from{" "}
						<a href="/settings" className="font-medium underline">
							Settings → Signature
						</a>
						.
					</AlertDescription>
				</Alert>
			)}

			<BodyEditorBlock
				ndaId={id}
				body={nda.body as JSONContent | undefined}
				readOnly={Boolean(nda.signedSlug)}
			/>

			{/* Off-screen static copy captured for the Download PDF export. */}
			{nda.body ? (
				<div
					ref={printRef}
					aria-hidden
					className="nda-doc"
					style={{
						position: "absolute",
						left: "-99999px",
						top: 0,
						width: "760px",
						background: "#ffffff",
						padding: "24px",
					}}
				>
					<OfferteStaticContent content={nda.body as JSONContent} />
				</div>
			) : null}
		</div>
	);
}

function NdaActionBar({
	ndaId,
	slug,
	shareToken,
	language,
	published,
	publicReadable,
	clientId,
	locked,
	printRef,
	title,
}: {
	ndaId: Id<"ndas">;
	slug: string;
	shareToken: string;
	language: "nl" | "en";
	published: boolean;
	publicReadable: boolean;
	clientId: Id<"clients"> | undefined;
	locked: boolean;
	printRef: RefObject<HTMLDivElement | null>;
	title: string;
}) {
	const status = locked
		? { label: "Signed", variant: "default" as const }
		: !published
			? { label: "Draft", variant: "outline" as const }
			: publicReadable
				? { label: "Public", variant: "default" as const }
				: { label: "Shared via link", variant: "secondary" as const };

	return (
		<div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-sm">
			<Badge variant={status.variant} className="ml-1">
				{status.label}
			</Badge>
			<Badge variant="outline" className="uppercase">
				{language}
			</Badge>
			<Separator orientation="vertical" className="mx-1 !h-6" />
			<ClientPickerCompact ndaId={ndaId} clientId={clientId} />
			<div className="ml-auto flex items-center gap-1">
				<DownloadPdfButton targetRef={printRef} filename={title} />
				<CopyPublicUrlButton
					slug={slug}
					shareToken={shareToken}
					publicReadable={publicReadable}
					published={published}
				/>
				<PublishButton ndaId={ndaId} published={published} />
				<RefreshSlugButton ndaId={ndaId} />
				<DeleteNdaButton ndaId={ndaId} />
			</div>
		</div>
	);
}

function PublishButton({
	ndaId,
	published,
}: {
	ndaId: Id<"ndas">;
	published: boolean;
}) {
	const publish = useMutation(api.ndas.publish);
	const unpublish = useMutation(api.ndas.unpublish);
	const [working, setWorking] = useState(false);
	return (
		<Button
			type="button"
			variant={published ? "ghost" : "default"}
			size="sm"
			disabled={working}
			onClick={async () => {
				setWorking(true);
				try {
					if (published) {
						await unpublish({ id: ndaId });
						toast.success("Unpublished");
					} else {
						await publish({ id: ndaId, publicReadable: false });
						toast.success("Published — share the link with its token");
					}
				} catch (err) {
					toast.error("Could not update", {
						description: err instanceof Error ? err.message : String(err),
					});
				} finally {
					setWorking(false);
				}
			}}
		>
			<CheckIcon data-icon="inline-start" />
			{published ? "Unpublish" : "Publish"}
		</Button>
	);
}

function CopyPublicUrlButton({
	slug,
	shareToken,
	publicReadable,
	published,
}: {
	slug: string;
	shareToken: string;
	publicReadable: boolean;
	published: boolean;
}) {
	const [copied, setCopied] = useState(false);
	const origin = typeof window !== "undefined" ? window.location.origin : "";
	const url = publicReadable
		? `${origin}/n/${slug}`
		: `${origin}/n/${slug}?t=${shareToken}`;
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(url);
					setCopied(true);
					toast.success(
						published ? "Share URL copied" : "URL copied — publish to enable",
					);
					setTimeout(() => setCopied(false), 1500);
				} catch (err) {
					toast.error("Could not copy", {
						description: err instanceof Error ? err.message : String(err),
					});
				}
			}}
		>
			{copied ? (
				<CheckIcon data-icon="inline-start" />
			) : (
				<CopyIcon data-icon="inline-start" />
			)}
			Copy link
		</Button>
	);
}

function RefreshSlugButton({ ndaId }: { ndaId: Id<"ndas"> }) {
	const regenerate = useMutation(api.ndas.regenerateSlug);
	const [working, setWorking] = useState(false);
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			disabled={working}
			onClick={async () => {
				if (
					!window.confirm(
						"Regenerate the share URL? Old links to this NDA will stop working.",
					)
				)
					return;
				setWorking(true);
				try {
					const slug = await regenerate({ id: ndaId });
					toast.success("URL refreshed", { description: `New slug: ${slug}` });
				} catch (err) {
					toast.error("Could not refresh URL", {
						description: err instanceof Error ? err.message : String(err),
					});
				} finally {
					setWorking(false);
				}
			}}
			aria-label="Refresh URL"
			className="text-muted-foreground"
		>
			<RefreshCwIcon className="h-4 w-4" />
		</Button>
	);
}

function DeleteNdaButton({ ndaId }: { ndaId: Id<"ndas"> }) {
	const removeNda = useMutation(api.ndas.remove);
	const navigate = useNavigate();
	const [removing, setRemoving] = useState(false);
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			disabled={removing}
			onClick={async () => {
				if (
					!window.confirm(
						"Delete this NDA? This removes the editable draft. Any signed copy is kept.",
					)
				)
					return;
				setRemoving(true);
				try {
					await removeNda({ id: ndaId });
					toast.success("NDA deleted");
					navigate({ to: "/ndas" });
				} catch (err) {
					toast.error("Could not delete", {
						description: err instanceof Error ? err.message : String(err),
					});
					setRemoving(false);
				}
			}}
			aria-label="Delete NDA"
			className="text-muted-foreground hover:text-destructive"
		>
			<Trash2Icon className="h-4 w-4" />
		</Button>
	);
}

const NONE_VALUE = "__none__";

function ClientPickerCompact({
	ndaId,
	clientId,
}: {
	ndaId: Id<"ndas">;
	clientId: Id<"clients"> | undefined;
}) {
	const clients = useQuery(api.clients.list);
	const updateMeta = useMutation(api.ndas.updateMeta);
	if (clients === undefined) {
		return <Skeleton className="h-8 w-44" />;
	}
	if (clients.length === 0) {
		return (
			<Link
				to="/clients"
				className="text-xs text-muted-foreground hover:text-foreground"
			>
				+ add a client
			</Link>
		);
	}
	const current = clientId ? clients.find((c) => c._id === clientId) : null;
	return (
		<div className="flex items-center gap-1.5">
			<Select
				value={clientId ?? NONE_VALUE}
				onValueChange={async (value) => {
					try {
						await updateMeta({
							id: ndaId,
							clientId:
								value === NONE_VALUE ? undefined : (value as Id<"clients">),
						});
					} catch (err) {
						toast.error("Could not update", {
							description: err instanceof Error ? err.message : String(err),
						});
					}
				}}
			>
				<SelectTrigger className="h-8 gap-2 border-dashed text-sm">
					{current ? (
						<span className="truncate font-medium">{current.name}</span>
					) : (
						<div className="flex items-center gap-2 text-muted-foreground">
							<UserIcon className="h-3.5 w-3.5" />
							<SelectValue placeholder="No client" />
						</div>
					)}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={NONE_VALUE}>
						<span className="text-muted-foreground">No client</span>
					</SelectItem>
					{clients.map((c) => (
						<SelectItem key={c._id} value={c._id}>
							<div className="flex items-center gap-2">
								<span className="font-medium">{c.name}</span>
								{c.companyName ? (
									<span className="text-muted-foreground">
										· {c.companyName}
									</span>
								) : null}
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{current ? (
				<Link
					to="/clients/$clientId"
					params={{ clientId: current._id }}
					aria-label="Open client"
					className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
				>
					<ExternalLinkIcon className="h-3.5 w-3.5" />
				</Link>
			) : null}
		</div>
	);
}

function BodyEditorBlock({
	ndaId,
	body,
	readOnly,
}: {
	ndaId: Id<"ndas">;
	body: JSONContent | undefined;
	readOnly: boolean;
}) {
	const updateBody = useMutation(api.ndas.updateBody);
	if (readOnly) {
		return (
			<div className="nda-doc pointer-events-none opacity-80">
				<OfferteEditor value={body} onChange={() => {}} />
			</div>
		);
	}
	return (
		<div className="nda-doc">
			<OfferteEditor
				value={body}
				onChange={(doc) => void updateBody({ id: ndaId, body: doc })}
			/>
		</div>
	);
}

function EditorHeader({ ndaId, title }: { ndaId: Id<"ndas">; title: string }) {
	const updateMeta = useMutation(api.ndas.updateMeta);
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState(title);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (editing) inputRef.current?.focus();
	}, [editing]);

	if (!editing) {
		return (
			<button
				type="button"
				onClick={() => {
					setValue(title);
					setEditing(true);
				}}
				className="text-left text-3xl font-semibold tracking-tight hover:opacity-70"
			>
				{title}
			</button>
		);
	}

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				if (value.trim() && value.trim() !== title) {
					try {
						await updateMeta({ id: ndaId, title: value.trim() });
					} catch (err) {
						toast.error("Could not rename", {
							description: err instanceof Error ? err.message : String(err),
						});
					}
				}
				setEditing(false);
			}}
		>
			<Input
				ref={inputRef}
				value={value}
				onChange={(e) => setValue(e.target.value)}
				onBlur={() => setEditing(false)}
				className="h-12 text-2xl font-semibold"
			/>
		</form>
	);
}
