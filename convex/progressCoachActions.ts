import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalAction } from './_generated/server';
import { buildDeterministicCoachFallback } from './progressCoachPolicy';
import type {
  CoachComputedTargets,
  CoachContextSummary,
  CoachDailyInputs,
  CoachGeneratedCopy,
  CoachGenerationProfile,
  CoachPlanOutput,
} from '../shared/progressCoach';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const TOOL_NAME = 'submit_progress_coach_copy';
const MAX_CONFIGURED_OUTPUT_TOKENS = 500;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 20_000;

const COPY_LIMITS = {
  headline: 80,
  checkInLabel: 140,
  nutritionMessage: 180,
  why: 280,
} as const;

const SYSTEM_INSTRUCTION = [
  'Write four concise strings for a daily wellness coach.',
  'Use supportive, non-judgmental language.',
  'Do not diagnose, give medical advice, or add or change numeric targets.',
  'Cite only supplied verified facts and never claim a recommendation was completed.',
  `Submit ${TOOL_NAME} exactly once.`,
].join(' ');

type CoachGenerationPayload = {
  profile: CoachGenerationProfile;
  daily: CoachDailyInputs;
  plan: {
    checkInType: CoachComputedTargets['checkIn']['type'];
    durationMinutes: number;
    stepTarget?: number;
    hydrationLitres: number;
    carbServings: 1 | 2;
  };
  verified: CoachContextSummary;
};

type ProviderConfig = {
  apiKey: string;
  model: string;
  promptVersion: string;
  maxOutputTokens: number;
  timeoutMs: number;
};

type SafeProviderErrorCode =
  | 'provider_timeout'
  | 'provider_rate_limited'
  | 'provider_invalid_response'
  | 'provider_unavailable';

type ProviderResult =
  | {
      ok: true;
      copy: CoachGeneratedCopy;
      inputTokens?: number;
      outputTokens?: number;
    }
  | { ok: false; errorCode: SafeProviderErrorCode };

type FetchLike = typeof fetch;

export function buildCoachGenerationPayload(args: {
  profile: CoachGenerationProfile;
  daily: CoachDailyInputs;
  computedTargets: CoachComputedTargets;
  contextSummary: CoachContextSummary;
}): CoachGenerationPayload {
  return {
    profile: {
      goal: args.profile.goal,
      bodyFeeling: args.profile.bodyFeeling,
      routineFeeling: args.profile.routineFeeling,
      foodRelationship: args.profile.foodRelationship,
      usualSleep: args.profile.usualSleep,
      biggestStruggle: args.profile.biggestStruggle,
      lastRealProgress: args.profile.lastRealProgress,
    },
    daily: {
      sleep: args.daily.sleep,
      energy: args.daily.energy,
      mood: args.daily.mood,
      availableTime: args.daily.availableTime,
      bodyCondition: args.daily.bodyCondition,
    },
    plan: {
      checkInType: args.computedTargets.checkIn.type,
      durationMinutes: args.computedTargets.checkIn.durationMinutes,
      ...(args.computedTargets.steps.target === undefined
        ? {}
        : { stepTarget: args.computedTargets.steps.target }),
      hydrationLitres: args.computedTargets.hydration.litres,
      carbServings: args.computedTargets.nutrition.carbServings,
    },
    verified: {
      usableDays: args.contextSummary.usableDays,
      ...(args.contextSummary.averageSteps === undefined
        ? {}
        : { averageSteps: args.contextSummary.averageSteps }),
      ...(args.contextSummary.averageActiveMinutes === undefined
        ? {}
        : { averageActiveMinutes: args.contextSummary.averageActiveMinutes }),
      activeDays: args.contextSummary.activeDays,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
  );
}

export function validateCoachGeneratedCopy(value: unknown): CoachGeneratedCopy | null {
  if (!isRecord(value)) return null;

  const expectedKeys = Object.keys(COPY_LIMITS).sort();
  const actualKeys = Object.keys(value).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    return null;
  }

  const result: Partial<CoachGeneratedCopy> = {};
  for (const key of expectedKeys as (keyof CoachGeneratedCopy)[]) {
    const raw = value[key];
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > COPY_LIMITS[key]) return null;
    result[key] = trimmed;
  }

  return result as CoachGeneratedCopy;
}

