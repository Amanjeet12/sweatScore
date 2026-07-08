# SweatScore Crash And Risk Audit

Audit date: 2026-07-06

Scope checked:
- Expo / React Native frontend under `app`, `components`, `hooks`, `store`, and `utils`
- Convex backend under `convex`
- Trigger.dev jobs under `trigger`
- App/build config files

Commands run:
- `bunx tsc --noEmit --pretty false` - failed with errors listed below
- `bun run lint` - timed out after 120 seconds before producing findings

Note: `convex/track/queries.ts` was already modified before this audit. I only read it.

## Build Blockers

These can stop local type-checking, CI, Convex deploys, or app builds.

| Severity | File | Problem | Why it can break |
| --- | --- | --- | --- |
| Blocker | `components/core/dashboard/TodaysSweat.tsx:142`, `convex/track/queries.ts:17` | Frontend reads `todayRow.zone2Minutes`, but backend `DayBucket` only returns `activeMinutes`. | TypeScript fails. If code expects old `zone2Minutes` shape elsewhere, data shape drift can create wrong UI values. |
| Blocker | `components/ui/checkbox/index.tsx:26` | `IconWrapper` forwards a `Svg` ref into `UIIcon` with an incompatible ref type. | TypeScript fails and this can become a runtime ref bug in checkbox icons. |
| Blocker | `convex/convex.config.ts:2-3` | Imports `@convex-dev/expo-push-notifications/convex.config` and `@convex-dev/sharded-counter/convex.config` cannot be resolved by TypeScript. | Convex codegen/deploy can fail if these package subpaths do not exist in the installed versions. |
| Blocker | `convex/ResendOTP.ts:1`, `convex/TestOTP.ts:1` | `@convex-dev/auth/providers/Email` cannot be resolved. | Auth provider code may fail type-check/deploy. Login OTP is a critical path. |
| Blocker | `trigger/merge-videos.ts:35`, `trigger/merge-videos.ts:218` | `logger.log` is called with a string as the second argument where Trigger expects an object. | Trigger task fails TypeScript. Merge/deep video jobs may not deploy. |

## Frontend Runtime Crash Risks

| Severity | File | Problem | Crash / failure mode |
| --- | --- | --- | --- |
| High | `app/_layout.tsx:32` | `process.env.EXPO_PUBLIC_CONVEX_URL!` is assumed to exist. | If the env var is missing or empty, `ConvexReactClient` can initialize with an invalid URL and the app can fail at startup. |
| High | `hooks/usePushNotifications.ts:83` | `JSON.parse(notificationDataString)` is unguarded. | A malformed notification payload can crash app launch from a notification. |
| High | `hooks/usePushNotifications.ts:49`, `app/(tabs)/dashboard/index.tsx:106` | Uses `Constants.expoConfig?.extra?.eas.projectId` without optional chaining on `eas` in two places. | If `extra` exists but `eas` is missing, push token refresh can throw. `app/(auth)/ask-push-permission.tsx:43` uses the safer `eas?.projectId` version. |
| High | `hooks/useHealthData.ts:14-16`, `app/(auth)/ask-health-permission.tsx:29-31`, `app/(tabs)/dashboard/index.tsx:41-43` | `require('react-native-health-connect')` is unguarded. | On Android builds where the native module is missing/mislinked, opening health screens or syncing can crash immediately. |
| High | `app/posts/new.tsx:98,202`, `app/posts/edit.tsx:96,188`, `app/activity/new.tsx:150`, `app/activity/edit.tsx:143`, `app/creator/new.tsx:132`, `app/creator/edit.tsx:138`, `components/core/admin/ChallengeForm.tsx:194,272`, `app/(tabs)/dashboard/settings/admin/rewards-banner.tsx:132,136` | Upload responses are parsed with `JSON.parse(...body...)` without checking status/body shape in most screens. | Failed uploads, HTML error pages, empty bodies, or malformed JSON can crash the screen and leave loading state stuck. |
| High | `utils/error-message.ts:45-47` | `getZodErrorMessage` parses `error.message` with `JSON.parse` and throws `Zod is broken` if parsing fails. | Any Zod format change or unexpected error shape can crash validation instead of showing a normal error. Used by auth/profile/activity forms. |
| High | `components/providers/RevenueCatProvider.tsx:103-105`, `components/core/Paywall.tsx:131,585`, `store/useAuthStore.ts:21` | RevenueCat can be skipped when keys are missing, but other code still calls `Purchases.logIn` / `getCustomerInfo`. Paywall shows "Loading plans..." forever when packages stay empty. | Users can get stuck at auth/subscription if RevenueCat is not configured, store offerings fail, or purchases are unavailable. |
| Medium | `app/_layout.tsx:143` | Font loading gate uses `&&` for both font groups. | If one font group loads and the other is still pending, the app renders early with missing fonts. Usually visual, but can cause inconsistent text layout. |
| Medium | `hooks/useHealthSync.ts:43,50` | Health data fetch and missed-days query happen before the main `try/catch`. | Health module errors before line 55 can escape and reject refresh/tab/AppState handlers. |
| Medium | `app/(tabs)/_layout.tsx:99`, `app/(tabs)/dashboard/index.tsx:150` | Background sync uses `.then(...)` without `.catch(...)`. | A rejected sync can become an unhandled promise rejection. |
| Medium | `app/(auth)/verify.tsx:35-43` | `handleResend` has no `try/catch`. | Failed resend can throw directly from the button handler. |
| Medium | `app/(auth)/verify.tsx:30,43,60` | `email` from search params can be `undefined` or an array. | Opening `/verify` directly can call `signIn` with invalid email input. |
| Medium | `components/core/SafeAreaView.tsx:12-17` | Comment says Android uses `react-native-safe-area-context`, but code returns React Native `SafeAreaView` for every platform. | Android safe areas/navigation bar handling can be wrong and content can overlap system UI. |
| Low | `app/_layout.tsx:36` | `LogBox.ignoreAllLogs()` hides all runtime warnings. | Real warnings from navigation, native modules, React Query, or uploads are invisible during development. |

