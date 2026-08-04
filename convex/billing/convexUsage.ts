// Ingest per-client Convex usage from that client's deployment Log Stream.
//
// Each client deployment gets a log stream whose webhook URL points at
// /billing/convex-usage?deployment=<name>&secret=<...> (see http.ts). Every
// request carries a batch of events for ONE deployment; we aggregate the batch
// in-memory per day and write a handful of rows — never one write per event,
// which would cost more than the usage we're billing.
//
// Event resource fields come from Convex's usage log stream (function_execution,
// current_storage_usage, storage_api_bandwidth). See
// https://docs.convex.dev/platform-apis/track-usage

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { MetricKey } from "./config";
import { utcDayKey } from "./model";

type Json = Record<string, unknown>;

function num(o: Json, key: string): number {
	const val = o[key];
	return typeof val === "number" && Number.isFinite(val) ? val : 0;
}

function str(o: Json, key: string): string | undefined {
	const val = o[key];
	return typeof val === "string" ? val : undefined;
}

// Convex tags each event with its type; be lenient about the field name.
function eventTopic(e: Json): string {
	return str(e, "topic") ?? str(e, "_topic") ?? str(e, "kind") ?? "";
}

// Event timestamp in ms; log streams send seconds or ms depending on field.
function eventDay(e: Json, fallbackMs: number): string {
	const ts = e.timestamp;
	if (typeof ts === "number" && Number.isFinite(ts)) {
		// Heuristic: values below ~10^12 are seconds.
		const ms = ts < 1e12 ? ts * 1000 : ts;
		return utcDayKey(ms);
	}
	return utcDayKey(fallbackMs);
}

// Per-day accumulator: incremental metrics sum; storage takes the latest gauge.
type DayAgg = {
	incr: Partial<Record<MetricKey, number>>;
	storageBytes: number | null;
};

function emptyDay(): DayAgg {
	return { incr: {}, storageBytes: null };
}

export const ingestConvexEvents = internalAction({
	args: {
		deployment: v.string(),
		events: v.array(v.any()),
		receivedAt: v.number(),
	},
	handler: async (ctx, args): Promise<{ recorded: boolean }> => {
		const target = await ctx.runQuery(internal.billing.model.resourceOwner, {
			kind: "cx_deployment",
			identifier: args.deployment,
		});
		// Unknown / inactive deployment: ack so Convex doesn't retry forever.
		if (!target) return { recorded: false };

		const byDay = new Map<string, DayAgg>();
		const dayOf = (d: string): DayAgg => {
			let agg = byDay.get(d);
			if (!agg) {
				agg = emptyDay();
				byDay.set(d, agg);
			}
			return agg;
		};
		const addIncr = (agg: DayAgg, metric: MetricKey, qty: number) => {
			if (qty > 0) agg.incr[metric] = (agg.incr[metric] ?? 0) + qty;
		};

		for (const raw of args.events) {
			if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
			const e = raw as Json;
			const topic = eventTopic(e);
			const day = eventDay(e, args.receivedAt);
			const agg = dayOf(day);

			if (topic === "function_execution" || topic === "function_call") {
				addIncr(agg, "cx_function_calls", 1);
				addIncr(
					agg,
					"cx_db_bandwidth_bytes",
					num(e, "database_io_read_bytes") + num(e, "database_io_write_bytes"),
				);
				// action compute: memory (MB) held for execution_time_ms → GB-hours.
				const gbHours =
					(num(e, "action_memory_used_mb") / 1024) *
					(num(e, "execution_time_ms") / 3_600_000);
				addIncr(agg, "cx_action_gbhr", gbHours);
				addIncr(
					agg,
					"cx_egress_bytes",
					num(e, "network_egress_bytes") + num(e, "file_storage_read_bytes"),
				);
			} else if (topic === "storage_api_bandwidth") {
				addIncr(
					agg,
					"cx_egress_bytes",
					num(e, "egress_bytes") + num(e, "ingress_bytes"),
				);
			} else if (topic === "current_storage_usage") {
				// Gauge (current bytes). Sum the storage categories present and keep
				// the latest snapshot for the day as a byte-days proxy (held ~1 day).
				const bytes =
					num(e, "document_storage_bytes") +
					num(e, "index_storage_bytes") +
					num(e, "file_storage_bytes") +
					num(e, "vector_storage_bytes") +
					num(e, "text_index_storage_bytes") +
					// Fallbacks for a single combined field, if present.
					num(e, "total_storage_bytes") +
					num(e, "storage_bytes");
				agg.storageBytes = bytes;
			}
		}

		// Write: incremental metrics via recordUsage (add), storage via
		// setDailyUsage (replace, so repeated snapshots don't accumulate).
		for (const [day, agg] of byDay) {
			const entries = (Object.keys(agg.incr) as MetricKey[]).map((metric) => ({
				metric,
				quantity: agg.incr[metric] ?? 0,
			}));
			if (entries.length) {
				await ctx.runMutation(internal.billing.model.recordUsage, {
					billingClientId: target.billingClientId,
					day,
					entries,
				});
			}
			if (agg.storageBytes !== null) {
				await ctx.runMutation(internal.billing.model.setDailyUsage, {
					billingClientId: target.billingClientId,
					day,
					// byte-days = current bytes × 1 day.
					entries: [
						{ metric: "cx_storage_byte_days", quantity: agg.storageBytes },
					],
				});
			}
		}

		return { recorded: true };
	},
});

