import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { previews } from "@/preview/clients";
import { ownerAccess, unlockOwner } from "@/preview/owner";
import PreviewBoard from "@/preview/PreviewBoard";
import styles from "@/preview/PreviewBoard.module.css";
import "@/preview/theme.css";

/**
 * /preview/<slug>/beheer: het bord met alle gereedschap, voor het gesprek
 * zelf. Alleen te openen met de sleutel (PREVIEW_OWNER_KEY); daarna onthoudt
 * de browser het een jaar in een httpOnly-cookie. De klant krijgt nooit deze
 * URL, alleen /preview/<slug>. De `_` in de bestandsnaam houdt de route los
 * van /preview/$slug, die zelf geen Outlet heeft.
 */
export const Route = createFileRoute("/preview/$slug_/beheer")({
	loader: async ({ params }) => {
		const preview = previews[params.slug];
		if (!preview) throw notFound();
		const owner = await ownerAccess();
		return {
			slug: preview.slug,
			client: preview.client,
			title: preview.title,
			owner,
		};
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData
					? `${loaderData.client}: ${loaderData.title} (beheer)`
					: "Preview",
			},
			{ name: "robots", content: "noindex" },
			{ name: "theme-color", content: "#f0efeb" },
		],
	}),
	notFoundComponent: () => (
		<main style={{ padding: "3rem 2rem", fontFamily: "system-ui" }}>
			<h1>Geen preview met deze naam</h1>
		</main>
	),
	component: Beheer,
});

function Beheer() {
	const { slug, owner } = Route.useLoaderData();
	const preview = previews[slug];
	if (!preview) return null;
	if (!owner) return <Unlock slug={slug} />;
	return <PreviewBoard preview={preview} />;
}

/** Sleutelveld: één keer invullen, daarna is deze browser beheerder. */
function Unlock({ slug }: { slug: string }) {
	const router = useRouter();
	const [key, setKey] = useState("");
	const [wrong, setWrong] = useState(false);
	const [busy, setBusy] = useState(false);
	return (
		<div className={`pv-theme ${styles.shell}`} data-theme="light">
			<div className={styles.veil}>
				<form
					className={styles.card}
					onSubmit={async (e) => {
						e.preventDefault();
						setBusy(true);
						const ok = await unlockOwner({ data: { key } });
						setBusy(false);
						if (ok) router.invalidate();
						else setWrong(true);
					}}
				>
					<p className={styles.eyebrow}>Brandocean · beheer</p>
					<h1 className={styles.cardTitle}>Sleutel</h1>
					<p className={styles.cardText}>
						Dit is de beheerversie van het bord. De klant krijgt{" "}
						<code>/preview/{slug}</code>; hier hoort een sleutel bij.
					</p>
					<div className={styles.cardActions}>
						<input
							className={styles.keyInput}
							type="password"
							value={key}
							placeholder="Sleutel"
							autoComplete="off"
							autoFocus
							onChange={(e) => {
								setKey(e.target.value);
								setWrong(false);
							}}
						/>
						<button
							type="submit"
							className={styles.keyBtn}
							disabled={!key.trim() || busy}
						>
							Open
						</button>
					</div>
					{wrong ? <p className={styles.cardMeta}>Dat is hem niet.</p> : null}
				</form>
			</div>
		</div>
	);
}
