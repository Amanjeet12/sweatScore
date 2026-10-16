import type { DailyOutput, DailySnapshot } from './coachDailyPolicy';
import { buildDeterministicDailyPlanV2, validateDailyPlanOutputV2 } from './coachDailyPolicyV2';
import type { DailyOutputV2 } from './coachDailyPolicyV2';
import type { DailyOutputV3 } from './coachDailyPolicyV3';
import {
  DailyPlanValidationErrorV3,
  dailyPlanCopyRefinementsV3,
  validateDailyPlanOutputV3,
} from './coachDailyPolicyV3';
import type { ProviderResult } from './coachDailyProvider';

type Guidance = {
  previousCandidate?: DailyOutput | DailyOutputV2 | DailyOutputV3;
  validationCode?: string;
  validationCodes?: string[];
  validationFeedback?: { prohibited_terms: string[]; food_names: string[] };
};

function validationCode(
  result: ProviderResult,
  snapshot: DailySnapshot,
  day: string,
  recentPlans: { day: string; output: DailyOutput }[]
) {
  if (!result.ok) return result.formatCode ?? result.code;
  try {
    validateDailyPlanOutputV2(result.output, snapshot, day, recentPlans);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'invalid_output';
  }
}

// One logical saved request may ask the provider to revise one invalid candidate.
// No plan, post, reward or second request is created here.
export async function generateV2WithRepair(args: {
  call: (guidance?: Guidance) => Promise<ProviderResult>;
  snapshot: DailySnapshot;
  day: string;
  recentPlans: { day: string; output: DailyOutput }[];
}): Promise<ProviderResult> {
  const first = await args.call();
  const firstValidationCode = validationCode(first, args.snapshot, args.day, args.recentPlans);
  if (!firstValidationCode) return first;
  if (!first.ok && first.code !== 'invalid_output') return first;
  const second = await args.call({
    previousCandidate: first.ok ? first.output : undefined,
    validationCode: firstValidationCode,
  });
  const latencyMs = first.latencyMs + second.latencyMs;
  const secondValidationCode = validationCode(second, args.snapshot, args.day, args.recentPlans);
  if (secondValidationCode) {
    const output = buildDeterministicDailyPlanV2(args.snapshot, args.day, args.recentPlans);
    validateDailyPlanOutputV2(output, args.snapshot, args.day, args.recentPlans);
    return {
      ok: true,
      output,
      latencyMs,
      inputTokens:
        first.ok && second.ok && first.inputTokens !== undefined && second.inputTokens !== undefined
          ? first.inputTokens + second.inputTokens
          : second.ok
            ? second.inputTokens
            : undefined,
      outputTokens:
        first.ok &&
        second.ok &&
        first.outputTokens !== undefined &&
        second.outputTokens !== undefined
          ? first.outputTokens + second.outputTokens
          : second.ok
            ? second.outputTokens
            : undefined,
    };
  }
  if (!second.ok) return second;
  return {
    ...second,
    latencyMs,
    inputTokens:
      first.ok && first.inputTokens !== undefined && second.inputTokens !== undefined
        ? first.inputTokens + second.inputTokens
        : second.inputTokens,
    outputTokens:
      first.ok && first.outputTokens !== undefined && second.outputTokens !== undefined
        ? first.outputTokens + second.outputTokens
        : second.outputTokens,
  };
}

