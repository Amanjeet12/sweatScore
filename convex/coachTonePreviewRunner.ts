import { DailySnapshot } from './coachDailyPolicy';
import { buildDailyProviderInputV3, validateDailyPlanOutputV3 } from './coachDailyPolicyV3';
import { DAILY_PLAN_V3_PROMPT_VERSION } from './coachDailyPromptV3';
import { generateDailyPlan, ProviderConfig } from './coachDailyProvider';
import { generateV3WithRepair } from './coachDailyRepair';
import { analyzeMealPhoto } from './coachMealProvider';
import {
  effectiveTone,
  FICTIONAL_DAILY_SNAPSHOT,
  FICTIONAL_PREVIEW_DAY,
  ToneSelection,
} from '../shared/coachTonePreview';

export async function runDailyTonePreview(args: {
  selection: ToneSelection;
  priorStyle?: { tone: ToneSelection['tone']; detail: ToneSelection['detail'] };
  config: ProviderConfig;
  fetchImpl?: typeof fetch;
}) {
  const snapshot = structuredClone(FICTIONAL_DAILY_SNAPSHOT) as unknown as DailySnapshot;
  const input = {
    ...buildDailyProviderInputV3(snapshot, FICTIONAL_PREVIEW_DAY, []),
    recorded_meals: [],
  };
  const style = effectiveTone(args.selection, 'daily_plan', args.priorStyle);
  const result = await generateV3WithRepair({
    call: (retryGuidance) =>
      generateDailyPlan({
        config: args.config,
        input,
        style,
        fetchImpl: args.fetchImpl,
        promptVersion: DAILY_PLAN_V3_PROMPT_VERSION,
        retryGuidance,
      }),
    snapshot,
    day: FICTIONAL_PREVIEW_DAY,
    recentPlans: [],
  });
  if (!result.ok) return result;
  try {
    const validated = validateDailyPlanOutputV3(result.output, snapshot, FICTIONAL_PREVIEW_DAY, []);
    return { ...result, output: validated.output };
  } catch {
    return { ok: false as const, code: 'invalid_output' as const, latencyMs: result.latencyMs };
  }
}

export async function runMealTonePreview(args: {
  selection: ToneSelection;
  priorStyle?: { tone: ToneSelection['tone']; detail: ToneSelection['detail'] };
  config: ProviderConfig;
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  fetchImpl?: typeof fetch;
}) {
  return analyzeMealPhoto({
    config: args.config,
    imageBase64: args.imageBase64,
    mediaType: args.mediaType,
    goal: 'lose',
    workoutLoggedToday: false,
    style: effectiveTone(args.selection, 'meal_feedback', args.priorStyle),
    fetchImpl: args.fetchImpl,
  });
}
