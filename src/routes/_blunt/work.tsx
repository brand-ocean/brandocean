import { createFileRoute } from "@tanstack/react-router";
import Callout from "@/blunt/components/Callout/Callout";
import Copy from "@/blunt/components/Copy/Copy";
import Projects from "@/blunt/components/Projects/Projects";
import SectionFooter from "@/blunt/components/SectionFooter/SectionFooter";
import SectionNav from "@/blunt/components/SectionNav/SectionNav";
import styles from "@/blunt/pages/work.module.css";

export const Route = createFileRoute("/_blunt/work")({
	component: WorkPage,
});

function WorkPage() {
	return (
		<main className={styles.page}>
			<section className={styles.intro}>
				<Copy animateOnScroll={false} delay={1.125}>
					<h1>
						Drawn Out Loud
						<Callout
							className={styles.callout}
							label="Eyes open"
							rotation={-20}
							top="0em"
							left="0.3em"
							variant={2}
						/>
					</h1>
				</Copy>

				<div className={styles.sectionFooter}>
					<SectionFooter
						left={
							<Copy variant="scramble" animateOnScroll={false} delay={1.25}>
								<span>Roll The Reel</span>
							</Copy>
						}
						right={
							<Copy variant="scramble" animateOnScroll={false} delay={1.25}>
								<span>2017 Onward</span>
							</Copy>
						}
					/>
				</div>
			</section>

			<Projects />

			<section className={styles.outro}>
				<div className={styles.sectionNav}>
					<SectionNav left="Still Cooking" right="All Work" />
				</div>

				<h1>
					The Rest Is Still Drying
					<Callout
						className={styles.callout}
						label="Coming soon"
						variant={3}
						rotation={15}
						top="0.7em"
						right="0.75em"
					/>
				</h1>

				<div className={styles.sectionFooter}>
					<SectionFooter left="Don't Blink" right="Check Back Soon" />
				</div>
			</section>
		</main>
	);
}
