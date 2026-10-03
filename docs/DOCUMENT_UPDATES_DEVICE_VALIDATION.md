# SweatScore document updates and physical device validation

Implemented from SweatScore_App_Updates_for_Developers (1).docx on 2 October 2026. The changes are in the local workspace. The backend and app have not been deployed or installed on a physical device by this task. Existing workspace changes were preserved.

24 of the document's 25 numbered updates are implemented. Item 4.1 needs the separately supplied custom icon file. Push scheduling is implemented and tested; actual device delivery remains to be validated.

## Completed updates

| Document item | Implemented update |
| --- | --- |
| 1.1 | Welcome heading is “Movement That's Made For You.” |
| 1.2 | Name placeholder is “What should we call you?” |
| 1.3 | Removed the “Preparing your experience” interstitial. Onboarding keeps its last rendered question while route checks resolve; setup keeps its visible loading screen during completion. Resume checks render transparently. |
| 1.4 | Removed the visible “1 OF 7” through “7 OF 7” counters; progress and accessibility labels remain. |
| 1.5 | Setup uses the reference hero image, a rounded white panel, personalised “Building your custom routine” heading, the requested analysis subtitle, and an animated progress bar. Removed the old card and saved/access-verification copy. |
| 2.1 | Added the bell notification modal on Home after the first completed check-in, activity post, or challenge, with the requested wording and enable/skip actions. Saves the choice and registers the device token. Queues one backend push at verified trial expiry minus 48 hours and suppresses stale, skipped, expired, and duplicate reminders. |
| 3.1 | Lightened the left banner overlay and made its fade more gradual. |
| 3.2 | Empty community check-in text is “Be the first to check in.” |
| 3.3 | Dynamic point abbreviations use PT/pt for exactly 1 and PTS/pts for other values. |
| 3.4 | Removed the Week 1 label from the left empty progress-photo tile; camera and Add a photo remain. |
| 3.5 | Activity icons match the check-in icon size. |
| 3.6 | Weekly celebration body is one continuous sentence sequence without a forced line break. |
| 4.2 | Pending daily-plan sheet shows only its heading, explanatory text, and progress area. Removed the placeholder cards and loading sparkle. Ready plans show populated cards. |
| 4.3 | Added the accuracy note and helpfulness buttons on both plan surfaces. Ratings persist per plan revision, are private to the member, and are passed to later AI plan generation. |
| 4.4 | Profile-editor answer labels use regular Inter at 16px. |
| 5.1 | All coach post-capture activity logs use the same page layout; removed the non-meal bordered/tinted wrapper. Caption input retains its border. |
| 5.2 | Removed the orange food icon and enclosing border from the meal-analysis loading area. |
| 5.3 | Both meal-share buttons have a 20px corner radius and 56px minimum height. |
| 6.1 | Workout-list thumbnails crop edge to edge with rounded corners. Uses the 16:9 YouTube thumbnail variant to avoid embedded letterboxing. |
| 6.2 | Removed the Workout library introduction box. Heading, collection count, and collection cards remain. |
| 6.3 | Removed the category tag beneath the workout video's Difficulty/Equipment cards. |
| 7.1 | League footer now refers to this month's challenge, with singular/plural sister wording. |
| 7.2 | Completed leaderboard rows show the medal and full progress bar without the percentage text. Incomplete rows keep percentages. |
| 7.3 | Completed challenge cards show only the tick on the right; member avatars and joined count remain on the left. Accessible completion text remains. |

## Pending asset

- [ ] 4.1 Replace the question-sheet sparkle with the custom icon after its file is supplied. The existing icon remains on the question and ready-plan sheet.

## Automated validation

- Latest notification-focused checks: 48 passed. Full suite: 159 passed and one unrelated source-text assertion failed because the activity photo-retake accessibility label differs from its expectation.
- New coverage checks trial-versus-paid detection, notification routing, expiry-minus-two-days timing, duplicate scheduling, skip/no-token behavior, stale reminder suppression, feedback ownership, persistence, and inclusion in later generation context.
- iOS Expo export succeeded. This verifies bundling, not native installation, visual appearance, or notification delivery.
- ESLint on edited files: 0 errors; existing warnings remain.
- TypeScript check remains blocked by 8 errors in untouched checkbox, Convex package imports/configuration, and chat mock files. No errors were reported in the files changed for these document updates.

## Physical device preparation

- [ ] Deploy the updated Convex schema and functions to the backend used by the test build before testing the updated app.
- [ ] Install/run the updated native development or release build. Use a physical device with working RevenueCat and Expo push configuration; do not use Expo Go for the purchase/push checks.
- [ ] Have a fresh onboarding account and separate eligible trial accounts for Enable, Skip, and permission-denied tests. Use a paid account to confirm the trial screen does not appear for normal paid access.
- [ ] Record device model, iOS/Android version, app build, account, and test date. Mark each check Pass or Fail and attach a screenshot for failures.

## Physical device checklist

### Onboarding

