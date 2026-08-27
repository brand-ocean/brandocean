import styles from "./ComingSoon.module.css";

/**
 * Tijdelijke strip voor de livegang op brandocean.nl: de site staat er al,
 * maar is nog niet af. Weghalen = deze component uit BluntLayout halen.
 */
export default function ComingSoon() {
	return (
		<div className={styles.bar}>
			<div className={styles.inner}>
				<p className={`mono sm ${styles.label}`}>
					<span className={styles.dot} aria-hidden="true" />
					Nieuwe site — in aanbouw
				</p>
				<p className={`mono sm ${styles.hideOnMobile}`}>
					Vragen?{" "}
					<a className={styles.link} href="mailto:info@brandocean.nl">
						info@brandocean.nl
					</a>
				</p>
			</div>
		</div>
	);
}
