import { useGSAP } from "@gsap/react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { type MouseEvent, useEffect, useId, useRef, useState } from "react";
import type { SiteHref } from "../TransitionLink";
import { usePageTransition } from "../TransitionProvider/TransitionProvider";
import styles from "./Menu.module.css";

// GSAP's ticker schiet een requestAnimationFrame in zodra een plugin zich
// registreert, en workerd verbiedt timers op module-scope — dat liet de
// SSR-boundary knappen. Registreren hoeft alleen in de browser.
if (typeof window !== "undefined") {
	gsap.registerPlugin(SplitText, ScrollTrigger, useGSAP);
}

/**
 * Port van Codegrid's "Jam Area" menu. Eén knop rechtsboven; de overlay
 * clipt van onder naar boven open, de pagina eronder (`.bo-page`, zie
 * SiteLayout) schuift 40% omhoog en dimt. Onderin de grote links: elke
 * letter wisselt bij hover, de oranje balk glijdt naar de link onder de
 * muis en de hele rij pant mee met de muispositie.
 */

const LINKS: { label: string; href: SiteHref }[] = [
	{ label: "Home", href: "/home" },
	{ label: "Over ons", href: "/about" },
	{ label: "Werk", href: "/work" },
	{ label: "Expertise", href: "/expertise" },
	{ label: "Meedoen", href: "/careers" },
	{ label: "Contact", href: "/contact" },
];

const SOCIAL: { label: string; href: string }[] = [
	{ label: "Instagram", href: "https://instagram.com/brandocean" },
	{ label: "LinkedIn", href: "https://linkedin.com/company/brandocean" },
	{ label: "Kiesbeter", href: "https://kiesbeter.app" },
];

const DESKTOP = 1000;
const LERP = 0.05;
const PAGE = ".bo-page";

