import { Link } from "@tanstack/react-router";
import { Library, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import "./RotatingButton.css";

type Variant = "dark" | "light";

type CommonProps = {
	children: ReactNode;
	variant?: Variant;
	icon?: LucideIcon;
	className?: string;
};

type AsLink = CommonProps & {
	to: ComponentProps<typeof Link>["to"];
	href?: never;
	onClick?: never;
};

type AsAnchor = CommonProps & {
	href: string;
	to?: never;
	onClick?: never;
};

type AsButton = CommonProps & {
	onClick: () => void;
	href?: never;
	to?: never;
};

type RotatingButtonProps = AsLink | AsAnchor | AsButton;

export function RotatingButton(props: RotatingButtonProps) {
	const { children, variant = "dark", icon: Icon = Library, className } = props;
	const cls = `rotating-button rotating-button--${variant}${className ? ` ${className}` : ""}`;

	const inner = (
		<>
			<span className="rotating-button-label">{children}</span>
			<span className="rotating-button-icon">
				<span className="rotating-button-icon-inner">
					<Icon size={12} />
				</span>
			</span>
		</>
	);

	if ("to" in props && props.to) {
		return (
			<Link to={props.to} className={cls}>
				{inner}
			</Link>
		);
	}

	if ("href" in props && props.href) {
		return (
			<a href={props.href} className={cls}>
				{inner}
			</a>
		);
	}

	return (
		<button type="button" className={cls} onClick={(props as AsButton).onClick}>
			{inner}
		</button>
	);
}
