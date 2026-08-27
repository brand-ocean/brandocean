import { createFileRoute } from "@tanstack/react-router";
import Callout from "@/site/components/Callout/Callout";
import CareersList from "@/site/components/CareersList/CareersList";
import Copy from "@/site/components/Copy/Copy";
import SectionFooter from "@/site/components/SectionFooter/SectionFooter";
import Testimonials from "@/site/components/Testimonials/Testimonials";
import styles from "@/site/pages/careers.module.css";

export const Route = createFileRoute("/_site/careers")({
	component: CareersPage,
});

function CareersPage() {
	return (
		<main className={styles.page}>
			<section className={styles.hero}>
				<Copy animateOnScroll={false} delay={1.125}>
					<h1>
						Pitch Yourself
						<Callout
							className={styles.callout}
							label="Kom maar op"
							rotation={-10}
							top="0.25em"
							left="0em"
							variant={2}
						/>
					</h1>
				</Copy>

				<div className={styles.sectionFooter}>
					<SectionFooter
						left={
							<Copy variant="scramble" animateOnScroll={false} delay={1.25}>
								<span>Open sollicitatie</span>
							</Copy>
						}
						right={
							<Copy variant="scramble" animateOnScroll={false} delay={1.25}>
								<span>Altijd welkom</span>
							</Copy>
						}
					/>
				</div>
			</section>

			<CareersList />

			<Testimonials />
		</main>
	);
}
