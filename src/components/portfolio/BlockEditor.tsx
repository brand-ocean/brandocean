import {
	ChevronDownIcon,
	ChevronUpIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	emptyPortfolioBlock,
	PORTFOLIO_BLOCK_KINDS,
	PORTFOLIO_BLOCK_LABELS,
	type PortfolioBlock,
} from "~convex/lib/portfolioBlocks";
import { MediaField, MediaListField } from "./MediaField";

/**
 * Editor for the ordered block list that makes up a case-study page. Each block
 * kind here has a matching renderer in `src/blunt/components/CaseBlocks`.
 */
export function BlockEditor({
	blocks,
	onChange,
}: {
	blocks: PortfolioBlock[];
	onChange: (next: PortfolioBlock[]) => void;
}) {
	const setBlock = (index: number, block: PortfolioBlock) => {
		const next = [...blocks];
		next[index] = block;
		onChange(next);
	};

	const move = (index: number, delta: number) => {
		const target = index + delta;
		if (target < 0 || target >= blocks.length) return;
		const next = [...blocks];
		const [moved] = next.splice(index, 1);
		next.splice(target, 0, moved);
		onChange(next);
	};

	return (
		<div className="flex flex-col gap-4">
			{blocks.length === 0 ? (
				<p className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
					Nog geen blokken. Voeg er een toe om de case-pagina op te bouwen.
				</p>
			) : null}

			{blocks.map((block, index) => (
				<section
					// biome-ignore lint/suspicious/noArrayIndexKey: blocks are an ordered list with no stable id
					key={index}
					className="rounded-lg border bg-card"
				>
					<header className="flex items-center justify-between gap-2 border-b px-3 py-2">
						<span className="text-sm font-medium">
							{index + 1}. {PORTFOLIO_BLOCK_LABELS[block.kind]}
						</span>
						<div className="flex gap-1">
							<Button
								type="button"
								size="icon-sm"
								variant="ghost"
								aria-label="Blok omhoog"
								disabled={index === 0}
								onClick={() => move(index, -1)}
							>
								<ChevronUpIcon />
							</Button>
							<Button
								type="button"
								size="icon-sm"
								variant="ghost"
								aria-label="Blok omlaag"
								disabled={index === blocks.length - 1}
								onClick={() => move(index, 1)}
							>
								<ChevronDownIcon />
							</Button>
							<Button
								type="button"
								size="icon-sm"
								variant="ghost"
								aria-label="Blok verwijderen"
								onClick={() => onChange(blocks.filter((_, i) => i !== index))}
							>
								<TrashIcon />
							</Button>
						</div>
					</header>
					<div className="flex flex-col gap-3 p-3">
						<BlockFields
							block={block}
							onChange={(next) => setBlock(index, next)}
						/>
					</div>
				</section>
			))}

			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="self-start"
						/>
					}
				>
					<PlusIcon data-icon="inline-start" /> Blok toevoegen
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					{PORTFOLIO_BLOCK_KINDS.map((kind) => (
						<DropdownMenuItem
							key={kind}
							onSelect={() => onChange([...blocks, emptyPortfolioBlock(kind)])}
						>
							{PORTFOLIO_BLOCK_LABELS[kind]}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

function BlockFields({
	block,
	onChange,
}: {
	block: PortfolioBlock;
	onChange: (next: PortfolioBlock) => void;
}) {
	switch (block.kind) {
		case "text":
			return (
				<>
					<Labelled label="Kop (optioneel)">
						<Input
							value={block.heading ?? ""}
							placeholder="Samenvatting"
							onChange={(e) => onChange({ ...block, heading: e.target.value })}
						/>
					</Labelled>
					<Labelled label="Alinea's — één lege regel tussen alinea's">
						<Textarea
							rows={8}
							value={block.paragraphs.join("\n\n")}
							onChange={(e) =>
								onChange({
									...block,
									paragraphs: e.target.value.split(/\n{2,}/),
								})
							}
						/>
					</Labelled>
				</>
			);

		case "image":
			return (
				<>
					<MediaField
						label="Foto"
						value={block.media}
						onChange={(media) => onChange({ ...block, media: media ?? {} })}
					/>
					<Labelled label="Weergave">
						<Select
							value={block.layout}
							onValueChange={(layout) =>
								onChange({
									...block,
									layout: layout === "full" ? "full" : "inset",
								})
							}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="inset">In kolom</SelectItem>
								<SelectItem value="full">Volle breedte</SelectItem>
							</SelectContent>
						</Select>
					</Labelled>
					<Labelled label="Bijschrift (optioneel)">
						<Input
							value={block.caption ?? ""}
							onChange={(e) => onChange({ ...block, caption: e.target.value })}
						/>
					</Labelled>
				</>
			);

		case "gallery":
			return (
				<>
					<Labelled label="Kop (optioneel)">
						<Input
							value={block.heading ?? ""}
							onChange={(e) => onChange({ ...block, heading: e.target.value })}
						/>
					</Labelled>
					<MediaListField
						label="Foto's"
						value={block.items}
						onChange={(items) => onChange({ ...block, items })}
					/>
				</>
			);

		case "stats":
			return (
				<>
					<Labelled label="Kop (optioneel)">
						<Input
							value={block.heading ?? ""}
							placeholder="In Numbers"
							onChange={(e) => onChange({ ...block, heading: e.target.value })}
						/>
					</Labelled>
					<div className="flex flex-col gap-2">
						<Label>Cijfers</Label>
						{block.stats.map((stat, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: ordered list with no stable id
							<div key={i} className="flex gap-2">
								<Input
									className="w-28"
									placeholder="33"
									value={stat.value}
									onChange={(e) => {
										const stats = [...block.stats];
										stats[i] = { ...stat, value: e.target.value };
										onChange({ ...block, stats });
									}}
								/>
								<Input
									className="flex-1"
									placeholder="Uur bouwtijd"
									value={stat.label}
									onChange={(e) => {
										const stats = [...block.stats];
										stats[i] = { ...stat, label: e.target.value };
										onChange({ ...block, stats });
									}}
								/>
								<Button
									type="button"
									size="icon-sm"
									variant="ghost"
									aria-label="Cijfer verwijderen"
									onClick={() =>
										onChange({
											...block,
											stats: block.stats.filter((_, index) => index !== i),
										})
									}
								>
									<TrashIcon />
								</Button>
							</div>
						))}
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="self-start"
							onClick={() =>
								onChange({
									...block,
									stats: [...block.stats, { value: "", label: "" }],
								})
							}
						>
							<PlusIcon data-icon="inline-start" /> Cijfer
						</Button>
					</div>
				</>
			);

		case "quote":
			return (
				<>
					<Labelled label="Quote">
						<Textarea
							rows={3}
							value={block.quote}
							onChange={(e) => onChange({ ...block, quote: e.target.value })}
						/>
					</Labelled>
					<Labelled label="Van wie (optioneel)">
						<Input
							value={block.attribution ?? ""}
							placeholder="Naam, functie"
							onChange={(e) =>
								onChange({ ...block, attribution: e.target.value })
							}
						/>
					</Labelled>
				</>
			);

		case "livePreview":
			return (
				<>
					<Labelled label="Kop (optioneel)">
						<Input
							value={block.heading ?? ""}
							placeholder="Live preview"
							onChange={(e) => onChange({ ...block, heading: e.target.value })}
						/>
					</Labelled>
					<Labelled label="URL — de pagina wordt in een iframe getoond">
						<Input
							value={block.url}
							placeholder="https://voorbeeld.nl"
							onChange={(e) => onChange({ ...block, url: e.target.value })}
						/>
					</Labelled>
				</>
			);
	}
}

function Labelled({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label>{label}</Label>
			{children}
		</div>
	);
}
