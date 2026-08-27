import Callout from "../Callout/Callout";
import SectionFooter from "../SectionFooter/SectionFooter";
import SectionNav from "../SectionNav/SectionNav";
import styles from "./Landing.module.css";

/**
 * De coming-soon landing op `/`. Bewust één scherm: de Preloader speelt af,
 * hier staat waarom de site er nog niet is, en de Footer eronder doet de rest.
 */
export default function Landing() {
	return (
		<section className={styles.landing}>
			<SectionNav left="Brandocean" right="Amsterdam · Sinds 2005" />

			<div className={`container pad ${styles.inner}`}>
				<div className={styles.headlineWrap}>
					<h1 className={styles.headline}>Binnenkort</h1>

					<Callout
						className={styles.callout}
						label="Echt waar"
						variant={2}
						rotation={-12}
						top="0.05em"
						left="-0.12em"
					/>
					<Callout
						className={styles.callout}
						label="Bijna"
						variant={4}
						rotation={14}
						bottom="-0.1em"
						right="-0.15em"
					/>
				</div>

				<div className={styles.copy}>
					<p className={styles.lead}>
						We bouwen aan een nieuwe site. Het werk, de expertise en de rest
						komen er zo aan.
					</p>
					<p className={styles.lead}>
						Heb je iets te bouwen? Bel of mail gewoon, dan praten we.
					</p>
				</div>

				<div className={`mono sm ${styles.contact}`}>
					<a className={styles.link} href="mailto:info@brandocean.nl">
						info@brandocean.nl
					</a>
					<a className={styles.link} href="tel:+31641324721">
						06 4132 4721
					</a>
				</div>
			</div>

			<SectionFooter
				left="In aanbouw"
				right={
					<span className={styles.scrollHint}>
						Meer hieronder
						<span className={styles.arrow} aria-hidden="true">
							↓
						</span>
					</span>
				}
			/>
		</section>
	);
}
