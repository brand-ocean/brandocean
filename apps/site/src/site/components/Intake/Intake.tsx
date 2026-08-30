import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";
import styles from "./Intake.module.css";

// De eerste vraag staat hier hard, want er is nog geen record als de modal
// opengaat. Hij moet gelijk lopen met SEED_QUESTIONS[0] in convex/intakes.ts.
const EERSTE_VRAAG = "Wat wil je maken?";
const EERSTE_DETAIL = "In je eigen woorden. Twee zinnen is genoeg.";

const OPSLAG_SLEUTEL = "brandocean.intake.token";

function leesToken(): string | null {
	try {
		return window.localStorage.getItem(OPSLAG_SLEUTEL);
	} catch {
		// Privémodus of geblokkeerde opslag: dan begint hij gewoon opnieuw.
		return null;
	}
}

function bewaarToken(token: string): void {
	try {
		window.localStorage.setItem(OPSLAG_SLEUTEL, token);
	} catch {
		// Niet erg. Zonder opslag verlies je alleen het hervatten.
	}
}

/**
 * Het gesprek dat een formulier lijkt.
 *
 * De volgorde is met opzet: eerst één vraag, geen velden. Pas als hij iets
 * verteld heeft ontstaat er een record, en pas aan het eind vragen we wie hij
 * is. Contactgegevens vooraf zijn de hoogste drempel op het slechtste moment,
 * en ze kosten geld: zonder adres schrijf je een brief die je niet kunt
 * gebruiken.
 */
export default function Intake({ onClose }: { onClose?: () => void }) {
	// Lazy initializer in plaats van een effect: localStorage wordt één keer
	// gelezen, op de client, bij de eerste render.
	const [token, setToken] = useState<string | null>(() =>
		typeof window === "undefined" ? null : leesToken(),
	);

	return token ? (
		<Gesprek token={token} onClose={onClose} />
	) : (
		<EersteVraag
			onStarted={(t) => {
				bewaarToken(t);
				setToken(t);
			}}
		/>
	);
}

function EersteVraag({ onStarted }: { onStarted: (token: string) => void }) {
	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (draft.trim().length < 2) return;
		setBusy(true);
		setError(null);
		try {
			// Via onze eigen route: alleen de server kent het echte IP, en daar
			// hangt de ratelimiting aan.
			const res = await fetch("/start", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ firstAnswer: draft }),
			});
			const data: { token?: string; error?: string } = await res.json();
			if (!res.ok || !data.token) {
				setError(
					data.error === "rate_limited"
						? "Je hebt er net al een ingevuld. Probeer het over een uur, of mail gewoon."
						: "Dat ging mis. Probeer het nog eens, of mail info@brandocean.nl.",
				);
				setBusy(false);
				return;
			}
			onStarted(data.token);
		} catch {
			setError("Geen verbinding. Probeer het nog eens.");
			setBusy(false);
		}
	}

	return (
		<form className={styles.panel} onSubmit={submit}>
			<p className={styles.question}>{EERSTE_VRAAG}</p>
			<p className={styles.detail}>{EERSTE_DETAIL}</p>
			<textarea
				className={styles.textarea}
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				placeholder="Typ hier"
				// biome-ignore lint/a11y/noAutofocus: de modal bestaat om deze vraag
				autoFocus
			/>
			<div className={styles.actions}>
				<button
					className={styles.button}
					type="submit"
					disabled={busy || draft.trim().length < 2}
				>
					{busy ? "Momentje" : "Volgende"}
				</button>
				{error ? <p className={`mono sm ${styles.error}`}>{error}</p> : null}
			</div>
			<p className={`mono sm ${styles.hint}`}>
				Vijf minuten. Je krijgt er een eerste richting voor terug.
			</p>
		</form>
	);
}

