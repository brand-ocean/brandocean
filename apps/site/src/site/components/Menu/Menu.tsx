import { useGSAP } from "@gsap/react";
import { useRouterState } from "@tanstack/react-router";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useEffect, useRef, useState } from "react";
import { TiLocationArrow } from "react-icons/ti";
import { scrambleTextStaggered } from "../../utils/textAnimations";
import TransitionLink, { type SiteHref } from "../TransitionLink";
import styles from "./Menu.module.css";

// GSAP's ticker schiet een requestAnimationFrame in zodra een plugin zich
// registreert, en workerd verbiedt timers op module-scope — dat liet de
// SSR-boundary knappen. Registreren hoeft alleen in de browser.
if (typeof window !== "undefined") {
	gsap.registerPlugin(SplitText, useGSAP);
}

const LEFT_LINKS: { label: string; href: SiteHref }[] = [
	{ label: "over ons", href: "/about" },
	{ label: "werk", href: "/work" },
];

const RIGHT_LINKS: { label: string; href: SiteHref }[] = [
	{ label: "expertise", href: "/expertise" },
	{ label: "meedoen", href: "/careers" },
	{ label: "contact", href: "/contact" },
];

const MOBILE_LINKS = [...LEFT_LINKS, ...RIGHT_LINKS];

const SOCIAL_LINKS: { label: string; external: string }[] = [
	{ label: "Instagram", external: "https://instagram.com/brandocean" },
	{ label: "LinkedIn", external: "https://linkedin.com/company/brandocean" },
];

