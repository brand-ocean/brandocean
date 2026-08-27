import { createFileRoute } from "@tanstack/react-router";
import Callout from "@/site/components/Callout/Callout";
import Copy from "@/site/components/Copy/Copy";
import ExpertiseCards from "@/site/components/ExpertiseCards/ExpertiseCards";
import ExpertiseServices from "@/site/components/ExpertiseServices/ExpertiseServices";
import SectionFooter from "@/site/components/SectionFooter/SectionFooter";
import styles from "@/site/pages/expertise.module.css";

export const Route = createFileRoute("/_site/expertise")({
	component: ExpertisePage,
});

function ExpertisePage() {
	return (
		<main className={styles.page}>
			<section className={styles.hero}>
				<Copy animateOnScroll={false} delay={1.125}>
					<h1>
						What We Actually Do
						<Callout
							className={styles.callout}
							label="Kijk mee"
							rotation={20}
							variant={3}
							top="0em"
							right="0.25em"
						/>
					</h1>
				</Copy>

				<div className={styles.sectionFooter}>
					<SectionFooter
						left={
							<Copy variant="scramble" animateOnScroll={false} delay={1.25}>
								<span>Het vakgebied</span>
							</Copy>
						}
						right={
							<Copy variant="scramble" animateOnScroll={false} delay={1.25}>
								<span>Kies maar</span>
							</Copy>
						}
					/>
				</div>
			</section>

			<ExpertiseCards />

			<ExpertiseServices />
		</main>
	);
}
