import { Menu } from "@base-ui/react/menu";
import { useState } from "react";
import { Brandmark } from "@/components/brand";
import styles from "./Menu.module.css";

/**
 * Eén regel in het menu: iets om te doen (knop of link). `checked` maakt er
 * een keuzerondje van binnen een groep met `radio`.
 */
export type MenuAction = {
	id: string;
	label: string;
	shortcut?: string;
	href?: string;
	checked?: boolean;
	disabled?: boolean;
	onSelect?: () => void;
};

/** Een submenu: kop met pijltje, daarachter de items. */
export type MenuGroup = {
	id: string;
	label: string;
	radio?: boolean;
	items: MenuEntry[];
};

export type MenuEntry = MenuAction | MenuGroup | "divider";

const isGroup = (e: MenuEntry): e is MenuGroup =>
	typeof e === "object" && "items" in e;
const isAction = (e: MenuEntry): e is MenuAction =>
	typeof e === "object" && !("items" in e);

/**
 * Het merkmenu linksboven, zoals Relume's logoknop: het merkteken met een
 * pijltje, daaronder een zoekveld en de acties in groepen met submenu's.
 * Zoeken filtert alle acties plat, met de groep ervoor ("Weergave · Licht").
 * Gebouwd op Base UI's Menu; de stijl komt uit Menu.module.css. De popup
 * hangt buiten .pv-theme (portal), dus die klasse gaat mee.
 */
export default function BrandMenu({
	entries,
	themeClass,
}: {
	entries: MenuEntry[];
	themeClass: string;
}) {
	const [query, setQuery] = useState("");
	const q = query.trim().toLowerCase();
	const hits = q ? flatten(entries).filter((a) => a.text.includes(q)) : null;

	return (
		<Menu.Root onOpenChange={(open) => !open && setQuery("")}>
			<Menu.Trigger className={styles.trigger} aria-label="Menu">
				<Brandmark size={20} />
				<Chevron down />
			</Menu.Trigger>
			<Menu.Portal>
				<Menu.Positioner align="start" sideOffset={6} className="isolate z-50">
					<Menu.Popup className={`${themeClass} ${styles.popup}`}>
						<div className={styles.search}>
							<input
								className={styles.input}
								type="search"
								placeholder="Zoek een actie…"
								value={query}
								autoComplete="off"
								onChange={(e) => setQuery(e.target.value)}
								onKeyDown={(e) => {
									// het menu zelf zoekt op beginletters; dat mag niet meelopen
									if (e.key !== "Escape" && e.key !== "ArrowDown")
										e.stopPropagation();
								}}
							/>
						</div>
						<div className={styles.list}>
							{hits ? (
								hits.length ? (
									hits.map((h) => (
										<Item key={h.action.id} action={h.action} label={h.label} />
									))
								) : (
									<p className={styles.empty}>Niets gevonden.</p>
								)
							) : (
								<Entries entries={entries} themeClass={themeClass} />
							)}
						</div>
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	);
}

function Entries({
	entries,
	themeClass,
}: {
	entries: MenuEntry[];
	themeClass: string;
}) {
	return (
		<>
			{entries.map((e, i) => {
				if (e === "divider")
					return (
						<Menu.Separator
							// biome-ignore lint/suspicious/noArrayIndexKey: scheidingslijnen hebben geen identiteit
							key={`d${i}`}
							className={styles.divider}
						/>
					);
				if (isGroup(e))
					return <Sub key={e.id} group={e} themeClass={themeClass} />;
				return <Item key={e.id} action={e} />;
			})}
		</>
	);
}

function Sub({ group, themeClass }: { group: MenuGroup; themeClass: string }) {
	const items = group.radio ? (
		<Menu.RadioGroup
			value={group.items.filter(isAction).find((i) => i.checked)?.id}
		>
			{group.items.map((e, i) => {
				if (e === "divider")
					return (
						<Menu.Separator
							// biome-ignore lint/suspicious/noArrayIndexKey: idem
							key={`d${i}`}
							className={styles.divider}
						/>
					);
				if (isGroup(e))
					return <Sub key={e.id} group={e} themeClass={themeClass} />;
				return (
					<Menu.RadioItem
						key={e.id}
						value={e.id}
						className={styles.item}
						disabled={e.disabled}
						onClick={e.onSelect}
					>
						<span className={styles.label}>{e.label}</span>
						{e.checked ? (
							<span className={styles.check} aria-hidden="true">
								✓
							</span>
						) : null}
					</Menu.RadioItem>
				);
			})}
		</Menu.RadioGroup>
	) : (
		<Entries entries={group.items} themeClass={themeClass} />
	);
	return (
		<Menu.SubmenuRoot>
			<Menu.SubmenuTrigger className={styles.item}>
				<span className={styles.label}>{group.label}</span>
				<Chevron />
			</Menu.SubmenuTrigger>
			<Menu.Portal>
				<Menu.Positioner
					align="start"
					alignOffset={-8}
					sideOffset={4}
					className="isolate z-50"
				>
					<Menu.Popup className={`${themeClass} ${styles.popup} ${styles.sub}`}>
						<div className={styles.list}>{items}</div>
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.SubmenuRoot>
	);
}

function Item({ action, label }: { action: MenuAction; label?: string }) {
	const inner = (
		<>
			<span className={styles.label}>{label ?? action.label}</span>
			{action.checked ? (
				<span className={styles.check} aria-hidden="true">
					✓
				</span>
			) : null}
			{action.shortcut ? (
				<kbd className={styles.shortcut}>{action.shortcut}</kbd>
			) : null}
			<span className={styles.enter} aria-hidden="true">
				↵
			</span>
		</>
	);
	const cls = styles.item;
	if (action.href)
		return (
			<Menu.LinkItem
				className={cls}
				href={action.href}
				target={action.href.startsWith("http") ? "_blank" : undefined}
				rel="noreferrer"
				onClick={action.onSelect}
			>
				{inner}
			</Menu.LinkItem>
		);
	return (
		<Menu.Item
			className={cls}
			disabled={action.disabled}
			onClick={action.onSelect}
		>
			{inner}
		</Menu.Item>
	);
}

function Chevron({ down }: { down?: boolean }) {
	return (
		<svg
			className={styles.chevron}
			viewBox="0 0 16 16"
			fill="none"
			aria-hidden="true"
			style={down ? { transform: "rotate(90deg)" } : undefined}
		>
			<path
				fill="currentColor"
				fillRule="evenodd"
				d="M6.427 14.08a.25.25 0 0 1-.354 0l-.701-.7a.25.25 0 0 1 0-.354L9.64 8.757 5.372 4.49a.25.25 0 0 1 0-.354l.701-.701a.25.25 0 0 1 .354 0l5.146 5.146a.25.25 0 0 1 0 .354L6.427 14.08Z"
				clipRule="evenodd"
			/>
		</svg>
	);
}

/** Alle acties plat, met de groep in het label, om in te zoeken. */
function flatten(
	entries: MenuEntry[],
	prefix = "",
): { action: MenuAction; label: string; text: string }[] {
	const out: { action: MenuAction; label: string; text: string }[] = [];
	for (const e of entries) {
		if (e === "divider") continue;
		if (isGroup(e)) {
			out.push(
				...flatten(e.items, prefix ? `${prefix} · ${e.label}` : e.label),
			);
			continue;
		}
		const label = prefix ? `${prefix} · ${e.label}` : e.label;
		out.push({ action: e, label, text: label.toLowerCase() });
	}
	return out;
}
