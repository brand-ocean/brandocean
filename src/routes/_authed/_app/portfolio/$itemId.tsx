import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowLeftIcon, CameraIcon, ExternalLinkIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
	Frame,
	FrameActions,
	FrameDescription,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
} from "@/components/app/frame";
import { BlockEditor } from "@/components/portfolio/BlockEditor";
import { MediaField, MediaListField } from "@/components/portfolio/MediaField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";
import type {
	PortfolioBlock,
	PortfolioMedia,
} from "~convex/lib/portfolioBlocks";

export const Route = createFileRoute("/_authed/_app/portfolio/$itemId")({
	component: PortfolioEditor,
});

/** Everything the editor writes back. Mirrors `portfolio.create`'s arguments. */
interface EditorState {
	title: string;
	category: string;
	project: string;
	ctaLabel: string;
	summary: string;
	industry: string;
	externalUrl: string;
	year: string;
	tags: string[];
	livePages: string[];
	heroImage: PortfolioMedia | undefined;
	galleryMedia: PortfolioMedia[];
	blocks: PortfolioBlock[];
	published: boolean;
	featured: boolean;
}

const BLANK: EditorState = {
	title: "",
	category: "",
	project: "",
	ctaLabel: "View Case",
	summary: "",
	industry: "",
	externalUrl: "",
	year: "",
	tags: [],
	livePages: [],
	heroImage: undefined,
	galleryMedia: [],
	blocks: [],
	published: false,
	featured: false,
};

