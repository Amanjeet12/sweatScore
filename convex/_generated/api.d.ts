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
import type * as TestOTP from "../TestOTP.js";
import type * as activities from "../activities.js";
import type * as admin from "../admin.js";
import type * as appVersionConfig from "../appVersionConfig.js";
import type * as appVersions from "../appVersions.js";
import type * as auth from "../auth.js";
import type * as challengeCompletions from "../challengeCompletions.js";
import type * as challenges from "../challenges.js";
import type * as claimedRewards from "../claimedRewards.js";
import type * as crons from "../crons.js";
import type * as dailyChallenges from "../dailyChallenges.js";
import type * as email from "../email.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as http from "../http.js";
import type * as leaderboard from "../leaderboard.js";
import type * as mailerlite from "../mailerlite.js";
import type * as notifications from "../notifications.js";
import type * as posts from "../posts.js";
import type * as pushNotification from "../pushNotification.js";
import type * as services_enduranceZone from "../services/enduranceZone.js";
import type * as track_backfill from "../track/backfill.js";
import type * as track_helpers from "../track/helpers.js";
import type * as track_queries from "../track/queries.js";
import type * as track_recompute from "../track/recompute.js";
import type * as track_yourMoves from "../track/yourMoves.js";
import type * as triggerMerge from "../triggerMerge.js";
import type * as upload from "../upload.js";
import type * as users from "../users.js";
import type * as utils_streak from "../utils/streak.js";
import type * as utils_timezone from "../utils/timezone.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  TestOTP: typeof TestOTP;
  activities: typeof activities;
  admin: typeof admin;
  appVersionConfig: typeof appVersionConfig;
  appVersions: typeof appVersions;
  auth: typeof auth;
  challengeCompletions: typeof challengeCompletions;
  challenges: typeof challenges;
  claimedRewards: typeof claimedRewards;
  crons: typeof crons;
  dailyChallenges: typeof dailyChallenges;
  email: typeof email;
  emailTemplates: typeof emailTemplates;
  http: typeof http;
  leaderboard: typeof leaderboard;
  mailerlite: typeof mailerlite;
  notifications: typeof notifications;
  posts: typeof posts;
  pushNotification: typeof pushNotification;
  "services/enduranceZone": typeof services_enduranceZone;
  "track/backfill": typeof track_backfill;
  "track/helpers": typeof track_helpers;
  "track/queries": typeof track_queries;
  "track/recompute": typeof track_recompute;
  "track/yourMoves": typeof track_yourMoves;
  triggerMerge: typeof triggerMerge;
  upload: typeof upload;
  users: typeof users;
  "utils/streak": typeof utils_streak;
  "utils/timezone": typeof utils_timezone;
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

export declare const components: {
  pushNotifications: import("@convex-dev/expo-push-notifications/_generated/component.js").ComponentApi<"pushNotifications">;
  shardedCounter: import("@convex-dev/sharded-counter/_generated/component.js").ComponentApi<"shardedCounter">;
};
