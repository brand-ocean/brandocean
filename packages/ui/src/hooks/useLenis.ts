import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect, useRef } from "react";
import { BREAKPOINTS } from "@/constants";

export function useLenis() {
	const lenisRef = useRef<Lenis | null>(null);

	useEffect(() => {
		if (typeof window === "undefined") return;

		gsap.registerPlugin(ScrollTrigger);

		const isMobile = window.innerWidth <= BREAKPOINTS.mobileSmall;

		const scrollSettings = isMobile
			? {
					duration: 0.8,
					easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
					smoothTouch: true,
					touchMultiplier: 1.5,
					lerp: 0.09,
					wheelMultiplier: 1,
					syncTouch: true,
				}
			: {
					duration: 1.2,
					easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
					smoothTouch: false,
					touchMultiplier: 2,
					lerp: 0.1,
					wheelMultiplier: 1,
					syncTouch: true,
				};

		const lenis = new Lenis(scrollSettings);
		lenisRef.current = lenis;

		lenis.on("scroll", ScrollTrigger.update);

		gsap.ticker.add((time) => {
			lenis.raf(time * 1000);
		});

		gsap.ticker.lagSmoothing(0);

		const handleResize = () => {
			const wasMobile = isMobile;
			const nowMobile = window.innerWidth <= BREAKPOINTS.mobileSmall;

			if (wasMobile !== nowMobile) {
				lenis.destroy();

				const newSettings = nowMobile
					? {
							duration: 1,
							easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
							smoothTouch: true,
							touchMultiplier: 1.5,
							lerp: 0.05,
							wheelMultiplier: 1,
							syncTouch: true,
						}
					: {
							duration: 1.2,
							easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
							smoothTouch: false,
							touchMultiplier: 2,
							lerp: 0.1,
							wheelMultiplier: 1,
							syncTouch: true,
						};

				const newLenis = new Lenis(newSettings);
				lenisRef.current = newLenis;
				newLenis.on("scroll", ScrollTrigger.update);
			}
		};

		window.addEventListener("resize", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
			lenis.destroy();
			gsap.ticker.remove((time) => {
				lenis.raf(time * 1000);
			});
		};
	}, []);

	return lenisRef;
}
