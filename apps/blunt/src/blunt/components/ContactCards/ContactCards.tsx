import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { useRef } from "react";
import SectionFooter from "../SectionFooter/SectionFooter";
import SectionNav from "../SectionNav/SectionNav";
import styles from "./ContactCards.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const MOBILE_BREAKPOINT = 1000;

const CARDS = [
	{
		id: "contact-card-1",
		frontSrc: "/images/contact/card_front.png",
		frontAlt: "Contactkaart",
		index: "01",
		label: "Mail",
		value: "info@brandocean.nl",
		detailLabel: "Reactie",
		detail: "Binnen 24 uur",
		note: "Nieuwe projecten, samenwerkingen en alles daartussenin.",
	},
	{
		id: "contact-card-2",
		frontSrc: "/images/contact/card_front.png",
		frontAlt: "Contactkaart",
		index: "02",
		label: "Telefoon",
		value: "06 4132 4721",
		detailLabel: "Bereikbaar",
		detail: "Ma–vr, 9–18 uur",
		note: "Bel gerust. Sommige dingen zijn sneller besproken dan gemaild.",
	},
	{
		id: "contact-card-3",
		frontSrc: "/images/contact/card_front.png",
		frontAlt: "Contactkaart",
		index: "03",
		label: "Studio",
		value: "Amsterdam",
		detailLabel: "Langskomen",
		detail: "Op afspraak",
		note: "Rooswijck 5A, 1081 AJ. Koffie staat klaar.",
	},
	{
		id: "contact-card-4",
		frontSrc: "/images/contact/card_front.png",
		frontAlt: "Contactkaart",
		index: "04",
		label: "Online",
		value: "@brandocean",
		detailLabel: "Kanalen",
		detail: "IG · LinkedIn",
		note: "Werk in uitvoering, lanceringen en af en toe een blik achter de schermen.",
	},
];

const POSITIONS = [20, 40, 60, 80];
const ROTATIONS = [-12, -6, 6, 12];

