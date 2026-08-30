import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "~convex/_generated/api";
import styles from "./Aanmelden.module.css";

/**
 * Eén veld. Iemand laat zijn mailadres achter en wij bellen terug — meer hoeft
 * een coming-soon-pagina niet te doen. Het vragenpad (convex/intakeAi.ts) staat
 * er nog en is uitgeschakeld, niet weggegooid.
 */
export default function Aanmelden({ onClose }: { onClose: () => void }) {
	const aanmelden = useMutation(api.intakes.aanmelden);
	const [busy, setBusy] = useState(false);
	const [klaar, setKlaar] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const email = String(form.get("email") ?? "").trim();
		if (!email.includes("@")) {
			setError("Dat adres lijkt niet te kloppen.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			await aanmelden({ email });
			setKlaar(true);
		} catch {
			setError("Dat ging mis. Mail ons gerust rechtstreeks.");
			setBusy(false);
		}
	}

	if (klaar) {
		return (
			<div className={styles.panel}>
				<p className={styles.kop}>Genoteerd</p>
				<p className={styles.lead}>
					We nemen contact op. Kan het niet wachten, mail dan gerust naar{" "}
					<a className={styles.link} href="mailto:info@brandocean.nl">
						info@brandocean.nl
					</a>
					.
				</p>
				<div className={styles.actions}>
					<button className={styles.button} type="button" onClick={onClose}>
						Sluiten
					</button>
				</div>
			</div>
		);
	}

	return (
		<form className={styles.panel} onSubmit={submit}>
			<p className={styles.kop}>Iets te bouwen?</p>
			<p className={styles.lead}>
				Laat je mailadres achter, dan nemen we contact op. Liever meteen zelf
				mailen? Dat mag ook, naar{" "}
				<a className={styles.link} href="mailto:info@brandocean.nl">
					info@brandocean.nl
				</a>
				.
			</p>

			<div className={styles.field}>
				<label className={`mono sm ${styles.label}`} htmlFor="email">
					E-mail
				</label>
				<input
					className={styles.input}
					id="email"
					name="email"
					type="email"
					placeholder="jij@bedrijf.nl"
					required
					// biome-ignore lint/a11y/noAutofocus: de modal bestaat om dit veld
					autoFocus
				/>
			</div>

			<div className={styles.actions}>
				<button className={styles.button} type="submit" disabled={busy}>
					{busy ? "Momentje" : "Stuur maar"}
				</button>
				{error ? <p className={`mono sm ${styles.error}`}>{error}</p> : null}
			</div>
		</form>
	);
}
