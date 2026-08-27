import { createFileRoute } from "@tanstack/react-router";
import type { JSONContent } from "@tiptap/react";
import { Brandmark, Logotype } from "@/components/brand";
import { OfferteStaticContent } from "@/components/offertes/OfferteStaticContent";
import { convexHttp } from "@/lib/convex-http";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/c/$slug")({
	loader: async ({ params }) =>
		convexHttp.query(api.contracts.getBySlug, { slug: params.slug }),
	head: ({ loaderData }) => {
		const title = loaderData?.title;
		const fullTitle = title ? `${title} — BRANDOCEAN` : "Contract — BRANDOCEAN";
		const description = title
			? `Signed contract: ${title}`
			: "Signed contract from BRANDOCEAN.";
		return {
			meta: [
				{ title: fullTitle },
				{ name: "description", content: description },
				{ property: "og:title", content: title ?? "Contract" },
				{ property: "og:description", content: description },
				{ property: "og:type", content: "article" },
				{ property: "og:site_name", content: "BRANDOCEAN" },
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "robots", content: "noindex, nofollow" },
			],
		};
	},
	component: PublicContract,
});

function PublicContract() {
	const data = Route.useLoaderData();

	if (data === null) {
		return (
			<div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
				<div className="flex items-center gap-3">
					<Brandmark size={48} />
					<Logotype height={32} />
				</div>
				<h1 className="text-2xl font-semibold">Contract not found</h1>
				<p className="max-w-md text-sm text-muted-foreground">
					The link may be wrong, or the contract may have been removed.
				</p>
			</div>
		);
	}

	const body = data.bodySnapshot as JSONContent | undefined;
	const hasBody =
		body && Array.isArray(body.content) && body.content.length > 0;

	const itemsBySection = new Map<number, { label: string; order: number }[]>();
	for (const item of data.itemsSnapshot) {
		const arr = itemsBySection.get(item.sectionOrder) ?? [];
		arr.push({ label: item.label, order: item.order });
		itemsBySection.set(item.sectionOrder, arr);
	}
	const sortedSections = [...data.sectionsSnapshot].sort(
		(a, b) => a.order - b.order,
	);

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="border-b">
				<div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
					<Brandmark size={48} />
					<Logotype height={32} />
				</div>
			</header>
			<main className="mx-auto max-w-3xl px-6 py-16">
				<header className="mb-8 space-y-2">
					<p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
						Signed contract
					</p>
					<h1 className="text-4xl font-semibold tracking-tight">
						{data.title}
					</h1>
					<p className="text-sm text-muted-foreground">
						Signed by {data.signedByName}
						{data.signedByEmail ? ` · ${data.signedByEmail}` : ""} on{" "}
						{new Date(data.signedAt).toLocaleString()}
					</p>
				</header>

				{hasBody && body && (
					<section className="mb-12">
						<OfferteStaticContent content={body} />
					</section>
				)}

				<div className="space-y-10">
					{sortedSections.map((s) => {
						const items = (itemsBySection.get(s.order) ?? []).sort(
							(a, b) => a.order - b.order,
						);
						return (
							<section key={s.order} className="space-y-3">
								<h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
									{s.title}
								</h2>
								<ul className="space-y-2">
									{items.map((it, idx) => (
										<li
											key={`${s.order}-${idx}`}
											className="flex items-center gap-3"
										>
											<input
												type="checkbox"
												checked
												readOnly
												className="h-4 w-4"
											/>
											<span className="text-base">{it.label}</span>
										</li>
									))}
								</ul>
							</section>
						);
					})}
				</div>
			</main>
		</div>
	);
}
