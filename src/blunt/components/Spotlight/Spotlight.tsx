import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLenis } from "lenis/react";
import { useRef } from "react";
import Callout from "../Callout/Callout";
import Copy from "../Copy/Copy";
import SectionFooter from "../SectionFooter/SectionFooter";
import SectionNav from "../SectionNav/SectionNav";
import styles from "./Spotlight.module.css";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const IMAGES = [
	"/images/spotlight/spotlight_img_1.jpg",
	"/images/spotlight/spotlight_img_2.jpg",
	"/images/spotlight/spotlight_img_3.jpg",
	"/images/spotlight/spotlight_img_4.jpg",
];

const FINAL_POSITIONS = [
	[-140, -140],
	[40, -130],
	[-160, 40],
	[20, 30],
];

const INITIAL_ROTATIONS = [5, -3, 3.5, -1];
const PHASE_ONE_STARTS = [0, 0.1, 0.2, 0.3];
const PHASE_TWO_STARTS = [0.5, 0.55, 0.6, 0.65];

function easeOutCubic(value: number) {
	return 1 - (1 - value) ** 3;
}

function getPhaseProgress(progress: number, start: number, end: number) {
	if (progress >= end) return 1;
	if (progress < start) return 0;
	return easeOutCubic((progress - start) / (end - start));
}

function getHiddenY(imageEl: HTMLElement, sectionEl: HTMLElement) {
	const imageHeight = imageEl.offsetHeight;
	const sectionHeight = sectionEl.offsetHeight;
	const buffer = imageHeight * 0.25;
	return ((sectionHeight / 2 + imageHeight + buffer) / imageHeight) * 100;
}

export default function Spotlight() {
	const sectionRef = useRef<HTMLElement>(null);
	const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

	useLenis(() => {
		ScrollTrigger.update();
	});

	useGSAP(
		() => {
			const section = sectionRef.current;
			const images = imageRefs.current.filter((el): el is HTMLDivElement =>
				Boolean(el),
			);
			if (!section || images.length === 0) return;

			const hiddenOffsets = images.map((image) => getHiddenY(image, section));

			images.forEach((image, index) => {
				gsap.set(image, {
					transform: `translate(-50%, ${hiddenOffsets[index]}%) rotate(${INITIAL_ROTATIONS[index]}deg)`,
				});
			});

			const scrollTrigger = ScrollTrigger.create({
				trigger: section,
				start: "top top",
				end: `+=${window.innerHeight * 6}`,
				pin: true,
				pinSpacing: true,
				scrub: 1,
				onUpdate: (self) => {
					const progress = self.progress;

					images.forEach((image, index) => {
						const initialRotation = INITIAL_ROTATIONS[index];
						const hiddenY = hiddenOffsets[index];
						const phase1Start = PHASE_ONE_STARTS[index];
						const phase1End = Math.min(
							phase1Start + (0.45 - phase1Start) * 0.9,
							0.45,
						);

						let x = -50;
						let y: number;
						let rotation: number;

						if (progress < phase1Start) {
							y = hiddenY;
							rotation = initialRotation;
						} else if (progress <= 0.45) {
							const phase1Progress = getPhaseProgress(
								progress,
								phase1Start,
								phase1End,
							);
							y = hiddenY - phase1Progress * (hiddenY + 50);
							rotation = initialRotation;
						} else {
							y = -50;
							rotation = initialRotation;
						}

						const phase2Start = PHASE_TWO_STARTS[index];
						const phase2End = Math.min(
							phase2Start + (0.95 - phase2Start) * 0.9,
							0.95,
						);
						const finalX = FINAL_POSITIONS[index][0];
						const finalY = FINAL_POSITIONS[index][1];

						if (progress >= phase2Start && progress <= 0.95) {
							const phase2Progress = getPhaseProgress(
								progress,
								phase2Start,
								phase2End,
							);

							x = -50 + (finalX + 50) * phase2Progress;
							y = -50 + (finalY + 50) * phase2Progress;
							rotation = initialRotation * (1 - phase2Progress);
						} else if (progress > 0.95) {
							x = finalX;
							y = finalY;
							rotation = 0;
						}

						gsap.set(image, {
							transform: `translate(${x}%, ${y}%) rotate(${rotation}deg)`,
						});
					});
				},
			});

			return () => {
				scrollTrigger.kill();
			};
		},
		{ scope: sectionRef },
	);

	return (
		<section className={styles.spotlight} ref={sectionRef}>
			<div className={styles.sectionNav}>
				<SectionNav left="Studio Floor" right="Center Stage" />
			</div>

			<div className={styles.header}>
				<Copy>
					<h3>
						We Fall Down Rabbit Holes And Come Back With Monsters
						<Callout
							className={styles.callout}
							label="Keep going"
							rotation={-15}
							top="0.65em"
							left="0.35em"
							variant={1}
						/>
					</h3>
				</Copy>
			</div>

			<div className={styles.images}>
				{IMAGES.map((src, index) => (
					<div
						key={src}
						className={styles.image}
						ref={(el) => {
							imageRefs.current[index] = el;
						}}
					>
						<img src={src} alt="" />
					</div>
				))}
			</div>

			<div className={styles.sectionFooter}>
				<SectionFooter left="Stare Longer" right="Feed Your Eyes" />
			</div>
		</section>
	);
}
