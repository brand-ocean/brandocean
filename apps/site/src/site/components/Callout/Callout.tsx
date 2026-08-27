import type { CSSProperties } from "react";
import styles from "./Callout.module.css";

const VARIANTS: Record<number, string> = {
	1: styles.v1,
	2: styles.v2,
	3: styles.v3,
	4: styles.v4,
};

interface CalloutProps {
	label: string;
	variant?: number;
	rotation?: number;
	top?: string;
	right?: string;
	bottom?: string;
	left?: string;
	className?: string;
}

export default function Callout({
	label,
	variant = 3,
	rotation = 0,
	top,
	right,
	bottom,
	left,
	className = "",
}: CalloutProps) {
	return (
		<div
			data-callout=""
			data-rotation={rotation}
			className={`${styles.callout} ${VARIANTS[variant] ?? styles.v3} ${className}`.trim()}
			style={
				{
					"--callout-rotation": `${rotation}deg`,
					top,
					right,
					bottom,
					left,
				} as CSSProperties
			}
			aria-hidden="true"
		>
			<span className={styles.label}>{label}</span>
		</div>
	);
}
