import { createFileRoute } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/react";
import { Brandmark, Logotype } from "@/components/brand";
import { OfferteStaticContent } from "@/components/offertes/OfferteStaticContent";
import { convexHttp } from "@/lib/convex-http";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/o/$slug")({
	validateSearch: (search: Record<string, unknown>) => ({
		t: typeof search.t === "string" ? search.t : undefined,
	}),
	loaderDeps: ({ search }) => ({ token: search.t }),
	loader: async ({ params, deps }) =>
		convexHttp.query(api.offertes.getBySlug, {
			slug: params.slug,
			token: deps.token,
		}),
	head: ({ loaderData, params }) => {
		const SITE = "https://app.brandocean.nl";
		const title = loaderData?.offerte?.title;
		const ogTitle = title
			? `${title} — Offerte van BRANDOCEAN | Bekijk je voorstel online`
			: "Offerte van BRANDOCEAN | Bekijk je voorstel online";
		const description = title
			? `Bekijk je persoonlijke offerte voor ${title} van BRANDOCEAN — scope, deliverables en investering in één overzicht. Onafhankelijk merkbureau uit Amsterdam.`
			: "Persoonlijke offerte van BRANDOCEAN — onafhankelijk merkbureau uit Amsterdam dat merken bouwt die blijven hangen.";
		const ogImage = `${SITE}/og/o/${params.slug}`;
		const pageUrl = `${SITE}/o/${params.slug}`;
		return {
			meta: [
				{ title: ogTitle },
				{ name: "description", content: description },
				{ property: "og:title", content: ogTitle },
				{ property: "og:description", content: description },
				{ property: "og:type", content: "article" },
				{ property: "og:site_name", content: "BRANDOCEAN" },
				{ property: "og:url", content: pageUrl },
				{ property: "og:locale", content: "nl_NL" },
				{ property: "og:image", content: ogImage },
				{ property: "og:image:secure_url", content: ogImage },
				{ property: "og:image:type", content: "image/png" },
				{ property: "og:image:width", content: "1200" },
				{ property: "og:image:height", content: "630" },
				{ property: "og:image:alt", content: ogTitle },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: ogTitle },
				{ name: "twitter:description", content: description },
				{ name: "twitter:image", content: ogImage },
				{ name: "twitter:image:alt", content: ogTitle },
				{ name: "robots", content: "noindex, nofollow" },
			],
		};
	},
	component: PublicOfferte,
});

function PublicOfferte() {
	const data = Route.useLoaderData();

	if (data === null) {
		return (
			<div className="force-theme-light flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center text-slate-900">
				<div className="flex items-center gap-3">
					<Brandmark size={48} color="#0f172a" />
					<Logotype height={32} color="#0f172a" />
				</div>
				<h1 className="text-2xl font-semibold">This offerte isn't available</h1>
				<p className="max-w-md text-sm text-slate-500">
					It hasn't been published yet, or your link is missing its access
					token. Ask the sender for the latest link.
				</p>
			</div>
		);
	}

	const body = data.offerte.body as JSONContent | undefined;
	const hasBody =
		body && Array.isArray(body.content) && body.content.length > 0;

	return (
		<div className="force-theme-light min-h-screen bg-white text-slate-900">
			<header className="border-b border-slate-200">
				<div className="mx-auto flex max-w-4xl items-center gap-2.5 px-6 py-5">
					<Brandmark size={32} color="#0f172a" />
					<Logotype height={20} color="#0f172a" />
				</div>
			</header>
			<main className="mx-auto max-w-4xl px-6 py-16">
				<h1 className="sr-only">{data.offerte.title}</h1>
				{hasBody && body && (
					<section>
						<OfferteStaticContent content={body} />
					</section>
				)}
			</main>
		</div>
	);
}
