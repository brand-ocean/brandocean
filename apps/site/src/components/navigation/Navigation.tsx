import { useCallback, useEffect, useState } from "react";
import { BREAKPOINTS } from "@/constants";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { NavHeader } from "./NavHeader";
import { NavOverlay } from "./NavOverlay";

export function Navigation() {
	const [isOpen, setIsOpen] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const isVisible = useScrollDirection(100);

	useEffect(() => {
		if (typeof window === "undefined") return;
		setIsMobile(window.innerWidth <= BREAKPOINTS.mobile);

		const handleResize = () =>
			setIsMobile(window.innerWidth <= BREAKPOINTS.mobile);

		window.addEventListener("resize", handleResize);
		return () => {
			window.removeEventListener("resize", handleResize);
		};
	}, []);

	const handleToggle = useCallback(() => {
		setIsOpen((prev) => !prev);
	}, []);

	const handleClose = useCallback(() => {
		setIsOpen(false);
	}, []);

	const shouldHide = !isVisible && !isOpen;

	return (
		<nav
			style={{
				position: "fixed",
				top: "1.5rem",
				left: "50%",
				transform: `translateX(-50%) ${shouldHide ? "translateY(-200%)" : "translateY(0)"}`,
				width: isMobile ? "90%" : "50%",
				maxWidth: isMobile ? "none" : "600px",
				zIndex: 1000,
				transition: "transform 0.4s ease",
			}}
		>
			<NavHeader isOpen={isOpen} onToggle={handleToggle} />
			<NavOverlay isOpen={isOpen} onClose={handleClose} />
		</nav>
	);
}
