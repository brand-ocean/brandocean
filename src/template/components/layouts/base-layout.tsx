// @ts-nocheck
// Pass-through replacement: the original BaseLayout wrapped each template page
// in its own SidebarProvider + AppSidebar + SiteHeader + SiteFooter. Template
// pages are rendered INSIDE our existing _app shell, so this strips BaseLayout
// to a thin content wrapper — no nested sidebar, no template header, no footer.

import type * as React from "react";

interface BaseLayoutProps {
	children: React.ReactNode;
	title?: string;
	description?: string;
}

export function BaseLayout({ children, title, description }: BaseLayoutProps) {
	return (
		<div className="@container/main flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			{title ? (
				<div className="px-4 lg:px-6">
					<div className="flex flex-col gap-2">
						<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
						{description ? (
							<p className="text-muted-foreground">{description}</p>
						) : null}
					</div>
				</div>
			) : null}
			{children}
		</div>
	);
}
