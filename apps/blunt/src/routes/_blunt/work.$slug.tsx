import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import CaseBlocks from "@/blunt/components/CaseBlocks/CaseBlocks";
import Copy from "@/blunt/components/Copy/Copy";
import TransitionLink from "@/blunt/components/TransitionLink";
import styles from "@/blunt/pages/case.module.css";
import {
	type CaseItem,
	hostnameOf,
	itemClient,
	itemYear,
} from "@/blunt/utils/portfolio";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/_blunt/work/$slug")({
	component: CasePage,
});

function CasePage() {
	const { slug } = Route.useParams();
	const item = useQuery(api.portfolio.getBySlug, { slug });
	const all = useQuery(api.portfolio.listPublic, {});

	// `undefined` is still loading, `null` is a slug that doesn't exist.
	if (item === undefined) return <main className={styles.page} />;
	if (item === null) return <CaseNotFound />;

	const next = nextItem(all, item);

	return (
		<main className={styles.page}>
			<CaseHero item={item} />
			{item.summary ? (
				<section className={styles.info}>
					<div className={`container ${styles.infoInner}`}>
						<div className={styles.col}>
							<Copy>
								<h3>Samenvatting</h3>
							</Copy>
						</div>
						<div className={styles.col}>
							<Copy stagger={0.04}>
								<p>{item.summary}</p>
							</Copy>
						</div>
					</div>
				</section>
			) : null}

			<CaseBlocks blocks={item.blocks ?? []} />

			{next ? <NextCase next={next} /> : null}
		</main>
	);
}

function nextItem(
	all: CaseItem[] | undefined,
	item: CaseItem,
): CaseItem | undefined {
	if (!all || all.length < 2) return undefined;
	const index = all.findIndex((candidate) => candidate._id === item._id);
	if (index < 0) return undefined;
	return all[(index + 1) % all.length];
}

function CaseHero({ item }: { item: CaseItem }) {
	const year = itemYear(item);
	const client = itemClient(item);
	const site = hostnameOf(item.externalUrl);

	return (
		<section className={styles.hero}>
			<div className={styles.col}>
				<div className={styles.heroImg}>
					<div className={styles.heroImgWrapper}>
						{item.heroImageUrl ? (
							<img src={item.heroImageUrl} alt={item.title} />
						) : null}
					</div>
				</div>
			</div>

			<div className={styles.col}>
				<div className={`container ${styles.heroContent}`}>
					<div className={styles.pageTitle}>
						<Copy animateOnScroll={false} delay={1.125}>
							<h3>{item.title}</h3>
						</Copy>
					</div>

					<div className={styles.row}>
						<div className={styles.subCol}>
							<Copy animateOnScroll={false} delay={1.25}>
								<p className="mono sm">Klant</p>
							</Copy>
							<Copy animateOnScroll={false} delay={1.3}>
								<p className="lg">{client || item.title}</p>
							</Copy>
						</div>
						<div className={styles.subCol}>
							<Copy animateOnScroll={false} delay={1.25}>
								<p className="mono sm">Wat we deden</p>
							</Copy>
							<Copy animateOnScroll={false} delay={1.3}>
								<p className="lg">{item.category}</p>
							</Copy>
						</div>
					</div>

					<div className={styles.row}>
						<div className={styles.subCol}>
							<Copy animateOnScroll={false} delay={1.25}>
								<p className="mono sm">Jaar</p>
							</Copy>
							<Copy animateOnScroll={false} delay={1.3}>
								<p className="lg">{year ?? "—"}</p>
							</Copy>
						</div>
						<div className={styles.subCol}>
							{site ? (
								<>
									<Copy animateOnScroll={false} delay={1.25}>
										<p className="mono sm">Online</p>
									</Copy>
									<Copy animateOnScroll={false} delay={1.3}>
										<p className="lg">
											<a
												href={item.externalUrl}
												target="_blank"
												rel="noopener noreferrer"
											>
												{site}
											</a>
										</p>
									</Copy>
								</>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function NextCase({ next }: { next: CaseItem }) {
	return (
		<TransitionLink
			href="/work/$slug"
			params={{ slug: next.slug }}
			className={styles.nextProject}
		>
			<div className={styles.nextInner}>
				<div>
					<p className="mono sm">Volgende project</p>
					<h3>{next.title}</h3>
				</div>
				<p className="mono sm">{next.category}</p>
			</div>
		</TransitionLink>
	);
}

function CaseNotFound() {
	return (
		<main className={styles.page}>
			<section className={styles.quote}>
				<div className={styles.quoteInner}>
					<h3>Dit project bestaat niet (meer)</h3>
					<p className={`mono sm ${styles.attribution}`}>
						<TransitionLink href="/work">Terug naar het werk</TransitionLink>
					</p>
				</div>
			</section>
		</main>
	);
}