export default function ContactCards() {
	const containerRef = useRef<HTMLDivElement>(null);
	const cardsSectionRef = useRef<HTMLElement>(null);
	const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

	useLenis(() => {
		ScrollTrigger.update();
	});

	useGSAP(
		() => {
			const cardsSection = cardsSectionRef.current;
			if (!cardsSection) return;

			let resizeTimer: ReturnType<typeof setTimeout>;
			let triggers: ScrollTrigger[] = [];

			const cleanup = () => {
				triggers.forEach((trigger) => trigger.kill());
				triggers = [];
			};

			const clearCardProps = (cards: HTMLDivElement[]) => {
				cards.forEach((card) => {
					const frontEl = card.querySelector(`.${styles.front}`);
					const backEl = card.querySelector(`.${styles.back}`);
					gsap.killTweensOf(card);
					if (frontEl) gsap.killTweensOf(frontEl);
					if (backEl) gsap.killTweensOf(backEl);
					gsap.set(card, { clearProps: "all" });
					if (frontEl) gsap.set(frontEl, { clearProps: "all" });
					if (backEl) gsap.set(backEl, { clearProps: "all" });
				});
			};

			const setupMobile = (cards: HTMLDivElement[]) => {
				clearCardProps(cards);

				cards.forEach((card) => {
					const frontEl = card.querySelector(`.${styles.front}`);
					const backEl = card.querySelector(`.${styles.back}`);
					if (frontEl) gsap.set(frontEl, { rotateY: -180 });
					if (backEl) gsap.set(backEl, { rotateY: 0 });
				});
			};

			const setupDesktop = (cards: HTMLDivElement[]) => {
				clearCardProps(cards);

				const totalScrollHeight = window.innerHeight * 3;

				cards.forEach((card) => {
					const frontEl = card.querySelector(`.${styles.front}`);
					const backEl = card.querySelector(`.${styles.back}`);

					gsap.set(card, {
						left: "50%",
						top: "50%",
						xPercent: -50,
						yPercent: -50,
						rotate: 0,
					});

					if (frontEl) gsap.set(frontEl, { rotateY: 0 });
					if (backEl) gsap.set(backEl, { rotateY: 180 });
				});

				triggers.push(
					ScrollTrigger.create({
						trigger: cardsSection,
						start: "top top",
						end: () => `+=${totalScrollHeight}`,
						pin: true,
						pinSpacing: true,
					}),
				);

				cards.forEach((card, index) => {
					const tween = gsap.to(card, {
						left: `${POSITIONS[index]}%`,
						rotation: ROTATIONS[index],
						ease: "none",
						scrollTrigger: {
							trigger: cardsSection,
							start: "top top",
							end: () => `+=${window.innerHeight}`,
							scrub: 0.5,
						},
					});
					if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
				});

				cards.forEach((card, index) => {
					const frontEl = card.querySelector(`.${styles.front}`);
					const backEl = card.querySelector(`.${styles.back}`);

					const staggerOffset = index * 0.05;
					const startOffset = 1 / 3 + staggerOffset;
					const endOffset = 2 / 3 + staggerOffset;

					triggers.push(
						ScrollTrigger.create({
							trigger: cardsSection,
							start: "top top",
							end: () => `+=${totalScrollHeight}`,
							scrub: 1,
							onUpdate: (self) => {
								const progress = self.progress;

								if (progress >= startOffset && progress <= endOffset) {
									const animationProgress = (progress - startOffset) / (1 / 3);
									const frontRotation = -180 * animationProgress;
									const backRotation = 180 - 180 * animationProgress;
									const cardRotation =
										ROTATIONS[index] * (1 - animationProgress);

									gsap.to(frontEl, {
										rotateY: frontRotation,
										ease: "power1.out",
									});
									gsap.to(backEl, {
										rotateY: backRotation,
										ease: "power1.out",
									});
									gsap.to(card, {
										xPercent: -50,
										yPercent: -50,
										rotate: cardRotation,
										ease: "power1.out",
									});
								}
							},
						}),
					);
				});
			};

			const setup = () => {
				cleanup();

				const cards = cardRefs.current.filter((el): el is HTMLDivElement =>
					Boolean(el),
				);
				if (cards.length === 0) return;

				if (window.innerWidth < MOBILE_BREAKPOINT) {
					setupMobile(cards);
				} else {
					setupDesktop(cards);
				}

				ScrollTrigger.refresh();
			};

			setup();

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
		{ scope: containerRef },
	);

	return (
		<div className={styles.container} ref={containerRef}>
			<section className={styles.cards} ref={cardsSectionRef}>
				<div className={styles.sectionNav}>
					<SectionNav left="Even bellen?" right="Doen" />
				</div>

				{CARDS.map((card, index) => (
					<div
						key={card.id}
						id={card.id}
						className={styles.card}
						ref={(el) => {
							cardRefs.current[index] = el;
						}}
					>
						<div className={styles.cardWrapper}>
							<div className={styles.inner}>
								<div className={styles.front}>
									<img src={card.frontSrc} alt={card.frontAlt} />
								</div>
								<div className={styles.back}>
									<p className={`mono sm ${styles.index}`}>( {card.index} )</p>
									<div className={styles.backInfo}>
										<div className={styles.backBlock}>
											<p className="mono sm">{card.label}</p>
											<p className="md">{card.value}</p>
										</div>
										<div className={styles.backBlock}>
											<p className="mono sm">{card.detailLabel}</p>
											<p>{card.detail}</p>
										</div>
										<p className="sm">{card.note}</p>
									</div>
								</div>
							</div>
						</div>
					</div>
				))}

				<div className={styles.sectionFooter}>
					<SectionFooter left="Jouw beurt" right="We luisteren" />
				</div>
			</section>
		</div>
	);
}