// The client prompt owns V3 recommendations. Never replace it with the old fixed-plan fallback.
export async function generateV3WithRepair(args: {
  call: (guidance?: Guidance) => Promise<ProviderResult>;
  snapshot: DailySnapshot;
  day: string;
  recentPlans: { day: string; output: DailyOutput }[];
}): Promise<ProviderResult> {
  let latencyMs = 0;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let previousCandidate: DailyOutput | DailyOutputV2 | DailyOutputV3 | undefined;
  let validationCode: string | undefined;
  let validationCodes: string[] | undefined;
  let validationFeedback: Guidance['validationFeedback'];
  let providerFormat = false;
  let model: string | undefined;
  let retriedTransientFailure = false;
  let bestValid: Extract<ProviderResult, { ok: true }> | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await args.call(
      attempt
        ? { previousCandidate, validationCode, validationCodes, validationFeedback }
        : undefined
    );
    latencyMs += result.latencyMs;
    model = result.model ?? model;
    if (result.ok) {
      if (result.inputTokens !== undefined) inputTokens = (inputTokens ?? 0) + result.inputTokens;
      if (result.outputTokens !== undefined)
        outputTokens = (outputTokens ?? 0) + result.outputTokens;
    }
    if (!result.ok && result.code !== 'invalid_output') {
      if (bestValid) return { ...bestValid, latencyMs, inputTokens, outputTokens };
      const transient =
        result.code === 'provider_timeout' ||
        (result.code === 'provider_unavailable' &&
          (!result.formatCode || /^provider_http_(500|502|503|504|529)$/.test(result.formatCode)));
      // One transient recovery, inside the SAME three-call request budget. Never
      // retry authentication, schema/configuration errors or rate limiting here.
      if (transient && !retriedTransientFailure && attempt < 2) {
        retriedTransientFailure = true;
        await new Promise((resolve) => setTimeout(resolve, 250));
        latencyMs += 250;
        continue;
      }
      return { ...result, latencyMs };
    }
    try {
      if (!result.ok) throw new Error(result.formatCode ?? 'invalid_output');
      validateDailyPlanOutputV3(result.output, args.snapshot, args.day, args.recentPlans);
      if (
        bestValid &&
        JSON.stringify([
          result.output.workout,
          result.output.steps,
          result.output.meals,
          result.output.sleep,
        ]) !==
          JSON.stringify([
            bestValid.output.workout,
            bestValid.output.steps,
            bestValid.output.meals,
            bestValid.output.sleep,
          ])
      ) {
        // A copy-only refinement cannot replace an already valid recommendation.
        // Text spelling may differ, but the numeric/type targets must not change.
        const next = result.output as DailyOutputV3;
        const best = bestValid.output as DailyOutputV3;
        if (
          JSON.stringify([
            next.workout.type,
            next.workout.minutes,
            next.workout.intensity,
            next.steps.target,
            next.meals.water_litres,
            next.sleep.hours,
          ]) !==
          JSON.stringify([
            best.workout.type,
            best.workout.minutes,
            best.workout.intensity,
            best.steps.target,
            best.meals.water_litres,
            best.sleep.hours,
          ])
        )
          throw new Error('refinement_changed_targets');
      }
      const refinements = dailyPlanCopyRefinementsV3(result.output as DailyOutputV3, args.snapshot);
      if (!refinements.length) return { ...result, latencyMs, inputTokens, outputTokens };
      bestValid = result;
      previousCandidate = result.output;
      validationCode = refinements[0];
      validationCodes = refinements;
      validationFeedback = undefined;
      providerFormat = false;
    } catch (error) {
      validationCode = error instanceof Error ? error.message : 'invalid_output';
      validationCodes =
        error instanceof DailyPlanValidationErrorV3 ? error.codes : [validationCode];
      validationFeedback = error instanceof DailyPlanValidationErrorV3 ? error.feedback : undefined;
      providerFormat = !result.ok;
      previousCandidate = bestValid?.output ?? (result.ok ? result.output : undefined);
    }
  }
  if (bestValid) return { ...bestValid, latencyMs, inputTokens, outputTokens };
  return {
    ok: false,
    code: 'invalid_output',
    model,
    // Keep the final rejected rule, not only the generic validation bucket.
    formatCode: providerFormat
      ? (validationCode ?? 'invalid_output')
      : `plan_validation:${validationCode ?? 'invalid_output'}`,
    latencyMs,
  };
}
