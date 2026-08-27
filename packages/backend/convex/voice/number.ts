import { ConvexError } from "convex/values";

// E.164, want dat is wat ElevenLabs en Twilio accepteren. Nederlandse nummers
// worden veel vaker als 06- of 0900- opgeschreven dan als +31, dus dat vertalen
// we hier, in plaats van het aan mij over te laten op het moment dat ik haast heb.
export function toE164(raw: string): string {
	const trimmed = raw.replace(/[\s\-().]/g, "");
	if (trimmed.startsWith("+")) return trimmed;
	if (trimmed.startsWith("00")) return `+${trimmed.slice(2)}`;
	if (trimmed.startsWith("0")) return `+31${trimmed.slice(1)}`;
	throw new ConvexError("bad_number");
}
