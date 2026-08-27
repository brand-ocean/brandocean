// Stripe incasso for usage billing.
//
// Onboarding: create a Stripe Customer + a Checkout Session in "setup" mode. The
// client saves a card or SEPA mandate there. Thereafter each period's (variable)
// amount is charged off-session with a PaymentIntent on the saved payment
// method — Stripe allows any amount per charge, which is what usage billing needs.
//
// No Stripe SDK: we call the REST API with fetch (form-encoded) in the default
// Convex runtime, and verify webhook signatures with Web Crypto.

import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { CURRENCY } from "./config";

const STRIPE_BASE = "https://api.stripe.com/v1";
const STRIPE_CURRENCY = CURRENCY.toLowerCase();

function stripeKey(): string {
	const key = process.env.STRIPE_SECRET_KEY;
	if (!key) throw new ConvexError("stripe_not_configured");
	return key;
}

// Stripe's API takes application/x-www-form-urlencoded with bracket notation for
// nested/array params, e.g. { "payment_method_types[0]": "card" }.
function formEncode(params: Record<string, string | number | undefined>): string {
	const sp = new URLSearchParams();
	for (const [k, val] of Object.entries(params)) {
		if (val !== undefined) sp.append(k, String(val));
	}
	return sp.toString();
}

async function stripe<T>(
	path: string,
	init: {
		method: string;
		params?: Record<string, string | number | undefined>;
		idempotencyKey?: string;
	} = { method: "GET" },
): Promise<T> {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${stripeKey()}`,
		"Content-Type": "application/x-www-form-urlencoded",
	};
	if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
	const res = await fetch(`${STRIPE_BASE}${path}`, {
		method: init.method,
		headers,
		body: init.params ? formEncode(init.params) : undefined,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new ConvexError(`stripe_error_${res.status}: ${text.slice(0, 300)}`);
	}
	return (await res.json()) as T;
}

function returnUrl(billingClientId: string, ok: boolean): string {
	const app = process.env.SITE_URL ?? "";
	return `${app}/billing/return?bc=${encodeURIComponent(billingClientId)}&status=${
		ok ? "ok" : "cancel"
	}`;
}

// --- Internal DB helpers ---------------------------------------------------

export const onboardingContext = internalQuery({
	args: { billingClientId: v.id("billingClients") },
	handler: async (ctx, args) => {
		const bc = await ctx.db.get(args.billingClientId);
		if (!bc) return null;
		const client = await ctx.db.get(bc.clientId);
		return {
			ownerId: bc.ownerId,
			stripeCustomerId: bc.stripeCustomerId ?? null,
			clientName: client?.name ?? "Client",
			clientEmail: client?.email ?? null,
		};
	},
});

export const setStripeCustomer = internalMutation({
	args: {
		billingClientId: v.id("billingClients"),
		stripeCustomerId: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.billingClientId, {
			stripeCustomerId: args.stripeCustomerId,
		});
		return null;
	},
});

export const setPaymentMethod = internalMutation({
	args: {
		stripeCustomerId: v.string(),
		paymentMethodId: v.string(),
	},
	handler: async (ctx, args) => {
		const bc = await ctx.db
			.query("billingClients")
			.withIndex("by_stripe_customer", (q) =>
				q.eq("stripeCustomerId", args.stripeCustomerId),
			)
			.first();
		if (!bc) return null;
		await ctx.db.patch(bc._id, {
			stripePaymentMethodId: args.paymentMethodId,
			mandateStatus: "valid",
		});
		return null;
	},
});

export const invoiceForCharge = internalQuery({
	args: { invoiceId: v.id("billingInvoices") },
	handler: async (ctx, args) => {
		const invoice = await ctx.db.get(args.invoiceId);
		if (!invoice) return null;
		const bc = await ctx.db.get(invoice.billingClientId);
		if (!bc) return null;
		return {
			amountCents: invoice.chargedCents,
			periodStart: invoice.periodStart,
			periodEnd: invoice.periodEnd,
			stripeCustomerId: bc.stripeCustomerId ?? null,
			stripePaymentMethodId: bc.stripePaymentMethodId ?? null,
			mandateStatus: bc.mandateStatus ?? null,
		};
	},
});

export const setInvoicePayment = internalMutation({
	args: {
		invoiceId: v.id("billingInvoices"),
		stripePaymentIntentId: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.invoiceId, {
			stripePaymentIntentId: args.stripePaymentIntentId,
			status: "pending",
			updatedAt: Date.now(),
		});
		return null;
	},
});

export const resolveInvoiceByPayment = internalQuery({
	args: { stripePaymentIntentId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("billingInvoices")
			.withIndex("by_stripe_payment", (q) =>
				q.eq("stripePaymentIntentId", args.stripePaymentIntentId),
			)
			.first();
	},
});

// Flip an invoice to paid/failed. On failure the amount is returned to the
// client's carryover so the next run re-attempts it (usage isn't lost).
export const settleInvoice = internalMutation({
	args: {
		invoiceId: v.id("billingInvoices"),
		status: v.union(v.literal("paid"), v.literal("failed")),
	},
	handler: async (ctx, args) => {
		const invoice = await ctx.db.get(args.invoiceId);
		if (!invoice) return null;
		if (invoice.status === "paid") return null; // already settled
		await ctx.db.patch(args.invoiceId, {
			status: args.status,
			updatedAt: Date.now(),
		});
		if (args.status === "failed" && invoice.chargedCents > 0) {
			const bc = await ctx.db.get(invoice.billingClientId);
			if (bc) {
				await ctx.db.patch(bc._id, {
					carryoverCents: bc.carryoverCents + invoice.chargedCents,
				});
			}
		}
		return null;
	},
});

// --- Actions ---------------------------------------------------------------

type StripeCustomer = { id: string };
type StripeCheckoutSession = { id: string; url: string | null };
type StripeSetupIntent = { id: string; payment_method: string | null };
type StripePaymentIntent = { id: string; status: string };

// Owner starts onboarding: returns a Stripe Checkout URL (setup mode) where the
// client saves a card / SEPA mandate. The webhook stores the payment method.
export const startOnboarding = action({
	args: { billingClientId: v.id("billingClients") },
	handler: async (ctx, args): Promise<{ checkoutUrl: string }> => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new ConvexError("unauthenticated");

		const info = await ctx.runQuery(
			internal.billing.stripe.onboardingContext,
			{ billingClientId: args.billingClientId },
		);
		if (!info || info.ownerId !== userId) throw new ConvexError("forbidden");

		let customerId = info.stripeCustomerId;
		if (!customerId) {
			const customer = await stripe<StripeCustomer>("/customers", {
				method: "POST",
				params: {
					name: info.clientName,
					email: info.clientEmail ?? undefined,
				},
			});
			customerId = customer.id;
			await ctx.runMutation(internal.billing.stripe.setStripeCustomer, {
				billingClientId: args.billingClientId,
				stripeCustomerId: customerId,
			});
		}

		const session = await stripe<StripeCheckoutSession>("/checkout/sessions", {
			method: "POST",
			params: {
				mode: "setup",
				customer: customerId,
				currency: STRIPE_CURRENCY,
				"payment_method_types[0]": "card",
				"payment_method_types[1]": "sepa_debit",
				success_url: returnUrl(args.billingClientId, true),
				cancel_url: returnUrl(args.billingClientId, false),
			},
		});
		if (!session.url) throw new ConvexError("stripe_no_checkout_url");
		return { checkoutUrl: session.url };
	},
});

// Charge one invoice's amount off-session on the saved payment method.
export const chargeInvoice = internalAction({
	args: { invoiceId: v.id("billingInvoices") },
	handler: async (ctx, args): Promise<{ ok: boolean; reason?: string }> => {
		const info = await ctx.runQuery(internal.billing.stripe.invoiceForCharge, {
			invoiceId: args.invoiceId,
		});
		if (!info) return { ok: false, reason: "invoice_not_found" };
		if (info.amountCents <= 0) return { ok: false, reason: "zero_amount" };
		if (
			!info.stripeCustomerId ||
			!info.stripePaymentMethodId ||
			info.mandateStatus !== "valid"
		) {
			return { ok: false, reason: "no_payment_method" };
		}

		let payment: StripePaymentIntent;
		try {
			payment = await stripe<StripePaymentIntent>("/payment_intents", {
				method: "POST",
				// Idempotent on the invoice id: a retried run won't double-charge.
				idempotencyKey: `charge_${args.invoiceId}`,
				params: {
					amount: info.amountCents,
					currency: STRIPE_CURRENCY,
					customer: info.stripeCustomerId,
					payment_method: info.stripePaymentMethodId,
					off_session: "true",
					confirm: "true",
					description: `Verbruik ${info.periodStart} — ${info.periodEnd}`,
				},
			});
		} catch (e) {
			// Synchronous decline (e.g. card) → mark failed so the amount carries over.
			await ctx.runMutation(internal.billing.stripe.settleInvoice, {
				invoiceId: args.invoiceId,
				status: "failed",
			});
			return {
				ok: false,
				reason: e instanceof Error ? e.message : "charge_failed",
			};
		}

		await ctx.runMutation(internal.billing.stripe.setInvoicePayment, {
			invoiceId: args.invoiceId,
			stripePaymentIntentId: payment.id,
		});
		// Cards often succeed synchronously; SEPA settles later via webhook.
		if (payment.status === "succeeded") {
			await ctx.runMutation(internal.billing.stripe.settleInvoice, {
				invoiceId: args.invoiceId,
				status: "paid",
			});
		}
		return { ok: true };
	},
});

// --- Webhook ---------------------------------------------------------------

function hex(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let out = "";
	for (let i = 0; i < bytes.length; i++) {
		out += bytes[i].toString(16).padStart(2, "0");
	}
	return out;
}

// Verify a Stripe webhook signature (scheme v1: HMAC-SHA256 over `${t}.${body}`).
async function verifySignature(
	payload: string,
	sigHeader: string,
	secret: string,
): Promise<boolean> {
	let t = "";
	const v1: string[] = [];
	for (const part of sigHeader.split(",")) {
		const [k, val] = part.split("=");
		if (k === "t") t = val;
		else if (k === "v1") v1.push(val);
	}
	if (!t || v1.length === 0) return false;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(`${t}.${payload}`),
	);
	const expected = hex(sig);
	return v1.some((candidate) => candidate === expected);
}

type StripeEvent = {
	type: string;
	data: { object: Record<string, unknown> };
};

// Verify + process a Stripe webhook. Called from http.ts with the raw body.
export const handleWebhook = internalAction({
	args: { payload: v.string(), signature: v.string() },
	handler: async (ctx, args): Promise<{ ok: boolean }> => {
		const secret = process.env.STRIPE_WEBHOOK_SECRET;
		if (!secret) throw new ConvexError("stripe_webhook_not_configured");
		const valid = await verifySignature(args.payload, args.signature, secret);
		if (!valid) return { ok: false };

		const event = JSON.parse(args.payload) as StripeEvent;
		const obj = event.data.object;

		if (event.type === "checkout.session.completed") {
			const customer =
				typeof obj.customer === "string" ? obj.customer : null;
			const setupIntentId =
				typeof obj.setup_intent === "string" ? obj.setup_intent : null;
			if (customer && setupIntentId) {
				const si = await stripe<StripeSetupIntent>(
					`/setup_intents/${setupIntentId}`,
				);
				if (si.payment_method) {
					await ctx.runMutation(internal.billing.stripe.setPaymentMethod, {
						stripeCustomerId: customer,
						paymentMethodId: si.payment_method,
					});
					// Make it the default for any future off-session use.
					await stripe(`/customers/${customer}`, {
						method: "POST",
						params: {
							"invoice_settings[default_payment_method]": si.payment_method,
						},
					}).catch(() => undefined);
				}
			}
			return { ok: true };
		}

		if (
			event.type === "payment_intent.succeeded" ||
			event.type === "payment_intent.payment_failed"
		) {
			const paymentIntentId = typeof obj.id === "string" ? obj.id : null;
			if (!paymentIntentId) return { ok: true };
			const invoice = await ctx.runQuery(
				internal.billing.stripe.resolveInvoiceByPayment,
				{ stripePaymentIntentId: paymentIntentId },
			);
			if (invoice) {
				await ctx.runMutation(internal.billing.stripe.settleInvoice, {
					invoiceId: invoice._id as Id<"billingInvoices">,
					status:
						event.type === "payment_intent.succeeded" ? "paid" : "failed",
				});
			}
			return { ok: true };
		}

		return { ok: true };
	},
});
