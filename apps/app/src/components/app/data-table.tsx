import {
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ChevronsUpDownIcon,
	ChevronUpIcon,
} from "lucide-react";
import * as React from "react";

import { FrameFooter, FramePanel } from "@/components/app/frame";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortValue = string | number;

export type Column<T> = {
	/** Stable id, also used as the sort key. */
	id: string;
	header: React.ReactNode;
	cell: (row: T) => React.ReactNode;
	/** Provide to make the column sortable. */
	sortValue?: (row: T) => SortValue;
	align?: "left" | "right";
	/** Applied to both the header cell and the body cells. */
	className?: string;
	headClassName?: string;
};

type SortState = { id: string; dir: "asc" | "desc" } | null;

const PAGE_SIZES = [5, 10, 25, 50] as const;

/**
 * Table + pagination footer for a Frame. Renders its own FramePanel so a page
 * only has to supply the Frame header around it.
 */
export function DataTable<T>({
	rows,
	columns,
	getRowKey,
	renderRow,
	defaultSort = null,
	pageSize: initialPageSize = 10,
	paginate = true,
	noun = "rows",
	loading = false,
	empty,
	className,
}: {
	rows: readonly T[];
	columns: readonly Column<T>[];
	getRowKey: (row: T) => string;
	/** Wraps a row — use it to make the whole row a link. */
	renderRow?: (row: T, cells: React.ReactNode) => React.ReactNode;
	defaultSort?: SortState;
	pageSize?: number;
	paginate?: boolean;
	noun?: string;
	loading?: boolean;
	empty?: React.ReactNode;
	className?: string;
}) {
	const [sort, setSort] = React.useState<SortState>(defaultSort);
	const [pageSize, setPageSize] = React.useState(initialPageSize);
	const [page, setPage] = React.useState(0);

	const sorted = React.useMemo(() => {
		if (!sort) return rows;
		const col = columns.find((c) => c.id === sort.id);
		if (!col?.sortValue) return rows;
		const read = col.sortValue;
		return [...rows].sort((a, b) => {
			const av = read(a);
			const bv = read(b);
			const cmp =
				typeof av === "number" && typeof bv === "number"
					? av - bv
					: String(av).localeCompare(String(bv), undefined, {
							sensitivity: "base",
						});
			return sort.dir === "asc" ? cmp : -cmp;
		});
	}, [rows, columns, sort]);

	const pageCount = paginate
		? Math.max(1, Math.ceil(sorted.length / pageSize))
		: 1;
	const safePage = Math.min(page, pageCount - 1);
	const visible = paginate
		? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)
		: sorted;

	const toggleSort = (id: string) => {
		setPage(0);
		setSort((prev) =>
			prev?.id === id
				? prev.dir === "asc"
					? { id, dir: "desc" }
					: null
				: { id, dir: "asc" },
		);
	};

	const body = loading ? (
		<TableBody>
			{[0, 1, 2].map((i) => (
				<TableRow key={i} className="hover:bg-transparent">
					{columns.map((c) => (
						<TableCell key={c.id} className="px-4 py-3">
							<Skeleton className="h-4 w-full" />
						</TableCell>
					))}
				</TableRow>
			))}
		</TableBody>
	) : visible.length === 0 ? (
		<TableBody>
			<TableRow className="hover:bg-transparent">
				<TableCell colSpan={columns.length} className="p-0">
					{empty ?? (
						<p className="px-4 py-10 text-center text-sm text-muted-foreground">
							Nothing here yet.
						</p>
					)}
				</TableCell>
			</TableRow>
		</TableBody>
	) : (
		<TableBody>
			{visible.map((row) => {
				const cells = columns.map((c) => (
					<TableCell
						key={c.id}
						className={cn(
							"px-4 py-3 align-middle",
							c.align === "right" && "text-right",
							c.className,
						)}
					>
						{c.cell(row)}
					</TableCell>
				));
				const key = getRowKey(row);
				if (renderRow) {
					return (
						<React.Fragment key={key}>{renderRow(row, cells)}</React.Fragment>
					);
				}
				return <TableRow key={key}>{cells}</TableRow>;
			})}
		</TableBody>
	);

	const from = sorted.length === 0 ? 0 : safePage * pageSize + 1;
	const to = Math.min(sorted.length, (safePage + 1) * pageSize);

	return (
		<>
			<FramePanel flush className={className}>
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							{columns.map((c) => {
								const active = sort?.id === c.id;
								return (
									<TableHead
										key={c.id}
										aria-sort={
											active
												? sort.dir === "asc"
													? "ascending"
													: "descending"
												: undefined
										}
										className={cn(
											"h-10 px-4 text-xs font-medium text-muted-foreground",
											c.align === "right" && "text-right",
											c.headClassName ?? c.className,
										)}
									>
										{c.sortValue ? (
											<button
												type="button"
												onClick={() => toggleSort(c.id)}
												className={cn(
													"-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground",
													active && "text-foreground",
												)}
											>
												{c.header}
												{active ? (
													sort.dir === "asc" ? (
														<ChevronUpIcon className="size-3" />
													) : (
														<ChevronDownIcon className="size-3" />
													)
												) : (
													<ChevronsUpDownIcon className="size-3 opacity-40" />
												)}
											</button>
										) : (
											c.header
										)}
									</TableHead>
								);
							})}
						</TableRow>
					</TableHeader>
					{body}
				</Table>
			</FramePanel>
			{paginate && !loading && sorted.length > 0 ? (
				<FrameFooter>
					<div className="flex items-center gap-2">
						<span>Rows per page</span>
						<Select
							value={String(pageSize)}
							onValueChange={(v) => {
								setPageSize(Number(v ?? pageSize));
								setPage(0);
							}}
						>
							<SelectTrigger size="sm" className="h-7 w-16">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PAGE_SIZES.map((n) => (
									<SelectItem key={n} value={String(n)}>
										{n}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center gap-3">
						<span className="tabular-nums">
							{from} – {to} of {sorted.length} {noun}
						</span>
						<div className="flex items-center gap-1">
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label="Previous page"
								disabled={safePage === 0}
								onClick={() => setPage((p) => Math.max(0, p - 1))}
							>
								<ChevronLeftIcon />
							</Button>
							{Array.from({ length: pageCount }, (_, i) => i)
								.filter(
									(i) =>
										pageCount <= 5 ||
										i === 0 ||
										i === pageCount - 1 ||
										Math.abs(i - safePage) <= 1,
								)
								.map((i, idx, list) => (
									<React.Fragment key={i}>
										{idx > 0 && list[idx - 1] !== i - 1 ? (
											<span className="px-1 text-muted-foreground">…</span>
										) : null}
										<Button
											type="button"
											variant={i === safePage ? "outline" : "ghost"}
											size="icon-sm"
											onClick={() => setPage(i)}
										>
											{i + 1}
										</Button>
									</React.Fragment>
								))}
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label="Next page"
								disabled={safePage >= pageCount - 1}
								onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
							>
								<ChevronRightIcon />
							</Button>
						</div>
					</div>
				</FrameFooter>
			) : null}
		</>
	);
}