export function assembleCoachPlanOutput(
  copy: CoachGeneratedCopy,
  targets: CoachComputedTargets
): CoachPlanOutput {
  const output: CoachPlanOutput = {
    headline: copy.headline,
    checkIn: {
      type: targets.checkIn.type,
      durationMinutes: targets.checkIn.durationMinutes,
      label: copy.checkInLabel,
    },
    nutrition: {
      carbServings: targets.nutrition.carbServings,
      message: copy.nutritionMessage,
    },
    steps: targets.steps,
    hydration: targets.hydration,
    why: copy.why,
  };

  if (
    output.checkIn.type !== targets.checkIn.type ||
    output.checkIn.durationMinutes !== targets.checkIn.durationMinutes ||
    output.nutrition.carbServings !== targets.nutrition.carbServings ||
    output.steps.target !== targets.steps.target ||
    output.hydration.litres !== targets.hydration.litres
  ) {
    throw new Error('Coach output did not preserve deterministic targets');
  }

  return output;
}

function readProviderConfig(): ProviderConfig | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const model = process.env.PROGRESS_COACH_MODEL?.trim();
  const promptVersion = process.env.PROGRESS_COACH_PROMPT_VERSION?.trim();
  const configuredMaxTokens = Number(process.env.PROGRESS_COACH_MAX_OUTPUT_TOKENS);
  const configuredTimeout = Number(process.env.PROGRESS_COACH_TIMEOUT_MS);

  if (
    !apiKey ||
    !model ||
    !promptVersion ||
    !Number.isFinite(configuredMaxTokens) ||
    configuredMaxTokens <= 0 ||
    !Number.isInteger(configuredMaxTokens) ||
    !Number.isFinite(configuredTimeout) ||
    configuredTimeout <= 0
  ) {
    return null;
  }

  return {
    apiKey,
    model,
    promptVersion,
    maxOutputTokens: Math.min(configuredMaxTokens, MAX_CONFIGURED_OUTPUT_TOKENS),
    timeoutMs: Math.min(Math.max(configuredTimeout, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS),
  };
}

function parseProviderResponse(value: unknown): ProviderResult {
  if (!isRecord(value) || !Array.isArray(value.content) || value.content.length !== 1) {
    return { ok: false, errorCode: 'provider_invalid_response' };
  }

  const block = value.content[0];
  if (!isRecord(block) || block.type !== 'tool_use' || block.name !== TOOL_NAME) {
    return { ok: false, errorCode: 'provider_invalid_response' };
  }

  const copy = validateCoachGeneratedCopy(block.input);
  if (!copy) return { ok: false, errorCode: 'provider_invalid_response' };

  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  if (value.usage !== undefined) {
    if (!isRecord(value.usage)) return { ok: false, errorCode: 'provider_invalid_response' };
    if (
      !isNonNegativeInteger(value.usage.input_tokens) ||
      !isNonNegativeInteger(value.usage.output_tokens)
    ) {
      return { ok: false, errorCode: 'provider_invalid_response' };
    }
    inputTokens = value.usage.input_tokens;
    outputTokens = value.usage.output_tokens;
  }

  return { ok: true, copy, inputTokens, outputTokens };
}

