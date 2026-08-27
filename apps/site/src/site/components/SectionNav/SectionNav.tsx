import type { ReactNode } from "react";
import styles from "./SectionNav.module.css";

interface SectionNavProps {
	left: ReactNode;
	right: ReactNode;
}

export default function SectionNav({ left, right }: SectionNavProps) {
	return (
		<div className={`container ${styles.nav}`}>
			<div className={styles.inner}>
				<p className="mono sm">{left}</p>
				<p className="mono sm">{right}</p>
			</div>
		</div>
	);
}
