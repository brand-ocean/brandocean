import {
	type ComponentType,
	type MouseEvent as ReactMouseEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
	type BoardBounds,
	buildBoard,
	type Snapshot,
	type StationBounds,
} from "./board";
import styles from "./PreviewBoard.module.css";
import "./theme.css";
import type { ClientPreview } from "./types";

type Theme = "dark" | "light";
type Grid = "none" | "lines" | "dots";

const THEME_KEY = "bo-preview-theme";
const GRID_KEY = "bo-preview-grid";

/**
 * Het whiteboard: Quickdraw (canvas, pan/zoom, tekenen, stickies, PNG) met
 * daarop de sitemap "nu" en "straks" als shapes. Eigen chrome bovenin:
 * springen naar Nu / Straks / Alles, opnieuw opbouwen. Rechtermuisknop geeft
 * een menu met thema, raster, passend maken en PNG-export.
 *
 * Quickdraw raakt `document` bij import, dus de component laadt pas in de
 * browser. Het bord wordt per klant én per versie van de data in
 * localStorage bewaard: wat je tijdens een gesprek verschuift of tekent,
 * staat er bij de volgende keer nog; verandert de data, dan komt er een
 * vers bord.
 */
export default function PreviewBoard({ preview }: { preview: ClientPreview }) {
	const [Quickdraw, setQuickdraw] =
		useState<ComponentType<QuickdrawProps> | null>(null);
	const editorRef = useRef<QuickdrawEditor | null>(null);
	const boundsRef = useRef<BoardBounds | null>(null);
	const stationsRef = useRef<StationBounds[]>([]);
	const [step, setStep] = useState(-1);
	const [initial, setInitial] = useState<Snapshot | null>(null);
	const [ready, setReady] = useState(false);
	const [theme, setThemeState] = useState<Theme>("dark");
	const [grid, setGridState] = useState<Grid>("dots");
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const storageKey = `bo-preview-board:${preview.slug}:${hash(JSON.stringify(preview))}`;

	useEffect(() => {
		let alive = true;
		try {
			const t = localStorage.getItem(THEME_KEY);
			if (t === "light" || t === "dark") setThemeState(t);
			const g = localStorage.getItem(GRID_KEY);
			if (g === "none" || g === "lines" || g === "dots") setGridState(g);
		} catch {
			// geen opslag: standaard donker met stippen
		}
		Promise.all([
			import("@quickdrawjs/react"),
			import("@quickdrawjs/core/quickdraw.css"),
		]).then(([mod]) => {
			if (!alive) return;
			applyPalette(mod.THEMES as Palette);
			const built = buildBoard(preview);
			boundsRef.current = built.bounds;
			stationsRef.current = built.stations;
			let snap: Snapshot = built.snapshot;
			try {
				const saved = localStorage.getItem(storageKey);
				if (saved) snap = JSON.parse(saved) as Snapshot;
			} catch {
				// geen opslag beschikbaar: gewoon vers opbouwen
			}
			setInitial(snap);
			setQuickdraw(() => mod.Quickdraw as ComponentType<QuickdrawProps>);
		});
		return () => {
			alive = false;
		};
	}, [preview, storageKey]);

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
		ed.followBounds(b, { animate: 350 });
	};

	// looproute: stap voor stap door het bord, ook met de pijltjestoetsen
	const goStep = (i: number) => {
		const ed = editorRef.current;
		const st = stationsRef.current[i];
		if (!ed || !st) return;
		setStep(i);
		ed.followBounds(st.bounds, { animate: 400 });
	};
	const stepCount = stationsRef.current.length;

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null;
			if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
			if (e.key === "ArrowRight" || e.key === "PageDown") {
				e.preventDefault();
				goStep(Math.min(stepCount - 1, step + 1));
			} else if (e.key === "ArrowLeft" || e.key === "PageUp") {
				e.preventDefault();
				goStep(Math.max(0, step - 1));
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const rebuild = () => {
		const ed = editorRef.current;
		if (!ed) return;
		if (
			!window.confirm(
				"Bord opnieuw opbouwen? Eigen tekeningen en verplaatsingen gaan weg.",
			)
		)
			return;
		const built = buildBoard(preview);
		boundsRef.current = built.bounds;
		stationsRef.current = built.stations;
		ed.store.loadSnapshot(built.snapshot);
		try {
			localStorage.removeItem(storageKey);
		} catch {
			// niets te wissen
		}
		ed.followBounds(built.bounds.all, { animate: 300 });
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

	const onContextMenu = (e: ReactMouseEvent) => {
		// alleen op het bord zelf, niet op onze eigen knoppen
		if ((e.target as HTMLElement).closest("button")) return;
		e.preventDefault();
		setMenu({ x: e.clientX, y: e.clientY });
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: het bord zelf is het interactieve element; dit vangt alleen de rechtermuisknop
		<div
			className={`pv-theme ${theme === "dark" ? "dark" : ""} ${styles.shell}`}
			data-theme={theme}
			onContextMenu={onContextMenu}
		>
			{Quickdraw && initial ? (
				<Quickdraw
					theme={theme}
					grid={grid}
					watermark={false}
					themeToggle={false}
					gridControl={false}
					snapshot={initial}
					className={styles.board}
					onMount={(editor) => {
						editorRef.current = editor;
						setReady(true);
						const b = boundsRef.current;
						// eerste keer: op het voorstel inzoomen, daar gaat het gesprek over.
						// Twee keer, omdat het canvas zijn maat soms pas na de eerste
						// layout kent en dan op een verkeerde zoom blijft staan.
						const focus = () => {
							if (b) editor.followBounds(b.proposed, { animate: 0 });
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

			<div className={styles.chrome} data-ready={ready || undefined}>
				<div className={styles.brand}>
					<span className={styles.wordmark}>Brandocean</span>
					<span className={styles.client}>voor {preview.client}</span>
				</div>
				<div className={styles.actions}>
					<Button size="sm" variant="secondary" onClick={() => goTo("current")}>
						{preview.current.label}
					</Button>
					<Button
						size="sm"
						variant="secondary"
						onClick={() => goTo("proposed")}
					>
						{preview.proposed.label}
					</Button>
					<Button size="sm" variant="ghost" onClick={() => goTo("all")}>
						Alles
					</Button>
					<Button size="sm" variant="ghost" onClick={rebuild}>
						Opnieuw opbouwen
					</Button>
				</div>
				{stepCount > 0 ? (
					<div className={styles.route}>
						<Button
							size="sm"
							variant="ghost"
							aria-label="Vorige stap"
							disabled={step <= 0}
							onClick={() => goStep(step - 1)}
						>
							‹
						</Button>
						<button
							type="button"
							className={styles.routeLabel}
							onClick={() => goStep(step < 0 ? 0 : step)}
						>
							{step < 0
								? "Start de route"
								: `${step + 1}/${stepCount}  ${stationsRef.current[step]?.title ?? ""}`}
						</button>
						<Button
							size="sm"
							variant="default"
							aria-label="Volgende stap"
							disabled={step >= stepCount - 1}
							onClick={() => goStep(step + 1)}
						>
							›
						</Button>
					</div>
				) : null}
			</div>
			<p className={styles.hint} hidden={!ready}>
				Pijltjestoetsen lopen de route. Sleep om te verplaatsen, scroll om te
				zoomen, spatie voor de hand. Rechtermuisknop voor thema en raster.
			</p>

			{menu ? (
				<div
					className={styles.menu}
					style={{ left: menu.x, top: menu.y }}
					role="menu"
					onPointerDown={(e) => e.stopPropagation()}
				>
					<div className={styles.menuLabel}>Thema</div>
					<MenuItem active={theme === "dark"} onClick={() => setTheme("dark")}>
						Donker
					</MenuItem>
					<MenuItem
						active={theme === "light"}
						onClick={() => setTheme("light")}
					>
						Licht
					</MenuItem>
					<div className={styles.menuLabel}>Raster</div>
					<MenuItem active={grid === "dots"} onClick={() => setGrid("dots")}>
						Stippen
					</MenuItem>
					<MenuItem active={grid === "lines"} onClick={() => setGrid("lines")}>
						Lijnen
					</MenuItem>
					<MenuItem active={grid === "none"} onClick={() => setGrid("none")}>
						Geen
					</MenuItem>
					<div className={styles.menuSep} />
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
	return (
		<button
			type="button"
			role="menuitemradio"
			aria-checked={active}
			className={styles.menuItem}
			onClick={onClick}
		>
			<span className={styles.menuCheck} aria-hidden="true">
				{active ? "●" : ""}
			</span>
			{children}
		</button>
	);
}

/**
 * Quickdraw tekent met zijn eigen twaalf kleuren. We schuiven die op naar de
 * tokens van theme.css (zelfde hex als de oklch-waarden), zodat papier,
 * kaarten, lijnen en accent op het bord bij de chrome passen. Stickies
 * houden hun heldere papierkleur; die horen op te vallen.
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
	light.colors.orange = { stroke: "#c96442", fill: "#f3ddd3", note: "#f6cfbf" }; // primary
	light.colors.violet = { stroke: "#9c87f5", fill: "#ebe6fd", note: "#ddd4fb" }; // chart-2

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
	dark.colors.orange = { stroke: "#d97757", fill: "#3f2b23", note: "#f8c69c" }; // primary
	dark.colors.violet = { stroke: "#9c87f5", fill: "#2f2a45", note: "#e3aeef" }; // chart-2
}

/** Korte, stabiele hash van de data: verandert de preview, dan een vers bord. */
function hash(s: string): string {
	let h = 5381;
	for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
	return (h >>> 0).toString(36);
}

// Minimale typen voor wat we van Quickdraw gebruiken; de volledige typen
// komen mee met het package, maar de component wordt dynamisch geladen.
type Bounds = { x: number; y: number; w: number; h: number };
type QuickdrawEditor = {
	store: { getSnapshot(): Snapshot; loadSnapshot(s: Snapshot): void };
	followBounds(b: Bounds, opts?: { animate?: number }): void;
	fitContent(opts?: { margin?: number; animate?: number }): void;
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
	snapshot?: Snapshot;
	className?: string;
	onMount?: (editor: QuickdrawEditor) => void;
	onChange?: (
		diff: unknown,
		source: "user" | "remote",
		editor: QuickdrawEditor,
	) => void;
};
