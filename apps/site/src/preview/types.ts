/**
 * Datamodel voor een sitemap-preview: een klant, twee sitemaps (nu en
 * straks), elke sitemap een boom van pagina's met daarin secties. Bewust
 * plat en serialiseerbaar, zodat dit later 1:1 in een Convex-tabel past.
 */

export type SectionTag = "nieuw" | "verbeterd" | "behouden" | "weg";

/** Niveau uit het voorstel: 1 site, 2 werkplek parkmanager, 3 gebiedsplatform. */
export type Level = 1 | 2 | 3;

export type Section = {
	name: string;
	description?: string;
	tag?: SectionTag;
	level?: Level;
};

export type Page = {
	title: string;
	/** Pad op de site, alleen ter informatie. */
	path?: string;
	/** Korte opmerking onder de paginatitel, bv. "404 vanuit het menu". */
	note?: string;
	/** Intern / niet publiek (dashboard, portaal). Wordt gestippeld getekend. */
	internal?: boolean;
	sections: Section[];
	children?: Page[];
};

/**
 * Sticky op het bord. `target` wijst naar een pagina ("/bedrijven") of een
 * sectie daarin ("/bedrijven#Logo-grid"); zonder target komt de sticky in
 * het ideeënvak naast de kop van het blok.
 */
export type Callout = {
	kind: "mist" | "idee" | "cijfer" | "vraag" | "stap";
	text: string;
	target?: string;
};

export type Sitemap = {
	/** Naam van de weergave, bv. "Nu" of "Straks". */
	label: string;
	/** Eén alinea die deze weergave samenvat. */
	summary: string;
	root: Page;
	/** Twee of drie korte alinea's die het verhaal van deze weergave vertellen. */
	story?: string[];
	callouts?: Callout[];
};

/** Plek op het bord waar een stap van de looproute aan hangt. */
export type StationAt =
	| "intro"
	| "nu-story"
	| "nu-tree"
	| "straks-story"
	| "straks-tree"
	| "straks-loose"
	| "automations";

/** Eén stap in het gesprek: grote kop op het bord, één regel eronder. */
export type Station = {
	at: StationAt;
	title: string;
	line: string;
};

/** Eén ding dat we automatiseren: kop, wat het doet, in welke fase. */
export type Automation = {
	name: string;
	text: string;
	level?: Level;
};

/** Losstaand blok op het bord: alles wat nu handwerk is en straks vanzelf gaat. */
export type Automations = {
	title: string;
	intro: string;
	items: Automation[];
	/** Eén regel onder de lijst, bv. waar het op gebouwd is. */
	footer?: string;
};

export type ClientPreview = {
	slug: string;
	client: string;
	/** Titel van de preview, bv. "goudsepoort.nl, nu en straks". */
	title: string;
	/** Datum als tekst, bv. "9 september 2026". */
	date: string;
	intro: string;
	/** Website die is onderzocht. */
	site?: string;
	/** Schermafbeeldingen van de huidige site per pad, uit scripts/preview-shots.ts. */
	shots?: Record<string, { src: string; w: number; h: number }>;
	current: Sitemap;
	proposed: Sitemap;
	levels?: Record<Level, string>;
	automations?: Automations;
	/** De volgorde waarin je het bord doorloopt tijdens het gesprek. */
	walkthrough?: Station[];
};
