import {
	type ComponentType,
	type MouseEvent as ReactMouseEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Flash, type Rect, SearchPalette, Spotlight } from "./BoardExtras";
import BrandMenu, { type MenuEntry } from "./BrandMenu";
import {
	type BoardBounds,
	buildBoard,
	type CardRef,
	type Snapshot,
	type StationBounds,
} from "./board";
import { BOARD_COLORS, boardPalette } from "./cardColors";
import menuStyles from "./Menu.module.css";
import styles from "./PreviewBoard.module.css";
import "./theme.css";
import type { ClientPreview, Level } from "./types";

type Theme = "dark" | "light";
type Grid = "none" | "lines" | "dots";

const THEME_KEY = "bo-preview-theme";
const GRID_KEY = "bo-preview-grid";

/** Waar de klant ons bereikt vanaf de afsluiter van de deelversie. */
const CONTACT = {
	mail: "info@brandocean.nl",
	phone: "+31 6 41 32 47 21",
	whatsapp: "31641324721",
};

/**
 * Fase van de deelversie: welkomstkaart, route (stap voor stap), vrij
 * rondkijken, of de afsluiter met de vraag om af te spreken.
 */
type Phase = "welcome" | "tour" | "free" | "closing";

/** Wat de tabs bovenin aanwijzen: de route, of één van de blokken. */
type View = "route" | keyof BoardBounds;

/**
 * Het whiteboard: Quickdraw (canvas, pan/zoom, tekenen, stickies, PNG) met
 * daarop de sitemap "nu" en "straks" als shapes. Eigen chrome bovenin: een
 * tabwisselaar (Route / Nu / Straks / Alles), opnieuw opbouwen, delen.
 * Rechtermuisknop geeft een menu met thema, raster, passend maken en
 * PNG-export.
 *
 * Met `share` is het de kijkversie voor de klant (/preview/<slug>): het bord is alleen te
 * bekijken (slepen en zoomen, niet tekenen of verplaatsen), een welkomstkaart
 * legt uit wat het is, een gids onderin loopt de route stap voor stap, en na
 * de laatste stap komt de vraag: zullen we afspreken? Wat de klant op zijn
 * scherm doet wordt niet bewaard; hij ziet altijd het verse bord.
 *
 * Quickdraw raakt `document` bij import, dus de component laadt pas in de
 * browser. Buiten de deelversie wordt het bord per klant én per versie van
 * de data in localStorage bewaard: wat je tijdens een gesprek verschuift of
 * tekent, staat er bij de volgende keer nog; verandert de data, dan komt er
 * een vers bord.
 */
