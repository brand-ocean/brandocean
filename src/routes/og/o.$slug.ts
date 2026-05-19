import { createFileRoute } from "@tanstack/react-router";
import { convexHttp } from "@/lib/convex-http";
import { api } from "~convex/_generated/api";

export const Route = createFileRoute("/og/o/$slug")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				let title = "Offerte";
				try {
					const data = await convexHttp.query(api.offertes.getBySlug, {
						slug: params.slug,
					});
					if (data?.offerte?.title) title = data.offerte.title;
				} catch {
					// fall through with default title
				}
				const svg = renderOgSvg({ title });
				const headers = new Headers();
				headers.set("Content-Type", "image/svg+xml; charset=utf-8");
				headers.set("Cache-Control", "public, max-age=300, s-maxage=600");
				return new Response(svg, { status: 200, headers });
			},
		},
	},
});

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function wrapTitle(title: string, perLine = 20): string[] {
	const words = title.split(/\s+/);
	const lines: string[] = [];
	let current = "";
	for (const w of words) {
		if (!current) {
			current = w;
			continue;
		}
		if ((current + " " + w).length > perLine) {
			lines.push(current);
			current = w;
		} else {
			current = current + " " + w;
		}
	}
	if (current) lines.push(current);
	return lines.slice(0, 3);
}

function renderOgSvg({ title }: { title: string }): string {
	const safe = escapeXml(title.toUpperCase());
	const lines = wrapTitle(safe, 18);
	const lineHeight = 120;
	const totalHeight = lines.length * lineHeight;
	const startY = 315 - totalHeight / 2 + lineHeight * 0.75;
	const tspans = lines
		.map(
			(l, i) =>
				`<tspan x="80" dy="${i === 0 ? 0 : lineHeight}">${l}</tspan>`,
		)
		.join("");
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#ffffff"/>
  <rect x="0" y="0" width="1200" height="4" fill="#0f172a"/>
  <text x="80" y="100" font-family="'Barlow Condensed', 'Inter', 'Helvetica Neue', Arial, sans-serif" font-size="22" font-weight="600" fill="#94a3b8" letter-spacing="6">BRANDOCEAN</text>
  <text x="80" y="${startY}" font-family="'Barlow Condensed', 'Inter', 'Helvetica Neue', Arial, sans-serif" font-size="112" font-weight="700" fill="#0f172a" letter-spacing="-1">${tspans}</text>
  <text x="80" y="570" font-family="'Inter', 'Helvetica Neue', Arial, sans-serif" font-size="22" font-weight="500" fill="#64748b">Offerte · brandocean.nl</text>
</svg>`;
}
