import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useId, useRef } from "react";
import Callout from "../Callout/Callout";
import Copy from "../Copy/Copy";
import styles from "./SmudgeRevealer.module.css";

gsap.registerPlugin(useGSAP);

const CONFIG = {
	smoothing: 0.1,
	movementThreshold: 0.01,
	sizeFromSpeed: 0.2,
	expandMultiplier: 2,
	expandTime: 2,
	expandEase: "power1.inOut",
	dissolveStart: 1,
	dissolveTime: 3,
	dissolveEase: "power3.in",
};

interface SmudgeRevealerProps {
	lineOne?: string;
	lineTwo?: string;
	copy?: string;
}

export default function SmudgeRevealer({
	lineOne = "Smudge",
	lineTwo = "To Know",
	copy = "The things worth finding are never on the surface. They live in the parts you almost scrolled past.",
}: SmudgeRevealerProps) {
	const rawId = useId().replace(/:/g, "");
	const gooId = `smudge-goo-${rawId}`;
	const maskId = `smudge-mask-${rawId}`;

	const sectionRef = useRef<HTMLElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const blobsRef = useRef<SVGGElement>(null);

	useGSAP(
		() => {
			const section = sectionRef.current;
			const svg = svgRef.current;
			const blobs = blobsRef.current;
			if (!section || !svg || !blobs) return;

			const pointer = { x: 0, y: 0 };
			const smoothPointer = { x: 0, y: 0 };
			let hasStarted = false;
			let rafId = 0;
			const timelines = new Set<gsap.core.Timeline>();

			const matchSvgSize = () => {
				const { width, height } = section.getBoundingClientRect();
				svg.style.width = `${width}px`;
				svg.style.height = `${height}px`;
				svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
			};

			const getLocalPoint = (clientX: number, clientY: number) => {
				const rect = section.getBoundingClientRect();
				return {
					x: clientX - rect.left,
					y: clientY - rect.top,
				};
			};

			const onPointerMove = (x: number, y: number) => {
				if (!hasStarted) {
					pointer.x = x;
					smoothPointer.x = x;
					pointer.y = y;
					smoothPointer.y = y;
					hasStarted = true;
					return;
				}

				pointer.x = x;
				pointer.y = y;
			};

			const onMouseMove = (e: MouseEvent) => {
				const point = getLocalPoint(e.clientX, e.clientY);
				onPointerMove(point.x, point.y);
			};

			const onTouchMove = (e: TouchEvent) => {
				e.preventDefault();
				const touch = e.touches[0];
				if (!touch) return;
				const point = getLocalPoint(touch.clientX, touch.clientY);
				onPointerMove(point.x, point.y);
			};

			const stampSmudgeAt = (x: number, y: number, radius: number) => {
				const circle = document.createElementNS(
					"http://www.w3.org/2000/svg",
					"circle",
				);

				circle.setAttribute("cx", String(x));
				circle.setAttribute("cy", String(y));
				circle.setAttribute("r", String(radius));
				circle.setAttribute("fill", "#fff");
				blobs.prepend(circle);

				const animatedRadius = { current: radius };

				const timeline = gsap.timeline({
					onUpdate() {
						circle.setAttribute(
							"r",
							String(Math.max(0, animatedRadius.current)),
						);
					},
					onComplete() {
						timelines.delete(timeline);
						timeline.kill();
						circle.remove();
					},
				});

				timelines.add(timeline);

				timeline.to(animatedRadius, {
					current: radius * CONFIG.expandMultiplier,
					duration: CONFIG.expandTime,
					ease: CONFIG.expandEase,
				});

				timeline.to(
					animatedRadius,
					{
						current: 0,
						duration: CONFIG.dissolveTime,
						ease: CONFIG.dissolveEase,
					},
					CONFIG.dissolveStart,
				);
			};

			const update = () => {
				if (hasStarted) {
					smoothPointer.x += (pointer.x - smoothPointer.x) * CONFIG.smoothing;
					smoothPointer.y += (pointer.y - smoothPointer.y) * CONFIG.smoothing;

					const speed = Math.hypot(
						pointer.x - smoothPointer.x,
						pointer.y - smoothPointer.y,
					);

					if (speed > CONFIG.movementThreshold) {
						stampSmudgeAt(
							smoothPointer.x,
							smoothPointer.y,
							speed * CONFIG.sizeFromSpeed,
						);
					}
				}

				rafId = requestAnimationFrame(update);
			};

			matchSvgSize();
			section.addEventListener("mousemove", onMouseMove);
			section.addEventListener("touchstart", onTouchMove, { passive: false });
			section.addEventListener("touchmove", onTouchMove, { passive: false });
			window.addEventListener("resize", matchSvgSize);
			rafId = requestAnimationFrame(update);

			return () => {
				cancelAnimationFrame(rafId);
				section.removeEventListener("mousemove", onMouseMove);
				section.removeEventListener("touchstart", onTouchMove);
				section.removeEventListener("touchmove", onTouchMove);
				window.removeEventListener("resize", matchSvgSize);
				timelines.forEach((timeline) => timeline.kill());
				timelines.clear();
				blobs.replaceChildren();
			};
		},
		{ scope: sectionRef },
	);

	return (
		<section className={styles.hero} ref={sectionRef}>
			<div className={styles.foreground}>
				<div
					className={`container pad ${styles.inner} ${styles.foregroundInner}`}
				>
					<div className={styles.line}>
						<Copy animateOnScroll={false} delay={1.125}>
							<h1>{lineOne}</h1>
						</Copy>
					</div>
					<div className={styles.line}>
						<Copy animateOnScroll={false} delay={1.2}>
							<h1>
								{lineTwo}
								<Callout
									className={styles.callout}
									label="Vegen maar"
									variant={2}
									rotation={20}
									top="0.15em"
									right="0.4em"
								/>
							</h1>
						</Copy>
					</div>
				</div>
			</div>

			<div className={styles.footer}>
				<div className={`container ${styles.footerInner}`}>
					<Copy variant="scramble" animateOnScroll={false} delay={1.25}>
						<p className="mono sm">Blijf vegen</p>
					</Copy>
				</div>
			</div>

			<div
				className={styles.background}
				style={{
					mask: `url(#${maskId})`,
					WebkitMask: `url(#${maskId})`,
				}}
			>
				<div className={`container pad ${styles.inner}`}>
					<h3>{copy}</h3>
				</div>
			</div>

			<svg
				ref={svgRef}
				xmlns="http://www.w3.org/2000/svg"
				preserveAspectRatio="none"
				className={styles.smudgeRevealer}
				aria-hidden="true"
			>
				<defs>
					<filter id={gooId}>
						<feGaussianBlur in="SourceGraphic" stdDeviation="25" />
						<feColorMatrix
							type="matrix"
							values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 60 -14"
						/>
					</filter>
				</defs>
				<mask id={maskId}>
					<g ref={blobsRef} filter={`url(#${gooId})`} />
				</mask>
			</svg>
		</section>
	);
}
