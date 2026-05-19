import { useEffect, useRef, useState } from "react";

export function useScrollDirection(threshold = 100) {
	const [isVisible, setIsVisible] = useState(true);
	const lastScrollY = useRef(0);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const handleScroll = () => {
			const currentScrollY = window.scrollY;

			if (currentScrollY > lastScrollY.current && currentScrollY > threshold) {
				setIsVisible(false);
			} else if (currentScrollY < lastScrollY.current) {
				setIsVisible(true);
			}

			lastScrollY.current = currentScrollY;
		};

		window.addEventListener("scroll", handleScroll, { passive: true });

		return () => {
			window.removeEventListener("scroll", handleScroll);
		};
	}, [threshold]);

	return isVisible;
}
