import { TiLocationArrow } from "react-icons/ti";
import Callout from "../Callout/Callout";
import Copy from "../Copy/Copy";
import SectionFooter from "../SectionFooter/SectionFooter";
import SectionNav from "../SectionNav/SectionNav";
import TransitionLink from "../TransitionLink";
import styles from "./AboutCopy.module.css";

export default function AboutCopy() {
	return (
		<section className={styles.aboutCopy}>
			<SectionNav left="Eerst even dit" right="Het begin" />

			<div className={`container pad ${styles.inner}`}>
				<Copy>
					<h5 className={styles.headline}>
						Wij bouwen elke maand verder aan jouw bedrijf.
						<Callout
							className={styles.callout}
							label="Beloofd"
							variant={4}
							rotation={12}
							top="0.65em"
							right="0.5em"
						/>
					</h5>
				</Copy>

				<div className={styles.row}>
					<div className={styles.copy}>
						<Copy>
							<p>
								Twintig jaar geleden begonnen met bouwen en daar nooit meer mee
								gestopt. Front-end, back-end, design, data en AI zitten
								inmiddels in één hoofd. Een bureau levert een project op en
								verdwijnt. Wij blijven. Voor een vast bedrag per maand zijn wij
								de digitale afdeling van jouw bedrijf, en elke maand staat er
								weer iets dat gisteren nog handwerk was.
							</p>
						</Copy>
						<Copy>
							<p className={`mono ${styles.link}`}>
								<TransitionLink href="/work">
									Naar het werk{" "}
									<TiLocationArrow
										className={styles.arrow}
										aria-hidden="true"
									/>
									<span className={styles.underline} aria-hidden="true" />
								</TransitionLink>
							</p>
						</Copy>
					</div>

					<div className={styles.media}>
						<img src="/images/about/about_copy.jpg" alt="" />
					</div>
				</div>
			</div>

			<SectionFooter left="Er is meer" right="Verder" />
		</section>
	);
}
