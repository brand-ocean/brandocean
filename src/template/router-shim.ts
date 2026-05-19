// @ts-nocheck
import {
	Link as TSRLink,
	Outlet,
	useLocation as useTSRLocation,
	useNavigate as useTSRNavigate,
} from "@tanstack/react-router";
import * as React from "react";

export function Link({
	to,
	children,
	className,
	...rest
}: {
	to: string;
	children?: React.ReactNode;
	className?: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
	const target = to.startsWith("/") ? to : `/${to}`;
	return React.createElement(
		TSRLink,
		{ to: target, className, ...rest },
		children,
	);
}

export const NavLink = Link;

export function useNavigate() {
	const navigate = useTSRNavigate();
	return (to: string | number) => {
		if (typeof to === "number") return;
		const target = to.startsWith("/") ? to : `/${to}`;
		navigate({ to: target });
	};
}

export function useLocation() {
	return useTSRLocation();
}

export function Navigate({ to }: { to: string }) {
	const navigate = useNavigate();
	React.useEffect(() => {
		navigate(to);
	}, [navigate, to]);
	return null;
}

export { Outlet };
