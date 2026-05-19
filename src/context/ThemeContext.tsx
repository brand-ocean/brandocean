import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { useThemeTransition } from "../hooks/useThemeTransition";

type Theme = "light" | "dark";

interface ThemeContextValue {
	theme: Theme;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "theme";

function getInitialTheme(): Theme {
	if (typeof window === "undefined") return "light";

	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === "light" || stored === "dark") return stored;

	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	return prefersDark ? "dark" : "light";
}

interface ThemeProviderProps {
	children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
	const [theme, setTheme] = useState<Theme>("light");
	const [mounted, setMounted] = useState(false);
	const { runTransition } = useThemeTransition();

	useEffect(() => {
		setTheme(getInitialTheme());
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!mounted) return;
		document.documentElement.setAttribute("data-theme", theme);
		document.documentElement.classList.toggle("dark", theme === "dark");
		localStorage.setItem(STORAGE_KEY, theme);
	}, [theme, mounted]);

	const toggleTheme = useCallback(() => {
		if (!mounted) return;
		runTransition(() => {
			setTheme((prev) => (prev === "light" ? "dark" : "light"));
		});
	}, [runTransition, mounted]);

	return (
		<ThemeContext.Provider value={{ theme, toggleTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
