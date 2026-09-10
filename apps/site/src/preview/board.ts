import type {
	Automations,
	Callout,
	ClientPreview,
	Level,
	Page,
	Section,
	Sitemap,
	StationAt,
} from "./types";

/**
 * Bouwt een Quickdraw-document (records) uit een ClientPreview: per sitemap
 * een boom van pagina-kaarten met daarin secties, verbonden met haakse
 * lijnen, plus titel, samenvatting, legenda en stickies (callouts) met een
 * pijl naar de sectie waar ze over gaan. Alles is een gewone shape, dus op
 * het bord verplaatsbaar, tekenbaar en te exporteren als PNG.
 *
 * Ids zijn deterministisch, zodat "opnieuw opbouwen" hetzelfde bord geeft.
 * Maten zijn schattingen (het canvas meet zelf pas in de browser); de
 * secties en stickies krijgen daarom wat lucht.
 */

type Rec = {
	id: string;
	typeName: "shape";
	type: "geo" | "text" | "line" | "arrow" | "note" | "image";
	x: number;
	y: number;
	rot: number;
	z: number;
	props: Record<string, unknown>;
};

type Asset = {
	id: string;
	typeName: "asset";
	src: string;
	w: number;
	h: number;
};

export type Snapshot = { document: { store: Record<string, Rec | Asset> } };

type Shot = { src: string; w: number; h: number };
type Shots = Record<string, Shot>;

// Schermafbeelding links van de kaart, op deze breedte; hoogte volgt.
const SHOT_W = 220;
const SHOT_GAP = 24;

type Box = { x: number; y: number; w: number; h: number };

/** Bounds van elk blok, om de camera erheen te sturen. */
export type BoardBounds = Record<"all" | "current" | "proposed", Box>;

/** Eén stap van de looproute, met de bounds waar de camera heen moet. */
export type StationBounds = { title: string; bounds: Box };

const COL_W = 300;
const COL_GAP = 40;
const ROW_GAP = 90;
const PAD = 10;
const HEAD_H = 52;
const SEC_GAP = 8;
const BLOCK_GAP = 320;

// Sticky: standaard 200px in Quickdraw; via onze patch krijgt hij een eigen
// breedte (props.w) en kun je hem met de zijhandvatten breder trekken.
const NOTE_W = 280;
const NOTE_PAD = 20;
const NOTE_FONT = 16;
const NOTE_GAP = 30; // ruimte tussen kolom en sticky
const AUTO_W = 400; // brede stickies in het automatiseringsblok
const AUTO_COLS = 3;
const AUTO_GAP = 20;

// Quickdraw-tekst: FONT_SIZES.s = 20px, geschaald met `scale`.
const BASE = 20;
const NAME_SCALE = 0.8; // 16px
const DESC_SCALE = 0.65; // 13px
const SMALL_SCALE = 0.55; // 11px
const LINE = 1.32;
const CHAR = 0.55; // gemiddelde tekenbreedte t.o.v. fontgrootte (sans), iets ruim zodat niets overlapt

const TAG_COLOR: Record<NonNullable<Section["tag"]>, string> = {
	nieuw: "yellow",
	verbeterd: "light-blue",
	behouden: "grey",
	weg: "light-red",
};

const TAG_TEXT: Record<NonNullable<Section["tag"]>, string> = {
	nieuw: "NIEUW",
	verbeterd: "VERBETERD",
	behouden: "BLIJFT",
	weg: "VERVALT",
};

const KIND_COLOR: Record<Callout["kind"], string> = {
	mist: "light-red",
	idee: "yellow",
	cijfer: "green",
	vraag: "light-blue",
	stap: "orange",
};

const KIND_LABEL: Record<Callout["kind"], string> = {
	mist: "WAT WE ZIEN",
	idee: "IDEE",
	cijfer: "FEIT",
	vraag: "VRAAG AAN JULLIE",
	stap: "ZO WERKEN WIJ",
};

let z = 0;
const nextZ = () => ++z;