export default function Menu() {
	const [isOpen, setIsOpen] = useState(false);
	const navRef = useRef<HTMLElement>(null);
	const overlayRef = useRef<HTMLDivElement>(null);
	const socialRef = useRef<HTMLDivElement>(null);
	const splitsRef = useRef<SplitText[]>([]);
	const socialSplitsRef = useRef<{ arrow: Element | null; chars: Element[] }[]>(
		[],
	);
	const isAnimating = useRef(false);
	const isOpenRef = useRef(false);
	const isMenuVisible = useRef(true);
	const lastScrollY = useRef(0);
	const closeMenuRef = useRef<(options?: { force?: boolean }) => void>(
		() => {},
	);
	const menuTimelineRef = useRef<gsap.core.Timeline | null>(null);
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	useGSAP(
		() => {
			const overlay = overlayRef.current;
			const social = socialRef.current;
			if (!overlay || !social) return;

			gsap.set(overlay, { scaleY: 0, transformOrigin: "top center" });
			gsap.set(social, { opacity: 1, y: 20 });

			splitsRef.current = [];
			socialSplitsRef.current = [];

			overlay.querySelectorAll("li a").forEach((link) => {
				const split = SplitText.create(link, {
					type: "words",
					mask: "words",
				});
				splitsRef.current.push(split);
				gsap.set(split.words, { yPercent: 120 });
			});

			social.querySelectorAll("a").forEach((link) => {
				const label = link.querySelector("span") || link;
				const arrow = link.querySelector("svg");
				const split = SplitText.create(label, { type: "chars" });
				socialSplitsRef.current.push({ arrow, chars: split.chars });
				gsap.set(split.chars, { opacity: 0 });
				if (arrow) gsap.set(arrow, { opacity: 0 });
			});
		},
		{ scope: navRef },
	);

	function getWords() {
		return splitsRef.current.flatMap((split) => split.words);
	}

	function getSocialRevealElements() {
		return socialSplitsRef.current.flatMap(({ arrow, chars }) =>
			arrow ? [arrow, ...chars] : chars,
		);
	}

	function openMenu() {
		if (isAnimating.current || isOpenRef.current) return;
		isAnimating.current = true;
		isOpenRef.current = true;
		setIsOpen(true);

		menuTimelineRef.current?.kill();

		const tl = gsap.timeline({
			onComplete: () => {
				isAnimating.current = false;
			},
		});
		menuTimelineRef.current = tl;

		tl.to(overlayRef.current, {
			scaleY: 1,
			duration: 0.5,
			ease: "power3.out",
		});

		tl.to(
			getWords(),
			{
				yPercent: 0,
				duration: 0.75,
				stagger: 0.05,
				ease: "power4.out",
			},
			"-=0.3",
		);

		tl.to(
			socialRef.current,
			{
				y: 0,
				opacity: 1,
				duration: 0.3,
				ease: "power2.out",
				onComplete: () => {
					scrambleTextStaggered(getSocialRevealElements(), 0.4);
				},
			},
			"-=1",
		);
	}

	function closeMenu({ force = false }: { force?: boolean } = {}) {
		if (!isOpenRef.current && !force) return;
		if (isAnimating.current && !force) return;

		menuTimelineRef.current?.kill();
		isAnimating.current = true;
		isOpenRef.current = false;
		setIsOpen(false);

		const tl = gsap.timeline({
			onComplete: () => {
				isAnimating.current = false;
			},
		});
		menuTimelineRef.current = tl;

		tl.to(socialRef.current, {
			opacity: 0,
			duration: 0.2,
			ease: "power2.in",
			onComplete: () => {
				gsap.set(getSocialRevealElements(), { opacity: 0 });
				gsap.set(socialRef.current, { y: 20 });
			},
		});

		tl.to(
			getWords(),
			{
				yPercent: 120,
				duration: 0.25,
				stagger: -0.025,
				ease: "power2.in",
			},
			"<",
		);

		tl.to(
			overlayRef.current,
			{
				scaleY: 0,
				duration: 0.5,
				ease: "power3.inOut",
			},
			"-=0.2",
		);
	}

	closeMenuRef.current = closeMenu;

	function toggleMenu() {
		if (isOpenRef.current) closeMenu();
		else openMenu();
	}

	function handleNavLinkClick() {
		closeMenu({ force: true });
	}

	useEffect(() => {
		if (isOpenRef.current) {
			closeMenuRef.current({ force: true });
		}
	}, [pathname]);

	useEffect(() => {
		lastScrollY.current = window.scrollY;

		function handleScroll() {
			const currentScrollY = window.scrollY;
			const menu = navRef.current;
			if (!menu) return;

			if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
				if (isOpenRef.current) closeMenuRef.current({ force: true });
				if (isMenuVisible.current) {
					menu.classList.add(styles.navHidden);
					isMenuVisible.current = false;
				}
			} else if (currentScrollY < lastScrollY.current) {
				if (!isMenuVisible.current) {
					menu.classList.remove(styles.navHidden);
					isMenuVisible.current = true;
				}
			}

			lastScrollY.current = currentScrollY;
		}

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	return (
		<nav className={styles.nav} ref={navRef}>
			<div className={`container ${styles.navInner}`}>
				<div className={styles.menuShell}>
					<div className={`${styles.bar} ${isOpen ? styles.barOpen : ""}`}>
						<TransitionLink href="/" className={styles.logo}>
							BRANDOCEAN
						</TransitionLink>

						<div className={styles.desktopLeft}>
							{LEFT_LINKS.map((link) => (
								<TransitionLink
									key={link.href}
									href={link.href}
									className={styles.pill}
								>
									<span className={styles.linkLabel}>{link.label}</span>
									<TiLocationArrow
										className={styles.arrow}
										aria-hidden="true"
									/>
								</TransitionLink>
							))}
						</div>

						<div className={styles.desktopRight}>
							{RIGHT_LINKS.map((link) => (
								<TransitionLink
									key={link.href}
									href={link.href}
									className={styles.rightLink}
								>
									<span className={styles.linkLabel}>{link.label}</span>
									<TiLocationArrow
										className={styles.arrow}
										aria-hidden="true"
									/>
								</TransitionLink>
							))}
						</div>

						<button
							type="button"
							className={styles.menuToggle}
							onClick={toggleMenu}
							aria-expanded={isOpen}
							aria-label={isOpen ? "Close menu" : "Open menu"}
						>
							<div
								className={`${styles.hamburger} ${isOpen ? styles.hamburgerOpen : ""}`}
							>
								<span className={styles.hamburgerLine} />
								<span className={styles.hamburgerLine} />
							</div>
						</button>
					</div>

					<div className={styles.overlay} ref={overlayRef}>
						<ul className={styles.overlayNav}>
							{MOBILE_LINKS.map((link) => (
								<li key={link.href}>
									<TransitionLink href={link.href} onClick={handleNavLinkClick}>
										{link.label}
									</TransitionLink>
								</li>
							))}
						</ul>
						<div className={styles.overlaySocial} ref={socialRef}>
							{SOCIAL_LINKS.map((link) => (
								<TransitionLink
									key={link.label}
									href="/"
									external={link.external}
									onClick={handleNavLinkClick}
								>
									<TiLocationArrow
										className={styles.arrow}
										aria-hidden="true"
									/>
									<span className={styles.linkLabel}>{link.label}</span>
								</TransitionLink>
							))}
						</div>
					</div>
				</div>
			</div>
		</nav>
	);
}
