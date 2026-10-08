import type { Doc } from './_generated/dataModel';
import { dailyPolicy } from './coachDailyPolicy';
import { DAILY_PLAN_PROMPT_VERSION } from './coachDailyPrompt';
import { DAILY_PLAN_V2_PROMPT_VERSION } from './coachDailyPromptV2';
import { DAILY_PLAN_V2_1_PROMPT_VERSION } from './coachDailyPromptV2_1';
import { DAILY_PLAN_V3_PROMPT_VERSION } from './coachDailyPromptV3';
import { canRetryFailedPlan } from '../shared/coachPlanRetry';

export function canRetryCurrentPlanRequest(request: Doc<'coachPlanRequestsV1'> | null): boolean {
  const policyResolved = Boolean(
    request?.errorCode === 'policy_unresolved' &&
    request.inputSnapshot &&
    !dailyPolicy(request.inputSnapshot, request.day).unresolved
  );
  return Boolean(
    request &&
    [
      DAILY_PLAN_PROMPT_VERSION,
      DAILY_PLAN_V2_PROMPT_VERSION,
      DAILY_PLAN_V2_1_PROMPT_VERSION,
      DAILY_PLAN_V3_PROMPT_VERSION,
    ].includes(request.promptVersion) &&
    canRetryFailedPlan(request, request.promptVersion, policyResolved)
  );
}
