import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import Callout from "@/site/components/Callout/Callout";
import Copy from "@/site/components/Copy/Copy";
import Projects from "@/site/components/Projects/Projects";
import SectionFooter from "@/site/components/SectionFooter/SectionFooter";
import SectionNav from "@/site/components/SectionNav/SectionNav";
import styles from "@/site/pages/work.module.css";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/_site/work/")({
	component: WorkPage,
});

function WorkPage() {
	const items = useQuery(api.portfolio.listPublic, {});

	return (
		<main className={styles.page}>
			<section className={styles.intro}>
				<Copy animateOnScroll={false} delay={1.125}>
					<h1>
						Work That Ships
						<Callout
							className={styles.callout}
							label="Ogen open"
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
								<span>Scroll maar</span>
							</Copy>
						}
						right={
							<Copy variant="scramble" animateOnScroll={false} delay={1.25}>
								<span>Sinds 2005</span>
							</Copy>
						}
					/>
				</div>
			</section>

			<Projects items={items ?? []} />

			<section className={styles.outro}>
				<div className={styles.sectionNav}>
					<SectionNav left="Nog in de maak" right="Al het werk" />
				</div>

				<h1>
					The Rest Is Under NDA
					<Callout
						className={styles.callout}
						label="Volgt nog"
						variant={3}
						rotation={15}
						top="0.7em"
						right="0.75em"
					/>
				</h1>

				<div className={styles.sectionFooter}>
					<SectionFooter left="Niet knipperen" right="Kom snel terug" />
				</div>
			</section>
		</main>
	);
}