function lines(text: string, fontPx: number, maxW: number): number {
	const perLine = Math.max(8, Math.floor(maxW / (fontPx * CHAR)));
	let n = 0;
	for (const para of text.split("\n")) {
		const words = para.split(/\s+/);
		let len = 0;
		let l = 1;
		for (const w of words) {
			if (len && len + 1 + w.length > perLine) {
				l++;
				len = w.length;
			} else len += (len ? 1 : 0) + w.length;
		}
		n += l;
	}
	return n;
}

function textH(text: string, scale: number, maxW: number): number {
	const px = BASE * scale;
	return lines(text, px, maxW) * px * LINE;
}

function noteH(text: string, w = NOTE_W): number {
	const h = lines(text, NOTE_FONT, w - NOTE_PAD * 2) * NOTE_FONT * 1.35;
	return Math.max(Math.min(200, w), h + NOTE_PAD * 2) + 10;
}

function shape(
	id: string,
	type: Rec["type"],
	x: number,
	y: number,
	props: Record<string, unknown>,
): Rec {
	return { id, typeName: "shape", type, x, y, rot: 0, z: nextZ(), props };
}

function geo(
	id: string,
	x: number,
	y: number,
	w: number,
	h: number,
	props: Record<string, unknown>,
): Rec {
	return shape(id, "geo", x, y, {
		geo: "rectangle",
		w,
		h,
		color: "grey",
		size: "s",
		strokeWidth: 1.5,
		dash: "solid",
		fill: "none",
		font: "sans",
		...props,
	});
}

function text(
	id: string,
	x: number,
	y: number,
	value: string,
	props: Record<string, unknown> = {},
): Rec {
	return shape(id, "text", x, y, {
		text: value,
		color: "black",
		size: "s",
		font: "sans",
		autosize: true,
		scale: 1,
		...props,
	});
}

function line(
	id: string,
	x: number,
	y: number,
	dx: number,
	dy: number,
	props: Record<string, unknown> = {},
	type: "line" | "arrow" = "line",
): Rec {
	return shape(id, type, x, y, {
		dx: dx || 0.01,
		dy: dy || 0.01,
		bend: 0,
		color: "grey",
		size: "s",
		dash: "solid",
		...props,
	});
}

function note(
	id: string,
	x: number,
	y: number,
	value: string,
	props: Record<string, unknown> = {},
): Rec {
	return shape(id, "note", x, y, {
		text: value,
		color: "yellow",
		size: "s",
		font: "sans",
		scale: 1,
		w: NOTE_W,
		...props,
	});
}

function image(
	out: Rec[],
	assets: Asset[],
	id: string,
	x: number,
	y: number,
	shot: Shot,
	w: number,
): number {
	const h = Math.round((shot.h * w) / shot.w);
	assets.push({
		id: `${id}-asset`,
		typeName: "asset",
		src: shot.src,
		w: shot.w,
		h: shot.h,
	});
	out.push(shape(id, "image", x, y, { assetId: `${id}-asset`, w, h }));
	return h;
}

// ---- callouts per pagina ---------------------------------------------------

type CalloutIndex = Map<string, Callout[]>;

function pageKey(target: string): string {
	return target.split("#")[0];
}

function indexCallouts(sm: Sitemap): {
	byPage: CalloutIndex;
	loose: Callout[];
} {
	const byPage: CalloutIndex = new Map();
	const loose: Callout[] = [];
	for (const c of sm.callouts ?? []) {
		if (!c.target) {
			loose.push(c);
			continue;
		}
		const k = pageKey(c.target);
		byPage.set(k, [...(byPage.get(k) ?? []), c]);
	}
	return { byPage, loose };
}

/** Ruimte links van de kaart voor de schermafbeelding. */
function shotW(p: Page, shots: Shots | undefined): number {
	return p.path && shots?.[p.path] ? SHOT_W + SHOT_GAP : 0;
}

/** Kolombreedte: schermafbeelding links, kaart, stickies rechts. */
function colW(p: Page, idx: CalloutIndex, shots: Shots | undefined): number {
	return (
		shotW(p, shots) +
		COL_W +
		(p.path && idx.has(p.path) ? NOTE_GAP + NOTE_W : 0)
	);
}

