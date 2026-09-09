import type { ClientPreview } from "../types";
import { goudsePoort } from "./goudse-poort";

/** Elke preview is bereikbaar op /preview/<slug>. Nieuwe klant: bestand erbij, hier registreren. */
export const previews: Record<string, ClientPreview> = {
	[goudsePoort.slug]: goudsePoort,
};
