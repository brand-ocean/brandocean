import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import Matter from "matter-js";
import { useEffect, useRef, useState } from "react";
import { PRELOADER_KLAAR } from "../Preloader/Preloader";
import TransitionLink, { type SiteHref } from "../TransitionLink";
import styles from "./Footer.module.css";

// GSAP's ticker schiet een requestAnimationFrame in zodra een plugin zich
// registreert, en workerd verbiedt timers op module-scope — dat liet de
// SSR-boundary knappen. Registreren hoeft alleen in de browser.
if (typeof window !== "undefined") {
	gsap.registerPlugin(ScrollTrigger, useGSAP);
}

// De badges die in de footer naar beneden vallen. Gemengd met opzet: wat we
// bouwen, waarmee we het bouwen, en waar we het over hebben in 2026. Ze staan
// er om herkend te worden, niet om compleet te zijn — vandaar dat "Koffie"
// achteraan mag blijven staan.
const OBJECTS = [
	"Apps",
	"Webshops",
	"Dashboards",
	"Portals",
	"CRM",
	"AI",
	"Automatisering",
	"Integraties",
	"Branding",
	"Design",
	"UI/UX",
	"CRO",
	"Data",
	"Analytics",
	"Marketing",
	"SEO",
	"Shopify",
	"React",
	"Convex",
	"Animatie",
	"Websites",
	"Hosting",
	"Onderhoud",

	// Waar het in 2026 over gaat
	"AI-agents",
	"Voice AI",
	"RAG",
	"MCP",
	"Copilots",
	"Semantisch zoeken",
	"Realtime",
	"Edge",

	// Waarmee we bouwen
	"TanStack",
	"Astro",
	"TypeScript",
	"Tailwind",
	"Cloudflare",
	"Workers",
	"Three.js",
	"GSAP",

	// Wat we opleveren
	"Klantportalen",
	"Betalingen",
	"Abonnementen",
	"Facturatie",
	"Boekhouding",
	"Offertes",
	"E-mailflows",
	"Webhooks",
	"API's",
	"Migraties",
	"Meertalig",

	// Waar we op letten
	"Toegankelijkheid",
	"Performance",
	"Core Web Vitals",
	"Designsystemen",
	"Motion",
	"Security",
	"AVG",

	"Koffie",
];

const NAV: { title: string; links: { label: string; href: SiteHref }[] }[] = [
	{
		title: "Studio",
		links: [
			{ label: "Over ons", href: "/about" },
			{ label: "Werk", href: "/work" },
			{ label: "Expertise", href: "/expertise" },
		],
	},
	{
		title: "Bedrijf",
		links: [
			{ label: "Meedoen", href: "/careers" },
			{ label: "Contact", href: "/contact" },
		],
	},
];

const SOCIAL: { label: string; external: string }[] = [
	{ label: "Instagram", external: "https://instagram.com/brandocean" },
	{ label: "LinkedIn", external: "https://linkedin.com/company/brandocean" },
	{ label: "Kiesbeter", external: "https://kiesbeter.app" },
];

const PILL_VARIANTS = [styles.v1, styles.v2, styles.v3, styles.v4];

function shuffle(items: string[]) {
	const next = [...items];
	for (let i = next.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[next[i], next[j]] = [next[j], next[i]];
	}
	return next;
}

function evenlyDistributedVariants(count: number) {
	return Array.from(
		{ length: count },
		(_, i) => PILL_VARIANTS[i % PILL_VARIANTS.length],
	);
}

function distributeVariants(count: number) {
	return shuffle(evenlyDistributedVariants(count));
}

const CONFIG = {
	gravity: { x: 0, y: 1 },
	restitution: 0.5,
	friction: 0.15,
	frictionAir: 0.02,
	density: 0.002,
	wallThickness: 200,
	mouseStiffness: 0.6,
};

function clamp(val: number, min: number, max: number) {
	return Math.max(min, Math.min(max, val));
}

