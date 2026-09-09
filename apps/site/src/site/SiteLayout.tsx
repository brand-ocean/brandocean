import { useRouterState } from "@tanstack/react-router";
import { ReactLenis } from "lenis/react";
import { type ReactNode, useEffect, useState } from "react";
import AanmeldenModal from "./components/Aanmelden/AanmeldenModal";
import Footer from "./components/Footer/Footer";
import Menu from "./components/Menu/Menu";
import TransitionProvider from "./components/TransitionProvider/TransitionProvider";
import { LENIS_DESKTOP, LENIS_MOBILE, MOBILE_BREAKPOINT } from "./lenis";
import "lenis/dist/lenis.css";

/**
 * Port of blunt-main's ClientLayout. The extra `.bo-site` wrapper scopes the
 * template's global reset/typography so the authed dashboard is untouched, and
 * `bo-site-scroll` hides the native scrollbar only while marketing pages mount.
 *
 * De coming-soon-landing op `/` gebruikt deze schil niet; die heeft zijn eigen
 * ComingSoonLayout.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
	const [isMobile, setIsMobile] = useState(false);
	const [intakeOpen, setIntakeOpen] = useState(false);
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

	return (
		<div className="bo-site">
			<TransitionProvider>
				<ReactLenis root options={isMobile ? LENIS_MOBILE : LENIS_DESKTOP}>
					<Menu />
					{/* `.bo-page` is wat het menu omhoog schuift en dimt zodra het
					    opengaat; zie Menu.tsx. */}
					<div className="bo-page">
						{children}
						<Footer key={pathname} onStart={() => setIntakeOpen(true)} />
					</div>
					{intakeOpen ? (
						<AanmeldenModal onClose={() => setIntakeOpen(false)} />
					) : null}
				</ReactLenis>
			</TransitionProvider>
		</div>
	);
}
