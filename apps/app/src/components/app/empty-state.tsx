import type * as React from "react";

import { cn } from "@/lib/utils";

/** Centred icon + copy + optional action, sized to sit inside a FramePanel. */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	className,
}: {
	icon?: React.ComponentType<{ className?: string }>;
	title: string;
	description?: string;
	action?: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
				className,
			)}
		>
			{Icon ? (
				<div className="flex size-10 items-center justify-center rounded-lg border bg-muted/50 text-muted-foreground">
					<Icon className="size-4.5" />
				</div>
			) : null}
			<div className="flex flex-col gap-1">
				<p className="text-sm font-semibold">{title}</p>
				{description ? (
					<p className="max-w-sm text-sm text-muted-foreground">
						{description}
					</p>
				) : null}
			</div>
			{action ? <div className="mt-1">{action}</div> : null}
		</div>
	);
}