// ---- pagina-kaart ----------------------------------------------------------

function nameW(s: Section, showTags: boolean): number {
	return COL_W - PAD * 2 - 20 - (showTags && s.level ? 34 : 0);
}

function sectionHeight(s: Section, showTags: boolean): number {
	const inner = COL_W - PAD * 2 - 20;
	let h = 10 + textH(s.name, NAME_SCALE, nameW(s, showTags));
	if (s.description) h += 4 + textH(s.description, DESC_SCALE, inner);
	if (showTags && s.tag) h += 2 + BASE * SMALL_SCALE * LINE;
	return Math.ceil(h + 10);
}

function pageHeight(p: Page, showTags: boolean): number {
	let h = PAD + HEAD_H + PAD;
	if (p.note) h += BASE * SMALL_SCALE * LINE + 6;
	for (const s of p.sections) h += sectionHeight(s, showTags) + SEC_GAP;
	return h + PAD - SEC_GAP;
}

function subtreeWidth(
	p: Page,
	idx: CalloutIndex,
	shots: Shots | undefined,
): number {
	const kids = p.children ?? [];
	const own = colW(p, idx, shots);
	if (!kids.length) return own;
	const sum =
		kids.reduce((a, k) => a + subtreeWidth(k, idx, shots), 0) +
		COL_GAP * (kids.length - 1);
	return Math.max(own, sum);
}

/** Tekent één pagina-kaart; geeft de anchors (kaart + secties) terug. */
function emitPage(
	out: Rec[],
	id: string,
	p: Page,
	x: number,
	y: number,
	showTags: boolean,
	isRoot: boolean,
): { h: number; anchors: Map<string, Box> } {
	const anchors = new Map<string, Box>();
	const h = pageHeight(p, showTags);
	// root: primary (oranje), gewone pagina: accent met voorgrondtekst (zwart),
	// intern: chart-2 (violet). De kaart zelf is de card-kleur (grijs, solid).
	const headColor = p.internal ? "violet" : "black";

	out.push(
		geo(`${id}-card`, x, y, COL_W, h, {
			color: p.internal ? "violet" : "grey",
			dash: p.internal ? "dashed" : "solid",
			fill: p.internal ? "none" : "solid",
		}),
	);
	if (p.path) anchors.set(p.path, { x, y, w: COL_W, h: PAD + HEAD_H });
	out.push(
		geo(`${id}-head`, x + PAD, y + PAD, COL_W - PAD * 2, HEAD_H, {
			color: headColor,
			fill: "solid",
			label: (isRoot ? "⌂  " : p.internal ? "🔒  " : "") + p.title,
			labelSize: "s",
		}),
	);

	let cy = y + PAD + HEAD_H + PAD;
	if (p.note) {
		out.push(
			text(`${id}-note`, x + PAD + 4, cy, p.note, {
				scale: SMALL_SCALE,
				color: "light-red",
				font: "mono",
			}),
		);
		cy += BASE * SMALL_SCALE * LINE + 6;
	}

	p.sections.forEach((s, i) => {
		const sh = sectionHeight(s, showTags);
		const sid = `${id}-s${i}`;
		const tag = showTags ? s.tag : undefined;
		out.push(
			geo(sid, x + PAD, cy, COL_W - PAD * 2, sh, {
				color: tag ? TAG_COLOR[tag] : "black",
				fill: "none",
				dash: tag === "weg" ? "dashed" : "solid",
			}),
		);
		if (p.path)
			anchors.set(`${p.path}#${s.name}`, {
				x: x + PAD,
				y: cy,
				w: COL_W - PAD * 2,
				h: sh,
			});
		let ty = cy + 10;
		out.push(
			text(`${sid}-name`, x + PAD + 10, ty, s.name, {
				scale: NAME_SCALE,
				color: "black",
				autosize: false,
				w: nameW(s, showTags),
			}),
		);
		if (showTags && s.level) {
			out.push(
				text(`${sid}-lvl`, x + COL_W - PAD - 34, ty + 2, `N${s.level}`, {
					scale: SMALL_SCALE,
					font: "mono",
					color: "orange",
				}),
			);
		}
		ty += textH(s.name, NAME_SCALE, nameW(s, showTags)) + 4;
		if (s.description) {
			out.push(
				text(`${sid}-desc`, x + PAD + 10, ty, s.description, {
					scale: DESC_SCALE,
					color: "black",
					autosize: false,
					w: COL_W - PAD * 2 - 20,
				}),
			);
			ty += textH(s.description, DESC_SCALE, COL_W - PAD * 2 - 20) + 2;
		}
		if (tag) {
			out.push(
				text(`${sid}-tag`, x + PAD + 10, ty, TAG_TEXT[tag], {
					scale: SMALL_SCALE,
					font: "mono",
					color: TAG_COLOR[tag],
				}),
			);
		}
		cy += sh + SEC_GAP;
	});

	return { h, anchors };
}

