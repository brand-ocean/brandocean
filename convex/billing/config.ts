// Usage-billing pricing model — pure config + math, no Convex functions here so
// it can be imported from queries, mutations and actions alike.
//
// Every metric is metered in a canonical unit and priced at a provider COST per
// unit (in EUR). The client is billed cost × markup. The cost figures below are
// starting estimates derived from public Cloudflare Workers Paid + Convex
// Professional pricing; VERIFY and adjust them against your actual invoices and
// EUR/USD rate before going live — they are deliberately conservative.

export const DEFAULT_MARKUP = 3;

// Currency everything is charged in.
export const CURRENCY = "EUR";

// Number of write-shards per (client, metric, day) bucket. Higher = less write
// contention on hot clients, more rows to sum at bill time. 10 is plenty for a
// small agency; raise if a single client's log-stream volume is very high.
export const USAGE_SHARDS = 10;

// A metric's canonical unit and the provider cost of one unit, in EUR.
export type MetricKey =
	| "cf_requests"
	| "cf_cpu_ms"
	| "cf_egress_bytes"
	| "cx_function_calls"
	| "cx_db_bandwidth_bytes"
	| "cx_action_gbhr"
	| "cx_storage_byte_days"
	| "cx_egress_bytes";

export type MetricDef = {
	key: MetricKey;
	label: string;
	unit: string;
	// Provider cost of ONE canonical unit, in EUR.
	costPerUnitEur: number;
	source: "cloudflare" | "convex";
};

const GiB = 1024 ** 3;

export const METRICS: Record<MetricKey, MetricDef> = {
	// --- Cloudflare Workers (standard usage, Paid plan) ---
	cf_requests: {
		key: "cf_requests",
		label: "Worker requests",
		unit: "request",
		// ~$0.30 per million requests beyond the included 10M.
		costPerUnitEur: 0.3 / 1_000_000,
		source: "cloudflare",
	},
	cf_cpu_ms: {
		key: "cf_cpu_ms",
		label: "Worker CPU time",
		unit: "ms",
		// ~$0.02 per million CPU-milliseconds beyond the included 30M.
		costPerUnitEur: 0.02 / 1_000_000,
		source: "cloudflare",
	},
	cf_egress_bytes: {
		key: "cf_egress_bytes",
		label: "CDN bandwidth",
		unit: "byte",
		// Cloudflare does not bill egress bandwidth — default 0 so it shows up in
		// dashboards without inflating the bill. Set a value to bill it anyway.
		costPerUnitEur: 0,
		source: "cloudflare",
	},

	// --- Convex (Professional plan overage rates) ---
	cx_function_calls: {
		key: "cx_function_calls",
		label: "Convex function calls",
		unit: "call",
		// ~$2.00 per million function calls beyond the included allotment.
		costPerUnitEur: 2 / 1_000_000,
		source: "convex",
	},
	cx_db_bandwidth_bytes: {
		key: "cx_db_bandwidth_bytes",
		label: "Convex database bandwidth",
		unit: "byte",
		// ~$0.20 per GiB (read + write document IO).
		costPerUnitEur: 0.2 / GiB,
		source: "convex",
	},
	cx_action_gbhr: {
		key: "cx_action_gbhr",
		label: "Convex action compute",
		unit: "GB-hour",
		// ~$0.30 per GB-hour of action runtime memory.
		costPerUnitEur: 0.3,
		source: "convex",
	},
	cx_storage_byte_days: {
		key: "cx_storage_byte_days",
		label: "Convex storage",
		unit: "byte-day",
		// ~$0.20 per GiB-month → per byte-day (30-day month).
		costPerUnitEur: 0.2 / GiB / 30,
		source: "convex",
	},
	cx_egress_bytes: {
		key: "cx_egress_bytes",
		label: "Convex file/egress bandwidth",
		unit: "byte",
		// ~$0.20 per GiB of egress (file downloads + network egress).
		costPerUnitEur: 0.2 / GiB,
		source: "convex",
	},
};

export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

export function isMetricKey(k: string): k is MetricKey {
	return Object.prototype.hasOwnProperty.call(METRICS, k);
}

// A single metric's contribution to a period's bill.
export type ChargeLine = {
	metric: MetricKey;
	quantity: number;
	costCents: number;
	amountCents: number;
};

export type ChargeComputation = {
	lines: ChargeLine[];
	usageCents: number; // sum of billed line amounts
};

// Turn summed per-metric quantities into billed eurocents. Rounding to cents is
// done once on the final per-line amount to avoid drift.
export function computeCharge(
	quantities: Partial<Record<MetricKey, number>>,
	markup: number,
): ChargeComputation {
	const lines: ChargeLine[] = [];
	let usageCents = 0;
	for (const key of METRIC_KEYS) {
		const quantity = quantities[key] ?? 0;
		if (quantity <= 0) continue;
		const def = METRICS[key];
		const costEur = quantity * def.costPerUnitEur;
		const costCents = Math.round(costEur * 100);
		const amountCents = Math.round(costEur * markup * 100);
		if (amountCents <= 0 && costCents <= 0) continue;
		lines.push({ metric: key, quantity, costCents, amountCents });
		usageCents += amountCents;
	}
	return { lines, usageCents };
}

// Format eurocents as a Mollie amount string, e.g. 1234 -> "12.34".
export function centsToAmountString(cents: number): string {
	return (cents / 100).toFixed(2);
}
