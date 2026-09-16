import { createFileRoute, notFound } from "@tanstack/react-router";
import { previews } from "@/preview/clients";
import PreviewBoard from "@/preview/PreviewBoard";

/**
 * /preview/<slug>: de deelbare kijkversie van een klantbord. Dit is de link
 * die naar de klant gaat: geen gereedschap, wel een begeleide route stap
 * voor stap en aan het eind de vraag om af te spreken. Beheren gebeurt op
 * /preview/<slug>/beheer, achter een sleutel; van deze URL is dus niets af
 * te knippen om verder te komen.
 *
 * `?stap=3` begint de route bij stap 3, `?focus=<kaart>` vliegt naar één
 * kaart ("Deel dit stukje"). Bewust buiten `_site` (geen menu, curtain of
 * preloader) en zonder Convex; de data staat in `src/preview/clients/`.
 */
export type PreviewSearch = { stap?: number; focus?: string };

export function validatePreviewSearch(
	search: Record<string, unknown>,
): PreviewSearch {
	const out: PreviewSearch = {};
	const stap = Number(search.stap);
	if (Number.isInteger(stap) && stap > 0) out.stap = stap;
	if (typeof search.focus === "string" && search.focus.length < 200)
		out.focus = search.focus;
	return out;
}

export const Route = createFileRoute("/preview/$slug")({
	validateSearch: validatePreviewSearch,
	// De loader controleert alleen de slug; de data zelf leest de component
	// rechtstreeks uit de module, zodat er geen (soms verouderde) kopie via
	// de SSR-dehydratie meereist.
	loader: ({ params }) => {
		const preview = previews[params.slug];
		if (!preview) throw notFound();
		return { slug: preview.slug, client: preview.client, title: preview.title };
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: loaderData
					? `${loaderData.client}: ${loaderData.title}`
					: "Preview",
			},
			{ name: "robots", content: "noindex" },
			{ name: "theme-color", content: "#f0efeb" },
		],
	}),
	notFoundComponent: () => (
		<main style={{ padding: "3rem 2rem", fontFamily: "system-ui" }}>
			<h1>Geen preview met deze naam</h1>
			<p>Vraag Brandocean om de juiste link.</p>
		</main>
	),
	component: Preview,
});

function Preview() {
	const { slug } = Route.useLoaderData();
	const { stap, focus } = Route.useSearch();
	const preview = previews[slug];
	if (!preview) return null;
	return <PreviewBoard preview={preview} share stap={stap} focus={focus} />;
}
