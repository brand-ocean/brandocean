import { useRouterState } from "@tanstack/react-router";
import { ReactLenis } from "lenis/react";
import { type ReactNode, useEffect, useState } from "react";
import Footer from "./components/Footer/Footer";
import Menu from "./components/Menu/Menu";
import TransitionProvider from "./components/TransitionProvider/TransitionProvider";
import "lenis/dist/lenis.css";

const MOBILE_BREAKPOINT = 1000;

const LENIS_EASING = (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t));

const LENIS_SHARED = {
	easing: LENIS_EASING,
	direction: "vertical",
	gestureDirection: "vertical",
	smooth: true,
	infinite: false,
	wheelMultiplier: 1,
	orientation: "vertical",
	smoothWheel: true,
	syncTouch: true,
} as const;

const LENIS_MOBILE = {
	...LENIS_SHARED,
	duration: 0.8,
	smoothTouch: true,
	touchMultiplier: 1.5,
	lerp: 0.09,
};

const LENIS_DESKTOP = {
	...LENIS_SHARED,
	duration: 1.2,
	smoothTouch: false,
	touchMultiplier: 2,
	lerp: 0.1,
};

/**
 * Port of blunt-main's ClientLayout. The extra `.bo-site` wrapper scopes the
 * template's global reset/typography so the authed dashboard is untouched, and
 * `bo-site-scroll` hides the native scrollbar only while marketing pages mount.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
	const [isMobile, setIsMobile] = useState(false);
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	useEffect(() => {
		const handleResize = () =>
			setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	useEffect(() => {
		document.documentElement.classList.add("bo-site-scroll");
		return () => document.documentElement.classList.remove("bo-site-scroll");
	}, []);

	const lenisOptions = isMobile ? LENIS_MOBILE : LENIS_DESKTOP;

	return (
		<div className="bo-site">
			<TransitionProvider>
				<ReactLenis root options={lenisOptions}>
					<Menu />
					{children}
					<Footer key={pathname} />
				</ReactLenis>
			</TransitionProvider>
		</div>
	);
}
