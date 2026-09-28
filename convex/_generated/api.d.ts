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
import type * as chat_admin from "../chat/admin.js";
import type * as chat_groupInfo from "../chat/groupInfo.js";
import type * as chat_groups from "../chat/groups.js";
import type * as chat_helpers from "../chat/helpers.js";
import type * as chat_messages from "../chat/messages.js";
import type * as chat_notifications from "../chat/notifications.js";
import type * as chat_presence from "../chat/presence.js";
import type * as chat_userPresentation from "../chat/userPresentation.js";
import type * as checkInCategories from "../checkInCategories.js";
import type * as claimedRewards from "../claimedRewards.js";
import type * as coachCheckIns from "../coachCheckIns.js";
import type * as coachDailyPolicy from "../coachDailyPolicy.js";
import type * as coachDailyPolicyV2 from "../coachDailyPolicyV2.js";
import type * as coachDailyPrompt from "../coachDailyPrompt.js";
import type * as coachDailyPromptV2 from "../coachDailyPromptV2.js";
import type * as coachDailyPromptV2_1 from "../coachDailyPromptV2_1.js";
import type * as coachDailyProvider from "../coachDailyProvider.js";
import type * as coachDailyRepair from "../coachDailyRepair.js";
import type * as coachDailyService from "../coachDailyService.js";
import type * as coachDevCleanup from "../coachDevCleanup.js";
import type * as coachFoundation from "../coachFoundation.js";
import type * as coachFoundationValidators from "../coachFoundationValidators.js";
import type * as coachLegacyInventory from "../coachLegacyInventory.js";
import type * as coachMealAnalysis from "../coachMealAnalysis.js";
import type * as coachMealPolicy from "../coachMealPolicy.js";
import type * as coachMealPrompt from "../coachMealPrompt.js";
import type * as coachMealProvider from "../coachMealProvider.js";
import type * as coachMeals from "../coachMeals.js";
import type * as coachPlanRetry from "../coachPlanRetry.js";
import type * as coachProfileEditor from "../coachProfileEditor.js";
import type * as coachResume from "../coachResume.js";
import type * as coachToday from "../coachToday.js";
import type * as coachTonePreview from "../coachTonePreview.js";
import type * as coachTonePreviewRunner from "../coachTonePreviewRunner.js";
import type * as coachTonePreviewStore from "../coachTonePreviewStore.js";
import type * as crons from "../crons.js";
import type * as dailyChallenges from "../dailyChallenges.js";
import type * as email from "../email.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as http from "../http.js";
import type * as leaderboard from "../leaderboard.js";
import type * as legacySchedulerCutover from "../legacySchedulerCutover.js";
import type * as mailerlite from "../mailerlite.js";
import type * as notifications from "../notifications.js";
import type * as posts from "../posts.js";
import type * as progressCoach from "../progressCoach.js";
import type * as progressCoachActions from "../progressCoachActions.js";
import type * as progressCoachPolicy from "../progressCoachPolicy.js";
import type * as progressPhotos from "../progressPhotos.js";
import type * as pushNotification from "../pushNotification.js";
import type * as revenueCatEntitlements from "../revenueCatEntitlements.js";
import type * as revenueCatPolicy from "../revenueCatPolicy.js";
import type * as services_enduranceZone from "../services/enduranceZone.js";
import type * as track_backfill from "../track/backfill.js";
import type * as track_helpers from "../track/helpers.js";
import type * as track_queries from "../track/queries.js";
import type * as track_recompute from "../track/recompute.js";
import type * as track_streakAdjustments from "../track/streakAdjustments.js";
import type * as track_yourMoves from "../track/yourMoves.js";
import type * as triggerMerge from "../triggerMerge.js";
import type * as upload from "../upload.js";
import type * as users from "../users.js";
import type * as utils_activeStreak from "../utils/activeStreak.js";
import type * as utils_milestones from "../utils/milestones.js";
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
  "chat/admin": typeof chat_admin;
  "chat/groupInfo": typeof chat_groupInfo;
  "chat/groups": typeof chat_groups;
  "chat/helpers": typeof chat_helpers;
  "chat/messages": typeof chat_messages;
  "chat/notifications": typeof chat_notifications;
  "chat/presence": typeof chat_presence;
  "chat/userPresentation": typeof chat_userPresentation;
  checkInCategories: typeof checkInCategories;
  claimedRewards: typeof claimedRewards;
  coachCheckIns: typeof coachCheckIns;
  coachDailyPolicy: typeof coachDailyPolicy;
  coachDailyPolicyV2: typeof coachDailyPolicyV2;
  coachDailyPrompt: typeof coachDailyPrompt;
  coachDailyPromptV2: typeof coachDailyPromptV2;
  coachDailyPromptV2_1: typeof coachDailyPromptV2_1;
  coachDailyProvider: typeof coachDailyProvider;
  coachDailyRepair: typeof coachDailyRepair;
  coachDailyService: typeof coachDailyService;
  coachDevCleanup: typeof coachDevCleanup;
  coachFoundation: typeof coachFoundation;
  coachFoundationValidators: typeof coachFoundationValidators;
  coachLegacyInventory: typeof coachLegacyInventory;
  coachMealAnalysis: typeof coachMealAnalysis;
  coachMealPolicy: typeof coachMealPolicy;
  coachMealPrompt: typeof coachMealPrompt;
  coachMealProvider: typeof coachMealProvider;
  coachMeals: typeof coachMeals;
  coachPlanRetry: typeof coachPlanRetry;
  coachProfileEditor: typeof coachProfileEditor;
  coachResume: typeof coachResume;
  coachToday: typeof coachToday;
  coachTonePreview: typeof coachTonePreview;
  coachTonePreviewRunner: typeof coachTonePreviewRunner;
  coachTonePreviewStore: typeof coachTonePreviewStore;
  crons: typeof crons;
  dailyChallenges: typeof dailyChallenges;
  email: typeof email;
  emailTemplates: typeof emailTemplates;
  http: typeof http;
  leaderboard: typeof leaderboard;
  legacySchedulerCutover: typeof legacySchedulerCutover;
  mailerlite: typeof mailerlite;
  notifications: typeof notifications;
  posts: typeof posts;
  progressCoach: typeof progressCoach;
  progressCoachActions: typeof progressCoachActions;
  progressCoachPolicy: typeof progressCoachPolicy;
  progressPhotos: typeof progressPhotos;
  pushNotification: typeof pushNotification;
  revenueCatEntitlements: typeof revenueCatEntitlements;
  revenueCatPolicy: typeof revenueCatPolicy;
  "services/enduranceZone": typeof services_enduranceZone;
  "track/backfill": typeof track_backfill;
  "track/helpers": typeof track_helpers;
  "track/queries": typeof track_queries;
  "track/recompute": typeof track_recompute;
  "track/streakAdjustments": typeof track_streakAdjustments;
  "track/yourMoves": typeof track_yourMoves;
  triggerMerge: typeof triggerMerge;
  upload: typeof upload;
  users: typeof users;
  "utils/activeStreak": typeof utils_activeStreak;
  "utils/milestones": typeof utils_milestones;
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
