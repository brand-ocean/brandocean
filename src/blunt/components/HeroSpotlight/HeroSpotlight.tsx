import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { useEffect, useRef, useState } from "react";
import Copy from "../Copy/Copy";
import { isInitialLoad } from "../Preloader/Preloader";
import styles from "./HeroSpotlight.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const DESKTOP_MIN = 1000;
const REEL_INTERVAL = 900;
const SCALE_START = 0.25;
const SCALE_END = 1;
const RADIUS_START = 1.2;
const RADIUS_END = 0.4;

const REEL_IMAGES = Array.from(
	{ length: 10 },
	(_, i) => `/images/showreel/showreel_img_${i + 1}.jpg`,
);

const BREAKPOINTS = [
	{ maxWidth: 1100, translateY: -135, movMultiplier: 450 },
	{ maxWidth: 1200, translateY: -130, movMultiplier: 500 },
	{ maxWidth: 1300, translateY: -125, movMultiplier: 550 },
	{ maxWidth: 1400, translateY: -120, movMultiplier: 600 },
];

function getInitialValues() {
	const width = window.innerWidth;

	for (const bp of BREAKPOINTS) {
		if (width <= bp.maxWidth) {
			return {
				translateY: bp.translateY,
				movementMultiplier: bp.movMultiplier,
			};
		}
	}

	return {
		translateY: -110,
		movementMultiplier: 650,
	};
}

function isDesktop() {
	return window.innerWidth >= DESKTOP_MIN;
}

function ShowreelFrame() {
	const [index, setIndex] = useState(0);

	useEffect(() => {
		const id = setInterval(() => {
			setIndex((current) => (current + 1) % REEL_IMAGES.length);
		}, REEL_INTERVAL);
		return () => clearInterval(id);
	}, []);

	return (
		<div className={styles.videoPreview}>
			{REEL_IMAGES.map((src, i) => (
				<img
					key={src}
					src={src}
					alt=""
					className={`${styles.reelImage} ${i === index ? styles.reelImageActive : ""}`}
				/>
			))}
		</div>
	);
}

interface HeroState {
	scrollProgress: number;
	initialTranslateY: number;
	currentTranslateY: number;
	movementMultiplier: number;
	scale: number;
	borderRadius: number;
	targetMouseX: number;
	currentMouseX: number;
}

