import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "~convex/_generated/api";
import type { Id } from "~convex/_generated/dataModel";
import SectionNav from "../SectionNav/SectionNav";
import styles from "./Intake.module.css";

type Stage = { kind: "intro" } | { kind: "vragen"; token: string };

/**
 * Voor de bezoeker is dit een formulier met doordachte vragen. Wat hij niet
 * ziet: na elk rondje kijkt een model of er nog iets ontbreekt en zet het er
 * vragen bij. Vandaar de streepjes in plaats van een percentage — een balk die
 * terugspringt verraadt het.
 */
export default function Intake() {
	const [stage, setStage] = useState<Stage>({ kind: "intro" });

	return (
		<section className={styles.intake}>
			<SectionNav left="Brandocean" right="Even kennismaken" />
			<div className={`container pad ${styles.inner}`}>
				{stage.kind === "intro" ? (
					<Intro onStarted={(token) => setStage({ kind: "vragen", token })} />
				) : (
					<Vragen token={stage.token} />
				)}
			</div>
		</section>
	);
}

function Intro({ onStarted }: { onStarted: (token: string) => void }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError(null);

		const form = new FormData(event.currentTarget);
		try {
			// Via onze eigen route, niet rechtstreeks naar Convex: alleen de server
			// kent het echte IP, en daar hangt de ratelimiting aan.
			const res = await fetch("/start", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: String(form.get("name") ?? ""),
					email: String(form.get("email") ?? ""),
					company: String(form.get("company") ?? ""),
				}),
			});
			const data: { token?: string; error?: string } = await res.json();
			if (!res.ok || !data.token) {
				setError(
					data.error === "rate_limited"
						? "Je hebt er net al een ingevuld. Probeer het over een uur nog eens, of mail gewoon."
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
			<h2 className={styles.heading}>Vertel eens</h2>
			<p className={styles.lead}>
				Een paar vragen over wat je wilt maken. Kost je vijf minuten en je
				krijgt er een eerste richting voor terug. Geen verkooppraatje.
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
					Bedrijf
				</label>
				<input className={styles.input} id="company" name="company" />
			</div>

			<div className={styles.actions}>
				<button className={styles.button} type="submit" disabled={busy}>
					{busy ? "Momentje" : "Beginnen"}
				</button>
				{error ? <p className={`mono sm ${styles.error}`}>{error}</p> : null}
			</div>
		</form>
	);
}

function Vragen({ token }: { token: string }) {
	const intake = useQuery(api.intakes.getByToken, { token });
	const answer = useMutation(api.intakes.answer);
	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState(false);

	if (intake === undefined) {
		return <p className={`mono sm ${styles.hint}`}>Even laden…</p>;
	}
	if (intake === null) {
		return <p className={`mono sm ${styles.error}`}>Deze link bestaat niet.</p>;
	}

	if (intake.status === "klaar") {
		return (
			<div className={styles.panel}>
				<h2 className={styles.heading}>Dit hoorden we</h2>
				<p className={styles.summary}>{intake.summary}</p>
				<p className={`mono sm ${styles.hint}`}>
					We nemen contact op via de mail die je opgaf. Sneller? Bel 06 4132
					4721.
				</p>
			</div>
		);
	}

	if (intake.status === "denkt") {
		return (
			<div className={styles.panel}>
				<h2 className={styles.heading}>Momentje</h2>
				<p className={styles.lead}>
					We lezen even terug wat je verteld hebt. Dit duurt een halve minuut.
				</p>
				<p className={`mono sm ${styles.thinking}`}>
					<span className={styles.pulse} aria-hidden="true" />
					Bezig
				</p>
			</div>
		);
	}

	// Afgeleid uit de query, niet uit eigen state: als er vragen bij komen
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
				<p className={`mono sm ${styles.hint}`}>Vraag {done + 1}</p>
			</div>
		</form>
	);
}
