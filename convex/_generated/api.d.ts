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
import type * as clients from "../clients.js";
import type * as contracts from "../contracts.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as events from "../events.js";
import type * as feedback from "../feedback.js";
import type * as feedbackWidgetSource from "../feedbackWidgetSource.js";
import type * as http from "../http.js";
import type * as invoices from "../invoices.js";
import type * as items from "../items.js";
import type * as offertes from "../offertes.js";
import type * as portfolio from "../portfolio.js";
import type * as sections from "../sections.js";
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
  clients: typeof clients;
  contracts: typeof contracts;
  crons: typeof crons;
  dashboard: typeof dashboard;
  events: typeof events;
  feedback: typeof feedback;
  feedbackWidgetSource: typeof feedbackWidgetSource;
  http: typeof http;
  invoices: typeof invoices;
  items: typeof items;
  offertes: typeof offertes;
  portfolio: typeof portfolio;
  sections: typeof sections;
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