export default function HeroSpotlight() {
	const introRef = useRef<HTMLElement>(null);
	const desktopRef = useRef<HTMLDivElement>(null);
	const mobileRef = useRef<HTMLDivElement>(null);
	const stateRef = useRef<HeroState | null>(null);
	const rafRef = useRef(0);

	useLenis(() => {
		ScrollTrigger.update();
	});

	useGSAP(
		() => {
			const videoContainer = desktopRef.current;
			const mobileContainer = mobileRef.current;
			const intro = introRef.current;
			if (!intro) return;

			const mm = gsap.matchMedia();
			const introDelay = isInitialLoad ? 6.5 : 1.15;

			mm.add(`(min-width: ${DESKTOP_MIN}px)`, () => {
				if (!videoContainer) return;

				const initial = getInitialValues();
				const state: HeroState = {
					scrollProgress: 0,
					initialTranslateY: initial.translateY,
					currentTranslateY: initial.translateY,
					movementMultiplier: initial.movementMultiplier,
					scale: SCALE_START,
					borderRadius: RADIUS_START,
					targetMouseX: 0,
					currentMouseX: 0,
				};
				stateRef.current = state;

				const applyProgress = (progress: number) => {
					const p = gsap.utils.clamp(0, 1, progress);
					state.scrollProgress = p;
					state.currentTranslateY = gsap.utils.interpolate(
						state.initialTranslateY,
						0,
						p,
					);
					state.scale = gsap.utils.interpolate(SCALE_START, SCALE_END, p);
					state.borderRadius = gsap.utils.interpolate(
						RADIUS_START,
						RADIUS_END,
						p,
					);
				};

				const syncBreakpointValues = () => {
					const next = getInitialValues();
					state.initialTranslateY = next.translateY;
					state.movementMultiplier = next.movementMultiplier;
					applyProgress(state.scrollProgress);
				};

				const handleMouseMove = (e: MouseEvent) => {
					state.targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
				};

				const handleResize = () => {
					syncBreakpointValues();
				};

				window.addEventListener("resize", handleResize);
				document.addEventListener("mousemove", handleMouseMove);

				const st = ScrollTrigger.create({
					trigger: intro,
					start: "top bottom",
					end: "top 10%",
					scrub: true,
					invalidateOnRefresh: true,
					onUpdate: (self) => applyProgress(self.progress),
					onRefresh: (self) => {
						syncBreakpointValues();
						applyProgress(self.progress);
					},
				});

				applyProgress(st.progress);

				// Clip-path reveal keeps images at native resolution (scale-from-0
				// rasterizes the layer tiny and looks pixelated until it finishes).
				gsap.set(videoContainer, { clipPath: "inset(50%)" });
				const introTween = gsap.to(videoContainer, {
					clipPath: "inset(0%)",
					duration: 1.15,
					delay: introDelay,
					ease: "power3.out",
				});

				const tick = () => {
					if (!stateRef.current || !isDesktop()) {
						rafRef.current = requestAnimationFrame(tick);
						return;
					}

					const {
						scale: rawScale,
						targetMouseX,
						currentMouseX,
						currentTranslateY,
						borderRadius,
						movementMultiplier,
					} = state;

					const scale = gsap.utils.clamp(SCALE_START, SCALE_END, rawScale);
					state.scale = scale;

					const width = videoContainer.offsetWidth;
					const maxShift = (width * (1 - scale)) / 2;
					const mouseStrength = (1 - scale) / (1 - SCALE_START);

					let targetX =
						mouseStrength > 0.001
							? targetMouseX * (1 - scale) * movementMultiplier
							: 0;
					targetX = gsap.utils.clamp(-maxShift, maxShift, targetX);

					state.currentMouseX = gsap.utils.clamp(
						-maxShift,
						maxShift,
						gsap.utils.interpolate(currentMouseX, targetX, 0.05),
					);

					videoContainer.style.transform = `translateY(${currentTranslateY}%) translateX(${state.currentMouseX}px) scale(${scale})`;
					videoContainer.style.setProperty(
						"--reel-radius",
						`${borderRadius}rem`,
					);

					rafRef.current = requestAnimationFrame(tick);
				};

				rafRef.current = requestAnimationFrame(tick);

				return () => {
					window.removeEventListener("resize", handleResize);
					document.removeEventListener("mousemove", handleMouseMove);
					cancelAnimationFrame(rafRef.current);
					introTween.kill();
					st.kill();
					stateRef.current = null;
					videoContainer.style.transform = "";
					videoContainer.style.clipPath = "";
					videoContainer.style.removeProperty("--reel-radius");
				};
			});

			mm.add(`(max-width: ${DESKTOP_MIN - 1}px)`, () => {
				if (!mobileContainer) return;

				gsap.set(mobileContainer, { clipPath: "inset(50%)" });

				const introTween = gsap.to(mobileContainer, {
					clipPath: "inset(0%)",
					duration: 1.15,
					delay: introDelay,
					ease: "power3.out",
				});

				return () => {
					introTween.kill();
					gsap.set(mobileContainer, { clearProps: "clipPath" });
				};
			});

			return () => mm.revert();
		},
		{ scope: introRef },
	);

	useEffect(() => {
		const onResize = () => ScrollTrigger.refresh();
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	return (
		<>
			<section className={styles.hero}>
				<div className={`container pad ${styles.heroInner}`}>
					<div className={styles.heroTop}>
						<Copy animateOnScroll={false} delay={isInitialLoad ? 6.4 : 1.125}>
							<h1>Drawn</h1>
						</Copy>
					</div>
					<div className={styles.heroBottom}>
						<Copy animateOnScroll={false} delay={isInitialLoad ? 6.8 : 1.3}>
							<p>
								A digital art and illustration studio that draws loud, thinks
								weird, and never plays it safe.
							</p>
						</Copy>
						<Copy animateOnScroll={false} delay={isInitialLoad ? 6.6 : 1.2}>
							<h1>Weird</h1>
						</Copy>
					</div>
				</div>
			</section>

			<section className={styles.intro} ref={introRef}>
				<div className={`container pad-media ${styles.introInner}`}>
					<div className={styles.introClip}>
						<div className={styles.videoDesktop} ref={desktopRef}>
							<ShowreelFrame />
						</div>

						<div className={styles.videoMobile} ref={mobileRef}>
							<ShowreelFrame />
						</div>
					</div>
				</div>
			</section>
		</>
	);
}
