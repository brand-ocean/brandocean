import { cva, type VariantProps } from "class-variance-authority";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Semantic colour for a status. Everything status-shaped in the app —
 * offerte state, invoice state, task state, mandate state — maps onto one of
 * these so the whole product speaks a single colour language.
 */
export type Tone =
	| "neutral"
	| "muted"
	| "success"
	| "warning"
	| "info"
	| "danger";

const toneRing: Record<Tone, string> = {
	neutral: "border-border bg-background text-foreground",
	muted: "border-transparent bg-secondary text-secondary-foreground",
	success:
		"border-success/15 bg-success/10 text-success-foreground dark:border-success/25 dark:bg-success/15 dark:text-success",
	warning:
		"border-warning/15 bg-warning/10 text-warning-foreground dark:border-warning/25 dark:bg-warning/15 dark:text-warning",
	info: "border-info/15 bg-info/10 text-info-foreground dark:border-info/25 dark:bg-info/15 dark:text-info",
	danger:
		"border-destructive/15 bg-destructive/10 text-destructive-foreground dark:border-destructive/25 dark:bg-destructive/15 dark:text-destructive",
};

const toneDot: Record<Tone, string> = {
	neutral: "bg-muted-foreground",
	muted: "bg-muted-foreground",
	success: "bg-success",
	warning: "bg-warning",
	info: "bg-info",
	danger: "bg-destructive",
};

const pillVariants = cva(
	"relative inline-flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-sm border font-medium whitespace-nowrap tabular-nums [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3",
	{
		variants: {
			size: {
				sm: "h-4.5 min-w-4.5 px-1 py-0.25 text-[0.625rem] leading-none",
				default: "h-5 min-w-5 px-1.5 py-0.5 text-xs",
			},
		},
		defaultVariants: { size: "default" },
	},
);

export function TonePill({
	tone = "muted",
	dot = false,
	size,
	className,
	children,
	...props
}: React.ComponentProps<"span"> &
	VariantProps<typeof pillVariants> & { tone?: Tone; dot?: boolean }) {
	return (
		<span
			className={cn(pillVariants({ size }), toneRing[tone], className)}
			{...props}
		>
			{dot ? (
				<span
					aria-hidden
					className={cn("size-1.5 shrink-0 rounded-full", toneDot[tone])}
				/>
			) : null}
			{children}
		</span>
	);
}

/**
 * The small +8.2% / -2 chip next to a metric. Direction drives the colour so
 * a caller only has to say whether up is good.
 */
export function TrendChip({
	value,
	direction,
	className,
}: {
	value: string;
	direction: "up" | "down" | "flat";
	className?: string;
}) {
	const tone: Tone =
		direction === "up" ? "success" : direction === "down" ? "warning" : "muted";
	return (
		<TonePill size="sm" tone={tone} className={className}>
			{direction === "up" ? (
				<TrendingUpIcon />
			) : direction === "down" ? (
				<TrendingDownIcon />
			) : null}
			{value}
		</TonePill>
	);
}

/** A bare coloured dot, for list rows that only need a state hint. */
export function ToneDot({
	tone = "muted",
	className,
}: {
	tone?: Tone;
	className?: string;
}) {
	return (
		<span
			aria-hidden
			className={cn("size-2 shrink-0 rounded-full", toneDot[tone], className)}
		/>
	);
}
