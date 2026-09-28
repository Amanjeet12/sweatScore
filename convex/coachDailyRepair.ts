import type { DailyOutput, DailySnapshot } from './coachDailyPolicy';
import { validateDailyPlanOutputV2 } from './coachDailyPolicyV2';
import type { DailyOutputV2 } from './coachDailyPolicyV2';
import type { ProviderResult } from './coachDailyProvider';

type Guidance = { previousCandidate?: DailyOutput | DailyOutputV2 };

function valid(
  result: ProviderResult,
  snapshot: DailySnapshot,
  day: string,
  recentPlans: { day: string; output: DailyOutput }[]
) {
  if (!result.ok) return false;
  try {
    validateDailyPlanOutputV2(result.output, snapshot, day, recentPlans);
    return true;
  } catch {
    return false;
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
  if (valid(first, args.snapshot, args.day, args.recentPlans)) return first;
  if (!first.ok && first.code !== 'invalid_output') return first;
  const second = await args.call({ previousCandidate: first.ok ? first.output : undefined });
  const latencyMs = first.latencyMs + second.latencyMs;
  if (!valid(second, args.snapshot, args.day, args.recentPlans))
    return {
      ok: false,
      code: second.ok ? 'invalid_output' : second.code,
      formatCode: second.ok ? 'plan_validation' : second.formatCode,
      latencyMs,
    };
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
