"use client";

import { useQuery } from "convex/react";
import gsap from "gsap";
import { useEffect, useMemo, useRef } from "react";
import { api } from "~convex/_generated/api";

type Item = {
	title: string;
	category: string;
	project: string;
	ctaLabel: string;
	slug?: string;
	externalUrl?: string;
	industry?: string;
};

const FALLBACK: Item[] = [
	{
		title: "Kiesbeter",
		category: "Branding & Webdevelopment",
		project: "Kiesbeter",
		ctaLabel: "",
	},
	{
		title: "Brandocean Studio",
		category: "Branding & Identity",
		project: "Brandocean Studio",
		ctaLabel: "",
	},
	{
		title: "Atelier Project",
		category: "E-commerce & Webdevelopment",
		project: "Atelier Project",
		ctaLabel: "",
	},
	{
		title: "North Harbour",
		category: "Webdevelopment",
		project: "North Harbour",
		ctaLabel: "",
	},
	{
		title: "Studio Verde",
		category: "Branding & AI",
		project: "Studio Verde",
		ctaLabel: "",
	},
];

const POSITIONS = {
	BOTTOM: "0%",
	MIDDLE: "-33.333%",
	TOP: "-66.666%",
};

export function ObservationRegistry() {
	const listRef = useRef<HTMLDivElement>(null);
	const data = useQuery(api.portfolio.listPublic, {});

	const items: Item[] = useMemo(() => {
		if (!data || data.length === 0) return FALLBACK;
		return data.map((d) => ({
			title: d.title,
			category: d.category,
			project: d.project,
			ctaLabel: d.ctaLabel,
			slug: d.slug,
			externalUrl: d.externalUrl,
			industry: d.industry,
		}));
	}, [data]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run when rendered items change (DOM children change)
	useEffect(() => {
		const list = listRef.current;
		if (!list) return;

		const expeditions = Array.from(
			list.querySelectorAll<HTMLDivElement>(".expedition"),
		);
		const positions = new Map<HTMLDivElement, string>();
		const lastMouse = { x: 0, y: 0 };
		let active: HTMLDivElement | null = null;
		let ticking = false;

		const isMobile = () => window.innerWidth < 1000;

		expeditions.forEach((el) => {
			positions.set(el, POSITIONS.TOP);
			const wrapper = el.querySelector<HTMLDivElement>(".expedition-wrapper");
			if (wrapper && isMobile()) gsap.set(wrapper, { y: POSITIONS.TOP });
		});

		const updateOnScroll = () => {
			if (active) {
				const rect = active.getBoundingClientRect();
				const stillOver =
					lastMouse.x >= rect.left &&
					lastMouse.x <= rect.right &&
					lastMouse.y >= rect.top &&
					lastMouse.y <= rect.bottom;
				if (!stillOver) {
					const wrapper = active.querySelector<HTMLDivElement>(
						".expedition-wrapper",
					);
					const leavingFromTop = lastMouse.y < rect.top + rect.height / 2;
					if (wrapper) {
						gsap.to(wrapper, {
							y: leavingFromTop ? POSITIONS.TOP : POSITIONS.BOTTOM,
							duration: 0.4,
							ease: "power2.out",
						});
					}
					active = null;
				}
			}
			expeditions.forEach((el) => {
				if (el === active) return;
				const rect = el.getBoundingClientRect();
				const isOver =
					lastMouse.x >= rect.left &&
					lastMouse.x <= rect.right &&
					lastMouse.y >= rect.top &&
					lastMouse.y <= rect.bottom;
				if (isOver) {
					const wrapper = el.querySelector<HTMLDivElement>(
						".expedition-wrapper",
					);
					if (wrapper) {
						gsap.to(wrapper, {
							y: POSITIONS.MIDDLE,
							duration: 0.4,
							ease: "power2.out",
						});
					}
					active = el;
				}
			});
			ticking = false;
		};

		const onMouseMove = (e: MouseEvent) => {
			lastMouse.x = e.clientX;
			lastMouse.y = e.clientY;
		};
		const onScroll = () => {
			if (!ticking) {
				requestAnimationFrame(updateOnScroll);
				ticking = true;
			}
		};

		const enterHandlers: Array<() => void> = [];

		const setupListeners = () => {
			if (!isMobile()) {
				document.addEventListener("mousemove", onMouseMove);
				document.addEventListener("scroll", onScroll, { passive: true });
				expeditions.forEach((el) => {
					const wrapper = el.querySelector<HTMLDivElement>(
						".expedition-wrapper",
					);
					if (!wrapper) return;
					const onEnter = (e: MouseEvent) => {
						active = el;
						const rect = el.getBoundingClientRect();
						const enterFromTop = e.clientY < rect.top + rect.height / 2;
						const current = positions.get(el);
						if (enterFromTop || current === POSITIONS.BOTTOM) {
							positions.set(el, POSITIONS.MIDDLE);
							gsap.to(wrapper, {
								y: POSITIONS.MIDDLE,
								duration: 0.4,
								ease: "power2.out",
							});
						}
					};
					const onLeave = (e: MouseEvent) => {
						active = null;
						const rect = el.getBoundingClientRect();
						const leavingFromTop = e.clientY < rect.top + rect.height / 2;
						const next = leavingFromTop ? POSITIONS.TOP : POSITIONS.BOTTOM;
						positions.set(el, next);
						gsap.to(wrapper, { y: next, duration: 0.4, ease: "power2.out" });
					};
					el.addEventListener("mouseenter", onEnter);
					el.addEventListener("mouseleave", onLeave);
					enterHandlers.push(() => {
						el.removeEventListener("mouseenter", onEnter);
						el.removeEventListener("mouseleave", onLeave);
					});
				});
			}
		};

		setupListeners();

		let resizeTimer: number | undefined;
		const onResize = () => {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(() => {
				document.removeEventListener("mousemove", onMouseMove);
				document.removeEventListener("scroll", onScroll);
				for (const u of enterHandlers) u();
				enterHandlers.length = 0;
				setupListeners();
			}, 100);
		};
		window.addEventListener("resize", onResize);

		return () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("scroll", onScroll);
			window.removeEventListener("resize", onResize);
			for (const u of enterHandlers) u();
			window.clearTimeout(resizeTimer);
		};
	}, [items]);

	return (
		<section className="expeditions">
			<p>Observation Registry</p>
			<div className="expeditions-list" ref={listRef}>
				{items.map((item, idx) => {
					const href = item.externalUrl;
					const isExternal = Boolean(item.externalUrl);
					const projectName = item.project.replace(/\s*·\s*\d{4}\s*$/, "");
					const inner = (
						<div className="expedition-wrapper">
							<div className="expedition-name">
								<h2>{item.title}</h2>
								<h2>{item.industry ?? ""}</h2>
							</div>
							<div className="expedition-project">
								<h2>{projectName}</h2>
								<h2>{item.ctaLabel}</h2>
							</div>
							<div className="expedition-name">
								<h2>{item.title}</h2>
								<h2>{item.industry ?? ""}</h2>
							</div>
						</div>
					);
					return (
						<div className="expedition" key={`${item.title}-${idx}`}>
							{href ? (
								<a
									href={href}
									className="expedition-link"
									target={isExternal ? "_blank" : undefined}
									rel={isExternal ? "noopener noreferrer" : undefined}
								>
									{inner}
								</a>
							) : (
								inner
							)}
						</div>
					);
				})}
			</div>
		</section>
	);
}
