import { Link, useRouter } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";
import { usePageTransition } from "./TransitionProvider/TransitionProvider";

/** Every route the blunt marketing shell links to. */
export type BluntHref =
	| "/"
	| "/about"
	| "/work"
	| "/sample-project"
	| "/expertise"
	| "/careers"
	| "/contact";

interface TransitionLinkProps {
	href: BluntHref;
	children: ReactNode;
	className?: string;
	onClick?: () => void;
}

/**
 * Drop-in for `next/link` inside the blunt shell. Cancels TanStack Router's own
 * click handling so the page-transition curtain can run before navigating.
 */
export default function TransitionLink({
	href,
	children,
	className,
	onClick,
}: TransitionLinkProps) {
	const router = useRouter();
	const runTransition = usePageTransition();

	function handleClick(event: MouseEvent<HTMLAnchorElement>) {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}

		event.preventDefault();
		onClick?.();

		if (router.state.location.pathname === href) return;

		runTransition(() => router.navigate({ to: href }));
	}

	return (
		<Link to={href} className={className} onClick={handleClick}>
			{children}
		</Link>
	);
}