export async function requestCoachGeneratedCopy(args: {
  config: ProviderConfig | null;
  payload: CoachGenerationPayload;
  fetchImpl?: FetchLike;
}): Promise<ProviderResult> {
  if (!args.config) return { ok: false, errorCode: 'provider_unavailable' };

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, args.config.timeoutMs);

  try {
    const response = await (args.fetchImpl ?? fetch)(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': ANTHROPIC_VERSION,
        'x-api-key': args.config.apiKey,
      },
      body: JSON.stringify({
        model: args.config.model,
        max_tokens: args.config.maxOutputTokens,
        temperature: 0,
        system: SYSTEM_INSTRUCTION,
        messages: [{ role: 'user', content: JSON.stringify(args.payload) }],
        tools: [
          {
            name: TOOL_NAME,
            description: 'Submit the four approved Progress Coach wording fields.',
            input_schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                headline: { type: 'string', maxLength: COPY_LIMITS.headline },
                checkInLabel: { type: 'string', maxLength: COPY_LIMITS.checkInLabel },
                nutritionMessage: { type: 'string', maxLength: COPY_LIMITS.nutritionMessage },
                why: { type: 'string', maxLength: COPY_LIMITS.why },
              },
              required: ['headline', 'checkInLabel', 'nutritionMessage', 'why'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: TOOL_NAME },
      }),
      signal: controller.signal,
    });

    if (response.status === 429) {
      return { ok: false, errorCode: 'provider_rate_limited' };
    }
    if (!response.ok) return { ok: false, errorCode: 'provider_unavailable' };

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, errorCode: 'provider_invalid_response' };
    }
    return parseProviderResponse(body);
  } catch {
    return {
      ok: false,
      errorCode: timedOut ? 'provider_timeout' : 'provider_unavailable',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export const generateCoachPlan = internalAction({
  args: { planId: v.id('coachDailyPlans'), generationAttempt: v.number() },
  handler: async (ctx, args): Promise<{ status: 'ready' | 'fallback' | 'ignored' }> => {
    let context;
    try {
      context = await ctx.runQuery(internal.progressCoach.loadCoachContext, args);
    } catch {
      // A missing, terminal, or superseded plan is intentionally ignored.
      return { status: 'ignored' };
    }

    const startedAt = Date.now();
    const fallback = buildDeterministicCoachFallback(
      context.computedTargets,
      context.contextSummary
    );

    try {
      if (!context.computedTargets.mayCallClaude) {
        await ctx.runMutation(internal.progressCoach.saveCoachPlan, {
          planId: context.planId,
          generationAttempt: context.generationAttempt,
          status: 'fallback',
          safetyState: context.computedTargets.safetyState,
          computedTargets: context.computedTargets,
          contextSummary: context.contextSummary,
          output: fallback,
          completedAt: Date.now(),
          latencyMs: Date.now() - startedAt,
        });
        return { status: 'fallback' };
      }

      const config = readProviderConfig();
      const result = await requestCoachGeneratedCopy({
        config,
        payload: buildCoachGenerationPayload({
          profile: context.profile,
          daily: context.inputs,
          computedTargets: context.computedTargets,
          contextSummary: context.contextSummary,
        }),
      });
      const providerMetadata = config
        ? { provider: 'anthropic' as const, model: config.model }
        : {};

      if (!result.ok) {
        await ctx.runMutation(internal.progressCoach.saveCoachPlan, {
          planId: context.planId,
          generationAttempt: context.generationAttempt,
          status: 'fallback',
          safetyState: context.computedTargets.safetyState,
          computedTargets: context.computedTargets,
          contextSummary: context.contextSummary,
          output: fallback,
          completedAt: Date.now(),
          latencyMs: Date.now() - startedAt,
          errorCode: result.errorCode,
          ...providerMetadata,
        });
        return { status: 'fallback' };
      }

      const output = assembleCoachPlanOutput(result.copy, context.computedTargets);
      const usage = {
        ...(result.inputTokens === undefined ? {} : { inputTokens: result.inputTokens }),
        ...(result.outputTokens === undefined ? {} : { outputTokens: result.outputTokens }),
      };
      await ctx.runMutation(internal.progressCoach.saveCoachPlan, {
        planId: context.planId,
        generationAttempt: context.generationAttempt,
        status: 'ready',
        safetyState: context.computedTargets.safetyState,
        computedTargets: context.computedTargets,
        contextSummary: context.contextSummary,
        output,
        completedAt: Date.now(),
        latencyMs: Date.now() - startedAt,
        ...usage,
        ...providerMetadata,
      });
      return { status: 'ready' };
    } catch {
      await ctx.runMutation(internal.progressCoach.saveCoachPlan, {
        planId: context.planId,
        generationAttempt: context.generationAttempt,
        status: 'fallback',
        safetyState: context.computedTargets.safetyState,
        computedTargets: context.computedTargets,
        contextSummary: context.contextSummary,
        output: fallback,
        completedAt: Date.now(),
        latencyMs: Date.now() - startedAt,
        errorCode: 'generation_failed',
      });
      return { status: 'fallback' };
    }
  },
});
