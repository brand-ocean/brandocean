import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { useRef } from "react";
import styles from "./ExpertiseCards.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const EXPERTISE = [
	{
		tagline: "Van losse sheets naar één werkende applicatie",
		title: "Apps & Platforms",
		description:
			"Dashboards, CRM's, portals en planningssystemen die het werk overnemen dat nu met de hand gaat. Inclusief de integraties eromheen, want half opleveren heeft geen zin.",
		image: "/images/expertise/expertise_card_1.jpg",
		color: "var(--base-300)",
	},
	{
		tagline: "Webshops die het ook op zaterdagavond doen",
		title: "E-commerce",
		description:
			"Shopify-themes en custom webshops, van productpagina tot checkout. Snel, meetbaar en gebouwd om te verkopen, niet om mooi te staan in een pitchdeck.",
		image: "/images/expertise/expertise_card_2.jpg",
		color: "var(--base-500)",
	},
	{
		tagline: "AI die voorstelt, jij beslist",
		title: "AI & Automation",
		description:
			"Mail die zichzelf verrijkt en categoriseert, assistenten die je team in eigen taal antwoord geven, patronen die je vooraf ziet in plaats van achteraf. Altijd met jou aan de knop.",
		image: "/images/expertise/expertise_card_3.jpg",
		color: "var(--base-700)",
	},
	{
		tagline: "Een merk dat klopt tot in de kleinste knop",
		title: "Branding & Sites",
		description:
			"Identiteit, marketingsites en animatie die bij elkaar horen omdat ze door dezelfde handen gaan. Van eerste schets tot livegang, zonder dat er onderweg iets uit elkaar valt.",
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
