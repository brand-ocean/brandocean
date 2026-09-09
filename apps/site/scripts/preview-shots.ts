/**
 * Schermafbeeldingen van de huidige site van een klant, per pagina, hele
 * pagina hoog. Draait met een zichtbare Chrome zodat je kunt meekijken.
 *
 *   bun scripts/preview-shots.ts goudse-poort
 *
 * Leest de paden uit `src/preview/clients/<slug>.ts` (sitemap "current"),
 * schrijft JPEG's naar `public/preview/<slug>/` en een manifest naar
 * `src/preview/clients/<slug>.shots.json` dat het bord inleest.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import type { ClientPreview, Page } from "../src/preview/types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WIDTH = 1280;
const OUT_W = 640; // opgeslagen breedte; het bord schaalt verder

const slug = process.argv[2];
if (!slug) {
	console.error("gebruik: bun scripts/preview-shots.ts <slug>");
	process.exit(1);
}

const mod = (await import(`../src/preview/clients/${slug}.ts`)) as Record<
	string,
	ClientPreview
>;
const preview = Object.values(mod).find((v) => v && v.slug === slug);
if (!preview?.site) {
	console.error(`geen preview met site voor slug ${slug}`);
	process.exit(1);
}

const pages: Page[] = [];
const walk = (p: Page) => {
	pages.push(p);
	for (const c of p.children ?? []) walk(c);
};
walk(preview.current.root);

const outDir = path.resolve(HERE, "../public/preview", slug);
await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
	executablePath: CHROME,
	headless: false,
	defaultViewport: { width: WIDTH, height: 900, deviceScaleFactor: 1 },
	args: ["--window-size=1320,1000", "--hide-scrollbars"],
});
const tab = await browser.newPage();

const manifest: Record<string, { src: string; w: number; h: number }> = {};

for (const p of pages) {
	if (!p.path) continue;
	const url = `https://${preview.site}${p.path === "/" ? "/" : p.path}`;
	const file = `${p.path === "/" ? "home" : p.path.replace(/^\//, "").replace(/\//g, "_")}.jpg`;
	process.stdout.write(`${url} … `);
	try {
		// terug naar de standaardhoogte, anders erft de pagina de hoogte van de vorige
		await tab.setViewport({ width: WIDTH, height: 900, deviceScaleFactor: 1 });
		await tab.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
		// lazy images en animaties een kans geven
		await tab.evaluate(async () => {
			await new Promise<void>((done) => {
				let y = 0;
				const step = () => {
					y += 800;
					window.scrollTo(0, y);
					if (y < document.body.scrollHeight) setTimeout(step, 120);
					else {
						window.scrollTo(0, 0);
						setTimeout(done, 300);
					}
				};
				step();
			});
		});
		const height = await tab.evaluate(() =>
			Math.min(
				Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
				6000,
			),
		);
		await tab.setViewport({ width: WIDTH, height, deviceScaleFactor: 1 });
		const buf = await tab.screenshot({
			type: "jpeg",
			quality: 72,
			fullPage: false,
		});
		// downscale naar OUT_W met een canvas in de pagina zelf (geen extra deps)
		const dataUrl = await tab.evaluate(
			async (b64: string, w: number) => {
				const img = new Image();
				img.src = `data:image/jpeg;base64,${b64}`;
				await img.decode();
				const scale = w / img.width;
				const c = document.createElement("canvas");
				c.width = w;
				c.height = Math.round(img.height * scale);
				c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
				return c.toDataURL("image/jpeg", 0.8);
			},
			Buffer.from(buf).toString("base64"),
			OUT_W,
		);
		const jpg = Buffer.from(dataUrl.split(",")[1], "base64");
		await writeFile(path.join(outDir, file), jpg);
		manifest[p.path] = {
			src: `/preview/${slug}/${file}`,
			w: OUT_W,
			h: Math.round((height * OUT_W) / WIDTH),
		};
		console.log(`ok (${height}px hoog)`);
	} catch (e) {
		console.log(`mislukt: ${(e as Error).message}`);
	}
}

await browser.close();
await writeFile(
	path.resolve(HERE, "../src/preview/clients", `${slug}.shots.json`),
	`${JSON.stringify(manifest, null, "\t")}\n`,
);
console.log(`${Object.keys(manifest).length} schermafbeeldingen, manifest geschreven.`);
