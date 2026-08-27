import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

type Language = "en" | "nl";

interface LanguageContextValue {
	language: Language;
	toggleLanguage: () => void;
	setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "language";

function getInitialLanguage(): Language {
	if (typeof window === "undefined") return "nl";
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === "en" || stored === "nl") return stored;
	const browser = navigator.language?.toLowerCase() ?? "";
	return browser.startsWith("nl") ? "nl" : "en";
}

interface LanguageProviderProps {
	children: React.ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
	const [language, setLanguageState] = useState<Language>("nl");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setLanguageState(getInitialLanguage());
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!mounted) return;
		document.documentElement.setAttribute("lang", language);
		localStorage.setItem(STORAGE_KEY, language);
	}, [language, mounted]);

	const setLanguage = useCallback((lang: Language) => {
		setLanguageState(lang);
	}, []);

	const toggleLanguage = useCallback(() => {
		setLanguageState((prev) => (prev === "en" ? "nl" : "en"));
	}, []);

	return (
		<LanguageContext.Provider value={{ language, toggleLanguage, setLanguage }}>
			{children}
		</LanguageContext.Provider>
	);
}

export function useLanguage() {
	const context = useContext(LanguageContext);
	if (!context) {
		throw new Error("useLanguage must be used within a LanguageProvider");
	}
	return context;
}
