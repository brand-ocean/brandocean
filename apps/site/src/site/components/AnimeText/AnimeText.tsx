import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { useRef } from "react";
import SectionFooter from "../SectionFooter/SectionFooter";
import SectionNav from "../SectionNav/SectionNav";
import styles from "./AnimeText.module.css";

// GSAP's ticker schiet een requestAnimationFrame in zodra een plugin zich
// registreert, en workerd verbiedt timers op module-scope — dat liet de
// SSR-boundary knappen. Registreren hoeft alleen in de browser.
if (typeof window !== "undefined") {
	gsap.registerPlugin(ScrollTrigger, useGSAP);
}

const PARAGRAPHS = [
	"Je bedrijf draait op sheets, mail en losse tools. Elke dag typt iemand iets over, controleert iemand iets na, stuurt iemand iets door. Dat werk hoort niet bij mensen. Dat hoort bij software. Maar een eigen developer kost meer dan je omzet toelaat, en een bureau levert op en verdwijnt.",
	"Wij zijn Brandocean. Wij bouwen elke maand verder aan jouw bedrijf. Geen project met een einddatum, maar een vaste afdeling voor een vast bedrag. Apps, webshops, AI en automatisering die het handwerk overnemen, terwijl jij aan de knop blijft. Wat we bouwen maken we af. Het werkt pas als het op zaterdagavond ook werkt.",
];

// Welk keyword welke pil krijgt. De v1-groepen, omgezet naar het sitepalet.
const KEYWORD_COLORS: Record<string, string> = {
	sheets: styles.kwBlue,
	software: styles.kwBlue,
	developer: styles.kwBlue,
	brandocean: styles.kwCoral,
	maand: styles.kwCoral,
	afdeling: styles.kwCoral,
	handwerk: styles.kwYellow,
	knop: styles.kwYellow,
	zaterdagavond: styles.kwYellow,
};

// Hoeveel woorden tegelijk in de reveal zitten — hoger is een tragere,
// meer overlappende golf.
const OVERLAP_WORDS = 15;

function normalize(word: string) {
	return word.toLowerCase().replace(/[.,!?;:"]/g, "");
}

export default function AnimeText() {
	const sectionRef = useRef<HTMLElement>(null);
	const copyRef = useRef<HTMLDivElement>(null);

	useLenis(() => {
		ScrollTrigger.update();
	});

	useGSAP(
		() => {
			const copy = copyRef.current;
			const section = sectionRef.current;
			if (!copy || !section) return;

			if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

			const words = Array.from(
				copy.querySelectorAll<HTMLElement>(`.${styles.word}`),
			);
			const total = words.length;
			if (!total) return;

			// De laatste woorden mogen niet buiten de tijdlijn vallen, dus de hele
			// as wordt teruggeschaald met de overlap erbij.
			const timelineScale =
				1 /
				Math.min(
					1 + OVERLAP_WORDS / total,
					1 + (total - 1) / total + OVERLAP_WORDS / total,
				);

			const trigger = ScrollTrigger.create({
				trigger: section,
				start: "top 25%",
				end: "bottom bottom",
				onUpdate: (self) => {
					const progress = self.progress;

					words.forEach((word, index) => {
						const text = word.firstElementChild as HTMLElement | null;
						if (!text) return;

						const start = (index / total) * timelineScale;
						const end = (index / total + OVERLAP_WORDS / total) * timelineScale;

						const wordProgress =
							progress <= start
								? 0
								: progress >= end
									? 1
									: (progress - start) / (end - start);

						word.style.opacity = String(wordProgress);

						// Het blokje dooft in de laatste 10% uit, zodat de tekst
						// eronder tevoorschijn komt in plaats van eroverheen.
						const fade = wordProgress >= 0.9 ? (wordProgress - 0.9) / 0.1 : 0;
						const blockOpacity = Math.max(0, 1 - fade);
						word.style.backgroundColor = blockOpacity
							? `rgba(var(--anime-word-rgb), ${blockOpacity * 0.3})`
							: "transparent";

						text.style.opacity =
							wordProgress >= 1
								? "1"
								: wordProgress >= 0.5
									? String((wordProgress - 0.5) * 2)
									: "0";
					});
				},
			});

			return () => {
				trigger.kill();
			};
		},
		{ scope: sectionRef },
	);

	return (
		<section ref={sectionRef} className={styles.animeText}>
			<SectionNav left="Studio No. 01" right="Amsterdam / Sinds 2005" />

			<div className={`container pad ${styles.inner}`}>
				<div ref={copyRef} className={styles.copy}>
					{PARAGRAPHS.map((paragraph) => (
						<p key={paragraph.slice(0, 24)} className={styles.paragraph}>
							{paragraph.split(/\s+/).map((word, index) => {
								const color = KEYWORD_COLORS[normalize(word)];

								return (
									<span
										// biome-ignore lint/suspicious/noArrayIndexKey: woordvolgorde is de identiteit
										key={index}
										className={styles.word}
									>
										<span
											className={
												color
													? `${styles.wordText} ${styles.keyword} ${color}`
													: styles.wordText
											}
										>
											{word}
										</span>
									</span>
								);
							})}
						</p>
					))}
				</div>
			</div>

			<SectionFooter left="Altijd bereikbaar" right="Meer hieronder" />
		</section>
	);
}