function PortfolioEditor() {
	const { itemId } = Route.useParams();
	const navigate = useNavigate();
	const isNew = itemId === "new";

	const item = useQuery(
		api.portfolio.getById,
		isNew ? "skip" : { id: itemId as Id<"portfolioItems"> },
	);
	const captureShot = useAction(api.portfolio.captureShot);
	const create = useMutation(api.portfolio.create);
	const update = useMutation(api.portfolio.update);

	const publishedId = useId();
	const featuredId = useId();
	const [state, setState] = useState<EditorState>(BLANK);
	const [loaded, setLoaded] = useState(isNew);
	const [saving, setSaving] = useState(false);
	const [capturing, setCapturing] = useState<"hero" | "gallery" | null>(null);

	// Seed the form once the item arrives; later query updates (our own save
	// echoing back) must not clobber whatever is being typed.
	useEffect(() => {
		if (isNew || !item || loaded) return;
		setState({
			title: item.title,
			category: item.category,
			project: item.project,
			ctaLabel: item.ctaLabel,
			summary: item.summary ?? "",
			industry: item.industry ?? "",
			externalUrl: item.externalUrl ?? "",
			year: item.year ? String(item.year) : "",
			tags: item.tags ?? [],
			livePages: item.livePages ?? [],
			heroImage:
				item.heroImage ??
				(item.heroImageUrl ? { url: item.heroImageUrl } : undefined),
			galleryMedia:
				item.galleryMedia ?? (item.gallery ?? []).map((url) => ({ url })),
			blocks: item.blocks ?? [],
			published: item.published,
			featured: item.featured,
		});
		setLoaded(true);
	}, [isNew, item, loaded]);

	const patch = (next: Partial<EditorState>) =>
		setState((prev) => ({ ...prev, ...next }));

	/**
	 * Screenshots the live site server-side and writes the image onto the item.
	 * The action patches the document directly, so the local form has to pick the
	 * result back up — reset `loaded` and let the query re-seed it.
	 */
	const capture = async (target: "hero" | "gallery") => {
		setCapturing(target);
		try {
			await captureShot({
				id: itemId as Id<"portfolioItems">,
				url: state.externalUrl.trim() || undefined,
				target,
			});
			setLoaded(false);
			toast.success("Screenshot toegevoegd");
		} catch (err) {
			toast.error("Screenshot mislukt", {
				description: err instanceof Error ? err.message : String(err),
			});
		} finally {
			setCapturing(null);
		}
	};

	const save = async () => {
		if (!state.title.trim()) {
			toast.error("Titel is verplicht");
			return;
		}
		const parsedYear = state.year.trim() ? Number(state.year) : undefined;
		if (parsedYear !== undefined && Number.isNaN(parsedYear)) {
			toast.error("Jaar moet een getal zijn");
			return;
		}

		setSaving(true);
		try {
			const payload = {
				title: state.title.trim(),
				category: state.category.trim(),
				project: state.project.trim(),
				ctaLabel: state.ctaLabel.trim() || "View Case",
				summary: state.summary.trim() || undefined,
				industry: state.industry.trim() || undefined,
				externalUrl: state.externalUrl.trim() || undefined,
				year: parsedYear,
				tags: state.tags.length > 0 ? state.tags : undefined,
				livePages: state.livePages.length > 0 ? state.livePages : undefined,
				heroImage: state.heroImage,
				galleryMedia:
					state.galleryMedia.length > 0 ? state.galleryMedia : undefined,
				blocks: state.blocks.length > 0 ? state.blocks : undefined,
				published: state.published,
				featured: state.featured,
			};

			if (isNew) {
				await create(payload);
				toast.success("Aangemaakt");
				await navigate({ to: "/portfolio" });
			} else {
				await update({ id: itemId as Id<"portfolioItems">, ...payload });
				toast.success("Opgeslagen");
			}
		} catch (err) {
			toast.error("Opslaan mislukt", {
				description: err instanceof Error ? err.message : String(err),
			});
		} finally {
			setSaving(false);
		}
	};

	if (!isNew && item === undefined) {
		return (
			<Frame>
				<FramePanel>
					<div className="flex flex-col gap-3">
						<Skeleton className="h-10" />
						<Skeleton className="h-40" />
						<Skeleton className="h-40" />
					</div>
				</FramePanel>
			</Frame>
		);
	}

	return (
		<Frame>
			<FrameHeader>
				<FrameHeading>
					<FrameTitle>
						{isNew ? "Nieuw project" : state.title || "Project"}
					</FrameTitle>
					<FrameDescription>
						Alles op deze pagina komt terug op brandocean.nl — de werkpagina, de
						homepage-kaarten en de case-pagina zelf.
					</FrameDescription>
				</FrameHeading>
				<FrameActions>
					<Button variant="ghost" size="sm" render={<Link to="/portfolio" />}>
						<ArrowLeftIcon data-icon="inline-start" /> Terug
					</Button>
					{!isNew && item?.slug ? (
						<Button
							variant="outline"
							size="sm"
							render={
								// biome-ignore lint/a11y/useAnchorContent: content comes from the Button
								<a
									href={`/work/${item.slug}`}
									target="_blank"
									rel="noopener noreferrer"
								/>
							}
						>
							<ExternalLinkIcon data-icon="inline-start" /> Bekijk
						</Button>
					) : null}
					<Button size="sm" disabled={saving} onClick={() => void save()}>
						{saving ? "Opslaan…" : "Opslaan"}
					</Button>
				</FrameActions>
			</FrameHeader>

			<FramePanel>
				<div className="flex flex-col gap-4">
					<Field label="Titel">
						<Input
							value={state.title}
							placeholder="Check in Cleaning"
							onChange={(e) => patch({ title: e.target.value })}
						/>
					</Field>
					<div className="grid gap-3 sm:grid-cols-2">
						<Field label="Categorie — wat je gedaan hebt">
							<Input
								value={state.category}
								placeholder="Branding & Web Development"
								onChange={(e) => patch({ category: e.target.value })}
							/>
						</Field>
						<Field label="Project — klant en context">
							<Input
								value={state.project}
								placeholder="Schoonmaakbedrijf · Amsterdam"
								onChange={(e) => patch({ project: e.target.value })}
							/>
						</Field>
					</div>
					<div className="grid gap-3 sm:grid-cols-3">
						<Field label="Jaar">
							<Input
								value={state.year}
								inputMode="numeric"
								placeholder="2026"
								onChange={(e) => patch({ year: e.target.value })}
							/>
						</Field>
						<Field label="Branche">
							<Input
								value={state.industry}
								placeholder="RESTAURANT"
								onChange={(e) =>
									patch({ industry: e.target.value.toUpperCase() })
								}
							/>
						</Field>
						<Field label="Knoptekst">
							<Input
								value={state.ctaLabel}
								placeholder="View Case"
								onChange={(e) => patch({ ctaLabel: e.target.value })}
							/>
						</Field>
					</div>
					<Field label="Samenvatting — de intro op de case-pagina en de homepage-kaart">
						<Textarea
							rows={3}
							value={state.summary}
							onChange={(e) => patch({ summary: e.target.value })}
						/>
					</Field>
					<div className="grid gap-3 sm:grid-cols-2">
						<Field label="Externe URL">
							<Input
								value={state.externalUrl}
								placeholder="https://klant.nl"
								onChange={(e) => patch({ externalUrl: e.target.value })}
							/>
						</Field>
						<Field label="Tags — komma-gescheiden">
							<Input
								value={state.tags.join(", ")}
								placeholder="Platform, Automatisering"
								onChange={(e) =>
									patch({
										tags: e.target.value
											.split(",")
											.map((t) => t.trim())
											.filter(Boolean),
									})
								}
							/>
						</Field>
					</div>
					<Field label="Live preview-pagina's — één per regel">
						<Textarea
							rows={3}
							value={state.livePages.join("\n")}
							placeholder={"https://klant.nl/\nhttps://klant.nl/over-ons"}
							onChange={(e) =>
								patch({
									livePages: e.target.value
										.split("\n")
										.map((s) => s.trim())
										.filter(Boolean),
								})
							}
						/>
					</Field>

					<MediaField
						label="Hero-foto"
						description="Staat op de werkpagina-kaart, de homepage-kaart en bovenaan de case-pagina."
						value={state.heroImage}
						onChange={(heroImage) => patch({ heroImage })}
					/>

					{!isNew && state.externalUrl.trim() ? (
						<div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2.5">
							<CameraIcon className="size-4 text-muted-foreground" />
							<span className="text-sm text-muted-foreground">
								Of laat Cloudflare een screenshot van de site maken:
							</span>
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={capturing !== null}
								onClick={() => void capture("hero")}
							>
								{capturing === "hero" ? "Bezig…" : "Als hero"}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="outline"
								disabled={capturing !== null}
								onClick={() => void capture("gallery")}
							>
								{capturing === "gallery" ? "Bezig…" : "Naar fotoreeks"}
							</Button>
						</div>
					) : null}

					<MediaListField
						label="Fotoreeks"
						description="Losse foto's bij dit project. Voor foto's binnen de case-pagina gebruik je een fotoblok hieronder."
						value={state.galleryMedia}
						onChange={(galleryMedia) => patch({ galleryMedia })}
					/>

					<div className="flex flex-wrap items-center gap-6 rounded-md border px-3 py-2.5">
						<div className="flex items-center gap-2 text-sm">
							<Switch
								id={publishedId}
								checked={state.published}
								onCheckedChange={(published) => patch({ published })}
							/>
							<Label htmlFor={publishedId}>Gepubliceerd</Label>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<Switch
								id={featuredId}
								checked={state.featured}
								onCheckedChange={(featured) => patch({ featured })}
							/>
							<Label htmlFor={featuredId}>Uitgelicht op de homepage</Label>
						</div>
					</div>
				</div>
			</FramePanel>

			<FramePanel>
				<div className="mb-4 flex flex-col gap-1">
					<h2 className="text-sm font-medium">Case-pagina</h2>
					<p className="text-xs text-muted-foreground">
						De blokken hieronder vormen de pagina, van boven naar beneden.
					</p>
				</div>
				<BlockEditor
					blocks={state.blocks}
					onChange={(blocks) => patch({ blocks })}
				/>
			</FramePanel>
		</Frame>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label>{label}</Label>
			{children}
		</div>
	);
}
