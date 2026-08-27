import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useLenis } from "lenis/react";
import { useEffect, useRef, useState } from "react";
import styles from "./Preloader.module.css";

// GSAP's ticker schiet een requestAnimationFrame in zodra een plugin zich
// registreert, en workerd verbiedt timers op module-scope — dat liet de
// SSR-boundary knappen. Registreren hoeft alleen in de browser.
if (typeof window !== "undefined") {
	gsap.registerPlugin(useGSAP, SplitText, CustomEase, ScrollTrigger);

	// Moet binnen dezelfde guard: CustomEase werkt pas nadat het als plugin
	// geregistreerd is, en op de server gebeurt dat niet.
	if (!CustomEase.get("hop")) {
		CustomEase.create("hop", "0.8, 0, 0.2, 1");
	}
	if (!CustomEase.get("hop2")) {
		CustomEase.create("hop2", "0.9, 0, 0.1, 1");
	}
}

export let isInitialLoad = true;

const IMAGES = [
	"/images/preloader/preloader_img_1.jpg",
	"/images/preloader/preloader_img_2.jpg",
	"/images/preloader/preloader_img_3.jpg",
	"/images/preloader/preloader_img_4.jpg",
	"/images/preloader/preloader_img_5.jpg",
	"/images/preloader/preloader_img_6.jpg",
];

const IMG_INIT_ROTATIONS = [7.5, -2.5, -10, 12.5, -5, 5];

const EXIT_COLORS = [
	"var(--base-900)",
	"var(--base-800)",
	"var(--base-500)",
	"var(--base-400)",
];

const DARK_OVERLAY = "var(--base-1000)";

function shuffle(items: string[]) {
	const next = [...items];
	for (let i = next.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[next[i], next[j]] = [next[j], next[i]];
	}
	return next;
}

