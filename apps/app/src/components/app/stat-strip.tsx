import type * as React from "react";

import { TrendChip } from "@/components/app/tone";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatItem = {
	label: string;
	value: React.ReactNode;
	hint?: string;
	icon?: React.ComponentType<{ className?: string }>;
	trend?: { value: string; direction: "up" | "down" | "flat" };
};

/**
 * The divided KPI row that opens most pages: label + icon, a large number,
 * and an optional trend chip with a one-line reading of it.
 */
export function StatStrip({
	items,
	loading = false,
	columns = 4,
	className,
}: {
	items: readonly StatItem[];
	loading?: boolean;
	columns?: 2 | 3 | 4;
	className?: string;
}) {
	const cols =
		columns === 2
			? "sm:grid-cols-2"
			: columns === 3
				? "sm:grid-cols-2 lg:grid-cols-3"
				: "sm:grid-cols-2 lg:grid-cols-4";

	if (loading) {
		return (
			<div className={cn("grid grid-cols-1 gap-6", cols, className)}>
				{Array.from({ length: columns }, (_, i) => `stat-skeleton-${i}`).map(
					(key) => (
						<div key={key} className="flex flex-col gap-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-8 w-16" />
							<Skeleton className="h-4 w-32" />
						</div>
					),
				)}
			</div>
		);
	}

	return (
		<div
			className={cn(
				"grid grid-cols-1 gap-y-6 divide-border sm:divide-x",
				cols,
				className,
			)}
		>
			{items.map((item) => (
				<div
					key={item.label}
					className="flex flex-col gap-1.5 sm:px-6 sm:first:pl-0 sm:last:pr-0"
				>
					<div className="flex items-center gap-2 text-sm font-medium">
						{item.icon ? (
							<item.icon className="size-4 text-muted-foreground" />
						) : null}
						<span>{item.label}</span>
					</div>
					<p className="text-3xl font-semibold tracking-tight tabular-nums">
						{item.value}
					</p>
					{item.trend || item.hint ? (
						<div className="flex items-center gap-2">
							{item.trend ? (
								<TrendChip
									value={item.trend.value}
									direction={item.trend.direction}
								/>
							) : null}
							{item.hint ? (
								<span className="truncate text-sm text-muted-foreground">
									{item.hint}
								</span>
							) : null}
						</div>
					) : null}
				</div>
			))}
		</div>
	);
}
