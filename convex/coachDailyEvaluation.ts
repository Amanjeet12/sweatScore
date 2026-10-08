import { v } from 'convex/values';

import { internalAction } from './_generated/server';
import type { DailySnapshot, DailyOutput } from './coachDailyPolicy';
import { buildDailyProviderInputV3, validateDailyPlanOutputV3 } from './coachDailyPolicyV3';
import { DAILY_PLAN_V3_PROMPT_VERSION } from './coachDailyPromptV3';
import { generateDailyPlan, providerConfig } from './coachDailyProvider';
import { generateV3WithRepair } from './coachDailyRepair';
import { addDaysToDateKey } from './utils/timezone';

const scenarios = v.union(
  v.literal('tired_recomp'),
  v.literal('rested_full'),
  v.literal('new_member'),
  v.literal('no_rest'),
  v.literal('walking_recomp'),
  v.literal('low_steps'),
  v.literal('unwell')
);

/** Fictional client acceptance cases only. No member reads, writes, rewards or posts. */
export const evaluateClientCase = internalAction({
  args: { scenario: scenarios },
  handler: async (_ctx, { scenario }) => {
    const day = new Date().toISOString().slice(0, 10);
    const date = (offset: number) => addDaysToDateKey(day, -offset);
    const snapshot: DailySnapshot = {
      profile: {
        goal: 'recomp',
        bodyFeeling: 'feel_good',
        routineFeeling: 'working_keep_going',
        foodRelationship: 'balanced_most_days',
        usualSleep: 'regular_restful',
        biggestChallenge: 'time',
      },
      weight: { value: 75, unit: 'kg' },
      weightHistory: [],
      daily: {
        sleep: 'rested_enough',
        energy: 'steady',
        upFor: 'full_session',
        trainedYesterday: ['nothing'],
        body: ['fine'],
      },
      health: { steps: [], workouts: [], recentDays: [] },
      recentPlanRevisionIds: [],
    };
    const addWorkout = (offset: number, type: string, minutes: number) =>
      snapshot.health.workouts.push({
        day: date(offset),
        label: 'workout',
        source: 'activity_log',
        plannedType: type,
        plannedMinutes: minutes,
      });
    const addSteps = (count: number) => {
      snapshot.health.steps = Array.from({ length: 7 }, (_, i) => ({
        day: date(i + 1),
        count,
        source: 'health_sync',
        coverage: 'sensor_observed',
      }));
    };
    const recentPlans: { day: string; output: DailyOutput }[] = [];
    if (scenario === 'tired_recomp') {
      snapshot.daily.sleep = 'barely_rested';
      addWorkout(3, 'full_body_strength', 35);
      addSteps(10000);
    }
    if (scenario === 'rested_full') {
      snapshot.daily.sleep = 'restful';
      snapshot.daily.energy = 'full';
      addSteps(7500);
      for (const offset of [2, 4, 6]) addWorkout(offset, 'full_body_strength', 50);
      snapshot.health.recentDays = Array.from({ length: 7 }, (_, i) => ({
        day: date(i + 1),
        checkedIn: true,
        completedCategories: [
          ...([2, 4, 6].includes(i + 1) ? ['workout'] : []),
          'steps',
          'sleep',
          'meals',
        ],
        restPlanned: [1, 5].includes(i + 1),
        planCompleted: true,
      }));
    }
    if (scenario === 'new_member') snapshot.profile.goal = 'lose';
    if (scenario === 'no_rest') {
      snapshot.profile.goal = 'lose';
      snapshot.daily.trainedYesterday = ['cardio'];
      addSteps(9000);
      for (let offset = 1; offset <= 6; offset++)
        addWorkout(offset, offset % 2 ? 'cardio' : 'full_body_strength', 45);
    }
    if (scenario === 'walking_recomp') {
      snapshot.daily.sleep = 'restful';
      snapshot.daily.energy = 'full';
      snapshot.daily.upFor = 'short_session';
      addSteps(8000);
      for (let offset = 1; offset <= 10; offset++) addWorkout(offset, 'walking', 20);
    }
    if (scenario === 'low_steps') {
      snapshot.profile.goal = 'lose';
      snapshot.daily.upFor = 'short_session';
      snapshot.daily.trainedYesterday = ['upper_body'];
      addWorkout(1, 'upper_body_strength', 25);
      addSteps(3500);
    }
    if (scenario === 'unwell') {
      snapshot.profile.goal = 'fitness';
      snapshot.daily.sleep = 'barely_rested';
      snapshot.daily.energy = 'flat';
      snapshot.daily.upFor = 'something_light';
      snapshot.daily.body = ['pain_unwell'];
    }
    const config = providerConfig(DAILY_PLAN_V3_PROMPT_VERSION);
    const candidates: { output: unknown; validation: string | null }[] = [];
    const result = await generateV3WithRepair({
      snapshot,
      day,
      recentPlans,
      call: async (retryGuidance) => {
        const candidate = await generateDailyPlan({
          config,
          input: buildDailyProviderInputV3(snapshot, day, recentPlans),
          style: { tone: 'warm_direct', detail: 'standard' },
          promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
          retryGuidance,
        });
        if (candidate.ok) {
          let validation = null;
          try {
            validateDailyPlanOutputV3(candidate.output, snapshot, day, recentPlans);
          } catch (error) {
            validation = error instanceof Error ? error.message : 'invalid_output';
          }
          candidates.push({ output: candidate.output, validation });
        }
        return candidate;
      },
    });
    return { scenario, promptVersion: DAILY_PLAN_V3_PROMPT_VERSION, result, candidates };
  },
});