- [ ] Launch signed out. Confirm the exact welcome heading and name placeholder.
- [ ] Complete all seven profile questions. Confirm the top progress bar works and no numbered step counter appears above the headings.
- [ ] On a slow connection, complete the final question. Confirm the previous question remains visible during checks and “Preparing your experience” never appears.
- [ ] Continue from health permissions. Confirm the new hero/loading layout, your first name, exact subtitle, and progress bar; confirm the old saved/access text is absent.
- [ ] Repeat with health permission denied. Confirm onboarding can still continue.

### Trial notifications and reminder

- [ ] Start a verified free trial. Confirm it opens Today directly with no notification prompt.
- [ ] Complete a check-in, activity post, or challenge and return to Home. After the celebration finishes, confirm a centred modal appears over Home with Enable and Skip actions.
- [ ] Log in without completing any activity. Confirm no notification prompt appears.
- [ ] Enable notifications and grant the OS permission. Confirm entry to Today. Restart the app and confirm the notification-choice screen does not repeat.
- [ ] On a separate trial account, select Skip for now. Confirm entry to Today and no trial reminder is queued for that account.
- [ ] On another trial account, deny OS permission. Confirm the explanatory error and that Skip for now still works.
- [ ] With a normal paid account, complete an activity and confirm the same optional notification modal appears on Home if no choice has been recorded.
- [ ] For a real seven-day trial with notifications enabled, verify the reminder arrives 48 hours before the actual expiry (normally day 5). Put the app in the background/close it and confirm the OS displays the notification once.
- [ ] Confirm no duplicate reminder after reopening or restoring the same trial. Confirm a stale reminder does not send after the entitlement has renewed or expired.

A sandbox trial may expire much faster than seven days. If fewer than 48 hours remain when consent is saved, the reminder is queued immediately; this checks delivery, but does not establish the real seven-day timing. Physical-device delivery cannot be confirmed from the automated tests alone. OS permission and a working push token are required.

### Today

- [ ] Confirm the model remains clearly visible behind the lighter banner overlay and the banner text remains readable.
- [ ] With no community check-ins, confirm “Be the first to check in.”
- [ ] Check point displays with 0, 1, and 2 or more: expect 0 PTS, 1 PT, 2 PTS in the header and equivalent lowercase wording elsewhere.
- [ ] With no first progress photo, confirm the left tile shows camera/Add a photo without Week 1. Confirm Log Week 1 remains below it.
- [ ] Compare steps and active-minutes icons to the four check-in icons.
- [ ] Reach the weekly goal. Confirm the celebration body wraps naturally without an explicit break between the two sentences. Natural wrapping on small screens is expected.

### Daily plan and profile

- [ ] Generate today's plan on a slow connection. Confirm there are no Workout/Steps/Meals/Sleep placeholder cards or “Loading...” labels while pending.
- [ ] When generation finishes, confirm the four populated cards appear and each opens the appropriate check-in.
- [ ] Below the recommendation explanation, confirm the accuracy note and Was this helpful? thumbs appear before the profile-update link.
- [ ] Tap thumbs up, close/reopen the plan, and confirm it remains selected. Change to thumbs down and confirm it persists after restarting.
- [ ] Generate a later plan. A developer should inspect the AI request to confirm the saved rating and rated plan are included in member_feedback; a device-only test cannot inspect provider input.
- [ ] Open Update your profile. Confirm all answer labels are regular weight and 16px, selection still works, and saving succeeds.
- [ ] Custom question-sheet icon: pending the supplied asset.

### Activity and meal logs

- [ ] Capture and open the post screen for workout, meals, sleep, and steps. Confirm titles/rewards sit directly on the page, caption input has its border, and spacing is consistent.
- [ ] Confirm photos, retake/remove control, caption editing, and posting still work.
- [ ] During meal analysis, confirm Looking at your plate, the explanation, and progress bar remain, with no orange food icon or enclosing border.
- [ ] Compare Share meal and Share without AI analysis: same corner radius and height. Confirm each action successfully shares its intended post.

### Workouts

- [ ] Open Workouts. Confirm the heading/count remain and collections begin directly below them; the old introduction box is absent.
- [ ] Open each collection. Confirm thumbnails fill their tiles with rounded corners and no black letterboxing. Test several different videos.
- [ ] Open a video. Confirm Difficulty and Equipment remain and no category tag sits beneath them. Confirm the YouTube action still opens the correct video.

### League and challenges

- [ ] Open the League screen. Confirm footer wording ends with “in this month's challenge.”
- [ ] Compare a completed and an incomplete leaderboard row. Completed: medal, full bar, score, no 100% label. Incomplete: percentage and score remain.
- [ ] Complete a challenge today. Confirm its card shows a tick on the right with no Done today text, and avatars/member count remain readable on the left.
- [ ] Repeat with the device's larger text setting and check for overlap, clipped buttons, unreadable banner text, and cramped card rows.

Notification timing revised on 3 October 2026: notification permission is optional after the first successfully completed activity on Home, rather than immediately after the paywall. Consent still schedules the trial reminder when an active trial exists.

Notification appearance revised: a centred, rounded modal now overlays Home, using the celebration backdrop/card colours, Inter typography, and shared 56px CoachActionButton controls with 20px corners. Home remains mounted; neither Enable nor Skip navigates to a new page. Android Back acts as Skip and saves that choice.
