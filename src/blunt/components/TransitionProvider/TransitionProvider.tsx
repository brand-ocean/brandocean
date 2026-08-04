import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
} from "react";
import styles from "./TransitionProvider.module.css";

gsap.registerPlugin(CustomEase, SplitText, ScrollTrigger);
if (!CustomEase.get("hop")) {
	CustomEase.create("hop", "0.8, 0, 0.2, 1");
}

const ROWS = 4;

const BLOCK_COLORS = [
	"var(--base-900)",
	"var(--base-800)",
	"var(--base-500)",
	"var(--base-400)",
];

const TRANSITION_LINES = [
	"Hold That Thought",
	"Wet Paint Ahead",
	"Redrawing The Screen",
	"Give It A Sec",
	"Ink Still Wet",
	"Turning The Page",
	"Cooking Something Weird",
	"Don't Blink Now",
	"Loading The Chaos",
	"Mixing New Colors",
];

function shuffle(items: string[]) {
	const next = [...items];
	for (let i = next.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[next[i], next[j]] = [next[j], next[i]];
	}
	return next;
}

/** Runs the "leave" curtain, performs the navigation, then runs "enter". */
type RunTransition = (navigate: () => Promise<void> | void) => void;

const TransitionContext = createContext<RunTransition | null>(null);

/**
 * Replacement for `next-transition-router` on TanStack Router: link clicks call
 * `runTransition(navigate)`, which plays the curtain in, awaits the navigation
 * and plays it back out. Browser back/forward navigates without the curtain.
 */
export function usePageTransition(): RunTransition {
	const run = useContext(TransitionContext);
	return (
		run ??
		((navigate) => {
			void navigate();
		})
	);
}

export default function TransitionProvider({
	children,
}: {
	children: ReactNode;
}) {
	const gridRef = useRef<HTMLDivElement>(null);
	const blocksRef = useRef<(HTMLDivElement | null)[]>([]);
	const headingRef = useRef<HTMLHeadingElement>(null);
	const wordsRef = useRef<Element[]>([]);
	const splitRef = useRef<SplitText | null>(null);
	const lastLineRef = useRef("");
	const lastColorsRef = useRef("");
	const busyRef = useRef(false);

	const prepareColors = useCallback(() => {
		let colors = shuffle(BLOCK_COLORS);
		const key = colors.join("|");
		if (BLOCK_COLORS.length > 1 && key === lastColorsRef.current) {
			colors = shuffle(BLOCK_COLORS);
		}
		lastColorsRef.current = colors.join("|");

		blocksRef.current.forEach((block, i) => {
			if (block) block.style.backgroundColor = colors[i];
		});

		// Last block paints on top of the full-screen stack
		const topColor = colors[colors.length - 1];
		if (headingRef.current) {
			const darkText =
				topColor === "var(--base-500)" ||
				topColor === "var(--base-800)" ||
				topColor === "var(--base-900)";
			headingRef.current.style.color = darkText
				? "var(--base-1000)"
				: "var(--base-100)";
		}
	}, []);

	const prepareLine = useCallback(() => {
		if (!headingRef.current) return;

		let nextLine =
			TRANSITION_LINES[Math.floor(Math.random() * TRANSITION_LINES.length)];
		if (TRANSITION_LINES.length > 1) {
			while (nextLine === lastLineRef.current) {
				nextLine =
					TRANSITION_LINES[Math.floor(Math.random() * TRANSITION_LINES.length)];
			}
		}
		lastLineRef.current = nextLine;

		splitRef.current?.revert();
		headingRef.current.textContent = nextLine;

		splitRef.current = SplitText.create(headingRef.current, {
			type: "words",
			wordsClass: "word",
			mask: "words",
		});

		wordsRef.current = splitRef.current.words;
		gsap.set(wordsRef.current, { y: "100%" });
	}, []);

	useEffect(() => {
		prepareColors();
		prepareLine();
		return () => splitRef.current?.revert();
	}, [prepareColors, prepareLine]);

	const animateIn = useCallback(
		(onComplete: () => void) => {
			prepareColors();
			prepareLine();

			const tl = gsap.timeline({ onComplete });

			tl.set(gridRef.current, { pointerEvents: "all" });

			tl.set(blocksRef.current, {
				transformOrigin: "left center",
				scaleX: 0,
			});

			tl.set(wordsRef.current, { y: "100%" });

			tl.to(blocksRef.current, {
				scaleX: 1,
				duration: 1.25,
				ease: "hop",
				stagger: 0.075,
			});

			tl.to(
				wordsRef.current,
				{
					y: "0%",
					duration: 1,
					ease: "power4.out",
					stagger: 0.1,
				},
				"-=0.6",
			);

			return tl;
		},
		[prepareColors, prepareLine],
	);

	const animateOut = useCallback((onComplete?: () => void) => {
		const tl = gsap.timeline({
			onComplete: () => {
				gsap.set(gridRef.current, { pointerEvents: "none" });
				ScrollTrigger.refresh();
				onComplete?.();
			},
		});

		tl.set(blocksRef.current, {
			transformOrigin: "right center",
			scaleX: 1,
		});

		tl.to(wordsRef.current, {
			y: "100%",
			duration: 1,
			ease: "power4.out",
			stagger: 0.1,
		});

		tl.to(
			blocksRef.current,
			{
				scaleX: 0,
				duration: 1.25,
				ease: "hop",
				stagger: -0.075,
			},
			"-=1",
		);

		return tl;
	}, []);

	const runTransition = useCallback<RunTransition>(
		(navigate) => {
			if (busyRef.current) return;
			busyRef.current = true;

			animateIn(() => {
				Promise.resolve(navigate())
					.catch(() => undefined)
					.then(() => {
						window.scrollTo(0, 0);
						animateOut(() => {
							busyRef.current = false;
						});
					});
			});
		},
		[animateIn, animateOut],
	);

	return (
		<TransitionContext.Provider value={runTransition}>
			<div ref={gridRef} className={styles.grid}>
				{Array.from({ length: ROWS }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative rows
						key={i}
						className={styles.block}
						ref={(el) => {
							blocksRef.current[i] = el;
						}}
					/>
				))}
			</div>

			<div className={styles.text}>
				<h1 ref={headingRef} />
			</div>

			{children}
		</TransitionContext.Provider>
	);
}
