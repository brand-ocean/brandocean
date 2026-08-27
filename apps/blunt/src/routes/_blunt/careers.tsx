import { createFileRoute } from "@tanstack/react-router";
import Callout from "@/blunt/components/Callout/Callout";
import CareersList from "@/blunt/components/CareersList/CareersList";
import Copy from "@/blunt/components/Copy/Copy";
import SectionFooter from "@/blunt/components/SectionFooter/SectionFooter";
import Testimonials from "@/blunt/components/Testimonials/Testimonials";
import styles from "@/blunt/pages/careers.module.css";

export const Route = createFileRoute("/_blunt/careers")({
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
