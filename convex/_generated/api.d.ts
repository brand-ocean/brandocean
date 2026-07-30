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
import type * as clients from "../clients.js";
import type * as contracts from "../contracts.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as events from "../events.js";
import type * as feedback from "../feedback.js";
import type * as http from "../http.js";
import type * as invoices from "../invoices.js";
import type * as items from "../items.js";
import type * as ndaTemplates from "../ndaTemplates.js";
import type * as ndas from "../ndas.js";
import type * as offertes from "../offertes.js";
import type * as portfolio from "../portfolio.js";
import type * as sections from "../sections.js";
import type * as signedNdas from "../signedNdas.js";
import type * as snapshots from "../snapshots.js";
import type * as tasks from "../tasks.js";
import type * as userSettings from "../userSettings.js";
import type * as users from "../users.js";

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
  clients: typeof clients;
  contracts: typeof contracts;
  crons: typeof crons;
  dashboard: typeof dashboard;
  events: typeof events;
  feedback: typeof feedback;
  http: typeof http;
  invoices: typeof invoices;
  items: typeof items;
  ndaTemplates: typeof ndaTemplates;
  ndas: typeof ndas;
  offertes: typeof offertes;
  portfolio: typeof portfolio;
  sections: typeof sections;
  signedNdas: typeof signedNdas;
  snapshots: typeof snapshots;
  tasks: typeof tasks;
  userSettings: typeof userSettings;
  users: typeof users;
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
