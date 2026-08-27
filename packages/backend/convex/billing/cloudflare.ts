// Pull per-client Cloudflare usage from the GraphQL Analytics API and meter it.
//
// Because each client has their own Worker(s) and zone(s), Cloudflare already
// segments usage by scriptName / zoneTag — we just read it. This runs daily
// (see crons.ts) for the previous complete UTC day, so numbers are final. The
// pull is idempotent: it SETs each day's total via model.setDailyUsage, so a
// re-run overwrites rather than double-counts.

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MetricKey } from "./config";
import { utcDayKey } from "./model";

const GQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

type GqlResult<T> = {
	data?: T;
	errors?: Array<{ message: string }> | null;
};

async function gql<T>(
	token: string,
	query: string,
	variables: Record<string, unknown>,
): Promise<T | null> {
	let res: Response;
	try {
		res = await fetch(GQL_ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query, variables }),
		});
	} catch {
		return null;
	}
	if (!res.ok) return null;
	const body = (await res.json()) as GqlResult<T>;
	if (body.errors && body.errors.length) {
		console.error("cloudflare graphql errors", body.errors);
		return null;
	}
	return body.data ?? null;
}

// Worker requests + CPU time for one script over a single UTC day.
const WORKER_QUERY = `
query ($account: String!, $script: String!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      workersInvocationsAdaptive(
        limit: 1000
        filter: { scriptName: $script, datetime_geq: $start, datetime_leq: $end }
      ) {
        sum { requests errors }
        quantiles { cpuTimeP50 }
        dimensions { scriptName }
      }
    }
  }
}`;

type WorkerData = {
	viewer: {
		accounts: Array<{
			workersInvocationsAdaptive: Array<{
				sum: { requests: number; errors: number };
				quantiles: { cpuTimeP50: number }; // microseconds per request (median)
			}>;
		}>;
	};
};

// Zone bandwidth (bytes) for a single UTC day.
const ZONE_QUERY = `
query ($zone: String!, $day: String!) {
  viewer {
    zones(filter: { zoneTag: $zone }) {
      httpRequests1dGroups(limit: 1, filter: { date: $day }) {
        sum { bytes }
      }
    }
  }
}`;

type ZoneData = {
	viewer: {
		zones: Array<{
			httpRequests1dGroups: Array<{ sum: { bytes: number } }>;
		}>;
	};
};

async function pullWorker(
	token: string,
	account: string,
	script: string,
	day: string,
): Promise<{ requests: number; cpuMs: number } | null> {
	const data = await gql<WorkerData>(token, WORKER_QUERY, {
		account,
		script,
		start: `${day}T00:00:00Z`,
		end: `${day}T23:59:59Z`,
	});
	const rows = data?.viewer.accounts[0]?.workersInvocationsAdaptive ?? [];
	if (rows.length === 0) return { requests: 0, cpuMs: 0 };
	let requests = 0;
	let cpuP50 = 0; // representative median µs/request (first non-zero row)
	for (const row of rows) {
		requests += row.sum.requests ?? 0;
		if (cpuP50 === 0 && row.quantiles?.cpuTimeP50) {
			cpuP50 = row.quantiles.cpuTimeP50;
		}
	}
	// Estimate total CPU ms = median µs/request × total requests ÷ 1000.
	const cpuMs = (cpuP50 * requests) / 1000;
	return { requests, cpuMs };
}

async function pullZone(
	token: string,
	zone: string,
	day: string,
): Promise<{ bytes: number } | null> {
	const data = await gql<ZoneData>(token, ZONE_QUERY, { zone, day });
	const group = data?.viewer.zones[0]?.httpRequests1dGroups[0];
	return { bytes: group?.sum.bytes ?? 0 };
}

// Meter the previous complete UTC day for every active billing client. `day`
// can be overridden for backfills.
export const pullDaily = internalAction({
	args: { day: v.optional(v.string()) },
	handler: async (ctx, args): Promise<{ clients: number; day: string }> => {
		const account = process.env.CLOUDFLARE_ACCOUNT_ID;
		const token =
			process.env.CLOUDFLARE_ANALYTICS_API_TOKEN ??
			process.env.CLOUDFLARE_BROWSER_API_TOKEN;
		const day = args.day ?? utcDayKey(Date.now() - 24 * 60 * 60 * 1000);
		if (!account || !token) {
			console.error("cloudflare billing pull: missing account/token env");
			return { clients: 0, day };
		}

		const clients = await ctx.runQuery(
			internal.billing.model.activeBillingClients,
			{},
		);

		let processed = 0;
		for (const bc of clients) {
			const resources = await ctx.runQuery(
				internal.billing.model.cloudflareResources,
				{ billingClientId: bc._id },
			);
			if (resources.length === 0) continue;

			const totals: Partial<Record<MetricKey, number>> = {};
			const add = (metric: MetricKey, qty: number) => {
				totals[metric] = (totals[metric] ?? 0) + qty;
			};

			for (const r of resources) {
				if (r.kind === "cf_worker") {
					const w = await pullWorker(token, account, r.identifier, day);
					if (w) {
						add("cf_requests", w.requests);
						add("cf_cpu_ms", w.cpuMs);
					}
				} else if (r.kind === "cf_zone") {
					const z = await pullZone(token, r.identifier, day);
					if (z) add("cf_egress_bytes", z.bytes);
				}
			}

			const entries = (Object.keys(totals) as MetricKey[]).map((metric) => ({
				metric,
				quantity: totals[metric] ?? 0,
			}));
			if (entries.length) {
				await ctx.runMutation(internal.billing.model.setDailyUsage, {
					billingClientId: bc._id as Id<"billingClients">,
					day,
					entries,
				});
			}
			processed += 1;
		}

		return { clients: processed, day };
	},
});
