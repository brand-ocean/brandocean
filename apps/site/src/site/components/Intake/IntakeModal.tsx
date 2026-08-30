import { useRef } from "react";
import Intake from "./Intake";
import styles from "./IntakeModal.module.css";

/**
 * Het gesprek als overlay op de coming-soon-pagina. Geen navigatie weg van de
 * pagina, dus lagere drempel om te beginnen — en wat hij al ingevuld heeft
 * blijft staan, want de token gaat naar localStorage.
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
			aria-label="Vertel wat je wilt maken"
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
				<Intake onClose={onClose} />
			</div>
		</div>
	);
}
