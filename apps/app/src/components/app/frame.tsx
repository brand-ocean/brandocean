import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Frame is the surface every page section sits on: a muted tray with a
 * border, holding one or more white panels. Headers and footers live on the
 * tray itself; the panel bleeds 1px on each side so its border lands exactly
 * on the tray's border instead of doubling up.
 */
function Frame({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="frame"
			className={cn(
				"relative flex min-w-0 flex-col rounded-xl border bg-muted/50 bg-clip-padding",
				className,
			)}
			{...props}
		/>
	);
}

function FrameHeader({ className, ...props }: React.ComponentProps<"header">) {
	return (
		<header
			data-slot="frame-header"
			className={cn(
				"flex flex-col gap-3 px-4 py-2 lg:flex-row lg:items-center lg:justify-between",
				className,
			)}
			{...props}
		/>
	);
}

function FrameHeading({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="frame-heading"
			className={cn("flex min-w-0 flex-col gap-px", className)}
			{...props}
		/>
	);
}

function FrameTitle({ className, ...props }: React.ComponentProps<"h2">) {
	return (
		<h2
			data-slot="frame-title"
			className={cn("text-sm font-semibold", className)}
			{...props}
		/>
	);
}

function FrameDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="frame-description"
			className={cn("text-xs text-muted-foreground", className)}
			{...props}
		/>
	);
}

function FrameActions({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="frame-actions"
			className={cn("flex shrink-0 items-center gap-2", className)}
			{...props}
		/>
	);
}

/**
 * The white surface inside a Frame. `flush` drops the inner padding for
 * panels whose child manages its own spacing (tables, boards, editors).
 */
function FramePanel({
	className,
	flush = false,
	...props
}: React.ComponentProps<"div"> & { flush?: boolean }) {
	return (
		<div
			data-slot="frame-panel"
			className={cn(
				"relative -mx-px overflow-hidden rounded-xl border bg-card shadow-xs",
				"first:-mt-px last:-mb-px",
				flush ? "p-0" : "p-4",
				className,
			)}
			{...props}
		/>
	);
}

function FrameFooter({ className, ...props }: React.ComponentProps<"footer">) {
	return (
		<footer
			data-slot="frame-footer"
			className={cn(
				"flex flex-col gap-1 px-4 py-1.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Frame,
	FrameActions,
	FrameDescription,
	FrameFooter,
	FrameHeader,
	FrameHeading,
	FramePanel,
	FrameTitle,
};
