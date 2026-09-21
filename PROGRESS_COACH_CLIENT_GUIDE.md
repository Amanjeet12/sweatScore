# SweatScore Progress Coach: client guide

Progress Coach gives an eligible member one saved wellness focus for each local day. It is a structured experience, not a chatbot. It combines a short profile, daily readiness answers, and recent verified SweatScore tracking with application-controlled recommendations.

## The member journey

1. Open **Today** and tap the floating **Progress Coach** pill at the bottom right. The pill is shown only on the focused Today page and is hidden during the existing feature tour.
2. On the first visit, choose **Set up my profile** and complete the nine-step profile.
3. Start the five-question daily check-in.
4. Submit once. The Coach prepares and saves the day's focus.
5. Reopen the saved focus whenever needed that day. Opening it again does not request a new recommendation.

Access depends on the existing rollout controls: the member must be an administrator or premium member, and either the individual Coach pilot flag or the global Coach rollout setting must permit access. Signing in or being an administrator alone does not bypass those controls.

## Profile setup and retakes

The profile asks about the member's goal, body confidence, workout routine, relationship with food, usual sleep, biggest struggle, upcoming events, and when they last saw progress. The ninth step is optional current weight and its unit.

- Back returns to the previous question and keeps the current answers.
- Retaking the profile preselects saved answers.
- Weight may be left blank. Clearing a previously saved weight removes it when the profile is saved.
- Weight is stored with the profile but does not change today's targets.
- Profile changes apply to future plans. They do not rewrite a focus already saved for today.

The screen's Back control moves through questions. iOS swipe dismissal is disabled for these multi-step flows; Android hardware Back follows the question-level Back behavior.

## The daily readiness check

There are five questions: sleep, energy, mood, available time, and body condition. The last includes pain or feeling unwell. There is no extra safety questionnaire, free-text prompt, voice input, or chat.

Required answers must be selected before continuing. The final submission creates or reuses a plan for the authenticated member's current Coach-local date, using their saved timezone with a UTC fallback. The Coach reads recent tracking history; it does not treat a recommendation as a completed activity.

## What application rules decide

SweatScore's server rules determine the movement category, duration, step target, hydration target, nutrition target, and safety direction. Claude cannot choose routes, challenge IDs, or numerical targets.

The movement categories are strength, cardio, core, gentle movement, or rest. Available time, readiness, and body condition guide the selection. Poor sleep or low energy can reduce the recommended duration. Reported pain or illness produces a recovery direction with no exercise duration or step target.

Step targets use recent usable tracking days when available. The current rules use a 5,000-step default when there is insufficient baseline data and a 2,000-step starting target for a valid zero baseline on a normal day. Other baselines are rounded and constrained by the existing policy. These are wellness targets, not a claim that the member has already completed anything.

## What Claude does

For an appropriate normal plan, the backend may ask Claude for four short pieces of wording: a headline, movement label, nutrition message, and explanation. The request uses selected profile answers, daily readiness, deterministic targets, and a compact verified tracking summary.

The generation payload does not send the member's email, name, weight, weight unit, upcoming event, or uploaded proof media. Claude provides wording only; the server validates the response and combines it with the existing deterministic targets. The mobile interface never calls Claude directly.

There is no member-facing refresh or regeneration button. Reopening an existing plan, returning from a challenge, or changing tabs does not start generation. The backend has bounded recovery for orphaned pending work; this is not an unlimited retry loop.

## The saved focus screen

The screen shows:

- A focus headline and stored movement guidance.
- The deterministic movement category and duration, when applicable.
- Nutrition and hydration guidance.
- A stored step target, or **No step target today.** for a missing, zero, negative, or invalid target.
- **Why this was selected**, using the saved explanation.
- Confirmation that the focus is saved for the day.

The interface does not invent live steps, minutes remaining, streaks, challenge progress, or completion percentages. Historical saved plans are not rewritten just because a newer policy improves future plans.

## Recovery and service interruptions

If the member reports pain or feeling unwell, the server supplies approved recovery wording without calling Claude for that plan. The screen emphasizes basic care and the absence of an exercise or step target. Coach cannot assess symptoms or provide medical advice; the stored safety notice directs members toward appropriate professional guidance.

If personalized wording is unavailable, a deterministic fallback can still provide the complete safe plan. A quiet notice explains the wording limitation. If there is no usable plan, a controlled unavailable state offers safe navigation instead of another generation button.

## Connecting guidance to Challenges

Application code maps the saved movement category to existing challenge tags:

| Movement category | Existing challenge tag |
| ----------------- | ---------------------- |
| Strength          | Full Body              |
| Cardio            | Cardio                 |
| Core              | Core                   |
| Gentle movement   | Flexibility            |
| Rest              | No challenge action    |

The existing selector requires a valid published matching challenge, excludes daily/community check-ins and expired challenges, and selects deterministically. When no suitable match exists, the entire action section is omitted.

Opening a suggested challenge only opens its existing detail screen. It does not join it, start it, log activity, complete it, or award points. Those actions remain explicit in the established challenge workflow. Back returns to the same stored Coach plan.

## What Coach does not change

Coach does not automatically modify activities, ordinary app check-ins, challenge participation, points, streaks, tracking, posts, uploaded media, or subscriptions. Completing Coach questions is separate from completing a SweatScore workout or habit check-in.

## Temporary development testing tools

The development build can show a **Development testing** panel on the Coach entry screen. It requires an authenticated eligible administrator, the private reset flag set to exactly `true`, and the approved `beloved-stoat-88` development deployment. It is excluded from production UI through a development-only module guard, with server-side authorization as an additional safeguard.

Two separate confirmed actions are available:

- **Reset today's focus:** deletes only this account's Coach plans for its current local date. The profile and older plans remain.
- **Reset all Coach test data:** deletes only this account's Coach profiles and all its Coach daily plans. Setup is required again.

Neither operation changes eligibility flags, the member account, or ordinary SweatScore data. Neither starts a plan or calls Claude. After a reset, a tester must explicitly complete setup or the daily questions; generating another normal focus may incur another provider request. Resetting data cannot undo a provider request that was already in flight, so let generation finish before scenario resets.

These are destructive development tools, not normal member functionality. Initial deployment verification must not invoke them. The implementation also refuses oversized resets before deleting records.