## Backend / Convex Risks

| Severity | File | Problem | Crash / data / security impact |
| --- | --- | --- | --- |
| Critical | `convex/upload.ts:3-6` | `generateUploadUrl` has no auth check. | Any caller with the Convex URL can request upload URLs and abuse storage. |
| Critical | `convex/activities.ts:301-336` | `syncHealthData` trusts `args.userId` from the client instead of forcing the authenticated `userId`. | A user who knows another user id could write health/activity data and patch `lastSyncDate` for that user. |
| Critical | `convex/activities.ts:830-873` | `getMissedDaysForSync` accepts arbitrary `userId` and has no auth ownership check. | Lets a client query sync metadata for another user and feeds the unsafe `syncHealthData` path. |
| High | `convex/users.ts:82-94` | `getUser` returns `...user` for any supplied user id, with no auth/privacy filtering. | Exposes private fields like email, birthdate, push token, admin flag, subscription state, timezone, app version, etc. |
| High | `convex/posts.ts:433-457`, `convex/posts.ts:585-665`, `convex/posts.ts:726-913` | Community premium gating is mostly frontend-only. Backend allows authenticated users to create posts, like, comment, and fetch feed without checking premium. | Free or scripted clients can bypass paywalls and mutate community data. |
| High | `convex/posts.ts:1058-1089` | `getPost` has no auth or author check. | Any client with a post id can fetch edit-level post body/media data. |
| High | `convex/leaderboard.ts:178,200` | Internal mutation declares `returns: v.null()` but returns `undefined` when notification history exists. | Convex return validation can fail during scheduled leaderboard updates. |
| High | `convex/leaderboard.ts:184,206`, `convex/notifications.ts:117,278,352` | `ctx.db.insert('notificationHistory', ...)` is not awaited in several mutations. | Writes may not complete reliably before the mutation ends; duplicate notifications or missing history can happen. |
| High | `convex/notifications.ts:108,269,343` | Push notification sends are not awaited in cron mutations. | Push sends can fail silently and notification history may still be written. |
| High | `convex/users.ts:348-349`, `convex/notifications.ts:58-59` | Non-null assertions `user.email!` and `user.name!` are used for scheduled MailerLite work. | If a partially onboarded or corrupted user record lacks email/name, scheduled jobs can fail validation. |
| Medium | `convex/users.ts:184` | `userNotificationEnabled` defaults to `user.expoPushToken !== null`. `undefined !== null` is true. | Users with no push token can be treated as notification-enabled. |
| Medium | `convex/challengeCompletions.ts:10`, `app/challenge-record/[challengeId].tsx:37` | Hard-coded storage id / production storage URL for first-attempt video. | Environment mismatch can break challenge video merge/playback outside the intended deployment. |
| Medium | `convex/triggerMerge.ts:18-24` | Missing Trigger/Convex env vars only log and return. | User completion succeeds, but video merge/post creation silently never happens. |
| Medium | `convex/http.ts:279,307,350,411` | Trigger HTTP endpoints call `request.json()` without parse guards. | Bad/malformed requests return 500 instead of a clean 400 and can hide integration issues. |
| Medium | `convex/admin.ts:227-244` | `deleteCreator` deletes only the creator row, not its `creatorVideos` or poster image. | Orphaned records/storage remain and future creator-video queries can reference deleted parents. |
| Medium | `convex/admin.ts:735-758` | `deleteChallenge` deletes only challenge media and challenge row. | Related completions/posts can reference deleted challenges and later feed/challenge queries may degrade or skip data. |
| Medium | `convex/posts.ts:423-425` | `blockUser` stores `userId: args.userId` and `blockedUserId: userId`, which is reversed from the schema meaning. | It happens to hide posts via the reverse check, but data semantics are wrong and future features can break. |
| Low | `convex/challengeCompletions.ts:68` | `parseInt` for `dailyPointsCap` is not validated for `NaN`. | Bad app config can produce `NaN` cap/points behavior. |

