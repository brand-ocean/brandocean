import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { useThemeTransition } from "../hooks/useThemeTransition";

/** What the user picked. "system" follows the OS. */
type ThemePreference = "light" | "dark" | "system";
/** What is actually painted on the document. */
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
	/** The resolved theme applied to <html> (system already collapsed to light/dark). */
	theme: ResolvedTheme;
	/** The raw preference, including "system". Use this to drive theme pickers. */
	preference: ThemePreference;
	/** Toggle between light and dark. Always sets an explicit preference. */
	toggleTheme: () => void;
	/** Set the preference directly. Animates only when the painted theme changes. */
	setTheme: (
		preference: ThemePreference,
		options?: { animate?: boolean },
	) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "theme";

function prefersDark(): boolean {
	return (
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-color-scheme: dark)").matches
	);
}

function getInitialPreference(): ThemePreference {
	if (typeof window === "undefined") return "system";
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === "light" || stored === "dark" || stored === "system") {
		return stored;
	}
	return "system";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
	if (preference === "system") return prefersDark() ? "dark" : "light";
	return preference;
}

interface ThemeProviderProps {
	children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
	const [preference, setPreference] = useState<ThemePreference>("system");
	const [theme, setResolvedTheme] = useState<ResolvedTheme>("light");
	const [mounted, setMounted] = useState(false);
	const { runTransition } = useThemeTransition();

	// Read the persisted preference once we're on the client.
	useEffect(() => {
		const initial = getInitialPreference();
		setPreference(initial);
		setResolvedTheme(resolveTheme(initial));
		setMounted(true);
	}, []);

	// Apply the resolved theme to the document and persist the preference.
	useEffect(() => {
		if (!mounted) return;
		document.documentElement.setAttribute("data-theme", theme);
		document.documentElement.classList.toggle("dark", theme === "dark");
		localStorage.setItem(STORAGE_KEY, preference);
	}, [theme, preference, mounted]);

	// While following the OS, react to system theme changes live.
	useEffect(() => {
		if (!mounted || preference !== "system") return;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => setResolvedTheme(mq.matches ? "dark" : "light");
		mq.addEventListener("change", onChange);
		return () => mq.removeEventListener("change", onChange);
	}, [preference, mounted]);

	const setTheme = useCallback(
		(next: ThemePreference, options?: { animate?: boolean }) => {
			if (!mounted) return;
			const resolved = resolveTheme(next);
			const apply = () => {
				setPreference(next);
				setResolvedTheme(resolved);
			};
			// Only run the liquid transition when the painted color actually flips.
			if (options?.animate !== false && resolved !== theme) {
				runTransition(apply);
			} else {
				apply();
			}
		},
		[mounted, theme, runTransition],
	);

	const toggleTheme = useCallback(() => {
		setTheme(theme === "light" ? "dark" : "light");
	}, [theme, setTheme]);

	return (
		<ThemeContext.Provider value={{ theme, preference, toggleTheme, setTheme }}>
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
