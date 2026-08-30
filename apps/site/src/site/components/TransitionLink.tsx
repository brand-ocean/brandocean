import { Link, useRouter } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";
import { usePageTransition } from "./TransitionProvider/TransitionProvider";

/**
 * The fixed routes the site shell links to. The case-study route is separate
 * because it needs params — see `TransitionLinkProps` — which keeps the nav
 * arrays that are typed as `SiteHref` free of a param obligation.
 */
export type SiteHref =
	| "/"
	| "/about"
	| "/work"
	| "/expertise"
	| "/careers"
	| "/contact"
	| "/start";

interface TransitionLinkBaseProps {
	children: ReactNode;
	className?: string;
	onClick?: () => void;
	/** Set for off-site destinations (socials, mailto, tel) — skips the curtain. */
	external?: string;
}

/** Only the case-study route takes params, so the two shapes stay separate. */
type TransitionLinkProps = TransitionLinkBaseProps &
	(
		| { href: SiteHref; params?: undefined }
		| { href: "/work/$slug"; params: { slug: string } }
	);

/**
 * Drop-in for `next/link` inside the site shell. Cancels TanStack Router's own
 * click handling so the page-transition curtain can run before navigating.
 */
export default function TransitionLink({
	href,
	params,
	children,
	className,
	onClick,
	external,
}: TransitionLinkProps) {
	const router = useRouter();
	const runTransition = usePageTransition();
	const resolvedPath = params ? `/work/${params.slug}` : href;

	if (external) {
		const offSite = external.startsWith("http");
		return (
			<a
				href={external}
				className={className}
				onClick={onClick}
				{...(offSite
					? { target: "_blank", rel: "noopener noreferrer" }
					: undefined)}
			>
				{children}
			</a>
		);
	}

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

		if (router.state.location.pathname === resolvedPath) return;

		runTransition(() => {
			if (params) {
				void router.navigate({ to: "/work/$slug", params });
			} else {
				void router.navigate({ to: href });
			}
		});
	}

	if (params) {
		return (
			<Link
				to="/work/$slug"
				params={params}
				className={className}
				onClick={handleClick}
			>
				{children}
			</Link>
		);
	}

	return (
		<Link to={href} className={className} onClick={handleClick}>
			{children}
		</Link>
	);
}
