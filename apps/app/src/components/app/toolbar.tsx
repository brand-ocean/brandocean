import { SearchIcon, XIcon } from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Filter/search strip that sits between a frame header and its panel. */
export function Toolbar({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="frame-toolbar"
			className={cn(
				"flex flex-wrap items-center gap-2 px-4 pt-1 pb-2",
				className,
			)}
			{...props}
		/>
	);
}

export function ToolbarSearch({
	value,
	onValueChange,
	placeholder = "Search…",
	className,
}: {
	value: string;
	onValueChange: (next: string) => void;
	placeholder?: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"relative flex h-8 min-w-0 flex-1 items-center sm:max-w-72",
				className,
			)}
		>
			<SearchIcon className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
			<input
				value={value}
				onChange={(e) => onValueChange(e.target.value)}
				placeholder={placeholder}
				className="h-8 w-full rounded-lg border border-input bg-background pr-8 pl-8 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
			/>
			{value ? (
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					aria-label="Clear search"
					className="absolute right-1"
					onClick={() => onValueChange("")}
				>
					<XIcon />
				</Button>
			) : null}
		</div>
	);
}

export type CountTab = {
	id: string;
	label: string;
	count?: number;
};

/** Underlined tab row with counts, as used on the list pages. */
export function CountTabs({
	tabs,
	value,
	onValueChange,
	className,
}: {
	tabs: readonly CountTab[];
	value: string;
	onValueChange: (next: string) => void;
	className?: string;
}) {
	return (
		<div
			className={cn("flex items-center gap-1 overflow-x-auto px-4", className)}
		>
			{tabs.map((tab) => {
				const active = tab.id === value;
				return (
					<button
						key={tab.id}
						type="button"
						onClick={() => onValueChange(tab.id)}
						data-active={active || undefined}
						className={cn(
							"-mb-px flex shrink-0 items-center gap-2 border-b-2 border-transparent px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
							active && "border-foreground text-foreground",
						)}
					>
						{tab.label}
						{typeof tab.count === "number" ? (
							<span
								className={cn(
									"rounded-sm bg-secondary px-1.5 py-0.5 text-[0.6875rem] leading-none tabular-nums",
									active && "bg-foreground text-background",
								)}
							>
								{tab.count}
							</span>
						) : null}
					</button>
				);
			})}
		</div>
	);
}
