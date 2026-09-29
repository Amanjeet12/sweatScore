import type { DailyOutput, DailySnapshot } from './coachDailyPolicy';
import { buildDeterministicDailyPlanV2, validateDailyPlanOutputV2 } from './coachDailyPolicyV2';
import type { DailyOutputV2 } from './coachDailyPolicyV2';
import type { ProviderResult } from './coachDailyProvider';

type Guidance = {
  previousCandidate?: DailyOutput | DailyOutputV2;
  validationCode?: string;
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
