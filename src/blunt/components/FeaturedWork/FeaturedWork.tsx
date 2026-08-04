import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { useRef } from "react";
import SectionFooter from "../SectionFooter/SectionFooter";
import SectionNav from "../SectionNav/SectionNav";
import styles from "./FeaturedWork.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const CARD_Y_OFFSET = 5;
const CARD_SCALE_STEP = 0.075;

const PROJECTS = [
	{
		name: "Ghost Signal",
		description:
			"A cast of characters and animated bumpers built for a late-night channel.",
		tags: ["Characters", "Animation"],
		image: "/images/featured-work/featured_work_1.jpg",
		color: "var(--base-400)",
	},
	{
		name: "Stack House",
		description:
			"A full illustrated world wrapped around a weird little apartment brand.",
		tags: ["Illustration", "Worldbuilding"],
		image: "/images/featured-work/featured_work_2.jpg",
		color: "var(--base-800)",
	},
	{
		name: "Wet Brain",
		description:
			"Cover art and a mascot for an app that had no business being this fun.",
		tags: ["Cover Art", "Mascot"],
		image: "/images/featured-work/featured_work_3.jpg",
		color: "var(--base-600)",
	},
	{
		name: "Slow Burn",
		description:
			"A poster series and looping visuals for a music label that never sleeps.",
		tags: ["Posters", "Motion"],
		image: "/images/featured-work/featured_work_4.jpg",
		color: "var(--base-900)",
	},
];

export default function FeaturedWork() {
	const sectionRef = useRef<HTMLElement>(null);
	const cardsRef = useRef<(HTMLElement | null)[]>([]);

	useLenis(() => {
		ScrollTrigger.update();
	});

	useGSAP(
		() => {
			const section = sectionRef.current;
			const cards = cardsRef.current.filter((el): el is HTMLElement =>
				Boolean(el),
			);
			if (!section || cards.length === 0) return;

			const totalCards = cards.length;
			const segmentSize = 1 / totalCards;

			// Match original init — only position + scale
			cards.forEach((card, i) => {
				gsap.set(card, {
					xPercent: -50,
					yPercent: -50 + i * CARD_Y_OFFSET,
					scale: 1 - i * CARD_SCALE_STEP,
				});
			});

			ScrollTrigger.create({
				trigger: section,
				start: "top top",
				end: () => `+=${window.innerHeight * 4}`,
				pin: true,
				pinSpacing: true,
				scrub: 1,
				invalidateOnRefresh: true,
				onUpdate: (self) => {
					const progress = self.progress;
					const activeIndex = Math.min(
						Math.floor(progress / segmentSize),
						totalCards - 1,
					);
					const segProgress =
						(progress - activeIndex * segmentSize) / segmentSize;

					cards.forEach((card, i) => {
						if (i < activeIndex) {
							gsap.set(card, {
								yPercent: -250,
								rotationX: 35,
							});
						} else if (i === activeIndex) {
							gsap.set(card, {
								yPercent: gsap.utils.interpolate(-50, -200, segProgress),
								rotationX: gsap.utils.interpolate(0, 35, segProgress),
								scale: 1,
							});
						} else {
							const behindIndex = i - activeIndex;
							gsap.set(card, {
								yPercent: -50 + (behindIndex - segProgress) * CARD_Y_OFFSET,
								rotationX: 0,
								scale: 1 - (behindIndex - segProgress) * CARD_SCALE_STEP,
							});
						}
					});
				},
			});
		},
		{ scope: sectionRef },
	);

	return (
		<section className={styles.stickyCards} ref={sectionRef}>
			<div className={styles.sectionNav}>
				<SectionNav left="The Good Stuff" right="04 / Chaos" />
			</div>

			{PROJECTS.map((project, i) => (
				<article
					key={project.name}
					className={styles.card}
					style={{ backgroundColor: project.color }}
					ref={(el) => {
						cardsRef.current[i] = el;
					}}
				>
					<div className={styles.col}>
						<div className={styles.colTop}>
							<p className={`mono ${styles.tags} sm`}>
								{project.tags.join(" / ")}
							</p>
							<h6>{project.name}</h6>
						</div>
						<p className={styles.description}>{project.description}</p>
					</div>
					<div className={`${styles.col} ${styles.colMedia}`}>
						<img src={project.image} alt={project.name} />
					</div>
				</article>
			))}

			<div className={styles.sectionFooter}>
				<SectionFooter left="Roll Through" right="Best In Show" />
			</div>
		</section>
	);
}
