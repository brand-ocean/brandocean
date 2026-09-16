/**
 * De kleuren van het bord: de pagina-kaart (rand, vulling, kopvulling) en de
 * toon van alles eromheen: de labels NIEUW / VERBETERD / VERVALT, de stickies
 * (idee, vraag, wat we zien, feit, zo werken wij), interne pagina's en het
 * accent. Die kleuren houden hun betekenis (geel blijft geel-achtig, blauw
 * blauw-achtig) maar zijn gedempt en licht naar het zand getrokken, zodat
 * alles bij elkaar past: "Steen". Tekst blijft zwart. Licht en donker apart.
 *
 * In Quickdraw is de kaart kleur `grey` (stroke = rand, fill = vulling) en
 * de kop kleur `black` met solid fill (fill = kopvulling, stroke = tekst).
 */

export type CardColors = { border: string; fill: string; head: string };

export const BOARD_COLORS: Record<"light" | "dark", CardColors> = {
	light: { border: "#b8b4a8", fill: "#f7f6f2", head: "#e0ddd4" },
	dark: { border: "#5c594f", fill: "#262624", head: "#383732" },
};

/** Basistint (oklch-hue) waar de bordkleuren naartoe schuiven: het zand. */
const BASE_HUE = 80;
/** Verzadiging van de bordkleuren, 1 = vol. */
const CHROMA = 0.6;
/** Hoeveel graden de bordkleuren hoogstens richting de basistint schuiven. */
const PULL = 12;

/**
 * De betekenis van elke Quickdraw-kleur op het bord, als basistint. Zie
 * board.ts: geel = nieuw / idee, lichtblauw = verbeterd / vraag, lichtrood =
 * vervalt / wat we zien, groen = feit / automatisering, oranje = accent /
 * zo werken wij, violet = interne pagina.
 */
const SLOT_HUE: Record<string, number> = {
	yellow: 88,
	"light-blue": 240,
	"light-red": 22,
	green: 155,
	orange: 45,
	violet: 300,
	blue: 255,
	"light-violet": 315,
	"light-green": 140,
	red: 25,
};

export type SlotColor = { stroke: string; fill: string; note: string };

/**
 * Alle bordkleuren voor een thema: per slot rand (ook tekst van labels),
 * vulling en stickypapier, als oklch-strings. Canvas begrijpt die
 * rechtstreeks.
 */
export function boardPalette(
	theme: "light" | "dark",
): Record<string, SlotColor> {
	const out: Record<string, SlotColor> = {};
	for (const [slot, hue] of Object.entries(SLOT_HUE)) {
		// het accent (oranje, het merk) schuift niet mee; de rest hoogstens PULL
		const h = slot === "orange" ? hue : pullHue(hue, BASE_HUE, PULL);
		out[slot] =
			theme === "light"
				? {
						stroke: oklch(0.6, 0.14 * CHROMA, h),
						fill: oklch(0.965, 0.025 * CHROMA, h),
						note: oklch(0.91, 0.075 * CHROMA, h),
					}
				: {
						stroke: oklch(0.72, 0.13 * CHROMA, h),
						fill: oklch(0.3, 0.035 * CHROMA, h),
						note: oklch(0.86, 0.08 * CHROMA, h),
					};
	}
	return out;
}

/** Schuift een tint hoogstens `max` graden richting `to`, de korte kant op. */
function pullHue(h: number, to: number, max: number): number {
	let d = ((to - h + 540) % 360) - 180;
	d = Math.max(-max, Math.min(max, d));
	return (h + d + 360) % 360;
}

function oklch(l: number, c: number, h: number): string {
	return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
}