## Navigation / Architecture Problems

| Severity | File | Problem | Impact |
| --- | --- | --- | --- |
| High | `app/index.tsx:61-68`, `app/(auth)/verify.tsx:71-78`, `app/(auth)/ask-health-permission.tsx:174-211`, `app/(tabs)/_layout.tsx:16` | Subscription enforcement is handled by redirect points, not a protected tab layout or backend policy. | Deep links or direct navigation to tab routes can bypass the subscription screen. Backend community/paywall checks are also incomplete. |
| High | `app/(tabs)/_layout.tsx:50` | `lazy: false` mounts every tab immediately. | Dashboard, rank, share, track, and hub screens can all run queries/effects at startup, increasing crash surface and startup load. |
| Medium | `app/(tabs)/_layout.tsx:25` | `currentUser?._id as Id<'users'>` casts `undefined` to a user id type. | The type system is silenced and future code can accidentally call backend with an invalid id. |
| Medium | `app/(auth)/verify.tsx:66-78` | After OTP login, flow checks only `!user?.onboarded` before subscription/dashboard. | A user with inconsistent data (`onboarded: true` but missing name/activity goal/push setup) can skip required onboarding screens. `app/index.tsx` has more complete checks. |
| Medium | `components/core/Paywall.tsx:241` | `redirectTo` route param is cast directly into `router.replace(... as any)`. | Bad or unexpected redirect params can send users to invalid routes. |
| Medium | Many files with `as any` route casts | Typed routes are bypassed for dynamic tab/paywall/user paths. | Invalid route strings will not be caught by TypeScript. |

## Config / Build / Platform Issues

| Severity | File | Problem | Impact |
| --- | --- | --- | --- |
| High | `app.config.ts:7`, `app.json:137` | Dynamic config overwrites `android.googleServicesFile` with `process.env.GOOGLE_SERVICES_JSON`. If env is unset, it erases the static app.json value. | Android push/Firebase setup can fail in builds. |
| Medium | `app.json:94-106`, `app.json:128-134` | Duplicate iOS schemes and duplicate Android blocked permissions. | Not usually a crash, but config noise makes permission/debug behavior harder to reason about. |
| Medium | `app.json:125-126`, `app.json:128-134` | Requests legacy Android storage permissions while blocking modern Android media permissions. | Image/video picker or media-library behavior can differ across Android API levels. |
| Medium | `.env.example` | Example contains real-looking RevenueCat public keys and has many encoded special characters in comments. | Public keys are meant to be public, but real values in examples increase accidental environment confusion. |

## Unwanted / Noisy / Fragile Code

| Severity | File | Problem |
| --- | --- | --- |
| Medium | `app/challenge-record/[challengeId].tsx:102-680` | Large amount of `[RecordingDebug]` logging in production-facing recording flow. |
| Medium | `components/core/Paywall.tsx:113,223` | RevenueCat packages and purchase errors are logged in development. Fine for dev, but noisy if dev builds are shared. |
| Medium | `convex/challengeCompletions.ts:245-265`, `convex/triggerMerge.ts:51`, `convex/http.ts:41`, `convex/mailerlite.ts:31` | Backend contains debug logs that can leak operational details or make logs noisy. |
| Medium | `app/_layout.tsx:54-58`, `components/ui/icon/index.web.tsx:36-86`, `components/ui/checkbox/index.tsx:32`, `components/ui/avatar/index.tsx:144` | Multiple `@ts-ignore` / `@ts-expect-error` suppressions hide type problems. One of them still fails TypeScript. |
| Low | `app/(tabs)/dashboard/index.tsx:236` | Typo-like class `pv-5` likely has no Tailwind effect. |
| Low | `components/core/SafeAreaView.tsx:12-17` | Comment and implementation disagree. |

## Recommended Fix Order

1. Fix TypeScript blockers first: Convex package import paths, OTP provider imports, `TodaysSweat` data shape, checkbox ref typing, and Trigger logger arguments.
2. Add backend auth/ownership checks to `generateUploadUrl`, `syncHealthData`, `getMissedDaysForSync`, `getUser`, post/feed mutations, and post queries.
3. Add a real protected tabs/subscription gate so deep links cannot bypass paywall/onboarding.
4. Guard native module access for Health Connect and push notification project id reads.
5. Replace unguarded upload `JSON.parse` patterns with status/body validation and `try/finally` loading cleanup.
6. Clean up scheduled Convex mutations: await DB writes/push sends and return `null` wherever `returns: v.null()` is declared.
7. Remove or gate debug logs, global `LogBox.ignoreAllLogs`, and unnecessary `as any`/`@ts-ignore` suppressions.