/** Stickies rechts van de kaart, elk met een pijl naar zijn sectie. */
function emitCallouts(
	out: Rec[],
	id: string,
	callouts: Callout[],
	cardX: number,
	cardTop: number,
	anchors: Map<string, Box>,
): number {
	const nx = cardX + COL_W + NOTE_GAP;
	let cursor = cardTop;
	let bottom = cardTop;
	callouts.forEach((c, i) => {
		const target = c.target ? anchors.get(c.target) : undefined;
		const anchor = target ?? anchors.get(pageKey(c.target ?? ""));
		const wantY = anchor ? anchor.y - 6 : cursor;
		const ny = Math.max(cursor, wantY);
		const body = `${KIND_LABEL[c.kind]}\n${c.text}`;
		const h = noteH(body);
		out.push(note(`${id}-c${i}`, nx, ny, body, { color: KIND_COLOR[c.kind] }));
		if (anchor) {
			// pijl van de linkerrand van de sticky naar de rechterrand van de sectie
			const ax = anchor.x + anchor.w + 4;
			const ay = anchor.y + Math.min(anchor.h / 2, 30);
			const sx = nx - 4;
			const sy = ny + Math.min(h / 2, 40);
			out.push(
				line(
					`${id}-c${i}-arrow`,
					sx,
					sy,
					ax - sx,
					ay - sy,
					{
						color: KIND_COLOR[c.kind],
						size: "s",
						dash: "solid",
						bend: -14,
					},
					"arrow",
				),
			);
		}
		cursor = ny + h + 12;
		bottom = Math.max(bottom, ny + h);
	});
	return bottom;
}

/** Legt een boom neer; geeft de hoogte van de hele boom terug. */
function emitTree(
	out: Rec[],
	assets: Asset[],
	id: string,
	p: Page,
	left: number,
	top: number,
	showTags: boolean,
	isRoot: boolean,
	idx: CalloutIndex,
	shots: Shots | undefined,
): { w: number; h: number } {
	const w = subtreeWidth(p, idx, shots);
	const own = colW(p, idx, shots);
	const slotX = left + (w - own) / 2;
	const x = slotX + shotW(p, shots);
	const { h, anchors } = emitPage(out, id, p, x, top, showTags, isRoot);
	let bottom = top + h;

	// schermafbeelding van de huidige pagina, links van de kaart
	const shot = p.path ? shots?.[p.path] : undefined;
	if (shot) {
		const ih = image(out, assets, `${id}-shot`, slotX, top, shot, SHOT_W);
		out.push(
			text(`${id}-shot-cap`, slotX, top + ih + 6, "zoals het nu is", {
				font: "mono",
				scale: SMALL_SCALE,
				color: "black",
			}),
		);
		bottom = Math.max(bottom, top + ih + 24);
	}

	const mine = p.path ? idx.get(p.path) : undefined;
	if (mine?.length) {
		bottom = Math.max(bottom, emitCallouts(out, id, mine, x, top, anchors));
	}

	const kids = p.children ?? [];
	if (!kids.length) return { w, h: bottom - top };

	const rowTop = bottom + ROW_GAP;
	const midY = bottom + ROW_GAP / 2;
	const totalKids =
		kids.reduce((a, k) => a + subtreeWidth(k, idx, shots), 0) +
		COL_GAP * (kids.length - 1);
	let kx = left + (w - totalKids) / 2;
	let maxBottom = rowTop;
	const centers: number[] = [];

	kids.forEach((k, i) => {
		const kw = subtreeWidth(k, idx, shots);
		const r = emitTree(
			out,
			assets,
			`${id}-${i}`,
			k,
			kx,
			rowTop,
			showTags,
			false,
			idx,
			shots,
		);
		// het midden van de kaart, niet van het slot (foto en stickies tellen niet mee)
		centers.push(
			kx + (kw - colW(k, idx, shots)) / 2 + shotW(k, shots) + COL_W / 2,
		);
		maxBottom = Math.max(maxBottom, rowTop + r.h);
		kx += kw + COL_GAP;
	});

	// haakse verbindingen: ouder omlaag, balk over de kinderen, per kind omlaag
	const px = x + COL_W / 2;
	out.push(line(`${id}-l-down`, px, top + h, 0, midY - (top + h)));
	const minC = Math.min(px, ...centers);
	const maxC = Math.max(px, ...centers);
	if (maxC - minC > 1)
		out.push(line(`${id}-l-bar`, minC, midY, maxC - minC, 0));
	centers.forEach((c, i) => {
		out.push(line(`${id}-l-${i}`, c, midY, 0, rowTop - midY));
	});

	return { w, h: maxBottom - top };
}

