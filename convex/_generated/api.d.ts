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

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
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
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  pushNotifications: {
    public: {
      deleteNotificationsForUser: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        any
      >;
      getNotification: FunctionReference<
        "query",
        "internal",
        { id: string; logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" },
        null | {
          _creationTime: number;
          body?: string;
          categoryIdentifier?: string;
          data?: any;
          numPreviousFailures: number;
          sound?: string;
          state:
            | "awaiting_delivery"
            | "in_progress"
            | "delivered"
            | "needs_retry"
            | "failed"
            | "maybe_delivered"
            | "unable_to_deliver";
          subtitle?: string;
          title: string;
        }
      >;
      getNotificationsForUser: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          userId: string;
        },
        Array<{
          _creationTime: number;
          body?: string;
          categoryIdentifier?: string;
          data?: any;
          id: string;
          numPreviousFailures: number;
          sound?: string;
          state:
            | "awaiting_delivery"
            | "in_progress"
            | "delivered"
            | "needs_retry"
            | "failed"
            | "maybe_delivered"
            | "unable_to_deliver";
          subtitle?: string;
          title: string;
        }>
      >;
      getStatusForUser: FunctionReference<
        "query",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        { hasToken: boolean; paused: boolean }
      >;
      pauseNotificationsForUser: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
      recordPushNotificationToken: FunctionReference<
        "mutation",
        "internal",
        {
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          pushToken: string;
          userId: string;
        },
        null
      >;
      removePushNotificationToken: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
      restart: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" },
        boolean
      >;
      sendPushNotification: FunctionReference<
        "mutation",
        "internal",
        {
          allowUnregisteredTokens?: boolean;
          logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
          notification: {
            body?: string;
            categoryIdentifier?: string;
            data?: any;
            sound?: string;
            subtitle?: string;
            title: string;
          };
          userId: string;
        },
        string | null
      >;
      shutdown: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" },
        { data?: any; message: string }
      >;
      unpauseNotificationsForUser: FunctionReference<
        "mutation",
        "internal",
        { logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR"; userId: string },
        null
      >;
    };
  };
  shardedCounter: {
    public: {
      add: FunctionReference<
        "mutation",
        "internal",
        { count: number; name: string; shard?: number; shards?: number },
        number
      >;
      count: FunctionReference<"query", "internal", { name: string }, number>;
      estimateCount: FunctionReference<
        "query",
        "internal",
        { name: string; readFromShards?: number; shards?: number },
        any
      >;
      rebalance: FunctionReference<
        "mutation",
        "internal",
        { name: string; shards?: number },
        any
      >;
      reset: FunctionReference<"mutation", "internal", { name: string }, any>;
    };
  };
};
