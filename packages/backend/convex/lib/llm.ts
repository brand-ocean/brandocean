import { convexGateway } from "@convex-dev/ai-sdk-provider";
import {
	generateText,
	type JSONSchema7,
	type JSONValue,
	jsonSchema,
	type LanguageModelUsage,
	type ModelMessage,
	NoObjectGeneratedError,
	Output,
	type ProviderMetadata,
} from "ai";

/**
 * Modelaanroepen via de Convex AI Gateway: geen provider-sleutels nodig, en
 * de gateway rapporteert de kosten per aanroep. Alleen vanuit een action.
 *
 * Anthropic-modellen gaan via het native Messages-endpoint; de rest via het
 * OpenAI-compatibele endpoint.
 */
export function languageModel(id: string) {
	return id.startsWith("anthropic/")
		? convexGateway.messages(id)
		: convexGateway(id);
}

/** JSON zoals een model hem teruggeeft, zonder `any`. */
export type Json = JSONValue;

type Meta = ProviderMetadata | undefined;
type JsonObject = Readonly<{ [key: string]: Json | undefined }>;

export function isObject(value: Json | undefined): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asCost(value: Json | undefined): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value >= 0
		? value
		: undefined;
}

/**
 * Dollarkosten van één aanroep: `convexGateway.cost` (OpenAI-compatibel) of
 * `anthropic.usage.cost` (Messages-endpoint).
 */
export function costOf(meta: Meta): number | undefined {
	const gateway = asCost(meta?.convexGateway?.cost);
	if (gateway !== undefined) return gateway;
	const usage = meta?.anthropic?.usage;
	if (isObject(usage)) {
		return asCost(usage.cost);
	}
	return undefined;
}

export function usageRow(
	kind: string,
	model: string,
	result: { usage: LanguageModelUsage; providerMetadata: Meta },
): {
	kind: string;
	model: string;
	inputTokens: number;
	outputTokens: number;
	costUsd?: number;
} {
	const costUsd = costOf(result.providerMetadata);
	return {
		kind,
		model,
		inputTokens: result.usage.inputTokens ?? 0,
		outputTokens: result.usage.outputTokens ?? 0,
		...(costUsd !== undefined ? { costUsd } : {}),
	};
}

/** Eerste JSON-object of -array uit een modelantwoord (ook met codeblok). */
export function extractJson(raw: string, open: "{" | "["): Json | null {
	const close = open === "[" ? "]" : "}";
	const start = raw.indexOf(open);
	const end = raw.lastIndexOf(close);
	if (start === -1 || end <= start) return null;
	try {
		const parsed: Json = JSON.parse(raw.slice(start, end + 1));
		return parsed;
	} catch {
		return null;
	}
}

export function field(value: Json | null, key: string): Json | undefined {
	return value !== null && isObject(value) ? value[key] : undefined;
}

export function str(value: Json | undefined, max = 400): string {
	return typeof value === "string"
		? value.replace(/\s+/g, " ").trim().slice(0, max)
		: "";
}

export function strList(
	value: Json | undefined,
	maxItems: number,
	maxLen = 300,
): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((v) => str(v, maxLen))
		.filter(Boolean)
		.slice(0, maxItems);
}

type CallOptions = {
	model: ReturnType<typeof languageModel>;
	instructions: string;
	temperature?: number;
	reasoning?: "minimal" | "low" | "medium" | "high";
	maxOutputTokens: number;
	maxRetries: number;
	abortSignal?: AbortSignal;
} & ({ prompt: string } | { messages: ModelMessage[] });

/**
 * Eén aanroep met gestructureerd antwoord (JSON-schema). Valt terug op de
 * eerste JSON in de tekst als het model zich niet aan het schema houdt.
 */
export async function generateJson(
	options: CallOptions & { schema: JSONSchema7; name: string },
): Promise<{
	json: Json | null;
	text: string;
	usage: LanguageModelUsage;
	providerMetadata: ProviderMetadata | undefined;
}> {
	const { schema, name, ...rest } = options;
	try {
		const output = Output.object({ schema: jsonSchema<Json>(schema), name });
		const result =
			"prompt" in rest
				? await generateText({ ...rest, output })
				: await generateText({ ...rest, output });
		return {
			json: result.output,
			text: result.text,
			usage: result.usage,
			providerMetadata: result.providerMetadata,
		};
	} catch (error) {
		if (NoObjectGeneratedError.isInstance(error) && error.text && error.usage) {
			return {
				json: extractJson(error.text, "{"),
				text: error.text,
				usage: error.usage,
				providerMetadata: undefined,
			};
		}
		// Kan het model geen JSON-schema (API-fout)? Dan zonder, en de eerste
		// JSON uit de tekst halen.
		const plain =
			"prompt" in rest
				? await generateText({
						...rest,
						instructions: `${rest.instructions}\n\nAntwoord met één JSON-object, zonder uitleg.`,
					})
				: await generateText({
						...rest,
						instructions: `${rest.instructions}\n\nAntwoord met één JSON-object, zonder uitleg.`,
					});
		console.warn(
			"generateJson: zonder schema opnieuw",
			String(error).slice(0, 200),
		);
		return {
			json: extractJson(plain.text, "{"),
			text: plain.text,
			usage: plain.usage,
			providerMetadata: plain.providerMetadata,
		};
	}
}