// ---- blokken per sitemap ---------------------------------------------------

function emitSitemapBlock(
	out: Rec[],
	assets: Asset[],
	id: string,
	sm: Sitemap,
	left: number,
	top: number,
	showTags: boolean,
	levels: Record<Level, string> | undefined,
	shots: Shots | undefined,
): { w: number; h: number; story: Box; tree: Box; loose: Box | null } {
	const { byPage, loose } = indexCallouts(sm);
	const treeW = subtreeWidth(sm.root, byPage, shots);

	// kop van het blok: titel, samenvatting in één regel, het verhaal in alinea's
	out.push(
		text(`${id}-title`, left, top, sm.label.toUpperCase(), {
			size: "xl",
			color: "orange",
		}),
	);
	const storyW = 520;
	let sy = top + 74;
	out.push(
		text(`${id}-summary`, left, sy, sm.summary, {
			scale: 0.9,
			color: "black",
			autosize: false,
			w: storyW,
		}),
	);
	sy += textH(sm.summary, 0.9, storyW) + 18;
	(sm.story ?? []).forEach((para, i) => {
		out.push(
			text(`${id}-story${i}`, left, sy, para, {
				scale: 0.75,
				color: "black",
				autosize: false,
				w: storyW,
			}),
		);
		sy += textH(para, 0.75, storyW) + 12;
	});

	let cx = left + storyW + 60;
	let headBottom = sy;

	if (showTags) {
		let ly = top + 70;
		const items: [string, string][] = [
			["yellow", "Nieuw"],
			["light-blue", "Verbeterd"],
			["black", "Blijft"],
		];
		items.forEach(([c, label], i) => {
			out.push(
				geo(`${id}-lg${i}`, cx, ly, 18, 18, { color: c, fill: "solid" }),
			);
			out.push(
				text(`${id}-lgt${i}`, cx + 28, ly - 2, label, { scale: NAME_SCALE }),
			);
			ly += 30;
		});
		if (levels) {
			ly += 10;
			(Object.keys(levels) as unknown as Level[]).forEach((k) => {
				out.push(
					text(`${id}-lv${k}`, cx, ly - 2, `N${k}  ${levels[k]}`, {
						scale: NAME_SCALE,
						font: "mono",
						color: "orange",
					}),
				);
				ly += 30;
			});
		}
		headBottom = Math.max(headBottom, ly);
		cx += 260;
	}

	// losse stickies (werkwijze, feiten, vragen) in drie kolommen naast de kop
	let looseBox: Box | null = null;
	const LOOSE_COLS = 3;
	if (loose.length) {
		const colY = Array.from({ length: LOOSE_COLS }, () => top + 70);
		loose.forEach((c, i) => {
			const col = i % LOOSE_COLS;
			const nx = cx + col * (NOTE_W + 20);
			const body = `${KIND_LABEL[c.kind]}\n${c.text}`;
			const h = noteH(body);
			out.push(
				note(`${id}-loose${i}`, nx, colY[col], body, {
					color: KIND_COLOR[c.kind],
				}),
			);
			colY[col] += h + 16;
		});
		headBottom = Math.max(headBottom, ...colY);
		looseBox = {
			x: cx,
			y: top + 70,
			w: NOTE_W * LOOSE_COLS + 20 * (LOOSE_COLS - 1),
			h: Math.max(...colY) - (top + 70),
		};
	}

	const treeTop = headBottom + 170;
	const r = emitTree(
		out,
		assets,
		`${id}-p`,
		sm.root,
		left,
		treeTop,
		showTags,
		true,
		byPage,
		shots,
	);
	const headW =
		cx +
		(loose.length ? NOTE_W * LOOSE_COLS + 20 * (LOOSE_COLS - 1) : 0) -
		left;
	return {
		w: Math.max(treeW, headW),
		h: treeTop + r.h - top,
		story: { x: left, y: top, w: storyW, h: sy - top },
		tree: { x: left, y: treeTop, w: treeW, h: r.h },
		loose: looseBox,
	};
}

