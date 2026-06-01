"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RotatingButton } from "@/components/brand";
import { fragmentShader, vertexShader } from "./shaders";
import { useGentleRain } from "./useGentleRain";

const CONFIG = {
	spread: 0.5,
	speed: 2,
};

function hexToRgb(hex: string) {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: parseInt(result[1], 16) / 255,
				g: parseInt(result[2], 16) / 255,
				b: parseInt(result[3], 16) / 255,
			}
		: { r: 0.89, g: 0.89, b: 0.89 };
}

function getCSSVariableColor(varName: string): string {
	const style = getComputedStyle(document.documentElement);
	return style.getPropertyValue(varName).trim();
}

export function Hero() {
	const heroRef = useRef<HTMLElement>(null);
	const rainViewportRef = useRef<HTMLDivElement>(null);
	const rainCanvasRef = useRef<HTMLCanvasElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const animeTextRef = useRef<HTMLDivElement>(null);
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	useGentleRain({
		canvasRef: rainCanvasRef,
		containerRef: rainViewportRef,
		imageSrc: "/hero-img.jpg",
		enabled: isMounted,
	});

	useEffect(() => {
		if (typeof window === "undefined" || !isMounted) return;

		gsap.registerPlugin(ScrollTrigger);

		const hero = heroRef.current;
		const canvas = canvasRef.current;
		if (!hero || !canvas) return;

		const scene = new THREE.Scene();
		const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
		const renderer = new THREE.WebGLRenderer({
			canvas,
			alpha: true,
			antialias: false,
		});

		const resize = () => {
			const width = hero.offsetWidth;
			const height = hero.offsetHeight;
			renderer.setSize(width, height);
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			if (material) {
				material.uniforms.uResolution.value.set(width, height);
			}
		};

		const getShaderColor = () => {
			const colorHex = getCSSVariableColor("--color-base-300");
			return hexToRgb(colorHex);
		};

		const rgb = getShaderColor();
		const geometry = new THREE.PlaneGeometry(2, 2);
		const material = new THREE.ShaderMaterial({
			vertexShader,
			fragmentShader,
			uniforms: {
				uProgress: { value: 0 },
				uResolution: {
					value: new THREE.Vector2(hero.offsetWidth, hero.offsetHeight),
				},
				uColor: { value: new THREE.Vector3(rgb.r, rgb.g, rgb.b) },
				uSpread: { value: CONFIG.spread },
			},
			transparent: true,
		});

		// Watch for theme changes and update shader color
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (
					mutation.type === "attributes" &&
					mutation.attributeName === "data-theme"
				) {
					const newRgb = getShaderColor();
					material.uniforms.uColor.value.set(newRgb.r, newRgb.g, newRgb.b);
				}
			}
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme"],
		});

		const mesh = new THREE.Mesh(geometry, material);
		scene.add(mesh);

		resize();
		window.addEventListener("resize", resize);

		let scrollProgress = 0;
		let animationId: number;

		const animate = () => {
			material.uniforms.uProgress.value = scrollProgress;
			renderer.render(scene, camera);
			animationId = requestAnimationFrame(animate);
		};

		animate();

		const handleScroll = () => {
			const heroHeight = hero.offsetHeight;
			const windowHeight = window.innerHeight;
			const maxScroll = heroHeight - windowHeight;
			const scroll = window.scrollY;
			scrollProgress = Math.min((scroll / maxScroll) * CONFIG.speed, 1.1);
		};

		window.addEventListener("scroll", handleScroll, { passive: true });

		// Anime text reveal animation
		const animeContainer = animeTextRef.current;
		if (animeContainer) {
			ScrollTrigger.create({
				trigger: ".hero-content",
				start: "top 25%",
				end: "bottom 100%",
				onUpdate: (self) => {
					const progress = self.progress;
					const words = Array.from(
						animeContainer.querySelectorAll(".word")
					) as HTMLElement[];
					const totalWords = words.length;

					words.forEach((word, index) => {
						const wordText = word.querySelector("span") as HTMLElement;
						if (!wordText) return;

						const isKeyword = wordText.classList.contains("keyword");

						const overlapWords = 15;
						const wordStart = index / totalWords;
						const wordEnd = wordStart + overlapWords / totalWords;
						const timelineScale =
							1 /
							Math.min(
								1 + overlapWords / totalWords,
								1 + (totalWords - 1) / totalWords + overlapWords / totalWords
							);

						const adjustedStart = wordStart * timelineScale;
						const adjustedEnd = wordEnd * timelineScale;
						const duration = adjustedEnd - adjustedStart;

						const wordProgress =
							progress <= adjustedStart
								? 0
								: progress >= adjustedEnd
									? 1
									: (progress - adjustedStart) / duration;

						word.style.opacity = String(wordProgress);

						const backgroundFadeStart =
							wordProgress >= 0.9 ? (wordProgress - 0.9) / 0.1 : 0;
						const backgroundOpacity = Math.max(0, 1 - backgroundFadeStart);
						word.style.backgroundColor =
							backgroundOpacity > 0
								? `rgba(var(--word-highlight-rgb), ${backgroundOpacity * 0.3})`
								: "transparent";

						// Text becomes visible as word is revealed
						// Once word is fully revealed, text is fully visible
						if (wordProgress >= 1) {
							wordText.style.opacity = "1";
						} else if (wordProgress >= 0.5) {
							// Fade in text from 0.5 to 1 as wordProgress goes from 0.5 to 1
							const textOpacity = (wordProgress - 0.5) * 2;
							wordText.style.opacity = String(textOpacity);
						} else {
							wordText.style.opacity = "0";
						}
					});
				},
			});
		}

		return () => {
			window.removeEventListener("resize", resize);
			window.removeEventListener("scroll", handleScroll);
			cancelAnimationFrame(animationId);
			observer.disconnect();
			geometry.dispose();
			material.dispose();
			renderer.dispose();
			ScrollTrigger.getAll().forEach((t) => t.kill());
		};
	}, [isMounted]);

	const animeTextParagraphs = [
		"Welkom in de hoek van het internet waar digitale ervaringen worden gebouwd, niet alleen voor de scroll, maar voor het verhaal. Dit is niet zomaar een site. Het is een werkend archief van experimenten, inzichten, en stille successen.",
		"Wij zijn Brandocean. Wij ontwerpen met ritme, bouwen met zorg, en geloven dat elk detail een reden verdient om te bestaan. Van eerste schets tot finale lancering, alles hier is gemaakt met intentie en misschien een beetje koffie. Deze ruimte is gebouwd voor beweging, betekenis, en experimenteren tot het klikt.",
	];
	const keywords = [
		"hoek",
		"scroll",
		"archief",
		"inzichten",
		"ritme",
		"detail",
		"lancering",
		"koffie",
		"experimenteren",
	];

	return (
		<>
			<section
				ref={heroRef}
				style={{
					position: "relative",
					width: "100%",
					height: "225svh",
					minHeight: "100vh",
					overflow: "hidden",
				}}
			>
				<div
					ref={rainViewportRef}
					style={{
						position: "absolute",
						top: 0,
						width: "100%",
						height: "100svh",
						minHeight: "100vh",
						overflow: "hidden",
					}}
				>
					<canvas
						ref={rainCanvasRef}
						aria-hidden
						style={{
							position: "absolute",
							inset: 0,
							width: "100%",
							height: "100%",
							display: "block",
						}}
					/>
					<div
						style={{
							position: "relative",
							zIndex: 1,
							width: "100%",
							height: "100%",
							display: "flex",
							flexDirection: "column",
							justifyContent: "center",
							alignItems: "center",
							gap: "0.5rem",
							textAlign: "center",
							color: "var(--color-accent)",
							pointerEvents: "none",
						}}
					>
					<h1
						className="max-w-4xl"
						style={{
							fontFamily: '"Barlow Condensed", sans-serif',
							fontWeight: 900,
							fontSize: "clamp(4rem, 10vw, 12rem)",
							lineHeight: 0.85,
							textTransform: "uppercase",
							letterSpacing: "-0.02em",
							textWrap: "balance",
						}}
					>
						Digitaal Vakmanschap
					</h1>
					<p
						style={{
							fontFamily: '"Host Grotesk", sans-serif',
							fontSize: "1.125rem",
							fontWeight: 400,
							width: "75%",
							color: "var(--color-accent)",
						}}
					>
						Apps • E-commerce • AI • Marketing
					</p>
					<div style={{ marginTop: "1.5rem", pointerEvents: "auto" }}>
						<RotatingButton href="/studio" variant="light">
							Read the theory
						</RotatingButton>
					</div>
					</div>
				</div>

				<canvas
					ref={canvasRef}
					style={{
						position: "absolute",
						bottom: 0,
						width: "100%",
						height: "100%",
						pointerEvents: "none",
					}}
				/>

				<div
					className="hero-content"
					style={{
						position: "absolute",
						bottom: 0,
						width: "100%",
						height: "125svh",
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						textAlign: "center",
						backgroundColor: "var(--color-base-300)",
					}}
				>
					<div
						ref={animeTextRef}
						className="anime-text"
						style={{ width: "60%" }}
					>
						{animeTextParagraphs.map((paragraph, pIndex) => (
							<p
								key={pIndex}
								style={{
									color: "var(--color-base-100)",
									textAlign: "center",
									marginBottom: "2rem",
									fontSize: "2rem",
									fontWeight: 900,
									lineHeight: 1,
								}}
							>
								{paragraph.split(/\s+/).map((word, wIndex) => {
									const normalizedWord = word
										.toLowerCase()
										.replace(/[.,!?;:"]/g, "");
									const isKeyword = keywords.includes(normalizedWord);

									return (
										<span
											key={`${pIndex}-${wIndex}`}
											className={`word ${isKeyword ? "keyword-wrapper" : ""}`}
											style={{
												display: "inline-block",
												position: "relative",
												marginRight: "0.2rem",
												marginBottom: "0.2rem",
												padding: "0.1rem 0.2rem",
												borderRadius: "8px",
												opacity: 0,
											}}
										>
											<span
												style={{ opacity: 0, position: "relative" }}
												className={
													isKeyword ? `keyword ${normalizedWord}` : ""
												}
											>
												{word}
											</span>
										</span>
									);
								})}
							</p>
						))}
					</div>
				</div>
			</section>
		</>
	);
}
