import Copy from "@/blunt/components/Copy/Copy";
import styles from "@/blunt/pages/case.module.css";
import type {
	PortfolioBlock,
	PortfolioMedia,
} from "~convex/lib/portfolioBlocks";

/**
 * Renders the CMS block list as case-study sections. One branch per block kind
 * in `convex/lib/portfolioBlocks` — the union means adding a kind there fails to
 * compile here until it's handled.
 */
export default function CaseBlocks({ blocks }: { blocks: PortfolioBlock[] }) {
	return (
		<>
			{blocks.map((block, index) => (
				<CaseBlock
					// biome-ignore lint/suspicious/noArrayIndexKey: ordered block list with no stable id
					key={index}
					block={block}
					isLast={index === blocks.length - 1}
				/>
			))}
		</>
	);
}

function CaseBlock({
	block,
	isLast,
}: {
	block: PortfolioBlock;
	isLast: boolean;
}) {
	switch (block.kind) {
		case "text":
			return (
				<section className={sectionClass(styles.info, isLast)}>
					<div className={`container ${styles.infoInner}`}>
						<div className={styles.col}>
							{block.heading ? (
								<Copy>
									<h3>{block.heading}</h3>
								</Copy>
							) : null}
						</div>
						<div className={styles.col}>
							<Copy stagger={0.04}>
								{block.paragraphs
									.filter((p) => p.trim().length > 0)
									.map((paragraph) => (
										<p key={paragraph.slice(0, 48)}>{paragraph}</p>
									))}
							</Copy>
						</div>
					</div>
				</section>
			);

		case "image":
			if (block.layout === "full") {
				return (
					<section className={styles.preview}>
						<div className={styles.previewWrapper}>
							<MediaImage media={block.media} />
						</div>
					</section>
				);
			}
			return (
				<section className={sectionClass(styles.info, isLast)}>
					<div className={`container ${styles.infoInner}`}>
						<div className={styles.col} />
						<div className={styles.col}>
							<div className={styles.infoImg}>
								<div className={styles.infoImgWrapper}>
									<MediaImage media={block.media} />
								</div>
							</div>
							{block.caption ? (
								<Copy>
									<p className={`mono sm ${styles.caption}`}>{block.caption}</p>
								</Copy>
							) : null}
						</div>
					</div>
				</section>
			);

		case "gallery":
			return (
				<section className={sectionClass(styles.info, isLast)}>
					<div className={`container ${styles.infoInner}`}>
						<div className={styles.col}>
							{block.heading ? (
								<Copy>
									<h3>{block.heading}</h3>
								</Copy>
							) : null}
						</div>
						<div className={styles.col}>
							<div className={styles.gallery}>
								{block.items.map((media, i) => (
									<div
										key={media.storageId ?? media.url ?? i}
										className={styles.galleryItem}
									>
										<MediaImage media={media} />
									</div>
								))}
							</div>
						</div>
					</div>
				</section>
			);

		case "stats":
			return (
				<section className={sectionClass(styles.info, isLast)}>
					<div className={`container ${styles.infoInner}`}>
						<div className={styles.col}>
							{block.heading ? (
								<Copy>
									<h3>{block.heading}</h3>
								</Copy>
							) : null}
						</div>
						<div className={styles.col}>
							{block.stats.map((stat) => (
								<div
									key={`${stat.value}-${stat.label}`}
									className={styles.stat}
								>
									<Copy>
										<h1>{stat.value}</h1>
									</Copy>
									<Copy>
										<p className="mono sm">{stat.label}</p>
									</Copy>
								</div>
							))}
						</div>
					</div>
				</section>
			);

		case "quote":
			return (
				<section className={styles.quote}>
					<div className={styles.quoteInner}>
						<Copy>
							<h3>“{block.quote}”</h3>
						</Copy>
						{block.attribution ? (
							<Copy variant="scramble">
								<p className={`mono sm ${styles.attribution}`}>
									{block.attribution}
								</p>
							</Copy>
						) : null}
					</div>
				</section>
			);

		case "livePreview":
			return (
				<section className={sectionClass(styles.info, isLast)}>
					<div className={`container ${styles.infoInner}`}>
						<div className={styles.col}>
							{block.heading ? (
								<Copy>
									<h3>{block.heading}</h3>
								</Copy>
							) : null}
						</div>
						<div className={styles.col}>
							<div className={styles.livePreviewFrame}>
								<iframe
									src={block.url}
									title={block.heading ?? "Live preview"}
									loading="lazy"
									sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
									referrerPolicy="no-referrer"
								/>
							</div>
						</div>
					</div>
				</section>
			);
	}
}

function sectionClass(base: string, isLast: boolean) {
	return isLast ? `${base} ${styles.blocksEnd}` : base;
}

function MediaImage({ media }: { media: PortfolioMedia }) {
	if (!media.url) return null;
	return <img src={media.url} alt={media.alt ?? ""} />;
}