/** Losstaand blok: kop, korte alinea, brede stickies onder elkaar, één regel eronder. */
function emitAutomations(
	out: Rec[],
	id: string,
	a: Automations,
	left: number,
	top: number,
): Box {
	out.push(
		text(`${id}-title`, left, top, a.title.toUpperCase(), {
			size: "xl",
			color: "orange",
		}),
	);
	const blockW = AUTO_W * AUTO_COLS + AUTO_GAP * (AUTO_COLS - 1);
	const introW = Math.min(blockW, 760);
	let y = top + 74;
	out.push(
		text(`${id}-intro`, left, y, a.intro, {
			scale: 0.9,
			color: "black",
			autosize: false,
			w: introW,
		}),
	);
	y += textH(a.intro, 0.9, introW) + 40;
	// stickies in kolommen; elke nieuwe sticky komt in de kolom die het minst vol is
	const colY = Array.from({ length: AUTO_COLS }, () => y);
	a.items.forEach((it, i) => {
		const lvl = it.level ? `  ·  N${it.level}` : "";
		const body = `AUTOMATISCH${lvl}\n${it.name}\n${it.text}`;
		const h = noteH(body, AUTO_W);
		const col = colY.indexOf(Math.min(...colY));
		const nx = left + col * (AUTO_W + AUTO_GAP);
		out.push(
			note(`${id}-a${i}`, nx, colY[col], body, { color: "green", w: AUTO_W }),
		);
		colY[col] += h + 16;
	});
	y = Math.max(...colY);
	if (a.footer) {
		y += 14;
		out.push(
			text(`${id}-footer`, left, y, a.footer, {
				font: "mono",
				scale: 0.7,
				color: "orange",
				autosize: false,
				w: introW,
			}),
		);
		y += textH(a.footer, 0.7, introW);
	}
	return { x: left, y: top, w: blockW, h: y - top };
}