function Gesprek({ token, onClose }: { token: string; onClose?: () => void }) {
	const intake = useQuery(api.intakes.getByToken, { token });
	const answer = useMutation(api.intakes.answer);
	const setContact = useMutation(api.intakes.setContact);
	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState(false);

	if (intake === undefined) {
		return <p className={`mono sm ${styles.hint}`}>Even laden…</p>;
	}
	if (intake === null) {
		// Token uit een oude sessie die niet meer bestaat.
		return (
			<div className={styles.panel}>
				<p className={styles.question}>Deze sessie is verlopen.</p>
				<p className={styles.detail}>
					Mail ons gerust op info@brandocean.nl, dan pakken we het daar op.
				</p>
			</div>
		);
	}

	if (intake.status === "klaar") {
		return (
			<div className={styles.panel}>
				<p className={styles.question}>Dit hoorden we</p>
				<p className={styles.summary}>{intake.summary}</p>
				<p className={`mono sm ${styles.hint}`}>
					We nemen contact op via de mail die je opgaf. Sneller? Bel 06 4132
					4721.
				</p>
				{onClose ? (
					<div className={styles.actions}>
						<button className={styles.button} type="button" onClick={onClose}>
							Sluiten
						</button>
					</div>
				) : null}
			</div>
		);
	}

	if (intake.status === "contact") {
		return (
			<Contactgegevens
				onSubmit={async (waarden) => {
					await setContact({ token, ...waarden });
				}}
			/>
		);
	}

	if (intake.status === "denkt") {
		return (
			<div className={styles.panel}>
				<p className={styles.question}>Momentje</p>
				<p className={styles.detail}>
					We lezen even terug wat je verteld hebt.
				</p>
				<p className={`mono sm ${styles.thinking}`}>
					<span className={styles.pulse} aria-hidden="true" />
					Bezig
				</p>
			</div>
		);
	}

	// Afgeleid uit de query, niet uit eigen state: als het model vragen bijzet
	// schuift dit vanzelf op zodra Convex de nieuwe lijst doorgeeft.
	const current = intake.questions.find((q) => !q.answer);
	if (!current) {
		return <p className={`mono sm ${styles.hint}`}>Alles binnen. Momentje…</p>;
	}

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!draft.trim() || !current) return;
		setBusy(true);
		try {
			await answer({
				token,
				questionId: current.id as Id<"intakeAnswers">,
				answer: draft,
			});
			setDraft("");
		} finally {
			setBusy(false);
		}
	}

	const done = intake.questions.filter((q) => q.answer).length;

	return (
		<form className={styles.panel} onSubmit={submit}>
			<div className={styles.progress} aria-hidden="true">
				{intake.questions.map((q, i) => (
					<span
						key={q.id}
						className={`${styles.tick} ${
							q.answer ? styles.tickDone : i === done ? styles.tickCurrent : ""
						}`}
					/>
				))}
			</div>

			<p className={styles.question}>{current.question}</p>
			{current.detail ? (
				<p className={styles.detail}>{current.detail}</p>
			) : null}

			<textarea
				className={styles.textarea}
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				placeholder="Typ hier"
				// biome-ignore lint/a11y/noAutofocus: één vraag per scherm, de cursor hoort hier
				autoFocus
			/>

			<div className={styles.actions}>
				<button
					className={styles.button}
					type="submit"
					disabled={busy || !draft.trim()}
				>
					{busy ? "Momentje" : "Volgende"}
				</button>
			</div>
		</form>
	);
}

function Contactgegevens({
	onSubmit,
}: {
	onSubmit: (waarden: {
		name: string;
		email: string;
		company?: string;
	}) => Promise<void>;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		const form = new FormData(event.currentTarget);
		try {
			await onSubmit({
				name: String(form.get("name") ?? ""),
				email: String(form.get("email") ?? ""),
				company: String(form.get("company") ?? "") || undefined,
			});
		} catch {
			setError("Dat adres lijkt niet te kloppen.");
			setBusy(false);
		}
	}

	return (
		<form className={styles.panel} onSubmit={submit}>
			<p className={styles.question}>Waar sturen we het heen?</p>
			<p className={styles.detail}>
				We hebben genoeg gehoord. Zeg waar je het naartoe wilt, dan lees je zo
				wat we ervan maken.
			</p>

			<div className={styles.row}>
				<div className={styles.field}>
					<label className={`mono sm ${styles.label}`} htmlFor="name">
						Naam
					</label>
					<input className={styles.input} id="name" name="name" required />
				</div>
				<div className={styles.field}>
					<label className={`mono sm ${styles.label}`} htmlFor="email">
						E-mail
					</label>
					<input
						className={styles.input}
						id="email"
						name="email"
						type="email"
						required
					/>
				</div>
			</div>

			<div className={styles.field}>
				<label className={`mono sm ${styles.label}`} htmlFor="company">
					Bedrijf <span className={styles.hint}>— mag leeg</span>
				</label>
				<input className={styles.input} id="company" name="company" />
			</div>

			<div className={styles.actions}>
				<button className={styles.button} type="submit" disabled={busy}>
					{busy ? "Momentje" : "Laat maar zien"}
				</button>
				{error ? <p className={`mono sm ${styles.error}`}>{error}</p> : null}
			</div>
		</form>
	);
}
