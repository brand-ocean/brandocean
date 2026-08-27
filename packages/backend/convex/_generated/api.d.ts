/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as billing_api from "../billing/api.js";
import type * as billing_cloudflare from "../billing/cloudflare.js";
import type * as billing_config from "../billing/config.js";
import type * as billing_convexUsage from "../billing/convexUsage.js";
import type * as billing_model from "../billing/model.js";
import type * as billing_run from "../billing/run.js";
import type * as billing_seed from "../billing/seed.js";
import type * as billing_stripe from "../billing/stripe.js";
import type * as boekhouding_accounts from "../boekhouding/accounts.js";
import type * as boekhouding_invoiceBooking from "../boekhouding/invoiceBooking.js";
import type * as boekhouding_journal from "../boekhouding/journal.js";
import type * as boekhouding_opening from "../boekhouding/opening.js";
import type * as boekhouding_periods from "../boekhouding/periods.js";
import type * as boekhouding_reports from "../boekhouding/reports.js";
import type * as boekhouding_validators from "../boekhouding/validators.js";
import type * as clients from "../clients.js";
import type * as contracts from "../contracts.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as events from "../events.js";
import type * as feedback from "../feedback.js";
import type * as habits from "../habits.js";
import type * as http from "../http.js";
import type * as invoices from "../invoices.js";
import type * as items from "../items.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_invoiceMath from "../lib/invoiceMath.js";
import type * as lib_portfolioBlocks from "../lib/portfolioBlocks.js";
import type * as ndaTemplates from "../ndaTemplates.js";
import type * as ndas from "../ndas.js";
import type * as offertes from "../offertes.js";
import type * as portfolio from "../portfolio.js";
import type * as sections from "../sections.js";
import type * as signedNdas from "../signedNdas.js";
import type * as snapshots from "../snapshots.js";
import type * as specs from "../specs.js";
import type * as specsSeed from "../specsSeed.js";
import type * as tasks from "../tasks.js";
import type * as userSettings from "../userSettings.js";
import type * as users from "../users.js";
import type * as voice_call from "../voice/call.js";
import type * as voice_number from "../voice/number.js";
import type * as voice_prompt from "../voice/prompt.js";
import type * as voice_tasks from "../voice/tasks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  admin: typeof admin;
  auth: typeof auth;
  "billing/api": typeof billing_api;
  "billing/cloudflare": typeof billing_cloudflare;
  "billing/config": typeof billing_config;
  "billing/convexUsage": typeof billing_convexUsage;
  "billing/model": typeof billing_model;
  "billing/run": typeof billing_run;
  "billing/seed": typeof billing_seed;
  "billing/stripe": typeof billing_stripe;
  "boekhouding/accounts": typeof boekhouding_accounts;
  "boekhouding/invoiceBooking": typeof boekhouding_invoiceBooking;
  "boekhouding/journal": typeof boekhouding_journal;
  "boekhouding/opening": typeof boekhouding_opening;
  "boekhouding/periods": typeof boekhouding_periods;
  "boekhouding/reports": typeof boekhouding_reports;
  "boekhouding/validators": typeof boekhouding_validators;
  clients: typeof clients;
  contracts: typeof contracts;
  crons: typeof crons;
  dashboard: typeof dashboard;
  events: typeof events;
  feedback: typeof feedback;
  habits: typeof habits;
  http: typeof http;
  invoices: typeof invoices;
  items: typeof items;
  "lib/auth": typeof lib_auth;
  "lib/invoiceMath": typeof lib_invoiceMath;
  "lib/portfolioBlocks": typeof lib_portfolioBlocks;
  ndaTemplates: typeof ndaTemplates;
  ndas: typeof ndas;
  offertes: typeof offertes;
  portfolio: typeof portfolio;
  sections: typeof sections;
  signedNdas: typeof signedNdas;
  snapshots: typeof snapshots;
  specs: typeof specs;
  specsSeed: typeof specsSeed;
  tasks: typeof tasks;
  userSettings: typeof userSettings;
  users: typeof users;
  "voice/call": typeof voice_call;
  "voice/number": typeof voice_number;
  "voice/prompt": typeof voice_prompt;
  "voice/tasks": typeof voice_tasks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
