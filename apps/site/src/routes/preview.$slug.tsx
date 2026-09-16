import { createFileRoute, notFound } from "@tanstack/react-router";
import { previews } from "@/preview/clients";
import PreviewBoard from "@/preview/PreviewBoard";

/**
 * /preview/<slug>: deelbaar whiteboard voor een klantgesprek, met de site van
 * nu en het voorstel als sitemap op één bord. Bewust buiten `_site` (geen
 * menu, curtain of preloader) en zonder Convex; de data staat in
 * `src/preview/clients/`.
 *
 * Met `?deel=1` is het de deelversie voor de klant: geen gereedschap, wel
 * een begeleide route stap voor stap en aan het eind de vraag om af te
 * spreken. De knop "Deel met klant" op het bord kopieert die link.
 * `?stap=3` begint de route bij stap 3, `?focus=<kaart>` vliegt naar één
 * kaart ("Deel dit stukje").
 */
type PreviewSearch = { deel?: true; stap?: number; focus?: string };

export const Route = createFileRoute("/preview/$slug")({
	validateSearch: (search: Record<string, unknown>): PreviewSearch => {
		const out: PreviewSearch = {};
		if (search.deel === "1" || search.deel === 1 || search.deel === true)
			out.deel = true;
		const stap = Number(search.stap);
		if (Number.isInteger(stap) && stap > 0) out.stap = stap;
		if (typeof search.focus === "string" && search.focus.length < 200)
			out.focus = search.focus;
		return out;
	},
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
			{ name: "theme-color", content: "#191713" },
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
	const { deel, stap, focus } = Route.useSearch();
	const preview = previews[slug];
	if (!preview) return null;
	return (
		<PreviewBoard
			preview={preview}
			share={deel === true}
			stap={stap}
			focus={focus}
		/>
	);
}
