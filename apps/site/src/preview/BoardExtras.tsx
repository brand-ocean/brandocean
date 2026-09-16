import { useEffect, useRef, useState } from "react";
import styles from "./BoardExtras.module.css";
import type { CardRef } from "./board";
import menuStyles from "./Menu.module.css";

/** Rechthoek op het scherm (pixels), berekend uit een bordbox door de ouder. */
export type Rect = { x: number; y: number; w: number; h: number };

const KIND_ICON: Record<CardRef["kind"], string> = {
	page: "▭",
	section: "≡",
	sticky: "✎",
	auto: "⚙",
};

/**
 * Zoeken op het bord (⌘K): een veld bovenin, de treffers eronder, pijltjes
 * en Enter om te kiezen. Zoekt in pagina's, secties, stickies en
 * automatiseringen; de ouder vliegt erheen en licht de kaart op.
 */
export function SearchPalette({
	cards,
	onPick,
	onClose,
}: {
	cards: CardRef[];
	onPick: (card: CardRef, query: string) => void;
	onClose: () => void;
}) {
	const [q, setQ] = useState("");
	const [cursor, setCursor] = useState(0);
	const input = useRef<HTMLInputElement>(null);
	const needle = q.trim().toLowerCase();
	const hits = needle
		? cards
				.filter((c) =>
					`${c.label} ${c.sub ?? ""}`.toLowerCase().includes(needle),
				)
				.slice(0, 8)
		: [];

	useEffect(() => {
		input.current?.focus();
	}, []);

	return (
		<div className={styles.palette}>
			<div className={`${menuStyles.popup} ${styles.paletteBox}`}>
				<div className={`${menuStyles.search} ${styles.search}`}>
					<input
						ref={input}
						className={`${menuStyles.input} ${styles.input}`}
						type="search"
						placeholder="Zoek op het bord: pagina, sectie, sticky…"
						value={q}
						autoComplete="off"
						onChange={(e) => {
							setQ(e.target.value);
							setCursor(0);
						}}
						onKeyDown={(e) => {
							if (e.key === "Escape") onClose();
							else if (e.key === "ArrowDown") {
								e.preventDefault();
								setCursor((c) => Math.min(hits.length - 1, c + 1));
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								setCursor((c) => Math.max(0, c - 1));
							} else if (e.key === "Enter" && hits[cursor]) {
								onPick(hits[cursor], needle);
							}
							e.stopPropagation();
						}}
					/>
				</div>
				{needle ? (
					<div className={menuStyles.list}>
						{hits.length ? (
							hits.map((c, i) => (
								<button
									key={c.id}
									type="button"
									className={`${menuStyles.item} ${menuStyles.hasIcon} ${styles.item}`}
									data-highlighted={i === cursor || undefined}
									onMouseEnter={() => setCursor(i)}
									onClick={() => onPick(c, needle)}
								>
									<span className={styles.kind} aria-hidden="true">
										{KIND_ICON[c.kind]}
									</span>
									<span className={menuStyles.label}>
										{c.label}
										{c.sub ? (
											<span className={styles.sub}> · {c.sub}</span>
										) : null}
									</span>
									<span className={menuStyles.enter} aria-hidden="true">
										↵
									</span>
								</button>
							))
						) : (
							<p className={`${menuStyles.empty} ${styles.empty}`}>
								Niets gevonden.
							</p>
						)}
					</div>
				) : (
					<p className={`${menuStyles.empty} ${styles.empty}`}>
						Typ om te zoeken. Esc sluit.
					</p>
				)}
			</div>
		</div>
	);
}

/** Donker kleed over het bord met een gat op de kaart onder de muis. */
export function Spotlight({
	hole,
	cursor,
	pinned,
}: {
	hole: Rect | null;
	cursor: { x: number; y: number } | null;
	pinned: boolean;
}) {
	if (hole)
		return (
			<div
				className={styles.spot}
				data-pinned={pinned || undefined}
				style={{
					left: hole.x - 8,
					top: hole.y - 8,
					width: hole.w + 16,
					height: hole.h + 16,
				}}
			/>
		);
	if (cursor)
		return (
			<div
				className={`${styles.spot} ${styles.spotRound}`}
				style={{
					left: cursor.x - 140,
					top: cursor.y - 140,
					width: 280,
					height: 280,
				}}
			/>
		);
	return <div className={styles.spotAll} />;
}

/** Korte oplichting rond een kaart, na zoeken of een deellink. */
export function Flash({ rect }: { rect: Rect | null }) {
	if (!rect) return null;
	return (
		<div
			className={styles.flash}
			style={{
				left: rect.x - 6,
				top: rect.y - 6,
				width: rect.w + 12,
				height: rect.h + 12,
			}}
		/>
	);
}
