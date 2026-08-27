import type { ReactNode } from "react";
import styles from "./SectionFooter.module.css";

interface SectionFooterProps {
	left: ReactNode;
	right: ReactNode;
}

export default function SectionFooter({ left, right }: SectionFooterProps) {
	return (
		<div className={`container ${styles.footer}`}>
			<div className={styles.inner}>
				<p className="mono sm">{left}</p>
				<p className="mono sm">{right}</p>
			</div>
		</div>
	);
}