// Build the sink URL a client deployment should POST its usage events to. The
// deployment name is the same identifier stored on the billingResource, so
// resourceOwner can map an incoming batch back to its billing client. Exported
// so the same URL can be generated for hand-configured streams.
export function billingSinkUrl(
	siteUrl: string,
	secret: string,
	deploymentName: string,
): string {
	return (
		`${siteUrl}/billing/convex-usage` +
		`?deployment=${encodeURIComponent(deploymentName)}` +
		`&secret=${encodeURIComponent(secret)}`
	);
}

// Provision a usage log stream on a client deployment, pointing at our webhook.
//
// Targets the deployment's own HTTP API with that deployment's deploy key — NOT
// api.convex.dev, which has no log-stream endpoint at all; the previous version
// of this action could never have succeeded.
//
// CAVEAT: the deployment-api docs publish the endpoint but not its request body,
// so the `sink` shape below is inferred from the dashboard's own vocabulary. If
// Convex rejects it, the thrown error carries the API's response text, which
// names the expected fields — adjust and re-run. Creating the webhook by hand in
// the dashboard (Settings > Integrations > Webhook) with the URL from
// billingSinkUrl is the guaranteed alternative.
//
// Convex refuses a second stream of the same type, so this is create-once.
export const provisionLogStream = internalAction({
	args: {
		resourceId: v.id("billingResources"),
		deploymentName: v.string(),
		deployKey: v.string(),
	},
	handler: async (ctx, args): Promise<{ logStreamId: string }> => {
		const secret = process.env.BILLING_WEBHOOK_SECRET;
		const siteUrl = process.env.CONVEX_SITE_URL; // this deployment's .site URL
		if (!secret || !siteUrl) throw new Error("billing webhook not configured");

		const sinkUrl = billingSinkUrl(siteUrl, secret, args.deploymentName);
		const endpoint = `https://${args.deploymentName}.convex.cloud/api/create_log_stream`;

		const res = await fetch(endpoint, {
			method: "POST",
			headers: {
				Authorization: `Convex ${args.deployKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				sink: { type: "webhook", url: sinkUrl, format: "json" },
			}),
		});
		if (!res.ok) {
			const text = await res.text().catch(() => "");
			throw new Error(`log stream create failed: ${res.status} ${text}`);
		}
		const body = (await res.json()) as { id?: string; log_stream_id?: string };
		const logStreamId = body.id ?? body.log_stream_id ?? "";
		await ctx.runMutation(internal.billing.model.setResourceLogStream, {
			resourceId: args.resourceId,
			logStreamId,
		});
		return { logStreamId };
	},
});
