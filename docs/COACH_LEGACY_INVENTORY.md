# Coach legacy migration inventory (read only)

Run `coachLegacyInventory:forMemberDay` in a non-production Convex environment with a member ID and `YYYY-MM-DD` app day. It returns legacy `challengeCompletions`, `dailyActivities`, and `coachDailyPlans` alongside new slots/submissions, omitting media URLs and raw plan text. No migration or reward writes occur. Run across representative days and compare point totals before any cutover.

Map only actual old `check_in` challenge completions and `gym_workout`/`workout` logs to the Workout eligibility review. `healthy_meal`, `sleep`, and `steps` logs map to their own category review. `hydration` is **not** workout proof, despite the old UI alias. Every old plan association remains `legacy_unknown` unless independent evidence proves it. Include removed completions and all point values in the review so prior awards are not recreated.

The old challenge upload queue (`challenge-upload-queue:v1` in `components/providers/ChallengeUploadProvider.tsx`) lives in device MMKV. The server inventory cannot see queued/uploading/finalizing/failed jobs. For a controlled migration rehearsal, inspect consenting test devices' queue metadata (job ID, challenge ID, created time, status, storage IDs) and reconcile it with completions and posts after upload. Do not infer a new plan revision from an old queued job. A server-side storage object alone is not proof that the corresponding activity completed.

Before stage 8, record counts and IDs of pending legacy rollover and notification jobs in the deployed environment, old scheduler windows, and exact category mappings. Preserve the source records; use a resumable migration ledger and check a rerun makes no new awards.

The current development-only read-only snapshot, paginated reconciliation contract, ledger fields, unresolved custom categories and blocked cutover gate are recorded in [COACH_STAGE8_DRY_RUN.md](COACH_STAGE8_DRY_RUN.md). Its source-page function does not migrate data or award points.
