import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { useEffect, useRef } from "react";
import Callout from "../Callout/Callout";
import SectionFooter from "../SectionFooter/SectionFooter";
import SectionNav from "../SectionNav/SectionNav";
import styles from "./About.module.css";

// GSAP's ticker schiet een requestAnimationFrame in zodra een plugin zich
// registreert, en workerd verbiedt timers op module-scope — dat liet de
// SSR-boundary knappen. Registreren hoeft alleen in de browser.
if (typeof window !== "undefined") {
	gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const DESKTOP_MIN = 1000;

const SPOTS = [
	{ src: "/images/about/about_spot_1.jpg", alt: "" },
	{ src: "/images/about/about_spot_2.jpg", alt: "" },
	{ src: "/images/about/about_spot_3.jpg", alt: "" },
];

const COLLAPSED = {
	width: "0.45em",
	height: "0.45em",
	borderRadius: "0.04em",
};

const EXPANDED = {
	width: "16rem",
	height: "12rem",
	borderRadius: "0.4rem",
};

const FOLLOW_MAX = 28;
const FOLLOW_LERP = 0.1;

function isDesktop() {
	return window.innerWidth >= DESKTOP_MIN;
}

function Spot({ src, alt }: { src: string; alt: string }) {
	const ref = useRef<HTMLSpanElement>(null);
	const panelRef = useRef<HTMLSpanElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	const sizeTweenRef = useRef<gsap.core.Tween | null>(null);
	const activeRef = useRef(false);
	const posRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
	const tickRef = useRef<gsap.TickerCallback | null>(null);

	const stopFollowTick = () => {
		if (tickRef.current) {
			gsap.ticker.remove(tickRef.current);
			tickRef.current = null;
		}
	};

	const startFollowTick = () => {
		stopFollowTick();
		const panel = panelRef.current;
		if (!panel) return;

		tickRef.current = () => {
			const pos = posRef.current;
			pos.x += (pos.tx - pos.x) * FOLLOW_LERP;
			pos.y += (pos.ty - pos.y) * FOLLOW_LERP;

			if (Math.abs(pos.tx - pos.x) < 0.01) pos.x = pos.tx;
			if (Math.abs(pos.ty - pos.y) < 0.01) pos.y = pos.ty;

			gsap.set(panel, { x: pos.x, y: pos.y });
		};

		gsap.ticker.add(tickRef.current);
	};

	const reset = () => {
		const panel = panelRef.current;
		const img = imgRef.current;
		if (!panel || !img) return;

		stopFollowTick();
		sizeTweenRef.current?.kill();
		gsap.killTweensOf([panel, img]);
		activeRef.current = false;
		posRef.current = { x: 0, y: 0, tx: 0, ty: 0 };
		if (ref.current) ref.current.dataset.active = "false";
		gsap.set(panel, {
			clearProps: "width,height,borderRadius",
			xPercent: -50,
			yPercent: -50,
			x: 0,
			y: 0,
		});
		gsap.set(img, { clearProps: "opacity" });
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: mount-only setup, mirrors the source component
	useEffect(() => {
		const panel = panelRef.current;
		if (!panel) return;

		gsap.set(panel, { xPercent: -50, yPercent: -50, x: 0, y: 0 });

		const onResize = () => {
			if (!isDesktop()) reset();
		};

		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("resize", onResize);
			stopFollowTick();
		};
	}, []);

	const follow = (e: React.MouseEvent) => {
		if (!activeRef.current || !isDesktop() || !ref.current) return;

		const rect = ref.current.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		let dx = e.clientX - cx;
		let dy = e.clientY - cy;
		const dist = Math.hypot(dx, dy);

		if (dist > FOLLOW_MAX) {
			const scale = FOLLOW_MAX / dist;
			dx *= scale;
			dy *= scale;
		}

		posRef.current.tx = dx;
		posRef.current.ty = dy;
	};

	const expand = () => {
		if (!isDesktop()) return;

		const panel = panelRef.current;
		const img = imgRef.current;
		if (!panel || !img || !ref.current) return;

		sizeTweenRef.current?.kill();
		activeRef.current = true;
		ref.current.dataset.active = "true";
		posRef.current = { x: 0, y: 0, tx: 0, ty: 0 };

		gsap.set(panel, { xPercent: -50, yPercent: -50, x: 0, y: 0 });
		startFollowTick();

		sizeTweenRef.current = gsap.to(panel, {
			width: EXPANDED.width,
			height: EXPANDED.height,
			borderRadius: EXPANDED.borderRadius,
			duration: 0.45,
			ease: "power3.out",
			overwrite: "auto",
			force3D: false,
		});

		gsap.to(img, {
			opacity: 1,
			duration: 0.25,
			ease: "power2.out",
			overwrite: "auto",
		});
	};

	const collapse = () => {
		if (!isDesktop()) return;

		const panel = panelRef.current;
		const img = imgRef.current;
		if (!panel || !img || !ref.current) return;

		sizeTweenRef.current?.kill();
		activeRef.current = false;
		posRef.current.tx = 0;
		posRef.current.ty = 0;
		stopFollowTick();

		sizeTweenRef.current = gsap.to(panel, {
			width: COLLAPSED.width,
			height: COLLAPSED.height,
			borderRadius: COLLAPSED.borderRadius,
			x: 0,
			y: 0,
			duration: 0.45,
			ease: "power3.out",
			overwrite: "auto",
			force3D: false,
			onComplete: () => {
				if (activeRef.current) return;
				posRef.current = { x: 0, y: 0, tx: 0, ty: 0 };
				if (ref.current) ref.current.dataset.active = "false";
				gsap.set(panel, {
					clearProps: "width,height,borderRadius",
					xPercent: -50,
					yPercent: -50,
					x: 0,
					y: 0,
				});
			},
		});

		gsap.to(img, {
			opacity: 0,
			duration: 0.2,
			ease: "power2.in",
			overwrite: "auto",
		});
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: decorative hover-reveal thumbnail
		<span
			ref={ref}
			className={styles.spot}
			data-active="false"
			onMouseEnter={expand}
			onMouseMove={follow}
			onMouseLeave={collapse}
		>
			<span ref={panelRef} className={styles.spotPanel}>
				<img ref={imgRef} src={src} alt={alt} draggable={false} />
			</span>
		</span>
	);
}

export default function About() {
	const headlineRef = useRef<HTMLDivElement>(null);

	useLenis(() => {
		ScrollTrigger.update();
	});

	useGSAP(
		() => {
			const wrap = headlineRef.current;
			if (!wrap) return;

			const callouts = wrap.querySelectorAll<HTMLElement>("[data-callout]");
			if (!callouts.length) return;

			callouts.forEach((callout) => {
				gsap.set(callout, {
					scale: 0,
					rotation: Number(callout.dataset.rotation) || 0,
					transformOrigin: "center center",
				});
			});

			const tween = gsap.to(callouts, {
				scale: 1,
				duration: 1,
				ease: "elastic.out(1, 0.45)",
				stagger: 0.1,
				delay: 0.35,
				paused: true,
			});

			const trigger = ScrollTrigger.create({
				trigger: wrap,
				start: "top 90%",
				once: true,
				onEnter: () => tween.play(),
				onRefresh: (self) => {
					if (self.progress > 0) tween.play();
				},
			});

			requestAnimationFrame(() => ScrollTrigger.refresh());

			return () => {
				tween.kill();
				trigger.kill();
			};
		},
		{ scope: headlineRef },
	);

	return (
		<section className={styles.about}>
			<SectionNav left="Studio No. 01" right="Amsterdam / Sinds 2005" />

			<div className={`container pad ${styles.inner}`}>
				<div className={styles.headlineWrap} ref={headlineRef}>
					<h2 className={styles.headline}>
						<span className={styles.line}>We build the</span>
						<span className={styles.line}>
							<span className={styles.word}>Whole</span>
							<Spot {...SPOTS[0]} />
							<span className={styles.word}>thing</span>
						</span>
						<span className={styles.line}>Not just</span>
						<span className={styles.line}>
							<span className={styles.word}>The</span>
							<Spot {...SPOTS[1]} />
							<span className={styles.word}>pretty</span>
						</span>
						<span className={styles.line}>Part of</span>
						<span className={styles.line}>
							<span className={styles.word}>Your</span>
							<Spot {...SPOTS[2]} />
							<span className={styles.word}>stack</span>
						</span>
					</h2>

					<Callout
						className={`${styles.callout} ${styles.calloutPoke}`}
						label="Klik maar"
						rotation={15}
						top="0.75em"
						right="-0.1em"
						variant={2}
					/>
					<Callout
						className={`${styles.callout} ${styles.calloutReally}`}
						label="Echt waar"
						variant={1}
						rotation={-15}
						top="calc(0.9em * 4 + 0.25em)"
						left="0.5em"
					/>
				</div>
			</div>

			<SectionFooter left="Altijd bereikbaar" right="Meer hieronder" />
		</section>
	);
}
