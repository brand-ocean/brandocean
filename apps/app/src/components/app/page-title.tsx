import * as React from "react";

type PageTitleContextValue = {
	title: string | null;
	setTitle: (next: string | null) => void;
};

const PageTitleContext = React.createContext<PageTitleContextValue | null>(
	null,
);

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
	const [title, setTitle] = React.useState<string | null>(null);
	const value = React.useMemo(() => ({ title, setTitle }), [title]);
	return (
		<PageTitleContext.Provider value={value}>
			{children}
		</PageTitleContext.Provider>
	);
}

export function usePageTitleValue(): string | null {
	return React.useContext(PageTitleContext)?.title ?? null;
}

/**
 * Detail pages call this to add their record's name as the last breadcrumb
 * crumb in the app header. Passing null (while loading) leaves it off.
 */
export function usePageTitle(title: string | null | undefined) {
	const ctx = React.useContext(PageTitleContext);
	const setTitle = ctx?.setTitle;
	React.useEffect(() => {
		if (!setTitle) return;
		setTitle(title ?? null);
		return () => setTitle(null);
	}, [setTitle, title]);
}