interface FooterProps {
	/**
	 * Coming-soon-variant: zonder de linkkolommen. Die wijzen naar pagina's die
	 * we nog niet aanprijzen, dus op de landing blijft alleen de merknaam,
	 * de pay-off en de contactregel over.
	 */
	minimal?: boolean;
	/** Opent het intakegesprek als overlay. Alleen zinvol met `minimal`. */
	onStart?: () => void;
}

export default function Footer({ minimal = false, onStart }: FooterProps) {
	const sectionRef = useRef<HTMLElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [pillVariants, setPillVariants] = useState(() =>
		evenlyDistributedVariants(OBJECTS.length),
	);

	useEffect(() => {
		setPillVariants(distributeVariants(OBJECTS.length));
	}, []);

	useLenis(() => {
		ScrollTrigger.update();
	});

	useGSAP(
		() => {
			const section = sectionRef.current;
			const container = containerRef.current;
			if (!section || !container) return;

			let engine: Matter.Engine | null = null;
			let runner: Matter.Runner | null = null;
			let topWall: Matter.Body | null = null;
			let topWallTimeout: ReturnType<typeof setTimeout> | undefined;
			let rafId = 0;
			const bodies: {
				body: Matter.Body;
				element: HTMLElement;
				width: number;
				height: number;
			}[] = [];
			const cleanupFns: (() => void)[] = [];

			const initPhysics = () => {
				if (engine) return;

				engine = Matter.Engine.create();
				engine.gravity.x = CONFIG.gravity.x;
				engine.gravity.y = CONFIG.gravity.y;
				engine.constraintIterations = 10;
				engine.positionIterations = 20;
				engine.velocityIterations = 16;
				engine.timing.timeScale = 1;

				const containerRect = container.getBoundingClientRect();
				const wallThickness = CONFIG.wallThickness;

				const walls = [
					Matter.Bodies.rectangle(
						containerRect.width / 2,
						containerRect.height + wallThickness / 2,
						containerRect.width + wallThickness * 2,
						wallThickness,
						{ isStatic: true },
					),
					Matter.Bodies.rectangle(
						-wallThickness / 2,
						containerRect.height / 2,
						wallThickness,
						containerRect.height + wallThickness * 2,
						{ isStatic: true },
					),
					Matter.Bodies.rectangle(
						containerRect.width + wallThickness / 2,
						containerRect.height / 2,
						wallThickness,
						containerRect.height + wallThickness * 2,
						{ isStatic: true },
					),
				];
				Matter.World.add(engine.world, walls);

				const objects = container.querySelectorAll<HTMLElement>(
					`.${styles.object}`,
				);
				objects.forEach((obj, index) => {
					const objRect = obj.getBoundingClientRect();
					const startX =
						Math.random() * (containerRect.width - objRect.width) +
						objRect.width / 2;
					const startY = -500 - index * 100;
					const startRotation = (Math.random() - 0.5) * Math.PI;

					const body = Matter.Bodies.rectangle(
						startX,
						startY,
						objRect.width,
						objRect.height,
						{
							restitution: CONFIG.restitution,
							friction: CONFIG.friction,
							frictionAir: CONFIG.frictionAir,
							density: CONFIG.density,
						},
					);

					Matter.Body.setAngle(body, startRotation);

					bodies.push({
						body,
						element: obj,
						width: objRect.width,
						height: objRect.height,
					});

					if (engine) Matter.World.add(engine.world, body);
				});

				topWallTimeout = setTimeout(() => {
					if (!engine) return;
					topWall = Matter.Bodies.rectangle(
						containerRect.width / 2,
						-wallThickness / 2,
						containerRect.width + wallThickness * 2,
						wallThickness,
						{ isStatic: true },
					);
					Matter.World.add(engine.world, topWall);
				}, 3000);

				const getBounds = (width: number, height: number) => ({
					minX: width / 2,
					maxX: containerRect.width - width / 2,
					maxY: containerRect.height - height / 2,
				});

				const pointer = { x: 0, y: 0, lastX: 0, lastY: 0 };
				const INTERACT_RADIUS = 140;

				const scatterFromPointer = (clientX: number, clientY: number) => {
					const rect = container.getBoundingClientRect();
					const x = clientX - rect.left;
					const y = clientY - rect.top;
					const moveX = x - pointer.lastX;
					const moveY = y - pointer.lastY;

					pointer.x = x;
					pointer.y = y;
					pointer.lastX = x;
					pointer.lastY = y;

					if (Math.hypot(moveX, moveY) < 0.5) return;

					bodies.forEach(({ body }) => {
						const dx = body.position.x - x;
						const dy = body.position.y - y;
						const dist = Math.hypot(dx, dy) || 1;

						if (dist > INTERACT_RADIUS) return;

						const falloff = 1 - dist / INTERACT_RADIUS;
						const push = falloff * 0.9;

						Matter.Body.setVelocity(body, {
							x: clamp(
								body.velocity.x + (dx / dist) * push * 18 + moveX * 0.45,
								-20,
								20,
							),
							y: clamp(
								body.velocity.y + (dy / dist) * push * 18 + moveY * 0.45,
								-20,
								20,
							),
						});

						Matter.Body.setAngularVelocity(
							body,
							clamp(
								body.angularVelocity + moveX * 0.008 * falloff,
								-0.35,
								0.35,
							),
						);
					});
				};

				const onMouseMove = (e: MouseEvent) => {
					scatterFromPointer(e.clientX, e.clientY);
				};

				const onTouchMove = (e: TouchEvent) => {
					const touch = e.touches[0];
					if (!touch) return;
					scatterFromPointer(touch.clientX, touch.clientY);
				};

				const onPointerEnter = (e: MouseEvent) => {
					const rect = container.getBoundingClientRect();
					const x = e.clientX - rect.left;
					const y = e.clientY - rect.top;
					pointer.x = x;
					pointer.lastX = x;
					pointer.y = y;
					pointer.lastY = y;
				};

				// Pills are not interactive on mobile.
				if (window.innerWidth >= 1000) {
					section.addEventListener("mousemove", onMouseMove);
					section.addEventListener("mouseenter", onPointerEnter);
					section.addEventListener("touchmove", onTouchMove, { passive: true });

					cleanupFns.push(() => {
						section.removeEventListener("mousemove", onMouseMove);
						section.removeEventListener("mouseenter", onPointerEnter);
						section.removeEventListener("touchmove", onTouchMove);
					});
				}

				Matter.Events.on(engine, "afterUpdate", () => {
					bodies.forEach(({ body, width, height }) => {
						const { minX, maxX, maxY } = getBounds(width, height);
						let { x, y } = body.position;
						let vx = body.velocity.x;
						let vy = body.velocity.y;
						let corrected = false;

						if (x < minX) {
							x = minX;
							vx = Math.abs(vx) * CONFIG.restitution;
							corrected = true;
						} else if (x > maxX) {
							x = maxX;
							vx = -Math.abs(vx) * CONFIG.restitution;
							corrected = true;
						}

						if (y > maxY) {
							y = maxY;
							vy = -Math.abs(vy) * CONFIG.restitution;
							corrected = true;
						}

						if (!corrected) return;

						Matter.Body.setPosition(body, { x, y });
						Matter.Body.setVelocity(body, { x: vx, y: vy });
					});
				});

				runner = Matter.Runner.create();
				Matter.Runner.run(runner, engine);

				const updatePositions = () => {
					bodies.forEach(({ body, element, width, height }) => {
						const x = clamp(
							body.position.x - width / 2,
							0,
							containerRect.width - width,
						);
						const y = clamp(
							body.position.y - height / 2,
							-height * 3,
							containerRect.height - height,
						);

						element.style.left = `${x}px`;
						element.style.top = `${y}px`;
						element.style.transform = `rotate(${body.angle}rad)`;
					});

					rafId = requestAnimationFrame(updatePositions);
				};

				updatePositions();
			};

			// Op een gewone pagina scrol je naar de footer toe en zie je ze vallen.
			// Maar als de footer zélf de pagina is, is "top bottom" al waar bij het
			// laden: dan valt alles achter het voorscherm en zie je bij het optillen
			// een gelande stapel. Vandaar dat de landing op het voorscherm wacht.
			let gestart = false;
			const startEens = () => {
				if (gestart) return;
				gestart = true;
				initPhysics();
			};

			let trigger: ScrollTrigger | null = null;
			let wachtTimeout: ReturnType<typeof setTimeout> | null = null;

			if (minimal) {
				window.addEventListener(PRELOADER_KLAAR, startEens, { once: true });
				cleanupFns.push(() =>
					window.removeEventListener(PRELOADER_KLAAR, startEens),
				);
				// Tweede bezoek: dan slaat het voorscherm zichzelf over en komt het
				// signaal nooit. Niet eindeloos wachten.
				wachtTimeout = setTimeout(startEens, 4000);
			} else {
				trigger = ScrollTrigger.create({
					trigger: section,
					start: "top bottom",
					once: true,
					onEnter: startEens,
				});
			}

			return () => {
				trigger?.kill();
				if (wachtTimeout) clearTimeout(wachtTimeout);
				clearTimeout(topWallTimeout);
				cancelAnimationFrame(rafId);
				cleanupFns.forEach((fn) => fn());

				if (runner) Matter.Runner.stop(runner);
				if (engine) {
					Matter.World.clear(engine.world, false);
					Matter.Engine.clear(engine);
				}

				engine = null;
				runner = null;
				topWall = null;
				bodies.length = 0;
			};
		},
		{ scope: sectionRef },
	);

	return (
		<footer className={styles.footer} ref={sectionRef}>
			<div className={styles.objectContainer} ref={containerRef}>
				{OBJECTS.map((label, i) => (
					<div key={label} className={`${styles.object} ${pillVariants[i]}`}>
						<p>{label}</p>
					</div>
				))}
			</div>

			<div className={styles.content}>
				<div className={`container pad ${styles.inner}`}>
					<div className={styles.top}>
						<div className={styles.brand}>
							{minimal && (
								<p className={`mono sm ${styles.eyebrow}`}>
									Nieuwe site — binnenkort
								</p>
							)}
							<h1>Brandocean</h1>
							<p>
								Digitaal bureau uit Amsterdam. Apps, webshops, AI en marketing.
								Alles in één hand.
							</p>
							{minimal && onStart ? (
								<p className={styles.cta}>
									<button type="button" onClick={onStart}>
										Iets te bouwen? Laat je mail achter →
									</button>
								</p>
							) : null}
						</div>

						{!minimal && (
							<div className={styles.columns}>
								{NAV.map((group) => (
									<div
										key={group.title}
										className={`${styles.column} ${styles.columnNav}`}
									>
										<p className="mono sm">{group.title}</p>
										<ul>
											{group.links.map((link) => (
												<li key={link.label}>
													<p>
														<TransitionLink href={link.href}>
															{link.label}
														</TransitionLink>
													</p>
												</li>
											))}
										</ul>
									</div>
								))}

								<div className={styles.column}>
									<p className="mono sm">Connect</p>
									<ul>
										{SOCIAL.map((link) => (
											<li key={link.label}>
												<p>
													<TransitionLink href="/" external={link.external}>
														{link.label}
													</TransitionLink>
												</p>
											</li>
										))}
									</ul>
								</div>
							</div>
						)}
					</div>

					<div className={styles.bottom}>
						<div className={styles.meta}>
							<p className="mono sm">Amsterdam, Buitenveldert · Rooswijck 5A</p>
						</div>

						<div className={styles.legal}>
							<p className="mono sm">© {new Date().getFullYear()} Brandocean</p>
							<p className="mono sm">info@brandocean.nl</p>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
