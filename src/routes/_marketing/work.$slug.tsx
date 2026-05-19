import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "~convex/_generated/api";
import type { Doc } from "~convex/_generated/dataModel";

export const Route = createFileRoute("/_marketing/work/$slug")({
	component: ProjectPage,
});

type Item = Doc<"portfolioItems">;

function stripYear(s?: string) {
	return (s ?? "").replace(/\s*·\s*\d{4}\s*$/, "");
}
function extractYear(s?: string) {
	const m = (s ?? "").match(/\b(\d{4})\b/);
	return m?.[1];
}
function hostnameOf(url?: string) {
	if (!url) return undefined;
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

function ProjectPage() {
	const { slug } = Route.useParams();
	const item = useQuery(api.portfolio.getBySlug, { slug });
	const all = useQuery(api.portfolio.listPublic, {});

	const next = useMemo(() => {
		if (!all || !item) return undefined;
		const idx = all.findIndex((p) => p._id === item._id);
		if (idx < 0) return undefined;
		return all[(idx + 1) % all.length];
	}, [all, item]);

	if (item === undefined) return <ProjectSkeleton />;
	if (item === null) return <ProjectNotFound />;

	return (
		<div className="bg-base-100 text-base-300">
			<ProjectHeader item={item} />
			<ProjectBanner item={item} />
			<ProjectOverview item={item} />
			<ProjectSnapshots item={item} />
			<ProjectInfo item={item} />
			{next ? <NextProject next={next} /> : null}
		</div>
	);
}

function ProjectSkeleton() {
	return (
		<div className="min-h-screen bg-base-100 text-base-300">
			<div className="mx-auto max-w-[1400px] px-8 pt-32">
				<div className="h-32 w-2/3 animate-pulse rounded bg-base-200" />
				<div className="mt-8 h-8 w-1/3 animate-pulse rounded bg-base-200" />
				<div className="mt-12 aspect-video w-full animate-pulse rounded bg-base-200" />
			</div>
		</div>
	);
}

function ProjectNotFound() {
	return (
		<div className="flex min-h-[80vh] flex-col items-center justify-center bg-base-100 text-base-300">
			<p className="font-mono text-sm tracking-wide opacity-60">
				▶ Log not found
			</p>
			<h1 className="mt-4 font-heading text-6xl uppercase">404</h1>
			<Link to="/" className="mt-6 text-sm underline">
				Return to index
			</Link>
		</div>
	);
}

function ProjectHeader({ item }: { item: Item }) {
	const url = hostnameOf(item.externalUrl);
	const year = extractYear(item.project);
	const projectName = stripYear(item.project);
	return (
		<section className="relative h-[75svh] w-screen overflow-hidden">
			<div className="mx-auto flex h-full max-w-[1400px] flex-col justify-end gap-4 px-8 pb-12">
				<div>
					<h1 className="font-heading text-7xl uppercase leading-none tracking-tight md:text-[10rem]">
						{item.title}
					</h1>
				</div>
				<div className="h-px w-full border-b border-dashed border-base-300/25" />
				<div className="flex gap-8 max-md:flex-col">
					<div className="flex-1">
						<p className="font-mono text-sm">{url ?? "—"}</p>
						<p className="font-mono text-sm opacity-60">{item.category}</p>
					</div>
					<div className="flex flex-1 gap-8 max-md:flex-col">
						<div className="flex-1">
							<p className="font-mono text-sm">{year ?? "—"}</p>
							<p className="font-mono text-sm opacity-60">{projectName}</p>
						</div>
						<div className="flex-1">
							<p className="font-mono text-sm">Client</p>
							<p className="font-mono text-sm opacity-60">{projectName}</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function ProjectBanner({ item }: { item: Item }) {
	const url = item.externalUrl;
	const hero = item.heroImageUrl;
	return (
		<section className="my-8 w-full">
			<div className="mx-auto max-w-[1400px] px-8">
				<div className="relative aspect-video overflow-hidden rounded-lg border border-dashed border-base-300/40 bg-base-200 max-md:aspect-[4/5]">
					<LivePreview
						url={url}
						fallbackImage={hero}
						title={item.title}
					/>
				</div>
			</div>
		</section>
	);
}

function ProjectOverview({ item }: { item: Item }) {
	const stack = item.tags ?? [];
	return (
		<section className="relative w-screen overflow-hidden py-8 pb-24">
			<div className="mx-auto flex max-w-[1400px] gap-8 px-8 max-md:flex-col">
				<div className="flex-1 max-md:hidden" />
				<div className="flex flex-1 flex-col gap-16">
					<div>
						<p className="font-mono text-sm">
							<span>▶</span> Stack
						</p>
						<br />
						<div className="flex flex-col gap-1">
							{stack.length > 0 ? (
								stack.map((s) => (
									<p key={s} className="font-body text-base">
										{s}
									</p>
								))
							) : (
								<p className="opacity-60">—</p>
							)}
						</div>
					</div>
					<div className="w-3/4 max-md:w-full">
						<p className="font-mono text-sm">
							<span>▶</span> Background
						</p>
						<br />
						<p className="font-body text-base leading-relaxed">
							{item.summary ?? "—"}
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}

function ProjectSnapshots({ item }: { item: Item }) {
	const sectionRef = useRef<HTMLDivElement>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const progressRef = useRef<HTMLDivElement>(null);

	const slides = useMemo(() => buildSlides(item), [item]);

	useEffect(() => {
		gsap.registerPlugin(ScrollTrigger);
		const wrapper = wrapperRef.current;
		const section = sectionRef.current;
		const progress = progressRef.current;
		if (!wrapper || !section) return;

		const calc = () => -(wrapper.offsetWidth - window.innerWidth);
		let moveDistance = calc();

		const isSafari = /^((?!chrome|android).)*safari/i.test(
			navigator.userAgent,
		);
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

		const trigger = ScrollTrigger.create({
			trigger: section,
			start: "top top",
			end: () => `+=${window.innerHeight * Math.max(slides.length, 3)}px`,
			pin: true,
			pinSpacing: true,
			scrub: isSafari && isIOS ? 0.5 : 1,
			invalidateOnRefresh: true,
			onRefresh: () => {
				moveDistance = calc();
			},
			onUpdate: (self) => {
				gsap.set(wrapper, {
					x: self.progress * moveDistance,
					force3D: true,
				});
				if (progress) {
					gsap.set(progress, { width: `${self.progress * 100}%` });
				}
			},
		});

		const onResize = () => {
			moveDistance = calc();
			ScrollTrigger.refresh();
		};
		window.addEventListener("resize", onResize);

		return () => {
			trigger.kill();
			window.removeEventListener("resize", onResize);
		};
	}, [slides.length]);

	const wrapperWidth = `${slides.length * 100}vw`;

	return (
		<section
			ref={sectionRef}
			className="relative h-[100svh] w-screen overflow-hidden bg-base-300 text-base-100"
		>
			<div className="absolute left-0 top-0 z-10 w-full">
				<div className="mx-auto flex max-w-[1400px] justify-between px-8 py-6">
					<span className="font-mono text-sm opacity-60">▶ ▶</span>
					<span className="font-mono text-sm opacity-60">▶ ▶</span>
				</div>
			</div>
			<div className="absolute bottom-0 left-0 z-10 w-full">
				<div className="mx-auto flex max-w-[1400px] justify-between px-8 py-6">
					<p className="font-mono text-sm">
						<span>▶</span> Interface Study
					</p>
					<p className="font-mono text-sm">/ Live Preview</p>
				</div>
			</div>

			<div
				ref={wrapperRef}
				className="relative flex h-[100svh] overflow-hidden"
				style={{ width: wrapperWidth }}
			>
				{slides.map((s, i) => (
					<div
						key={`${s.kind}-${i}`}
						className="flex flex-1 items-center justify-center"
					>
						<div className="h-[65%] w-[65%] overflow-hidden rounded-lg border border-dashed border-base-secondary/50 bg-base-100 shadow-2xl">
							{s.kind === "iframe" ? (
								<LivePreview
									url={s.url}
									fallbackImage={s.image}
									title={item.title}
								/>
							) : (
								<img
									src={s.image}
									alt=""
									className="h-full w-full object-cover"
								/>
							)}
						</div>
					</div>
				))}
			</div>

			<div className="absolute bottom-8 left-1/2 h-1 w-[20%] min-w-[300px] -translate-x-1/2 overflow-hidden rounded-full bg-base-secondary/30">
				<div
					ref={progressRef}
					className="h-full w-0 bg-base-100"
					style={{ transformOrigin: "left center" }}
				/>
			</div>
		</section>
	);
}

type Slide =
	| { kind: "iframe"; url: string; image?: string }
	| { kind: "image"; image: string };

function buildSlides(item: Item): Slide[] {
	const slides: Slide[] = [];
	const live = item.livePages ?? [];
	const fallback = item.heroImageUrl;

	if (live.length > 0) {
		for (const raw of live) {
			const url = resolveLiveUrl(raw, item.externalUrl);
			if (!url) continue;
			slides.push({ kind: "iframe", url, image: fallback });
		}
	} else if (item.externalUrl) {
		slides.push({
			kind: "iframe",
			url: item.externalUrl,
			image: fallback,
		});
	}

	for (const g of item.gallery ?? []) {
		slides.push({ kind: "image", image: g });
	}

	if (slides.length < 3) {
		const filler = fallback;
		while (slides.length < 3 && filler) {
			slides.push({ kind: "image", image: filler });
		}
	}
	return slides;
}

function resolveLiveUrl(raw: string, base?: string): string | undefined {
	const trimmed = raw.trim();
	if (!trimmed) return undefined;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	if (!base) return undefined;
	try {
		return new URL(trimmed, base).toString();
	} catch {
		return undefined;
	}
}

function ProjectInfo({ item }: { item: Item }) {
	const summary = item.summary;
	if (!summary) return null;
	return (
		<section className="relative w-screen overflow-hidden py-32">
			<div className="mx-auto flex max-w-[1400px] gap-8 px-8 max-md:flex-col">
				<div className="flex-1 max-md:hidden" />
				<div className="flex-1">
					<div className="w-3/4 max-md:w-full">
						<p className="font-mono text-sm">
							<span>▶</span> Notes
						</p>
						<br />
						<p className="font-body text-base leading-relaxed">{summary}</p>
					</div>
				</div>
			</div>
		</section>
	);
}

function NextProject({ next }: { next: Item }) {
	const url = hostnameOf(next.externalUrl);
	const year = extractYear(next.project);
	const projectName = stripYear(next.project);
	return (
		<Link
			to="/work/$slug"
			params={{ slug: next.slug ?? "" }}
			className="block"
		>
			<section className="relative h-[100svh] w-screen overflow-hidden bg-base-300 text-base-100">
				<div className="absolute left-0 top-0 w-full">
					<div className="mx-auto flex max-w-[1400px] justify-between px-8 py-6 font-mono text-sm opacity-60">
						<span>▶ ▶ ▶</span>
						<span>▶ ▶ ▶</span>
					</div>
				</div>
				<div className="mx-auto flex h-full max-w-[1400px] flex-col justify-center gap-4 px-8">
					<h2 className="font-heading text-7xl uppercase leading-none md:text-[10rem]">
						{next.title}
					</h2>
					<div className="h-px w-full border-b border-dashed border-base-100/25" />
					<div className="flex gap-8 max-md:flex-col">
						<div className="flex-1">
							<p className="font-mono text-sm">{url ?? "—"}</p>
							<p className="font-mono text-sm opacity-60">{next.category}</p>
						</div>
						<div className="flex flex-1 gap-8 max-md:flex-col">
							<div className="flex-1">
								<p className="font-mono text-sm">{year ?? "—"}</p>
								<p className="font-mono text-sm opacity-60">{projectName}</p>
							</div>
							<div className="flex-1">
								<p className="font-mono text-sm">Client</p>
								<p className="font-mono text-sm opacity-60">{projectName}</p>
							</div>
						</div>
					</div>
				</div>
				<div className="absolute bottom-0 left-0 w-full">
					<div className="mx-auto flex max-w-[1400px] justify-between px-8 py-6 font-mono text-sm">
						<p>
							<span>▶</span> Next fragment
						</p>
						<p>/ Continue log</p>
					</div>
				</div>
			</section>
		</Link>
	);
}

function LivePreview({
	url,
	fallbackImage,
	title,
}: {
	url?: string;
	fallbackImage?: string;
	title: string;
}) {
	const [loaded, setLoaded] = useState(false);
	const [errored, setErrored] = useState(false);

	useEffect(() => {
		if (!url || loaded || errored) return;
		const t = window.setTimeout(() => {
			if (!loaded) setErrored(true);
		}, 6000);
		return () => window.clearTimeout(t);
	}, [url, loaded, errored]);

	if (!url) {
		return fallbackImage ? (
			<img
				src={fallbackImage}
				alt={title}
				className="h-full w-full object-cover"
			/>
		) : (
			<div className="flex h-full w-full items-center justify-center bg-base-200 font-mono text-sm text-base-300/60">
				No preview
			</div>
		);
	}

	return (
		<div className="relative h-full w-full">
			{!errored ? (
				<iframe
					src={url}
					title={`${title} live preview`}
					loading="lazy"
					sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
					referrerPolicy="no-referrer"
					className="h-full w-full border-0"
					onLoad={() => setLoaded(true)}
				/>
			) : null}
			{(!loaded || errored) && fallbackImage ? (
				<img
					src={fallbackImage}
					alt={title}
					className="absolute inset-0 h-full w-full object-cover"
				/>
			) : null}
			{(!loaded || errored) && !fallbackImage ? (
				<div className="absolute inset-0 flex items-center justify-center bg-base-200 font-mono text-sm text-base-300/60">
					{errored ? "Preview blocked by site" : "Loading…"}
				</div>
			) : null}
		</div>
	);
}