export default function PreviewBoard({
	preview,
	share = false,
	focus,
	stap,
}: {
	preview: ClientPreview;
	share?: boolean;
	/** Shape-id uit een deellink (?focus=): daarheen vliegen en oplichten. */
	focus?: string;
	/** Stap uit een deellink (?stap=), 1-gebaseerd: de route daar starten. */
	stap?: number;
}) {
	const [Quickdraw, setQuickdraw] =
		useState<ComponentType<QuickdrawProps> | null>(null);
	const editorRef = useRef<QuickdrawEditor | null>(null);
	const boundsRef = useRef<BoardBounds | null>(null);
	const stationsRef = useRef<StationBounds[]>([]);
	const [step, setStep] = useState(-1);
	const [view, setView] = useState<View>(share ? "all" : "proposed");
	const [phase, setPhase] = useState<Phase>(share ? "welcome" : "free");
	const [initial, setInitial] = useState<Snapshot | null>(null);
	const [ready, setReady] = useState(false);
	const [theme, setThemeState] = useState<Theme>("light");
	const [grid, setGridState] = useState<Grid>("none");
	const [menu, setMenu] = useState<{
		x: number;
		y: number;
		card: CardRef | null;
	} | null>(null);
	const [copied, setCopied] = useState(false);

	// extra's: spotlight, niveaufilter, zoeken, oplichten
	const cardsRef = useRef<CardRef[]>([]);
	const [camTick, setCamTick] = useState(0);
	const [spot, setSpot] = useState<"off" | "hover" | "pinned">("off");
	const [spotCard, setSpotCard] = useState<CardRef | null>(null);
	const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
	const [levels, setLevels] = useState<Set<Level> | null>(null);
	const unfilteredRef = useRef<Snapshot | null>(null);
	const [search, setSearch] = useState(false);
	const [flash, setFlash] = useState<CardRef | null>(null);
	const storageKey = `bo-preview-board:${preview.slug}:${hash(JSON.stringify(preview))}`;

	useEffect(() => {
		let alive = true;
		try {
			const t = localStorage.getItem(THEME_KEY);
			if (t === "light" || t === "dark") setThemeState(t);
			const g = localStorage.getItem(GRID_KEY);
			if (g === "none" || g === "lines" || g === "dots") setGridState(g);
		} catch {
			// geen opslag: standaard licht zonder raster
		}
		Promise.all([
			import("@quickdrawjs/react"),
			import("@quickdrawjs/core/quickdraw.css"),
		]).then(async ([mod]) => {
			if (!alive) return;
			applyPalette(mod.THEMES as Palette);
			applyBoardColors(mod.THEMES as Palette);
			await applyFonts(mod.FONTS as Fonts);
			if (!alive) return;
			const built = buildBoard(preview);
			boundsRef.current = built.bounds;
			stationsRef.current = built.stations;
			cardsRef.current = built.cards;
			let snap: Snapshot = built.snapshot;
			if (!share) {
				try {
					const saved = localStorage.getItem(storageKey);
					if (saved) snap = JSON.parse(saved) as Snapshot;
				} catch {
					// geen opslag beschikbaar: gewoon vers opbouwen
				}
			}
			setInitial(snap);
			setQuickdraw(() => mod.Quickdraw as ComponentType<QuickdrawProps>);
		});
		return () => {
			alive = false;
		};
	}, [preview, storageKey, share]);

	// menu sluit bij klik elders of Escape
	useEffect(() => {
		if (!menu) return;
		const close = () => setMenu(null);
		const key = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		window.addEventListener("pointerdown", close);
		window.addEventListener("keydown", key);
		return () => {
			window.removeEventListener("pointerdown", close);
			window.removeEventListener("keydown", key);
		};
	}, [menu]);

	const saveTimer = useRef<number | null>(null);
	const persist = (editor: QuickdrawEditor) => {
		if (share || unfilteredRef.current) return;
		if (saveTimer.current) window.clearTimeout(saveTimer.current);
		saveTimer.current = window.setTimeout(() => {
			try {
				localStorage.setItem(
					storageKey,
					JSON.stringify(editor.store.getSnapshot()),
				);
			} catch {
				// opslag vol of geblokkeerd: negeren
			}
		}, 400);
	};

	const setTheme = (t: Theme) => {
		setThemeState(t);
		try {
			localStorage.setItem(THEME_KEY, t);
		} catch {
			// niet op te slaan, wel toegepast
		}
	};

	const setGrid = (g: Grid) => {
		setGridState(g);
		try {
			localStorage.setItem(GRID_KEY, g);
		} catch {
			// idem
		}
	};

	const goTo = (key: keyof BoardBounds) => {
		const ed = editorRef.current;
		const b = boundsRef.current?.[key];
		if (!ed || !b) return;
		setStep(-1);
		setView(key);
		if (share) setPhase("free");
		showBounds(ed, b, { animate: 350 });
	};

	// looproute: stap voor stap door het bord, ook met de pijltjestoetsen
	const goStep = (i: number) => {
		const ed = editorRef.current;
		const st = stationsRef.current[i];
		if (!ed || !st) return;
		setStep(i);
		setView("route");
		if (share) setPhase("tour");
		showBounds(ed, st.bounds, { animate: 400 });
	};
	const stepCount = stationsRef.current.length;
	const lastStep = step >= stepCount - 1;
	const resumeRoute = () => goStep(step < 0 ? 0 : step);

	const next = () => {
		if (share && lastStep) {
			setPhase("closing");
			return;
		}
		goStep(Math.min(stepCount - 1, step + 1));
	};
	const prev = () => goStep(Math.max(0, step - 1));

	const onArrow = (e: KeyboardEvent) => {
		const t = e.target as HTMLElement | null;
		if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
		if (e.key === "ArrowRight" || e.key === "PageDown") {
			e.preventDefault();
			if (share && phase !== "tour") {
				if (phase !== "closing") resumeRoute();
				return;
			}
			next();
		} else if (e.key === "ArrowLeft" || e.key === "PageUp") {
			e.preventDefault();
			if (share && phase === "closing") {
				goStep(stepCount - 1);
				return;
			}
			prev();
		}
	};

	// Buiten de deelversie: pijltjes op window. In de deelversie in de
	// capture-fase, vóór Quickdraw: dat luistert op zijn container naar
	// sneltoetsen (tekenen, tekst, Escape terug naar selecteren) en die
	// houden we tegen; alleen de pijltjes en Escape doen iets.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				e.stopPropagation();
				setSearch((v) => !v);
				return;
			}
			if (e.key === "Escape" && (search || spot !== "off")) {
				setSearch(false);
				setSpot("off");
				e.stopPropagation();
				return;
			}
			if (!share) {
				onArrow(e);
				return;
			}
			if (e.key === "Tab" || e.metaKey || e.ctrlKey) return;
			if (e.key === "Escape" && phase === "closing") setPhase("free");
			else onArrow(e);
			e.stopPropagation();
		};
		// altijd in de capture-fase, zodat ⌘K en Escape vóór Quickdraw komen
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	});

	// ---- bord → scherm, en alles wat bij de camera meebeweegt ----------------

	/** Schermrechthoek van een bordbox, met de huidige camera. */
	const toScreen = (b: {
		x: number;
		y: number;
		w: number;
		h: number;
	}): Rect | null => {
		const ed = editorRef.current;
		if (!ed) return null;
		const a = ed.pageToScreen(b.x, b.y);
		const z = ed.camera.z;
		return { x: a.x, y: a.y, w: b.w * z, h: b.h * z };
	};

	/** De kleinste kaart (sectie vóór pagina) op een bordpunt. */
	const cardAt = (px: number, py: number): CardRef | null => {
		let best: CardRef | null = null;
		for (const c of cardsRef.current) {
			const b = c.box;
			if (px < b.x || py < b.y || px > b.x + b.w || py > b.y + b.h) continue;
			if (!best || b.w * b.h < best.box.w * best.box.h) best = c;
		}
		return best;
	};

	/** In- of uitzoomen rond het midden van het scherm. */
	const zoomBy = (mult: number) => {
		const ed = editorRef.current;
		if (!ed) return;
		const { w, h } = ed.viewSize();
		ed.zoomAt(w / 2, h / 2, mult, { animate: 140 });
	};

	/** Camera naar een kaart (met wat lucht) en even laten oplichten. */
	const flyTo = (card: CardRef) => {
		const ed = editorRef.current;
		if (!ed) return;
		const b = card.box;
		const minW = 900;
		const minH = 560;
		const box = {
			x: b.x - Math.max(0, (minW - b.w) / 2),
			y: b.y - Math.max(0, (minH - b.h) / 2),
			w: Math.max(b.w, minW),
			h: Math.max(b.h, minH),
		};
		showBounds(ed, box, { animate: 450 });
		setFlash(card);
		if (share) setPhase("free");
		setSearch(false);
	};

	useEffect(() => {
		if (!flash) return;
		const t = window.setTimeout(() => setFlash(null), 2600);
		return () => window.clearTimeout(t);
	}, [flash]);

	// spotlight: de kaart onder de muis, tenzij vastgezet
	const onPointerMove = (e: React.PointerEvent) => {
		if (spot === "off") return;
		const ed = editorRef.current;
		if (!ed) return;
		setCursor({ x: e.clientX, y: e.clientY });
		if (spot === "pinned") return;
		const p = ed.screenToPage(e.clientX, e.clientY);
		const c = cardAt(p.x, p.y);
		if (c?.id !== spotCard?.id) setSpotCard(c);
	};

	// klik zonder slepen op het bord: spotlight vastzetten of loslaten
	const downRef = useRef<{ x: number; y: number } | null>(null);
	const onPointerDown = (e: React.PointerEvent) => {
		const t = e.target as HTMLElement;
		downRef.current =
			t.tagName === "CANVAS" || t.classList.contains(styles.board)
				? { x: e.clientX, y: e.clientY }
				: null;
	};
	const onPointerUp = (e: React.PointerEvent) => {
		const d = downRef.current;
		downRef.current = null;
		if (!d || e.button !== 0 || spot === "off") return;
		if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
		setSpot(spot === "pinned" ? "hover" : "pinned");
	};

	// niveaufilter: bord opnieuw opbouwen met de rest vervaagd; uit = terug
	// naar het bord van daarvoor (met eigen tekeningen en al)
	const applyLevels = (next: Set<Level> | null) => {
		const ed = editorRef.current;
		if (!ed) return;
		const active = next && next.size > 0 && next.size < 3 ? next : null;
		setLevels(active);
		if (active) {
			if (!unfilteredRef.current)
				unfilteredRef.current = ed.store.getSnapshot();
			const built = buildBoard(preview, { levels: active });
			ed.store.loadSnapshot(built.snapshot, "remote");
		} else if (unfilteredRef.current) {
			ed.store.loadSnapshot(unfilteredRef.current, "remote");
			unfilteredRef.current = null;
		}
	};
	const toggleLevel = (l: Level) => {
		const next = new Set(levels ?? ([1, 2, 3] as Level[]));
		if (next.has(l)) next.delete(l);
		else next.add(l);
		applyLevels(next.size === 3 ? null : next);
	};

	// deellink met ?focus= of ?stap=: daar beginnen, zonder welkomstkaart
	const landedRef = useRef(false);
	useEffect(() => {
		if (!ready || landedRef.current) return;
		landedRef.current = true;
		if (stap && stap >= 1 && stap <= stationsRef.current.length) {
			window.setTimeout(() => goStep(stap - 1), 300);
			return;
		}
		if (focus) {
			const card = cardsRef.current.find((c) => c.id === focus);
			if (card) window.setTimeout(() => flyTo(card), 300);
		}
	});

	/** Deellink naar één kaart: opent de kijkversie precies daar. */
	const copyCardLink = async (card: CardRef) => {
		const url = new URL(`/preview/${preview.slug}`, window.location.origin);
		url.searchParams.set("focus", card.id);
		try {
			await navigator.clipboard.writeText(url.toString());
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			window.prompt("Kopieer deze link:", url.toString());
		}
	};

	const rebuild = () => {
		const ed = editorRef.current;
		if (!ed) return;
		if (
			!window.confirm(
				"Bord opnieuw opbouwen? Eigen tekeningen en verplaatsingen gaan weg.",
			)
		)
			return;
		unfilteredRef.current = null;
		setLevels(null);
		const built = buildBoard(preview);
		boundsRef.current = built.bounds;
		stationsRef.current = built.stations;
		cardsRef.current = built.cards;
		ed.store.loadSnapshot(built.snapshot);
		try {
			localStorage.removeItem(storageKey);
		} catch {
			// niets te wissen
		}
		goTo("all");
	};

	const exportPng = async () => {
		const ed = editorRef.current;
		if (!ed) return;
		const blob = await ed.exportImage({ background: true, scale: 2 });
		if (!blob) return;
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${preview.slug}-bord.png`;
		a.click();
		URL.revokeObjectURL(url);
	};

	/** Kopieert de kijklink (/preview/<slug>) en laat even zien dat het gelukt is. */
	const copyShareLink = async () => {
		const url = new URL(`/preview/${preview.slug}`, window.location.origin);
		try {
			await navigator.clipboard.writeText(url.toString());
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			window.prompt("Kopieer deze link:", url.toString());
		}
	};

	const onContextMenu = (e: ReactMouseEvent) => {
		// alleen op het bord zelf, niet op onze eigen knoppen
		if ((e.target as HTMLElement).closest("button")) return;
		e.preventDefault();
		if (share) return;
		const ed = editorRef.current;
		const p = ed ? ed.screenToPage(e.clientX, e.clientY) : null;
		setMenu({
			x: e.clientX,
			y: e.clientY,
			card: p ? cardAt(p.x, p.y) : null,
		});
	};

	const closing = preview.closing ?? {
		title: "Zullen we hierover praten?",
		line: "Een uur bij jullie op locatie is genoeg om te zien hoe het nu loopt. Daarna staat het plan hier op dit bord.",
	};
	const subject =
		closing.subject ?? `${preview.client}: reactie op het voorstel`;
	const mailHref = `mailto:${CONTACT.mail}?subject=${encodeURIComponent(subject)}`;
	const waHref = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(`Hoi Arin, ${subject.toLowerCase()}. `)}`;

	const station = stationsRef.current[step];
	const showGuide = share && phase === "tour" && station;

	const tabs: { key: View; label: string; go: () => void }[] = [
		...(stepCount > 0
			? [{ key: "route" as const, label: "Route", go: resumeRoute }]
			: []),
		{ key: "current", label: preview.current.label, go: () => goTo("current") },
		{
			key: "proposed",
			label: preview.proposed.label,
			go: () => goTo("proposed"),
		},
		{ key: "all", label: "Alles", go: () => goTo("all") },
	];

	// het merkmenu linksboven: alles wat je met het bord kunt, in groepen
	const themeClass = `pv-theme ${theme === "dark" ? "dark" : ""}`;
	const viewGroup: MenuEntry = {
		id: "view",
		label: "Weergave",
		items: [
			{
				id: "theme",
				label: "Thema",
				radio: true,
				items: [
					{
						id: "light",
						label: "Licht",
						checked: theme === "light",
						onSelect: () => setTheme("light"),
					},
					{
						id: "dark",
						label: "Donker",
						checked: theme === "dark",
						onSelect: () => setTheme("dark"),
					},
				],
			},
			{
				id: "grid",
				label: "Raster",
				radio: true,
				items: [
					{
						id: "none",
						label: "Geen",
						checked: grid === "none",
						onSelect: () => setGrid("none"),
					},
					{
						id: "dots",
						label: "Stippen",
						checked: grid === "dots",
						onSelect: () => setGrid("dots"),
					},
					{
						id: "lines",
						label: "Lijnen",
						checked: grid === "lines",
						onSelect: () => setGrid("lines"),
					},
				],
			},
			"divider",
			{
				id: "spot",
				label: "Spotlight",
				checked: spot !== "off",
				onSelect: () => setSpot(spot === "off" ? "hover" : "off"),
			},
			{
				id: "levels",
				label: "Niveaus",
				items: ([1, 2, 3] as Level[]).map((l) => ({
					id: `n${l}`,
					label: `N${l}  ${preview.levels?.[l] ?? ""}`.trim(),
					checked: !levels || levels.has(l),
					onSelect: () => toggleLevel(l),
				})),
			},
			"divider",
			{ id: "fit", label: "Alles passend", onSelect: () => goTo("all") },
			{
				id: "fit-nu",
				label: preview.current.label,
				onSelect: () => goTo("current"),
			},
			{
				id: "fit-straks",
				label: preview.proposed.label,
				onSelect: () => goTo("proposed"),
			},
		],
	};
	const routeGroup: MenuEntry = {
		id: "route",
		label: "Route",
		items: [
			{
				id: "next",
				label: "Volgende stap",
				shortcut: "→",
				disabled: lastStep,
				onSelect: next,
			},
			{
				id: "prev",
				label: "Vorige stap",
				shortcut: "←",
				disabled: step <= 0,
				onSelect: prev,
			},
			"divider",
			...stationsRef.current.map((st, i) => ({
				id: `step-${i}`,
				label: `${i + 1}. ${st.title}`,
				checked: step === i,
				onSelect: () => goStep(i),
			})),
		],
	};
	const helpGroup: MenuEntry = {
		id: "help",
		label: "Hulp & contact",
		items: [
			{ id: "mail", label: "Mail Brandocean", href: mailHref },
			{ id: "wa", label: "WhatsApp", href: waHref },
			{
				id: "tel",
				label: `Bel ${CONTACT.phone}`,
				href: `tel:${CONTACT.phone.replace(/\s/g, "")}`,
			},
		],
	};
	const menuEntries: MenuEntry[] = share
		? [
				{
					id: "site",
					label: "Naar brandocean.nl",
					href: "https://brandocean.nl",
				},
				"divider",
				{
					id: "search",
					label: "Zoek op het bord",
					shortcut: "⌘K",
					onSelect: () => setSearch(true),
				},
				viewGroup,
				routeGroup,
				{ id: "react", label: "Reageren", onSelect: () => setPhase("closing") },
				"divider",
				helpGroup,
			]
		: [
				{
					id: "site",
					label: "Naar brandocean.nl",
					href: "https://brandocean.nl",
				},
				"divider",
				{
					id: "search",
					label: "Zoek op het bord",
					shortcut: "⌘K",
					onSelect: () => setSearch(true),
				},
				viewGroup,
				routeGroup,
				{
					id: "board",
					label: "Bord",
					items: [
						{
							id: "share",
							label: "Kopieer deellink",
							onSelect: () => void copyShareLink(),
						},
						{
							id: "png",
							label: "Exporteer als PNG",
							onSelect: () => void exportPng(),
						},
						"divider",
						{ id: "rebuild", label: "Opnieuw opbouwen", onSelect: rebuild },
					],
				},
				"divider",
				helpGroup,
			];

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: het bord zelf is het interactieve element; dit vangt rechtermuisknop, klik en muisbeweging voor de extra's
		<div
			className={`pv-theme ${theme === "dark" ? "dark" : ""} ${styles.shell}`}
			data-theme={theme}
			data-share={share || undefined}
			onContextMenu={onContextMenu}
			onPointerMove={onPointerMove}
			onPointerDownCapture={onPointerDown}
			onPointerUpCapture={onPointerUp}
		>
			{Quickdraw && initial ? (
				<Quickdraw
					theme={theme}
					grid={grid}
					watermark={false}
					themeToggle={false}
					gridControl={false}
					hideUi={share}
					snapshot={initial}
					className={styles.board}
					onMount={(editor) => {
						editorRef.current = editor;
						setReady(true);
						// overlays (badges, spotlight, oplichten) bewegen mee met de camera
						let raf = 0;
						editor.on("camera", () => {
							if (raf) return;
							raf = window.requestAnimationFrame(() => {
								raf = 0;
								setCamTick((t) => t + 1);
							});
						});
						// deelversie: alleen slepen en zoomen, geen selecteren of tekenen
						if (share) editor.setTool("hand");
						const b = boundsRef.current;
						// eerste keer: op het voorstel inzoomen, daar gaat het gesprek
						// over; in de deelversie het hele bord, achter de welkomstkaart.
						// Twee keer, omdat het canvas zijn maat soms pas na de eerste
						// layout kent en dan op een verkeerde zoom blijft staan.
						const focus = () => {
							if (b)
								showBounds(editor, share ? b.all : b.proposed, { animate: 0 });
						};
						window.requestAnimationFrame(focus);
						window.setTimeout(focus, 250);
					}}
					onChange={(_diff, source, editor) => {
						if (source === "user") persist(editor);
					}}
				/>
			) : (
				<div className={styles.loading}>Bord laden…</div>
			)}

			{/* Spotlight, oplichten en stemmen: HTML boven het canvas, meebewegend met de camera */}
			{spot !== "off" ? (
				<Spotlight
					hole={spotCard ? toScreen(spotCard.box) : null}
					cursor={cursor}
					pinned={spot === "pinned"}
				/>
			) : null}
			<Flash rect={flash && camTick >= 0 ? toScreen(flash.box) : null} />
			{search ? (
				<SearchPalette
					cards={cardsRef.current}
					onPick={flyTo}
					onClose={() => setSearch(false)}
				/>
			) : null}

			{/* Balk bovenin, zoals Relume: links wie, midden de tabs, rechts de knoppen.
			    Losse chips op het papier, geen glazen pil eromheen. */}
			<header className={styles.chrome} data-ready={ready || undefined}>
				<div className={styles.left}>
					<BrandMenu entries={menuEntries} themeClass={themeClass} />
					<div className={styles.chip}>{preview.client}</div>
				</div>
				<div className={styles.tabs} role="tablist">
					{tabs.map((t) => (
						<button
							key={t.key}
							type="button"
							role="tab"
							aria-selected={view === t.key}
							className={styles.tab}
							onClick={t.go}
						>
							{t.label}
						</button>
					))}
				</div>
				<div className={styles.right}>
					{share ? (
						<>
							<Button
								variant="outline"
								onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
							>
								{theme === "dark" ? "Licht" : "Donker"}
							</Button>
							<Button variant="default" onClick={() => setPhase("closing")}>
								Reageren
							</Button>
						</>
					) : (
						<>
							{stepCount > 0 ? (
								<div className={`${styles.chip} ${styles.route}`}>
									<Button
										size="icon-sm"
										variant="ghost"
										aria-label="Vorige stap"
										disabled={step <= 0}
										onClick={prev}
									>
										‹
									</Button>
									<button
										type="button"
										className={styles.routeLabel}
										onClick={resumeRoute}
									>
										{step < 0
											? "Start de route"
											: `${step + 1}/${stepCount}  ${station?.title ?? ""}`}
									</button>
									<Button
										size="icon-sm"
										variant="ghost"
										aria-label="Volgende stap"
										disabled={lastStep}
										onClick={next}
									>
										›
									</Button>
								</div>
							) : null}
							<Button variant="outline" onClick={rebuild}>
								Opnieuw
							</Button>
							<Button variant="default" onClick={() => void copyShareLink()}>
								{copied ? "Link gekopieerd" : "Deel met klant"}
							</Button>
						</>
					)}
				</div>
			</header>

			{/* Kijkversie: zoomknoppen rechtsonder, want er is geen werkbalk */}
			{share && ready && phase !== "welcome" ? (
				<div className={styles.zoom} aria-label="Zoom">
					<button
						type="button"
						className={styles.zoomBtn}
						aria-label="Uitzoomen"
						onClick={() => zoomBy(1 / 1.25)}
					>
						−
					</button>
					<button
						type="button"
						className={styles.zoomPct}
						title="Alles in beeld"
						onClick={() => goTo("all")}
					>
						{camTick >= 0 && editorRef.current
							? `${Math.round(editorRef.current.camera.z * 100)}%`
							: "100%"}
					</button>
					<button
						type="button"
						className={styles.zoomBtn}
						aria-label="Inzoomen"
						onClick={() => zoomBy(1.25)}
					>
						+
					</button>
				</div>
			) : null}

			{share ? (
				<p className={styles.hint} hidden={!ready || phase === "welcome"}>
					Sleep om rond te kijken, scroll of knijp om te zoomen.
					{phase === "free" && stepCount > 0 ? (
						<>
							{" "}
							<button
								type="button"
								className={styles.hintLink}
								onClick={resumeRoute}
							>
								Terug naar de route
							</button>
						</>
					) : null}
				</p>
			) : (
				<p className={styles.hint} hidden={!ready}>
					Pijltjestoetsen lopen de route. Sleep om te verplaatsen, scroll om te
					zoomen, spatie voor de hand. Rechtermuisknop voor thema en raster.
				</p>
			)}

			{/* Deelversie: gids onderin, één stap per keer */}
			{showGuide ? (
				<section className={styles.guide} aria-live="polite">
					<div className={styles.guideHead}>
						<span className={styles.guideNum}>
							{step + 1}
							<span className={styles.guideOf}>/{stepCount}</span>
						</span>
						<h2 className={styles.guideTitle}>{station.title}</h2>
					</div>
					<p className={styles.guideLine}>
						{preview.walkthrough?.[step]?.line}
					</p>
					<div className={styles.guideNav}>
						<Button
							size="sm"
							variant="ghost"
							disabled={step <= 0}
							onClick={prev}
						>
							‹ Vorige
						</Button>
						<ol className={styles.dots}>
							{stationsRef.current.map((s, i) => (
								<li key={s.title}>
									<button
										type="button"
										className={styles.dot}
										data-on={i <= step || undefined}
										aria-label={`Stap ${i + 1}: ${s.title}`}
										aria-current={i === step ? "step" : undefined}
										onClick={() => goStep(i)}
									/>
								</li>
							))}
						</ol>
						<Button size="sm" variant="default" onClick={next}>
							{lastStep ? "Afronden" : "Volgende ›"}
						</Button>
					</div>
				</section>
			) : null}

			{/* Deelversie: welkomstkaart, eerst het verhaal, dan het bord */}
			{share && phase === "welcome" && ready ? (
				<div className={styles.veil}>
					<section className={styles.card}>
						<p className={styles.eyebrow}>Brandocean · voor {preview.client}</p>
						<h1 className={styles.cardTitle}>{preview.title}</h1>
						<p className={styles.cardText}>{preview.intro}</p>
						<p className={styles.cardMeta}>
							{stepCount > 0
								? `${stepCount} stappen, een minuut of vijf. `
								: null}
							Daarna kun je zelf rondkijken.
						</p>
						<div className={styles.cardActions}>
							{stepCount > 0 ? (
								<Button size="lg" variant="default" onClick={() => goStep(0)}>
									Loop mee
								</Button>
							) : null}
							<Button size="lg" variant="ghost" onClick={() => goTo("all")}>
								Zelf rondkijken
							</Button>
						</div>
						<p className={styles.cardDate}>{preview.date}</p>
					</section>
				</div>
			) : null}

			{/* Deelversie: afsluiter, de vraag om af te spreken */}
			{share && phase === "closing" ? (
				<div className={styles.veil}>
					<section className={styles.card}>
						<p className={styles.eyebrow}>Volgende stap</p>
						<h1 className={styles.cardTitle}>{closing.title}</h1>
						<p className={styles.cardText}>{closing.line}</p>
						<div className={styles.cardActions}>
							<Button
								size="lg"
								variant="default"
								nativeButton={false}
								render={<a href={mailHref}>Mail ons</a>}
							/>
							<Button
								size="lg"
								variant="secondary"
								nativeButton={false}
								render={
									<a href={waHref} target="_blank" rel="noreferrer">
										WhatsApp
									</a>
								}
							/>
						</div>
						<p className={styles.cardMeta}>
							Of bel Arin:{" "}
							<a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`}>
								{CONTACT.phone}
							</a>
						</p>
						<div className={styles.cardFoot}>
							<button
								type="button"
								className={styles.hintLink}
								onClick={() => goStep(0)}
							>
								Route opnieuw
							</button>
							<button
								type="button"
								className={styles.hintLink}
								onClick={() => setPhase("free")}
							>
								Bord bekijken
							</button>
						</div>
					</section>
				</div>
			) : null}

			{menu ? (
				<div
					className={`${menuStyles.popup} ${menuStyles.wide} ${styles.ctx}`}
					style={ctxPosition(menu)}
					role="menu"
					onPointerDown={(e) => e.stopPropagation()}
				>
					<div className={menuStyles.list}>
						{menu.card ? (
							<>
								<div className={menuStyles.heading}>{menu.card.label}</div>
								<MenuItem
									onClick={() => {
										setMenu(null);
										void copyCardLink(menu.card as CardRef);
									}}
								>
									Deel dit stukje
								</MenuItem>
								<MenuItem
									onClick={() => {
										setMenu(null);
										setSpotCard(menu.card);
										setSpot("pinned");
									}}
								>
									Spotlight hierop
								</MenuItem>
								<hr className={menuStyles.divider} />
							</>
						) : null}
						<MenuItem
							onClick={() => {
								setMenu(null);
								setSearch(true);
							}}
						>
							Zoek op het bord
						</MenuItem>
						<hr className={menuStyles.divider} />
						<div className={menuStyles.heading}>Thema</div>
						<MenuItem
							active={theme === "light"}
							onClick={() => setTheme("light")}
						>
							Licht
						</MenuItem>
						<MenuItem
							active={theme === "dark"}
							onClick={() => setTheme("dark")}
						>
							Donker
						</MenuItem>
						<div className={menuStyles.heading}>Raster</div>
						<MenuItem active={grid === "none"} onClick={() => setGrid("none")}>
							Geen
						</MenuItem>
						<MenuItem active={grid === "dots"} onClick={() => setGrid("dots")}>
							Stippen
						</MenuItem>
						<MenuItem
							active={grid === "lines"}
							onClick={() => setGrid("lines")}
						>
							Lijnen
						</MenuItem>
						<hr className={menuStyles.divider} />
						<MenuItem
							onClick={() => {
								goTo("all");
								setMenu(null);
							}}
						>
							Alles passend
						</MenuItem>
						<MenuItem
							onClick={() => {
								setMenu(null);
								void exportPng();
							}}
						>
							Exporteer als PNG
						</MenuItem>
						<MenuItem
							onClick={() => {
								setMenu(null);
								void copyShareLink();
							}}
						>
							Kopieer deellink
						</MenuItem>
					</div>
				</div>
			) : null}
		</div>
	);
}

function MenuItem({
	active,
	onClick,
	children,
}: {
	active?: boolean;
	onClick: () => void;
	children: string;
}) {
	if (active === undefined)
		return (
			<button
				type="button"
				role="menuitem"
				className={menuStyles.item}
				onClick={onClick}
			>
				<span className={menuStyles.label}>{children}</span>
			</button>
		);
	return (
		<button
			type="button"
			role="menuitemradio"
			aria-checked={active}
			className={menuStyles.item}
			onClick={onClick}
		>
			<span className={menuStyles.label}>{children}</span>
			{active ? (
				<span className={menuStyles.check} aria-hidden="true">
					✓
				</span>
			) : null}
		</button>
	);
}

/**
 * Quickdraw tekent met zijn eigen twaalf kleuren. We schuiven die op naar de
 * tokens van theme.css (zelfde hex als de oklch-waarden), zodat papier,
 * kaarten, lijnen en accent op het bord bij de chrome passen. De kleuren
 * van kaarten, labels, stickies en accent komen daarna uit applyBoardColors.
 */
type PaletteColor = { stroke: string; fill: string; note: string };
type Palette = Record<
	Theme,
	{
		background: string;
		selection: string;
		selectionFill: string;
		handleFill: string;
		colors: Record<string, PaletteColor>;
		grid: {
			line: { minor: string; major: string };
			dot: { minor: string; major: string };
		};
	}
>;

function applyPalette(themes: Palette) {
	const light = themes.light;
	light.background = "#f0efeb"; // Relume-papier
	light.selection = "#c96442"; // --primary
	light.selectionFill = "rgba(201, 100, 66, 0.08)";
	light.handleFill = "#faf9f5";
	light.grid.line = {
		minor: "rgba(61, 57, 41, 0.10)",
		major: "rgba(61, 57, 41, 0.2)",
	};
	light.grid.dot = {
		minor: "rgba(61, 57, 41, 0.22)",
		major: "rgba(61, 57, 41, 0.4)",
	};
	light.colors.black = { stroke: "#1d1d1d", fill: "#e4e3df", note: "#fdf0a8" }; // tekst en randen / koppil
	light.colors.grey = { stroke: "#e3e1db", fill: "#ffffff", note: "#eceae3" }; // lijnen / paginakaart (wit)
	// oranje, violet en de labelkleuren komen uit applyBoardColors

	const dark = themes.dark;
	dark.background = "#1c1c1a"; // het omgekeerde van het papier
	dark.selection = "#d97757";
	dark.selectionFill = "rgba(217, 119, 87, 0.1)";
	dark.handleFill = "#2c2c2b";
	dark.grid.line = {
		minor: "rgba(241, 241, 239, 0.08)",
		major: "rgba(241, 241, 239, 0.16)",
	};
	dark.grid.dot = {
		minor: "rgba(241, 241, 239, 0.18)",
		major: "rgba(241, 241, 239, 0.32)",
	};
	dark.colors.black = { stroke: "#ededea", fill: "#3a3a37", note: "#fcf089" }; // tekst en randen / koppil
	dark.colors.grey = { stroke: "#34342f", fill: "#262624", note: "#e2e5e8" }; // lijnen / paginakaart
}

/**
 * Het rechtermuisknopmenu binnen het scherm houden: rechts en onderin
 * klapt het naar de andere kant van de muis.
 */
function ctxPosition(at: { x: number; y: number }): React.CSSProperties {
	const w = window.innerWidth;
	const h = window.innerHeight;
	const style: React.CSSProperties = {
		left: Math.min(at.x, w - 308),
	};
	if (at.y > h * 0.55) style.bottom = h - at.y;
	else style.top = at.y;
	return style;
}

/**
 * Bordkleuren op het palet zetten (cardColors.ts): `grey` is de pagina-kaart
 * (rand en vulling), `black` met solid fill is de kop erin (vulling; de
 * stroke blijft de tekstkleur), en de labels, stickies en het accent volgen
 * dezelfde toon. Het canvas leest het palet bij het tekenen.
 */
function applyBoardColors(themes: Palette) {
	for (const t of ["light", "dark"] as const) {
		const c = BOARD_COLORS[t];
		themes[t].colors.grey = {
			...themes[t].colors.grey,
			stroke: c.border,
			fill: c.fill,
		};
		themes[t].colors.black = { ...themes[t].colors.black, fill: c.head };
		Object.assign(themes[t].colors, boardPalette(t));
	}
}

/**
 * Het canvas tekent tekst met Quickdraw's eigen fontstack. De sans wijst
 * naar Relative (theme.css), dezelfde letter als de chrome. We wachten tot
 * de twee gewichten geladen zijn, anders meet en tekent het canvas de
 * eerste frames nog met de systeemfont.
 */
type Fonts = Record<"draw" | "sans" | "serif" | "mono", string>;

async function applyFonts(fonts: Fonts) {
	fonts.sans = "Relative, -apple-system, BlinkMacSystemFont, sans-serif";
	try {
		await Promise.all([
			document.fonts.load("400 16px Relative"),
			document.fonts.load("500 16px Relative"),
		]);
	} catch {
		// font niet te laden: het canvas valt terug op de systeemfont
	}
}

/** Korte, stabiele hash van de data: verandert de preview, dan een vers bord. */
function hash(s: string): string {
	let h = 5381;
	for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
	return (h >>> 0).toString(36);
}

/**
 * Quickdraw's followBounds is cover-fit (de box vult het scherm en wordt
 * bijgesneden). Wij willen contain-fit: alles in beeld, met wat lucht. Dus
 * rekken we de box eerst op naar de verhouding van het scherm.
 */
function showBounds(
	ed: QuickdrawEditor,
	b: Bounds,
	opts?: { animate?: number },
	margin = 0.06,
) {
	const { w, h } = ed.viewSize();
	const box = {
		x: b.x - b.w * margin,
		y: b.y - b.h * margin,
		w: b.w * (1 + 2 * margin),
		h: b.h * (1 + 2 * margin),
	};
	if (w > 1 && h > 1) {
		const view = w / h;
		if (box.w / box.h < view) {
			const nw = box.h * view;
			box.x -= (nw - box.w) / 2;
			box.w = nw;
		} else {
			const nh = box.w / view;
			box.y -= (nh - box.h) / 2;
			box.h = nh;
		}
	}
	ed.followBounds(box, opts);
}

// Minimale typen voor wat we van Quickdraw gebruiken; de volledige typen
// komen mee met het package, maar de component wordt dynamisch geladen.
type Bounds = { x: number; y: number; w: number; h: number };
type QuickdrawEditor = {
	store: {
		getSnapshot(): Snapshot;
		loadSnapshot(s: Snapshot, source?: "user" | "remote"): void;
	};
	camera: { x: number; y: number; z: number };
	on(ev: "camera", fn: () => void): () => void;
	screenToPage(sx: number, sy: number): { x: number; y: number };
	pageToScreen(px: number, py: number): { x: number; y: number };
	followBounds(b: Bounds, opts?: { animate?: number }): void;
	zoomAt(
		sx: number,
		sy: number,
		mult: number,
		opts?: { animate?: number },
	): void;
	viewSize(): { w: number; h: number };
	fitContent(opts?: { margin?: number; animate?: number }): void;
	setTool(tool: string): void;
	requestRender(): void;
	exportImage(opts?: {
		background?: boolean;
		scale?: number;
	}): Promise<Blob | null>;
};
type QuickdrawProps = {
	theme?: Theme;
	grid?: Grid;
	watermark?: boolean;
	themeToggle?: boolean;
	gridControl?: boolean;
	hideUi?: boolean;
	snapshot?: Snapshot;
	className?: string;
	onMount?: (editor: QuickdrawEditor) => void;
	onChange?: (
		diff: unknown,
		source: "user" | "remote",
		editor: QuickdrawEditor,
	) => void;
};
