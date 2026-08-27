import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { useRef } from "react";
import type { CaseItem } from "@/site/utils/portfolio";
import SectionFooter from "../SectionFooter/SectionFooter";
import SectionNav from "../SectionNav/SectionNav";
import TransitionLink from "../TransitionLink";
import styles from "./FeaturedWork.module.css";

// GSAP's ticker schiet een requestAnimationFrame in zodra een plugin zich
// registreert, en workerd verbiedt timers op module-scope — dat liet de
// SSR-boundary knappen. Registreren hoeft alleen in de browser.
if (typeof window !== "undefined") {
	gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const CARD_Y_OFFSET = 5;
const CARD_SCALE_STEP = 0.075;

/** Card backgrounds cycle through the palette — they aren't a CMS field. */
const CARD_COLORS = [
	"var(--base-400)",
	"var(--base-800)",
	"var(--base-600)",
	"var(--base-900)",
];

const FALLBACK_IMAGE = "/images/featured-work/featured_work_1.jpg";

export default function FeaturedWork({ items }: { items: CaseItem[] }) {
	const sectionRef = useRef<HTMLElement>(null);
	const cardsRef = useRef<(HTMLElement | null)[]>([]);

	const projects = items.map((item, i) => ({
		name: item.title,
		slug: item.slug,
		description: item.summary ?? item.category,
		tags: item.tags ?? [],
		image: item.heroImageUrl ?? FALLBACK_IMAGE,
		color: CARD_COLORS[i % CARD_COLORS.length],
	}));

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
		// The cards only exist once the items have loaded, so the pin has to be
		// rebuilt when they arrive.
		{
			scope: sectionRef,
			dependencies: [projects.length],
			revertOnUpdate: true,
		},
	);

	return (
		<section className={styles.stickyCards} ref={sectionRef}>
			<div className={styles.sectionNav}>
				<SectionNav left="Uitgelicht werk" right="04 / Projecten" />
			</div>

			{projects.map((project, i) => (
				<article
					key={project.slug}
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
							<TransitionLink
								href="/work/$slug"
								params={{ slug: project.slug }}
								className={styles.cardLink}
							>
								<h6>{project.name}</h6>
							</TransitionLink>
						</div>
						<p className={styles.description}>{project.description}</p>
					</div>
					<TransitionLink
						href="/work/$slug"
						params={{ slug: project.slug }}
						className={`${styles.col} ${styles.colMedia}`}
					>
						<img src={project.image} alt={project.name} />
					</TransitionLink>
				</article>
			))}

			<div className={styles.sectionFooter}>
				<SectionFooter left="Scroll door" right="Meer op de werkpagina" />
			</div>
		</section>
	);
}
