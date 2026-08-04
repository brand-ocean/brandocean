import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { useRef } from "react";
import Callout from "../Callout/Callout";
import Copy from "../Copy/Copy";
import SectionFooter from "../SectionFooter/SectionFooter";
import styles from "./Stats.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const PARTNERS = [
	"Adult Swim",
	"Vans",
	"Mailchimp",
	"Bandcamp",
	"Spotify",
	"RedBull",
];

export default function Stats() {
	const sectionRef = useRef<HTMLElement>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	const cardRefs = useRef<(HTMLElement | null)[]>([]);

	useLenis(() => {
		ScrollTrigger.update();
	});

	useGSAP(
		() => {
			const grid = gridRef.current;
			const cards = cardRefs.current.filter((el): el is HTMLElement =>
				Boolean(el),
			);
			if (!grid || cards.length === 0) return;

			gsap.set(cards, {
				rotationX: -90,
				transformOrigin: "50% 0%",
				transformPerspective: 1200,
				force3D: true,
			});

			const tween = gsap.to(cards, {
				rotationX: 0,
				duration: 1.05,
				ease: "power3.out",
				stagger: {
					each: 0.12,
					from: "start",
				},
				overwrite: "auto",
				paused: true,
			});

			const trigger = ScrollTrigger.create({
				trigger: grid,
				start: "top 95%",
				once: true,
				onEnter: () => tween.play(),
			});

			return () => {
				tween.kill();
				trigger.kill();
			};
		},
		{ scope: sectionRef },
	);

	const setCardRef = (index: number) => (el: HTMLElement | null) => {
		cardRefs.current[index] = el;
	};

	return (
		<section className={styles.stats} ref={sectionRef}>
			<div className={`container pad ${styles.inner}`}>
				<header className={styles.header}>
					<Copy>
						<h4>
							Blunt In Numbers And Receipts
							<Callout
								className={styles.callout}
								label="No fluff"
								variant={2}
								rotation={-20}
								top="0.75em"
								left="-0.25em"
							/>
						</h4>
					</Copy>
				</header>

				<div className={styles.grid} ref={gridRef}>
					<div className={`${styles.col} ${styles.colLeft}`}>
						<article
							className={`${styles.card} ${styles.cardMedia}`}
							ref={setCardRef(0)}
						>
							<img src="/images/stats/stats_img_1.jpg" alt="" />
							<div className={styles.overlay}>
								<p className="mono">Things we&apos;ve drawn</p>
								<h4>340+</h4>
							</div>
						</article>

						<article
							className={`${styles.card} ${styles.cardLight}`}
							ref={setCardRef(1)}
						>
							<h4>60+</h4>
							<p className={`mono ${styles.meta}`}>
								Brands we&apos;ve drawn for
							</p>
						</article>

						<article
							className={`${styles.card} ${styles.cardAccent}`}
							ref={setCardRef(2)}
						>
							<p className="mono">Eyeballs reached</p>
							<h3>250M+</h3>
						</article>
					</div>

					<div className={`${styles.col} ${styles.colRight}`}>
						<article
							className={`${styles.card} ${styles.cardTall}`}
							ref={setCardRef(3)}
						>
							<img src="/images/stats/stats_img_2.jpg" alt="" />
							<div className={styles.overlay}>
								<p className="mono">On the table right now</p>
								<h3>14</h3>
							</div>
						</article>

						<article
							className={`${styles.card} ${styles.cardDark}`}
							ref={setCardRef(4)}
						>
							<h6>Friends of the studio</h6>
							<ul className={styles.list}>
								{PARTNERS.map((name) => (
									<li key={name}>
										<p className="mono sm">{name}</p>
									</li>
								))}
							</ul>
						</article>
					</div>
				</div>
			</div>

			<SectionFooter left="Counted twice" right="Give or take" />
		</section>
	);
}
