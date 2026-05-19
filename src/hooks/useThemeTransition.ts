import { gsap } from "gsap";
import { flushSync } from "react-dom";

type ThemeTransitionCallback = () => void;

export function useThemeTransition() {
	function createClipPathSVG(): SVGSVGElement {
		const existing = document.getElementById("liquid-clip-svg");
		if (existing) existing.remove();

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.id = "liquid-clip-svg";
		svg.setAttribute("width", "0");
		svg.setAttribute("height", "0");
		svg.style.position = "absolute";
		svg.innerHTML = `
			<defs>
				<clipPath id="liquid-clip" clipPathUnits="objectBoundingBox">
					<path id="liquid-path" d="M 0 0 h 0 c 0 0.5 0 0.5 0 1 H 0 V 0 Z" />
				</clipPath>
			</defs>
		`;
		document.body.appendChild(svg);
		return svg;
	}

	function runTransition(onThemeChange: ThemeTransitionCallback) {
		if (!document.startViewTransition) {
			onThemeChange();
			return;
		}

		const svg = createClipPathSVG();
		const path = document.getElementById("liquid-path");
		if (!path) {
			onThemeChange();
			return;
		}

		// Paths in 0-1 coordinate space (objectBoundingBox)
		const paths = {
			start: "M 0 0 h 0 c 0 0.5 0 0.5 0 1 H 0 V 0 Z",
			mid: "M 0 0 h 0.43 c -0.6 0.55 1.4 0.65 0 1 H 0 V 0 Z",
			end: "M 0 0 h 1 c 0 0.5 0 0.5 0 1 H 0 V 0 Z",
		};

		const transition = document.startViewTransition(() => {
			flushSync(() => {
				onThemeChange();
			});
		});

		gsap.set(path, { attr: { d: paths.start } });

		transition.ready.then(() => {
			gsap
				.timeline()
				.to(path, {
					duration: 0.5,
					ease: "power3.in",
					attr: { d: paths.mid },
				})
				.to(path, {
					duration: 0.4,
					ease: "power2.out",
					attr: { d: paths.end },
				});
		});

		transition.finished.finally(() => {
			svg.remove();
		});
	}

	return { runTransition };
}
