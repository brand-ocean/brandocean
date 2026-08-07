import { createFileRoute } from "@tanstack/react-router";
import Callout from "@/blunt/components/Callout/Callout";
import ContactCards from "@/blunt/components/ContactCards/ContactCards";
import Copy from "@/blunt/components/Copy/Copy";
import SectionFooter from "@/blunt/components/SectionFooter/SectionFooter";
import styles from "@/blunt/pages/contact.module.css";

export const Route = createFileRoute("/_blunt/contact")({
	component: ContactPage,
});

function ContactPage() {
	return (
		<main className={styles.page}>
			<section className={styles.hero}>
				<Copy animateOnScroll={false} delay={1.125}>
					<h1>
						Just Say Something
						<Callout
							className={styles.callout}
							label="Kom langs"
							rotation={12}
							top="0.25em"
							right="0.5em"
							variant={1}
						/>
					</h1>
				</Copy>

				<div className={styles.sectionFooter}>
					<SectionFooter
						left={
							<Copy variant="scramble" animateOnScroll={false} delay={1.25}>
								<span>Draai de kaarten</span>
							</Copy>
						}
						right={
							<Copy variant="scramble" animateOnScroll={false} delay={1.25}>
								<span>Zeg hallo</span>
							</Copy>
						}
					/>
				</div>
			</section>

			<ContactCards />
		</main>
	);
}
