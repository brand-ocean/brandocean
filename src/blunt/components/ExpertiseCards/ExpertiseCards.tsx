import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { useRef } from "react";
import styles from "./ExpertiseCards.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const EXPERTISE = [
	{
		tagline: "Characters people fall for and never forget",
		title: "Illustration",
		description:
			"Hand-drawn worlds, casts of oddballs, and cover art with teeth. We make the loud, strange visuals that stop a thumb mid-scroll and hold it there.",
		image: "/images/expertise/expertise_card_1.jpg",
		color: "var(--base-300)",
	},
	{
		tagline: "Mascots with a pulse and a bit of an attitude",
		title: "Character Design",
		description:
			"Original creatures, mascots, and casts built to carry a brand. Each one gets its own face, mood, and reason to exist, ready to run wild anywhere.",
		image: "/images/expertise/expertise_card_2.jpg",
		color: "var(--base-500)",
	},
	{
		tagline: "Drawings that refuse to sit still",
		title: "Animation & Motion",
		description:
			"Loops, idents, and animated bumpers that give still art a heartbeat. Playful movement tuned for late-night channels, socials, and anything that flickers.",
		image: "/images/expertise/expertise_card_3.jpg",
		color: "var(--base-700)",
	},
	{
		tagline: "Whole universes from one weird doodle",
		title: "Worldbuilding",
		description:
			"We take a single strange idea and grow it into a full illustrated world, complete with rules, residents, and enough chaos to keep people digging.",
		image: "/images/expertise/expertise_card_4.jpg",
		color: "var(--base-800)",
	},
];

export default function ExpertiseCards() {
	const sectionRef = useRef<HTMLElement>(null);
	const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
	const cardInnerRefs = useRef<(HTMLDivElement | null)[]>([]);

	useLenis(() => {
		ScrollTrigger.update();
	});

	useGSAP(
		() => {
			const cards = cardRefs.current.filter((el): el is HTMLDivElement =>
				Boolean(el),
			);
			const inners = cardInnerRefs.current.filter((el): el is HTMLDivElement =>
				Boolean(el),
			);

			cards.forEach((card, index) => {
				if (index >= cards.length - 1) return;

				const cardInner = inners[index];
				if (!cardInner) return;

				gsap.fromTo(
					cardInner,
					{
						y: "0%",
						z: 0,
						rotationX: 0,
					},
					{
						y: "-50%",
						z: -250,
						rotationX: 45,
						scrollTrigger: {
							trigger: cards[index + 1],
							start: "top 85%",
							end: "top -75%",
							scrub: true,
							pin: card,
							pinSpacing: false,
						},
					},
				);

				gsap.to(cardInner, {
					"--after-opacity": 1,
					scrollTrigger: {
						trigger: cards[index + 1],
						start: "top 75%",
						end: "top -25%",
						scrub: true,
					},
				});
			});
		},
		{ scope: sectionRef },
	);

	return (
		<section className={styles.stickyCards} ref={sectionRef}>
			{EXPERTISE.map((item, index) => (
				<div
					key={item.title}
					className={styles.card}
					ref={(el) => {
						cardRefs.current[index] = el;
					}}
				>
					<div
						className={styles.cardInner}
						style={{ backgroundColor: item.color }}
						ref={(el) => {
							cardInnerRefs.current[index] = el;
						}}
					>
						<div className={styles.cardInfo}>
							<p className="mono sm">{item.tagline}</p>
						</div>
						<div className={styles.cardTitle}>
							<h1>{item.title}</h1>
						</div>
						<div className={styles.cardDescription}>
							<p>{item.description}</p>
						</div>
						<div className={styles.cardImg}>
							<img src={item.image} alt={item.title} />
						</div>
					</div>
				</div>
			))}
		</section>
	);
}
