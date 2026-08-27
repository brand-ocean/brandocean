import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** Formats integer eurocents as a localised currency string. */
export function formatCurrency(cents: number, currency = "EUR"): string {
	return new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(
		cents / 100,
	);
}

/** Formats a "YYYY-MM-DD" day key or ms epoch as an nl-NL date. */
export function formatDate(input: string | number): string {
	const date =
		typeof input === "number" ? new Date(input) : new Date(`${input}T00:00:00`);
	return new Intl.DateTimeFormat("nl-NL", { dateStyle: "medium" }).format(date);
}