export function buildBoard(preview: ClientPreview): {
	snapshot: Snapshot;
	bounds: BoardBounds;
	stations: StationBounds[];
} {
	z = 0;
	const out: Rec[] = [];
	const assets: Asset[] = [];
	const slug = preview.slug;

	// intro-blok linksboven
	const introW = 640;
	out.push(
		text(`${slug}-brand`, 0, 0, `BRANDOCEAN  ·  voor ${preview.client}`, {
			font: "mono",
			scale: 0.7,
			color: "orange",
		}),
	);
	out.push(
		text(`${slug}-h1`, 0, 36, preview.title, { size: "xl", color: "black" }),
	);
	out.push(
		text(`${slug}-intro`, 0, 110, preview.intro, {
			scale: 0.85,
			color: "black",
			autosize: false,
			w: introW,
		}),
	);
	const introH = 110 + textH(preview.intro, 0.85, introW) + 20;
	out.push(
		text(`${slug}-date`, 0, introH, preview.date, {
			font: "mono",
			scale: SMALL_SCALE,
			color: "black",
		}),
	);

	const blocksTop = introH + 220;
	const cur = emitSitemapBlock(
		out,
		assets,
		`${slug}-nu`,
		preview.current,
		0,
		blocksTop,
		false,
		undefined,
		preview.shots,
	);
	const propLeft = cur.w + BLOCK_GAP;
	const prop = emitSitemapBlock(
		out,
		assets,
		`${slug}-straks`,
		preview.proposed,
		propLeft,
		blocksTop,
		true,
		preview.levels,
		undefined,
	);

	// losstaand blok rechts van straks: wat we automatiseren
	let auto: Box | null = null;
	if (preview.automations) {
		const autoLeft = propLeft + prop.w + BLOCK_GAP;
		auto = emitAutomations(
			out,
			`${slug}-auto`,
			preview.automations,
			autoLeft,
			blocksTop,
		);
		out.push(
			line(
				`${slug}-divider2`,
				autoLeft - BLOCK_GAP / 2,
				blocksTop - 40,
				0,
				Math.max(cur.h, prop.h, auto.h) + 80,
				{ dash: "dotted", color: "grey" },
			),
		);
	}

	// scheidingslijn tussen nu en straks
	out.push(
		line(
			`${slug}-divider`,
			propLeft - BLOCK_GAP / 2,
			blocksTop - 40,
			0,
			Math.max(cur.h, prop.h) + 80,
			{ dash: "dotted", color: "grey" },
		),
	);

	// looproute: genummerde koppen boven de plekken, pijlen naar de volgende
	const places: Record<StationAt, Box | null> = {
		intro: { x: 0, y: 0, w: introW, h: introH + 20 },
		"nu-story": cur.story,
		"nu-tree": cur.tree,
		"straks-story": prop.story,
		"straks-tree": prop.tree,
		"straks-loose": prop.loose,
		automations: auto,
	};
	const stations: StationBounds[] = [];
	const labelW = 560;
	(preview.walkthrough ?? []).forEach((st, i) => {
		const at = places[st.at];
		if (!at) return;
		const lx = at.x;
		const ly = at.y - 130;
		out.push(
			text(`${slug}-st${i}-n`, lx, ly, `${i + 1}`, {
				size: "xl",
				color: "orange",
			}),
		);
		out.push(
			text(`${slug}-st${i}-t`, lx + 46, ly + 8, st.title, {
				size: "l",
				color: "black",
			}),
		);
		out.push(
			text(`${slug}-st${i}-l`, lx + 46, ly + 60, st.line, {
				scale: 0.85,
				color: "black",
				autosize: false,
				w: labelW,
			}),
		);
		const label: Box = {
			x: lx,
			y: ly,
			w: labelW + 46,
			h: 60 + textH(st.line, 0.85, labelW),
		};
		const x0 = Math.min(label.x, at.x) - 40;
		// extra lucht boven de kop, anders valt hij achter de knoppenbalk
		const y0 = label.y - 160;
		const x1 = Math.max(label.x + label.w, at.x + at.w) + 40;
		const y1 = at.y + at.h + 40;
		stations.push({
			title: st.title,
			bounds: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
		});
	});

	const store: Record<string, Rec | Asset> = {};
	for (const a of assets) store[a.id] = a;
	for (const r of out) store[r.id] = r;

	const bounds: BoardBounds = {
		current: { x: -40, y: blocksTop - 40, w: cur.w + 80, h: cur.h + 80 },
		proposed: {
			x: propLeft - 40,
			y: blocksTop - 40,
			w: prop.w + 80,
			h: prop.h + 80,
		},
		all: {
			x: -40,
			y: -40,
			w: (auto ? auto.x + auto.w : propLeft + prop.w) + 80,
			h: blocksTop + Math.max(cur.h, prop.h, auto?.h ?? 0) + 80,
		},
	};

	return { snapshot: { document: { store } }, bounds, stations };
}
