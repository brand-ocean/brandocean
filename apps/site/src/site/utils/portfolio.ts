import type { ResolvedPortfolioItem } from "~convex/portfolio";

/** What the site pages read off a portfolio item. */
export type CaseItem = ResolvedPortfolioItem;

/**
 * Older items only carry the year inside the free-text `project` line
 * ("Hospitality Brand · 2024"), so fall back to parsing it out until every item
 * has the real `year` field filled in.
 */
export function itemYear(item: CaseItem): number | undefined {
	if (item.year) return item.year;
	const match = item.project.match(/\b(19|20)\d{2}\b/);
	return match ? Number(match[0]) : undefined;
}

/** The `project` line without the trailing year, used as the client name. */
export function itemClient(item: CaseItem): string {
	return item.project.replace(/\s*·\s*(19|20)\d{2}\s*$/, "").trim();
}

export function hostnameOf(url: string | undefined): string | undefined {
	if (!url) return undefined;
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}
