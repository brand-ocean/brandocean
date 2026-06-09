import { createFileRoute } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/react";
import { Brandmark, Logotype } from "@/components/brand";
import { DownloadPdfButton } from "@/components/nda/DownloadPdfButton";
import { OfferteStaticContent } from "@/components/offertes/OfferteStaticContent";
import { convexHttp } from "@/lib/convex-http";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/ns/$slug")({
	loader: async ({ params }) =>
		convexHttp.query(api.signedNdas.getBySlug, { slug: params.slug }),
	head: ({ loaderData }) => {
		const title = loaderData?.title;
		const fullTitle = title
			? `${title} — Signed NDA — BRANDOCEAN`
			: "Signed NDA — BRANDOCEAN";
		return {
			meta: [
				{ title: fullTitle },
				{ name: "robots", content: "noindex, nofollow" },
			],
		};
	},
	component: SignedNda,
});

const LABELS = {
	nl: { badge: "Ondertekende NDA", signedBy: "Ondertekend door" },
	en: { badge: "Signed NDA", signedBy: "Signed by" },
} as const;

function SignedNda() {
	const data = Route.useLoaderData();

	if (data === null) {
		return (
			<div className="force-theme-light flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center text-slate-900">
				<div className="flex items-center gap-3">
					<Brandmark size={48} color="#0f172a" />
					<Logotype height={32} color="#0f172a" />
				</div>
				<h1 className="text-2xl font-semibold">NDA not found</h1>
				<p className="max-w-md text-sm text-slate-500">
					The link may be wrong, or the document may have been removed.
				</p>
			</div>
		);
	}

	const lang = data.language === "en" ? "en" : "nl";
	const l = LABELS[lang];
	const body = data.bodySnapshot as JSONContent | undefined;
	const hasBody =
		body && Array.isArray(body.content) && body.content.length > 0;

	const signer =
		data.signedByName +
		(data.signedByCompany ? ` · ${data.signedByCompany}` : "") +
		(data.signedByEmail ? ` · ${data.signedByEmail}` : "");

	return (
		<div className="force-theme-light min-h-screen bg-white text-slate-900">
			<header className="border-b border-slate-200">
				<div className="mx-auto flex max-w-3xl items-center gap-2.5 px-6 py-5">
					<Brandmark size={32} color="#0f172a" />
					<Logotype height={20} color="#0f172a" />
				</div>
			</header>
			<main className="mx-auto max-w-3xl px-6 py-16">
				<div className="mb-6 flex justify-end">
					<DownloadPdfButton content={body} filename={data.title} />
				</div>
				<div className="nda-doc">
					<header className="mb-8 space-y-2">
						<p className="text-sm font-medium uppercase tracking-wider text-emerald-600">
							{l.badge}
						</p>
						<h1 className="text-4xl font-semibold tracking-tight">
							{data.title}
						</h1>
						<p className="text-sm text-slate-500">
							{l.signedBy} {signer} · {new Date(data.signedAt).toLocaleString()}
						</p>
					</header>

					{hasBody && body ? (
						<section>
							<OfferteStaticContent content={body} />
						</section>
					) : null}
				</div>
			</main>
		</div>
	);
}
