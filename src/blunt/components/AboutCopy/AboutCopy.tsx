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
			<SectionNav left="First Things First" right="The Origin" />

			<div className={`container pad ${styles.inner}`}>
				<Copy>
					<h5 className={styles.headline}>
						We Turn Wild Ideas Into Art That Refuses To Sit Still Or Shut Up.
						<Callout
							className={styles.callout}
							label="We mean it"
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
								We started in a cramped room with too many markers and no
								clients. Not much has changed except the room. Blunt still runs
								on the same rule: if an idea doesn&apos;t make us laugh or
								flinch, it goes in the bin.
							</p>
						</Copy>
						<Copy>
							<p className={`mono ${styles.link}`}>
								<TransitionLink href="/work">
									Into The Work{" "}
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

			<SectionFooter left="There's More" right="Onward" />
		</section>
	);
}