export default function Menu() {
	const [isOpen, setIsOpen] = useState(false);
	const overlayRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const imageRef = useRef<HTMLDivElement>(null);
	const linksWrapperRef = useRef<HTMLDivElement>(null);
	const highlighterRef = useRef<HTMLDivElement>(null);
	const linkRefs = useRef<(HTMLDivElement | null)[]>([]);

	const isOpenRef = useRef(false);
	const isAnimatingRef = useRef(false);
	const closeRef = useRef<() => void>(() => {});

	// Lerp-doelen voor het pannen van de linkrij en de balk eronder.
	const pan = useRef({ current: 0, target: 0 });
	const hl = useRef({ x: 0, targetX: 0, w: 0, targetW: 0 });

	const menuId = useId();
	const router = useRouter();
	const runTransition = usePageTransition();
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	function linkAnchors() {
		return linkRefs.current
			.map((el) => el?.querySelector("a"))
			.filter((a): a is HTMLAnchorElement => a !== null && a !== undefined);
	}

	function aimHighlighterAt(link: HTMLElement) {
		const wrapper = linksWrapperRef.current;
		if (!wrapper) return;
		const linkRect = link.getBoundingClientRect();
		const wrapperRect = wrapper.getBoundingClientRect();
		hl.current.targetX = linkRect.left - wrapperRect.left;
		const copy = link.querySelector("a span");
		hl.current.targetW = copy
			? (copy as HTMLElement).offsetWidth
			: link.offsetWidth;
	}

	useGSAP(
		() => {
			const overlay = overlayRef.current;
			const content = contentRef.current;
			const image = imageRef.current;
			const wrapper = linksWrapperRef.current;
			const highlighter = highlighterRef.current;
			if (!overlay || !content || !image || !wrapper || !highlighter) return;

			const anchors = linkAnchors();

			// Twee kopieën per link: de zichtbare en de kopie die er bij hover
			// van onderen in schuift, letter voor letter.
			anchors.forEach((anchor) => {
				anchor.querySelectorAll("span").forEach((copy, copyIndex) => {
					const split = SplitText.create(copy, { type: "chars" });
					for (const c of split.chars) c.classList.add(styles.char);
					if (copyIndex === 1) gsap.set(split.chars, { y: "110%" });
				});
			});

			gsap.set(content, { y: "50%", opacity: 0.25 });
			gsap.set(image, { scale: 0.5, opacity: 0.25 });
			gsap.set(anchors, { y: "150%" });
			gsap.set(highlighter, { y: "150%" });

			const first = linkRefs.current[0];
			const firstCopy = first?.querySelector("a span") as HTMLElement | null;
			if (first && firstCopy) {
				const w = firstCopy.offsetWidth;
				highlighter.style.width = `${w}px`;
				hl.current.w = w;
				hl.current.targetW = w;
				const x =
					first.getBoundingClientRect().left -
					wrapper.getBoundingClientRect().left;
				hl.current.x = x;
				hl.current.targetX = x;
			}

			// quickTo in plaats van elke frame een nieuwe tween (zoals het
			// origineel doet): zelfde beweging, fractie van de overhead.
			const wrapperX = gsap.quickTo(wrapper, "x", {
				duration: 0.3,
				ease: "power4.out",
			});
			const hlX = gsap.quickTo(highlighter, "x", {
				duration: 0.3,
				ease: "power4.out",
			});
			const hlW = gsap.quickTo(highlighter, "width", {
				duration: 0.3,
				ease: "power4.out",
			});

			let raf = 0;
			const tick = () => {
				pan.current.current +=
					(pan.current.target - pan.current.current) * LERP;
				hl.current.x += (hl.current.targetX - hl.current.x) * LERP;
				hl.current.w += (hl.current.targetW - hl.current.w) * LERP;

				wrapperX(pan.current.current);
				hlX(hl.current.x);
				hlW(hl.current.w);

				raf = requestAnimationFrame(tick);
			};
			raf = requestAnimationFrame(tick);

			return () => cancelAnimationFrame(raf);
		},
		{ scope: overlayRef },
	);

	function openMenu() {
		if (isAnimatingRef.current || isOpenRef.current) return;
		isAnimatingRef.current = true;
		setIsOpen(true);

		const anchors = linkAnchors();

		// In vh, niet in %: de pagina is vele schermen hoog en 40% daarvan
		// zou hem het beeld uit schuiven (wit scherm, dan plots de pagina).
		gsap.to(PAGE, {
			y: "-40vh",
			opacity: 0.25,
			duration: 1.25,
			ease: "expo.out",
		});

		gsap.to(overlayRef.current, {
			clipPath: "polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)",
			duration: 1.25,
			ease: "expo.out",
			onComplete: () => {
				gsap.set(PAGE, { y: "40vh" });
				gsap.set(linkRefs.current, { overflow: "visible" });
				isOpenRef.current = true;
				isAnimatingRef.current = false;
			},
		});

		gsap.to(contentRef.current, {
			y: "0%",
			opacity: 1,
			duration: 1.5,
			ease: "expo.out",
		});
		gsap.to(imageRef.current, {
			scale: 1,
			opacity: 1,
			duration: 1.5,
			ease: "expo.out",
		});
		gsap.to(anchors, {
			y: "0%",
			duration: 1.25,
			stagger: 0.1,
			delay: 0.25,
			ease: "expo.out",
		});
		gsap.to(highlighterRef.current, {
			y: "0%",
			duration: 1,
			delay: 1,
			ease: "expo.out",
		});
	}

	function closeMenu() {
		if (isAnimatingRef.current || !isOpenRef.current) return;
		isAnimatingRef.current = true;
		setIsOpen(false);

		const anchors = linkAnchors();

		gsap.to(PAGE, { y: 0, opacity: 1, duration: 1.25, ease: "expo.out" });
		gsap.to(anchors, { y: "-200%", duration: 1.25, ease: "expo.out" });
		gsap.to(contentRef.current, {
			y: "-100%",
			opacity: 0.25,
			duration: 1.25,
			ease: "expo.out",
		});
		gsap.to(imageRef.current, {
			y: "-100%",
			opacity: 0.5,
			duration: 1.25,
			ease: "expo.out",
		});

		gsap.to(overlayRef.current, {
			clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
			duration: 1.25,
			ease: "expo.out",
			onComplete: () => {
				gsap.set(overlayRef.current, {
					clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
				});
				gsap.set(anchors, { y: "150%" });
				gsap.set(highlighterRef.current, { y: "150%" });
				gsap.set(contentRef.current, { y: "50%", opacity: 0.25 });
				gsap.set(imageRef.current, { y: "0%", scale: 0.5, opacity: 0.25 });
				gsap.set(linkRefs.current, { overflow: "hidden" });

				// Geen inline transform achterlaten op de pagina: die zou het
				// referentiekader worden voor gepinde (position: fixed) secties.
				gsap.set(PAGE, { clearProps: "transform,opacity" });
				// Pas nú meten: met de transform er nog op zouden alle triggers
				// en pins 40vh verkeerd uitkomen (sticky secties die "clippen").
				ScrollTrigger.refresh();

				gsap.set(linksWrapperRef.current, { x: 0 });
				pan.current.current = 0;
				pan.current.target = 0;

				isOpenRef.current = false;
				isAnimatingRef.current = false;
			},
		});
	}

	closeRef.current = closeMenu;

	function toggleMenu() {
		if (isOpenRef.current) closeMenu();
		else openMenu();
	}

	// Navigatie vanuit het menu zelf regelt het sluiten in handleLinkClick;
	// dit vangt terug/vooruit in de browser.
	const navigerendRef = useRef(false);
	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname is de trigger, niet een input
	useEffect(() => {
		if (isOpenRef.current && !navigerendRef.current) closeRef.current();
	}, [pathname]);

	function handleLinkClick(
		event: MouseEvent<HTMLAnchorElement>,
		href: SiteHref,
	) {
		if (
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		event.preventDefault();
		if (router.state.location.pathname === href) {
			closeMenu();
			return;
		}

		// Menu dicht: gewone link, dus het paginagordijn (logo bijvoorbeeld).
		if (!isOpenRef.current) {
			runTransition(() => router.navigate({ to: href }));
			return;
		}

		// Menu open: het menu ís de transitie. De route wisselt achter de
		// overlay, scroll naar boven, en het sluiten van het menu onthult de
		// nieuwe pagina. Geen tweede gordijn erachteraan.
		if (isAnimatingRef.current) return;
		navigerendRef.current = true;
		Promise.resolve(router.navigate({ to: href }))
			.catch(() => undefined)
			.then(() => {
				window.scrollTo(0, 0);
				navigerendRef.current = false;
				closeMenu();
			});
	}

	function handleLinkEnter(link: HTMLDivElement) {
		if (window.innerWidth < DESKTOP) return;
		const [visible, animated] = Array.from(link.querySelectorAll("a span"));
		if (!visible || !animated) return;
		gsap.to(visible.querySelectorAll(`.${styles.char}`), {
			y: "-110%",
			stagger: 0.03,
			duration: 0.5,
			ease: "expo.inOut",
		});
		gsap.to(animated.querySelectorAll(`.${styles.char}`), {
			y: "0%",
			stagger: 0.03,
			duration: 0.5,
			ease: "expo.inOut",
		});
		aimHighlighterAt(link);
	}

	function handleLinkLeave(link: HTMLDivElement) {
		if (window.innerWidth < DESKTOP) return;
		const [visible, animated] = Array.from(link.querySelectorAll("a span"));
		if (!visible || !animated) return;
		gsap.to(animated.querySelectorAll(`.${styles.char}`), {
			y: "110%",
			stagger: 0.03,
			duration: 0.5,
			ease: "expo.inOut",
		});
		gsap.to(visible.querySelectorAll(`.${styles.char}`), {
			y: "0%",
			stagger: 0.03,
			duration: 0.5,
			ease: "expo.inOut",
		});
	}

	function handleWrapperLeave() {
		const first = linkRefs.current[0];
		if (first) aimHighlighterAt(first);
	}

	// De hele linkrij is breder dan het scherm; de muispositie in het
	// middelste halve scherm bepaalt hoe ver de rij naar links pant.
	function handleOverlayMove(event: MouseEvent<HTMLDivElement>) {
		if (window.innerWidth < DESKTOP) return;
		const wrapper = linksWrapperRef.current;
		if (!wrapper) return;

		const viewportWidth = window.innerWidth;
		const maxMoveRight = viewportWidth - wrapper.offsetWidth;
		const range = viewportWidth * 0.5;
		const startX = (viewportWidth - range) / 2;
		const endX = startX + range;

		let pct: number;
		if (event.clientX <= startX) pct = 0;
		else if (event.clientX >= endX) pct = 1;
		else pct = (event.clientX - startX) / range;

		pan.current.target = pct * maxMoveRight;
	}

	return (
		<>
			<nav className={styles.nav}>
				{/* Naar /home, niet naar "/": dat is nog de coming-soon-landing. */}
				<a
					href="/home"
					className={styles.logo}
					onClick={(e) => handleLinkClick(e, "/home")}
				>
					BRANDOCEAN
				</a>
				<button
					type="button"
					className={styles.toggle}
					onClick={toggleMenu}
					aria-expanded={isOpen}
					aria-controls={menuId}
				>
					{isOpen ? "Sluiten" : "Menu"}
				</button>
			</nav>

			{/* biome-ignore lint/a11y/noStaticElementInteractions: muisbeweging stuurt alleen het pannen van de linkrij */}
			<div
				id={menuId}
				className={styles.overlay}
				ref={overlayRef}
				onMouseMove={handleOverlayMove}
				aria-hidden={!isOpen}
			>
				<div className={styles.content} ref={contentRef}>
					<div className={styles.col}>
						<p>Brandocean</p>
						<p>Rooswijck 5A</p>
						<p>Amsterdam</p>
						<br />
						<p>Studio</p>
						<p>Sinds 2005</p>
						<br />
						<p>Contact</p>
						<p>
							<a href="mailto:info@brandocean.nl">info@brandocean.nl</a>
						</p>
						<br />
						<p>Direct</p>
						<p>
							<a href="tel:+31641324721">06 4132 4721</a>
						</p>
					</div>
					<div className={styles.col}>
						{SOCIAL.map((s) => (
							<p key={s.label}>
								<a href={s.href} target="_blank" rel="noopener noreferrer">
									{s.label}
								</a>
							</p>
						))}
						<br />
						<br />
						<p>Taal</p>
						<p>Nederlands</p>
						<br />
						<br />
						<p>Elke maand verder</p>
						<p>Voor een vast bedrag</p>
					</div>
				</div>

				<div className={styles.image} ref={imageRef}>
					<img src="/images/about/about_spot_1.jpg" alt="" />
				</div>

				{/* biome-ignore lint/a11y/noStaticElementInteractions: mouseleave zet alleen de balk terug */}
				<div
					className={styles.linksWrapper}
					ref={linksWrapperRef}
					onMouseLeave={handleWrapperLeave}
				>
					{LINKS.map((link, i) => (
						// biome-ignore lint/a11y/noStaticElementInteractions: hover stuurt de letteranimatie
						<div
							key={link.href}
							className={styles.link}
							ref={(el) => {
								linkRefs.current[i] = el;
							}}
							onMouseEnter={(e) => handleLinkEnter(e.currentTarget)}
							onMouseLeave={(e) => handleLinkLeave(e.currentTarget)}
						>
							<a
								href={link.href}
								onClick={(e) => handleLinkClick(e, link.href)}
								tabIndex={isOpen ? 0 : -1}
							>
								<span>{link.label}</span>
								<span aria-hidden="true">{link.label}</span>
							</a>
						</div>
					))}
					<div className={styles.highlighter} ref={highlighterRef} />
				</div>
			</div>
		</>
	);
}
