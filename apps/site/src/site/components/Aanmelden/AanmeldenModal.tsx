import { useRef } from "react";
import Aanmelden from "./Aanmelden";
import styles from "./AanmeldenModal.module.css";

/**
 * Overlay op de coming-soon-pagina. Eén veld: een mailadres. Het vragenpad dat
 * hier eerst zat staat nog in convex/intakeAi.ts en in de history — het is
 * uitgezet, niet weggegooid.
 */
export default function IntakeModal({ onClose }: { onClose: () => void }) {
	const overlayRef = useRef<HTMLDivElement>(null);

	return (
		<div
			ref={overlayRef}
			className={styles.overlay}
			// Klikken naast het venster sluit, klikken erbinnen niet.
			onMouseDown={(e) => {
				if (e.target === overlayRef.current) onClose();
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") onClose();
			}}
			// biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: overlay vangt escape en klik-buiten
			role="dialog"
			aria-modal="true"
			aria-label="Laat je mailadres achter"
			// biome-ignore lint/a11y/noNoninteractiveTabindex: nodig om Escape te kunnen vangen
			tabIndex={-1}
		>
			<div className={styles.dialog}>
				<button
					className={styles.close}
					type="button"
					onClick={onClose}
					aria-label="Sluiten"
				>
					×
				</button>
				<Aanmelden onClose={onClose} />
			</div>
		</div>
	);
}
