import type { Tone } from "@/components/app/tone";
import type { Doc } from "~convex/_generated/dataModel";

export type EntryType = Doc<"journalEntries">["type"];
export type AccountType = Doc<"ledgerAccounts">["type"];

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
	sales: "Verkoop",
	sales_payment: "Betaling",
	opening: "Opening",
	memoriaal: "Memoriaal",
	reversal: "Tegenboeking",
	purchase: "Inkoop",
	bank: "Bank",
	payroll: "Loon",
	vat_close: "BTW-afsluiting",
};

export const ENTRY_TYPE_TONE: Record<EntryType, Tone> = {
	sales: "success",
	sales_payment: "success",
	opening: "info",
	memoriaal: "neutral",
	reversal: "warning",
	purchase: "muted",
	bank: "muted",
	payroll: "info",
	vat_close: "danger",
};

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
	asset: "Activa",
	liability: "Passiva",
	equity: "Eigen vermogen",
	revenue: "Omzet",
	expense: "Kosten",
};

export function todayKey(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Parses a euro text input ("12,50" comes in as "12.50") into cents. */
export function toCents(value: string): number {
	return Math.round((Number(value) || 0) * 100);
}