export default function Preloader() {
	const preloaderRef = useRef<HTMLDivElement>(null);
	const titleRef = useRef<HTMLHeadingElement>(null);
	const counterRef = useRef<HTMLParagraphElement>(null);
	const colorOverlaysRef = useRef<(HTMLDivElement | null)[]>([]);
	const darkOverlayRef = useRef<HTMLDivElement>(null);
	const [showPreloader, setShowPreloader] = useState(isInitialLoad);
	const [loaderAnimating, setLoaderAnimating] = useState(false);
	const lenis = useLenis();

	useEffect(() => {
		return () => {
			isInitialLoad = false;
		};
	}, []);

	useEffect(() => {
		if (!lenis) return;
		if (loaderAnimating) lenis.stop();
		else lenis.start();
	}, [lenis, loaderAnimating]);

	useGSAP(
		() => {
			if (!showPreloader) return;

			const root = preloaderRef.current;
			const title = titleRef.current;
			const counterEl = counterRef.current;
			if (!root || !title || !counterEl) return;

			setLoaderAnimating(true);

			let cancelled = false;
			let split: SplitText | null = null;
			let tl: gsap.core.Timeline | null = null;

			const run = async () => {
				try {
					await document.fonts.ready;
					await new Promise((r) => setTimeout(r, 100));
				} catch {
					await new Promise((r) => setTimeout(r, 200));
				}

				if (cancelled || !preloaderRef.current) return;

				const imgs = gsap.utils.toArray<HTMLElement>(
					root.querySelectorAll(`.${styles.img}`),
				);
				const colorOverlays = colorOverlaysRef.current.filter(
					(el): el is HTMLDivElement => Boolean(el),
				);
				const darkOverlay = darkOverlayRef.current;
				// bottom → top: colors under, dark always on top
				const overlays = darkOverlay
					? [...colorOverlays, darkOverlay]
					: colorOverlays;

				gsap.set(imgs, {
					xPercent: -50,
					yPercent: -50,
					scale: 0,
					opacity: 1,
					rotate: (i: number) => IMG_INIT_ROTATIONS[i],
				});

				gsap.set(overlays, {
					clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
				});

				split = SplitText.create(title, {
					type: "chars",
					charsClass: styles.char,
					mask: "chars",
				});

				gsap.set(split.chars, { yPercent: 100 });
				gsap.set(counterEl, { yPercent: 125, opacity: 1 });
				gsap.set(title, { opacity: 1 });

				const counter = { value: 0 };

				tl = gsap.timeline({
					delay: 1,
					onComplete: () => {
						setTimeout(() => {
							setLoaderAnimating(false);
							setShowPreloader(false);
							ScrollTrigger.refresh(true);
						}, 100);
					},
				});

				tl.to(imgs, {
					scale: 1,
					clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
					duration: 1,
					ease: "hop",
					stagger: 0.2,
				});

				tl.to(
					split.chars,
					{
						yPercent: 0,
						duration: 1,
						ease: "hop2",
						stagger: { each: 0.125, from: "random" },
					},
					0.35,
				);

				tl.to(
					counterEl,
					{
						yPercent: 0,
						duration: 1,
						ease: "hop2",
						onStart: () => {
							gsap.to(counter, {
								value: 100,
								duration: 2,
								delay: 0.5,
								ease: "power2.inOut",
								onUpdate: () => {
									if (!counterRef.current) return;
									counterRef.current.textContent = String(
										Math.round(counter.value),
									).padStart(3, "0");
								},
							});
						},
					},
					"<",
				);

				tl.to(
					counterEl,
					{
						yPercent: -100,
						duration: 0.75,
						ease: "hop2",
					},
					3.25,
				);

				tl.to(
					split.chars,
					{
						yPercent: -100,
						duration: 0.75,
						ease: "hop2",
						stagger: { each: 0.1, from: "random" },
					},
					3.25,
				);

				tl.to(
					imgs,
					{
						scale: 0,
						clipPath: "polygon(20% 20%, 80% 20%, 80% 80%, 20% 80%)",
						duration: 1,
						ease: "hop2",
						stagger: -0.075,
					},
					3.5,
				);

				// Cover with color layers under a fixed dark top layer, then peel upward
				// (dark first via negative stagger, then colors underneath)
				tl.call(
					() => {
						const colors = shuffle([...EXIT_COLORS]);
						colorOverlays.forEach((el, i) => {
							el.style.backgroundColor = colors[i];
						});
					},
					undefined,
					4.7,
				);

				tl.set(
					overlays,
					{
						clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
					},
					4.7,
				);

				tl.set(
					root,
					{
						backgroundColor: "transparent",
						pointerEvents: "none",
					},
					4.7,
				);

				tl.to(
					overlays,
					{
						clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
						duration: 1,
						ease: "hop2",
						stagger: -0.1,
					},
					4.75,
				);
			};

			run();

			return () => {
				cancelled = true;
				tl?.kill();
				split?.revert();
			};
		},
		{ scope: preloaderRef, dependencies: [showPreloader] },
	);

	if (!showPreloader) return null;

	return (
		<div className={styles.preloader} ref={preloaderRef}>
			<div className={styles.images}>
				{IMAGES.map((src) => (
					<div key={src} className={styles.img}>
						<img src={src} alt="" />
					</div>
				))}
			</div>

			<div className={styles.header}>
				<h1 ref={titleRef}>Brandocean</h1>
				<div className={styles.counter}>
					<p ref={counterRef}>000</p>
				</div>
			</div>

			<div className={styles.exitOverlays} aria-hidden="true">
				{EXIT_COLORS.map((color, i) => (
					<div
						key={color}
						className={styles.exitOverlay}
						ref={(el) => {
							colorOverlaysRef.current[i] = el;
						}}
						style={{ backgroundColor: color, zIndex: i + 1 }}
					/>
				))}
				<div
					className={`${styles.exitOverlay} ${styles.exitOverlayDark}`}
					ref={darkOverlayRef}
					style={{ backgroundColor: DARK_OVERLAY }}
				/>
			</div>
		</div>
	);
}
