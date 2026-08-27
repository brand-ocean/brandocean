import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { type CaseItem, itemYear } from "@/site/utils/portfolio";
import TransitionLink from "../TransitionLink";
import styles from "./Projects.module.css";

const PROJECTS_PER_ROW = 9;
const TOTAL_ROWS = 10;
const MOBILE_BREAKPOINT = 1000;

/** The grid keeps its shape while the placeholders fill in from Convex. */
const FALLBACK_IMAGE = "/images/projects/project_img_1.jpg";

interface Project {
	name: string;
	year?: number;
	img: string;
	slug: string;
}

function toProject(item: CaseItem): Project {
	return {
		name: item.title,
		year: itemYear(item),
		img: item.heroImageUrl ?? FALLBACK_IMAGE,
		slug: item.slug,
	};
}

function ProjectCard({ project }: { project: Project }) {
	return (
		<TransitionLink
			href="/work/$slug"
			params={{ slug: project.slug }}
			className={styles.project}
		>
			<div className={styles.image}>
				<img src={project.img} alt={project.name} />
			</div>
			<div className={styles.info}>
				<p className="mono sm">{project.name}</p>
				<p className="mono sm">{project.year ?? ""}</p>
			</div>
		</TransitionLink>
	);
}

export default function Projects({ items }: { items: CaseItem[] }) {
	const projects = items.map(toProject);
	const sectionRef = useRef<HTMLElement>(null);
	const rowsRef = useRef<(HTMLDivElement | null)[]>([]);
	const rowStartWidth = useRef(125);
	const rowEndWidth = useRef(500);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const updateMode = () => {
			setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
		};

		updateMode();
		window.addEventListener("resize", updateMode);
		return () => window.removeEventListener("resize", updateMode);
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `projects.length` isn't read in the body, but the rows it renders only exist once the items load — the measurement has to re-run then.
	useEffect(() => {
		if (isMobile) return;

		const section = sectionRef.current;
		if (!section) return;

		const rows = rowsRef.current.filter((el): el is HTMLDivElement =>
			Boolean(el),
		);
		const firstRow = rows[0];
		if (!firstRow) return;

		rowStartWidth.current = 125;
		rowEndWidth.current = 500;

		firstRow.style.width = `${rowEndWidth.current}%`;
		const expandedRowHeight = firstRow.offsetHeight;
		firstRow.style.width = "";

		const sectionGap = Number.parseFloat(getComputedStyle(section).gap) || 0;
		const sectionPadding =
			Number.parseFloat(getComputedStyle(section).paddingTop) || 0;

		const expandedSectionHeight =
			expandedRowHeight * rows.length +
			sectionGap * (rows.length - 1) +
			sectionPadding * 2;

		section.style.height = `${expandedSectionHeight}px`;

		function onScrollUpdate() {
			const scrollY = window.scrollY;
			const viewportHeight = window.innerHeight;

			rows.forEach((row) => {
				if (!row) return;

				const rect = row.getBoundingClientRect();
				const rowTop = rect.top + scrollY;
				const rowBottom = rowTop + rect.height;

				const scrollStart = rowTop - viewportHeight;
				const scrollEnd = rowBottom;

				let progress = (scrollY - scrollStart) / (scrollEnd - scrollStart);
				progress = Math.max(0, Math.min(1, progress));

				const width =
					rowStartWidth.current +
					(rowEndWidth.current - rowStartWidth.current) * progress;
				row.style.width = `${width}%`;
			});
		}

		gsap.ticker.add(onScrollUpdate);

		const handleResize = () => {
			if (window.innerWidth < MOBILE_BREAKPOINT) return;

			firstRow.style.width = `${rowEndWidth.current}%`;
			const newRowHeight = firstRow.offsetHeight;
			firstRow.style.width = "";

			const newSectionHeight =
				newRowHeight * rows.length +
				sectionGap * (rows.length - 1) +
				sectionPadding * 2;

			section.style.height = `${newSectionHeight}px`;
		};

		window.addEventListener("resize", handleResize);

		return () => {
			gsap.ticker.remove(onScrollUpdate);
			window.removeEventListener("resize", handleResize);
			section.style.height = "";
			rows.forEach((row) => {
				if (row) row.style.width = "";
			});
		};
		// `projects.length` matters: the rows only exist once the items have
		// loaded, so the height measurement has to run again after they arrive.
	}, [isMobile, projects.length]);

	if (projects.length === 0) {
		return <section className={styles.projects} />;
	}

	const rowsData: Project[][] = [];
	let currentProjectIndex = 0;

	for (let r = 0; r < TOTAL_ROWS; r++) {
		const row: Project[] = [];
		for (let c = 0; c < PROJECTS_PER_ROW; c++) {
			row.push(projects[currentProjectIndex % projects.length]);
			currentProjectIndex++;
		}
		rowsData.push(row);
	}

	if (isMobile) {
		return (
			<section className={`${styles.projects} ${styles.projectsMobile}`}>
				{projects.map((project) => (
					<ProjectCard key={project.slug} project={project} />
				))}
			</section>
		);
	}

	return (
		<section ref={sectionRef} className={styles.projects}>
			{rowsData.map((rowProjects, rowIndex) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed grid of repeated rows
					key={rowIndex}
					className={styles.row}
					ref={(el) => {
						if (el) rowsRef.current[rowIndex] = el;
					}}
				>
					{rowProjects.map((project, colIndex) => (
						<ProjectCard
							key={`${rowIndex}-${colIndex}-${project.name}`}
							project={project}
						/>
					))}
				</div>
			))}
		</section>
	);
}
