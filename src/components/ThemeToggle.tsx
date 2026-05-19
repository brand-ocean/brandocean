import { useMatches } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTheme } from "../context/ThemeContext";

function ContrastIcon() {
	return (
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path stroke="none" d="M0 0h24v24H0z" fill="none" />
			<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
			<path d="M12 3l0 18" />
			<path d="M12 9l4.65 -4.65" />
			<path d="M12 14.3l7.37 -7.37" />
			<path d="M12 19.6l8.85 -8.85" />
		</svg>
	);
}

export function ThemeToggle() {
	const { theme, toggleTheme } = useTheme();
	const matches = useMatches();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return null;
	}

	const isInAppLayout = matches.some(
		(m) =>
			m.routeId === "/_authed/_app" ||
			m.routeId.startsWith("/_authed/_app/"),
	);
	const isOfferteView = matches.some((m) => m.routeId === "/o/$slug");

	if (isOfferteView) {
		return null;
	}

	const positionClasses = isInAppLayout
		? "bottom-6 right-6"
		: "bottom-6 left-6";

	const handleClick = () => {
		toggleTheme();
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
			className={`fixed ${positionClasses} z-[9999] bg-transparent border-none cursor-pointer text-[var(--color-base-300)] p-2 flex items-center justify-center hover:opacity-70 [view-transition-name:theme-toggle]`}
		>
			<ContrastIcon />
		</button>
	);
}
