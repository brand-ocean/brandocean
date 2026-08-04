import { createFileRoute } from "@tanstack/react-router";
import Copy from "@/blunt/components/Copy/Copy";
import styles from "@/blunt/pages/sample-project.module.css";

export const Route = createFileRoute("/_blunt/sample-project")({
	component: SampleProjectPage,
});

function SampleProjectPage() {
	return (
		<main className={styles.page}>
			<section className={styles.hero}>
				<div className={styles.col}>
					<div className={styles.heroImg}>
						<div className={styles.heroImgWrapper}>
							<img
								src="/images/sample-project/sample_hero.jpg"
								alt="Ghost Signal"
							/>
						</div>
					</div>
				</div>

				<div className={styles.col}>
					<div className={`container ${styles.heroContent}`}>
						<div className={styles.pageTitle}>
							<Copy animateOnScroll={false} delay={1.125}>
								<h3>Ghost Signal</h3>
							</Copy>
						</div>

						<div className={styles.row}>
							<div className={styles.subCol}>
								<Copy animateOnScroll={false} delay={1.25}>
									<p className="mono sm">Client</p>
								</Copy>
								<Copy animateOnScroll={false} delay={1.3}>
									<p className="lg">Nightwave</p>
								</Copy>
							</div>
							<div className={styles.subCol}>
								<Copy animateOnScroll={false} delay={1.25}>
									<p className="mono sm">Services</p>
								</Copy>
								<Copy animateOnScroll={false} delay={1.3}>
									<p className="lg">Characters · Animation</p>
								</Copy>
							</div>
						</div>

						<div className={styles.row}>
							<div className={styles.subCol} />
							<div className={styles.subCol}>
								<Copy animateOnScroll={false} delay={1.4}>
									<p>
										A cast of characters and animated bumpers built for a
										late-night channel that needed more personality than polish.
									</p>
								</Copy>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className={styles.info}>
				<div className={`container ${styles.infoInner}`}>
					<div className={styles.col}>
						<Copy>
							<h3>Summary</h3>
						</Copy>
					</div>
					<div className={styles.col}>
						<Copy stagger={0.04}>
							<p>
								Nightwave came to us with a channel that looked fine and felt
								forgettable. Ghost Signal was the answer: a loud little universe
								of characters, bumpers, and interstitial moments that made the
								overnight block feel like its own place.
							</p>
							<p>
								We designed a cast first, then built the motion language around
								them. Quick loops, weird transitions, and short animated hits
								that could live between programs without needing a full
								narrative every time. The goal was simple: if someone tuned in
								at 1am, they should know exactly where they were.
							</p>
							<p>
								The package rolled out across on-air bumpers, social cutdowns,
								and a reusable motion kit the internal team could keep remixing.
								Ghost Signal became less of a campaign and more of a recurring
								personality for the channel.
							</p>
						</Copy>
					</div>
				</div>
			</section>

			<section className={styles.info}>
				<div className={`container ${styles.infoInner}`}>
					<div className={styles.col} />
					<div className={styles.col}>
						<div className={styles.infoImg}>
							<div className={styles.infoImgWrapper}>
								<img
									src="/images/sample-project/sample_still.jpg"
									alt="Ghost Signal still"
								/>
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className={styles.info}>
				<div className={`container ${styles.infoInner}`}>
					<div className={styles.col}>
						<Copy>
							<h3>Strategy</h3>
						</Copy>
					</div>
					<div className={styles.col}>
						<Copy>
							<p>
								We started with character before channel chrome. Each figure got
								a clear attitude, a limited color set, and a motion personality
								that could survive a three-second bumper. From there we mapped
								where the cast should appear: opens, closes, social teasers, and
								the weird in-between moments that usually get filler. The
								strategy was to make those scraps feel intentional, then give
								Nightwave a kit flexible enough to keep the signal going after
								launch.
							</p>
						</Copy>
					</div>
				</div>
			</section>

			<section className={styles.info}>
				<div className={`container ${styles.infoInner}`}>
					<div className={styles.col}>
						<Copy>
							<h3>Campaign Performance</h3>
						</Copy>
					</div>
					<div className={styles.col}>
						<div className={styles.stat}>
							<Copy>
								<h1>84.2K</h1>
							</Copy>
							<Copy>
								<p className="mono sm">Bumper Plays</p>
							</Copy>
						</div>
						<div className={styles.stat}>
							<Copy>
								<h1>12</h1>
							</Copy>
							<Copy>
								<p className="mono sm">Characters Built</p>
							</Copy>
						</div>
						<div className={styles.stat}>
							<Copy>
								<h1>46</h1>
							</Copy>
							<Copy>
								<p className="mono sm">Animated Cuts</p>
							</Copy>
						</div>
						<div className={styles.stat}>
							<Copy>
								<h1>2.1x</h1>
							</Copy>
							<Copy>
								<p className="mono sm">Social Shares</p>
							</Copy>
						</div>
						<div className={styles.stat}>
							<Copy>
								<h1>31</h1>
							</Copy>
							<Copy>
								<p className="mono sm">On-Air Variants</p>
							</Copy>
						</div>
						<div className={styles.stat}>
							<Copy>
								<h1>6</h1>
							</Copy>
							<Copy>
								<p className="mono sm">Week Rollout</p>
							</Copy>
						</div>
					</div>
				</div>
			</section>

			<section className={styles.preview}>
				<div className={styles.previewWrapper}>
					<img
						src="/images/sample-project/sample_preview.jpg"
						alt="Ghost Signal preview"
					/>
				</div>
			</section>

			<section className={`${styles.info} ${styles.infoOutro}`}>
				<div className={`container ${styles.infoInner}`}>
					<div className={styles.col}>
						<Copy>
							<h3>Execution</h3>
						</Copy>
					</div>
					<div className={styles.col}>
						<Copy>
							<p>
								Execution lived in two layers: the characters themselves, then
								the systems that kept them moving. We illustrated the cast,
								built looping bumpers for the overnight block, and cut shorter
								versions for Instagram, TikTok, and channel promos. Every piece
								was made to work alone or as part of a sequence.
							</p>
							<p>
								Alongside the finished spots, we handed Nightwave a motion kit:
								timing guides, color rules, and reusable transitions, so the
								world could keep mutating without us babysitting every cut.
								Ghost Signal stayed loud, weird, and easy to extend, which was
								the whole point.
							</p>
						</Copy>
					</div>
				</div>
			</section>
		</main>
	);
}
