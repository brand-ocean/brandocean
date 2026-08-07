import { useMutation } from "convex/react";
import { ImageIcon, Loader2Icon, TrashIcon, UploadIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";
import type { PortfolioMedia } from "~convex/lib/portfolioBlocks";

/**
 * Uploads a file to Convex storage and returns the media object to store on the
 * item. The blob URL is only a preview for this session — once the item is
 * saved, the query resolves the storage id into a real URL.
 */
function useImageUpload() {
	const generateUploadUrl = useMutation(api.portfolio.generateUploadUrl);

	return async (file: File): Promise<PortfolioMedia> => {
		const uploadUrl = await generateUploadUrl();
		const res = await fetch(uploadUrl, {
			method: "POST",
			headers: { "Content-Type": file.type },
			body: file,
		});
		if (!res.ok) throw new Error(`Upload failed (${res.status})`);
		const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
		return { storageId, url: URL.createObjectURL(file), alt: "" };
	};
}

function MediaPreview({
	media,
	className,
}: {
	media: PortfolioMedia;
	className?: string;
}) {
	if (!media.url) {
		return (
			<div
				className={`flex items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`}
			>
				<ImageIcon className="size-5" />
			</div>
		);
	}
	return (
		<img
			src={media.url}
			alt={media.alt || ""}
			className={`object-cover ${className ?? ""}`}
		/>
	);
}

export function MediaField({
	label,
	value,
	onChange,
	description,
}: {
	label: string;
	value: PortfolioMedia | undefined;
	onChange: (next: PortfolioMedia | undefined) => void;
	description?: string;
}) {
	const inputId = useId();
	const fileRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const upload = useImageUpload();

	const pick = async (file: File | undefined) => {
		if (!file) return;
		setBusy(true);
		try {
			const media = await upload(file);
			onChange({ ...media, alt: value?.alt ?? "" });
		} catch (err) {
			toast.error("Upload mislukt", {
				description: err instanceof Error ? err.message : String(err),
			});
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={inputId}>{label}</Label>
			{description ? (
				<p className="text-xs text-muted-foreground">{description}</p>
			) : null}
			<div className="flex items-start gap-3">
				<div className="size-24 shrink-0 overflow-hidden rounded-md border bg-muted">
					<MediaPreview media={value ?? {}} className="size-full" />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className="flex gap-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={busy}
							onClick={() => fileRef.current?.click()}
						>
							{busy ? (
								<Loader2Icon
									data-icon="inline-start"
									className="animate-spin"
								/>
							) : (
								<UploadIcon data-icon="inline-start" />
							)}
							{busy ? "Uploaden…" : "Upload foto"}
						</Button>
						{value?.url || value?.storageId ? (
							<Button
								type="button"
								size="sm"
								variant="ghost"
								onClick={() => onChange(undefined)}
							>
								<TrashIcon data-icon="inline-start" /> Verwijder
							</Button>
						) : null}
					</div>
					<Input
						id={inputId}
						placeholder="…of plak een externe URL"
						value={value?.storageId ? "" : (value?.url ?? "")}
						disabled={Boolean(value?.storageId)}
						onChange={(e) =>
							onChange(
								e.target.value
									? { url: e.target.value, alt: value?.alt ?? "" }
									: undefined,
							)
						}
					/>
					<Input
						placeholder="Alt-tekst"
						value={value?.alt ?? ""}
						onChange={(e) =>
							onChange({ ...(value ?? {}), alt: e.target.value })
						}
					/>
				</div>
			</div>
			<input
				ref={fileRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={(e) => {
					void pick(e.target.files?.[0]);
					e.target.value = "";
				}}
			/>
		</div>
	);
}

export function MediaListField({
	label,
	value,
	onChange,
	description,
}: {
	label: string;
	value: PortfolioMedia[];
	onChange: (next: PortfolioMedia[]) => void;
	description?: string;
}) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const upload = useImageUpload();

	const addFiles = async (files: FileList | null) => {
		if (!files || files.length === 0) return;
		setBusy(true);
		try {
			const uploaded = await Promise.all(
				Array.from(files).map((file) => upload(file)),
			);
			onChange([...value, ...uploaded]);
		} catch (err) {
			toast.error("Upload mislukt", {
				description: err instanceof Error ? err.message : String(err),
			});
		} finally {
			setBusy(false);
		}
	};

	const move = (index: number, delta: number) => {
		const target = index + delta;
		if (target < 0 || target >= value.length) return;
		const next = [...value];
		const [moved] = next.splice(index, 1);
		next.splice(target, 0, moved);
		onChange(next);
	};

	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center justify-between gap-2">
				<Label>{label}</Label>
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={busy}
					onClick={() => fileRef.current?.click()}
				>
					{busy ? (
						<Loader2Icon data-icon="inline-start" className="animate-spin" />
					) : (
						<UploadIcon data-icon="inline-start" />
					)}
					{busy ? "Uploaden…" : "Foto's toevoegen"}
				</Button>
			</div>
			{description ? (
				<p className="text-xs text-muted-foreground">{description}</p>
			) : null}
			{value.length === 0 ? (
				<p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
					Nog geen foto's.
				</p>
			) : (
				<ul className="flex flex-col gap-2">
					{value.map((media, index) => (
						<li
							key={media.storageId ?? media.url ?? index}
							className="flex items-center gap-3 rounded-md border p-2"
						>
							<div className="size-14 shrink-0 overflow-hidden rounded bg-muted">
								<MediaPreview media={media} className="size-full" />
							</div>
							<Input
								className="min-w-0 flex-1"
								placeholder="Alt-tekst"
								value={media.alt ?? ""}
								onChange={(e) => {
									const next = [...value];
									next[index] = { ...media, alt: e.target.value };
									onChange(next);
								}}
							/>
							<div className="flex shrink-0 gap-1">
								<Button
									type="button"
									size="icon-sm"
									variant="ghost"
									aria-label="Omhoog"
									disabled={index === 0}
									onClick={() => move(index, -1)}
								>
									↑
								</Button>
								<Button
									type="button"
									size="icon-sm"
									variant="ghost"
									aria-label="Omlaag"
									disabled={index === value.length - 1}
									onClick={() => move(index, 1)}
								>
									↓
								</Button>
								<Button
									type="button"
									size="icon-sm"
									variant="ghost"
									aria-label="Verwijder"
									onClick={() => onChange(value.filter((_, i) => i !== index))}
								>
									<TrashIcon />
								</Button>
							</div>
						</li>
					))}
				</ul>
			)}
			<input
				ref={fileRef}
				type="file"
				accept="image/*"
				multiple
				className="hidden"
				onChange={(e) => {
					void addFiles(e.target.files);
					e.target.value = "";
				}}
			/>
		</div>
	);
}
