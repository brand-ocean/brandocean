import { useLenis } from "@/hooks/useLenis";

interface LenisProviderProps {
	children: React.ReactNode;
}

export function LenisProvider({ children }: LenisProviderProps) {
	useLenis();

	return <>{children}</>;
}
