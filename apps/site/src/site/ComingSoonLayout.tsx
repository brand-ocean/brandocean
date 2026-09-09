import { ReactLenis } from "lenis/react";
import { type ReactNode, useEffect, useState } from "react";
import AanmeldenModal from "./components/Aanmelden/AanmeldenModal";
import Footer from "./components/Footer/Footer";
import { LENIS_DESKTOP, LENIS_MOBILE, MOBILE_BREAKPOINT } from "./lenis";
import "lenis/dist/lenis.css";

/**
 * De schil van de coming-soon-landing. Staat helemaal los van SiteLayout:
 * geen menu, geen paginatransitie, geen wrapper die het menu omhoog schuift.
 * Alleen de Preloader (als child), de minimale footer en het intakeformulier.
 */
export default function ComingSoonLayout({
	children,
}: {
	children: ReactNode;
}) {
	const [isMobile, setIsMobile] = useState(false);
	const [intakeOpen, setIntakeOpen] = useState(false);

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
			<ReactLenis root options={isMobile ? LENIS_MOBILE : LENIS_DESKTOP}>
				{children}
				<Footer minimal onStart={() => setIntakeOpen(true)} />
				{intakeOpen ? (
					<AanmeldenModal onClose={() => setIntakeOpen(false)} />
				) : null}
			</ReactLenis>
		</div>
	);
}
