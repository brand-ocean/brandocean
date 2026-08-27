import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { useRef } from "react";
import SectionFooter from "../SectionFooter/SectionFooter";
import SectionNav from "../SectionNav/SectionNav";
import styles from "./Team.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const MOBILE_BREAKPOINT = 1000;

// The `name` values are placeholders — swap in the real names.
const TEAM = [
	{
		id: "team-card-1",
		frontImage: "/images/team/team_card_front_1.jpg",
		image: "/images/team/team_img_1.jpg",
		index: "01",
		name: "Naam volgt",
		role: "Development",
		focusLabel: "Focus",
		focus: "Apps, platforms & integraties",
	},
	{
		id: "team-card-2",
		frontImage: "/images/team/team_card_front_2.jpg",
		image: "/images/team/team_img_2.jpg",
		index: "02",
		name: "Naam volgt",
		role: "Design & Branding",
		focusLabel: "Focus",
		focus: "Merk, UI/UX & animatie",
	},
	{
		id: "team-card-3",
		frontImage: "/images/team/team_card_front_3.jpg",
		image: "/images/team/team_img_3.jpg",
		index: "03",
		name: "Naam volgt",
		role: "Data & AI",
		focusLabel: "Focus",
		focus: "Automatisering & analytics",
	},
];

export default function Team() {
	const stickyRef = useRef<HTMLElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
	const gapCompleted = useRef(false);
	const flipCompleted = useRef(false);

	useLenis(() => {
		ScrollTrigger.update();
	});

	useGSAP(
		() => {
			const section = stickyRef.current;
			const container = containerRef.current;
			const header = headerRef.current;
			if (!section || !container || !header) return;

			let scrollTrigger: ScrollTrigger | null = null;

			const cleanup = () => {
				scrollTrigger?.kill();
				scrollTrigger = null;
			};

			const setup = () => {
				cleanup();

				const cards = cardRefs.current.filter((el): el is HTMLDivElement =>
					Boolean(el),
				);
				if (cards.length === 0) return;

				const card1 = cards[0];
				const card2 = cards[1];
				const card3 = cards[2];

				cards.forEach((card) => gsap.set(card, { clearProps: "all" }));
				gsap.set(container, { clearProps: "all" });
				gsap.set(header, { clearProps: "all" });

				gapCompleted.current = false;
				flipCompleted.current = false;

				if (window.innerWidth < MOBILE_BREAKPOINT) return;

				gsap.set(header, { y: 40, opacity: 0 });

				scrollTrigger = ScrollTrigger.create({
					trigger: section,
					start: "top top",
					end: `+=${window.innerHeight * 4}`,
					scrub: 1,
					pin: true,
					pinSpacing: true,
					onUpdate: (self) => {
						const progress = self.progress;

						if (progress >= 0.1 && progress <= 0.25) {
							const headerProgress = gsap.utils.mapRange(
								0.1,
								0.25,
								0,
								1,
								progress,
							);
							gsap.set(header, {
								y: gsap.utils.mapRange(0, 1, 40, 0, headerProgress),
								opacity: headerProgress,
							});
						} else if (progress < 0.1) {
							gsap.set(header, { y: 40, opacity: 0 });
						} else {
							gsap.set(header, { y: 0, opacity: 1 });
						}

						if (progress <= 0.25) {
							const width = gsap.utils.mapRange(0, 0.25, 80, 60, progress);
							gsap.set(container, { width: `${width}%` });
						} else {
							gsap.set(container, { width: "60%" });
						}

						if (progress >= 0.35 && !gapCompleted.current) {
							gsap.to(container, {
								gap: "16px",
								duration: 0.5,
								ease: "power3.out",
							});
							gsap.to(cards, {
								borderRadius: "12px",
								duration: 0.5,
								ease: "power3.out",
							});
							gapCompleted.current = true;
						} else if (progress < 0.35 && gapCompleted.current) {
							gsap.to(container, {
								gap: "0px",
								duration: 0.5,
								ease: "power3.out",
							});
							gsap.to(card1, {
								borderRadius: "12px 0 0 12px",
								duration: 0.5,
								ease: "power3.out",
							});
							gsap.to(card2, {
								borderRadius: "0px",
								duration: 0.5,
								ease: "power3.out",
							});
							gsap.to(card3, {
								borderRadius: "0 12px 12px 0",
								duration: 0.5,
								ease: "power3.out",
							});
							gapCompleted.current = false;
						}

						if (progress >= 0.7 && !flipCompleted.current) {
							gsap.to(cards, {
								rotationY: 180,
								duration: 0.75,
								ease: "power3.inOut",
								stagger: 0.1,
							});
							gsap.to([card1, card3], {
								y: 30,
								rotationZ: (i: number) => [-12, 12][i],
								duration: 0.75,
								ease: "power3.inOut",
							});
							flipCompleted.current = true;
						} else if (progress < 0.7 && flipCompleted.current) {
							gsap.to(cards, {
								rotationY: 0,
								duration: 0.75,
								ease: "power3.inOut",
								stagger: -0.1,
							});
							gsap.to([card1, card3], {
								y: 0,
								rotationZ: 0,
								duration: 0.75,
								ease: "power3.inOut",
							});
							flipCompleted.current = false;
						}
					},
				});
			};

			setup();

			let resizeTimer: ReturnType<typeof setTimeout>;
			const handleResize = () => {
				clearTimeout(resizeTimer);
				resizeTimer = setTimeout(setup, 250);
			};

			window.addEventListener("resize", handleResize);

			return () => {
				cleanup();
				clearTimeout(resizeTimer);
				window.removeEventListener("resize", handleResize);
			};
		},
		{ scope: stickyRef },
	);

	return (
		<section className={styles.sticky} ref={stickyRef} data-team-sticky>
			<div className={styles.sectionNav}>
				<SectionNav left="De mensen" right="Draai ze om" />
			</div>

			<div className={styles.frame}>
				<div className={styles.stickyHeader} ref={headerRef}>
					<h6>Small Crew, Big Range</h6>
				</div>

				<div className={styles.cardContainer} ref={containerRef}>
					{TEAM.map((member, i) => (
						<div
							key={member.id}
							className={`${styles.card} ${styles[`card${i + 1}`]}`}
							ref={(el) => {
								cardRefs.current[i] = el;
							}}
						>
							<div className={styles.cardFront}>
								<img src={member.frontImage} alt={member.name} />
							</div>
							<div className={styles.cardBack}>
								<p className={`mono sm ${styles.cardIndex}`}>
									( {member.index} )
								</p>
								<div className={styles.cardInfo}>
									<div className={styles.portrait}>
										<img src={member.image} alt={member.name} />
									</div>
									<div className={styles.cardBlock}>
										<p className="mono sm">{member.role}</p>
										<h6>{member.name}</h6>
									</div>
									<div className={styles.cardBlock}>
										<p className="mono sm">{member.focusLabel}</p>
										<p>{member.focus}</p>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			<div className={styles.sectionFooter}>
				<SectionFooter left="Wie je krijgt" right="Terug naar boven" />
			</div>
		</section>
	);
}
